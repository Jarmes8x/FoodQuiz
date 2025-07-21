const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "users.db");
const usersDB = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to DB:", err.message);
  } else {
    console.log("Connected to SQLite database at:", dbPath);
  }
});
usersDB.configure('busyTimeout', 5000);

// ******************** Create Table
usersDB.serialize(() => {
  // Table: users
  usersDB.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
  `, (err) => {
    if (err) {
      console.error("Error creating users table:", err.message);
    }
  });
});

// ******************** Database close
process.on("SIGINT", () => {
  usersDB.close((err) => {
    if (err) {
      console.log("Error closing database:", err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});

module.exports = usersDB;