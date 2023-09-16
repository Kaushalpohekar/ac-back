const mysql = require('mysql');
const mqtt = require('mqtt');

// Create a MySQL connection
const dbConnection = mysql.createConnection({
  host: 'senselivedb.cn5vfllmzwrp.ap-south-1.rds.amazonaws.com',
  user: 'admin',
  password: 'sense!123',
  database: 'AHU',
});

// Connect to the database
dbConnection.connect();

// Create an MQTT client
const mqttClient = mqtt.connect('mqtt://broker.emqx.io');

// Define the MQTT topics
const Topic = '/device/ahu';

// Function to check and publish MQTT messages
// Function to check and publish MQTT messages
function checkAndPublish() {
  const currentTime = new Date();
  console.log(currentTime);

  // Fetch the nearest entry from the database
  const query = `SELECT * FROM ahu_schedule WHERE start_time <= ? ORDER BY start_time DESC LIMIT 1`;
  dbConnection.query(query, [currentTime], (error, results) => {
    if (error) {
      console.error('Error fetching data:', error);
      return;
    }

    if (results.length > 0) {
      const entry = results[0];
      const { start_time, end_time, deviceID } = entry;
      console.log("---------------------------------");
      console.log(entry);

      if (currentTime >= start_time && currentTime <= end_time) {
        mqttClient.publish(Topic, 'on', { qos: 1 });
        console.log("Publish ON");
      } else if (currentTime > end_time) {
        mqttClient.publish(Topic, 'off', { qos: 1 });
        console.log("Publish OFF");
      }
    }
  });
}



// Check and publish messages every 5 minutes
const interval = setInterval(checkAndPublish, 5000); // 5 minutes in milliseconds

// Handle MQTT connection events
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
});

mqttClient.on('error', (error) => {
  console.error('MQTT Error:', error);
});

// Close the MySQL connection and clear the interval when the script exits
process.on('exit', () => {
  dbConnection.end();
  clearInterval(interval);
});
