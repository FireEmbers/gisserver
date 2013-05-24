//Progress bar vars have to be global
var progressbar = $("#progressbar");
var progressLabel = $(".progress-label");

var ROWS;
var COLS;

//O heatMap and  plotTime are globais variables
//read by SurfacePlot.js
var heatMap;
var plotTime = 0;

//vector with ignition time results
//computed from Monte Carlo samples
var agvIgnMap;

function launch() {

  var i, n;

  var numVar = 3; //Moisture, windSpeed, windDir 

  ROWS = parseInt(document.getElementById('resolution').value);
  COLS = parseInt(document.getElementById('resolution').value);

  var ignPointYY = parseInt(document.getElementById('ignPointYY').value);
  var ignPointXX = parseInt(document.getElementById('ignPointXX').value);

  var moisture = parseFloat(document.getElementById('moistureInput').value);
  var fuelLoad = parseFloat(document.getElementById('fuelLoad').value);
  var windDir = parseFloat(document.getElementById('windDir').value);

  var mcSamples = parseInt(document.getElementById('mcSamples').value);
  var windVelAvg = parseFloat(document.getElementById('windVelAvg').value);
  var windVelDev = parseFloat(document.getElementById('windVelDev').value);

  //Create data, results and visualization Array  
  var dataArray = new Array(mcSamples);
  var resultsIdx = 0;
  var resultsArray = new Array(mcSamples);
  agvIgnMap = new Array(ROWS * COLS);


  for (i = 0; i < mcSamples; i++) {

    dataArray[i] = new Array(numVar);
    resultsArray[i] = new Array(COLS * ROWS);

  }

  //Populate: |moiture|windSpeed|windDir|
  for (i = 0; i < mcSamples; i++) {
    dataArray[i][0] = moisture;
    dataArray[i][1] = gauss(windVelAvg, windVelDev/100*windVelAvg);
    dataArray[i][1] = (dataArray[i][1] >= 0 ? dataArray[i][1] : 0);
    console.log('mcSample,U:',i,dataArray[i][1]);
    dataArray[i][2] = windDir;
  }

  //storage for slope (entry 0) and aspect (entry 1)
  var terrainArray = [0, 0];

  //String variable that holds program.min.js
  var programString;

  //Read aspect and slope files and create arrays
  //ACHTUNG Esta porra e assincrona!
  var runnerCounter = 3;
  
  arrayFromGrassFile('InputMaps/malcataSlope_' + ROWS.toString() + '.grass', slopeCB);
  arrayFromGrassFile('InputMaps/malcataAspect_' + ROWS.toString() + '.grass', aspectCB);
  stringToFile('program.min.js', function(string){ programString = string; launchRunner();});


  function slopeCB(fileArray) {

    terrainArray[0] = fileArray;
    console.log('Slope Map is loaded in string "Run"');
    launchRunner();
  }

  function aspectCB(fileArray) {

    terrainArray[1] = fileArray;
    console.log('Aspect Map is loaded in string "Run"');
    launchRunner();
  }

  function launchRunner() {

    --runnerCounter;

    if (runnerCounter > 0)
      return;


    CrowdProcessConnect(function (jobs) {


      document.querySelector('#progress h2').innerHTML = 'Monte Carlo Sample Simulations: ' + mcSamples;

      hidesEl('input');
      showsEl('progress');

      function RunString(){

        function Run(dataUnit){ 
          
          var core = require(1);  

          return core(dataUnit, ROWS, COLS, terrainArray[1], terrainArray[0]);
        }

        var string = Run.toString() + ';' + programString + 
        'var ROWS =' + ROWS.toString() + ';' + 
        'var COLS =' + COLS.toString() + ';' + 
        'var terrainArray = [];' + 
        'terrainArray[0] =' + JSON.stringify(terrainArray[0]) + ';' + 
        'terrainArray[1] =' + JSON.stringify(terrainArray[1]) + ';';

        return string;

      }

      jobs.run(RunString(), 1, dataArray, onError, onProgress, onResult, onFinished);

      function onError(error) {
        console.error(error);
      }

      function onProgress(progress) {

        progressbar.progressbar("value", progress);
      }

      function onResult(result) {

        resultsArray[resultsIdx] = JSON.parse(result);

        ++resultsIdx;

        console.log('Arrived result #',resultsIdx);
      }

      function onFinished(realTime, jobTime) {
        //progressbar.progressbar("value", 100);

        document.getElementById('realTime').innerHTML = 
                  'Wall time: '+ Math.round(realTime/1000).toString()+' s';

        document.getElementById('cpTime').innerHTML = 
                  'Crowd Process time:'+Math.round(jobTime/1000).toString()+' s';

        document.getElementById('SP').innerHTML = 'SpeedUp:'+Math.round(jobTime/realTime).toString();


        document.getElementById('ppProg').innerHTML = 'Post Processing...';

        for (var i = 0; i < ROWS * COLS; i++)
          agvIgnMap[i] = 0;

        for (var n = 0; n < resultsIdx; n++) {
          for (var i = 0; i < ROWS * COLS; i++) {
            agvIgnMap[i] += resultsArray[n][i]/ resultsIdx;

          }
        }
        
        document.getElementById('ppProg').innerHTML = 'Post Processing...Done';

        showsEl('resultsButton');

        console.log('the job finished in', realTime, 'it happened in', jobTime);
      }

    });

    //Progress Bar function
    $(function () {

      progressbar.progressbar({
        value: false,
        change: function () {
          progressLabel.text(progressbar.progressbar("value") + "%");
        },
        complete: function () {
          // progressLabel.text( "Complete!" );
        }
      });
    });

  }
 

  function gauss(avg, sDev) {

    //returns random number with gaussian distribution
    //uses box Muller algorithm to compute normal 0-1 distribution

    var gaussNumber = avg + sDev * BoxMuller()[0];

    return gaussNumber;
  }

  function BoxMuller() {

    //Normal distribution mean 0, deviation 1
    //allways returns an array with 2 random numbers  

    var x = 0,
      y = 0,
      rds, c;

    // Get two random numbers from -1 to 1.
    // If the radius is zero or greater than 1, throw them out and pick two new ones
    // Rejection sampling throws away about 20% of the pairs.
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      rds = x * x + y * y;
    }
    while (rds === 0 || rds > 1);

    // This magic is the Box-Muller Transform
    c = Math.sqrt(-2 * Math.log(rds) / rds);

    // It always creates a pair of numbers. I'll return them in an array. 
    // This function is quite efficient so don't be afraid to throw one away if you don't need both.
    return [x * c, y * c];
  }

} //Launch


function visualize() {

  var surfacePlot;

  var slider = document.getElementById('slider1');
  var rangeValue = document.getElementById('rangeValue1');

  plotTime = slider.value;

  var heightMap = new Array(ROWS * COLS);
  heatMap = new Array(ROWS * COLS);

  showsEl('visualization');

  setUp();

  function setUp() {


    arrayFromGrassFile('/InputMaps/malcataHeight_' + ROWS.toString() + '.grass', onHeightMap);

    function onHeightMap(fileArray){

      heightMap = fileArray;

      //remove zero height in borders from grass height maps 
      if (ROWS > 100){
        for (var row = 0; row < ROWS; row++){
          //na fronteira oeste, vai buscar o valor a direira
          heightMap[row*COLS] = heightMap[row*COLS + 1]; 
          //na fronteira este, vai buscar o valor a esquerda
          heightMap[(row+1)*COLS-1] = heightMap[(row+1)*COLS-2]; 
        }
      }

      //Reinitialize heatMap (erases zeroes) 
      //had to be done, don't know why
      for (var cell = 0; cell < COLS * ROWS; cell++)
        heatMap[cell] = agvIgnMap[cell];

      //compute maximum element
      maxHeatMap = arrayMax(heatMap, COLS*ROWS); 

      //Initializes slide and rabgeValue text box
      slider.setAttribute('min',0);
      slider.setAttribute('max',maxHeatMap);
      slider.setAttribute('step',maxHeatMap/100);

      //Burned area limit
      for (var cell = 0; cell < COLS * ROWS; cell++) {
        if (heatMap[cell] > plotTime)
          heatMap[cell] = 0;
      }

      //printar o plot no ecran depois de carregar a Array
      plotZ();

    }

  }

  function plotZ() {
     

    var tooltipStrings = new Array();
    var values = new Array(ROWS);
    var data = { 
      nRows: ROWS,
      nCols: COLS,
      formattedValues: values
    };

    var idx = 0;

    for (var i = 0; i < ROWS; i++) {

      values[i] = new Array(COLS);

      for (var j = 0; j < COLS; j++) {
        values[i][j] = heightMap[j + i * COLS];
        tooltipStrings[idx] = "x:" + i + ", y:" + j + " = " + heatMap[j + i * COLS];
        idx++;
      }
    }

    var oldPlot1 = document.getElementById("surfacePlot1"); 
    
    if(oldPlot1) oldPlot1.remove();

    surfacePlot = new SurfacePlot(document.getElementById("surfacePlotDiv"));

    // Don't fill polygons in IE. It's too slow.
    var fillPly = true;

    // Define a colour gradient.
    var black = { 
      red: 0,
      green: 0,
      blue: 0
    };
    var white = {
      red: 255,
      green: 255,
      blue: 255
    };

    var lessWhite = {
      red: 255,
      green: 100,
      blue: 100
    };

    var lesserWhite = {
      red: 255,
      green: 20,
      blue: 20
    };

    var greenIsh = {
      red: 193,
      green: 265,
      blue: 167
    };
    var colour1 = {
      red: 0,
      green: 0,
      blue: 255
    };
    var colour2 = {
      red: 0,
      green: 255,
      blue: 255
    };
    var colour3 = {
      red: 0,
      green: 255,
      blue: 0
    };
    var colour4 = {
      red: 255,
      green: 255,
      blue: 0
    };
    var colour5 = {
      red: 255,
      green: 0,
      blue: 0
    };
    //var colours = [white, colour1, colour2, colour3, colour4, colour5];
    var colours = [greenIsh, colour5];
    //var colours = [ white, colour4, colour5]; 
    //var colours = [ white,  colour5 ];

    // Axis labels.
    var xAxisHeader = "X-axis";
    var yAxisHeader = "Y-axis";
    var zAxisHeader = "Z-axis";

    var renderDataPoints = false;
    var background = '#ffffff';
    var axisForeColour = '#ff0000';
    var hideFloorPolygons = true;
    var chartOrigin1 = {
      x: 350,
      y: 350
    };

    // Options for the basic canvas pliot.
    var basicPlotOptions = {
      fillPolygons: fillPly,
      tooltips: tooltipStrings,
      renderPoints: renderDataPoints
    };

    // Options for the webGL plot.
    var xLabels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    var yLabels = [0, 1, 2, 3, 4, 5];
    var zLabels = [0, 1, 2, 3, 4, 5, 6]; // These labels are used when autoCalcZScale is false;
    var glOptions = {
      xLabels: xLabels,
      yLabels: yLabels,
      zLabels: zLabels,
      chkControlId: "allowWebGL",
      autoCalcZScale: true
    };

    // Options plot 1
    var options = {
      left: 0,
      right: 0,
      width: 700,
      height: 700,
      colourGradient: colours,
      xTitle: xAxisHeader,
      yTitle: yAxisHeader,
      zTitle: zAxisHeader,
      backColour: background,
      axisTextColour: axisForeColour,
      hideFlatMinPolygons: hideFloorPolygons,
      origin: chartOrigin1
    };

    surfacePlot.draw(data, options, basicPlotOptions, glOptions);
  }


  function toggleChart(chkbox) {
    surfacePlot.redraw();
  }

}//Visualize

function updateRange(){

  var slider = document.getElementById('slider1');
  var rangeValue = document.getElementById('rangeValue1');

  rangeValue.setAttribute('value',formatFloat(slider.value, 0));

}

function showsEl(boxid) {
  document.getElementById(boxid).style.display = "initial";
}

function hidesEl(boxid) {
  document.getElementById(boxid).style.display = "none";
}

function formatFloat(x, c) { 

  var power = Math.pow(10, c); 

  return Math.round(power * x)/power; 
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

function stringToFile(fileName, cb) {

    /*
      reads file, uses string in callback

    */

    var req = new XMLHttpRequest();

    req.onreadystatechange = onreadystatechange;

    req.open('GET', fileName);

    req.send();

    function onreadystatechange() {

      if (req.readyState !== 4)
        return;

      cb(req.responseText);

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

function arrayMax(array, maxIdx){
  var max = 0;

  for (var i = 0; i < maxIdx; i++)
    max = (array[i] > max) ? array[i] : max;

  return max;
}
