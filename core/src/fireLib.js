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
