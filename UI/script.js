
var socket = io.connect({'forceNew': true});

// Startup Dragula for sensor dragging.  
dragula([document.getElementById('sensors')])
.on("drop", function(el, target, source, sibling) {
    console.log("Dragula: element moved.", el, target, source, sibling);
});

// Sensor side menu code 
// https://codepen.io/kanchala-k/pen/MoJOMJ
$('.sidebarBtn').click(function(){
    $('.sidebar').toggleClass('active');
    $('.sidebarBtn').toggleClass('toggle');
});



// This function fires when any of the input fields are changed.  
// The id of the element is used to identify to the host node application which field changed.
$('.input-value').change(function() {
    console.log('Value change: ', this.value);
    console.log('Value change: ', this.id);
    message = {'field': this.id, 'value':this.value}
    socket.emit('paramChange', message);
});

// This function fires when one of the 3 'power' switches are pressed.  
// The following is an example message sent by this function:
//      { switch: 'power-switch-heater-1', state: 'checked' } 
$('.power-switch').click( function() {
    console.log('Powerswitch change.');
    socket.emit('powerSwitch', {'switch': this.id, 'state': $(this).is(':checked')?'checked':'unchecked'});
});

// This function fires when one of the heater mode switches are changed from PID to Constant Power or vice versa
// The PI and Power UI's are each in their own container.  
// The UI is switched between PID and Power by enabling and disabling these containers such that only one is enabled at a given moment.  
// The id's of the mode switches are:
//      heater-mode-switch1
//      heater-mode-switch2
// The last character is extracted from the switch id and used to enable/disable the corresponding UI containers
//      pid-heater1-container
//      power-heater1-container
//      pid-heater2-container
//      power-heater2-container
// Here's a sample message sent by this function:
//      { heater: 'heater-mode-switch1', mode: 'pid' }
$('.mode-switch').click( function() {
    heaterNumber = this.id.slice(-1);
    $('#pid-heater' + heaterNumber + '-container').css('display', $(this).is(':checked')?'':'none');
    $('#power-heater' + heaterNumber + '-container').css('display', $(this).is(':checked')?'none':'');
    socket.emit('heaterMode', {'heater': this.id, 'mode': $(this).is(':checked')?'temp':'power'});
});

//  This function fires when one of the buttons to move a sensor is pressed.  
$('.sensor-position-change-button').click( function() {
    console.log('Sensor position change: ', this.id);
    console.log('Sensor position change: ', this.id.split('-'));
    message = {'sensor': this.id, 'direction': this.id.split('-')[2]};
    socket.emit('heaterMode', message);
});

socket.on('setParam', (data) => {
    console.log('Setting parameter ' + data.value + ' to ' + data.state);
    switch(data.value) {
        case 'heater-power-indicator1':
        case 'heater-power-indicator2':
            if(data.state === 'on') {
                $('#' + data.value).css('background-color', 'green');
            }
            else {
                $('#' + data.value).css('background-color', 'black');
            }
            break;

        case 'heater-current-value1':
        case 'heater-current-value2':
        console.log('Update heater current temp to: ', data);
            $('#' + data.value).text(data.temp);
            break;
    };
});


//  This function is fired when a sensor label is changed.  The "onchange" is embedded in the input tag when the sensor is added by the renderSensors function below.  
// var sensorLabelHandler = function(arg) {
$('#sensors').on('change', '.sensor-label-input', function() {   
    console.log('ID of changing sensor: ', this.id);
    console.log('New label: ', this.value);
    socket.emit('sensorLabelChange', {'sensor': this.id, 'label': this.value});
});

var cToF = function (temp) {
    return (temp * (9 / 5)) + 32;
  }

// Get current sensors from Master and render them to the UI.  
socket.on('renderSensors', (parms) => {
    var idSelector;

    var parameters = JSON.parse(parms);
    // console.log('Render sensors: ', parms);
    console.log('Render sensors: ');
    // Throw away the current sensor elements
    // $('#sensors').find('.sensor').remove();

    // Remove all sensor options from the sensor selectors.
    // $('#target-sensor-selector1').empty();
    // $('#limit-sensor-selector1').empty();
    // $('#target-sensor-selector2').empty();
    // $('#limit-sensor-selector2').empty();

    console.log('renderSensors sensors array: ', parameters.sensors);
    console.log('renderSensors config: ', parameters.config);
    
    // Add new sensor to list if it's not already there.  
    parameters.sensors.forEach( (sensor, index) => {

        console.log("Looking for " + sensor.sensorid + ":", $('.sidebar').find('#' + sensor.sensorid).length);
        if ($('.sidebar').find('#' + sensor.sensorid).length === 0 ) {
            var newTemp = (sensor.units==='C'?cToF(parseFloat(sensor.value)):parseFloat(sensor.value)).toFixed(1);
            $('.sidebar').append(
                '<div class="sensor">'
                    + '<div class="sensor-value-div"><nobr><span class="sensor-value' + '" id="' + sensor.sensorid + '">' + newTemp + '</span> &deg;F:  '
                    +   '<input class="sensor-label-input input-value" type="text" id="' + sensor.sensorid + '" value="' + sensor.label + '"></nobr></div>'
                + '</div>'
            );
            // //  Temporarily add new sensor to watched sensor container too.  
            // $('.sensor-outer-container').append(
            //     '<div class="sensor">'
            //         + '<div class="sensor-value-div"><nobr><span class="sensor-value' + '" id="' + sensor.sensorid + '">' + newTemp + '</span> &deg;F:  '
            //         +   '<input class="sensor-label-input input-value" type="text" id="' + sensor.sensorid + '" value="' + sensor.label + '"></nobr></div>'
            //     + '</div>'
            // );
            idSelector = '#sensor-value' + index;
            $(idSelector).css("color", "black");

            //  Add the sensor to the selector pulldown lists (e.g. PID target sensor).  
            $('#target-sensor-selector1').append($("<option></option>")
            .attr("value",sensor.sensorid)
            .text(sensor.label)); 

            $('#limit-sensor-selector1').append($("<option></option>")
            .attr("value",sensor.sensorid)
            .text(sensor.label)); 

            $('#target-sensor-selector2').append($("<option></option>")
            .attr("value",sensor.sensorid)
            .text(sensor.label)); 

            $('#limit-sensor-selector2').append($("<option></option>")
            .attr("value",sensor.sensorid)
            .text(sensor.label)); 
        };
    });

    // Select the sensor in the sensor selectors if the sensor is present.  
    $('#target-sensor-selector1').val(parameters.config.heaters[0].pidParameters.pvSensor);
    $('#target-sensor-selector2').val(parameters.config.heaters[1].pidParameters.pvSensor);
    $('#limit-sensor-selector1').val(parameters.config.heaters[0].pidParameters.limitSensor);
    $('#limit-sensor-selector2').val(parameters.config.heaters[1].pidParameters.limitSensor);
});


// Update the displayed value for a particular sensor.  
// Text is black if initial or no change.  Text is red if temperature went up since last update, text is blue if temperature went down.  
socket.on('updateSensor', function(message) {
    message = JSON.parse(message);
    console.log('Sensor update: ', message);

    var previousTemp = parseFloat($('.sensor-value').filter('#'+message.sensorid).text());
    var newTemp = (message.units==='C'?cToF(parseFloat(message.value)):parseFloat(message.value)).toFixed(1);
    console.log('Temp convert: ', message.value, message.units, newTemp);
    console.log('Sensor text: ', $('.sensor-value').filter('#'+message.sensorid).text(newTemp));

    if(newTemp > previousTemp) {
        $('.sensor-value').filter('#'+message.sensorid).css('color', 'red');
    } else if(newTemp < previousTemp) {
        $('.sensor-value').filter('#'+message.sensorid).css('color', 'blue');
    } else {
        $('.sensor-value').filter('#'+message.sensorid).css('color', 'black');
    }
});


//  Update all parameters using the stored configuration on Master.  
socket.on('initParams', function(message) {
    message = JSON.parse(message);
    console.log('Initialize UI parameters: ', message);

    // Heaters
    $('#power-switch-heater-1').prop( "checked", message.heaters[0].state==='on');
    $('#power-switch-heater-2').prop( "checked", message.heaters[1].state==='on');

    console.log('Setting heater 1 to mode: ', message.heaters[0].mode);
    $('#heater-mode-switch1').prop( "checked", message.heaters[0].mode==='temp');
    $('#pid-heater1-container').css('display', message.heaters[0].mode==='temp'?'':'none');
    $('#power-heater1-container').css('display', message.heaters[0].mode==='temp'?'none':'');

    console.log('Setting heater 2 to mode: ', message.heaters[1].mode);
    $('#heater-mode-switch2').prop( "checked", message.heaters[1].mode==='temp');
    $('#pid-heater2-container').css('display', message.heaters[1].mode==='temp'?'':'none');
    $('#power-heater2-container').css('display', message.heaters[1].mode==='temp'?'none':'');

    $('#heater-label1').val(message.heaters[0].heaterLabel);
    $('#heater-label2').val(message.heaters[1].heaterLabel);
    $('#target-sensor-selector1').val(message.heaters[0].pidParameters.pvSensor);
    $('#target-sensor-selector2').val(message.heaters[1].pidParameters.pvSensor);
    $('#heater-target-value1').val(message.heaters[0].pidParameters.sv);
    $('#heater-target-value2').val(message.heaters[1].pidParameters.sv);
    $('#limit-sensor-selector1').val(message.heaters[0].pidParameters.limitSensor);
    $('#limit-sensor-selector2').val(message.heaters[1].pidParameters.limitSensor);
    $('#heater-limit-value1').val(message.heaters[0].pidParameters.limitValue);
    $('#heater-limit-value2').val(message.heaters[1].pidParameters.limitValue);
    $('#heater-power-value1').val(message.heaters[0].powerParameters.outputPower);
    $('#heater-power-value2').val(message.heaters[1].powerParameters.outputPower);
    
    // Sensors

    // Logging
    $('#logging-power').prop( "checked", message.logging.state==='on');
    console.log('Setting logging filename to: ', message);
    $('#logging-filename').val(message.logging.filename);
    $('#logging-interval-selector').val(message.logging.interval);
});


socket.on('connect', function(data) {
    console.log('Connected to host.');
});