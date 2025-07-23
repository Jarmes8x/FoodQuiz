const router = require("express").Router();
const authController = require("../controllers/auth.controller");

router.get('/login', authController.login);
router.post('/login', authController.loginPost);
router.post('/logout', authController.logout);

module.exports = router;