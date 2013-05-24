/*

Wrapper for deterministic fire spread algorithm in nodejs

Loads template file and replaces 'macro' strings  

callback with ignition time array, where cell time is in the format XXX.XX [min]

constTerrain object is set to NULL if testing malcata terrain, otherwise it contains {aspect, slope} 

*/

module.exports = function(ROWS, COLS, MOISTUREPART, WINDU, WINDDIR, callBack, constTerrain) {

  var Core = require('..');

  var dataUnit = [MOISTUREPART, WINDU, WINDDIR];

  var slopeArray = new Array(ROWS*COLS);
  var aspectArray = new Array(ROWS*COLS);

  var runnerCounter = 2;

  //launch FGM with real terrain, otherwise use constant terrain
  if (constTerrain === null) {

    arrayFromGrassFileNode('./InputMaps/malcataSlope_' + ROWS.toString() + '.grass', onSlopeArray);
    arrayFromGrassFileNode('./InputMaps/malcataAspect_' + ROWS.toString() + '.grass', onAspectArray);

  }
  else{

    for (var cell = 0; cell < ROWS*COLS; cell++){
      aspectArray[cell] = constTerrain[0];
      slopeArray[cell] = constTerrain[1];
    }

    runnerCounter = 0;
    launchRunner();    

  }


  function onSlopeArray(fileArray){
   
    slopeArray = fileArray;
    //console.log('Slope Map is loaded in string "Run"');
    launchRunner();
  }

  function onAspectArray(fileArray){
   
    aspectArray = fileArray;
    //console.log('Aspect Map is loaded in string "Run"');
    //print2D(aspectArray, 'aspectMap.csv');
    launchRunner();
  }  

  function launchRunner(){

   --runnerCounter;

    if (runnerCounter > 0)
      return;

    function Run(dataUnit){return Core(dataUnit, ROWS, COLS, aspectArray, slopeArray);}

    var ts = Date.now();

    var ignitionMap = JSON.parse(Run(dataUnit));

    //console.log(ROWS,COLS,(Date.now()-ts)/1000);

    print2D(ignitionMap, 'ignMapFGM'+ ROWS.toString()+'.csv');

    callBack(ignitionMap);
  }

  function arrayFromGrassFileNode(fileName, cb, dp) {

      /*
        Reads grass file and creates a numerical 1D array with data.
        ROWS AND COLS must be global vars.

        The array is an argument to the callback function

        dp stands for decimal places
      */

      var fs = require('fs');

      fs.readFile (fileName, {encoding: 'utf8'}, 'r' ,onFileRead);

      function onFileRead(err,data){

        if (err) throw err;

        var array = readGrassFileNode(data.toString());

        cb(array);
      }
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

  function arrayFromGrassFileAjax(fileName, cb) {

      /*
        Reads grass file and creates a numerical 1D array with data.
        ROWS AND COLS must be global vars.

        The array is an argument to the callback function
      */

      var array = new Array(ROWS * COLS);

      var req = new XMLHttpRequest();

      req.onreadystatechange = onreadystatechange;

      req.open('GET', fileName);

      req.send();

      function onreadystatechange() {

        if (req.readyState !== 4)
          return;

        array = readGrassFileAjax(req.responseText);

        cb(array);
      }
  }

  function readGrassFileAjax(data) {

    /*
      receives grass file data in string format and returns a float array
    */

    var dataMap = [];

    //removes grass file header
    var dataString = data.replace(/(.+?\n){6}/, '').match(/[\d.]+/g);

    for (var cell = 0; cell < COLS * ROWS; cell++)
      dataMap[cell] = parseFloat(dataString[cell]);

    return dataMap;
  }

  function stringFromFile(fileName, cb) {

      /*
        Loads generic file and uses string in the callback 
      */

      var fs = require('fs');

      fs.readFile (fileName, {encoding: 'utf8'}, 'r' ,onFileRead);

      function onFileRead(err,data){

        if (err) throw err;

        cb(data);
      }
  }

  //Print map in 2d matrix, doesn't fuck with the data
  function print2D(data, filename) {
    var fs = require('fs');
    var util = require('util');

    var options = {
      flags: 'w',
      encoding: 'utf8',
      mode: 0666
    };

    var s = fs.createWriteStream(filename, options);

    var row, line, i = 0, flushed;

    function writeRow() {
      if (i++ === ROWS)
        return s.end();

      row = data.slice(COLS*(i-1), COLS*i);
      row.unshift(new Array(COLS+1).join(' %s').slice(1)+'\n');
      line = util.format.apply(util, row);

      flushed = s.write(line);

      if (flushed) process.nextTick(writeRow);
      else s.once('drain', writeRow);
    }

    writeRow();
  }
};


