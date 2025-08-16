
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

// API routes
app.use('/api', require('./src/routes/api.routes'));
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


// Start server
http.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
