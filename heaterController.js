
// START HEATER CONTROLLER
var heaterController = (function () {

  
  // Variables
  var pidController = require('liquid-pid');
  // var pidController = require('node-pid-controller');
  var piGPIO = require('onoff').Gpio;
  const heater1 = new piGPIO(23, 'out');
  const heater2 = new piGPIO(18, 'out');

    // Pulse Width Modulation interval used by the heater for updates.  
    var heaterInterval = 10;   // In seconds.  
    // var heaterInterval = 10;   // In seconds.  
    
    //  PID constants.  
    // var pidParms = {
    //   Kp: 150,
    //   Ki: 50,
    //   Kd: 150
    // };
    var pidParms = {
      Kp: 25,
      Ki: 1000,
      Kd: 9
    };

    // // Holds the PID controller objects.  
    // var pids;


  // *************************
  // Functions and methods
  // *************************


  // Turns heaters on and off.  state parameter is boolean and true = on.  
  var setHeaterState = function (heaterNum, state) {
    var stateTag = state?'on.':'off.'
    console.log('Heater ' + heaterNum + '    turned ' + stateTag);
    
    switch (heaterNum) {

      case 1: 
        heater1.writeSync(state?piGPIO.HIGH:piGPIO.LOW);
        break;

      case 2:
        heater2.writeSync(state?piGPIO.HIGH:piGPIO.LOW);
        break;

    };
  };

  var cToF = function (temp) {
    return (temp * (9 / 5)) + 32;
  };

  var fToC = function (temp) {
    return (temp - 32) * (5 / 9);
  };

  var lookupSensor = function (sensorID) {
    var sensorControl = require('./sensorController.js');

    var sensor = sensorControl.getSensors().find((sensor) => {return sensor.sensorid === sensorID;});
    console.log('heaterController: Looking up sensor ', sensorID, ': ', sensor);
    return sensor;
  };


    //  Theory of Operation:
    //    This method fires periodically as determined by the heaterInterval variable above.  This is the PWM interval.  
    //    The heater is turned on for a portion of this interval, and off for the rest.  In constant power mode, the % on/off is set in teh UI.  
    //    For PID, the PID algorithm determins the % on/off.  
    //
    //    This device can switch up to 40A so noise and protecting circuit breakers is a concern.  To address this we avoid switching anything on/off
    //    simultaneously.  Odd chanels switch off first and on second.  The even heaters switch on first and off second.  Further, we delay the 
    //    processing of even and odd channels with respect to each other to further minimize simultaneous switching.  

  var heater1IntervalStart = function () {
    var uiController = require('./uiController.js');  
    let heater1correction;  
    let targetSensor1, limitSensor1, sensorsAvailable1, targetSensorTemp1;
    
    console.log('heaterController: Start heater 1 interval.');

    // Check if heater power function is on in the UI.  
    if (global.configProxy.heaters[0].state !== 'on') {
      // Heater not turned on.  Using "not on" rather than off to protect against file and other errors.  State must be 'on'.

      console.log('heaterController: Heater 1 power off.');
      // Turn off heater and indicator.  
      uiController.setHeaterIndicator( 1, 'off');  //  Turn indicator off
      setHeaterState(1, false);     
      
      return;
    }

    // Process heater 1
    if ( global.configProxy.heaters[0].mode === 'temp') {   //  PID mode
      targetSensor1 = lookupSensor(global.configProxy.heaters[0].pidParameters.pvSensor);
      targetSensorTemp1 = targetSensor1.units==='C'?cToF(parseFloat(targetSensor1.value)):parseInt(targetSensor1.value);
      limitSensor1 = lookupSensor(global.configProxy.heaters[0].pidParameters.limitSensor);

      sensorsAvailable1 = !(targetSensor1 === undefined || limitSensor1 === undefined);
      console.log('heaterController: sensorsAvailable calculation for heater 1: ', sensorsAvailable1, ' ',  targetSensor1, ' ', limitSensor1);

      // Calculate the PID correction value if sensors are available.  Otherwise, set it to 0.  
      console.log('heaterController: Preparing to process heater 1.');
      if (sensorsAvailable1) {  // No sensor reports have come in yet.  
        console.log('heaterController: Sensors available for heater 1.  Calculating PID correction value: ', targetSensorTemp1, pids[0]);
        heater1correction = pids[0].calculate(parseFloat(targetSensorTemp1));  // Calculate the PID correction value.    
        console.log('heaterController: Heater 1 PID correction value = ', heater1correction);
  // ***********  Comment the following line out for production!
        // heater1correction = 60;  // Used for testing in development.  
      } else {
        console.log('heaterController: One or more sensors are unavailable for heater 1.');
        heater1correction = 0;
      }

      // For heater 1, the interval starts with the heater on.  The delayed function turns it off.  
      if (!sensorsAvailable1) {
        // Turn off heater and blank current value
        uiController.setHeaterIndicator( 1, 'off');  //  Turn indicator off
        setHeaterState(1, false);     
      }
      else {
        currLimitSensorValue1 = limitSensor1.units==='C'?cToF(limitSensor1.value):parseFloat(limitSensor1.value);
        LimitValue1 = parseFloat(global.configProxy.heaters[0].pidParameters.limitValue);
  
        console.log('Lim sensor 1: ', currLimitSensorValue1, ', type: ', typeof(currLimitSensorValue1), ', limit 1: ', LimitValue1, ', type: ', typeof(LimitValue1));
        if (currLimitSensorValue1 > LimitValue1) {   //  If limit exceeded.  
          console.log('heaterController: Heater 1 limit (', global.configProxy.heaters[0].pidParameters.limitValue, ') exceeded (', limitSensor1.units==='C'?cToF(limitSensor1.value):limitSensor1.value, ').  Turning off heater.');
          // turn off heaters, update current value
          setHeaterState(1, false);     
          uiController.setHeaterIndicator( 1, 'off');  //  Turn indicator off
          // Update the current temperature field in the UI. 
          let displayTemp = (targetSensor1.units==='C'?cToF(parseFloat(targetSensor1.value)):parseInt(targetSensor1.value)).toFixed(1);
          uiController.updateHeaterCurrentTemp(1, displayTemp);
        } else { // Sensors available and limit not exceeded
          console.log('heaterController: Sensors for heater 1 available and limit not exceeded(Limit = ', LimitValue1, ', current limit temp = ', currLimitSensorValue1, ').  Proceeding.');
          if (heater1correction < 100) {  // PID update value is NOT 100
            console.log('heaterController: PID calculated for heater 1 and less than 100%.  Turning heater 1 off and scheduling function to turn it on.');
            setHeaterState(1, false);     // Turn heater 1 off
            uiController.setHeaterIndicator( 1, 'off');  //  Turn indicator off
            // Setup delayed function to turn it on
            setTimeout(function(heater1correction) {    //  Delay using the PID algorithm output.  
              console.log('heaterController: Heater 1 scheduled function starting.  Turning heater on.');
              uiController.setHeaterIndicator( 1, 'on');  //  Turn indicator on
              setHeaterState(1, true);  // Turn Heater on.   
              // Update the current temperature field in the UI. 
              let displayTemp = (targetSensor1.units==='C'?cToF(parseFloat(targetSensor1.value)):parseInt(targetSensor1.value)).toFixed(1);
              uiController.updateHeaterCurrentTemp(1, displayTemp);
            }, (1 - (heater1correction/100.0)) * heaterInterval * 1000);  
          } else {
            // Update the current temperature field in the UI. 
            let displayTemp = (targetSensor1.units==='C'?cToF(parseFloat(targetSensor1.value)):parseInt(targetSensor1.value)).toFixed(1);
            uiController.updateHeaterCurrentTemp(1, displayTemp);
            uiController.setHeaterIndicator( 1, 'on');  //  Turn indicator on
            setHeaterState(1, true);  // Turn Heater on.   

            console.log('heaterController: Heater 1 PID correction value is 100%.  Turn heater on.');
          };
        }
      }
    } else {                                           //  Constant power mode
      if (global.configProxy.heaters[0].powerParameters.outputPower === '100') {
        console.log('heaterController: Heater 1 constant power set to 100%.  Skipping processing. ')
        uiController.setHeaterIndicator( 1, 'on');  //  Turn indicator on
        setHeaterState(1, true);  // Turn Heater on.  Should already be on, but this covers cases where constant power mode was selected while the heater and indicator is off.  
      } else {
        uiController.setHeaterIndicator( 1, 'off');  //  Turn indicator off
        setHeaterState(1, false);  // Turn Heater off. 

        setTimeout(function() {    //  Delay by the % of the heating interval in the configuration for power mode.  
          console.log('heaterController: Heater 1 delayed process starting.  Turning heater on.');
          uiController.setHeaterIndicator( 1, 'on');  //  Turn indicator on
          setHeaterState(1, true);  // Turn Heater on.   
        }, (1 - (parseFloat(global.configProxy.heaters[0].powerParameters.outputPower)/100)) * heaterInterval * 1000);  
      }
    };
  };


  var heater2IntervalStart = function () {
    var uiController = require('./uiController.js');  
    let heater2Correction;  
    let targetSensor2, targetSensor2Temp, limitSensor2, sensorsAvailable2;
    
    console.log('heaterController: Start heater 2 interval.');

    // Check if heater power function is on in the UI.  
    if (global.configProxy.heaters[1].state !== 'on') {
      // Heater not turned on.  Using "not on" rather than off to protect against file and other errors.  State must be 'on'.

      console.log('heaterController: Heater 2 power off.');
      // Turn off heater and indicator.  
      uiController.setHeaterIndicator( 2, 'off');  //  Turn indicator off
      setHeaterState(2, false);     
      
      return;
    }
        
    // Process heater 2
    console.log('heaterController: Scheduling heater 2 processing 25% of interval in future.  ')
    setTimeout(function() { //  Delay processing of the even heaters by 25% of the heater interval to minimize simultaneous switching of heaters.
      console.log('heaterController: Starting heater 2 processing.');
      // Heater 2 starts it's interval processing with the heater and indicator OFF, unless PID correction = 100% or constant power is set to 100%.  
      if ( global.configProxy.heaters[1].mode === 'temp') {   //  PID mode
        targetSensor2 = lookupSensor(global.configProxy.heaters[1].pidParameters.pvSensor);
        targetSensor2Temp = targetSensor2.units==='C'?cToF(parseFloat(targetSensor2.value)):parseInt(targetSensor2.value);
        limitSensor2 = lookupSensor(global.configProxy.heaters[1].pidParameters.limitSensor);

        sensorsAvailable2 = !(targetSensor2 === undefined || limitSensor2 === undefined);
        console.log('heaterController: sensorsAvailable calculation for heater 2: ', sensorsAvailable2, ' ',  targetSensor2, ' ', limitSensor2);

        // Calculate the PID correction value if sensors are available.  Otherwise, set it to 0.  
        console.log('heaterController: Preparing to process heater 2.');
        if (sensorsAvailable2) {  // No sensor reports have come in yet.  
          console.log('heaterController: Sensors available for heater 2.  Calculating PID correction value.');
          heater2correction = pids[1].calculate(parseFloat(targetSensor2Temp));  // Calculate the PID correction value.    
          console.log('heaterController: Heater 2 PID correction value = ', heater2correction);
  // ***********  Comment the following line out for production!
          // heater2correction = 33;  // Used for testing in development.  
        } else {
          console.log('heaterController: One or more sensors are unavailable for heater 2.');
          heater2correction = 0;
        }
  
        // For heater 2, the interval starts with the heater off.  The delayed function turns it on.  
        if (!sensorsAvailable2) {
          // Turn off heater and blank current value
          uiController.setHeaterIndicator( 2, 'off');  //  Turn indicator off
          setHeaterState(2, false);     
        }
        else {
          currLimitSensorValue2 = limitSensor2.units==='C'?cToF(limitSensor2.value):parseFloat(limitSensor2.value);
          LimitValue2 = parseFloat(global.configProxy.heaters[1].pidParameters.limitValue);

          console.log('Lim sensor 2: ', currLimitSensorValue2, ', type: ', typeof(currLimitSensorValue2), ', limit 2: ', LimitValue2, ', type: ', typeof(LimitValue2));
          if (currLimitSensorValue2 > LimitValue2) {   //  If limit exceeded.  
              console.log('heaterController: Heater 2 limit (', global.configProxy.heaters[1].pidParameters.limitValue, ') exceeded (', limitSensor2.units==='C'?cToF(limitSensor2.value):limitSensor2.value, ').  Turning off heater.');
            // turn off heaters, update current value
            setHeaterState(2, false);     
            uiController.setHeaterIndicator( 2, 'off');  //  Turn indicator off
            // Update the current temperature field in the UI. 
            let displayTemp = (targetSensor2.units==='C'?cToF(parseFloat(targetSensor2.value)):parseInt(targetSensor2.value)).toFixed(1);
            uiController.updateHeaterCurrentTemp(2, displayTemp);
          } else { // Sensors available and limit not exceeded
            console.log('heaterController: Sensors for heater 2 available and limit not exceeded(Limit = ', LimitValue2, ', current limit temp = ', currLimitSensorValue2, ').  Proceeding.');
            if (heater2correction < 100) {  // PID update value is NOT 100
              console.log('heaterController: PID calculated for heater 2 and less than 100%.  Turning heater 2 on and scheduling function to turn it off.');
              setHeaterState(2, true);     // Turn heater 2 on
              uiController.setHeaterIndicator(2, 'on');  //  Turn indicator on
              // Setup delayed function to turn it off
              setTimeout(function(heater2correction) {    //  Delay using the PID algorithm output.  
                console.log('heaterController: Heater 2 scheduled function starting.  Turning heater off.');
                uiController.setHeaterIndicator( 2, 'off');  //  Turn indicator off
                setHeaterState(2, false);  // Turn Heater off.   
                // Update the current temperature field in the UI. 
                let displayTemp = (targetSensor2.units==='C'?cToF(parseFloat(targetSensor2.value)):parseInt(targetSensor2.value)).toFixed(1);
                uiController.updateHeaterCurrentTemp(2, displayTemp);
              }, (1 - (heater2correction/100.0)) * heaterInterval * 1000);  
            } else {
              console.log('heaterController: Heater 2 PID correction value is 100%.  Turn heater on and do nothing.');
              setHeaterState(2, true);     
              uiController.setHeaterIndicator( 2, 'on');  //  Turn indicator on  
              // Update the current temperature field in the UI. 
              let displayTemp = (targetSensor2.units==='C'?cToF(parseFloat(targetSensor2.value)):parseInt(targetSensor2.value)).toFixed(1);
              uiController.updateHeaterCurrentTemp(2, displayTemp);
            };
          }
        }  
      } else {                      // Constant power mode. 
        if (global.configProxy.heaters[1].powerParameters.outputPower === 100) {  //If constant power is set to 100%, avoid flicker and set indicator (in case first time through) and heater and return.  
          uiController.setHeaterIndicator( 2, 'on');  //  Turn indicator on
          setHeaterState(2, true);  // Turn Heater on.   
        } else {
          uiController.setHeaterIndicator( 2, 'on');  //  Turn indicator on to start
          setHeaterState(2, true);  // Turn Heater off.   

          setTimeout(function() {    //  Delay by the % of the heating interval in the configuration for power mode.  
            console.log('heaterController: Heater 2 delayed process starting.  Turning heater on.');
            uiController.setHeaterIndicator( 2, 'off');  //  Turn indicator off
            setHeaterState(2, false);  // Turn Heater off.   
          }, (parseFloat(global.configProxy.heaters[1].powerParameters.outputPower)/100) * heaterInterval * 1000);  
        }
      };
    }, heaterInterval * 0.25 * 1000); //  Delay processing of the even heaters by 25% of the heater interval.  
  };


  
  return {
    init: function () {
      var uiController = require('./uiController.js');  

      console.log('Initializing heater controller.');

      // Turn off heaters and initialize the UI.  
      uiController.setHeaterIndicator( 1, 'off');  
      setHeaterState(1, false);    
      uiController.updateHeaterCurrentTemp(1, '---');
      uiController.setHeaterIndicator( 2, 'off');  
      setHeaterState(2, false);  
      uiController.updateHeaterCurrentTemp(2, '---');

      // Initialize the PID controller objects.  
      pids = [new pidController({
          temp: {
            ref: parseInt(global.configProxy.heaters[0].pidParameters.sv)         // Point temperature 
          },
          Pmax: 100,       // Max power (output),
          
          // Tune the PID Controller
          Kp: pidParms.Kp,           // PID: Kp
          Ki: pidParms.Ki,         // PID: Ki
          Kd: pidParms.Kd             // PID: Kd
        }), new pidController({
          temp: {
            ref: parseInt(global.configProxy.heaters[1].pidParameters.sv)         // Point temperature 
          },
          Pmax: 100,       // Max power (output),
          
          // Tune the PID Controller
          Kp: pidParms.Kp,           // PID: Kp
          Ki: pidParms.Ki,         // PID: Ki
          Kd: pidParms.Kd             // PID: Kd
      })];

      // Schedule the periodic heater processing.  
      var intervalID = setInterval( function() {
        heater1IntervalStart();
        heater2IntervalStart();
      }, heaterInterval * 1000);
    },

    // Called by the UI controller when the heating mode changes.  Allows the PID controller to be reset.  
    changeHeatingMode: function (heaterNum) {
      console.log('heaterController: changing heater mode.')
      switch (heaterNum) {
        case 1:
          if (global.configProxy.heaters[0].mode === 'temp') {  //  Mode switched to PID, restart the PID controller object.  
            pids[0] = new pidController({
              temp: {
                ref: parseInt(global.configProxy.heaters[0].pidParameters.sv)         // Point temperature 
              },
              Pmax: 100,       // Max power (output),
              
              // Tune the PID Controller
              Kp: pidParms.Kp,           // PID: Kp
              Ki: pidParms.Ki,         // PID: Ki
              Kd: pidParms.Kd             // PID: Kd
            });
          }
          break;
        case 2:
          if (global.configProxy.heaters[1].mode === 'temp') {  //  Mode switched to PID, restart the PID controller object.  
            pids[1] = new pidController({
              temp: {
                ref: parseInt(global.configProxy.heaters[1].pidParameters.sv)         // Point temperature 
              },
              Pmax: 100,       // Max power (output),
              
              // Tune the PID Controller
              Kp: pidParms.Kp,           // PID: Kp
              Ki: pidParms.Ki,         // PID: Ki
              Kd: pidParms.Kd             // PID: Kd
            });
          }
          break;
      }
    }, 
    
    // When the UI changes the PID target temperature.  
    changeHeaterPidTarget: function (heaterNum, target) {
      console.log('heaterController: Updating heater ' + heaterNum + ' PID target to ' + target);
      pids[heaterNum-1] = new pidController({
        temp: {
          ref: parseInt(global.configProxy.heaters[heaterNum-1].pidParameters.sv)         // Point temperature 
        },
        Pmax: 100,       // Max power (output),
        
        // Tune the PID Controller
        Kp: pidParms.Kp,           // PID: Kp
        Ki: pidParms.Ki,         // PID: Ki
        Kd: pidParms.Kd             // PID: Kd
      });
      // pids[heaterNum-1].setTarget(target);
    },

    shutdown: function () {
      console.log('Shutting down ...');
      setHeaterState(1, false);
      setHeaterState(2, false);
    }
  }
})();
// END HEATER CONTROLLER

module.exports = heaterController;
