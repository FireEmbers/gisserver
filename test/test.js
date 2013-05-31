/*

  Test for PostGis CLC server

  A query clips a certain terrain area and compares it to a hopefully equal stored array

*/

var test = require('tap').test;

var getCorine = require('../gisserver');

var write2D = require('../../utils/write2D');

var rows1 = 50;
var cols1 = 40;

var cols2 = 50;
var rows2 = 50;

var W = 2656127; 
var E = 2661391;
var N = 1954572;
var S = 1949573;

function fileToArraySync(filename, cells){

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

//Compute residue
function Res(mapA, mapB, Rows, Cols){

  var res = 0;
  var row, cell;

  for (row =0, cell = 0; row < Rows; row++ )
    for (var col = 0; col < Cols; col++, cell++ )
      res += Math.abs(mapA[cell] - mapB[cell]);

    res /= Cols*Rows;

  return res;
}

test('Test', function (t) {

  validMaps = {};

  //Load validated maps
  function loadValidMap(size,r,c) {
    validMaps[size] = fileToArraySync('./goldMaps/terrain'+size+'.map', r*c);
  }

  loadValidMap('small',rows1, cols1);
  loadValidMap('big', rows2, cols2);

  var rendezVous = createRendezVous(2, doTheTest);
  var testMaps = {};

  getCorine( N.toString(), S.toString(), E.toString(), W.toString(), rows1, cols1, saveMap('small'));
  getCorine( N.toString(), S.toString(), E.toString(), W.toString(), rows2, cols2, saveMap('big'));

  function saveMap(size) {
    return function(data) {
      testMaps[size] = data;
      rendezVous();
    };
  }

  function doTheTest(){

    var res;

    res = Res(testMaps['small'], validMaps['small'], rows1, cols1 );
    t.ok( res < 1E-6 , "Small map is ok, res: "+res.toString());

    res = Res(testMaps['big'], validMaps['big'], rows2, cols2 );
    t.ok( res < 1E-6 , "Big map is ok, res: "+res.toString());

    t.end();
  }
});


