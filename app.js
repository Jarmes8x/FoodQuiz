const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('users.db');

// Create users table if it doesn't exist
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Routes
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.render('login');
    }
});

app.post('/login', (req, res) => {
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
        return res.render('login', { error: 'กรุณาใส่ชื่อของคุณ' });
    }

    // Insert or get user from database
    db.run('INSERT OR IGNORE INTO users (name) VALUES (?)', [name.trim()], function(err) {
        if (err) {
            console.error(err);
            return res.render('login', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
        }
        
        req.session.user = {
            id: this.lastID,
            name: name.trim()
        };
        
        res.redirect('/dashboard');
    });
});

app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    
    // Get all users for display
    db.all('SELECT name, created_at FROM users ORDER BY created_at DESC', [], (err, users) => {
        if (err) {
            console.error(err);
            users = [];
        }
        
        res.render('dashboard', { 
            user: req.session.user,
            users: users
        });
    });
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
        }
        res.redirect('/');
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});