var jsonfile = require('jsonfile');

// START CONFIGURATION CONTROLLER
    /*
        Configuration object:
            {
	            “heaters”: [ { … },  { … }],
	            ”sensors”: [{ … },  { … }],
	            ”logging”: { … }
	        }
        
        Heater object:
            {
                “state”: “on”,                          // (on/off)  Is this heater in use.  Whether it’s on or off at a given moment is not tracked with this parameter.  
                “mode”: “temp”,                         // (temp/power)
                “listPosition”: 1,                      // (where in the heater list this sensor is displayed)
                “heaterLabel”: “Boiler 1”,
                “units”: “F”,                           // (C/F)
                “pidParameters”: {
                    “pvSensor”:  “28-0517c14a42ff”,     // (Device ID)
                    “sv”: 168,
                    ”limitSensor”: “28-0517c14a42ff”,   // (Device ID)
                    “limitValue”: 200
                },
                “powerParameters”: {
                    “outputPower”: 75                            // (0% - 100%)
                }
            }
        Sensor object:
            {
                “sensorid”: “28-0517c14a42ff”,          // (read out of device)
                “sensorLabel”: ‘Boiler temp”,
                “listPosition”:  1,                     // (where in the sensor list this sensor is displayed)
                “units”:  “F”                           // (C/F)
            }
        Logging object:
            {
                ”state”: “off”,
                “filename”: “1/1/2018-Corn Whiskey Run”,
                “interval”: 1                          // seconds
            }
    */


// Values assigned here are the default values.  If a config file exists, these values are over-written with the file contents.
global.config = {};


// Based on this example:
//      https://botproxy.net/docs/how-to/how-to-use-javascript-proxy-for-nested-objects/
let configProxyHandler = {
    get(target, key) {
        // console.log('Access config: ', key, '  ', target);
        if (typeof target[key] === 'object' && target[key] !== null) {
            return new Proxy(target[key], configProxyHandler)
        } else {
            return target[key];
        }
    },
    set (target, key, value) {
        // Update the target data.  
        target[key] = value;

        // Save config to permanent storage
        saveConfig();

        return true
    }
  }

global.configProxy = new Proxy(config, configProxyHandler);



var readConfig = function () {

    global.config = jsonfile.readFileSync('./configuration/config.json');
};

var saveConfig = function () {
    
    console.log('Saving config');
    // console.log('Saving config: ', global.config);
    jsonfile.writeFile('./configuration/config.json', global.config, function (err) {
        if (err === null) {
            console.error('Saving config succeeded.');
        } else {
            console.error('Saving config failed: ', err);
        }
    });
};



var configController = (function () {

    return {
        init: function () {
            console.log('Initializing configController');

            // Check if a configuration file exists
            var fs = require('fs');
            if (fs.existsSync('./configuration/config.json')) {
                console.log('Configuration file exists.');
                readConfig();
                configProxy = new Proxy(config, configProxyHandler);
            } else {
                console.log('Configuration file DOES NOT exist.');
                // Initialize the configuration object with default values.  
                config = {
                    heaters: [
                        {
                            state: 'off',
                            mode: 'temp',
                            listPosition: 1,
                            heaterLabel: 'Boiler 1',
                            units: 'F',
                            pidParameters: {
                                pvSensor:  '',
                                sv: 140,
                                limitSensor: '',
                                limitValue: 180
                            },
                            powerParameters: {
                                outputPower: 50
                            }    
                        },
                        {
                            state: 'off',
                            mode: 'temp',
                            listPosition: 2,
                            heaterLabel: 'Boiler 2',
                            units: 'F',
                            pidParameters: {
                                pvSensor:  '',
                                sv: 168,
                                limitSensor: '',
                                limitValue: 180
                            },
                            powerParameters: {
                                outputPower: 50
                            }    
                        }
                    ],
                    sensors: [
            
                    ],
                    logging: {
                        state: 'off',
                        filename: 'filename',
                        interval: 5
                    }
                };
                console.log('config: ', config);
                configProxy = new Proxy(config, configProxyHandler);

                // Save the default configuration.  
                saveConfig();
            }
        },
    }
    module.exports = {configProxy};
})();

// END CONFIGURATION CONTROLLER

module.exports = {configProxy, configController};
