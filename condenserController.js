var sensorController = require('./sensorController.js');
// var uiController = require('./uiController.js');


// START CONDENSER CONTROLLER
var condenserController = (function () {
  var sensorMaintenanceInterval = 20;   // In seconds.  
  var pingMessageIn = false;
  var condenserControllerAttached = false;
  var pingIntervalTimerID;


  var uiInput = function (data) {
    var sensorController = require('./sensorController.js');

    console.log("condenserController: sensorController.publishMQTT() = ", sensorController.publishMQTT, " type of path: ", typeof('stillpi/condenser/paramUpdate'), ", type of data: ", typeof(data));
    sensorController.publishMQTT('stillpi/condenser/paramUpdate', JSON.stringify(data));
  }

  var announceInvoke = function() {
    var sensorController = require('./sensorController.js');

    console.log('condenserController: Publish invoke message');
    sensorController.publishMQTT('stillpi/condenser/identify/invoke', JSON.stringify({"class": "all"}));
  }

  // This function runs periodically to check if the conenser controller is still online.  
  var pingIntervalStart = function () {
    var sensorController = require('./sensorController.js');
    var uiController = require('./uiController.js');

    if (condenserControllerAttached) {        // Only ping if a condenser controller is attached.  
      console.log("condenserController: ping maintenance function.");


      if (pingMessageIn) {                               // The condenser controller responded to the ping. 
        // Clear the pig flag for the next interval  
        pingMessageIn = false;
      } else {                                            //  The condenser controller didn't respond to the pig.  
        // Delete it from the UI.  Stop maintenance.  
        if (condenserControllerAttached) {
          condenserControllerAttached = false;   // No longer attached.  
          uiController.forwardCondenserDelete();  //  Remove it from the UI.  
          clearInterval(pingIntervalTimerID);     //  Stop periodic maintenance.  
        }
      }

      // Send out the next ping.
      // mqttClient.publish('stillpi/sensors/ping', JSON.stringify({"type": "call", "sensorid": sensor.sensorid}));
      sensorController.publishMQTT('stillpi/condenser/ping', JSON.stringify({"type": "call"}));
    }
  };




  return {
      init: function () {
        console.log('condenserController: Initializing condenser controller.');

        // Setup sensor maintenance interval function.  
        pingIntervalTimerID = setInterval( function() {
          pingIntervalStart();
        }, sensorMaintenanceInterval * 1000); // The interval is set at the top of this file.                      
      },

      invokeCondenser: function () {
        announceInvoke();
      },

      pingReceived: function () {
        console.log("condenserController: Ping response received.");
        pingMessageIn = true;
      },

      uiInput: function(data) {
        //  Relay UI change data to the remote condenser module
        uiInput(data);
      },

      tempReport: function(message) {
        var uiController = require('./uiController.js');

        console.log('condenserController: temperature message received: ', message);
        // condenserController: temperature message received:  { condenser: 'product', temperature: '24.500', units: 'C' }
        uiController.forwardCondenserTemp( {'condenser': message.condenser, 'param': 'tempUpdate', 'value': message.temperature, 'units': message.units} )
      },


      valvePosition: function(message) {
        var uiController = require('./uiController.js');

        console.log('condenserController: Valve position message received: ', message);
        uiController.forwardCondenserTemp( {'condenser': message.condenser, 'param': 'valveSetting', 'value': message.value} )
      },

      condenserIdentify: function(message) {                           //  Called by sensor controller when a condenser controller announces itself on the MQTT broker.  
        console.log("Condener controller identify: ", message);
        var uiController = require('./uiController.js');
        
        pingMessageIn = true;  //  This prevents the UI from clearing on the first ping response.  
        condenserControllerAttached = true;  //  Set flag indicating that the condenser controller is attached.  
        
        uiController.forwardCondenserAdd(message);
      },

      updateParams: function () {
        var sensorController = require('./sensorController.js');

        if (condenserControllerAttached) {
          //  Kick this off by sending a request for parameters to the controller.  
          // The controller will respond in the same topic with a response and that response will trigger an 
          sensorController.publishMQTT('stillpi/condenser/getParams', JSON.stringify({"type": "request"}));
        }
      },

      paramsUpdateResponse: function (params) {
        // This method is related to the updateParams method right above this method.  The sensor controller calls this when the condenser controller returns the current parameter object.  
        //  In response, issue a command to add the condenser controller with teh latest parameters as a way to get the parameters to the new client that connected that started this whole process.  
        var uiController = require('./uiController.js');

        uiController.forwardCondenserAdd(params);
      },
  };
})();
// END SENSOR CONTROLLER

module.exports = condenserController;