const usersDB = require("../database/dbConfig");

exports.home = (req, res) => {
  try {
    const locals = {
      title: "FoodQuiz",
      description: "FoodQuiz",
      header: "Page header",
      layout: 'layouts/main'
    };
    res.render("home", locals);
  } catch (err) {
    console.error('Home page error:', err);
    res.status(500).render('home', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', layout: 'layouts/main' });
  }
};

exports.dashboard = (req, res) => {
  try {
    const locals = {
      title: "FoodQuiz",
      description: "FoodQuiz",
      header: "Page header",
      layout: 'layouts/main'
    };
    if (!req.user) {
      return res.redirect('/');
    }
    usersDB.all('SELECT name, created_at FROM users ORDER BY created_at DESC', [], (err, users) => {
      if (err) {
        console.error('Dashboard DB error:', err);
        users = [];
      }
      locals.user = req.user;
      locals.users = users;
      res.render('dashboard', locals);
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('dashboard', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', layout: 'layouts/main' });
  }
};

exports.about = (req, res) => {
  try {
    const locals = {
      title: "FoodQuiz",
      description: "FoodQuiz",
      header: "Page header",
      layout: 'layouts/main'
    };
    res.render('about', locals);
  } catch (err) {
    console.error('About page error:', err);
    res.status(500).render('about', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', layout: 'layouts/main' });
  }
};

exports.quiz = (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }
    usersDB.all('SELECT rooms.*, users.name as owner_name FROM rooms JOIN users ON rooms.creator_id = users.id ORDER BY rooms.created_at DESC', [], (err, rooms) => {
      const locals = {
        title: "FoodQuiz",
        description: "FoodQuiz",
        header: "Page header",
        layout: 'layouts/main',
        user: req.user,
        rooms: rooms || [],
        error: err ? 'เกิดข้อผิดพลาดในการดึงข้อมูลห้อง' : null
      };
      if (err) {
        console.error('Quiz DB error:', err);
      }
      res.render('quiz', locals);
    });
  } catch (err) {
    console.error('Quiz error:', err);
    res.status(500).render('quiz', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', layout: 'layouts/main' });
  }
};

exports.createRoomPage = (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }
    const userId = req.user.id;
    usersDB.get('SELECT * FROM rooms WHERE creator_id = ?', [userId], (err, room) => {
      if (err) {
        console.error('CreateRoomPage DB error:', err);
        return res.render('create-room', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', room: null, user: req.user });
      }
      res.render('create-room', { error: null, room, user: req.user });
    });
  } catch (err) {
    console.error('CreateRoomPage error:', err);
    res.status(500).render('create-room', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', room: null, user: req.user });
  }
};

exports.createRoomPost = (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }
    const userId = req.user.id;
    const { name, max_players, is_private, password, room_color } = req.body;
    usersDB.get('SELECT * FROM rooms WHERE creator_id = ?', [userId], (err, room) => {
      if (err) {
        console.error('CreateRoomPost DB error:', err);
        return res.render('create-room', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', room: null, user: req.user });
      }
      if (room) {
        return res.render('create-room', { error: 'คุณสร้างห้องได้เพียง 1 ห้องเท่านั้น กรุณาลบห้องเดิมก่อนสร้างใหม่', room, user: req.user });
      }
      usersDB.run(
        'INSERT INTO rooms (name, creator_id, max_players, is_private, password, room_color) VALUES (?, ?, ?, ?, ?, ?)',
        [name, userId, max_players || 10, is_private ? 1 : 0, password || null, room_color || '#FFFFFF'],
        function (err) {
          if (err) {
            console.error('Room creation error:', err);
            let errorMsg = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
            if (err.message && err.message.includes('UNIQUE')) {
              errorMsg = 'ชื่อห้องนี้ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น';
            }
            return res.render('create-room', { error: errorMsg, room: null, user: req.user });
          }
          res.redirect('/quiz');
        }
      );
    });
  } catch (err) {
    console.error('CreateRoomPost error:', err);
    res.status(500).render('create-room', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', room: null, user: req.user });
  }
};