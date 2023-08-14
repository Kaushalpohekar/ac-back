const mqtt = require('mqtt');
const mysql = require('mysql'); // Import the MySQL module

const broker = 'mqtt://broker.emqx.io';
const topic = 'device/info';

const client = mqtt.connect(broker);

let previousLedState = null;

// MySQL Database Configuration
const dbConfig = {
  host: 'senselivedb.cn5vfllmzwrp.ap-south-1.rds.amazonaws.com',
  user: 'admin',
  password: 'sense123',
  database: 'AHU',
};

const dbConnection = mysql.createConnection(dbConfig);

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  client.subscribe(topic, (err) => {
    if (err) {
      console.error('Error subscribing to topic:', err);
    } else {
      console.log(`Subscribed to topic: ${topic}`);
    }
  });
});

client.on('message', (topic, message) => {
  const data = JSON.parse(message.toString());
  //console.log('Received message:', data);

  // Check if the LED state has changed
  if (data.ledState !== previousLedState) {
    console.log('LED state has changed:', data.ledState);

    // Combine the currentDate and currentDateTime into a single datetime format
    const dateTimeString = `${data.currentDate} ${data.currentDateTime}`;
    const date_time = new Date(dateTimeString);

    // Store the entry in the database
    const insertQuery = `INSERT INTO ahu_control (deviceID, staIPAddress, ledState, date_time) VALUES (?, ?, ?, ?)`;
    const values = [data.deviceID, data.staIPAddress, data.ledState, date_time];

    dbConnection.query(insertQuery, values, (err, result) => {
      if (err) {
        console.error('Error inserting data into the database:', err);
      } else {
        //console.log('Data inserted into the database:', result);
      }
    });

    // Update the previous LED state with the new value
    previousLedState = data.ledState;
  }
});

client.on('error', (err) => {
  console.error('MQTT client error:', err);
});

process.on('SIGINT', () => {
  console.log('Closing MQTT client...');
  client.end();
  dbConnection.end(); // Close the MySQL connection
  process.exit();
});
