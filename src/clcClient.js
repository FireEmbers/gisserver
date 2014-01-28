//The clc layers are all in one table merged_CLC2006_
//there's only data available for portugal cont.

var pg = require('pg').native;

var config = {
  user: 'fsousa',
  password: null,
  host: '/var/run/postgresql',
  database: 'gisdb',
  port: '5432' //5432 at hicks, 5433 at baelish
};

function Rendezvous(count, cb) {
  return function() {
  if (--count === 0)
  cb();
  };
}

var qc = 0
module.exports = function( N, S, E, W, rows, cols, callback){

  var width = parseFloat(E) - parseFloat(W);
  var height = parseFloat(N) - parseFloat(S);

  var client1 = new pg.Client(config);
  var client2 = new pg.Client(config);
  var client3 = new pg.Client(config);
  var client4 = new pg.Client(config);

  client1.connect(function(err) {
    if(err) {
      return callback('could not connect to postgres with client1: '+ err, null);
  }});

  client2.connect(function(err) {
    if(err) {
      return callback('could not connect to postgres with client2: '+ err, null);
  }});

  client3.connect(function(err) {
    if(err) {
      return callback('could not connect to postgres with client3: '+ err, null);
  }});

  client4.connect(function(err) {
    if(err) {
      return callback('could not connect to postgres with client4: '+ err, null);
  }});

  //set variables
  client1.query('set search_path to "$user", "public", "gis_schema";');
  client2.query('set search_path to "$user", "public", "gis_schema";');
  client3.query('set search_path to "$user", "public", "gis_schema";');
  client4.query('set search_path to "$user", "public", "gis_schema";');

  var map = new Array(rows*cols);

  var rendezVous = Rendezvous(rows*cols, function(){
    client1.end();
    client2.end();
    client3.end();
    client4.end();
    callback(null, map);
  });

  var clients = {
    1: client1,
    2: client2,
    3: client3,
    4: client4
  };

  for (var row = 0; row < rows; row++ ){
    for (var col = 0; col < cols; col++ ){

      var cell = col + row * cols;

      var XX = parseFloat(W) + col/(cols-1)*width;
      var YY = parseFloat(N) - row/(rows-1)*height;

      raster(clients, XX, YY, storeCell(cell));

    }
  }

  function storeCell(cell){
    return function(data){
      map[cell] = data;
      rendezVous();
    };
  }


  function raster(clArray, XX, YY, cb){

    rasterLayer(clArray, XX, YY, onResult);

    function onResult (result) {
      cb(result);
    }

  }

  function getPointString(XX,YY){
    return 'ST_GeomFromText(\'POINT('+ XX.toString() +' '+ YY.toString() +')\', 3035)';
  }

  function rasterLayer(clients, XX, YY, cb){

    var pointString = getPointString(XX,YY);

    var r = quadDice();
    function quadDice(){
      var randomN = Math.random();
      if (randomN < 0.25)
        return 1;
      else if ( randomN < 0.5)
        return 2;
      else if ( randomN < 0.75)
        return 3;
      else
        return 4;
    }

    var queryString = 'select a.code_06 from merged_CLC2006_ as a where ST_Contains(a.the_geom, '+pointString+') limit 1;';

    clients[r].query(queryString, onResults);

    function onResults(err, result){

      if (err) callback(err, null);
      cb( result.rows[0]['code_06'] );
    }
  }

};