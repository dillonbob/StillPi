
var localSensors = (function () {
    var W1Temp = require('w1temp');
    var sensorController = require('./sensorController.js');
    var sensorIDs;

    var sensorHandler = function (temperature) {
        var num = this.file.split('/').length - 2;
        var sensorController = require('./sensorController.js');

        console.log('Sensor UID:', this.file.split('/')[num], 'Temperature: ', temperature.toFixed(3), '°C   ');
        sensorController.publishMQTT('stillpi/sensors/report', JSON.stringify({ 'sensorid': this.file.split('/')[num], 'value': temperature.toFixed(3), units: 'C'}));
    };
    
    var announceSensors = function () {
        var sensorController = require('./sensorController.js');

        sensorIDs.forEach(sensor => {
          W1Temp.getSensor(sensor).then(function(sensorInstance) {
            console.log('Announcing: ', sensor);
            sensorController.publishMQTT('stillpi/sensors/identify/announce', JSON.stringify({ 'sensorid': sensor, 'class' : 'temperature', value: sensorInstance.getTemperature(), units: 'C'}));
          });
        });
    };


    return {
        init: function () {
          console.log('Initializing sensor controller.');
    
          // Setup temperature sensor library.  
          W1Temp.getSensorsUids()
          .then( function( sensors ) {
            sensorIDs = sensors;
            console.log(sensors);
            for (var currentSensor of sensors) {
                // get instance of temperature sensor
                W1Temp.getSensor(currentSensor)
                .then( function (sensor) {
                  // Setup handler for sensor temperature changes.  
                  sensor.on('change', sensorHandler);
                });
            }
            announceSensors();
          });
        
            // Schedule periodic scan for new sensors every 5 minutes.
            // setInterval( () => {
            //   updateSensors();
            // }, 300000);
        },

        getSensorUIDs: function () {
          return sensors;
        },

        updateSensors: function () {
            W1Temp.getSensorsUids()
            .then( function( sensors ) {
                sensorIDs = sensors;
                console.log(sensors);
                for (var currentSensor of sensors) {
                    // get instance of temperature sensor
                    W1Temp.getSensor(currentSensor)
                    .then( function (sensor) {
                    // Setup handler for sensor temperature changes.  
                    sensor.on('change', sensorHandler);
                    });
                }
            });
        }
    };
})();
    

module.exports = localSensors