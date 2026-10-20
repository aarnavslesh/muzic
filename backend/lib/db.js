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
  getDb
};
