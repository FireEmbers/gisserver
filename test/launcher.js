/*

Wrapper for deterministic fire spread algorithm in nodejs

Loads template file and replaces 'macro' strings  

*/
var Core = require('..');

var ROWS = 50;
var COLS = 50;

var MOISTUREPART = 11;
var WINDU = 1;
var WINDDIR = 135;

var dataUnit = [MOISTUREPART, WINDU, WINDDIR];

var slopeArray = new Array(ROWS*COLS);
var aspectArray = new Array(ROWS*COLS);

var runnerCounter = 2;

arrayFromGrassFileNode('./../InputMaps/malcataSlope_' + ROWS.toString() + '.grass', onSlopeArray);
arrayFromGrassFileNode('./../InputMaps/malcataAspect_' + ROWS.toString() + '.grass', onAspectArray);

function onSlopeArray(fileArray){
 
  slopeArray = fileArray;
  console.log('Slope Map is loaded in string "Run"');
  //print2D(slopeArray,'slopeMap.csv');  
  launchRunner();
}

function onAspectArray(fileArray){
 
  aspectArray = fileArray;
  console.log('Aspect Map is loaded in string "Run"');
  //print2D(aspectArray,'aspectMap.csv');
  launchRunner();
}  

function launchRunner(){

 --runnerCounter;

  if (runnerCounter > 0)
    return;

  stringFromFile('../build/program.min.js', onTemplateRead);

  function onTemplateRead(templateString){

    function Run(dataUnit){return Core(dataUnit, ROWS, COLS, aspectArray, slopeArray);}

    console.log(Run);
    var ts = Date.now();

    var ignitionMap = JSON.parse(Run(dataUnit));

    console.log(ROWS,COLS,(Date.now()-ts)/1000);

    //print2D(ignitionMap,'./../Verification/ignMapSlowFGMCaseAX'+ ROWS.toString()+'.csv');
    //console.log(ignitionMap);

  }

}

var array = new Array(ROWS * COLS);

function arrayFromGrassFileNode(fileName, cb) {

    /*
      Reads grass file and creates a numerical 1D array with data.
      ROWS AND COLS must be global vars.

      The array is an argument to the callback function
    */

    var fs = require('fs');

    fs.readFile (fileName, {encoding: 'utf8'}, 'r' ,onFileRead);

    function onFileRead(err,data){

      if (err) throw err;

      readGrassFileNode(data.toString());

      cb(array);
    }
}

function readGrassFileNode(data) {

  /*
    receives grass file data in string format and returns a float array
  */


  //removes grass file header
  var dataString = data.replace(/(.+?\n){6}/, '').match(/[\d.]+/g);

  for (var cell = 0; cell < COLS * ROWS; cell++)
    array[cell] = parseFloat(dataString[cell]);
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

function print2D(data, fileName) {
  var fs = require('fs');
  var util = require('util');
  var filename = fileName;
  var options = {
  flags: 'w',
  encoding: 'utf8',
  mode: 0666
  };
  var stream = fs.createWriteStream(filename, options);
  var row, line;

  for (i=0; i<ROWS; ++i) {
    row = data.splice(0, COLS);
    row.unshift(new Array(COLS+1).join(' %s').slice(1)+'\n');
    line = util.format.apply(util, row);
    stream.write(line);
  }
  stream.end();
}


