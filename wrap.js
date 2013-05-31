var getCorine = require('./gisserver');
var write2D = require('../utils/write2D');

var W = 2656127; 
var E = 2661391;
var N = 1954572;
var S = 1949573;

var rows = 50;
var cols = 50;

var fuelMap;

console.log('map length:', E-W);
console.log('map height:', N-S);

getCorine( N.toString(), S.toString(), E.toString(), W.toString(), rows, cols, function(data){ write2D (data, rows, cols, 'terrainsmall.map') });