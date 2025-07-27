const express = require('express');
const path = require('path');
const expressLayouts = require("express-ejs-layouts");
const bodyParser = require('body-parser');
const authenticateJWT = require('./src/middleware/jwtAuth');
const cookieParser = require('cookie-parser');
const usersDB = require('./src/database/dbConfig');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Socket.io setup ---
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);

// --- Socket.io event handlers ---
io.on('connection', (socket) => {

  socket.on('join_room', (roomId, user) => {
    socket.join(`room_${roomId}`);
    io.to(`room_${roomId}`).emit('user_joined', { user, socketId: socket.id });
    // Query จำนวนผู้เล่นในห้องนี้แล้ว broadcast ไปยังทุกคน (quiz.ejs)
    usersDB.all('SELECT COUNT(*) as count FROM room_players WHERE room_id = ?', [roomId], (err, rows) => {
      const count = rows && rows[0] ? rows[0].count : 0;
      io.emit('update_room_player_count', { roomId, count });
    });
  });

  socket.on('start_game', (roomId) => {
    io.to(`room_${roomId}`).emit('game_started');
  });

  socket.on('submit_answer', (data) => {
    // data: { roomId, userId, answerIndex, answerTime }
    io.to(`room_${data.roomId}`).emit('user_answered', data);
  });

  socket.on('next_question', (roomId) => {
    io.to(`room_${roomId}`).emit('next_question');
  });

  socket.on('disconnect', () => {
  });
});

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
app.get('/api/room-players/:roomId', (req, res) => {
  try {
    const roomId = req.params.roomId;
    usersDB.all('SELECT users.id, users.name, room_players.score, room_players.is_owner FROM room_players JOIN users ON room_players.user_id = users.id WHERE room_players.room_id = ?', [roomId], (err, players) => {
      if (err) return res.status(500).json([]);
      res.json(players || []);
    });
  } catch (err) {
    res.status(500).json([]);
  }
});

// Start server
http.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
