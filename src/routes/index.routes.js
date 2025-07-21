const router = require("express").Router();
const indexController = require("../controllers/index.controller");

router.get('/', indexController.home);
router.get('/dashboard', indexController.dashboard);

module.exports = router;
