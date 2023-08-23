const express = require('express');
const router = express.Router();
const main = require('./mqtt-control/main');


router.get('/status', main.fetchStatus);
router.get('/OnOffStatus', main.fetchLast6Status);
router.get('/time', main.fetchOnOffTimings);
router.post('/login', main.login);
router.post('/register', main.register);
router.get('/schedule', main.fetchSchedule);
router.post('/add-schedule', main.addSchedule);
router.put('/edit-schedule/:id', main.editSchedule);
router.delete('/delete-schedule/:id', main.deleteSchedule);
router.get('/graph', main.fetchOnOffTimingForLast30Days);

module.exports = router;
