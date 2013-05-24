
/*

Deterministic fire model based on firelib + a cellular automata 
fire growth model (FGM)

template fuction receives a three element array "dataArray" with moisture[%], wind speed [m/s]
and wind direction[º from north] 

.replace has to be used in a wrapper function to replace:
  SLOPEMAP_PC   - Slope Map array
  ASPECTMAP_PC  - Aspect Map Array
  ROWS_PC       - Number of Rows
  COLS_PC       - Number os Columnss

*/


//!!!ACHTUNG - Don't Fuck with the fuel model. 
// Choose either 'createFuelPropsCustom' or 'createFuelPropsNFFL1'

module.exports = function (dataArray, ROWS_PC, COLS_PC, ASPECTMAP_PC, SLOPEMAP_PC){

  var fireLib = require('./fireLib');
  //var fireLib = require('./slowFGM');

  var ROWS = ROWS_PC;
  var COLS = COLS_PC;
  var MOISTUREPART = dataArray[0]/100;             //fraction
  var WINDU = dataArray[1]*196.850393701;          // [m/s] - > ft/min (2.23 m/s = 5mph)
  var WINDDIR =dataArray[2];                       //degrees clockwise from north


  var L = metersToFeet(3000);                      //Terrain Length
  var W = metersToFeet(3000);                       //Terrain Width

  var CellWd = L/ROWS;
  var CellHt = W/COLS;

  var INF = 9999999999999;
  var smidgen = 1E-6;

  
  var nStencil = 16;

  var row, col, nrow, ncol;
  var cell;
  var cells = ROWS*COLS;
  var ncell;
  var dCell;
  
             //N   NE   E  SE  S  SW   W  NW   a   b   c   d   e  f   g  h 
  var nCol = [ 0,   1,  1,  1, 0, -1, -1, -1, -1,  1, -2,  2, -2, 2, -1, 1];
  var nRow = [ -1, -1,  0,  1, 1,  1,  0, -1, -2, -2, -1, -1,  1, 1,  2, 2];
  var nDist = new Array (nStencil);
  var nAzm =  new Array (nStencil);

  var timeNext = 0;
  var timeNow = 0;
  var ignNcell;
  var ignTime;

  //create maps
  var ignMap            = new Array (ROWS*COLS);
  var ignMapNew         = new Array (ROWS*COLS);    //Used in iterative (Fast) FGM
  var rosMap            = new Array (ROWS*COLS);
  var rosMaxMap         = new Array (ROWS*COLS);
  var ros0Map           = new Array (ROWS*COLS);
  var rxIntensityMap    = new Array (ROWS*COLS);
  var moistMap          = new Array (ROWS*COLS); 
  var windUMap          = new Array (ROWS*COLS); 
  var windDirMap        = new Array (ROWS*COLS); 
  var slopeMap          = new Array (ROWS*COLS);
  var aspectMap         = new Array (ROWS*COLS);
  var phiEffWindMap     = new Array (ROWS*COLS);
  var eccentricityMap   = new Array (ROWS*COLS);
  var azimuthMaxMap     = new Array (ROWS*COLS);

  //Read file properties, build fuelProps object
  var fuelProps = createFuelPropsNFFL1();


  initMaps();

  FGM();

  for (cell = 0; cell < ROWS*COLS; cell++)
    ignMap[cell] = parseFloat(ignMap[cell].toFixed(2));

  return JSON.stringify(ignMap);

  function FGM(){

    //Compute distance and Azimuth of neighbour
    //in a outward propagation configuration
    calcDistAzm();


    while (timeNext < INF){
      timeNow = timeNext;
      timeNext = INF;

      for ( row = 0; row < ROWS; row++){
        for ( col = 0; col < COLS; col++){
          cell = col + COLS*row;
          
          //If the cell burns only in the future, skips and update timeNext if necessary
          //finds the minimum timeNext from the cells ignition times
          if ( ignMap[cell] > timeNow && timeNext > ignMap[cell] ){

            timeNext = ignMap[cell];
            continue;
          } 
          if ( ignMap[cell] !== timeNow )
            continue;

          //Neighbour loop if ignMap[cell] = timeNow
          for (var n = 0; n < 16; n++){

            //neighbour index calc
            ncol = col + nCol[n];
            nrow = row + nRow[n];
            ncell = ncol + nrow*COLS;

            //Check if neighbour is inbound
            if ( !(nrow >= 0 && nrow < ROWS && ncol >= 0 && ncol < COLS))
              continue;


            var ignNcell = ignMap[ncell];

            // if cell is unburned, compute propagation time
            if ( !(ignNcell > timeNow && rosMaxMap[cell] >= smidgen ))
              continue;

            ros = fireLib.spreadAnyAzimuth(cell, nAzm[n], phiEffWindMap, azimuthMaxMap, rosMaxMap, 
                            eccentricityMap, ros0Map );

            ignTime = timeNow + nDist[n] / ros;

            //Update ignition time
            if(ignTime < ignNcell)
              ignMap[ncell] = ignTime;

            //Update timeNext
            if( ignTime < timeNext )
              timeNext = ignTime;
          }
        }
      }
    }

    function calcDistAzm(){
      for ( n = 0; n<nStencil; n++ ){
          nDist[n] = Math.sqrt ( nCol[n] * CellWd * nCol[n] * CellWd + nRow[n] * CellHt * nRow[n] * CellHt );

          if (n < 8)
            nAzm[n] = n * 45.0;
          else
          {

            nAzm[n] = Math.atan( (nCol[n] * CellWd) / (nRow[n] * CellHt) );

            if ( nCol[n] > 0  && nRow[n] < 0) //1st quadrant 
              nAzm[n] = RadToDeg(  Math.abs( nAzm[n] ));

            if ( nCol[n] > 0  && nRow[n] > 0) //2st quadrant 
              nAzm[n] = 180.0 - RadToDeg( nAzm[n] ) ;

            if ( nCol[n] < 0  && nRow[n] > 0) //3st quadrant 
              nAzm[n] = RadToDeg( Math.abs( nAzm[n] ) )+ 180.0;

            if ( nCol[n] < 0  && nRow[n] < 0) //4st quadrant 
              nAzm[n] = 360.0 - RadToDeg( Math.abs( nAzm[n] ));
          }
      }
    }

  }

  function time(func){
    var start = Date.now();
    func();
    var end = Date.now();
    return end - start;
  }

function createFuelPropsNFFL1(){
    var array;
    var fuelObj = {};

    fuelObj.Fuel_AreaWtg = 1.00000e+00;
    fuelObj.Fuel_LifeRxFactor =1.52283e+03;
    fuelObj.Fuel_PropFlux = 5.77522e-02;
    fuelObj.Fuel_Mext = 1.20000e-01;
    fuelObj.Fuel_LifeAreaWtg = 1.00000e+00;
    fuelObj.Fuel_SigmaFactor = 9.61339e-01 ;
    fuelObj.Fuel_BulkDensity = 3.40000e-02 ;
    fuelObj.Fuel_WindB = 2.07124e+00 ;
    fuelObj.Fuel_WindK = 7.17344e-05;
    fuelObj.Fuel_SlopeK = 4.11456e+01;
    fuelObj.Fuel_WindE = 1.39403e+04;

    return fuelObj;
  }

  function createFuelPropsCustom(){
    var array;
    var fuelObj = {};

    fuelObj.Fuel_AreaWtg = 1.00000e+00;
    fuelObj.Fuel_LifeRxFactor =2.85775e+03;
    fuelObj.Fuel_PropFlux = 2.00330e+00;
    fuelObj.Fuel_Mext = 1.20000e-01;
    fuelObj.Fuel_LifeAreaWtg = 1.00000e+00;
    fuelObj.Fuel_SigmaFactor = 9.82898e-01;
    fuelObj.Fuel_BulkDensity = 1.16751e+00;
    fuelObj.Fuel_WindB = 3.23670e+00;
    fuelObj.Fuel_WindK = 5.32355e-08;
    fuelObj.Fuel_SlopeK = 1.42426e+01;
    fuelObj.Fuel_WindE = 1.87845e+07;

    return fuelObj;
  }

  function initMaps(){

    //Init maps
    for (cell = 0; cell < cells; cell++){
      ignMap[cell]      = INF;
      moistMap[cell]    = MOISTUREPART;
      windUMap[cell]    = WINDU;
      windDirMap[cell]  = WINDDIR;
      //Aspect in firelib is N=0 and clockwise 
      //while aspect in Grass is E=0 counter-clockwise
      aspectMap[cell] = (ASPECTMAP_PC[cell] - 90 < 0) ?                            
                          ASPECTMAP_PC[cell] - 90 + 360  : ASPECTMAP_PC[cell] - 90 ; 
      aspectMap[cell] = 360 - aspectMap[cell];
      //while in Grass is percentage rise/reach.

      //Slope in firelib is a fraction
      slopeMap[cell]    = SLOPEMAP_PC[cell]/100;

    }

    for (cell = 0; cell < cells; cell++)
      ros0Map[cell] = fireLib.noWindNoSlope(cell, fuelProps, moistMap, rxIntensityMap);
    

    for (cell = 0; cell < cells; cell++)
      rosMaxMap[cell] = fireLib.windAndSlope(cell, fuelProps, slopeMap, ros0Map, windUMap, 
                        windDirMap, aspectMap, azimuthMaxMap, eccentricityMap, 
                        phiEffWindMap, rxIntensityMap);


    //Ignition point at terrain midle
    ignMap[Math.floor(COLS/4) + Math.floor(ROWS/4)*COLS] = 0;
  }

  function feetToMeters(x){
    x *= 0.3048;
    return x;
  }
  function metersToFeet(x){
    x *= 3.2808399;
    return x;
  }

  function DegToRad(x) {
    x *= 0.017453293;
    return x;
  }

  function RadToDeg(x) {
    x *= 57.29577951;
    return x;
  }
};