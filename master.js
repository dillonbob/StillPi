
var sensorController = require('./sensorController.js');
var localSensors = require('./localSensors.js');
var heaterController = require('./heaterController.js');
var uiController = require('./uiController.js');
var loggingController = require('./loggingController.js');
var config = require('./configController.js');



// GLOBAL APP CONTROLLER                    
var controller = (function (sensorCtrl, mqttCtrl) {
    var mdns = require('mdns');
  
    return {
      init: function () {
        console.log('Application starting.');  

        // Turn off heaters and set heaters to off in configuration.  
        heaterController.shutdown();

        process.on(
          "uncaughtException",
          function handleError( error ) {
      
              console.log( 'Uncaught Exception' );
              console.error( error );
      
          }
      );
      // Register exit function to turn off heaters on exit.
        process.on('exit', (code) => {
          console.log('master: on exit on code ', code);
          heaterController.shutdown();
          process.exit();
        });
        process.on('SIGINT', () => {
          console.log('master: on SIGINT ...');
          heaterController.shutdown();
          process.exit();
        });

        // Use mDNS to advertise this device so that slaves can find the MQTT broker.
        var mqttAd = mdns.createAdvertisement(mdns.tcp('mqtt'), 1883, {name: 'stillpi'}, function(error, service) {
          console.log('mDNS mqtt advertise fired for service ');
          // console.log('   Error message: ', error);
        });
        mqttAd.start();

        // Use mDNS to advertise this device so that slaves can find the MQTT broker.
        var httpAd = mdns.createAdvertisement(mdns.tcp('http'), 3000, {name: 'stillpi'}, function(error, service) {
          console.log('mDNS http advertise fired for service ');
          // console.log('   Error message: ', error);
        });
        httpAd.start();

        // INITIALIZE INDIVIDUAL CONTROLLERS
        // Initialize the configuration controller.  
        config.configController.init();
        global.configProxy.heaters[0].state = 'off';
        global.configProxy.heaters[1].state = 'off';
        // Initialize the UI controller.  
        uiController.init();
        // Initialize the sensor controller.  
        sensorController.init();
        // Initialize the local temperature sensor.  
        localSensors.init();
        // Initialize the heater controller.  
        heaterController.init();
        // Initialize the logging controller.  
        loggingController.init();
  
        console.log('Application has started.');  
      }
  }
  
// })(sensorController, heaterController, uiController, loggingController);
})(sensorController, heaterController, uiController, loggingController, config.configController);
  
  
controller.init();
