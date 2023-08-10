const express = require('express');
const router = express.Router();
const main = require('./mqtt-control/main');


router.get('/status', main.fetchStatus);
router.get('/time', main.fetchOnOffTimings);
router.post('/login', main.login);
router.post('/register', main.register);

module.exports = router;
