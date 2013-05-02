var test = require('tape');
var wrap = require('./wrap');
var fs = require('fs');
var fireLib = require('../src/fireLib');



var ignMapCaseA_50x50 = fs.readFileSync('./verification/ignMapCaseA_50x50.map');
var ignMapCaseA_100x100 = fs.readFileSync('./verification/ignMapCaseA_100x100.map');
var ignMapCaseA_150x150 = fs.readFileSync('./verification/ignMapCaseA_150x150.map');

var ignMapCaseA_50x50 = fs.readFileSync('./verification/ignMapCaseA_50x50.map');
var ignMapCaseA_100x100 = fs.readFileSync('./verification/ignMapCaseA_100x100.map');
var ignMapCaseA_150x150 = fs.readFileSync('./verification/ignMapCaseA_150x150.map');

//Case A tests
var MOISTUREPART = 11;
var WINDU = 1;
var WINDDIR = 135;

test('Ignition Maps Case A', function (t) {
  t.ok(wrap(50,50, MOISTUREPART, WINDU, WINDDIR) === ignMapCaseA_50x50, "Case A 50x50 ok");
  t.ok(wrap(100,100, MOISTUREPART, WINDU, WINDDIR) === ignMapCaseA_100x100, "Case A 100x100 ok");
  t.ok(wrap(150,150, MOISTUREPART, WINDU, WINDDIR) === ignMapCaseA_150x150, "Case A 150x150 ok");
  t.end();
});

//Case B tests
MOISTUREPART = 11;
WINDU = 0;
WINDDIR = 0;
test('Ignition Maps Case B', function (t) {
  t.ok(wrap(50,50, MOISTUREPART, WINDU, WINDDIR) === ignMapCaseB_50x50, "Case B 50x50 ok");
  t.ok(wrap(100,100, MOISTUREPART, WINDU, WINDDIR) === ignMapCaseB_100x100, "Case B 100x100 ok");
  t.ok(wrap(150,150, MOISTUREPART, WINDU, WINDDIR) === ignMapCaseB_150x150, "Case B 150x150 ok");
  t.end();
});

//fireLib stuff
//Creating fuel properties oject in a slopy way

var flVerificationFile = fs.readFileSync('flVerification.txt');

console.log(flVerificationFile);

var fuelProps = createFuelProps();

var idx = 0;
var moistMap =        [0.1];
var rxIntensityMap =  [0];

var Ros0 = fireLib.noWindNoSlope(idx, fuelProps, moistMap, rxIntensityMap);

var slopeMap =        [0.5];
var ros0Map =         [Ros0];
var windUMap =        [1];
var windDirMap =      [100];
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


test('FireLib', function (t) {
  t.ok(Ros0 === fireLibRos0, "noWindnoSlope ok");
  t.ok(RosMAX === fireLibRosMAX, "Windandlope ok");
  t.ok(Ros === fireLibRos, "SpreadAny ok");
  t.end();
});



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



