// Import required modules
const mqtt = require('mqtt');
const mysql = require('mysql');

// MQTT broker configuration
const broker = 'mqtt://broker.emqx.io';
const topic = 'device/info';
const client = mqtt.connect(broker);

// MySQL Database Configuration
const db = {
  host: 'senselivedb.cn5vfllmzwrp.ap-south-1.rds.amazonaws.com',
  user: 'admin',
  password: 'sense!123',
  database: 'AHU',
};
const dbConnection = mysql.createConnection(db);

// Store the previous LED state
let previousLedState = null;

// MQTT client event handling
client.on('connect', () => {
  console.log('Connected to MQTT broker');
  // Subscribe to the specified topic
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

  // Check if the LED state has changed
  if (data.ledState !== previousLedState) {
    console.log('LED state has changed:', data.ledState);

    // Combine date and time into a single datetime format
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

    previousLedState = data.ledState;
  }
});

client.on('error', (err) => {
  console.error('MQTT client error:', err);
});

process.on('SIGINT', () => {
  console.log('Closing MQTT client...');
  client.end();
  dbConnection.end();
  process.exit();
});
