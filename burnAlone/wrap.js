module.exports = function(ROWS, COLS, MOISTUREPART, WINDU, WINDDIR, callBack) {

  var Core = require('./../core/src/program');
  var write2D = require('./../utils/write2D');

  console.log(Core);
  var grassToArray = require('./../utils/grassToArray');
  

  var dataUnit = [MOISTUREPART, WINDU, WINDDIR];

  var slopeArray = new Array(ROWS*COLS);
  var aspectArray = new Array(ROWS*COLS);

  var runnerCounter = 2;

  //launch FGM with real terrain, otherwise use constant terrain
  grassToArray('./geresSlope_' + ROWS.toString() + '.grass', ROWS,COLS, onSlopeArray);
  grassToArray('./geresAspect_' + ROWS.toString() + '.grass',ROWS,COLS, onAspectArray);

  function onSlopeArray(fileArray){

    slopeArray = fileArray;
    console.log('Slope Map is loaded in string "Run"');
    write2D(slopeArray, ROWS, COLS, 'slope'+ ROWS.toString()+'.csv');
    launchRunner();
  }

  function onAspectArray(fileArray){

    aspectArray = fileArray;
    console.log('Aspect Map is loaded in string "Run"');
    write2D(aspectArray, ROWS, COLS, 'aspect'+ ROWS.toString()+'.csv');
    launchRunner();
  }

  function launchRunner(){

    --runnerCounter;

    if (runnerCounter > 0)
      return;


    function Run(dataUnit){return Core(dataUnit, ROWS, COLS, aspectArray, slopeArray);}

    var ts = Date.now();

    var ignitionMap = JSON.parse(Run(dataUnit));

    console.log(ROWS,COLS,(Date.now()-ts)/1000);

    callBack(ignitionMap);
  }

};


