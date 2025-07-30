const router = require("express").Router();
const indexController = require("../controllers/index.controller");

router.get('/', indexController.home);
router.get('/dashboard', indexController.dashboard);
router.get('/quiz', indexController.quiz);
router.get('/about', indexController.about);
router.get('/create-room', indexController.createRoomPage);
router.post('/create-room', indexController.createRoomPost);
router.get('/edit-room', indexController.editRoomPage);
router.post('/edit-room', indexController.editRoomPost);
router.delete('/delete-room/:id', indexController.deleteRoom);
router.get('/game-room/:roomId', indexController.gameRoomPage);
router.get('/profile', indexController.profilePage);
router.post('/profile', indexController.profileUpdate);

module.exports = router;
