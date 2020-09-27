var socket = io.connect({'forceNew': true});



// This section implements the condensor controls
var addCondenserControls = function(settings){
    console.log("Adding condenser controls: ", settings);
    //  Add the condenser controls outer container and reduce the size of the temperature sensor container.  
    $('.' + 'condenser-container').css('display', '');
    $('.' + 'sensor-outer-container').css('grid-row-end', 3);
    $('.' + 'sidebar').css('grid-row-end', 3);

    // Setup the condenser controls based on the parameters given from the controller.  
    condenserControlSetup( 'dephleg', settings);
    condenserControlSetup( 'product', settings);
};
const condenserControlSetup = function (condenser, settings) {
    // Power switch
    $('#condenser-' + condenser + '-power').prop("checked", settings[condenser].state==='on');
    // Mode switch
    condensorModeChange(condenser, settings[condenser].mode);
    // Valve slider & Text Input
    if (settings[condenser].mode === 'manual') {
        valveSettingChange(condenser, settings[condenser].valveSetting);
    }
    // Target temperature
    $('#' + condenser + '-target-value').val(settings[condenser].targetTemp);
    console.log("condenserControlSetup settings[condenser].mode= ", settings[condenser].mode);

    // Enable/disable controls based on power state
    //Mode slider
    $('#' + condenser + '-mode-switch-outer-container').css('display', settings[condenser].state==='on'?'':'none');
    // Valve slider and text input
    $('#' + condenser + '-slider-container').css('display', settings[condenser].state==='on'?'':'none');
    // Current Temperature
    $('#' + condenser + '-current-container').css('display', settings[condenser].state==='on'?'':'none');
    // Target Temperature
    $('#' + condenser + '-target-value-container').css('display', (settings[condenser].state==='on' && settings[condenser].mode==='auto')?'':'none');
};
var deleteCondenserControls = function(){
    $('.' + 'condenser-container').css('display', 'none');
    $('.' + 'sensor-outer-container').css('grid-row-end', 5);
    $('.' + 'sidebar').css('grid-row-end', 5);
};
// Catch both condenser power switch changes.  
$(document).on('change', '#condenser-dephleg-power, #condenser-product-power', function() {
    console.log("Condensor power switch change.  Condenser: ", this.id.split("-")[0], ", state: ", this.checked?'On':'Off');
    var condenser = this.id.split("-")[1];
    var state = this.checked?'on':'off';
    // condensorPowerChange(condenser, state);

    //  Transmit the change to other UI clients
    var condenserMessage = {'action': 'update', 'field': 'condenser', 'value': {'condenser': condenser, 'param': 'power', 'value': state}}
    socket.emit('paramChange', condenserMessage);
});

// Catch both mode switch changes.  
$(document).on('change', '#dephleg-mode-switch, #product-mode-switch', function() {
    console.log("Condensor mode switch change.  id: ", this.id.split("-")[0], ", mode: ", this.checked?'auto':'manual');
    var condenser = this.id.split("-")[0];
    var state = this.checked?'auto':'manual';
    condensorModeChange(condenser, state);

    //  Transmit the change to other UI clients
    var condenserMessage = {'action': 'update', 'field': 'condenser', 'value': {'condenser': condenser, 'param': 'mode', 'value': state}}
    socket.emit('paramChange', condenserMessage);
});
var condensorModeChange = function(condenser, state) {

    //  Set the state of the slider switch.  This is needed for remote UI changes and redundent for local UI changes.  
    var condenserSliderId = '#' + condenser + '-mode-switch';
    // console.log("Remote UI mode chcnge.  Changing local slider state: condenser: ", condenser, ", state: ", state, ", id = ", condenserSliderId, ", logical: ", state==='auto')
    $(condenserSliderId).prop( "checked", state==='auto');

    // Set display state of text field and slider 
    switch (state) {
        case 'manual':
            console.log("manual mode.");
            $('#' + condenser + '-open-value').prop('disabled', false);
            $('#' + condenser + '-open-value').css('color', '');
            $('#' + condenser + '-condenser-slider').prop('disabled', false);
            $('#' + condenser + '-target-value-container').css('display', 'none');
            break;

        case 'auto':
            console.log("auto mode.");
            $('#' + condenser + '-open-value').prop('disabled', true);
            $('#' + condenser + '-open-value').css('color', 'black');
            $('#' + condenser + '-condenser-slider').prop('disabled', true);
            $('#' + condenser + '-target-value-container').css('display', '');
            break;

        default:
            console.log("ERROR: Invalid condensor mode passed to function condensorModeChange: ", state);
            break;
    };
};

// This function fires when the Product valve slider "slides"
$(document).on('input', '#product-condenser-slider', function() {
    $('#product-open-value').val( $(this).val() );
    // var condenserMessage = {'field': 'condenser', 'value': {'condenser': 'product', 'param': 'valveSetting', 'value': $(this).val().toString()}}
    // socket.emit('paramChange', condenserMessage);
});
$(document).on('change', '#product-condenser-slider, #product-open-value', function() {
    // $('#product-open-value').val( $(this).val() );
    valveSettingChange(this.id, $(this).val());
    var condenserMessage = {'action': 'update', 'field': 'condenser', 'value': {'condenser': 'product', 'param': 'valveSetting', 'value': $(this).val().toString()}}
    socket.emit('paramChange', condenserMessage);
});
// This function fires when the Dephleg valve slider "slides"
$(document).on('input', '#dephleg-condenser-slider', function() {
    $('#dephleg-open-value').val( $(this).val() );
    // var condenserMessage = {'field': 'condenser', 'value': {'condenser': 'dephleg', 'param': 'valveSetting', 'value': $(this).val().toString()}}
    // socket.emit('paramChange', condenserMessage);
});
$(document).on('change', '#dephleg-condenser-slider, #dephleg-open-value', function() {
    valveSettingChange(this.id, $(this).val());
    var condenserMessage = {'action': 'update', 'field': 'condenser', 'value': {'condenser': 'dephleg', 'param': 'valveSetting', 'value': $(this).val().toString()}}
    socket.emit('paramChange', condenserMessage);
});
var valveSettingChange = function(id, setting) {
    console.log("Valve setting change.  id: ", id, ", setting: ", setting);

    //  Update text value
    $('#' + id + '-open-value').val( setting );
    //  Update slider  value
    $('#' + id + '-condenser-slider').val( setting );
};
//  This function fires when the target temperature text is updated.  
$(document).on('change', '#product-target-value, #dephleg-target-value', function() {
    var condenser = this.id.split("-")[0];
    var condenserMessage = {'action': 'update', 'field': 'condenser', 'value': {'condenser': condenser, 'param': 'targetTemp', 'value': $(this).val().toString()}}
    socket.emit('paramChange', condenserMessage);
});

// UI updates from other UI clients.  
socket.on('condenser', (params) => {
    // console.log("Updating condenser controls: ", params);

    //  Incoming message format:
    // {
    //     "action": "add"                    //  String: "add", "delete", "update".  Add & delete are to announce and concenser controller and for when the controller disappears.  Update is to update parameters.  
    //     “field”:  “condenser”
    //     “value”:
    //         {
    //             “condenser”: “product”     //  String: “product”, “dephleg”
    //             “param”: “mode”           //  String: “power”, “mode”, “valveSetting”, “targetTemp”
    //             “value”: “auto”               // String (needs to be converted to Integer if appropriate for the parameter
    //         }
    // }

    console.log("Sockets condenser message received: ", params);

    var action = params.action;
    var condenser = params.value.condenser;
    var uiElement = params.value.param;
    var value = params.value.value;
    var units = params.value.units;

    switch (action) {
        case 'add':
            console.log("Condenser Add action received: ", params);
            addCondenserControls(params.value);
            break;

        case 'delete':
            console.log("Condenser Delete action received: ", params);
            deleteCondenserControls();
            break;

        case 'update':
            switch (uiElement) {
                case 'power':
                    console.log("Remote UI update: ", condenser, " Power Switch to ", value);
                    //  Set the state of the slider switch.  This is needed for remote UI changes and redundent for local UI changes.  
                    var condenserPowerId = '#condenser-' + condenser + '-power';
                    var powerState = params.value.value;
                    // console.log("Remote UI mode chcnge.  Changing local slider state: condenser: ", condenser, ", state: ", state, ", id = ", condenserSliderId, ", logical: ", state==='auto')
                    $(condenserPowerId).prop( "checked", powerState==='on');
                    break;

                case 'mode':
                    console.log("Remote UI update: ", condenser, " Mode to ", value);
                    condensorModeChange(condenser, value);
                    break;

                case 'valveSetting':
                    console.log("Remote UI update: ", condenser, " Valve Setting to ", value);
                    valveSettingChange(condenser, parseInt(value));
                    break;

                case 'targetTemp':
                    var newTemp = (units==='C'?cToF(parseFloat(value)):parseFloat(value)).toFixed(1);
                    console.log("Remote UI update: ", condenser, " Target Temperature to ", value);
                    $('#' + condenser + '-target-value').val(value);
                    break;

                case 'tempUpdate':
                    var units = params.value.units;
                    var newTemp = (units==='C'?cToF(parseFloat(value)):parseFloat(value)).toFixed(1);
                    var previousTemp = parseFloat($('#' + condenser + '-current-value').text());
                
                    if(newTemp > previousTemp) {
                        $('#' + condenser + '-current-value').css('color', 'red');
                    } else if(newTemp < previousTemp) {
                        $('#' + condenser + '-current-value').css('color', 'blue');
                    } else {
                        $('#' + condenser + '-current-value').css('color', 'black');
                    }
                
                    console.log("Remote UI update: ", condenser, " Current Temperature to ", newTemp);
                    $('#' + condenser + '-current-value').text(newTemp);
                    break;
            }
            break; // end of update action
    }
});




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

// //  This function fires when one of the buttons to move a sensor is pressed.  
// $('.sensor-position-change-button').click( function() {
//     console.log('Sensor position change: ', this.id);
//     console.log('Sensor position change: ', this.id.split('-'));
//     message = {'sensor': this.id, 'direction': this.id.split('-')[2]};
//     socket.emit('heaterMode', message);
// });

socket.on('setParam', (data) => {
    console.log('Setting parameter ' + data.value + ' to ' + data.state);
    switch(data.value) {
        // case 'heater-power-indicator1':
        // case 'heater-power-indicator2':
        //     if(data.state === 'on') {
        //         $('#' + data.value).css('background-color', 'green');
        //     }
        //     else {
        //         $('#' + data.value).css('background-color', 'black');
        //     }
        //     break;

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


//  This function is used by the sidebar sensor element's checkbox to add/remove sensors from the main sensor view.  
var sensorAddDeleteFromView = function (sensorID, sensorLabel) {
    console.log("Checkbox sensor: ", sensorID, " ", sensorLabel);

    checkboxElement = $(".sensor-checkbox").filter("#" + sensorID);
    console.log("Checkbox:", checkboxElement.is(':checked'));

    if (checkboxElement.is(':checked')) {
        if ($('.sensor-outer-container').find('#' + sensorID).length === 0 ) {
            $('.sensor-outer-container').append(
                '<div class="sensor" id="' + sensorID + '-view">'
                    + '<div class="sensor-value-div"><span class="nobr"><span class="sensor-value' + '" id="' + sensorID + '"> -- </span> &deg;F:  '
                    +   '<input class="sensor-label-input" type="text" id="' + sensorID + '" value="' + sensorLabel + '"></span></div>'
                + '</div>'
            );
        }
    } else {
        console.log("Removing: ", $('.sensor-outer-container').find(".sensor").filter('#' + sensorID + '-view'));
        $('.sensor-outer-container').find(".sensor").filter('#' + sensorID + '-view').remove();
    }
}

// Get current sensors from Master and render them to the UI.  
socket.on('renderSensors', (parms) => {
    var idSelector;

    var parameters = JSON.parse(parms);
    // console.log('Render sensors: ', parms);
    console.log('Render sensors: ');

    console.log('renderSensors sensors array: ', parameters.sensors);
    console.log('renderSensors config: ', parameters.config);
    
    // Add new sensor to list if it's not already there.  
    parameters.sensors.forEach( (sensor, index) => {

        console.log("Looking for " + sensor.sensorid + ":", $('.sidebar').find('#' + sensor.sensorid).length);
        if ($('.sidebar').find('#' + sensor.sensorid).length === 0 ) {
            var newTemp = (sensor.units==='C'?cToF(parseFloat(sensor.value)):parseFloat(sensor.value)).toFixed(1);
            $('.sidebar').append(
                '<div class="sensor" id="' + sensor.sensorid + '-container">'
                    + '<div class="sensor-value-div"><span class="nobr"><input type="checkbox" class="sensor-checkbox" id="' + sensor.sensorid + '" value="' + sensor.label + '" onclick="sensorAddDeleteFromView(this.id, this.value)"><span class="sensor-value' + '" id="' + sensor.sensorid + '">' + newTemp + '</span> &deg;F:  '
                    +   '<input class="sensor-label-input" type="text" id="' + sensor.sensorid + '" value="' + sensor.label + '"></span></div>'
                + '</div>'
            );
             //  By default,  add new sensor to watched sensor container too.  
            $('.sensor-outer-container').append(
                '<div class="sensor" id="' + sensor.sensorid + '-view">'
                    + '<div class="sensor-value-div"><span class="nobr"><span class="sensor-value' + '" id="' + sensor.sensorid + '">' + newTemp + '</span> &deg;F:  '
                    +   '<input class="sensor-label-input" type="text" spellcheck="false" id="' + sensor.sensorid + '" value="' + sensor.label + '"></span></div>'
                + '</div>'
            );

            // Check the corresponding checkbox in the sidebar
            $(".sensor-checkbox").filter("#" + sensor.sensorid).prop('checked', true);

            idSelector = '#sensor-value' + index;
            $(idSelector).css("color", "black");

            //  Add the sensor to the selector pulldown lists (e.g. PID target sensor).  
            $('#target-sensor-selector1').append($("<option></option>")
            .attr("value",sensor.sensorid)
            .text(sensor.label)); 

            // $('#limit-sensor-selector1').append($("<option></option>")
            // .attr("value",sensor.sensorid)
            // .text(sensor.label)); 

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
    // $('#limit-sensor-selector1').val(parameters.config.heaters[0].pidParameters.limitSensor);
    // $('#limit-sensor-selector2').val(parameters.config.heaters[1].pidParameters.limitSensor);
});


// Update the displayed value for a particular sensor.  
// Text is black if initial or no change.  Text is red if temperature went up since last update, text is blue if temperature went down.  
socket.on('updateSensor', function(message) {
    message = JSON.parse(message);
    console.log('Sensor update: ', message);

    var previousTemp = parseFloat($('.sensor-value').filter('#' + message.sensorid).text());
    var newTemp = (message.units==='C'?cToF(parseFloat(message.value)):parseFloat(message.value)).toFixed(1);
    console.log('Temp convert: ', message.value, message.units, newTemp);
    console.log('Sensor text: ', $('.sensor-value').filter('#'+message.sensorid).text(newTemp));

    if(newTemp > previousTemp) {
        $('.sensor-value').filter('#' + message.sensorid).css('color', 'red');
    } else if(newTemp < previousTemp) {
        $('.sensor-value').filter('#' + message.sensorid).css('color', 'blue');
    } else {
        $('.sensor-value').filter('#' + message.sensorid).css('color', 'black');
    }
});


// Remove a sensor from the sensors lists.  
socket.on('removeSensor', (params) => {
    params = JSON.parse(params);

    console.log("Removing sensor with id ", params, $('#' + params.sensorid + '-container'));
    $('#' + params.sensorid + '-container').remove();
    $('#' + params.sensorid + '-view').remove();
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
    // $('#limit-sensor-selector1').val(message.heaters[0].pidParameters.limitSensor);
    // $('#limit-sensor-selector2').val(message.heaters[1].pidParameters.limitSensor);
    // $('#heater-limit-value1').val(message.heaters[0].pidParameters.limitValue);
    // $('#heater-limit-value2').val(message.heaters[1].pidParameters.limitValue);
    $('#heater-power-value1').val(message.heaters[0].powerParameters.outputPower);
    $('#heater-power-value2').val(message.heaters[1].powerParameters.outputPower);
    
    // Sensors

    // Logging
    // $('#logging-power').prop( "checked", message.logging.state==='on');
    // console.log('Setting logging filename to: ', message);
    // $('#logging-filename').val(message.logging.filename);
    // $('#logging-interval-selector').val(message.logging.interval);
});


socket.on('connect', function(data) {
    console.log('Connected to host.');
    deleteCondenserControls();
});