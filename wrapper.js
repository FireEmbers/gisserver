/*

Code wrap for cpFGM.js.

Launchs and times Run() locally

*/

var RunString = require('./cpFGM').toString();

//var fs = require('fs'); 

var ROWS = 100;
var COLS = 100;

var MOISTUREPART = 11;             
var WINDU = 1;          
var WINDDIR = 135; 

var dataUnit = [MOISTUREPART, WINDU, WINDDIR];

var slopeArray = new Array(ROWS*COLS);
var aspectArray = new Array(ROWS*COLS);

var runnerCounter = 2;

arrayFromGrassFile('./InputMaps/malcataSlope_' + ROWS.toString() + '.grass', onSlopeArray);
arrayFromGrassFile('./InputMaps/malcataAspect_' + ROWS.toString() + '.grass', onAspectArray);

function onSlopeArray(fileArray){
 
  slopeArray = fileArray;
  RunString = RunString.replace(/SLOPEMAP_PC/, JSON.stringify(slopeArray));
  //console.log('Slope Map is loaded in string "Run"');
  //print2D(slopeArray,'slopeMap.csv');  
  launchRunner();
}

function onAspectArray(fileArray){
 
  aspectArray = fileArray;
  RunString = RunString.replace(/ASPECTMAP_PC/, JSON.stringify(aspectArray));
  //console.log('Aspect Map is loaded in string "Run"');
  //print2D(aspectArray,'aspectMap.csv');
  launchRunner();
}  

function launchRunner(){

 --runnerCounter;

  if (runnerCounter > 0)
    return;

  RunString = RunString.replace(/ROWS_PC/,ROWS.toString());
  RunString = RunString.replace(/COLS_PC/,COLS.toString());  

  eval(RunString); 

  var ts = Date.now();

  var ignitionMap = JSON.parse(Run(dataUnit));

  console.log(ignitionMap);

  //print2D(ignitionMap,'ignitionMap.csv');

  console.log(ROWS,COLS,(Date.now()-ts)/1000);

}

var array = new Array(ROWS * COLS);

function arrayFromGrassFileNode(fileName, cb) {

    /*
      Reads grass file and creates a numerical 1D array with data.
      ROWS AND COLS must be global vars.

      The array is an argument to the callback function
    */

    fs.readFile (fileName, {encoding: 'utf8'}, 'r' ,onFileRead);

    function onFileRead(err,data){

      if (err) throw err;

      readGrassFile(data.toString());

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


function arrayFromGrassFile(fileName, cb) {

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

      array = readGrassFile(req.responseText);

      cb(array);
    }
}

function readGrassFile(data) {

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


