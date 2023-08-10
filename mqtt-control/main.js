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

module.exports = {
  fetchStatus,
  fetchOnOffTimings,
  login,
  register
};
