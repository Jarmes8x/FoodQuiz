const usersDB = require("../database/dbConfig");
const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET || 'jwt-secret-key';

exports.login = (req, res) => {
  try {
    const locals = {
      title: "FoodQuiz",
      description: "FoodQuiz",
      header: "Page header",
      layout: 'layouts/auth'
    };
    res.render('login', locals);
  } catch (err) {
    console.error('Login page error:', err);
    res.status(500).render('login', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', layout: 'layouts/auth' });
  }
};


exports.loginPost = async (req, res) => {
  const locals = {
    title: "FoodQuiz",
    description: "FoodQuiz",
    header: "Page header",
    layout: 'layouts/auth'
  };
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.render('login', { ...locals, error: 'กรุณาใส่ชื่อของคุณ' });
  }

  try {
    await new Promise((resolve, reject) => {
      usersDB.serialize(() => {
        usersDB.run('INSERT OR IGNORE INTO users (name) VALUES (?)', [name.trim()], function (err) {
          if (err) return reject(err);
          usersDB.get('SELECT id, name FROM users WHERE name = ?', [name.trim()], (err2, row) => {
            if (err2 || !row) return reject(err2 || new Error('User not found'));
            const token = jwt.sign(row, jwtSecret, { expiresIn: '7d' });
            res.cookie('token', token, { httpOnly: true });
            resolve();
          });
        });
      });
    });
    // Ensure redirect only after DB operations complete
    return;
  } catch (err) {
    console.error('LoginPost error:', err);
    return res.status(500).render('login', { ...locals, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
}

exports.logout = (req, res) => {
  try {
    res.clearCookie('token');
    res.redirect('/');
  } catch (err) {
    console.error('Logout catch error:', err);
    res.redirect('/');
  }
}