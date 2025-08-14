const { usersDB, executeWithRetry } = require("../database/dbConfig");

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

exports.dashboard = async (req, res) => {
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

    // ดึงข้อมูลห้องทั้งหมด (รวมห้องที่จบแล้วด้วย)
    const rooms = await executeWithRetry(() => {
      return new Promise((resolve, reject) => {
        usersDB.all(
          `SELECT rooms.*, users.name as owner_name
           FROM rooms
           JOIN users ON rooms.creator_id = users.id
           ORDER BY rooms.created_at DESC`,
          [],
          (errRooms, rows) => {
            if (errRooms) reject(errRooms);
            else resolve(rows);
          }
        );
      });
    });

    // ดึงข้อมูลผู้ใช้ทั้งหมด
    const users = await executeWithRetry(() => {
      return new Promise((resolve, reject) => {
        usersDB.all(
          `SELECT name, created_at
           FROM users
           ORDER BY created_at DESC`,
          [],
          (err, rows) => {
            if (err) {
              console.error('Dashboard DB error:', err);
              resolve([]); // ส่ง array ว่างถ้า error
            } else {
              resolve(rows);
            }
          }
        );
      });
    });

    locals.user = req.user;
    locals.users = users;
    locals.rooms = rooms || [];
    locals.error = null;

    res.render('dashboard', locals);

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('dashboard', {
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      layout: 'layouts/main'
    });
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

exports.quiz = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    // ดึงข้อมูล rooms ทั้งหมด (รวมห้องที่จบแล้วด้วย)
    const rooms = await new Promise((resolve, reject) => {
      usersDB.all(
        `SELECT rooms.*, users.name as owner_name
         FROM rooms
         JOIN users ON rooms.creator_id = users.id
         ORDER BY rooms.created_at DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // ตรวจสอบว่าผู้ใช้มีห้องหรือไม่
    const userRoom = await new Promise((resolve, reject) => {
      usersDB.get(
        `SELECT id FROM rooms WHERE creator_id = ?`,
        [req.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const userWithRoom = {
      ...req.user,
      room_id: userRoom ? userRoom.id : null
    };

    const locals = {
      title: "FoodQuiz",
      description: "FoodQuiz",
      header: "Page header",
      layout: 'layouts/main',
      user: userWithRoom,
      rooms: rooms || [],
      error: null
    };

    res.render('quiz', locals);

  } catch (err) {
    console.error('Quiz error:', err);
    res.status(500).render('quiz', {
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      layout: 'layouts/main'
    });
  }
};


exports.createRoomPage = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    const userId = req.user.id;

    const room = await new Promise((resolve, reject) => {
      usersDB.get(
        `SELECT * FROM rooms WHERE creator_id = ?`,
        [userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });

    res.render('create-room', {
      error: null,
      room,
      user: req.user,
      layout: 'layouts/main'
    });

  } catch (err) {
    console.error('CreateRoomPage error:', err);
    res.status(500).render('create-room', {
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      room: null,
      user: req.user,
      layout: 'layouts/main'
    });
  }
};


exports.createRoomPost = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    const userId = req.user.id;
    let { name, is_private, password, room_color } = req.body;

    // Normalize / validate ข้อมูลเบื้องต้น
    const max_players = 5;                   // บังคับ 5 คน (ไม่รวม creator)
    name = (name || '').trim();
    room_color = room_color || '#FFFFFF';
    const isPrivate = (is_private === true || is_private === '1' || is_private === 'true') ? 1 : 0;

    if (!name) {
      return res.render('create-room', {
        error: 'กรุณากรอกชื่อห้อง',
        room: null,
        user: req.user,
        layout: 'layouts/main'
      });
    }

    if (isPrivate && !password) {
      return res.render('create-room', {
        error: 'ห้องส่วนตัวต้องมีรหัสผ่าน',
        room: null,
        user: req.user,
        layout: 'layouts/main'
      });
    }

    // เช็คว่าผู้ใช้มีห้องอยู่แล้วหรือไม่
    const existingRoom = await new Promise((resolve, reject) => {
      usersDB.get(
        `SELECT * FROM rooms WHERE creator_id = ?`,
        [userId],
        (err, row) => (err ? reject(err) : resolve(row || null))
      );
    });

    if (existingRoom) {
      return res.render('create-room', {
        error: 'คุณสร้างห้องได้เพียง 1 ห้องเท่านั้น กรุณาลบห้องเดิมก่อนสร้างใหม่',
        room: existingRoom,
        user: req.user,
        layout: 'layouts/main'
      });
    }

    // สร้างห้องใหม่
    await new Promise((resolve, reject) => {
      usersDB.run(
        `INSERT INTO rooms (name, creator_id, max_players, is_private, password, room_color)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, userId, max_players, isPrivate, password || null, room_color],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });

    // สำเร็จ -> ไปหน้า /quiz
    return res.redirect('/quiz');

  } catch (err) {
    console.error('CreateRoomPost error:', err);

    let errorMsg = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
    if (err?.message?.includes('UNIQUE')) {
      errorMsg = 'ชื่อห้องนี้ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น';
    }

    return res.status(500).render('create-room', {
      error: errorMsg,
      room: null,
      user: req.user,
      layout: 'layouts/main'
    });
  }
};


exports.gameRoomPage = async (req, res) => {
  // helper: get (throw error ถ้า query พัง)
  const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
      usersDB.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });

  // helper: all (ปลอดภัย ถ้าพังจะคืน [])
  const dbAllSafe = (sql, params = [], label = '') =>
    new Promise((resolve) => {
      usersDB.all(sql, params, (err, rows) => {
        if (err) {
          console.error(`${label || 'DB'} error:`, err);
          return resolve([]);
        }
        resolve(rows || []);
      });
    });

  try {
    if (!req.user) return res.redirect('/login');

    const roomId = req.params.roomId;

    // 1) ดึงข้อมูลห้อง (ถ้าไม่พบ -> 404)
    const room = await dbGet(
      `SELECT rooms.*, users.name as owner_name
       FROM rooms
       JOIN users ON rooms.creator_id = users.id
       WHERE rooms.id = ?`,
      [roomId]
    );

    if (!room) {
      return res.status(404).render('dashboard', {
        error: 'ไม่พบห้องนี้',
        layout: 'layouts/main',
        user: req.user,
        rooms: [],
        users: []
      });
    }

    // ตรวจสอบว่าห้องจบแล้วหรือไม่ - ให้เข้าร่วมได้แต่จะแสดงผู้ชนะ
    const isGameFinished = room.status === 'finished';

    // 2) ดึงข้อมูลประกอบทั้งหมดแบบขนาน
    const [
      players,
      questions,
      ingredients,
      mealIngredients,
      playerFoods,
      playerIngredients
    ] = await Promise.all([
      dbAllSafe(
        `SELECT users.id, users.name, rp.score, rp.is_owner
         FROM room_players rp
         JOIN users ON rp.user_id = users.id
         WHERE rp.room_id = ?`,
        [roomId],
        'Players'
      ),
      dbAllSafe(
        `SELECT q.*
         FROM questions q
         JOIN room_questions rq ON q.id = rq.question_id
         WHERE rq.room_id = ?
         ORDER BY rq.id ASC`,
        [roomId],
        'Questions'
      ),
      dbAllSafe(
        `SELECT name, price, image_file FROM ingredient`,
        [],
        'Ingredients'
      ),
      dbAllSafe(
        `SELECT m.name as meal_name,
                m.image_file,
                GROUP_CONCAT(mi.ingredient) as ingredients
         FROM meal m
         JOIN meal_ingredient mi ON m.id = mi.meal_id
         GROUP BY m.id`,
        [],
        'MealIngredients'
      ),
      dbAllSafe(
        `SELECT pf.user_id, u.name as user_name,
                GROUP_CONCAT(pf.food_name) as foods
         FROM player_foods pf
         JOIN users u ON pf.user_id = u.id
         WHERE pf.room_id = ?
         GROUP BY pf.user_id`,
        [roomId],
        'PlayerFoods'
      ),
      dbAllSafe(
        `SELECT pi.user_id,
                GROUP_CONCAT(pi.ingredient_name) as ingredients
         FROM player_ingredients pi
         WHERE pi.room_id = ?
         GROUP BY pi.user_id`,
        [roomId],
        'PlayerIngredients'
      )
    ]);

    // 3) แปลงข้อมูล map ให้ใช้งานง่าย
    const playerFoodsMap = {};
    playerFoods.forEach(pf => {
      playerFoodsMap[pf.user_id] = pf.foods ? pf.foods.split(',') : [];
    });

    const playerIngredientsMap = {};
    playerIngredients.forEach(pi => {
      playerIngredientsMap[pi.user_id] = pi.ingredients ? pi.ingredients.split(',') : [];
    });

    // 4) game state ของผู้ใช้ปัจจุบัน (พัง -> null)
    let gameState = null;
    try {
      const gameStateRow = await dbGet(
        `SELECT * FROM game_state WHERE room_id = ? AND user_id = ?`,
        [roomId, req.user.id]
      );
      if (gameStateRow) {
        gameState = {
          currentQuestion: gameStateRow.current_question,
          answeredQuestions: JSON.parse(gameStateRow.answered_questions || '[]'),
          gameStarted: Boolean(gameStateRow.game_started),
          gameFinished: Boolean(gameStateRow.game_finished)
        };
      }
    } catch (e) {
      console.error('GameState error:', e);
      gameState = null;
    }

    // 5) render
    return res.render('game-room', {
      layout: 'layouts/main',
      user: req.user,
      room,
      players,
      questions,
      ingredients,
      mealIngredients,
      playerFoods: playerFoodsMap,
      playerIngredients: playerIngredientsMap,
      gameState,
      isGameFinished
    });

  } catch (err) {
    console.error('GameRoomPage error:', err);
    return res.status(500).render('dashboard', {
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      layout: 'layouts/main',
      user: req.user,
      rooms: [],
      users: []
    });
  }
};


exports.editRoomPage = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    const userId = req.user.id;

    const room = await new Promise((resolve, reject) => {
      usersDB.get(
        `SELECT * FROM rooms WHERE creator_id = ?`,
        [userId],
        (err, row) => (err ? reject(err) : resolve(row || null))
      );
    });

    if (!room) {
      return res.redirect('/create-room');
    }

    return res.render('edit-room', {
      error: null,
      room,
      user: req.user,
      layout: 'layouts/main'
    });

  } catch (err) {
    console.error('EditRoomPage error:', err);
    return res.status(500).render('edit-room', {
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      room: null,
      user: req.user,
      layout: 'layouts/main'
    });
  }
};

exports.editRoomPost = async (req, res) => {
  // helper
  const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
      usersDB.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
    });

  const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) => {
      usersDB.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });

  try {
    if (!req.user) return res.redirect('/login');

    const userId = req.user.id;
    let { name, is_private, password, room_color } = req.body;

    // Normalize
    name = (name || '').trim();
    const isPrivate = (is_private === '1' || is_private === 1 || is_private === true || is_private === 'true') ? 1 : 0;
    room_color = room_color || '#FFFFFF';

    // Validate
    if (!name) {
      return res.render('edit-room', {
        error: 'กรุณากรอกชื่อห้อง',
        room: null,
        user: req.user,
        layout: 'layouts/main'
      });
    }

    // ห้องของผู้ใช้
    const room = await dbGet(`SELECT * FROM rooms WHERE creator_id = ?`, [userId]);
    if (!room) return res.redirect('/create-room');

    // ถ้าเป็น private แต่ไม่กรอกรหัสใหม่ ให้คงรหัสเดิมไว้
    const newPassword = isPrivate ? (password ?? room.password ?? null) : null;

    // อัปเดต
    try {
      await dbRun(
        `UPDATE rooms
         SET name = ?, is_private = ?, password = ?, room_color = ?
         WHERE creator_id = ?`,
        [name, isPrivate, newPassword, room_color, userId]
      );
    } catch (err) {
      console.error('Room update error:', err);
      let errorMsg = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
      if (err?.message?.includes('UNIQUE')) {
        errorMsg = 'ชื่อห้องนี้ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น';
      }
      return res.render('edit-room', {
        error: errorMsg,
        room,
        user: req.user,
        layout: 'layouts/main'
      });
    }

    // สำเร็จ
    return res.redirect('/quiz');

  } catch (err) {
    console.error('EditRoomPost error:', err);
    return res.status(500).render('edit-room', {
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      room: null,
      user: req.user,
      layout: 'layouts/main'
    });
  }
};


exports.deleteRoom = async (req, res) => {
  // helpers
  const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
      usersDB.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
    });

  const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) => {
      usersDB.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });

  const dbExec = (sql) =>
    new Promise((resolve, reject) => {
      usersDB.exec(sql, (err) => (err ? reject(err) : resolve()));
    });

  try {
    if (!req.user) {
      return res.status(401).json({ error: 'ไม่ได้รับอนุญาต' });
    }

    const roomId = req.params.id;
    const userId = req.user.id;

    // ตรวจสอบสิทธิ์เจ้าของห้อง
    const room = await dbGet(
      `SELECT * FROM rooms WHERE id = ? AND creator_id = ?`,
      [roomId, userId]
    );
    if (!room) {
      return res.status(404).json({ error: 'ไม่พบห้องหรือไม่มีสิทธิ์ลบ' });
    }

    // เริ่มธุรกรรม
    await dbExec('BEGIN IMMEDIATE TRANSACTION');

    try {
      // ลบข้อมูลที่เกี่ยวข้อง (ตามลำดับที่ปลอดภัย)
      await dbRun(`DELETE FROM room_players     WHERE room_id = ?`, [roomId]);
      await dbRun(`DELETE FROM room_questions   WHERE room_id = ?`, [roomId]);
      await dbRun(`DELETE FROM player_foods     WHERE room_id = ?`, [roomId]);
      await dbRun(`DELETE FROM player_ingredients WHERE room_id = ?`, [roomId]); // เผื่อมีตารางนี้
      await dbRun(`DELETE FROM game_state       WHERE room_id = ?`, [roomId]);   // เผื่อมีตารางนี้
      await dbRun(`DELETE FROM rooms            WHERE id = ?`, [roomId]);

      // commit
      await dbExec('COMMIT');
    } catch (innerErr) {
      // rollback แล้วโยนต่อ
      try { await dbExec('ROLLBACK'); } catch (_) {}
      console.error('DeleteRoom TX error:', innerErr);
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบห้อง' });
    }

    // แจ้งผู้ใช้ในห้องผ่าน socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`room_${roomId}`).emit('room_deleted', { message: 'ห้องนี้ถูกลบโดยเจ้าของห้อง' });
    }

    return res.json({ success: true, message: 'ลบห้องเรียบร้อยแล้ว' });

  } catch (err) {
    console.error('DeleteRoom error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};


exports.profilePage = async (req, res) => {
  // helpers
  const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
      usersDB.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
    });

  const dbAllSafe = (sql, params = [], label = '') =>
    new Promise((resolve) => {
      usersDB.all(sql, params, (err, rows) => {
        if (err) {
          console.error(`${label || 'DB'} error:`, err);
          return resolve([]);
        }
        resolve(rows || []);
      });
    });

  try {
    if (!req.user) return res.redirect('/login');

    const userId = req.user.id;

    // คิวรีสถิติ + กิจกรรมล่าสุด พร้อมกัน
    const [statsRow, recentActivity] = await Promise.all([
      dbGet(
        `
        SELECT 
          COUNT(DISTINCT rp.room_id) AS totalGames,
          COALESCE(SUM(rp.score), 0) AS totalScore,
          COALESCE(AVG(rp.score), 0) AS averageScore,
          COUNT(DISTINCT r.id) AS roomsCreated
        FROM users u
        LEFT JOIN room_players rp ON u.id = rp.user_id
        LEFT JOIN rooms r ON u.id = r.creator_id
        WHERE u.id = ?
        `,
        [userId]
      ).catch(err => {
        console.error('Profile stats error:', err);
        return { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 };
      }),
      dbAllSafe(
        `
        SELECT 
          'เล่นเกมในห้อง ' || r.name AS description,
          rp.created_at
        FROM room_players rp
        JOIN rooms r ON rp.room_id = r.id
        WHERE rp.user_id = ?
        ORDER BY rp.created_at DESC
        LIMIT 5
        `,
        [userId],
        'Recent activity'
      )
    ]);

    const stats = statsRow || { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 };

    return res.render('profile', {
      title: "โปรไฟล์ - FoodQuiz",
      description: "จัดการข้อมูลส่วนตัว",
      layout: 'layouts/main',
      user: req.user,
      stats,
      recentActivity: recentActivity || [],
      error: null,
      success: null
    });

  } catch (err) {
    console.error('Profile page error:', err);
    return res.status(500).render('profile', { 
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 
      layout: 'layouts/main',
      user: req.user,
      stats: { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 },
      recentActivity: []
    });
  }
};


exports.profileUpdate = async (req, res) => {
  // Helpers
  const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
      usersDB.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
    });

  const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) => {
      usersDB.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });

  const dbAllSafe = (sql, params = [], label = '') =>
    new Promise((resolve) => {
      usersDB.all(sql, params, (err, rows) => {
        if (err) {
          console.error(`${label || 'DB'} error:`, err);
          return resolve([]);
        }
        resolve(rows || []);
      });
    });

  try {
    if (!req.user) return res.redirect('/login');

    const userId = req.user.id;
    const nameInput = (req.body?.name || '').trim();

    // Validate
    if (!nameInput || nameInput.length < 2 || nameInput.length > 50) {
      return res.render('profile', {
        error: 'ชื่อต้องมีความยาวระหว่าง 2-50 ตัวอักษร',
        layout: 'layouts/main',
        user: req.user,
        stats: { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 },
        recentActivity: []
      });
    }

    // Check duplicate name (ยกเว้นตัวเอง)
    const existing = await dbGet(
      `SELECT id FROM users WHERE name = ? AND id != ?`,
      [nameInput, userId]
    );
    if (existing) {
      return res.render('profile', {
        error: 'ชื่อนี้ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น',
        layout: 'layouts/main',
        user: req.user,
        stats: { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 },
        recentActivity: []
      });
    }

    // Update
    await dbRun(`UPDATE users SET name = ? WHERE id = ?`, [nameInput, userId]);

    // Update session user
    req.user.name = nameInput;

    // Fetch stats + recent activity พร้อมกัน
    const [statsRow, recentActivity] = await Promise.all([
      dbGet(
        `
        SELECT 
          COUNT(DISTINCT rp.room_id) AS totalGames,
          COALESCE(SUM(rp.score), 0) AS totalScore,
          COALESCE(AVG(rp.score), 0) AS averageScore,
          COUNT(DISTINCT r.id) AS roomsCreated
        FROM users u
        LEFT JOIN room_players rp ON u.id = rp.user_id
        LEFT JOIN rooms r ON u.id = r.creator_id
        WHERE u.id = ?
        `,
        [userId]
      ).catch(err => {
        console.error('Profile stats error:', err);
        return { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 };
      }),
      dbAllSafe(
        `
        SELECT 
          'เล่นเกมในห้อง ' || r.name AS description,
          rp.created_at
        FROM room_players rp
        JOIN rooms r ON rp.room_id = r.id
        WHERE rp.user_id = ?
        ORDER BY rp.created_at DESC
        LIMIT 5
        `,
        [userId],
        'Recent activity'
      )
    ]);

    const stats = statsRow || { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 };

    return res.render('profile', {
      success: 'อัปเดตข้อมูลเรียบร้อยแล้ว',
      layout: 'layouts/main',
      user: req.user,
      stats,
      recentActivity: recentActivity || [],
      error: null
    });

  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).render('profile', {
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      layout: 'layouts/main',
      user: req.user,
      stats: { totalGames: 0, totalScore: 0, averageScore: 0, roomsCreated: 0 },
      recentActivity: []
    });
  }
};
