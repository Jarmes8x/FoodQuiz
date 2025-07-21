const usersDB = require("../database/dbConfig");

exports.home = (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.render('login');
  }
}

exports.dashboard = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }

  // Get all users for display
  usersDB.all('SELECT name, created_at FROM users ORDER BY created_at DESC', [], (err, users) => {
    if (err) {
      console.error(err);
      users = [];
    }

    res.render('dashboard', {
      user: req.session.user,
      users: users
    });
  });
} 