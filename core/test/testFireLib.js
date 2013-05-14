/*

  Tests fireLib and is very good at it

  Fuel Properties are NFFL Model 1


*/

var test = require('tap').test;
var fs = require('fs');
var fireLib = require('../src/fireLib');

var flVerification = JSON.parse(fs.readFileSync('flVerification.txt','utf8'));

var fireLibRos0 = flVerification[0];
var fireLibRosMAX = flVerification[1];
var fireLibRos = flVerification[2];

var fuelProps = createFuelProps();


var idx = 0;
var moistMap =        [0.05];
var rxIntensityMap =  [0];

var Ros0 = fireLib.noWindNoSlope(idx, fuelProps, moistMap, rxIntensityMap);

var slopeMap =        [0.0];
var ros0Map =         [Ros0];
var windUMap =        [1];    //ft/min
var windDirMap =      [0];
var aspectMap =       [100];
var azimuthMaxMap =   [0];

var eccentricityMap = [0];
var phiEffWindMap =   [0];

var RosMAX = fireLib.windAndSlope(idx, fuelProps, slopeMap, ros0Map, windUMap, windDirMap, aspectMap,
                        azimuthMaxMap, eccentricityMap, phiEffWindMap, rxIntensityMap );

var azimuth =         45;
var rosMaxMap =       [RosMAX];

var Ros = fireLib.spreadAnyAzimuth(idx, azimuth, phiEffWindMap, azimuthMaxMap, rosMaxMap, 
                            eccentricityMap, ros0Map );

test('FireLib verification', function (t) {
  t.ok(Math.abs(Ros0 - fireLibRos0) < 1E-3, "noWindnoSlope ok");
  t.ok(Math.abs(RosMAX - fireLibRosMAX) < 1E-3, "Windandlope ok");
  t.ok(Math.abs(Ros - fireLibRos) < 1E-3, "SpreadAny ok");
  t.end();
});





function createFuelProps(){
    var array;
    fuelObj = {};

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






 



