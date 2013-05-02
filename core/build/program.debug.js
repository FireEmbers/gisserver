(function(e){if("function"==typeof bootstrap)bootstrap("core",e);else if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else if("undefined"!=typeof ses){if(!ses.ok())return;ses.makeCore=e}else"undefined"!=typeof window?window.Core=e():global.Core=e()})(function(){var define,ses,bootstrap,module,exports;
return (function(e,t,n){function i(n,s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("Cannot find module '"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0;s<n.length;s++)i(n[s]);return i})({1:[function(require,module,exports){

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
  var fuelProps = createFuelProps();

  loadTerrainMaps();

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

  function createFuelProps(){
    var array;
    fuelObj = {};

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
      aspectMap[cell] = (aspectMap[cell] - 90 < 0) ?                            
                          aspectMap[cell] - 90 + 360  : aspectMap[cell] - 90 ; 
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

  function loadTerrainMaps() {

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

  firelib porting to js

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
  
  //PhiWind tem um teste < smidgen em relacao a velocidade do vento WindUMap... 
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
    spreadMaxIdx         = spread0Idx ;
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

    phiEff0WindMap[idx]  = phiEw;
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

  return ( spreadMaxIdx);
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
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvaG9tZS9mc291c2Evc3JjL2NycC9maXJlQXBwL3NyYy9wcm9ncmFtLmpzIiwiL2hvbWUvZnNvdXNhL3NyYy9jcnAvZmlyZUFwcC9zcmMvZmlyZUxpYi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIlxuLypcblxuRGV0ZXJtaW5pc3RpYyBmaXJlIG1vZGVsIGJhc2VkIG9uIGZpcmVsaWIgKyBhIGNlbGx1bGFyIGF1dG9tYXRhIFxuZmlyZSBncm93dGggbW9kZWwgKEZHTSlcblxudGVtcGxhdGUgZnVjdGlvbiByZWNlaXZlcyBhIHRocmVlIGVsZW1lbnQgYXJyYXkgXCJkYXRhQXJyYXlcIiB3aXRoIG1vaXN0dXJlWyVdLCB3aW5kIHNwZWVkIFttL3NdXG5hbmQgd2luZCBkaXJlY3Rpb25bwrogZnJvbSBub3J0aF0gXG5cbi5yZXBsYWNlIGhhcyB0byBiZSB1c2VkIGluIGEgd3JhcHBlciBmdW5jdGlvbiB0byByZXBsYWNlOlxuICBTTE9QRU1BUF9QQyAgIC0gU2xvcGUgTWFwIGFycmF5XG4gIEFTUEVDVE1BUF9QQyAgLSBBc3BlY3QgTWFwIEFycmF5XG4gIFJPV1NfUEMgICAgICAgLSBOdW1iZXIgb2YgUm93c1xuICBDT0xTX1BDICAgICAgIC0gTnVtYmVyIG9zIENvbHVtbnNzXG5cbiovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGRhdGFBcnJheSwgUk9XU19QQywgQ09MU19QQywgQVNQRUNUTUFQX1BDLCBTTE9QRU1BUF9QQyl7XG5cbiAgdmFyIGZpcmVMaWIgPSByZXF1aXJlKCcuL2ZpcmVMaWInKTtcbiAgLy92YXIgZmlyZUxpYiA9IHJlcXVpcmUoJy4vc2xvd0ZHTScpO1xuXG5cbiAgdmFyIFJPV1MgPSBST1dTX1BDO1xuICB2YXIgQ09MUyA9IENPTFNfUEM7XG4gIHZhciBNT0lTVFVSRVBBUlQgPSBkYXRhQXJyYXlbMF0vMTAwOyAgICAgICAgICAgICAvL2ZyYWN0aW9uXG4gIHZhciBXSU5EVSA9IGRhdGFBcnJheVsxXSoxOTYuODUwMzkzNzAxOyAgICAgICAgICAvLyBbbS9zXSAtID4gZnQvbWluICgyLjIzIG0vcyA9IDVtcGgpXG4gIHZhciBXSU5ERElSID1kYXRhQXJyYXlbMl07ICAgICAgICAgICAgICAgICAgICAgICAvL2RlZ3JlZXMgY2xvY2t3aXNlIGZyb20gbm9ydGhcblxuICB2YXIgTCA9IG1ldGVyc1RvRmVldCgzMDAwKTsgICAgICAgICAgICAgICAgICAgICAgLy9UZXJyYWluIExlbmd0aFxuICB2YXIgVyA9IG1ldGVyc1RvRmVldCgzMDAwKTsgICAgICAgICAgICAgICAgICAgICAgIC8vVGVycmFpbiBXaWR0aFxuXG4gIHZhciBDZWxsV2QgPSBML1JPV1M7XG4gIHZhciBDZWxsSHQgPSBXL0NPTFM7XG5cbiAgdmFyIElORiA9IDk5OTk5OTk5OTk5OTk7XG4gIHZhciBzbWlkZ2VuID0gMUUtNjtcblxuICBcbiAgdmFyIG5TdGVuY2lsID0gMTY7XG5cbiAgdmFyIHJvdywgY29sLCBucm93LCBuY29sO1xuICB2YXIgY2VsbDtcbiAgdmFyIGNlbGxzID0gUk9XUypDT0xTO1xuICB2YXIgbmNlbGw7XG4gIHZhciBkQ2VsbDtcbiAgXG4gICAgICAgICAgICAgLy9OICAgTkUgICBFICBTRSAgUyAgU1cgICBXICBOVyAgIGEgICBiICAgYyAgIGQgICBlICBmICAgZyAgaCBcbiAgdmFyIG5Db2wgPSBbIDAsICAgMSwgIDEsICAxLCAwLCAtMSwgLTEsIC0xLCAtMSwgIDEsIC0yLCAgMiwgLTIsIDIsIC0xLCAxXTtcbiAgdmFyIG5Sb3cgPSBbIC0xLCAtMSwgIDAsICAxLCAxLCAgMSwgIDAsIC0xLCAtMiwgLTIsIC0xLCAtMSwgIDEsIDEsICAyLCAyXTtcbiAgdmFyIG5EaXN0ID0gbmV3IEFycmF5IChuU3RlbmNpbCk7XG4gIHZhciBuQXptID0gIG5ldyBBcnJheSAoblN0ZW5jaWwpO1xuXG4gIHZhciB0aW1lTmV4dCA9IDA7XG4gIHZhciB0aW1lTm93ID0gMDtcbiAgdmFyIGlnbk5jZWxsO1xuICB2YXIgaWduVGltZTtcblxuICAvL2NyZWF0ZSBtYXBzXG4gIHZhciBpZ25NYXAgICAgICAgICAgICA9IG5ldyBBcnJheSAoUk9XUypDT0xTKTtcbiAgdmFyIGlnbk1hcE5ldyAgICAgICAgID0gbmV3IEFycmF5IChST1dTKkNPTFMpOyAgICAvL1VzZWQgaW4gaXRlcmF0aXZlIChGYXN0KSBGR01cbiAgdmFyIHJvc01hcCAgICAgICAgICAgID0gbmV3IEFycmF5IChST1dTKkNPTFMpO1xuICB2YXIgcm9zTWF4TWFwICAgICAgICAgPSBuZXcgQXJyYXkgKFJPV1MqQ09MUyk7XG4gIHZhciByb3MwTWFwICAgICAgICAgICA9IG5ldyBBcnJheSAoUk9XUypDT0xTKTtcbiAgdmFyIHJ4SW50ZW5zaXR5TWFwICAgID0gbmV3IEFycmF5IChST1dTKkNPTFMpO1xuICB2YXIgbW9pc3RNYXAgICAgICAgICAgPSBuZXcgQXJyYXkgKFJPV1MqQ09MUyk7IFxuICB2YXIgd2luZFVNYXAgICAgICAgICAgPSBuZXcgQXJyYXkgKFJPV1MqQ09MUyk7IFxuICB2YXIgd2luZERpck1hcCAgICAgICAgPSBuZXcgQXJyYXkgKFJPV1MqQ09MUyk7IFxuICB2YXIgc2xvcGVNYXAgICAgICAgICAgPSBuZXcgQXJyYXkgKFJPV1MqQ09MUyk7IFxuICB2YXIgYXNwZWN0TWFwICAgICAgICAgPSBuZXcgQXJyYXkgKFJPV1MqQ09MUyk7XG4gIHZhciBwaGlFZmZXaW5kTWFwICAgICA9IG5ldyBBcnJheSAoUk9XUypDT0xTKTtcbiAgdmFyIGVjY2VudHJpY2l0eU1hcCAgID0gbmV3IEFycmF5IChST1dTKkNPTFMpO1xuICB2YXIgYXppbXV0aE1heE1hcCAgICAgPSBuZXcgQXJyYXkgKFJPV1MqQ09MUyk7XG5cbiAgLy9SZWFkIGZpbGUgcHJvcGVydGllcywgYnVpbGQgZnVlbFByb3BzIG9iamVjdFxuICB2YXIgZnVlbFByb3BzID0gY3JlYXRlRnVlbFByb3BzKCk7XG5cbiAgbG9hZFRlcnJhaW5NYXBzKCk7XG5cbiAgaW5pdE1hcHMoKTtcblxuICBGR00oKTtcblxuICBmb3IgKGNlbGwgPSAwOyBjZWxsIDwgUk9XUypDT0xTOyBjZWxsKyspXG4gICAgaWduTWFwW2NlbGxdID0gcGFyc2VGbG9hdChpZ25NYXBbY2VsbF0udG9GaXhlZCgyKSk7XG5cbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGlnbk1hcCk7XG5cbiAgZnVuY3Rpb24gRkdNKCl7XG5cbiAgICAvL0NvbXB1dGUgZGlzdGFuY2UgYW5kIEF6aW11dGggb2YgbmVpZ2hib3VyXG4gICAgLy9pbiBhIG91dHdhcmQgcHJvcGFnYXRpb24gY29uZmlndXJhdGlvblxuICAgIGNhbGNEaXN0QXptKCk7XG5cblxuICAgIHdoaWxlICh0aW1lTmV4dCA8IElORil7XG4gICAgICB0aW1lTm93ID0gdGltZU5leHQ7XG4gICAgICB0aW1lTmV4dCA9IElORjtcblxuICAgICAgZm9yICggcm93ID0gMDsgcm93IDwgUk9XUzsgcm93Kyspe1xuICAgICAgICBmb3IgKCBjb2wgPSAwOyBjb2wgPCBDT0xTOyBjb2wrKyl7XG4gICAgICAgICAgY2VsbCA9IGNvbCArIENPTFMqcm93O1xuICAgICAgICAgIFxuICAgICAgICAgIC8vSWYgdGhlIGNlbGwgYnVybnMgb25seSBpbiB0aGUgZnV0dXJlLCBza2lwcyBhbmQgdXBkYXRlIHRpbWVOZXh0IGlmIG5lY2Vzc2FyeVxuICAgICAgICAgIC8vZmluZHMgdGhlIG1pbmltdW0gdGltZU5leHQgZnJvbSB0aGUgY2VsbHMgaWduaXRpb24gdGltZXNcbiAgICAgICAgICBpZiAoIGlnbk1hcFtjZWxsXSA+IHRpbWVOb3cgJiYgdGltZU5leHQgPiBpZ25NYXBbY2VsbF0gKXtcblxuICAgICAgICAgICAgdGltZU5leHQgPSBpZ25NYXBbY2VsbF07XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9IFxuICAgICAgICAgIGlmICggaWduTWFwW2NlbGxdICE9PSB0aW1lTm93IClcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgLy9OZWlnaGJvdXIgbG9vcCBpZiBpZ25NYXBbY2VsbF0gPSB0aW1lTm93XG4gICAgICAgICAgZm9yICh2YXIgbiA9IDA7IG4gPCAxNjsgbisrKXtcblxuICAgICAgICAgICAgLy9uZWlnaGJvdXIgaW5kZXggY2FsY1xuICAgICAgICAgICAgbmNvbCA9IGNvbCArIG5Db2xbbl07XG4gICAgICAgICAgICBucm93ID0gcm93ICsgblJvd1tuXTtcbiAgICAgICAgICAgIG5jZWxsID0gbmNvbCArIG5yb3cqQ09MUztcblxuICAgICAgICAgICAgLy9DaGVjayBpZiBuZWlnaGJvdXIgaXMgaW5ib3VuZFxuICAgICAgICAgICAgaWYgKCAhKG5yb3cgPj0gMCAmJiBucm93IDwgUk9XUyAmJiBuY29sID49IDAgJiYgbmNvbCA8IENPTFMpKVxuICAgICAgICAgICAgICBjb250aW51ZTtcblxuXG4gICAgICAgICAgICB2YXIgaWduTmNlbGwgPSBpZ25NYXBbbmNlbGxdO1xuXG4gICAgICAgICAgICAvLyBpZiBjZWxsIGlzIHVuYnVybmVkLCBjb21wdXRlIHByb3BhZ2F0aW9uIHRpbWVcbiAgICAgICAgICAgIGlmICggIShpZ25OY2VsbCA+IHRpbWVOb3cgJiYgcm9zTWF4TWFwW2NlbGxdID49IHNtaWRnZW4gKSlcbiAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIHJvcyA9IGZpcmVMaWIuc3ByZWFkQW55QXppbXV0aChjZWxsLCBuQXptW25dLCBwaGlFZmZXaW5kTWFwLCBhemltdXRoTWF4TWFwLCByb3NNYXhNYXAsIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVjY2VudHJpY2l0eU1hcCwgcm9zME1hcCApO1xuXG4gICAgICAgICAgICBpZ25UaW1lID0gdGltZU5vdyArIG5EaXN0W25dIC8gcm9zO1xuXG4gICAgICAgICAgICAvL1VwZGF0ZSBpZ25pdGlvbiB0aW1lXG4gICAgICAgICAgICBpZihpZ25UaW1lIDwgaWduTmNlbGwpXG4gICAgICAgICAgICAgIGlnbk1hcFtuY2VsbF0gPSBpZ25UaW1lO1xuXG4gICAgICAgICAgICAvL1VwZGF0ZSB0aW1lTmV4dFxuICAgICAgICAgICAgaWYoIGlnblRpbWUgPCB0aW1lTmV4dCApXG4gICAgICAgICAgICAgIHRpbWVOZXh0ID0gaWduVGltZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWxjRGlzdEF6bSgpe1xuICAgICAgZm9yICggbiA9IDA7IG48blN0ZW5jaWw7IG4rKyApe1xuICAgICAgICAgIG5EaXN0W25dID0gTWF0aC5zcXJ0ICggbkNvbFtuXSAqIENlbGxXZCAqIG5Db2xbbl0gKiBDZWxsV2QgKyBuUm93W25dICogQ2VsbEh0ICogblJvd1tuXSAqIENlbGxIdCApO1xuXG4gICAgICAgICAgaWYgKG4gPCA4KVxuICAgICAgICAgICAgbkF6bVtuXSA9IG4gKiA0NS4wO1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICB7XG5cbiAgICAgICAgICAgIG5Bem1bbl0gPSBNYXRoLmF0YW4oIChuQ29sW25dICogQ2VsbFdkKSAvIChuUm93W25dICogQ2VsbEh0KSApO1xuXG4gICAgICAgICAgICBpZiAoIG5Db2xbbl0gPiAwICAmJiBuUm93W25dIDwgMCkgLy8xc3QgcXVhZHJhbnQgXG4gICAgICAgICAgICAgIG5Bem1bbl0gPSBSYWRUb0RlZyggIE1hdGguYWJzKCBuQXptW25dICkpO1xuXG4gICAgICAgICAgICBpZiAoIG5Db2xbbl0gPiAwICAmJiBuUm93W25dID4gMCkgLy8yc3QgcXVhZHJhbnQgXG4gICAgICAgICAgICAgIG5Bem1bbl0gPSAxODAuMCAtIFJhZFRvRGVnKCBuQXptW25dICkgO1xuXG4gICAgICAgICAgICBpZiAoIG5Db2xbbl0gPCAwICAmJiBuUm93W25dID4gMCkgLy8zc3QgcXVhZHJhbnQgXG4gICAgICAgICAgICAgIG5Bem1bbl0gPSBSYWRUb0RlZyggTWF0aC5hYnMoIG5Bem1bbl0gKSApKyAxODAuMDtcblxuICAgICAgICAgICAgaWYgKCBuQ29sW25dIDwgMCAgJiYgblJvd1tuXSA8IDApIC8vNHN0IHF1YWRyYW50IFxuICAgICAgICAgICAgICBuQXptW25dID0gMzYwLjAgLSBSYWRUb0RlZyggTWF0aC5hYnMoIG5Bem1bbl0gKSk7XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICB9XG5cbiAgZnVuY3Rpb24gdGltZShmdW5jKXtcbiAgICB2YXIgc3RhcnQgPSBEYXRlLm5vdygpO1xuICAgIGZ1bmMoKTtcbiAgICB2YXIgZW5kID0gRGF0ZS5ub3coKTtcbiAgICByZXR1cm4gZW5kIC0gc3RhcnQ7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVGdWVsUHJvcHMoKXtcbiAgICB2YXIgYXJyYXk7XG4gICAgZnVlbE9iaiA9IHt9O1xuXG4gICAgZnVlbE9iai5GdWVsX0FyZWFXdGcgPSAxLjAwMDAwZSswMDtcbiAgICBmdWVsT2JqLkZ1ZWxfTGlmZVJ4RmFjdG9yID0yLjg1Nzc1ZSswMztcbiAgICBmdWVsT2JqLkZ1ZWxfUHJvcEZsdXggPSAyLjAwMzMwZSswMDtcbiAgICBmdWVsT2JqLkZ1ZWxfTWV4dCA9IDEuMjAwMDBlLTAxO1xuICAgIGZ1ZWxPYmouRnVlbF9MaWZlQXJlYVd0ZyA9IDEuMDAwMDBlKzAwO1xuICAgIGZ1ZWxPYmouRnVlbF9TaWdtYUZhY3RvciA9IDkuODI4OThlLTAxO1xuICAgIGZ1ZWxPYmouRnVlbF9CdWxrRGVuc2l0eSA9IDEuMTY3NTFlKzAwO1xuICAgIGZ1ZWxPYmouRnVlbF9XaW5kQiA9IDMuMjM2NzBlKzAwO1xuICAgIGZ1ZWxPYmouRnVlbF9XaW5kSyA9IDUuMzIzNTVlLTA4O1xuICAgIGZ1ZWxPYmouRnVlbF9TbG9wZUsgPSAxLjQyNDI2ZSswMTtcbiAgICBmdWVsT2JqLkZ1ZWxfV2luZEUgPSAxLjg3ODQ1ZSswNztcblxuICAgIHJldHVybiBmdWVsT2JqO1xuICB9XG5cbiAgZnVuY3Rpb24gaW5pdE1hcHMoKXtcblxuICAgIC8vSW5pdCBtYXBzXG4gICAgZm9yIChjZWxsID0gMDsgY2VsbCA8IGNlbGxzOyBjZWxsKyspe1xuICAgICAgaWduTWFwW2NlbGxdICAgICAgPSBJTkY7XG4gICAgICBtb2lzdE1hcFtjZWxsXSAgICA9IE1PSVNUVVJFUEFSVDtcbiAgICAgIHdpbmRVTWFwW2NlbGxdICAgID0gV0lORFU7XG4gICAgICB3aW5kRGlyTWFwW2NlbGxdICA9IFdJTkRESVI7XG4gICAgICAvL0FzcGVjdCBpbiBmaXJlbGliIGlzIE49MCBhbmQgY2xvY2t3aXNlIFxuICAgICAgYXNwZWN0TWFwW2NlbGxdID0gKGFzcGVjdE1hcFtjZWxsXSAtIDkwIDwgMCkgPyAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYXNwZWN0TWFwW2NlbGxdIC0gOTAgKyAzNjAgIDogYXNwZWN0TWFwW2NlbGxdIC0gOTAgOyBcbiAgICAgIC8vd2hpbGUgaW4gR3Jhc3MgaXMgcGVyY2VudGFnZSByaXNlL3JlYWNoLlxuICAgICAgLy9TbG9wZSBpbiBmaXJlbGliIGlzIGEgZnJhY3Rpb25cbiAgICAgIHNsb3BlTWFwW2NlbGxdICAgID0gc2xvcGVNYXBbY2VsbF0vMTAwOyAgICAgICAgICAgICAgICAgIFxuICAgIH1cblxuICAgIGZvciAoY2VsbCA9IDA7IGNlbGwgPCBjZWxsczsgY2VsbCsrKVxuICAgICAgcm9zME1hcFtjZWxsXSA9IGZpcmVMaWIubm9XaW5kTm9TbG9wZShjZWxsLCBmdWVsUHJvcHMsIG1vaXN0TWFwLCByeEludGVuc2l0eU1hcCk7XG4gICAgXG5cbiAgICBmb3IgKGNlbGwgPSAwOyBjZWxsIDwgY2VsbHM7IGNlbGwrKylcbiAgICAgIHJvc01heE1hcFtjZWxsXSA9IGZpcmVMaWIud2luZEFuZFNsb3BlKGNlbGwsIGZ1ZWxQcm9wcywgc2xvcGVNYXAsIHJvczBNYXAsIHdpbmRVTWFwLCBcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmREaXJNYXAsIGFzcGVjdE1hcCwgYXppbXV0aE1heE1hcCwgZWNjZW50cmljaXR5TWFwLCBcbiAgICAgICAgICAgICAgICAgICAgICAgIHBoaUVmZldpbmRNYXAsIHJ4SW50ZW5zaXR5TWFwKTtcblxuICAgIC8vSWduaXRpb24gcG9pbnQgYXQgdGVycmFpbiBtaWRsZVxuICAgIGlnbk1hcFtNYXRoLmZsb29yKENPTFMvNCkgKyBNYXRoLmZsb29yKFJPV1MvNCkqQ09MU10gPSAwO1xuICB9XG5cbiAgZnVuY3Rpb24gbG9hZFRlcnJhaW5NYXBzKCkge1xuXG4gICAgc2xvcGVNYXAgPSBTTE9QRU1BUF9QQztcblxuICAgIGFzcGVjdE1hcCA9IEFTUEVDVE1BUF9QQztcbiAgfVxuXG4gIGZ1bmN0aW9uIGZlZXRUb01ldGVycyh4KXtcbiAgICB4ICo9IDAuMzA0ODtcbiAgICByZXR1cm4geDtcbiAgfVxuICBmdW5jdGlvbiBtZXRlcnNUb0ZlZXQoeCl7XG4gICAgeCAqPSAzLjI4MDgzOTk7XG4gICAgcmV0dXJuIHg7XG4gIH1cblxuICBmdW5jdGlvbiBEZWdUb1JhZCh4KSB7XG4gICAgeCAqPSAwLjAxNzQ1MzI5MztcbiAgICByZXR1cm4geDtcbiAgfVxuXG4gIGZ1bmN0aW9uIFJhZFRvRGVnKHgpIHtcbiAgICB4ICo9IDU3LjI5NTc3OTUxO1xuICAgIHJldHVybiB4O1xuICB9XG59OyIsIi8qXG5cbiAgZmlyZWxpYiBwb3J0aW5nIHRvIGpzXG5cbiovXG5cbnZhciBzbWlkZ2VuID0gMUUtNjtcbnZhciBNX1BJID0gMy4xNDE1OTI2NTM1ODk3OTM7XG52YXIgSU5GID0gOTk5OTk5OTk5OTk5OTtcblxuXG5mdW5jdGlvbiBub1dpbmROb1Nsb3BlKGlkeCwgZnVlbFByb3BzLCBtb2lzdE1hcCwgcnhJbnRlbnNpdHlNYXApe1xuXG4gIHZhciBBcmVhV3RnO1xuICB2YXIgcmF0aW87IFxuICB2YXIgcnhJbnRlbnNpdHk7XG4gIHZhciBTcHJlYWQwSWR4O1xuXG5cbiAgQXJlYVd0ZyA9IGZ1ZWxQcm9wcy5GdWVsX0FyZWFXdGc7XG5cbiAgcmF0aW8gPSBBcmVhV3RnKm1vaXN0TWFwW2lkeF0vZnVlbFByb3BzLkZ1ZWxfTWV4dDtcblxuICByeEludGVuc2l0eSA9ICBmdWVsUHJvcHMuRnVlbF9MaWZlUnhGYWN0b3IqXG4gICgxLTIuNTkqcmF0aW8gKyA1LjExKnJhdGlvKnJhdGlvIC0gMy41MipyYXRpbypyYXRpbypyYXRpbyk7IC8vRXRhTVxuICBcbiAgcnhJbnRlbnNpdHlNYXBbaWR4XSA9IHJ4SW50ZW5zaXR5O1xuXG4gIFNwcmVhZDBJZHggPSBmdWVsUHJvcHMuRnVlbF9Qcm9wRmx1eCpyeEludGVuc2l0eSAvXG4gICAgICAgICAgICAgICAgICAgICAgKCgyNTAuMCArIDExMTYuMCptb2lzdE1hcFtpZHhdKSpBcmVhV3RnKiAgICAvL1FpZyAtIEhlYXQgb2YgcHJlIElnbml0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgIGZ1ZWxQcm9wcy5GdWVsX0xpZmVBcmVhV3RnKlxuICAgICAgICAgICAgICAgICAgICAgICBmdWVsUHJvcHMuRnVlbF9TaWdtYUZhY3RvcipcbiAgICAgICAgICAgICAgICAgICAgICAgZnVlbFByb3BzLkZ1ZWxfQnVsa0RlbnNpdHkpO1xuXG4gIHJldHVybiBTcHJlYWQwSWR4O1xufVxuXG5mdW5jdGlvbiB3aW5kQW5kU2xvcGUoaWR4LCBmdWVsUHJvcHMsIHNsb3BlTWFwLCByb3MwTWFwLCB3aW5kVU1hcCwgd2luZERpck1hcCwgYXNwZWN0TWFwLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXppbXV0aE1heE1hcCwgZWNjZW50cmljaXR5TWFwLCBwaGlFZmZXaW5kTWFwLCByeEludGVuc2l0eU1hcCApXG57XG5cbiAgdmFyIHdpbmRCLCB3aW5kSywgIHBoaVNsb3BlLCBwaGlXaW5kLCBwaGlFdywgdXBTbG9wZSwgc3ByZWFkTWF4LCBzcHJlYWRNYXhJZHg7XG4gIHZhciBzcHJlYWQwSWR4O1xuICB2YXIgc2xvcGU7ICAgICAgICBcbiAgdmFyIGVmZmVjdGl2ZVdpbmQ7XG4gIHZhciBtYXhXaW5kOyAgICAgIFxuICB2YXIgbHdSYXRpbzsgICAgICBcbiAgdmFyIHNwbGl0OyAgICAgICAgXG4gIHZhciB4OyAgICAgICAgICBcbiAgdmFyIHk7ICAgICAgICAgIFxuICB2YXIgUnY7ICAgICAgIFxuICB2YXIgYTtcblxuICBzbG9wZSAgPSBzbG9wZU1hcFtpZHhdO1xuICBzcHJlYWQwSWR4ID0gcm9zME1hcFtpZHhdOyBcblxuICB3aW5kQiA9IGZ1ZWxQcm9wcy5GdWVsX1dpbmRCO1xuICB3aW5kSyA9IGZ1ZWxQcm9wcy5GdWVsX1dpbmRLO1xuICBcbiAgcGhpU2xvcGUgPSBmdWVsUHJvcHMuRnVlbF9TbG9wZUsqc2xvcGUgKnNsb3BlO1xuICBwaGlXaW5kICA9IGZ1ZWxQcm9wcy5GdWVsX1dpbmRLKk1hdGgucG93KHdpbmRVTWFwW2lkeF0sd2luZEIpO1xuICBcbiAgLy9QaGlXaW5kIHRlbSB1bSB0ZXN0ZSA8IHNtaWRnZW4gZW0gcmVsYWNhbyBhIHZlbG9jaWRhZGUgZG8gdmVudG8gV2luZFVNYXAuLi4gXG4gIHBoaUV3ID0gcGhpU2xvcGUgKyBwaGlXaW5kO1xuXG4gIGlmKCh1cFNsb3BlID0gYXNwZWN0TWFwW2lkeF0pID49IDE4MC4wKVxuICAgIHVwU2xvcGUgPSB1cFNsb3BlIC0gMTgwO1xuICBlbHNlXG4gICAgdXBTbG9wZSA9IHVwU2xvcGUgKyAxODA7XG5cblxuICAvL1NpdHVhdGlvbiAxIE5vIGZpcmUgU3ByZWFkIG9yIHJlYWN0aW9uIEludGVuc2l0eVxuICBpZihzcHJlYWQwSWR4IDwgc21pZGdlbikgeyBcbiAgICBzcHJlYWRNYXhJZHggICAgICAgICAgPSAwO1xuICAgIGVjY2VudHJpY2l0eU1hcFtpZHhdICA9IDA7XG4gICAgYXppbXV0aE1heE1hcFtpZHhdICAgID0gMDtcbiAgICBwaGlFZmZXaW5kTWFwW2lkeF0gICAgPSBwaGlFdztcbiAgfVxuXG4gIC8vU2l0dWF0aW9uIDIgTm8gV2luZCBhbmQgTm8gU2xvcGVcbiAgZWxzZSBpZiAocGhpRXcgPCBzbWlkZ2VuKSB7XG4gICAgcGhpRWZmV2luZE1hcFtpZHhdICAgPSAwO1xuICAgIHNwcmVhZE1heElkeCAgICAgICAgID0gc3ByZWFkMElkeCA7XG4gICAgZWNjZW50cmljaXR5TWFwW2lkeF0gPSAwO1xuICAgIGF6aW11dGhNYXhNYXBbaWR4XSAgID0gMDtcbiAgfVxuXG4gIC8vU2l0dWF0aW9uIDMgV2luZCB3aXRoIE5vIFNsb3BlXG4gIGVsc2UgaWYgKHNsb3BlICA8IHNtaWRnZW4pIHtcbiAgICBlZmZlY3RpdmVXaW5kICA9IHdpbmRVTWFwW2lkeF07XG4gICAgYXppbXV0aE1heE1hcFtpZHhdID0gd2luZERpck1hcFtpZHhdOyAgXG4gICAgXG4gICAgbWF4V2luZCA9IDAuOSpyeEludGVuc2l0eU1hcFtpZHhdO1xuICAgIHNwcmVhZDBJZHggPSByb3MwTWFwW2lkeF07XG4gICAgaWYoZWZmZWN0aXZlV2luZCAgPiAgbWF4V2luZCApIHtcblxuICAgICAgcGhpRXcgPSB3aW5kSypNYXRoLnBvdyhtYXhXaW5kICwgd2luZEIpO1xuICAgICAgZWZmZWN0aXZlV2luZCAgPSBtYXhXaW5kIDtcbiAgICB9XG5cbiAgICBzcHJlYWRNYXhJZHggPSBzcHJlYWQwSWR4ICooMSArIHBoaUV3KTtcbiAgICBcbiAgICBpZihlZmZlY3RpdmVXaW5kICA+ICBzbWlkZ2VuKSB7XG5cbiAgICAgIGx3UmF0aW8gID0gMS4wICsgMC4wMDI4NDA5MDkgKiBlZmZlY3RpdmVXaW5kIDtcbiAgICAgIGlmIChsd1JhdGlvICA+IDEuMDAwMDEpXG4gICAgICAgIGVjY2VudHJpY2l0eU1hcFtpZHhdID0gTWF0aC5zcXJ0KGx3UmF0aW8gKmx3UmF0aW8gIC0gMSkvbHdSYXRpbyA7XG4gICAgfVxuXG4gICAgcGhpRWZmMFdpbmRNYXBbaWR4XSAgPSBwaGlFdztcbiAgfVxuXG4gIC8vU2l0dWF0aW9uIDQgYW5kIDUgLSBzbG9wZSB3aXRoIG5vIHdpbmQgYW5kIHdpbmQgYmxvd3MgdXBTbG9wZVxuICBlbHNlIGlmKHdpbmRVTWFwW2lkeF0gPCBzbWlkZ2VuIHx8IGVxdWFsKHVwU2xvcGUsIHdpbmREaXJNYXBbaWR4XSkpIHtcblxuICAgIGF6aW11dGhNYXhNYXBbaWR4XSA9IHVwU2xvcGU7XG4gICAgZWZmZWN0aXZlV2luZCAgPSBNYXRoLnBvdyhwaGlFdypmdWVsUHJvcHMuRnVlbF9XaW5kRSwgMS93aW5kQik7XG4gICAgbWF4V2luZCAgPSAwLjkqcnhJbnRlbnNpdHlNYXBbaWR4XTtcblxuICAgIGlmKGVmZmVjdGl2ZVdpbmQgID4gIG1heFdpbmQgKSB7XG5cbiAgICAgIHBoaUV3ID0gd2luZEsqTWF0aC5wb3cobWF4V2luZCAsIHdpbmRCKTtcbiAgICAgIGVmZmVjdGl2ZVdpbmQgID0gbWF4V2luZCA7XG4gICAgfVxuXG4gICAgaWYoZWZmZWN0aXZlV2luZCAgPiAgc21pZGdlbikge1xuXG4gICAgICBsd1JhdGlvICA9IDEuMCArIDAuMDAyODQwOTA5ICogZWZmZWN0aXZlV2luZDtcbiAgICAgIGlmIChsd1JhdGlvICA+IDEuMDAwMDAxKVxuICAgICAgICBlY2NlbnRyaWNpdHlNYXBbaWR4XSA9IE1hdGguc3FydChsd1JhdGlvICpsd1JhdGlvICAtIDEpL2x3UmF0aW8gO1xuICAgIH1cblxuICAgIHNwcmVhZE1heElkeCA9IHNwcmVhZDBJZHggKigxICsgcGhpRXcpO1xuICB9XG4gIC8vU2l0dWF0aW9uIDYgLSBXaW5kIEJsb3dzIGNyb3NzIFNsb3BlXG4gIGVsc2Uge1xuXG4gICAgc3BsaXQgID0gd2luZERpck1hcFtpZHhdO1xuICAgIGlmICh1cFNsb3BlIDw9IHNwbGl0IClcbiAgICAgIHNwbGl0ICA9IHNwbGl0ICAtIHVwU2xvcGU7XG4gICAgZWxzZVxuICAgICAgc3BsaXQgID0gMzYwLjAgLSB1cFNsb3BlICsgc3BsaXQgO1xuXG4gICAgc3BsaXQgID0gRGVnVG9SYWQoc3BsaXQgKTtcbiAgICB4ICAgPSBzcHJlYWQwSWR4ICoocGhpU2xvcGUgKyBwaGlXaW5kKk1hdGguY29zKHNwbGl0ICkpO1xuICAgIHkgICA9IHNwcmVhZDBJZHggKihwaGlXaW5kKk1hdGguc2luKHNwbGl0ICkpO1xuICAgIFJ2ICA9IE1hdGguc3FydCh4ICp4ICArIHkgKnkgKTtcblxuICAgIHNwcmVhZE1heCA9IHNwcmVhZDBJZHggICsgUnYgO1xuICAgIHBoaUV3ID0gc3ByZWFkTWF4IC8gc3ByZWFkMElkeCAgLSAxO1xuICAgIGEgID0gTWF0aC5hc2luKE1hdGguYWJzKHkgKSAvIFJ2ICk7XG4gICAgaWYoeCAgPj0gMC4wKVxuICAgICAgYSAgPSAoeSAgPj0gMC4wKSA/IGEgICAgICAgICAgIDogTV9QSSArIE1fUEkgLSBhIDtcbiAgICBlbHNlXG4gICAgICBhICA9ICh5ICA+PSAwLjApID8gKE1fUEkgLSBhICkgOiBNX1BJICsgYSA7XG4gICAgXG4gICAgc3BsaXQgID0gUmFkVG9EZWcoYSApO1xuICAgIGlmICh1cFNsb3BlICsgc3BsaXQgID4gMzA2LjApXG4gICAgICBhemltdXRoTWF4TWFwW2lkeF0gPSB1cFNsb3BlICsgc3BsaXQgIC0gMzYwLjA7XG4gICAgZWxzZVxuICAgICAgYXppbXV0aE1heE1hcFtpZHhdID0gdXBTbG9wZSArIHNwbGl0IDtcblxuICAgIGVmZmVjdGl2ZVdpbmQgID0gTWF0aC5wb3cocGhpRXcqZnVlbFByb3BzLkZ1ZWxfV2luZEUsIDEvd2luZEIpO1xuICAgIFxuICAgIC8vRG8gZWZmZWN0aXZlIHdpbmQgb25seSBpZiBwaGlFdyA+IHNtaWRnZW5cbiAgICBpZihwaGlFdyA+IHNtaWRnZW4pIHtcblxuICAgICAgbWF4V2luZCAgPSAwLjkqcnhJbnRlbnNpdHlNYXBbaWR4XTtcbiAgICAgIGlmKGVmZmVjdGl2ZVdpbmQgID4gIG1heFdpbmQgKSB7XG4gICAgICAgIHBoaUV3ID0gd2luZEsqTWF0aC5wb3cobWF4V2luZCAsIHdpbmRCKTtcbiAgICAgICAgZWZmZWN0aXZlV2luZCAgPSBtYXhXaW5kIDtcbiAgICAgICAgc3ByZWFkTWF4ID0gc3ByZWFkMElkeCAqKDEgKyBwaGlFdyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYoZWZmZWN0aXZlV2luZCAgPiAgc21pZGdlbikge1xuXG4gICAgICBsd1JhdGlvICA9IDEuMCArIDAuMDAyODQwOTA5ICogZWZmZWN0aXZlV2luZCA7XG4gICAgICBpZiAobHdSYXRpbyAgPiAxLjAwMDAxKVxuICAgICAgICBlY2NlbnRyaWNpdHlNYXBbaWR4XSA9IE1hdGguc3FydChsd1JhdGlvICpsd1JhdGlvICAtIDEpL2x3UmF0aW8gO1xuICAgIH1cblxuICAgIHNwcmVhZE1heElkeCA9IHNwcmVhZE1heDtcbiAgICBwaGlFZmZXaW5kTWFwW2lkeF0gPSBwaGlFdztcblxuICB9XG5cbiAgcmV0dXJuICggc3ByZWFkTWF4SWR4KTtcbn1cblxuZnVuY3Rpb24gc3ByZWFkQW55QXppbXV0aChpZHgsIGF6aW11dGgsIHBoaUVmZldpbmRNYXAsIGF6aW11dGhNYXhNYXAsIHJvc01heE1hcCwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWNjZW50cmljaXR5TWFwLCByb3MwTWFwIClcbntcblxuICB2YXIgc3ByZWFkQW55O1xuICB2YXIgZWNjZW50cmljaXR5O1xuXG4gIGlmIChwaGlFZmZXaW5kTWFwW2lkeF0gPCBzbWlkZ2VuICYmIGF6aW11dGhNYXhNYXBbaWR4XSA9PT0gYXppbXV0aClcbiAgXG4gICAgc3ByZWFkQW55ID0gcm9zTWF4TWFwW2lkeF07XG4gIFxuICBlbHNlIHtcbiAgXG4gICAgaWYgKChkaXIgPSBNYXRoLmFicyhhemltdXRoTWF4TWFwW2lkeF0gLSBhemltdXRoKSkgPiAxODApXG4gICAgICBkaXIgPSAzNjAuMCAtIGRpcjtcblxuICAgIGRpciA9IERlZ1RvUmFkKGRpcik7XG5cbiAgICBlY2NlbnRyaWNpdHkgPSBlY2NlbnRyaWNpdHlNYXBbaWR4XTtcbiAgICBzcHJlYWRBbnkgPSByb3NNYXhNYXBbaWR4XSooMSAtIGVjY2VudHJpY2l0eSkvKDEgLSBlY2NlbnRyaWNpdHkqTWF0aC5jb3MoZGlyKSk7XG5cbiAgICBpZiAoc3ByZWFkQW55ID4gSU5GKVxuICAgICAgc3ByZWFkQW55ID0gcm9zME1hcFtpZHhdO1xuXG4gIH1cblxuICByZXR1cm4gc3ByZWFkQW55O1xufVxuXG5cbmZ1bmN0aW9uIERlZ1RvUmFkKHgpIHtcbiAgeCAqPSAwLjAxNzQ1MzI5MztcbiAgcmV0dXJuIHg7XG59XG5cbmZ1bmN0aW9uIFJhZFRvRGVnKHgpIHtcbiAgeCAqPSA1Ny4yOTU3Nzk1MTtcbiAgcmV0dXJuIHg7XG59XG5cbmZ1bmN0aW9uIGVxdWFsKHgseSl7XG4gIGlmICggTWF0aC5hYnMoeC15KTxzbWlkZ2VuIClcbiAgICByZXR1cm4gdHJ1ZTtcbiAgZWxzZVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0cy53aW5kQW5kU2xvcGUgPSB3aW5kQW5kU2xvcGU7XG5leHBvcnRzLnNwcmVhZEFueUF6aW11dGggPSBzcHJlYWRBbnlBemltdXRoO1xuZXhwb3J0cy5ub1dpbmROb1Nsb3BlID0gbm9XaW5kTm9TbG9wZTtcbiJdfQ==(1)
});
;