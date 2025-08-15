
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
    
    console.log('API: Online players found:', players);
    res.json(players);
    
  } catch (error) {
    console.error('API: Error fetching players:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้เล่น' });
  }
});

// API endpoint สำหรับจัดการ player leave (backup สำหรับ beforeunload)
app.post('/api/player-leave', express.json(), async (req, res) => {
  try {
    const { roomId, userId, action } = req.body;
    
    if (action === 'leave_room' && roomId && userId) {
      // อัปเดตสถานะเป็นออฟไลน์
      await new Promise((resolve, reject) => {
        usersDB.run('UPDATE room_players SET is_online = 0 WHERE room_id = ? AND user_id = ?', [roomId, userId], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
      
      console.log(`API: Player ${userId} marked as offline in room ${roomId}`);
      
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

// Start server
http.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
