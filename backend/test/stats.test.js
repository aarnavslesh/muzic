const test = require("node:test");
const assert = require("node:assert/strict");
const { buildStats, cosineSimilarity, formatDuration } = require("../server");

test("formatDuration returns compact human-readable time", () => {
  assert.equal(formatDuration(8), "8s");
  assert.equal(formatDuration(68), "1m 8s");
  assert.equal(formatDuration(3668), "1h 1m 8s");
});

test("cosineSimilarity scores shared artist taste", () => {
  const left = new Map([
    ["A", 30],
    ["B", 40]
  ]);
  const right = new Map([
    ["A", 30],
    ["C", 40]
  ]);
  assert.equal(Number(cosineSimilarity(left, right).toFixed(2)), 0.36);
});

test("buildStats ranks artists and similar users", () => {
  const db = {
    users: [
      { id: "u1", name: "Ada", email: "ada@example.com", createdAt: "now" },
      { id: "u2", name: "Ben", email: "ben@example.com", createdAt: "now" }
    ],
    tracks: [
      { id: "t1", title: "One", artist: "Nina", kind: "local" },
      { id: "t2", title: "Two", artist: "Miles", kind: "external" }
    ],
    listens: [
      { userId: "u1", trackId: "t1", secondsPlayed: 60 },
      { userId: "u1", trackId: "t2", secondsPlayed: 20 },
      { userId: "u2", trackId: "t1", secondsPlayed: 30 }
    ],
    sessions: []
  };

  const stats = buildStats(db, db.users[0]);
  assert.equal(stats.totalSeconds, 80);
  assert.equal(stats.mostListenedArtists[0].artist, "Nina");
  assert.equal(stats.similarUsers[0].user.name, "Ben");
});
