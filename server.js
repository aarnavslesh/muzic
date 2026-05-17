const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
// Bind to all interfaces by default so the dev server is reachable from other machines
// (e.g., mobile device on same LAN or container). Override with `HOST` env var if needed.
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");

const JSON_LIMIT_BYTES = 25 * 1024 * 1024;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac"
};

function ensureStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    writeDb({
      users: [],
      tracks: [],
      playlists: [],
      listens: [],
      sessions: []
    });
  }
}

function readDb() {
  ensureStorage();
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  if (!Array.isArray(db.playlists)) db.playlists = [];
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const candidate = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function sendApiError(res, status, message) {
  sendError(res, status, message);
  return true;
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

function getCurrentUser(req, db) {
  const token = parseCookies(req).session;
  if (!token) return null;
  const now = Date.now();
  const session = db.sessions.find((item) => item.token === token && item.expiresAt > now);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function requireUser(req, res, db) {
  const user = getCurrentUser(req, db);
  if (!user) {
    sendError(res, 401, "You must be logged in.");
    return null;
  }
  return user;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > JSON_LIMIT_BYTES) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function serializeTrack(track) {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    kind: track.kind,
    sourceType: track.sourceType,
    sourceUrl: track.sourceUrl,
    playableUrl: track.playableUrl,
    createdBy: track.createdBy,
    createdAt: track.createdAt
  };
}

function serializePlaylist(playlist, db) {
  const tracksById = new Map(db.tracks.map((track) => [track.id, track]));
  const tracks = (playlist.trackIds || [])
    .map((trackId) => tracksById.get(trackId))
    .filter(Boolean)
    .map(serializeTrack);

  return {
    id: playlist.id,
    name: playlist.name,
    createdBy: playlist.createdBy,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
    trackIds: playlist.trackIds || [],
    tracks
  };
}

function artistTotalsForUser(db, userId) {
  const totals = new Map();
  const tracksById = new Map(db.tracks.map((track) => [track.id, track]));
  for (const listen of db.listens.filter((item) => item.userId === userId)) {
    const track = tracksById.get(listen.trackId);
    if (!track) continue;
    totals.set(track.artist, (totals.get(track.artist) || 0) + listen.secondsPlayed);
  }
  return totals;
}

function cosineSimilarity(left, right) {
  const artists = new Set([...left.keys(), ...right.keys()]);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (const artist of artists) {
    const a = left.get(artist) || 0;
    const b = right.get(artist) || 0;
    dot += a * b;
    leftMagnitude += a * a;
    rightMagnitude += b * b;
  }
  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function buildStats(db, user) {
  const userListens = db.listens.filter((listen) => listen.userId === user.id);
  const tracksById = new Map(db.tracks.map((track) => [track.id, track]));
  const artistStats = new Map();
  let totalSeconds = 0;

  for (const listen of userListens) {
    const track = tracksById.get(listen.trackId);
    if (!track) continue;
    totalSeconds += listen.secondsPlayed;
    const current = artistStats.get(track.artist) || { artist: track.artist, secondsPlayed: 0, plays: 0 };
    current.secondsPlayed += listen.secondsPlayed;
    current.plays += 1;
    artistStats.set(track.artist, current);
  }

  const currentVector = artistTotalsForUser(db, user.id);
  const similarUsers = db.users
    .filter((candidate) => candidate.id !== user.id)
    .map((candidate) => ({
      user: publicUser(candidate),
      score: cosineSimilarity(currentVector, artistTotalsForUser(db, candidate.id))
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    totalSeconds,
    totalFormatted: formatDuration(totalSeconds),
    mostListenedArtists: [...artistStats.values()].sort((a, b) => b.secondsPlayed - a.secondsPlayed),
    similarUsers
  };
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getYouTubeEmbedUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    let id = "";
    if (parsed.hostname.includes("youtu.be")) {
      id = parsed.pathname.slice(1);
    } else if (parsed.hostname.includes("youtube.com")) {
      id = parsed.searchParams.get("v") || parsed.pathname.split("/").pop();
    }
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  } catch {
    return null;
  }
}

function getSoundCloudEmbedUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.includes("soundcloud.com")) return null;
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(rawUrl)}`;
  } catch {
    return null;
  }
}

function parseSpotifyUrl(rawUrl) {
  const value = normalizeText(rawUrl);
  const uriMatch = value.match(/^spotify:(track|playlist):([A-Za-z0-9]+)$/);
  if (uriMatch) return { type: uriMatch[1], id: uriMatch[2] };

  try {
    const parsed = new URL(value);
    if (!parsed.hostname.includes("spotify.com")) return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    const typeIndex = parts.findIndex((part) => ["track", "playlist"].includes(part));
    if (typeIndex === -1 || !parts[typeIndex + 1]) return null;
    return { type: parts[typeIndex], id: parts[typeIndex + 1] };
  } catch {
    return null;
  }
}

function getSpotifyOpenUrl(type, id) {
  return "https://open.spotify.com/" + type + "/" + encodeURIComponent(id);
}

function getSpotifyEmbedUrl(rawUrl) {
  const parsed = parseSpotifyUrl(rawUrl);
  if (!parsed) return null;
  return "https://open.spotify.com/embed/" + parsed.type + "/" + encodeURIComponent(parsed.id);
}

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Spotify playlist import needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your environment.");
  }

  const credentials = Buffer.from(clientId + ":" + clientSecret).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + credentials,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || "Spotify authentication failed.");
  return payload.access_token;
}

async function spotifyApiRequest(pathname, token) {
  const response = await fetch("https://api.spotify.com/v1" + pathname, {
    headers: { Authorization: "Bearer " + token }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload.error && payload.error.message) || "Spotify request failed.");
  return payload;
}

function spotifyTrackToMuzicTrack(spotifyTrack, userId) {
  const artists = (spotifyTrack.artists || []).map((artist) => artist.name).filter(Boolean).join(", ") || "Spotify";
  const sourceUrl = (spotifyTrack.external_urls && spotifyTrack.external_urls.spotify) || getSpotifyOpenUrl("track", spotifyTrack.id);
  return {
    id: makeId("trk"),
    title: spotifyTrack.name || "Untitled Spotify track",
    artist: artists,
    album: (spotifyTrack.album && spotifyTrack.album.name) || "",
    kind: "external",
    sourceType: "spotify",
    sourceUrl,
    playableUrl: getSpotifyEmbedUrl(sourceUrl) || sourceUrl,
    createdBy: userId,
    createdAt: new Date().toISOString()
  };
}

async function importSpotifyTracks(db, user, sourceUrl, fallback = {}) {
  const spotify = parseSpotifyUrl(sourceUrl);
  if (!spotify) throw new Error("Paste a valid Spotify track or playlist URL.");

  const existingUrls = new Set(db.tracks.map((track) => track.sourceUrl).filter(Boolean));
  const imported = [];
  const skipped = [];

  if (spotify.type === "track" && (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET)) {
    const title = normalizeText(fallback.title);
    const artist = normalizeText(fallback.artist);
    if (!title || !artist) {
      throw new Error("Spotify track import without API keys needs Title and Artist. Playlist import needs Spotify API keys.");
    }
    const openUrl = getSpotifyOpenUrl("track", spotify.id);
    if (!existingUrls.has(openUrl)) {
      imported.push({
        id: makeId("trk"),
        title,
        artist,
        album: normalizeText(fallback.album),
        kind: "external",
        sourceType: "spotify",
        sourceUrl: openUrl,
        playableUrl: getSpotifyEmbedUrl(openUrl) || openUrl,
        createdBy: user.id,
        createdAt: new Date().toISOString()
      });
    } else {
      skipped.push(openUrl);
    }
    db.tracks.unshift(...imported);
    return { imported, skipped, source: { type: spotify.type, id: spotify.id } };
  }

  const token = await getSpotifyAccessToken();

  if (spotify.type === "track") {
    const track = await spotifyApiRequest("/tracks/" + encodeURIComponent(spotify.id), token);
    const muzicTrack = spotifyTrackToMuzicTrack(track, user.id);
    if (existingUrls.has(muzicTrack.sourceUrl)) skipped.push(muzicTrack.sourceUrl);
    else imported.push(muzicTrack);
  } else if (spotify.type === "playlist") {
    let nextPath = "/playlists/" + encodeURIComponent(spotify.id) + "/tracks?limit=100&fields=items(track(id,name,artists(name),album(name),external_urls)),next";
    while (nextPath) {
      const page = await spotifyApiRequest(nextPath, token);
      for (const item of page.items || []) {
        if (!item.track || !item.track.id) continue;
        const muzicTrack = spotifyTrackToMuzicTrack(item.track, user.id);
        if (existingUrls.has(muzicTrack.sourceUrl) || imported.some((track) => track.sourceUrl === muzicTrack.sourceUrl)) {
          skipped.push(muzicTrack.sourceUrl);
        } else {
          imported.push(muzicTrack);
        }
      }
      nextPath = page.next ? new URL(page.next).pathname + new URL(page.next).search : null;
    }
  }

  db.tracks.unshift(...imported);
  return { imported, skipped, source: { type: spotify.type, id: spotify.id } };
}

function validateExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function deleteLocalTrackFile(track) {
  if (!track || track.kind !== "local" || !track.playableUrl?.startsWith("/uploads/")) return;
  const filePath = path.normalize(path.join(PUBLIC_DIR, track.playableUrl));
  if (!filePath.startsWith(UPLOAD_DIR)) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // The database removal should still succeed if the file is already gone.
  }
}

function saveLocalAudioFile({ fileName, mimeType, dataBase64 }) {
  if (!dataBase64 || typeof dataBase64 !== "string") {
    throw new Error("Audio file data is required.");
  }
  const extension = path.extname(fileName || "").toLowerCase();
  const allowedExtensions = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac"]);
  if (!allowedExtensions.has(extension)) {
    throw new Error("Only mp3, wav, ogg, m4a, and flac files are supported.");
  }
  if (!String(mimeType || "").startsWith("audio/")) {
    throw new Error("Uploaded file must be an audio file.");
  }
  const fileId = `${makeId("audio")}${extension}`;
  const filePath = path.join(UPLOAD_DIR, fileId);
  fs.writeFileSync(filePath, Buffer.from(dataBase64, "base64"));
  return `/uploads/${fileId}`;
}

/**
 * Get content-based recommendations for a user
 */
function getContentRecommendations(db, user, limit = 10) {
  // Get user's top artists
  const userArtists = artistTotalsForUser(db, user.id);
  const topArtists = [...userArtists.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([artist]) => artist);

  // Find tracks by those artists that the user hasn't listened to
  const listenedTrackIds = new Set(
    db.listens
      .filter(l => l.userId === user.id)
      .map(l => l.trackId)
  );

  const recommendations = [];
  for (const track of db.tracks) {
    // Skip if user already listened to this track
    if (listenedTrackIds.has(track.id)) continue;
    
    // Skip if track isn't by one of user's top artists
    if (!topArtists.includes(track.artist)) continue;
    
    // Calculate relevance score (based on artist popularity among this user)
    const artistScore = userArtists.get(track.artist) || 0;
    recommendations.push({
      track: serializeTrack(track),
      score: artistScore,
      reason: `Because you listened to ${track.artist}`
    });
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get popular tracks across all users
 */
function getPopularTracks(db, user, limit = 10) {
  // Count listens per track
  const trackListenCounts = new Map();
  const listenedTrackIds = new Set(
    db.listens
      .filter(l => l.userId === user.id)
      .map(l => l.trackId)
  );

  for (const listen of db.listens) {
    // Skip tracks user already listened to
    if (listenedTrackIds.has(listen.trackId)) continue;
    
    const count = trackListenCounts.get(listen.trackId) || 0;
    trackListenCounts.set(listen.trackId, count + 1);
  }

  // Convert to array and sort
  const sortedTracks = [...trackListenCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 2); // Get extra to account for filtering

  // Get track objects
  const tracksById = new Map(db.tracks.map(t => [t.id, t]));
  const recommendations = [];

  for (const [trackId, listenCount] of sortedTracks) {
    const track = tracksById.get(trackId);
    if (track) {
      recommendations.push({
        track: serializeTrack(track),
        score: listenCount,
        reason: "Popular track"
      });
    }
    
    if (recommendations.length >= limit) break;
  }

  return recommendations.slice(0, limit);
}

/**
 * Get recommendations based on similar users' listening habits
 */
function getSocialRecommendations(db, user, limit = 10) {
  // Get user stats for similarity calculation
  const currentUserVector = artistTotalsForUser(db, user.id);
  
  // Find similar users
  const similarUsers = db.users
    .filter(candidate => candidate.id !== user.id)
    .map(candidate => ({
      user: candidate,
      score: cosineSimilarity(currentUserVector, artistTotalsForUser(db, candidate.id))
    }))
    .filter(item => item.score > 0.1) // Only consider users with some similarity
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Get tracks listened to by similar users but not by current user
  const currentUserListened = new Set(
    db.listens
      .filter(l => l.userId === user.id)
      .map(l => l.trackId)
  );

  const recommendations = [];
  const trackScores = new Map(); // trackId -> {score, reasons}
  const tracksById = new Map(db.tracks.map(t => [t.id, t]));

  for (const similarUser of similarUsers) {
    const similarUserId = similarUser.user.id;
    const similarityScore = similarUser.score;
    
    // Get tracks this similar user listened to
    const similarUserListens = db.listens.filter(l => l.userId === similarUserId);
    
    for (const listen of similarUserListens) {
      // Skip if current user already listened
      if (currentUserListened.has(listen.trackId)) continue;
      
      const track = tracksById.get(listen.trackId);
      if (!track) continue;
      
      // Calculate recommendation score
      const currentScore = trackScores.get(listen.trackId) || { 
        score: 0, 
        reasons: new Set(),
        track: track
      };
      
      // Weight by similarity and listen time
      const newScore = similarityScore * listen.secondsPlayed;
      currentScore.score += newScore;
      currentScore.reasons.add(`Liked by similar listener (${Math.round(similarityScore * 100)}% match)`);
      
      trackScores.set(listen.trackId, currentScore);
    }
  }

  // Convert to array and sort
  return [...trackScores.values()]
    .map(item => ({
      track: serializeTrack(item.track),
      score: item.score,
      reason: Array.from(item.reasons).join(', ')
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Main recommendation function that combines all approaches
 */
function getRecommendations(db, user, limit = 20) {
  // Get different types of recommendations
  const contentRecs = getContentRecommendations(db, user, limit);
  const socialRecs = getSocialRecommendations(db, user, limit);
  const popularRecs = getPopularTracks(db, user, limit);
  
  // Combine and deduplicate
  const allRecommendations = new Map();
  
  // Add content recommendations (weight: 1.0)
  for (const rec of contentRecs) {
    const existing = allRecommendations.get(rec.track.id);
    if (existing) {
      existing.score += rec.score;
      existing.reasons.add(rec.reason);
    } else {
      allRecommendations.set(rec.track.id, {
        track: rec.track,
        score: rec.score * 1.0, // Base weight
        reasons: new Set([rec.reason])
      });
    }
  }
  
  // Add social recommendations (weight: 1.2)
  for (const rec of socialRecs) {
    const existing = allRecommendations.get(rec.track.id);
    if (existing) {
      existing.score += rec.score * 1.2;
      existing.reasons.add(rec.reason);
    } else {
      allRecommendations.set(rec.track.id, {
        track: rec.track,
        score: rec.score * 1.2, // Higher weight for social
        reasons: new Set([rec.reason])
      });
    }
  }
  
  // Add popular recommendations (weight: 0.8)
  for (const rec of popularRecs) {
    const existing = allRecommendations.get(rec.track.id);
    if (existing) {
      existing.score += rec.score * 0.8;
      existing.reasons.add(rec.reason);
    } else {
      allRecommendations.set(rec.track.id, {
        track: rec.track,
        score: rec.score * 0.8, // Lower weight for popular
        reasons: new Set([rec.reason])
      });
    }
  }

  // Convert to array and sort
  return [...allRecommendations.values()]
    .map(item => ({
      track: serializeTrack(item.track),
      score: item.score,
      reason: Array.from(item.reasons).join(', ')
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function handleApiRequest(req, res, url) {
  const db = readDb();
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/me") {
    sendJson(res, 200, { user: getCurrentUser(req, db) ? publicUser(getCurrentUser(req, db)) : null });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/auth/signup") {
    const body = await readJsonBody(req);
    const name = normalizeText(body.name);
    const email = normalizeText(body.email).toLowerCase();
    const password = String(body.password || "");

    if (!name) return sendApiError(res, 400, "Name is required.");
    if (!isValidEmail(email)) return sendApiError(res, 400, "Enter a valid email address.");
    if (password.length < 8) return sendApiError(res, 400, "Password must be at least 8 characters.");
    if (db.users.some((user) => user.email.toLowerCase() === email)) {
      return sendApiError(res, 409, "An account already exists for that email.");
    }

    const user = {
      id: makeId("usr"),
      name,
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };
    const token = makeId("sess");
    db.users.push(user);
    db.sessions.push({ token, userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
    writeDb(db);
    setSessionCookie(res, token);
    sendJson(res, 201, { user: publicUser(user) });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readJsonBody(req);
    const email = normalizeText(body.email).toLowerCase();
    const password = String(body.password || "");
    const user = db.users.find((item) => item.email.toLowerCase() === email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return sendApiError(res, 401, "Invalid email or password.");
    }

    const token = makeId("sess");
    db.sessions = db.sessions.filter((session) => session.expiresAt > Date.now());
    db.sessions.push({ token, userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
    writeDb(db);
    setSessionCookie(res, token);
    sendJson(res, 200, { user: publicUser(user) });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    const token = parseCookies(req).session;
    if (token) db.sessions = db.sessions.filter((session) => session.token !== token);
    writeDb(db);
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/playlists") {
    const user = requireUser(req, res, db);
    if (!user) return true;
    const playlists = db.playlists
      .filter((playlist) => playlist.createdBy === user.id)
      .map((playlist) => serializePlaylist(playlist, db));
    sendJson(res, 200, { playlists });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/playlists") {
    const user = requireUser(req, res, db);
    if (!user) return true;

    const body = await readJsonBody(req);
    const name = normalizeText(body.name);
    if (!name) return sendApiError(res, 400, "Playlist name is required.");
    if (db.playlists.some((playlist) => playlist.createdBy === user.id && playlist.name.toLowerCase() === name.toLowerCase())) {
      return sendApiError(res, 409, "You already have a playlist with that name.");
    }

    const now = new Date().toISOString();
    const playlist = {
      id: makeId("ply"),
      name,
      createdBy: user.id,
      trackIds: [],
      createdAt: now,
      updatedAt: now
    };
    db.playlists.unshift(playlist);
    writeDb(db);
    sendJson(res, 201, { playlist: serializePlaylist(playlist, db) });
    return true;
  }

  const playlistTrackMatch = pathname.match(/^\/api\/playlists\/([^/]+)\/tracks(?:\/([^/]+))?$/);
  if ((req.method === "POST" || req.method === "DELETE") && playlistTrackMatch) {
    const user = requireUser(req, res, db);
    if (!user) return true;

    const playlistId = decodeURIComponent(playlistTrackMatch[1]);
    const playlist = db.playlists.find((item) => item.id === playlistId && item.createdBy === user.id);
    if (!playlist) return sendApiError(res, 404, "Playlist not found.");

    let trackId = playlistTrackMatch[2] ? decodeURIComponent(playlistTrackMatch[2]) : "";
    if (req.method === "POST") {
      const body = await readJsonBody(req);
      trackId = normalizeText(body.trackId);
      if (!db.tracks.some((track) => track.id === trackId)) return sendApiError(res, 404, "Song not found.");
      if (!(playlist.trackIds || []).includes(trackId)) playlist.trackIds = [...(playlist.trackIds || []), trackId];
    } else {
      playlist.trackIds = (playlist.trackIds || []).filter((id) => id !== trackId);
    }

    playlist.updatedAt = new Date().toISOString();
    writeDb(db);
    sendJson(res, 200, { playlist: serializePlaylist(playlist, db) });
    return true;
  }

  const playlistMatch = pathname.match(/^\/api\/playlists\/([^/]+)$/);
  if (req.method === "DELETE" && playlistMatch) {
    const user = requireUser(req, res, db);
    if (!user) return true;

    const playlistId = decodeURIComponent(playlistMatch[1]);
    const playlist = db.playlists.find((item) => item.id === playlistId && item.createdBy === user.id);
    if (!playlist) return sendApiError(res, 404, "Playlist not found.");

    db.playlists = db.playlists.filter((item) => item.id !== playlistId);
    writeDb(db);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/tracks") {
    const user = requireUser(req, res, db);
    if (!user) return true;
    sendJson(res, 200, { tracks: db.tracks.map(serializeTrack) });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/spotify/import") {
    const user = requireUser(req, res, db);
    if (!user) return true;

    const body = await readJsonBody(req);
    const sourceUrl = normalizeText(body.sourceUrl);
    if (!validateExternalUrl(sourceUrl) && !sourceUrl.startsWith("spotify:")) {
      return sendApiError(res, 400, "Paste a valid Spotify track or playlist URL.");
    }

    const result = await importSpotifyTracks(db, user, sourceUrl, body);
    writeDb(db);
    sendJson(res, 201, {
      imported: result.imported.map(serializeTrack),
      skippedCount: result.skipped.length,
      source: result.source
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/tracks") {
    const user = requireUser(req, res, db);
    if (!user) return true;

    const body = await readJsonBody(req);
    const kind = normalizeText(body.kind);
    const title = normalizeText(body.title);
    const artist = normalizeText(body.artist);
    const album = normalizeText(body.album);

    if (!title) return sendApiError(res, 400, "Title is required.");
    if (!artist) return sendApiError(res, 400, "Artist is required.");
    if (!["local", "external"].includes(kind)) return sendApiError(res, 400, "Choose local or external music.");

    let sourceType = "upload";
    let sourceUrl = null;
    let playableUrl = null;

    if (kind === "local") {
      playableUrl = saveLocalAudioFile(body);
    } else {
      sourceType = normalizeText(body.sourceType) || "web";
      sourceUrl = normalizeText(body.sourceUrl);
      if (!validateExternalUrl(sourceUrl)) return sendApiError(res, 400, "Enter a valid external URL.");
      playableUrl = getYouTubeEmbedUrl(sourceUrl) || getSoundCloudEmbedUrl(sourceUrl) || getSpotifyEmbedUrl(sourceUrl) || sourceUrl;
    }

    const track = {
      id: makeId("trk"),
      title,
      artist,
      album,
      kind,
      sourceType,
      sourceUrl,
      playableUrl,
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };

    db.tracks.unshift(track);
    writeDb(db);
    sendJson(res, 201, { track: serializeTrack(track) });
    return true;
  }

  const trackMatch = pathname.match(/^\/api\/tracks\/([^/]+)$/);
  if (req.method === "DELETE" && trackMatch) {
    const user = requireUser(req, res, db);
    if (!user) return true;

    const trackId = decodeURIComponent(trackMatch[1]);
    const track = db.tracks.find((item) => item.id === trackId);
    if (!track) return sendApiError(res, 404, "Song not found.");
    if (track.createdBy !== user.id) return sendApiError(res, 403, "You can only remove songs you added.");

    deleteLocalTrackFile(track);
    db.tracks = db.tracks.filter((item) => item.id !== trackId);
    db.listens = db.listens.filter((listen) => listen.trackId !== trackId);
    db.playlists = db.playlists.map((playlist) => ({
      ...playlist,
      trackIds: (playlist.trackIds || []).filter((id) => id !== trackId),
      updatedAt: new Date().toISOString()
    }));
    writeDb(db);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/listens") {
    const user = requireUser(req, res, db);
    if (!user) return true;

    const body = await readJsonBody(req);
    const trackId = normalizeText(body.trackId);
    const secondsPlayed = Math.max(0, Math.min(24 * 60 * 60, Math.floor(Number(body.secondsPlayed) || 0)));
    if (!trackId || !db.tracks.some((track) => track.id === trackId)) return sendApiError(res, 404, "Song not found.");
    if (secondsPlayed <= 0) return sendApiError(res, 400, "Listening time must be greater than zero.");

    db.listens.push({
      id: makeId("lis"),
      userId: user.id,
      trackId,
      secondsPlayed,
      listenedAt: new Date().toISOString()
    });
    writeDb(db);
    sendJson(res, 201, { ok: true });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/stats") {
    const user = requireUser(req, res, db);
    if (!user) return true;
    sendJson(res, 200, buildStats(db, user));
    return true;
  }

  if (req.method === "GET" && pathname === "/api/recommendations") {
    const user = requireUser(req, res, db);
    if (!user) return true;
    sendJson(res, 200, { recommendations: getRecommendations(db, user) });
    return true;
  }

  if (pathname.startsWith("/api/")) {
    sendError(res, 404, "API route not found.");
    return true;
  }

  return false;
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  const relativePath = path.relative(PUBLIC_DIR, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const indexPath = path.join(PUBLIC_DIR, "index.html");
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
    fs.createReadStream(indexPath).pipe(res);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || HOST}`);
      const handled = await handleApiRequest(req, res, url);
      if (!handled) serveStatic(req, res, url);
    } catch (error) {
      if (!res.headersSent) {
        sendError(res, error.message === "Request body is too large." ? 413 : 400, error.message || "Server error");
      } else {
        res.end();
      }
    }
  });
}

// Export selected functions for tests and external usage without starting the server
module.exports = {
  buildStats,
  cosineSimilarity,
  formatDuration,
  createServer
};

if (require.main === module) {
  const server = createServer();

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Run with another port, for example: PORT=3001 npm start`);
      process.exit(1);
    }
    throw error;
  });

  server.listen(PORT, HOST, () => {
    const shownHost = HOST === "0.0.0.0" ? "localhost" : HOST;
    console.log(`Server running at http://${shownHost}:${PORT}/`);
  });
}
