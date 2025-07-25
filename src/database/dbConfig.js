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

  // Table: rooms
  usersDB.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      creator_id INTEGER NOT NULL,
      max_players INTEGER DEFAULT 10,
      is_private BOOLEAN DEFAULT 0,
      password TEXT DEFAULT NULL,
      room_color TEXT DEFAULT '#FFFFFF',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error("Error creating rooms table:", err.message);
    }
  });

  // Table: questions
  usersDB.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      choice1 TEXT NOT NULL,
      choice2 TEXT NOT NULL,
      choice3 TEXT NOT NULL,
      choice4 TEXT NOT NULL,
      answer_index INTEGER NOT NULL, -- 0-3
      hint TEXT,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    )
  `, (err) => {
    if (err) {
      console.error("Error creating questions table:", err.message);
    }
  });

  // Table: room_players
  usersDB.run(`
    CREATE TABLE IF NOT EXISTS room_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      score INTEGER DEFAULT 0,
      is_owner BOOLEAN DEFAULT 0,
      answered BOOLEAN DEFAULT 0,
      answer_time DATETIME,
      FOREIGN KEY (room_id) REFERENCES rooms(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error("Error creating room_players table:", err.message);
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