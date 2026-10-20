const fs = require("fs");
const path = require("path");
const db = require("./db");

const DB_FILE = path.join(__dirname, "..", "data", "db.json");
const BACKUP_FILE = path.join(__dirname, "..", "data", "db.json.backup");

async function migrateFromJson() {
  if (!fs.existsSync(DB_FILE)) {
    return { migrated: false, reason: "db.json not found" };
  }

  try {
    const jsonData = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

    const countsBefore = {
      users: jsonData.users?.length || 0,
      tracks: jsonData.tracks?.length || 0,
      playlists: jsonData.playlists?.length || 0,
      listens: jsonData.listens?.length || 0,
      sessions: jsonData.sessions?.length || 0
    };

    await db.writeDb(jsonData);

    const dbData = await db.readDb();
    const countsAfter = {
      users: dbData.users.length,
      tracks: dbData.tracks.length,
      playlists: dbData.playlists.length,
      listens: dbData.listens.length,
      sessions: dbData.sessions.length
    };

    const match = JSON.stringify(countsBefore) === JSON.stringify(countsAfter);
    if (!match) {
      throw new Error(`Data count mismatch. Before: ${JSON.stringify(countsBefore)}, After: ${JSON.stringify(countsAfter)}`);
    }

    fs.copyFileSync(DB_FILE, BACKUP_FILE);
    console.log(`✓ Migration complete. Backed up db.json to db.json.backup`);
    console.log(`✓ Data integrity verified: ${JSON.stringify(countsAfter)}`);

    return { migrated: true, counts: countsAfter };
  } catch (error) {
    console.error("Migration error:", error.message);
    return { migrated: false, error: error.message };
  }
}

module.exports = { migrateFromJson };
