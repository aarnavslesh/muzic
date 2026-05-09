const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
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
      listens: [],
      sessions: []
    });
  }
}

function readDb() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
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

async function handleApi(req, res, url) {
  const db = readDb();

  try {
    if (req.method === "POST" && url.pathname === "/api/auth/signup") {
      const body = await readJsonBody(req);
      const name = normalizeText(body.name);
      const email = normalizeText(body.email).toLowerCase();
      const password = String(body.password || "");

      if (!name || !isValidEmail(email) || password.length < 8) {
        sendError(res, 400, "Name, valid email, and password of at least 8 characters are required.");
        return;
      }
      if (db.users.some((user) => user.email === email)) {
        sendError(res, 409, "An account with this email already exists.");
        return;
      }

      const user = {
        id: makeId("usr"),
        name,
        email,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
      };
      const token = makeId("ses");
      db.users.push(user);
      db.sessions.push({ token, userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
      writeDb(db);
      setSessionCookie(res, token);
      sendJson(res, 201, { user: publicUser(user) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readJsonBody(req);
      const email = normalizeText(body.email).toLowerCase();
      const password = String(body.password || "");
      const user = db.users.find((candidate) => candidate.email === email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        sendError(res, 401, "Invalid email or password.");
        return;
      }
      const token = makeId("ses");
      db.sessions = db.sessions.filter((session) => session.expiresAt > Date.now());
      db.sessions.push({ token, userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
      writeDb(db);
      setSessionCookie(res, token);
      sendJson(res, 200, { user: publicUser(user) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const token = parseCookies(req).session;
      db.sessions = db.sessions.filter((session) => session.token !== token);
      writeDb(db);
      clearSessionCookie(res);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const user = getCurrentUser(req, db);
      sendJson(res, 200, { user: user ? publicUser(user) : null });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/tracks") {
      const user = requireUser(req, res, db);
      if (!user) return;
      sendJson(res, 200, { tracks: db.tracks.map(serializeTrack) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/tracks") {
      const user = requireUser(req, res, db);
      if (!user) return;
      const body = await readJsonBody(req);
      const title = normalizeText(body.title);
      const artist = normalizeText(body.artist);
      const album = normalizeText(body.album);
      const kind = normalizeText(body.kind);

      if (!title || !artist || !["local", "external"].includes(kind)) {
        sendError(res, 400, "Title, artist, and a valid track kind are required.");
        return;
      }

      let track;
      if (kind === "local") {
        let playableUrl;
        try {
          playableUrl = saveLocalAudioFile(body);
        } catch (error) {
          sendError(res, 400, error.message);
          return;
        }
        track = {
          id: makeId("trk"),
          title,
          artist,
          album,
          kind,
          sourceType: "upload",
          sourceUrl: null,
          playableUrl,
          createdBy: user.id,
          createdAt: new Date().toISOString()
        };
      } else {
        const sourceUrl = normalizeText(body.sourceUrl);
        const sourceType = normalizeText(body.sourceType) || "web";
        if (!validateExternalUrl(sourceUrl)) {
          sendError(res, 400, "A valid http or https source URL is required.");
          return;
        }
        track = {
          id: makeId("trk"),
          title,
          artist,
          album,
          kind,
          sourceType,
          sourceUrl,
          playableUrl: sourceUrl,
          embedUrl: getYouTubeEmbedUrl(sourceUrl) || getSoundCloudEmbedUrl(sourceUrl),
          createdBy: user.id,
          createdAt: new Date().toISOString()
        };
      }

      db.tracks.push(track);
      writeDb(db);
      sendJson(res, 201, { track: serializeTrack(track) });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/tracks/")) {
      const user = requireUser(req, res, db);
      if (!user) return;
      const trackId = decodeURIComponent(url.pathname.slice("/api/tracks/".length));
      const trackIndex = db.tracks.findIndex((candidate) => candidate.id === trackId);
      if (trackIndex === -1) {
        sendError(res, 404, "Track not found.");
        return;
      }
      const [track] = db.tracks.splice(trackIndex, 1);
      db.listens = db.listens.filter((listen) => listen.trackId !== track.id);
      deleteLocalTrackFile(track);
      writeDb(db);
      sendJson(res, 200, { ok: true, removedTrackId: track.id });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/listens") {
      const user = requireUser(req, res, db);
      if (!user) return;
      const body = await readJsonBody(req);
      const track = db.tracks.find((candidate) => candidate.id === body.trackId);
      const secondsPlayed = Math.max(1, Math.min(86400, Math.round(Number(body.secondsPlayed || 0))));
      if (!track || !Number.isFinite(secondsPlayed)) {
        sendError(res, 400, "A valid track and positive listening time are required.");
        return;
      }
      const listen = {
        id: makeId("lis"),
        userId: user.id,
        trackId: track.id,
        secondsPlayed,
        listenedAt: new Date().toISOString()
      };
      db.listens.push(listen);
      writeDb(db);
      sendJson(res, 201, { listen });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/stats") {
      const user = requireUser(req, res, db);
      if (!user) return;
      sendJson(res, 200, buildStats(db, user));
      return;
    }

    sendError(res, 404, "API route not found.");
  } catch (error) {
    sendError(res, 400, error.message || "Request failed.");
  }
}

function serveStatic(req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const requestedPath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!requestedPath.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, "Forbidden.");
    return;
  }
  fs.stat(requestedPath, (error, stat) => {
    if (error || !stat.isFile()) {
      sendError(res, 404, "File not found.");
      return;
    }
    const extension = path.extname(requestedPath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "application/octet-stream" });
    fs.createReadStream(requestedPath).pipe(res);
  });
}

function createServer() {
  ensureStorage();
  return http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url);
    return;
  }
  serveStatic(req, res, url);
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`Music player system running at http://${HOST}:${PORT}`);
  });
}


module.exports = {
  artistTotalsForUser,
  buildStats,
  createServer,
  cosineSimilarity,
  formatDuration
};
