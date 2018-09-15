
// START UI CONTROLLER
var heaterControl = require('./heaterController.js');
var sensorControl = require('./sensorController.js');



var uiController = (function () {
    var express;
    var app;
    var server;
    var io;

    // This is a little utility to test the ability to control output on the UI. 
    //  Will be vestigial once the whole UI is connected up.  
    var blinkHeaterPowerIndicators = function (client) {
        var indicator1State = 'on';
        var indicator2State = 'off';
        var intervalID = setInterval( () => {
            // console.log(indicator1State, indicator2State);
            io.emit('setParam', {value: 'heater-power-indicator1', state: indicator1State});
            indicator1State = indicator1State==='on'?'off':'on';
    
            io.emit('setParam', {value: 'heater-power-indicator2', state: indicator2State});
            indicator2State = indicator2State==='on'?'off':'on';
        }, 1000);

        client.on('disconnect', (intervalID) => {
            console.log('uiController: Client disconnected.');
            clearInterval(intervalID);
        });
    };


    // Handles UI parameter changes.  
    // Updates the overall config object used by other objects in the system.  
    var paramChange = function (data) {
        console.log('uiController: Updating parameter: ', data);

        switch (data.field) {
            case 'heater-label1': 
                console.log('uiController: Updated parameter heater-label1 to ', data.value);
                global.configProxy.heaters[0].heaterLabel = data.value;
                break;

            case 'heater-label2': 
                console.log('uiController: Updated parameter heater-label2 to ', data.field);
                global.configProxy.heaters[1].heaterLabel = data.value;
                break;

            case 'heater-target-value1': 
                console.log('uiController: Updated parameter heater-target-value1 to ', data.field);
                global.configProxy.heaters[0].pidParameters.sv = data.value;
                heaterControl.changeHeaterPidTarget(1, data.value)
                break;

            case 'heater-target-value2': 
                console.log('uiController: Updated parameter heater-target-value2 to ', data.field);
                global.configProxy.heaters[1].pidParameters.sv = data.value;
                heaterControl.changeHeaterPidTarget(2, data.value)
                break;

            case 'target-sensor-selector1': 
                console.log('uiController: Updated parameter target-sensor-selector1 to ', data.field);
                global.configProxy.heaters[0].pidParameters.pvSensor = data.value;
                break;

            case 'target-sensor-selector2': 
                console.log('uiController: Updated parameter target-sensor-selector2 to ', data.field);
                global.configProxy.heaters[1].pidParameters.pvSensor = data.value;
                break;

            case 'heater-limit-value1': 
                console.log('uiController: Updated parameter heater-limit-value1 to ', data.field);
                global.configProxy.heaters[0].pidParameters.limitValue = data.value;
                break;

            case 'heater-limit-value2': 
                console.log('uiController: Updated parameter heater-limit-value2 to ', data);
                global.configProxy.heaters[1].pidParameters.limitValue = data.value;
                break;

            case 'limit-sensor-selector1': 
                console.log('uiController: Updated parameter limit-sensor-selector1 to ', data.field);
                global.configProxy.heaters[0].pidParameters.limitSensor = data.value;
                break;

            case 'limit-sensor-selector2': 
                console.log('uiController: Updated parameter limit-sensor-selector2 to ', data.field);
                global.configProxy.heaters[1].pidParameters.limitSensor = data.value;
                break;

            case 'heater-power-value1': 
                console.log('uiController: Updated parameter heater-power-value1 to ', data.field);
                global.configProxy.heaters[0].powerParameters.outputPower = data.value;
                break;

            case 'heater-power-value2': 
                console.log('uiController: Updated parameter heater-power-value2 to ', data.field);
                global.configProxy.heaters[1].powerParameters.outputPower = data.value;
                break;

            case 'logging-filename': 
                console.log('uiController: Updated parameter logging-filename to ', data.field);
                global.configProxy.logging.filename = data.value;
                break;

            case 'logging-interval-selector': 
                console.log('uiController: Updated parameter logging-interval-selector to ', data.field);
                global.configProxy.logging.interval = data.value;
                break;
        }
    };



    // Handles sensor label changes
    var sensorLabelChange = function (message) {
        var sensorControl = require('./sensorController.js');

        console.log('uiController: Sensor label change for : ', message);
        console.log('uiController: New label : ', message.label);

        // Get the current object for this sensor from the sensors array.
        var currentSensor = global.configProxy.sensors.find(function (sensor) { return sensor.sensorid === message.sensor; });

        // Replace the label value.
        currentSensor.label = message.label;

        // Update the label in teh session sensors data.  
        sensorControl.updateSensorLabel(message.sensor, message.label);
    };


    // Handles power switch changes.  Power switches control heaters and logging. 
    // These are handled separate from other parameter changes because these have to be reflected out to all clients to update the <input ...> elements with a new state.  
    var powerSwitch = function(data) {
        console.log('uiController: Power switch change: ', data);

        switch (data.switch) {
            case 'power-switch-heater-1':
                global.configProxy.heaters[0].state = data.state==='checked'?'on':'off';
                break
            case 'power-switch-heater-2':
                global.configProxy.heaters[1].state = data.state==='checked'?'on':'off';
                break
            case 'logging-power':
                global.configProxy.logging.state = data.state==='checked'?'on':'off';
                break
        };
    };


    // Handles heater mode switch changes.  
    // These are handled separately because some internal state may need to be reset (e.g. PID controller)
    var heaterMode = function(data) {
        console.log('uiController: Heater mode change: ', data);
        switch (data.heater) {
            case 'heater-mode-switch1':
            global.configProxy.heaters[0].mode = data.mode;
            // Notify the heating controller that a change of mode occurred.  
            heaterControl.changeHeatingMode( 1 );
            break;

            case 'heater-mode-switch2':
            global.configProxy.heaters[1].mode = data.mode;            
            // Notify the heating controller that a change of mode occurred.  
            heaterControl.changeHeatingMode( 2 );
            break;
        }
    };    


    var uiClientConnects = function (client) {
        var sensorControl = require('./sensorController.js');
        console.log('uiController: Client connected...');
        // Render the sensors
        // console.log('Inside uiController config: ', config);
        // io.emit('renderSensors', JSON.stringify({sensors: global.configProxy.sensors, config: global.configProxy}));
        uiController.renderSensors();

        // Used in development only.  
        // blinkHeaterPowerIndicators(client);

        // Fully handshake the client connecting.  Not neccessary, but useful for debug.  
        client.on('join', function(data) {
            console.log('uiController: ', data);
        });
    
        // Setup handler for parameter change messages from the client.  
        client.on('paramChange', paramChange);
    
        // Setup handler for power switch change events on the UI.  
        // The power switches control heaters and logging.  
        client.on('powerSwitch', powerSwitch);
        
        // Setup handler for heater mode changes on the UI.  
        // This is related to teh slider switches that switch between PI and Constant Power modes.  
        client.on('heaterMode', heaterMode);    

        // Setup handler for heater label changes on the UI.  
        client.on('sensorLabelChange', sensorLabelChange);    

        // Send current parameters to the UI to be displayed. 
        initParams();
    };
   

    // When starting up, initialize the parameter values on the UI.  
    var initParams = function () {
        console.log('uiController: Sending configuration to the UI: ');
        io.emit('initParams', JSON.stringify(global.configProxy));
    };

    return {
        init: function () {
            console.log('uiController: Initializing UI controller.');

            // Initialize Express HTTP server.
            console.log('uiController: uiController: initializing http and socket.io servers.');
            express = require('express');
            app = express();
            server = require('http').createServer(app);
            io = require('socket.io').listen(server);
            
            // Setup endpoints required by the UI and serve the homepage
            app.use(express.static(__dirname + '/node_modules'));
            app.use(express.static(__dirname + '/UI/'));
            app.get('/', function(req, res,next) {
                res.sendFile(__dirname + '/UI/index.html');
            });
            server.listen(3000);       

            io.on('connection', uiClientConnects);
        },


        // Update sensor display with new sensor value.  
        sensorUpdate: function (message) {
            // console.log('uiController: Updating sensor: ', message);
            io.emit('updateSensor', JSON.stringify(message));
       },

       // Re-render all sensors
       renderSensors: function () {
            var sensorControl = require('./sensorController.js');

//            console.log('uiController: Redering the sensors array ...', sensorControl.getSensors());
            io.emit('renderSensors', JSON.stringify({sensors: sensorControl.getSensors(), config: global.configProxy}));
       },

       // Control heater indicators in the UI.  
       setHeaterIndicator: function (heaterNum, state) {
            heaterTag = 'heater-power-indicator' + heaterNum;
            console.log('uiController: ', heaterTag + ' ' + state);
            io.emit('setParam', {value: heaterTag, state: state});
       },

       // Update the heater current temperature value.  
       updateHeaterCurrentTemp: function (heaterNum, tempValue) {
           console.log('uiController: updateHeaterCurrentTemp - ', heaterNum, ' ', tempValue);
           switch (heaterNum) {
            case 1:
                io.emit('setParam', {value: 'heater-current-value1', temp: tempValue});
                break;
            case 2:
                io.emit('setParam', {value: 'heater-current-value2', temp: tempValue});
                break;
     }
       }
    }
})();
// END UI CONTROLLER

module.exports = uiController;