/*
  Reads grass file and creates a numerical 1D array with data.
  ROWS AND COLS must be global vars.

  The array is an argument to the callback function

*/

module.exports = function (fileName, ROWS, COLS, cb) {

  var fs = require('fs');

  fs.readFile (fileName, {encoding: 'utf8'}, 'r' ,onFileRead);

  function onFileRead(err,data){

    if (err) throw err;

    var array = readGrassFileNode(data.toString());

    cb(array);
  }

  function readGrassFileNode(data) {

    /*
      receives grass file data in string format and returns a float array
    */


    //removes grass file header
    var dataString = data.replace(/(.+?\n){6}/, '').match(/[\d.]+/g);

    var array = Array(COLS*ROWS);

    for (var cell = 0; cell < COLS * ROWS; cell++)
      array[cell] = parseFloat(dataString[cell]);

    return array;
  }
};