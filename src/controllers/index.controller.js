const usersDB = require("../database/dbConfig");

exports.home = (req, res) => {
  const locals = {
    title: "Kila",
    description: "Kila",
    header: "Page header",
    layout: 'layouts/main'
  }

  res.render("home", locals);
}

exports.dashboard = (req, res) => {
  const locals = {
    title: "Kila",
    description: "Kila",
    header: "Page header",
    layout: 'layouts/main'
  }

  if (!req.session.user) {
    return res.redirect('/');
  }

  usersDB.all('SELECT name, created_at FROM users ORDER BY created_at DESC', [], (err, users) => {
    if (err) {
      console.error(err);
      users = [];
    }

    locals.user = req.session.user;
    locals.users = users;

    res.render('dashboard', locals);
  });
}

exports.about = (req, res) => {
  const locals = {
    title: "Kila",
    description: "Kila",
    header: "Page header",
    layout: 'layouts/main'
  }

  res.render('about', locals);
}


exports.quiz = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  const locals = {
    title: "Kila",
    description: "Kila",
    header: "Page header",
    layout: 'layouts/main',
    user: req.session.user
  }
  res.render('quiz', locals);
}