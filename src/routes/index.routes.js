const router = require("express").Router();
const indexController = require("../controllers/index.controller");

router.get('/', indexController.home);
router.get('/dashboard', indexController.dashboard);
router.get('/quiz', indexController.quiz);
router.get('/about', indexController.about);
router.get('/create-room', indexController.createRoomPage);
router.post('/create-room', indexController.createRoomPost);
router.get('/game-room/:roomId', indexController.gameRoomPage);

module.exports = router;
