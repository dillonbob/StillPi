// START LOGGING CONTROLLER
var loggingController = (function () {
    var privateVariable;
    
    var privateMethod = function (param) {
      // console.log(this);
    };
  
  
    return {
      init: function () {
        console.log('Initializing logging controller.');
      },
    }
})();
// END LOGGING CONTROLLER

module.exports = loggingController;