const usersDB = require("../database/dbConfig");

exports.login = (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.render('login', { error: 'กรุณาใส่ชื่อของคุณ' });
  }

  // Insert or get user from database
  usersDB.run('INSERT OR IGNORE INTO users (name) VALUES (?)', [name.trim()], function (err) {
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
}

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    res.redirect('/');
  });
}