


var uiController = require('./uiController.js');
var heaterController = require('./heaterController.js');

// START SENSOR CONTROLLER
var sensorController = (function () {
    // MQTT BROKER URL.  The MQTT broker is hosted on Master, so for master the broker address is localhost.  
    var brokerAddress = 'mqtt://127.0.0.1';
    // THE FOLLOWING ARE THE AUTHENTICATION CREDENTIALS FOR THE MQTT BROKER
    // CHANGE THESE IF DIFFERENT CREDENTIALS ARE DESIRED.  REMEMBER TO ALSO CHANGE THESE IN THE SLAVE. 
    var brokerUsername = 'still';
    var brokerPassword = 'pi';
    var mqtt = require('mqtt');
    var mqttClient;
    var sensors = new Array();
    var server;
    var mosca = require('mosca');

    // **********************************
    // ** Mosca authentication methods
    // **********************************

    // Accepts the connection if the username and password are valid
    var authenticate = function(client, username, password, callback) {
        // console.log('Username: ', username);
        // console.log('Password:', password.toString('utf-8'));
        var authorized = (username === brokerUsername && password.toString('utf-8') === brokerPassword);
        if (authorized) client.user = username;
        console.log('sensorController: Authorized: ', authorized);
        callback(null, authorized);
    }
    
    // In this case the client authorized as alice can publish to /users/alice taking
    // the username from the topic and verifing it is the same of the authorized user
    var authorizePublish = function(client, topic, payload, callback) {
        callback(null, true);
    }
    
    // In this case the client authorized as alice can subscribe to /users/alice taking
    // the username from the topic and verifing it is the same of the authorized user
    var authorizeSubscribe = function(client, topic, callback) {
        callback(null, true);
    }

    var announceInvoke = function() {
        console.log('sensorController: Publish invoke message');
        mqttClient.publish("stillpi/sensors/identify/invoke", JSON.stringify({"class": "all"}), (err)=>{
            if (!err) {
                console.log('sensorController: Invoke message published successfully.');
            } else {
                console.log('sensorController: Error pulishing invoke message - ', err);
            }
        });           
    }

    var addSensor = function (message) {
        var tempSensor;

        // console.log('sensorController: Adding sensor: ', message);

        // Check if the sensor is in the persistent object.  Add it if not.  
        if ((tempSensor = isSensorInPersist(message.sensorid)) === undefined) {
            global.configProxy.sensors.push( 
                {'sensorid': message.sensorid, 
                'label': message.sensorid,
                'listPosition': global.configProxy.sensors.length,
                'units': message.units});
        };

        // Check if the sensor is already in the session sensor list and add it if not.  
        if (sensors.find(function (sensor) { return sensor.sensorid === message.sensorid; }) === undefined) {
            if (tempSensor !== undefined) {
                message.label = tempSensor.label;
            } else {
                message.label = message.sensorid
            }
            sensors.push(message);
        };

        // console.log('sensorController: Session sensors: ', sensors);

        uiController.renderSensors();
    };

    var isSensorInPersist = function(id) {
        return global.configProxy.sensors.find(function (sensor) { return sensor.sensorid === id; });
    };

    var isSensorInSession = function(id) {
        return sensors.find(function (sensor) { return sensor.sensorid === id; });
    };

    var handleAnnouncement = function (message) {
        console.log('sensorController: Processing sensor announcement: ', message);

        addSensor(message);

        console.log('sensorController: handleAnnouncement - Rendering sensors ', sensors);

        uiController.renderSensors();
    };

    // Hnadler for incoming MQTT messages.  
    // This method will look at the message type and dispatch it to the appropriate handler.  
    var mqttMessageHandler = function (topic, message) {
        message = JSON.parse(message.toString());
        console.log( 'sensorController: MQTT server mqttMessageHandler:topic: ', topic);

        switch (topic) {
            case 'stillpi/sensors/report':
                // Call addSensor to make sure that this sensor is in the persistent and session sensor arrays.  
                addSensor(message);

                // Find the index of the reporting sensor in the session sensors array.  
                var index = sensors.findIndex(sensor => sensor.sensorid === message.sensorid);
                console.log('sensorController: Updating sensor: ', sensors[index]);

                // Update the sensor temperature value in the session array.  
                sensors[index].value = message.value;

                //  Push the new value out.  
                uiController.sensorUpdate(sensors[index]);
                break;

            case 'stillpi/sensors/identify/announce':
                handleAnnouncement(message);
                break;
            
            case 'stillpi/sensors/identify/delete':
                break;

            case 'stillpi/sensors/ping/sensorid':
                break;

        }
    };
  
  
    return {
      init: function () {
        console.log('sensorController: Initializing sensor controller.');

        // Setup Mosca MQTT broker.  
        var settings = {
            port:1883
            }
        server = new mosca.Server(settings);
        server.on('ready', function(){
            server.authenticate = authenticate;
            server.authorizePublish = authorizePublish;
            server.authorizeSubscribe = authorizeSubscribe;
            console.log("sensorController: MQTT broker ready.");
        });
        server.on('clientConnected', (client) => {
            console.log('sensorController: MQTT client connected.')

            // Whenever a new MQTT slient connectes, ask all sensors to announce themselves.  
            announceInvoke();
        });
        server.on('published', function(packet, client) {
          console.log('MQTT server message published');
        });
        
        //Setup the MQTT client that this sensor controller uses to receive sensor data from slaves.  
        mqttClient  = mqtt.connect(brokerAddress, {
            username: brokerUsername,
            password: Buffer.alloc(brokerPassword.length, brokerPassword), // Passwords are buffers
        });
        // Subscribe to relevant topics.  
        mqttClient.on('connect', function () {
            console.log('sensorController:init: Connected to MQTT broker.');
            mqttClient.subscribe('stillpi/sensors/report');
            mqttClient.subscribe('stillpi/sensors/identify/invoke');
            mqttClient.subscribe('stillpi/sensors/identify/announce');
            // announceInvoke();
        });
        // Setup handler to dispatch incoming MQTT messages.  
        mqttClient.on('message', mqttMessageHandler);
        // When new client slaves connect, send invoke message to provoke slaves to announce their sensors.  
        mqttClient.on('clientConnected', function(client) {
            console.log('\n\nsensorController: client connected\n\n', client.id);
            // mqttClient.publish('stillpi/sensors/identify/invoke', JSON.stringify({"class": "all"}));
        });
      },

      isSensor: function (id) {
        return isSensorInSession(id);
      },

      getSensors: function () {
        return sensors;
      },

      updateSensorLabel: function (sensorID, newLabel) {
        // Find the index of the reporting sensor in the session sensors array.  
        var index = sensors.findIndex(sensor => sensor.sensorid === sensorID);
        console.log('sensorController: Updating sensor label: ', sensors[index]);

        // Update the sensor temperature value in the session array.  
        sensors[index].label = newLabel;
      },

      publishMQTT: function (topic, message) {
        mqttClient.publish(topic, message);
      }
    }
})();
// END SENSOR CONTROLLER

module.exports = sensorController
