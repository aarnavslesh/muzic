const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "..", "data", "db.sqlite");
let db = null;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) console.error("Database connection error:", err.message);
    });
    db.configure("busyTimeout", 5000);
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function initDb() {
  const dbExists = fs.existsSync(DB_PATH);

  if (!dbExists) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }

  return new Promise((resolve, reject) => {
    getDb().serialize(() => {
      getDb().run("PRAGMA foreign_keys = ON");

      if (!dbExists) {
        getDb().exec(`
          CREATE TABLE users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            passwordHash TEXT NOT NULL,
            createdAt TEXT NOT NULL
          );

          CREATE TABLE tracks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            album TEXT,
            kind TEXT NOT NULL,
            sourceType TEXT,
            sourceUrl TEXT,
            playableUrl TEXT,
            createdBy TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE
          );

          CREATE TABLE playlists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            createdBy TEXT NOT NULL,
            trackIds TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            shareToken TEXT UNIQUE,
            isPublic INTEGER DEFAULT 0,
            FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE
          );

          CREATE TABLE listens (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            trackId TEXT NOT NULL,
            secondsPlayed INTEGER NOT NULL,
            listenedAt TEXT NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (trackId) REFERENCES tracks(id) ON DELETE CASCADE
          );

          CREATE TABLE sessions (
            token TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            expiresAt INTEGER NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
          );

          CREATE INDEX idx_users_email ON users(email);
          CREATE INDEX idx_tracks_createdBy ON tracks(createdBy);
          CREATE INDEX idx_playlists_createdBy ON playlists(createdBy);
          CREATE INDEX idx_playlists_shareToken ON playlists(shareToken);
          CREATE INDEX idx_listens_userId ON listens(userId);
          CREATE INDEX idx_listens_trackId ON listens(trackId);
          CREATE INDEX idx_sessions_userId ON sessions(userId);
          CREATE INDEX idx_sessions_expiresAt ON sessions(expiresAt);
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

async function readDb() {
  await initDb();

  const users = await all("SELECT * FROM users");
  const tracks = await all("SELECT * FROM tracks");
  const playlists = await all("SELECT * FROM playlists");
  const listens = await all("SELECT * FROM listens");
  const sessions = await all("SELECT * FROM sessions");

  const processedPlaylists = playlists.map(p => ({
    ...p,
    trackIds: p.trackIds ? JSON.parse(p.trackIds) : []
  }));

  return {
    users,
    tracks,
    playlists: processedPlaylists,
    listens,
    sessions
  };
}

async function writeDb(dbData) {
  await initDb();

  return new Promise(async (resolve, reject) => {
    getDb().serialize(async () => {
      try {
        await run("DELETE FROM sessions");
        await run("DELETE FROM listens");
        await run("DELETE FROM playlists");
        await run("DELETE FROM tracks");
        await run("DELETE FROM users");

        for (const user of dbData.users) {
          await run(
            "INSERT INTO users (id, name, email, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?)",
            [user.id, user.name, user.email, user.passwordHash, user.createdAt]
          );
        }

        for (const track of dbData.tracks) {
          await run(
            "INSERT INTO tracks (id, title, artist, album, kind, sourceType, sourceUrl, playableUrl, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [track.id, track.title, track.artist, track.album, track.kind, track.sourceType, track.sourceUrl, track.playableUrl, track.createdBy, track.createdAt]
          );
        }

        for (const playlist of dbData.playlists) {
          await run(
            "INSERT INTO playlists (id, name, createdBy, trackIds, createdAt, updatedAt, shareToken, isPublic) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [playlist.id, playlist.name, playlist.createdBy, JSON.stringify(playlist.trackIds || []), playlist.createdAt, playlist.updatedAt, playlist.shareToken || null, playlist.isPublic || 0]
          );
        }

        for (const listen of dbData.listens) {
          await run(
            "INSERT INTO listens (id, userId, trackId, secondsPlayed, listenedAt) VALUES (?, ?, ?, ?, ?)",
            [listen.id, listen.userId, listen.trackId, listen.secondsPlayed, listen.listenedAt]
          );
        }

        for (const session of dbData.sessions) {
          await run(
            "INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)",
            [session.token, session.userId, session.expiresAt]
          );
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

function parsePlaylistRow(row) {
  if (!row) return null;
  let trackIds = [];
  try {
    trackIds = row.trackIds ? JSON.parse(row.trackIds) : [];
  } catch {
    trackIds = [];
  }
  return { ...row, trackIds };
}

async function findUserByEmail(email) {
  await initDb();
  return get("SELECT * FROM users WHERE email = ?", [String(email || "").toLowerCase()]);
}

async function insertUser(user) {
  await initDb();
  return run(
    "INSERT INTO users (id, name, email, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?)",
    [user.id, user.name, user.email, user.passwordHash, user.createdAt]
  );
}

async function insertSession(session) {
  await initDb();
  return run(
    "INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)",
    [session.token, session.userId, session.expiresAt]
  );
}

async function deleteExpiredSessions() {
  await initDb();
  return run("DELETE FROM sessions WHERE expiresAt <= ?", [Date.now()]);
}

async function deleteSessionByToken(token) {
  await initDb();
  return run("DELETE FROM sessions WHERE token = ?", [token]);
}

async function getSessionUser(token) {
  await initDb();
  return get(
    "SELECT users.* FROM users JOIN sessions ON sessions.userId = users.id WHERE sessions.token = ? AND sessions.expiresAt > ?",
    [token, Date.now()]
  );
}

async function insertTrack(track) {
  await initDb();
  return run(
    "INSERT INTO tracks (id, title, artist, album, kind, sourceType, sourceUrl, playableUrl, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [track.id, track.title, track.artist, track.album, track.kind, track.sourceType, track.sourceUrl, track.playableUrl, track.createdBy, track.createdAt]
  );
}

async function getTrackById(id) {
  await initDb();
  return get("SELECT * FROM tracks WHERE id = ?", [id]);
}

async function getTrackExists(id) {
  const row = await get("SELECT id FROM tracks WHERE id = ?", [id]);
  return Boolean(row);
}

async function getTrackSourceUrls() {
  await initDb();
  const rows = await all("SELECT sourceUrl FROM tracks WHERE sourceUrl IS NOT NULL");
  return rows.map((row) => row.sourceUrl);
}

async function allTracks() {
  await initDb();
  return all("SELECT * FROM tracks");
}

async function deleteTrack(id) {
  await initDb();
  return run("DELETE FROM tracks WHERE id = ?", [id]);
}

async function deleteListensByTrack(trackId) {
  await initDb();
  return run("DELETE FROM listens WHERE trackId = ?", [trackId]);
}

async function insertListen(listen) {
  await initDb();
  return run(
    "INSERT INTO listens (id, userId, trackId, secondsPlayed, listenedAt) VALUES (?, ?, ?, ?, ?)",
    [listen.id, listen.userId, listen.trackId, listen.secondsPlayed, listen.listenedAt]
  );
}

async function insertPlaylist(playlist) {
  await initDb();
  return run(
    "INSERT INTO playlists (id, name, createdBy, trackIds, createdAt, updatedAt, shareToken, isPublic) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [playlist.id, playlist.name, playlist.createdBy, JSON.stringify(playlist.trackIds || []), playlist.createdAt, playlist.updatedAt, playlist.shareToken || null, playlist.isPublic || 0]
  );
}

async function getPlaylistsByUser(userId) {
  await initDb();
  const rows = await all("SELECT * FROM playlists WHERE createdBy = ?", [userId]);
  return rows.map(parsePlaylistRow);
}

async function getPlaylistById(id) {
  await initDb();
  return parsePlaylistRow(await get("SELECT * FROM playlists WHERE id = ?", [id]));
}

async function playlistNameExists(userId, name) {
  await initDb();
  const row = await get("SELECT id FROM playlists WHERE createdBy = ? AND LOWER(name) = LOWER(?)", [userId, name]);
  return Boolean(row);
}

async function updatePlaylistTracks(id, trackIds, updatedAt) {
  await initDb();
  return run("UPDATE playlists SET trackIds = ?, updatedAt = ? WHERE id = ?", [JSON.stringify(trackIds || []), updatedAt, id]);
}

async function deletePlaylistById(id) {
  await initDb();
  return run("DELETE FROM playlists WHERE id = ?", [id]);
}

async function allUsers() {
  await initDb();
  return all("SELECT * FROM users");
}

async function allListens() {
  await initDb();
  return all("SELECT * FROM listens");
}

async function removeTrackFromPlaylists(trackId) {
  await initDb();
  const rows = await all("SELECT id, trackIds FROM playlists");
  for (const row of rows) {
    let ids = [];
    try {
      ids = row.trackIds ? JSON.parse(row.trackIds) : [];
    } catch {
      ids = [];
    }
    if (Array.isArray(ids) && ids.includes(trackId)) {
      const next = ids.filter((id) => id !== trackId);
      await run("UPDATE playlists SET trackIds = ?, updatedAt = ? WHERE id = ?", [
        JSON.stringify(next),
        new Date().toISOString(),
        row.id
      ]);
    }
  }
}

function closeDb() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initDb,
  readDb,
  writeDb,
  closeDb,
  run,
  get,
  all,
  getDb,
  insertUser,
  findUserByEmail,
  insertSession,
  deleteExpiredSessions,
  deleteSessionByToken,
  getSessionUser,
  insertTrack,
  getTrackById,
  getTrackExists,
  getTrackSourceUrls,
  allTracks,
  allUsers,
  allListens,
  removeTrackFromPlaylists,
  deleteTrack,
  deleteListensByTrack,
  insertListen,
  insertPlaylist,
  getPlaylistsByUser,
  getPlaylistById,
  playlistNameExists,
  updatePlaylistTracks,
  deletePlaylistById
};
