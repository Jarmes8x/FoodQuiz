
// --- Ensure room_players table has ingredients and food columns ---
setTimeout(() => {
  usersDB.run('ALTER TABLE room_players ADD COLUMN ingredients TEXT DEFAULT "[]"', () => {});
  usersDB.run('ALTER TABLE room_players ADD COLUMN food TEXT', () => {});
}, 100);

// เพิ่มข้อมูลตัวอย่างในฐานข้อมูล
require('./src/database/seedData');

const express = require('express');
const path = require('path');
const expressLayouts = require("express-ejs-layouts");
const bodyParser = require('body-parser');
const authenticateJWT = require('./src/middleware/jwtAuth');
const cookieParser = require('cookie-parser');
const { usersDB } = require('./src/database/dbConfig');

const app = express();
const PORT = process.env.PORT || 3000;

// Socket
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
app.set('io', io);
const { setupSocketHandlers } = require('./src/sockets');
setupSocketHandlers(io);


// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

app.use(authenticateJWT);

// API endpoints (defined before other routes to avoid conflicts)
app.post('/api/test', express.json(), (req, res) => {
  console.log('Test endpoint - Request body:', req.body);
  res.json({ success: true, body: req.body });
});

app.post('/api/player-leave', express.json(), async (req, res) => {
  try {
    // Handle both JSON and string data from sendBeacon
    let body = req.body;
    
    // If body is undefined or null, return error
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }
    
    // If body is a string (from sendBeacon), try to parse it
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
        console.log('API: Successfully parsed string body:', body);
      } catch (parseError) {
        console.error('API: Failed to parse request body:', parseError);
        return res.status(400).json({ error: 'Invalid request body format' });
      }
    }
    
    // Ensure body is an object
    if (typeof body !== 'object' || body === null) {
      console.error('API: Body is not an object:', body);
      return res.status(400).json({ error: 'Request body must be an object' });
    }
    
    const { roomId, userId, action } = body;
    
    // Validate required fields
    if (!roomId || !userId || !action) {
      console.error('API: Missing required fields:', { roomId, userId, action });
      return res.status(400).json({ error: 'Missing required fields: roomId, userId, action' });
    }
    
    if (action === 'leave_room') {
      // อัปเดตสถานะเป็นออฟไลน์
      await new Promise((resolve, reject) => {
        usersDB.run('UPDATE room_players SET is_online = 0 WHERE room_id = ? AND user_id = ?', [roomId, userId], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // แจ้งผู้เล่นอื่นๆ ผ่าน socket.io
      const io = req.app.get('io');
      if (io) {
        io.to(`room_${roomId}`).emit('user_left', { user: { id: userId, name: 'Unknown' } });
        
        // อัปเดตรายชื่อผู้เล่น
        const players = await new Promise((resolve, reject) => {
          usersDB.all('SELECT users.id, users.name, room_players.score, room_players.is_owner FROM room_players JOIN users ON room_players.user_id = users.id WHERE room_players.room_id = ? AND room_players.is_online = 1', [roomId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
        
        io.to(`room_${roomId}`).emit('player_list_updated', { roomId, players });
      }
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('API: Error handling player leave:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการจัดการการออกจากห้อง' });
  }
});

app.use("/", require("./src/routes/room.routes"));

// Layout
app.use(expressLayouts);
app.set("layout", "layouts/main");

app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// Routes
app.use("/", require("./src/routes/index.routes"));
app.use("/", require("./src/routes/auth.routes"));
app.get('/api/room-players/:roomId', async (req, res) => {
  try {
    const roomId = req.params.roomId;
    
    const players = await new Promise((resolve, reject) => {
      usersDB.all('SELECT users.id, users.name, room_players.score, room_players.is_owner FROM room_players JOIN users ON room_players.user_id = users.id WHERE room_players.room_id = ? AND room_players.is_online = 1', [roomId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    res.json(players);
    
  } catch (error) {
    console.error('API: Error fetching players:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้เล่น' });
  }
});



// Start server
http.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
