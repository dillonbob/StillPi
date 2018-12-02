







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

    var sensorMaintenanceInterval = 10;   // In seconds.  
    var pingMessagesOut = [];
    var pingMessagesIn = [];

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

    // This function is called when a remote sensor module announces a sensor on the MQTT broker.  
    // This function adds the sensor to the persistent and session objects.  
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

    var deleteSensor = function (sensorIDtoDelete) {
        sensors = sensors.filter( function (next) {
            return next.sensorid !== sensorIDtoDelete;
        });
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

            case 'stillpi/sensors/ping':
                console.log("Ping message: ", message);
                // Add ping responses to the pingMessages object.  The periodic ping maintenance function will inspect this object.  
                if (message.type === 'response') {
                    // If the sensor is not already in the ping sensors list, add it.  
                    if(!pingMessagesIn.find(function (sensor) { return sensor === message.sensorid; })) {
                        pingMessagesIn.push(message.sensorid);
                    }
                }
                break;

        }
    };


    // This function runs periodically to check if sensors that used to be available are now unavailable.  
    var pingIntervalStart = function () {
        console.log("sensorController: ping maintenance function:", pingMessagesIn);

        // Check current list of sensors.  If any of them did not respond to the last ping, remove them.  
        pingMessagesOut.forEach( (nextSensorID) => {
            if (!pingMessagesIn.includes(nextSensorID)) { // Sensor disappeared during the last sensor maintenance interval.  
                console.log("Time to remove sensor ", nextSensorID);

                // Remove from the session sensors list
                console.log("Session sensors before: ", sensors);
                deleteSensor(nextSensorID);
                console.log("Session sensors after: ", sensors);

                // Check if any of the heaters that are turned ON are using this sensor for a target or limit.  If one is, turn it OFF.  
                if (global.configProxy.heaters[0].state === 'on') {
                    // if the heater is in PID mode AND one of it's sensors is the sensor being deleted ...
                    if ((global.configProxy.heaters[0].mode === 'temp') && ((global.configProxy.heaters[0].pidParameters.pvSensor === nextSensorID) || (global.configProxy.heaters[0].pidParameters.limitSensor === nextSensorID))) {
                        // Change state in global config object
                        global.configProxy.heaters[0].state = 'off';

                        // Turn the heater off
                        heaterController.setHeaterState(0, false);
                    };
                };

                if (global.configProxy.heaters[1].state === 'on') {
                    // if the heater is in PID mode AND one of it's sensors is the sensor being deleted ...
                    if ((global.configProxy.heaters[1].mode === 'temp') && ((global.configProxy.heaters[1].pidParameters.pvSensor === nextSensorID) || (global.configProxy.heaters[1].pidParameters.limitSensor === nextSensorID))) {
                        // Change state in global config object
                        global.configProxy.heaters[1].state = 'off';

                        // Turn the heater off
                        heaterController.setHeaterState(1, false);
                    };
                };

                // Update the UI
                uiController.removeSensor(nextSensorID);
                uiController.renderParameters();
            }
        });

        console.log("Sensors: ", sensors);
        // Clear the array of sent ping IDs so that we can re-gather it in tis loop.  
        // The reason we use the pingMessagesOut array is to avoid a condition where a new sensor announces during an interval.  It's now in teh sensors object,
        // but a ping message was not sent to it in the previous interval.  No response will arrive and we will delete it.  Bad.  
        // So we use the pingMessagesOut array to make sure that we're only pruning sensors that have been pinged but did not respond.  
        pingMessagesOut = [];
        sensors.forEach( (sensor) => {
            console.log("Pinging sensor ", sensor.sensorid);
            mqttClient.publish('stillpi/sensors/ping', JSON.stringify({"type": "call", "sensorid": sensor.sensorid}));
            pingMessagesOut.push(sensor.sensorid);
        });

        // Empty the pingMessages array to start accumulating new ping responses for the upcoming interval.  
        pingMessagesIn = [];
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
            console.log('sensorController: MQTT client connected: ', client.connection.stream.remoteAddress)

            // Whenever a new MQTT slient connectes, ask all sensors to announce themselves.  
            // announceInvoke();
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
            mqttClient.subscribe('stillpi/sensors/ping');
            // announceInvoke();
        });
        // Setup handler to dispatch incoming MQTT messages.  
        mqttClient.on('message', mqttMessageHandler);
        // When new client slaves connect, send invoke message to provoke slaves to announce their sensors.  
        mqttClient.on('clientConnected', function(client) {
            console.log('\n\nsensorController: client connected\n\n', client.id);
            // mqttClient.publish('stillpi/sensors/identify/invoke', JSON.stringify({"class": "all"}));
        });

        // Setup sensor maintenance interval function.  
        var intervalID = setInterval( function() {
            pingIntervalStart();
          }, sensorMaintenanceInterval * 1000); // Once per ten seconds.  
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