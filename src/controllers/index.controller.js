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
    // ดึงข้อมูลห้องทั้งหมดเพื่อให้ quiz.ejs ใช้งานได้
    usersDB.all('SELECT rooms.*, users.name as owner_name FROM rooms JOIN users ON rooms.creator_id = users.id ORDER BY rooms.created_at DESC', [], (errRooms, rooms) => {
      usersDB.all('SELECT name, created_at FROM users ORDER BY created_at DESC', [], (err, users) => {
        if (err) {
          console.error('Dashboard DB error:', err);
          users = [];
        }
        locals.user = req.user;
        locals.users = users;
        locals.rooms = rooms || [];
        locals.error = null;
        res.render('dashboard', locals);
      });
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
      // ตรวจสอบว่าผู้ใช้มีห้องหรือไม่
      usersDB.get('SELECT id FROM rooms WHERE creator_id = ?', [req.user.id], (err2, userRoom) => {
        const userWithRoom = { ...req.user, room_id: userRoom ? userRoom.id : null };
        const locals = {
          title: "FoodQuiz",
          description: "FoodQuiz",
          header: "Page header",
          layout: 'layouts/main',
          user: userWithRoom,
          rooms: rooms || [],
          error: err ? 'เกิดข้อผิดพลาดในการดึงข้อมูลห้อง' : null
        };
        if (err) {
          console.error('Quiz DB error:', err);
        }
        res.render('quiz', locals);
      });
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
    const { name, is_private, password, room_color } = req.body;
    const max_players = 5; // บังคับให้เล่นได้ 5 คนเสมอ (ไม่รวม creator)
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
        [name, userId, max_players, is_private ? 1 : 0, password || null, room_color || '#FFFFFF'],
        function (err) {
          if (err) {
            console.error('Room creation error:', err);
            let errorMsg = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
            if (err.message && err.message.includes('UNIQUE')) {
              errorMsg = 'ชื่อห้องนี้ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น';
            }
            return res.render('create-room', { error: errorMsg, room: null, user: req.user });
          }
          // ไม่ต้องเพิ่ม creator เป็นผู้เล่นใน room_players
          // สามารถเพิ่ม logic ให้ creator เลือกคำถามได้ในหน้า quiz หรือหน้า admin room
          res.redirect('/quiz');
        }
      );
    });
  } catch (err) {
    console.error('CreateRoomPost error:', err);
    res.status(500).render('create-room', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', room: null, user: req.user });
  }
};

exports.gameRoomPage = (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }
    const roomId = req.params.roomId;
    usersDB.get('SELECT rooms.*, users.name as owner_name FROM rooms JOIN users ON rooms.creator_id = users.id WHERE rooms.id = ?', [roomId], (err, room) => {
      if (err || !room) {
        return res.status(404).render('quiz', { error: 'ไม่พบห้องนี้', layout: 'layouts/main' });
      }
      // ดึงผู้เล่นในห้อง
      usersDB.all('SELECT users.id, users.name, room_players.score, room_players.is_owner FROM room_players JOIN users ON room_players.user_id = users.id WHERE room_players.room_id = ?', [roomId], (err2, players) => {
        if (err2) players = [];
        // ดึงคำถามทั้งหมดของห้องนี้
        usersDB.all('SELECT * FROM questions WHERE room_id = ?', [roomId], (err3, questions) => {
          if (err3) questions = [];
          res.render('game-room', {
            layout: 'layouts/main',
            user: req.user,
            room,
            players,
            questions
          });
        });
      });
    });
  } catch (err) {
    console.error('GameRoomPage error:', err);
    res.status(500).render('quiz', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', layout: 'layouts/main' });
  }
};

exports.editRoomPage = (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }
    const userId = req.user.id;
    usersDB.get('SELECT * FROM rooms WHERE creator_id = ?', [userId], (err, room) => {
      if (err) {
        console.error('EditRoomPage DB error:', err);
        return res.render('edit-room', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', room: null, user: req.user });
      }
      if (!room) {
        return res.redirect('/create-room');
      }
      res.render('edit-room', { error: null, room, user: req.user });
    });
  } catch (err) {
    console.error('EditRoomPage error:', err);
    res.status(500).render('edit-room', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', room: null, user: req.user });
  }
};

exports.editRoomPost = (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }
    const userId = req.user.id;
    const { name, is_private, password, room_color } = req.body;
    
    // Debug: ตรวจสอบข้อมูลที่ส่งมา
    
    usersDB.get('SELECT * FROM rooms WHERE creator_id = ?', [userId], (err, room) => {
      if (err || !room) {
        console.error('EditRoomPost DB error:', err);
        return res.render('edit-room', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', room: null, user: req.user });
      }
      
      // แปลง is_private เป็น boolean ที่ถูกต้อง
      const isPrivate = is_private === '1' || is_private === true || is_private === 1;
      console.log('Converted isPrivate:', isPrivate);
      
      usersDB.run(
        'UPDATE rooms SET name = ?, is_private = ?, password = ?, room_color = ? WHERE creator_id = ?',
        [name, isPrivate ? 1 : 0, password || null, room_color || '#FFFFFF', userId],
        function (err) {
          if (err) {
            console.error('Room update error:', err);
            let errorMsg = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
            if (err.message && err.message.includes('UNIQUE')) {
              errorMsg = 'ชื่อห้องนี้ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น';
            }
            return res.render('edit-room', { error: errorMsg, room, user: req.user });
          }
          res.redirect('/quiz');
        }
      );
    });
  } catch (err) {
    console.error('EditRoomPost error:', err);
    res.status(500).render('edit-room', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', room: null, user: req.user });
  }
};

exports.deleteRoom = (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'ไม่ได้รับอนุญาต' });
    }
    const roomId = req.params.id;
    const userId = req.user.id;
    
    // ตรวจสอบสิทธิ์เจ้าของห้อง
    usersDB.get('SELECT * FROM rooms WHERE id = ? AND creator_id = ?', [roomId, userId], (err, room) => {
      if (err || !room) {
        return res.status(404).json({ error: 'ไม่พบห้องหรือไม่มีสิทธิ์ลบ' });
      }
      
      // ลบห้องและข้อมูลที่เกี่ยวข้อง
      usersDB.run('DELETE FROM room_players WHERE room_id = ?', [roomId], (err1) => {
        if (err1) console.error('Delete room_players error:', err1);
        
        usersDB.run('DELETE FROM questions WHERE room_id = ?', [roomId], (err2) => {
          if (err2) console.error('Delete questions error:', err2);
          
          usersDB.run('DELETE FROM rooms WHERE id = ?', [roomId], (err3) => {
            if (err3) {
              console.error('Delete room error:', err3);
              return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบห้อง' });
            }
            res.json({ success: true, message: 'ลบห้องเรียบร้อยแล้ว' });
          });
        });
      });
    });
  } catch (err) {
    console.error('DeleteRoom error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.profilePage = (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }
    
    const userId = req.user.id;
    
    // ดึงสถิติของผู้ใช้
    usersDB.get(`
      SELECT 
        COUNT(DISTINCT rp.room_id) as totalGames,
        COALESCE(SUM(rp.score), 0) as totalScore,
        COALESCE(AVG(rp.score), 0) as averageScore,
        COUNT(DISTINCT r.id) as roomsCreated
      FROM users u
      LEFT JOIN room_players rp ON u.id = rp.user_id
      LEFT JOIN rooms r ON u.id = r.creator_id
      WHERE u.id = ?
    `, [userId], (err, stats) => {
      if (err) {
        console.error('Profile stats error:', err);
        stats = { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 };
      }
      
      // ดึงกิจกรรมล่าสุด (สมมติว่ามีตาราง activity หรือใช้ข้อมูลจาก room_players)
      usersDB.all(`
        SELECT 
          'เล่นเกมในห้อง ' || r.name as description,
          rp.created_at
        FROM room_players rp
        JOIN rooms r ON rp.room_id = r.id
        WHERE rp.user_id = ?
        ORDER BY rp.created_at DESC
        LIMIT 5
      `, [userId], (err2, recentActivity) => {
        if (err2) {
          console.error('Recent activity error:', err2);
          recentActivity = [];
        }
        
        const locals = {
          title: "โปรไฟล์ - FoodQuiz",
          description: "จัดการข้อมูลส่วนตัว",
          layout: 'layouts/main',
          user: req.user,
          stats: stats || { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 },
          recentActivity: recentActivity || [],
          error: null,
          success: null
        };
        
        res.render('profile', locals);
      });
    });
  } catch (err) {
    console.error('Profile page error:', err);
    res.status(500).render('profile', { 
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 
      layout: 'layouts/main',
      user: req.user,
      stats: { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 },
      recentActivity: []
    });
  }
};

exports.profileUpdate = (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }
    
    const userId = req.user.id;
    const { name } = req.body;
    
    // ตรวจสอบข้อมูล
    if (!name || name.trim().length < 2 || name.trim().length > 50) {
      return res.render('profile', {
        error: 'ชื่อต้องมีความยาวระหว่าง 2-50 ตัวอักษร',
        layout: 'layouts/main',
        user: req.user,
        stats: { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 },
        recentActivity: []
      });
    }
    
    const trimmedName = name.trim();
    
    // ตรวจสอบว่าชื่อซ้ำหรือไม่
    usersDB.get('SELECT id FROM users WHERE name = ? AND id != ?', [trimmedName, userId], (err, existingUser) => {
      if (err) {
        console.error('Profile update check error:', err);
        return res.render('profile', {
          error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
          layout: 'layouts/main',
          user: req.user,
          stats: { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 },
          recentActivity: []
        });
      }
      
      if (existingUser) {
        return res.render('profile', {
          error: 'ชื่อนี้ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น',
          layout: 'layouts/main',
          user: req.user,
          stats: { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 },
          recentActivity: []
        });
      }
      
      // อัปเดตชื่อ
      usersDB.run('UPDATE users SET name = ? WHERE id = ?', [trimmedName, userId], (err2) => {
        if (err2) {
          console.error('Profile update error:', err2);
          return res.render('profile', {
            error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล กรุณาลองใหม่อีกครั้ง',
            layout: 'layouts/main',
            user: req.user,
            stats: { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 },
            recentActivity: []
          });
        }
        
        // อัปเดตข้อมูลผู้ใช้ใน session
        req.user.name = trimmedName;
        
        // ดึงสถิติใหม่
        usersDB.get(`
          SELECT 
            COUNT(DISTINCT rp.room_id) as totalGames,
            COALESCE(SUM(rp.score), 0) as totalScore,
            COALESCE(AVG(rp.score), 0) as averageScore,
            COUNT(DISTINCT r.id) as roomsCreated
          FROM users u
          LEFT JOIN room_players rp ON u.id = rp.user_id
          LEFT JOIN rooms r ON u.id = r.creator_id
          WHERE u.id = ?
        `, [userId], (err3, stats) => {
          if (err3) {
            console.error('Profile stats error:', err3);
            stats = { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 };
          }
          
          // ดึงกิจกรรมล่าสุด
          usersDB.all(`
            SELECT 
              'เล่นเกมในห้อง ' || r.name as description,
              rp.created_at
            FROM room_players rp
            JOIN rooms r ON rp.room_id = r.id
            WHERE rp.user_id = ?
            ORDER BY rp.created_at DESC
            LIMIT 5
          `, [userId], (err4, recentActivity) => {
            if (err4) {
              console.error('Recent activity error:', err4);
              recentActivity = [];
            }
            
            res.render('profile', {
              success: 'อัปเดตข้อมูลเรียบร้อยแล้ว',
              layout: 'layouts/main',
              user: req.user,
              stats: stats || { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 },
              recentActivity: recentActivity || [],
              error: null
            });
          });
        });
      });
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).render('profile', {
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      layout: 'layouts/main',
      user: req.user,
      stats: { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 },
      recentActivity: []
    });
  }
};