// ROWS = 100;

// COLS = 100;

// print(JSON.parse(map));

// function print(data) {
//   var fs = require('fs');
//   var util = require('util');
//   var filename = 'results.csv';
//   var options = {
//   flags: 'w',
//   encoding: 'utf8',
//   mode: 0666
//   };
//   var stream = fs.createWriteStream(filename, options);
//   var row, line;

//   for (i=0; i<ROWS; ++i) {
//     row = data.splice(0, COLS);
//     row.unshift(new Array(COLS+1).join(' %s').slice(1)+'\n');
//     line = util.format.apply(util, row);
//     stream.write(line);
//   }
//   stream.end();
// }

function Run(dataArray){
  var ROWS = ROWS_PC;
  var COLS = COLS_PC;
  var MOISTUREPART = dataArray[0]/100;             //fraction
  var WINDU = dataArray[1]*196.850393701;       // [m/s] - > ft/min (2.23 m/s = 5mph)
  var WINDDIR =dataArray[2];                    //degrees clockwise from north
  //var ASPECT = 203;                   //degrees clockwise from north
  //var SLOPE = 0.5;                     //fraction rise / reach
  var L = metersToFeet(3000);         //Terrain Length
  var W = metersToFeet(3000);         //Terrain Width

  var CellWd = L/ROWS;
  var CellHt = W/COLS;

  var INF = 9999999999999;
  var M_PI = 3.141592653589793;
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

  for (cell = 0; cell < cells; cell++){ 
    ros0Map[cell]     = noWindNoSlope(cell);
    rosMaxMap[cell]   = windAndSlope(cell);
  }

  //Ignition point at terrain midle
  ignMap[Math.floor(COLS/4) + Math.floor(ROWS/4)*COLS] = 0;

  //Compute distance and Azimuth of neighbour
  calcDistAzm();


  //Call and time FGM cycle
  FGM();
  //console.log("FGM time:", time(FGM)/1000, "sec");

  function noWindNoSlope(idx){

    var AreaWtg;
    var ratio; 
    var rxIntensity;
    var Spread0Idx;


    AreaWtg = fuelProps.Fuel_AreaWtg;

    ratio = AreaWtg*moistMap[idx]/fuelProps.Fuel_Mext;

    rxIntensity =  fuelProps.Fuel_LifeRxFactor                       
                    *(1-2.59*ratio + 5.11*ratio*ratio - 3.52*ratio*ratio*ratio); //EtaM
    
    rxIntensityMap[idx] = rxIntensity;

    Spread0Idx = fuelProps.Fuel_PropFlux*rxIntensity /
                        ((250. + 1116.*moistMap[idx])*AreaWtg*    //Qig - Heat of pre Ignition
                         fuelProps.Fuel_LifeAreaWtg*
                         fuelProps.Fuel_SigmaFactor*
                         fuelProps.Fuel_BulkDensity);

    return Spread0Idx;
  }

  function windAndSlope(idx){

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

    if((upSlope = aspectMap[idx]) >= 180.)
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

        lwRatio  = 1. + 0.002840909 * effectiveWind ;
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

        lwRatio  = 1. + 0.002840909 * effectiveWind;
        if (lwRatio  > 1.00001)
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
        split  = 360. - upSlope + split ;

      split  = DegToRad(split );
      x   = spread0Idx *(phiSlope + phiWind*Math.cos(split ));
      y   = spread0Idx *(phiWind*Math.sin(split ));
      Rv  = Math.sqrt(x *x  + y *y );

      spreadMax = spread0Idx  + Rv ;
      phiEw = spreadMax / spread0Idx  - 1;
      a  = Math.asin(Math.abs(y ) / Rv );
      if(x  >= 0.)
        a  = (y  >= 0.) ? a           : M_PI + M_PI - a ;
      else
        a  = (y  >= 0.) ? (M_PI - a ) : M_PI + a ;
      
      split  = RadToDeg(a );
      if (upSlope + split  > 306.)
        azimuthMaxMap[idx] = upSlope + split  - 360.;
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

        lwRatio  = 1. + 0.002840909 * effectiveWind ;
        if (lwRatio  > 1.00001)
          eccentricityMap[idx] = Math.sqrt(lwRatio *lwRatio  - 1)/lwRatio ;
      }

      spreadMaxIdx = spreadMax;
      phiEffWindMap[idx] = phiEw;

    }

    return ( spreadMaxIdx);

  }

  function spreadAnyAzimuth(idx, azimuth){

    var spreadAny;
    var eccentricity;

    if (phiEffWindMap[idx] < smidgen && azimuthMaxMap[idx] === azimuth)
    
      spreadAny = rosMaxMap[idx];
    
    else {
    
      if ((dir = Math.abs(azimuthMaxMap[idx] - azimuth)) > 180)
        dir = 360. - dir;

      dir = DegToRad(dir);

      eccentricity = eccentricityMap[idx];
      spreadAny = rosMaxMap[idx]*(1 - eccentricity)/(1 - eccentricity*Math.cos(dir));

      if (spreadAny > INF)
        spreadAny = ros0Map[idx];

    }

    return spreadAny;

  }

var md5 = (function() {
function md5cycle(x, k) {
var a = x[0], b = x[1], c = x[2], d = x[3];

a = ff(a, b, c, d, k[0], 7, -680876936);
d = ff(d, a, b, c, k[1], 12, -389564586);
c = ff(c, d, a, b, k[2], 17,  606105819);
b = ff(b, c, d, a, k[3], 22, -1044525330);
a = ff(a, b, c, d, k[4], 7, -176418897);
d = ff(d, a, b, c, k[5], 12,  1200080426);
c = ff(c, d, a, b, k[6], 17, -1473231341);
b = ff(b, c, d, a, k[7], 22, -45705983);
a = ff(a, b, c, d, k[8], 7,  1770035416);
d = ff(d, a, b, c, k[9], 12, -1958414417);
c = ff(c, d, a, b, k[10], 17, -42063);
b = ff(b, c, d, a, k[11], 22, -1990404162);
a = ff(a, b, c, d, k[12], 7,  1804603682);
d = ff(d, a, b, c, k[13], 12, -40341101);
c = ff(c, d, a, b, k[14], 17, -1502002290);
b = ff(b, c, d, a, k[15], 22,  1236535329);

a = gg(a, b, c, d, k[1], 5, -165796510);
d = gg(d, a, b, c, k[6], 9, -1069501632);
c = gg(c, d, a, b, k[11], 14,  643717713);
b = gg(b, c, d, a, k[0], 20, -373897302);
a = gg(a, b, c, d, k[5], 5, -701558691);
d = gg(d, a, b, c, k[10], 9,  38016083);
c = gg(c, d, a, b, k[15], 14, -660478335);
b = gg(b, c, d, a, k[4], 20, -405537848);
a = gg(a, b, c, d, k[9], 5,  568446438);
d = gg(d, a, b, c, k[14], 9, -1019803690);
c = gg(c, d, a, b, k[3], 14, -187363961);
b = gg(b, c, d, a, k[8], 20,  1163531501);
a = gg(a, b, c, d, k[13], 5, -1444681467);
d = gg(d, a, b, c, k[2], 9, -51403784);
c = gg(c, d, a, b, k[7], 14,  1735328473);
b = gg(b, c, d, a, k[12], 20, -1926607734);

a = hh(a, b, c, d, k[5], 4, -378558);
d = hh(d, a, b, c, k[8], 11, -2022574463);
c = hh(c, d, a, b, k[11], 16,  1839030562);
b = hh(b, c, d, a, k[14], 23, -35309556);
a = hh(a, b, c, d, k[1], 4, -1530992060);
d = hh(d, a, b, c, k[4], 11,  1272893353);
c = hh(c, d, a, b, k[7], 16, -155497632);
b = hh(b, c, d, a, k[10], 23, -1094730640);
a = hh(a, b, c, d, k[13], 4,  681279174);
d = hh(d, a, b, c, k[0], 11, -358537222);
c = hh(c, d, a, b, k[3], 16, -722521979);
b = hh(b, c, d, a, k[6], 23,  76029189);
a = hh(a, b, c, d, k[9], 4, -640364487);
d = hh(d, a, b, c, k[12], 11, -421815835);
c = hh(c, d, a, b, k[15], 16,  530742520);
b = hh(b, c, d, a, k[2], 23, -995338651);

a = ii(a, b, c, d, k[0], 6, -198630844);
d = ii(d, a, b, c, k[7], 10,  1126891415);
c = ii(c, d, a, b, k[14], 15, -1416354905);
b = ii(b, c, d, a, k[5], 21, -57434055);
a = ii(a, b, c, d, k[12], 6,  1700485571);
d = ii(d, a, b, c, k[3], 10, -1894986606);
c = ii(c, d, a, b, k[10], 15, -1051523);
b = ii(b, c, d, a, k[1], 21, -2054922799);
a = ii(a, b, c, d, k[8], 6,  1873313359);
d = ii(d, a, b, c, k[15], 10, -30611744);
c = ii(c, d, a, b, k[6], 15, -1560198380);
b = ii(b, c, d, a, k[13], 21,  1309151649);
a = ii(a, b, c, d, k[4], 6, -145523070);
d = ii(d, a, b, c, k[11], 10, -1120210379);
c = ii(c, d, a, b, k[2], 15,  718787259);
b = ii(b, c, d, a, k[9], 21, -343485551);

x[0] = add32(a, x[0]);
x[1] = add32(b, x[1]);
x[2] = add32(c, x[2]);
x[3] = add32(d, x[3]);

}

function cmn(q, a, b, x, s, t) {
a = add32(add32(a, q), add32(x, t));
return add32((a << s) | (a >>> (32 - s)), b);
}

function ff(a, b, c, d, x, s, t) {
return cmn((b & c) | ((~b) & d), a, b, x, s, t);
}

function gg(a, b, c, d, x, s, t) {
return cmn((b & d) | (c & (~d)), a, b, x, s, t);
}

function hh(a, b, c, d, x, s, t) {
return cmn(b ^ c ^ d, a, b, x, s, t);
}

function ii(a, b, c, d, x, s, t) {
return cmn(c ^ (b | (~d)), a, b, x, s, t);
}

function md51(s) {
txt = '';
var n = s.length,
state = [1732584193, -271733879, -1732584194, 271733878], i;
for (i=64; i<=s.length; i+=64) {
md5cycle(state, md5blk(s.substring(i-64, i)));
}
s = s.substring(i-64);
var tail = [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
for (i=0; i<s.length; i++)
tail[i>>2] |= s.charCodeAt(i) << ((i%4) << 3);
tail[i>>2] |= 0x80 << ((i%4) << 3);
if (i > 55) {
md5cycle(state, tail);
for (i=0; i<16; i++) tail[i] = 0;
}
tail[14] = n*8;
md5cycle(state, tail);
return state;
}

/* there needs to be support for Unicode here,
 * unless we pretend that we can redefine the MD-5
 * algorithm for multi-byte characters (perhaps
 * by adding every four 16-bit characters and
 * shortening the sum to 32 bits). Otherwise
 * I suggest performing MD-5 as if every character
 * was two bytes--e.g., 0040 0025 = @%--but then
 * how will an ordinary MD-5 sum be matched?
 * There is no way to standardize text to something
 * like UTF-8 before transformation; speed cost is
 * utterly prohibitive. The JavaScript standard
 * itself needs to look at this: it should start
 * providing access to strings as preformed UTF-8
 * 8-bit unsigned value arrays.
 */
function md5blk(s) { /* I figured global was faster.   */
var md5blks = [], i; /* Andy King said do it this way. */
for (i=0; i<64; i+=4) {
md5blks[i>>2] = s.charCodeAt(i)
+ (s.charCodeAt(i+1) << 8)
+ (s.charCodeAt(i+2) << 16)
+ (s.charCodeAt(i+3) << 24);
}
return md5blks;
}

var hex_chr = '0123456789abcdef'.split('');

function rhex(n)
{
var s='', j=0;
for(; j<4; j++)
s += hex_chr[(n >> (j * 8 + 4)) & 0x0F]
+ hex_chr[(n >> (j * 8)) & 0x0F];
return s;
}

function hex(x) {
for (var i=0; i<x.length; i++)
x[i] = rhex(x[i]);
return x.join('');
}

function md5(s) {
return hex(md51(s));
}

/* this function is much faster,
so if possible we use it. Some IEs
are the only ones I know of that
need the idiotic second function,
generated by an if clause.  */

function add32(a, b) {
return (a + b) & 0xFFFFFFFF;
}

return md5;
})();

  function FGM(){

    while (timeNext < INF){
      timeNow = timeNext;
      timeNext = INF;

      for ( row = 0; row < ROWS; row++){
        for ( col = 0; col < COLS; col++){
          cell = col + COLS*row;
          
          //If cell will burn only in the future, skips and update timeNext if necessary
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

            ros = spreadAnyAzimuth(cell, nAzm[n]);

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
  }

  //Return ignition map
  //return md5(JSON.stringify(ignMap));

  for (cell = 0; cell < ROWS*COLS; cell++)
    ignMap[cell] = parseFloat(ignMap[cell].toFixed(2));

  return JSON.stringify(ignMap);

  //"SpreadAtAzimuth"
  //function spreadAtAzimuth(){

  function time(func){
    var start = Date.now();
    func();
    var end = Date.now();
    return end - start;
  }

  function createFuelProps(){
    var array;
    fuelObj = new Object();

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



  function calcDistAzm(){
    for ( n = 0; n<nStencil; n++ ){
        nDist[n] = Math.sqrt ( nCol[n] * CellWd * nCol[n] * CellWd
                        + nRow[n] * CellHt * nRow[n] * CellHt );

        if (n < 8)
          nAzm[n] = n * 45.;
        else
        {

          nAzm[n] = Math.atan( (nCol[n] * CellWd) / (nRow[n] * CellHt) );

          if ( nCol[n] > 0  && nRow[n] < 0) //1st quadrant 
            nAzm[n] = RadToDeg(  Math.abs( nAzm[n] ));

          if ( nCol[n] > 0  && nRow[n] > 0) //2st quadrant 
            nAzm[n] = 180. - RadToDeg( nAzm[n] ) ;

          if ( nCol[n] < 0  && nRow[n] > 0) //3st quadrant 
            nAzm[n] = RadToDeg( Math.abs( nAzm[n] ) )+ 180.;

          if ( nCol[n] < 0  && nRow[n] < 0) //4st quadrant 
            nAzm[n] = 360. - RadToDeg( Math.abs( nAzm[n] ));
        }
    }
  }

  function DegToRad(x) {
    x *= 0.017453293;
    return x;
  } 

  function RadToDeg(x) {
    x *= 57.29577951;
    return x;
  }

  function feetToMeters(x){
    x *= 0.3048;
    return x;
  }

  function metersToFeet(x){
    x *= 3.2808399;
    return x;
  }

  function equal(x,y){
    if ( Math.abs(x-y)<smidgen )
      return true;
    else
      return false;
  }

  function loadTerrainMaps() {

    slopeMap = SLOPEMAP_PC;

    aspectMap = ASPECTMAP_PC;
  }

}

