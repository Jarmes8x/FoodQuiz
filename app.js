
// --- Ensure room_players table has ingredients and food columns ---
setTimeout(() => {
  usersDB.run('ALTER TABLE room_players ADD COLUMN ingredients TEXT DEFAULT "[]"', () => {});
  usersDB.run('ALTER TABLE room_players ADD COLUMN food TEXT', () => {});
}, 100);
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
// ให้ route ใช้งาน io ได้
app.set('io', io);

// --- Socket.io event handlers ---
io.on('connection', (socket) => {

  // ฟีเจอร์ซื้อวัตถุดิบ
  socket.on('buy_ingredient', ({ roomId, userId, ingredient }) => {
    // ดึงแต้มและวัตถุดิบปัจจุบัน
    usersDB.get('SELECT score, ingredients FROM room_players WHERE room_id = ? AND user_id = ?', [roomId, userId], (err, row) => {
      if (err || !row) return;
      let points = row.score;
      let ings = [];
      try { ings = JSON.parse(row.ingredients || '[]'); } catch { ings = []; }
      // ราคาวัตถุดิบ
      const prices = { 'ไข่':5, 'ข้าว':5, 'หมู':8, 'ผัก':4, 'ไก่':8, 'ปลา':10, 'กุ้ง':12, 'เต้าหู้':6 };
      const price = prices[ingredient] || 0;
      if (points < price) return; // แต้มไม่พอ
      ings.push(ingredient);
      usersDB.run('UPDATE room_players SET score = score - ?, ingredients = ? WHERE room_id = ? AND user_id = ?', [price, JSON.stringify(ings), roomId, userId], err2 => {
        usersDB.get('SELECT score, ingredients, food FROM room_players WHERE room_id = ? AND user_id = ?', [roomId, userId], (e2, r2) => {
          socket.emit('update_points_ingredients', { userId, points: r2.score, ingredients: JSON.parse(r2.ingredients||'[]'), food: r2.food });
        });
      });
    });
  });

  // ฟีเจอร์สุ่มอาหาร
  socket.on('random_food', ({ roomId, userId }) => {
    usersDB.get('SELECT ingredients FROM room_players WHERE room_id = ? AND user_id = ?', [roomId, userId], (err, row) => {
      if (err || !row) return;
      let ings = [];
      try { ings = JSON.parse(row.ingredients || '[]'); } catch { ings = []; }
      // ดึงสูตรอาหารและวัตถุดิบที่สัมพันธ์กันจาก meal, meal_ingredient
      usersDB.all('SELECT meal.id as meal_id, meal.name as meal_name, GROUP_CONCAT(meal_ingredient.ingredient) as reqs FROM meal JOIN meal_ingredient ON meal.id = meal_ingredient.meal_id GROUP BY meal.id', [], (err2, rows) => {
        if (err2 || !rows) return;
        // reqs เป็น string เช่น 'ข้าว,ไข่'
        const recipes = rows.map(r => ({ name: r.meal_name, req: (r.reqs||'').split(',') }));
        const canMake = recipes.filter(r => r.req.every(i => ings.includes(i)));
        let food = '';
        if (canMake.length > 0) {
          food = canMake[Math.floor(Math.random()*canMake.length)].name;
        } else {
          food = 'ยังทำอาหารไม่ได้';
        }
        usersDB.run('UPDATE room_players SET food = ? WHERE room_id = ? AND user_id = ?', [food, roomId, userId], err3 => {
          usersDB.get('SELECT score, ingredients, food FROM room_players WHERE room_id = ? AND user_id = ?', [roomId, userId], (e2, r2) => {
            socket.emit('update_points_ingredients', { userId, points: r2.score, ingredients: JSON.parse(r2.ingredients||'[]'), food: r2.food });
          });
        });
      });
    });
  });
  // เก็บคำตอบของแต่ละรอบในหน่วยความจำ (ต่อห้อง)
  const roomAnswers = {};


  socket.on('join_room', (roomId, user) => {
    socket.join(`room_${roomId}`);
    io.to(`room_${roomId}`).emit('user_joined', { user, socketId: socket.id });
    // Query จำนวนผู้เล่นในห้องนี้แล้ว broadcast ไปยังทุกคน (quiz.ejs)
    usersDB.all('SELECT COUNT(*) as count FROM room_players WHERE room_id = ?', [roomId], (err, rows) => {
      const count = rows && rows[0] ? rows[0].count : 0;
      io.to(`room_${roomId}`).emit('update_room_player_count', { roomId, count });
    });
  });

  socket.on('start_game', (roomId, ownerId) => {
    // ดึงคำถามทั้งหมดจากฐานข้อมูล (หรือจะสุ่ม N ข้อก็ได้)
    usersDB.all('SELECT * FROM questions', [], (err, questions) => {
      if (err) {
        io.to(`room_${roomId}`).emit('game_error', { message: 'ไม่สามารถดึงคำถามได้' });
        return;
      }
      // ส่งคำถามทั้งหมดไปให้เจ้าของห้องเลือก
      io.to(socket.id).emit('select_questions', questions);
    });
  });

  // รับชุดคำถามที่เจ้าของห้องเลือก แล้ว broadcast ให้ทุกคนในห้อง
  socket.on('questions_selected', (roomId, selectedQuestions) => {
    // Shuffle the selected questions ONCE and send to all clients
    function shuffleArray(array) {
      let arr = array.slice();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    const shuffled = shuffleArray(selectedQuestions);
    io.to(`room_${roomId}`).emit('game_questions', shuffled);
    // เริ่มเกมทันที (หรือจะ emit 'game_started' แยกก็ได้)
  });

  socket.on('submit_answer', (data) => {
    // data: { roomId, userId, answerIndex, answerTime }
    // เก็บคำตอบไว้ใน roomAnswers
    if (!roomAnswers[data.roomId]) roomAnswers[data.roomId] = {};
    if (!roomAnswers[data.roomId][data.questionIndex]) roomAnswers[data.roomId][data.questionIndex] = [];
    roomAnswers[data.roomId][data.questionIndex].push({
      userId: data.userId,
      answerIndex: parseInt(data.answerIndex),
      answerTime: data.answerTime
    });
    // ดึงคะแนนล่าสุดของ user นี้ แล้ว emit ไปพร้อมกัน
    usersDB.get('SELECT score FROM room_players WHERE room_id = ? AND user_id = ?', [data.roomId, data.userId], (err, row) => {
      const score = row ? row.score : 0;
      io.to(`room_${data.roomId}`).emit('user_answered', { ...data, score });
    });
  });

  // ฟังก์ชั่นคำนวณคะแนนและ broadcast เฉลย (เรียกจาก client ผ่าน event หรือ timer)
  socket.on('reveal_answer', (roomId, questionIndex, correctIndex) => {
    // ดึงคำตอบของข้อนี้
    const answers = (roomAnswers[roomId] && roomAnswers[roomId][questionIndex]) || [];
    // เรียงตามเวลาตอบเร็วสุด (เฉพาะที่ตอบถูก)
    const correct = answers.filter(a => a.answerIndex === correctIndex)
      .sort((a, b) => a.answerTime - b.answerTime);
    // ให้คะแนน: อันดับ 1 ได้ 4, 2 ได้ 3, 3 ได้ 2, 4 ได้ 1, 5 ได้ 0
    correct.forEach((a, idx) => {
      let addScore = Math.max(4-idx, 0);
      // เพิ่มคะแนนใน DB (room_players)
      usersDB.run('UPDATE room_players SET score = score + ? WHERE user_id = ? AND room_id = ?', [addScore, a.userId, roomId]);
    });
    // broadcast เฉลยและอันดับ
    io.to(`room_${roomId}`).emit('answer_revealed', {
      questionIndex,
      correctUserIds: correct.map(a => a.userId),
      correctIndex,
      rank: correct.map(a => a.userId)
    });
  });

  // ฟังก์ชั่นสรุปคะแนน (เรียกหลังจบเกม)
  socket.on('game_summary', (roomId) => {
    usersDB.all('SELECT users.id, users.name, room_players.score FROM room_players JOIN users ON room_players.user_id = users.id WHERE room_players.room_id = ?', [roomId], (err, players) => {
      if (err) return;
      // เรียงคะแนนมากไปน้อย
      players.sort((a, b) => b.score - a.score);
      io.to(`room_${roomId}`).emit('game_summary', players);
    });
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
