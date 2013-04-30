stringTerrainMaps();

function stringTerrainMaps() {

  var cell, COLS=100, ROWS=100;
  var Map  = new Array (ROWS*COLS); 
  //var aspectMap = new Array (ROWS*COLS);
  var mapString;//, slopeMap;

  fs = require('fs');

  var data = fs.readFileSync('malcataHeight.grass', 'utf8');
  var mapString = data.replace(/(.+?\n){6}/,'').match(/[\d.]+/g);

  for (cell = 0; cell < COLS*ROWS; cell++)
    Map[cell] = parseFloat(mapString[cell]);

//console.log(JSON.stringify(Map) + '\n\n');

console.log(Map);

//  data  = fs.readFileSync('malcataAspect.grass', 'utf8');
//  stringMap = data.replace(/(.+?\n){6}/,'').match(/[\d.]+/g);

//  for (cell = 0; cell < COLS*ROWS; cell++)
//    aspectMap[cell] = parseFloat(stringMap[cell]);  

//  console.log(JSON.stringify(aspectMap));

}
