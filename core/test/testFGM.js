/*

  Test for the fire growth model

  The ignition maps produced in two test cases are compared with 
  the results from a C fireLib implementation(wich was already validated)

  Fuel Properties of ignMaps of fireLib-C use NFFL Model 1 (DON'T FUCK UP)

*/

var test = require('tap').test;

var wrap = require('./wrap');

//Compute residue
function Res(ignMapTest,ignMapValid, Rows, Cols){

  var res = 0;
  var row, cell;

  for (row =0, cell = 0; row < Rows; row++ )
    for (var col = 0; col < Cols; col++, cell++ )
      res += Math.abs(ignMapTest[cell] - ignMapValid[cell]);

    res /= Cols*Rows;

  return res;
}

function fileToArray(filename, cells){

  var fs = require('fs');

  var array = Array(cells);

  var data = fs.readFileSync(filename,'utf8');

  var mapString = data.match(/[\d.]+/g);

  for (var cell = 0; cell < cells; cell++)
      array[cell] = parseFloat(mapString[cell]);

  return array;
}

function createRendezVous(count, cb) {
  return function() { if (--count <= 0) cb(); };
}

test('Ignition Maps Case A', function (t) {

  //Case A tests
  var terrain = null;
  var MOISTUREPART = 11;
  var WINDU = 1;
  var WINDDIR = 135;
  //NFFL1 CARALHOOOOOOOOO!!!!!!!!!!!!!!!!

  var validMaps = {};

  //Load fireLib-C validated maps
  function loadValidMap(size) {
    validMaps[size] = fileToArray('./ignMapCaseA_'+size+'x'+size+'.map', size*size);
  }

  loadValidMap(50);
  loadValidMap(100);
  loadValidMap(150);

  var rendezVous = createRendezVous(3, doTheTest);
  var testMaps = {};

  wrap(50, 50, MOISTUREPART, WINDU, WINDDIR, saveMap(50), terrain);
  wrap(100, 100, MOISTUREPART, WINDU, WINDDIR, saveMap(100), terrain);
  wrap(150, 150, MOISTUREPART, WINDU, WINDDIR, saveMap(150), terrain);

  function saveMap(size) {
    return function(ignMap) {
      testMaps[size] = ignMap;
      rendezVous();
    };
  }

  function doTheTest() {
    var res;

    res = Res(testMaps[50], validMaps[50], 50, 50 );
    t.ok( res < 1E-1 , "Case A 50x50 ok"); console.log('\nCase A 50x50 res:',res);
    
    res = Res(testMaps[100], validMaps[100], 100, 100 );
    t.ok( res < 1E-1, "Case A 100x100 ok"); console.log('Case A 100x100 res:',res);

    res = Res(testMaps[150], validMaps[150], 150, 150 );
    t.ok( res < 1E-1, "Case A 150x150 ok"); console.log('Case A 150x150 res:',res,'\n');

    t.end();
  }
});

test('Ignition Maps Case B', function (t) {

  //Case B tests
  var terrain = null;
  var MOISTUREPART = 11;
  var WINDU = 0;
  var WINDDIR = 0;
  //NFFL1 CARALHOOOOOOOOO!!!!!!!!!!!!!!!!

  var validMaps = {};

  //Load fireLib-C validated maps
  function loadValidMap(size) {
    validMaps[size] = fileToArray('./ignMapCaseB_'+size+'x'+size+'.map', size*size);
  }

  loadValidMap(50);
  loadValidMap(100);
  loadValidMap(150);

  var rendezVous = createRendezVous(3, doTheTest);
  var testMaps = {};

  wrap(50, 50, MOISTUREPART, WINDU, WINDDIR, saveMap(50), terrain);
  wrap(100, 100, MOISTUREPART, WINDU, WINDDIR, saveMap(100), terrain);
  wrap(150, 150, MOISTUREPART, WINDU, WINDDIR, saveMap(150), terrain);

  function saveMap(size) {
    return function(ignMap) {
      testMaps[size] = ignMap;
      rendezVous();
    };
  }

  function doTheTest() {
    var res;

    res = Res(testMaps[50], validMaps[50], 50, 50 );
    t.ok( res < 1E-1 , "Case B 50x50 ok"); console.log('\nCase B 50x50 res:',res);
    
    res = Res(testMaps[100], validMaps[100], 100, 100 );
    t.ok( res < 1E-1, "Case B 100x100 ok"); console.log('Case B 100x100 res:',res);

    res = Res(testMaps[150], validMaps[150], 150, 150 );
    t.ok( res < 1E-1, "Case B 150x150 ok"); console.log('Case B 150x150 res:',res,'\n');

    t.end();
  }
});


test('Ignition Maps Case C', function (t) {

  var MOISTUREPART = 11;
  var WINDU = 0;
  var WINDDIR = 0;
  var terrain = {0:0 , 1: 0};//No slope, no aspect
  //NFFL1 CARALHOOOOOOOOO!!!!!!!!!!!!!!!!

  var validMaps = {};

  //Load fireLib-C validated maps
  function loadValidMap(size) {
    validMaps[size] = fileToArray('./ignMapCaseC_'+size+'x'+size+'.map', size*size);
  }

  loadValidMap(50);
  loadValidMap(100);

  var rendezVous = createRendezVous(2, doTheTest);
  var testMaps = {};

  wrap(50, 50, MOISTUREPART, WINDU, WINDDIR, saveMap(50), terrain);
  wrap(100, 100, MOISTUREPART, WINDU, WINDDIR, saveMap(100), terrain);

  function saveMap(size) {
    return function(ignMap) {
      testMaps[size] = ignMap;
      rendezVous();
    };
  }

  function doTheTest() {
    var res;

    res = Res(testMaps[50], validMaps[50], 50, 50 );
    t.ok( res < 1E-1 , "Case C 50x50 ok"); console.log('\nCase C: 50x50 res:',res);
    
    res = Res(testMaps[100], validMaps[100], 100, 100 );
    t.ok( res < 1E-1, "Case C 100x100 ok"); console.log('Case C: 100x100 res:',res,'\n');

    t.end();
  }
});
