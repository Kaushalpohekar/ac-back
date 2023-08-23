const db = require('../db');
const jwtUtils = require('./jwtUtils');
const bcrypt = require('bcrypt');

function fetchStatus(req, res) {
  const deviceStatusQuery = 'select * from ahu_control order by date_time DESC LIMIT 1';
  try {
    db.query(deviceStatusQuery, (error, status) => {
      if (error) {
        console.error('Error during Status check:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }

      res.status(200).json(status);
    });
  } catch (error) {
    console.error('Error in Status check:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

function fetchLast6Status(req, res) {
  const deviceStatusQuery = 'select * from ahu_control order by date_time DESC LIMIT 5';
  try {
    db.query(deviceStatusQuery, (error, status) => {
      if (error) {
        console.error('Error during Status check:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }

      res.status(200).json(status);
    });
  } catch (error) {
    console.error('Error in Status check:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

function fetchOnOffTimings(req, res) {
  const deviceStatusQuery = 'select * from ahu_control order by date_time ASC';
  try {
    db.query(deviceStatusQuery, (error, data) => {
      if (error) {
        console.error('Error during data fetch:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }

      const onOffTimings = [];
      let previousStatus = null;
      let previousTimestamp = null;

      for (const entry of data) {
        if (entry.ledState === 'on' && previousStatus === 'off') {
          const timeDifference = (new Date(entry.date_time) - previousTimestamp) / (1000 * 60); // Convert to minutes
          onOffTimings.push(timeDifference);
        }
        previousStatus = entry.ledState;
        previousTimestamp = new Date(entry.date_time);
      }

      const totalOnTimeMinutes = onOffTimings
        .filter((interval, index) => index % 2 === 0)
        .reduce((acc, val) => acc + val, 0);

      const totalOffTimeMinutes = onOffTimings
        .filter((interval, index) => index % 2 !== 0)
        .reduce((acc, val) => acc + val, 0);

      res.status(200).json({
        on: totalOnTimeMinutes,
        off: totalOffTimeMinutes
      });
    });
  } catch (error) {
    console.error('Error in data fetch:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

function login(req, res) {
  const { Username, Password } = req.body;

  // Check if the user exists in the database
  const query = 'SELECT * FROM ahu_users WHERE Username = ?';
  db.query(query, [Username], (error, rows) => {
    try {
      if (error) {
        throw new Error('Error during login');
      }

      if (rows.length === 0) {
        return res.status(401).json({ message: 'User does not exist!' });
      }

      const user = rows[0];

      if (user.is_active === '1') {
        return res.status(401).json({ message: 'User is already loggedIN. Please logout first!' });
      }

      // Compare the provided password with the hashed password in the database
      bcrypt.compare(Password, user.Password, (error, isPasswordValid) => {
        try {
          if (error) {
            throw new Error('Error during password comparison');
          }

          if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
          }

          // Generate a JWT token
          const token = jwtUtils.generateToken({ Username: user.Username });
          res.json({ token });
        } catch (error) {
          console.error(error);
          res.status(500).json({ message: 'Internal server error' });
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
}

function register(req, res) {
  const {
    personalEmail,
    password,
  } = req.body;

  try {

    // Check if the username (company email) is already registered
    const personalEmailCheckQuery = 'SELECT * FROM ahu_users WHERE Username = ?';
    db.query(personalEmailCheckQuery, [personalEmail], (error, personalEmailCheckResult) => {
      if (error) {
        console.error('Error during username check:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }

      try {
        if (personalEmailCheckResult.length > 0) {
          console.log('Username already exists');
          return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password
        bcrypt.hash(password, 10, (error, hashedPassword) => {
          if (error) {
            console.error('Error during password hashing:', error);
            return res.status(500).json({ message: 'Internal server error' });
          }

          try {
            // Generate a verification token
            const verificationToken = jwtUtils.generateToken({ personalEmail: personalEmail });

            // Insert the user into the database
            const insertQuery =
              'INSERT INTO ahu_users (Username, Password, is_active) VALUES (?, ?, ?)';
            db.query(
              insertQuery,
              [
                personalEmail,
                hashedPassword,
                '0'
              ],
              (error, insertResult) => {
                if (error) {
                  console.error('Error during user insertion:', error);
                  return res.status(500).json({ message: 'Internal server error' });
                }

                try {
                  console.log('User registered successfully');
                  res.json({ message: 'Registration successful. Check your email for the verification token.' });
                } catch (error) {
                  console.error('Error sending verification token:', error);
                  res.status(500).json({ message: 'Internal server error' });
                }
              }
            );
          } catch (error) {
            console.error('Error during registration:', error);
            res.status(500).json({ message: 'Internal server error' });
          }
        });
      } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

function fetchSchedule(req, res) {
  const ScheduleQuery = 'select * from ahu_schedule order by start_time ASC';
  try {
    db.query(ScheduleQuery, (error, Schedule) => {
      if (error) {
        console.error('Error during Status check:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }

      res.status(200).json(Schedule);
    });
  } catch (error) {
    console.error('Error in Status check:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}


function addSchedule(req, res) {
  const { start_time, end_time, deviceID } = req.body;
  try {
    const checkStartTimeQuery = 'SELECT * FROM ahu_schedule WHERE start_time = ?';
    const insertScheduleQuery = 'INSERT INTO ahu_schedule (start_time, end_time, deviceID) VALUES (?,?,?)';

    db.query(checkStartTimeQuery, [start_time], (checkError, checkResult) => {
      if (checkError) {
        console.error('Error while checking schedule:', checkError);
        return res.status(500).json({ message: 'Internal server error' });
      }

      if (checkResult.length > 0) {
        return res.status(400).json({ message: 'Schedule already added' });
      }

      db.query(insertScheduleQuery, [start_time, end_time, deviceID], (insertError, insertResult) => {
        if (insertError) {
          console.error('Error while inserting schedule:', insertError);
          return res.status(500).json({ message: 'Internal server error' });
        }

        return res.json({ message: 'Schedule added successfully!' });
      });
    });
  } catch (error) {
    console.error('Error in adding schedule:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

function editSchedule(req, res) {
  const id = req.params.id;
  const { start_time, end_time}  = req.body; 
  const ScheduleCheckQuery = 'SELECT * FROM ahu_schedule WHERE id = ?';

  db.query(ScheduleCheckQuery, [id], (error, ScheduleCheckResult) => {
    if (error) {
      console.error('Error during Schedule check:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }

    try {
      if (ScheduleCheckResult.length === 0) {
        return res.status(400).json({ message: 'Schedule not found!' });
      }

      const ScheduleQuery = 'Update ahu_schedule SET start_time = ?, end_time = ? WHERE id = ?';

      db.query(ScheduleQuery, [start_time, end_time, id], (error, schedules) => {
        if (error) {
          console.error('Error fetching schedules:', error);
          return res.status(500).json({ message: 'Internal server error' });
        }

        res.json({ message: 'Schedule Updated SuccessFully' });
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
}

function deleteSchedule(req, res) {
  const id = req.params.id;
  const ScheduleCheckQuery = 'SELECT * FROM ahu_schedule WHERE id = ?';

  db.query(ScheduleCheckQuery, [id], (error, ScheduleCheckResult) => {
    if (error) {
      console.error('Error during Schedule check:', error);
      res.status(500).json({ message: 'Internal server error' });
    }

    if (ScheduleCheckResult.length === 0) {
      return res.status(400).json({ message: 'Schedule not found!' });
    }

    const DeleteQuery = 'DELETE FROM ahu_schedule WHERE id = ?';

    db.query(DeleteQuery, [id], (error) => {
      if (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ message: 'Internal server error' });
      }

      res.json({ message: 'Schedule Deleted Successfully' });
    });
  });
}
  function fetchOnOffTimingForLast30Days(req, res) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Start from 30 days ago

    const deviceStatusQuery = 'SELECT date_time, ledState FROM ahu_control WHERE date_time >= ? AND date_time <= ? ORDER BY date_time';
    try {
      db.query(deviceStatusQuery, [startDate, endDate], (error, statusEntries) => {
        if (error) {
          console.error('Error during Status check:', error);
          return res.status(500).json({ message: 'Internal server error' });
        }

        const dailyOnOffTimes = {};

        let prevTimestamp = null;
        let prevState = null;

        statusEntries.forEach(entry => {
          const { date_time, ledState } = entry;
          const date = new Date(date_time);
          const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

          if (!dailyOnOffTimes[dayKey]) {
            dailyOnOffTimes[dayKey] = { on: 0, off: 0 };
          }

          if (prevTimestamp && prevState) {
            const timeDifference = date.getTime() - prevTimestamp.getTime();
            if (prevState === 'on') {
              dailyOnOffTimes[dayKey].on += timeDifference;
            } else if (prevState === 'off') {
              dailyOnOffTimes[dayKey].off += timeDifference;
            }
          }

          prevTimestamp = date;
          prevState = ledState;
        });

        for (const dayKey in dailyOnOffTimes) {
          dailyOnOffTimes[dayKey].on /= (1000 * 60); // Convert to minutes
          dailyOnOffTimes[dayKey].off /= (1000 * 60); // Convert to minutes
        }

        res.status(200).json(dailyOnOffTimes);
      });
    } catch (error) {
      console.error('Error in Status check:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

module.exports = {
  fetchStatus,
  fetchLast6Status,
  fetchOnOffTimings,
  login,
  register,
  fetchSchedule,
  addSchedule,
  editSchedule,
  deleteSchedule,
  fetchOnOffTimingForLast30Days
};
