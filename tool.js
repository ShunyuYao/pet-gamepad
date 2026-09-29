'use strict';
// No device polling or live input stream runs in this utilityProcess.
module.exports=require('./src/plugin').createPlugin();
