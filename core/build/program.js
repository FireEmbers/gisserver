;(function(e,t,n){function i(n,s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("Cannot find module '"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0;s<n.length;s++)i(n[s]);return i})({1:[function(require,module,exports){

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
  var slopeMap          = SLOPEMAP_PC; 
  var aspectMap         = ASPECTMAP_PC;
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
      aspectMap[cell] = (aspectMap[cell] - 90 < 0) ?                            
                          aspectMap[cell] - 90 + 360  : aspectMap[cell] - 90 ; 
      aspectMap[cell] = 360 - aspectMap[cell];
      //while in Grass is percentage rise/reach.

      //Slope in firelib is a fraction
      slopeMap[cell]    = slopeMap[cell]/100;

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

  function loadTerrainMaps(slopeMap, aspectMap) {

    slopeMap = SLOPEMAP_PC;

    aspectMap = ASPECTMAP_PC;

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
},{"./fireLib":2}],2:[function(require,module,exports){
/*

  firelib porting to javascript

  This should be really moved to it's own module

*/

var smidgen = 1E-6;
var M_PI = 3.141592653589793;
var INF = 9999999999999;


function noWindNoSlope(idx, fuelProps, moistMap, rxIntensityMap){

  var AreaWtg;
  var ratio; 
  var rxIntensity;
  var Spread0Idx;


  AreaWtg = fuelProps.Fuel_AreaWtg;

  ratio = AreaWtg*moistMap[idx]/fuelProps.Fuel_Mext;

  rxIntensity =  fuelProps.Fuel_LifeRxFactor*
  (1-2.59*ratio + 5.11*ratio*ratio - 3.52*ratio*ratio*ratio); //EtaM
  
  rxIntensityMap[idx] = rxIntensity;

  Spread0Idx = fuelProps.Fuel_PropFlux*rxIntensity /
                      ((250.0 + 1116.0*moistMap[idx])*AreaWtg*    //Qig - Heat of pre Ignition
                       fuelProps.Fuel_LifeAreaWtg*
                       fuelProps.Fuel_SigmaFactor*
                       fuelProps.Fuel_BulkDensity);

  return Spread0Idx;
}

function windAndSlope(idx, fuelProps, slopeMap, ros0Map, windUMap, windDirMap, aspectMap,
                        azimuthMaxMap, eccentricityMap, phiEffWindMap, rxIntensityMap )
{

  var windB, windK,  phiSlope, phiWind, phiEw, upSlope, spreadMax, spreadMaxIdx;
  var spread0Idx;
  var slope;
  var effectiveWind;
  var maxWind;
  var lwRatio;
  var split;
  var x;
  var y;
  var Rv;
  var a;

  slope  = slopeMap[idx];
  spread0Idx = ros0Map[idx];

  windB = fuelProps.Fuel_WindB;
  windK = fuelProps.Fuel_WindK;

  phiSlope = fuelProps.Fuel_SlopeK*slope *slope;
  phiWind  = fuelProps.Fuel_WindK*Math.pow(windUMap[idx],windB);

  //PhiWind tem um teste < smidgen em relacao a velocidade do vento WindUMap
  phiEw = phiSlope + phiWind;

  if((upSlope = aspectMap[idx]) >= 180.0)
    upSlope = upSlope - 180;
  else
    upSlope = upSlope + 180;


  //Situation 1 No fire Spread or reaction Intensity
  if(spread0Idx < smidgen) {
    spreadMaxIdx          = 0;
    eccentricityMap[idx]  = 0;
    azimuthMaxMap[idx]    = 0;
    phiEffWindMap[idx]    = phiEw;
  }

  //Situation 2 No Wind and No Slope
  else if (phiEw < smidgen) {
    phiEffWindMap[idx]   = 0;
    spreadMaxIdx         = spread0Idx;
    eccentricityMap[idx] = 0;
    azimuthMaxMap[idx]   = 0;
  }

  //Situation 3 Wind with No Slope
  else if (slope  < smidgen) {
    effectiveWind  = windUMap[idx];
    azimuthMaxMap[idx] = windDirMap[idx];
    
    maxWind = 0.9*rxIntensityMap[idx];
    spread0Idx = ros0Map[idx];
    if(effectiveWind  >  maxWind ) {

      phiEw = windK*Math.pow(maxWind , windB);
      effectiveWind  = maxWind ;
    }

    spreadMaxIdx = spread0Idx *(1 + phiEw);
    
    if(effectiveWind  >  smidgen) {

      lwRatio  = 1.0 + 0.002840909 * effectiveWind ;
      if (lwRatio  > 1.00001)
        eccentricityMap[idx] = Math.sqrt(lwRatio *lwRatio  - 1)/lwRatio ;
    }

    phiEffWindMap[idx]  = phiEw;
  }

  //Situation 4 and 5 - slope with no wind and wind blows upSlope
  else if(windUMap[idx] < smidgen || equal(upSlope, windDirMap[idx])) {

    azimuthMaxMap[idx] = upSlope;
    effectiveWind  = Math.pow(phiEw*fuelProps.Fuel_WindE, 1/windB);
    maxWind  = 0.9*rxIntensityMap[idx];

    if(effectiveWind  >  maxWind ) {

      phiEw = windK*Math.pow(maxWind , windB);
      effectiveWind  = maxWind ;
    }

    if(effectiveWind  >  smidgen) {

      lwRatio  = 1.0 + 0.002840909 * effectiveWind;
      if (lwRatio  > 1.000001)
        eccentricityMap[idx] = Math.sqrt(lwRatio *lwRatio  - 1)/lwRatio ;
    }

    spreadMaxIdx = spread0Idx *(1 + phiEw);
  }
  //Situation 6 - Wind Blows cross Slope
  else {

    split  = windDirMap[idx];
    if (upSlope <= split )
      split  = split  - upSlope;
    else
      split  = 360.0 - upSlope + split ;

    split  = DegToRad(split );
    x   = spread0Idx *(phiSlope + phiWind*Math.cos(split ));
    y   = spread0Idx *(phiWind*Math.sin(split ));
    Rv  = Math.sqrt(x *x  + y *y );

    spreadMax = spread0Idx  + Rv ;
    phiEw = spreadMax / spread0Idx  - 1;
    a  = Math.asin(Math.abs(y ) / Rv );
    if(x  >= 0.0)
      a  = (y  >= 0.0) ? a           : M_PI + M_PI - a ;
    else
      a  = (y  >= 0.0) ? (M_PI - a ) : M_PI + a ;
    
    split  = RadToDeg(a );
    if (upSlope + split  > 306.0)
      azimuthMaxMap[idx] = upSlope + split  - 360.0;
    else
      azimuthMaxMap[idx] = upSlope + split ;

    effectiveWind  = Math.pow(phiEw*fuelProps.Fuel_WindE, 1/windB);
    
    //Do effective wind only if phiEw > smidgen
    if(phiEw > smidgen) {

      maxWind  = 0.9*rxIntensityMap[idx];
      if(effectiveWind  >  maxWind ) {
        phiEw = windK*Math.pow(maxWind , windB);
        effectiveWind  = maxWind ;
        spreadMax = spread0Idx *(1 + phiEw);
      }
    }

    if(effectiveWind  >  smidgen) {

      lwRatio  = 1.0 + 0.002840909 * effectiveWind ;
      if (lwRatio  > 1.00001)
        eccentricityMap[idx] = Math.sqrt(lwRatio *lwRatio  - 1)/lwRatio ;
    }

    spreadMaxIdx = spreadMax;
    phiEffWindMap[idx] = phiEw;

  }

  return ( spreadMaxIdx );
}

function spreadAnyAzimuth(idx, azimuth, phiEffWindMap, azimuthMaxMap, rosMaxMap,
                            eccentricityMap, ros0Map )
{

  var spreadAny;
  var eccentricity;

  if (phiEffWindMap[idx] < smidgen && azimuthMaxMap[idx] === azimuth)
  
    spreadAny = rosMaxMap[idx];
  
  else {
  
    if ((dir = Math.abs(azimuthMaxMap[idx] - azimuth)) > 180)
      dir = 360.0 - dir;

    dir = DegToRad(dir);

    eccentricity = eccentricityMap[idx];
    spreadAny = rosMaxMap[idx]*(1 - eccentricity)/(1 - eccentricity*Math.cos(dir));

    if (spreadAny > INF)
      spreadAny = ros0Map[idx];

  }

  return spreadAny;
}


function DegToRad(x) {
  x *= 0.017453293;
  return x;
}

function RadToDeg(x) {
  x *= 57.29577951;
  return x;
}

function equal(x,y){
  if ( Math.abs(x-y)<smidgen )
    return true;
  else
    return false;
}

exports.windAndSlope = windAndSlope;
exports.spreadAnyAzimuth = spreadAnyAzimuth;
exports.noWindNoSlope = noWindNoSlope;

},{}]},{},[1])
;