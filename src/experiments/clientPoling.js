//The clc layers are all in one table merged_CLC2006_
//there's only data available for portugal coallbackt.

var pg = require('pg');

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

module.exports = function( N, S, E, W, rows, cols, callback){

  var width = parseFloat(E) - parseFloat(W);
  var height = parseFloat(N) - parseFloat(S);

  var map = new Array(rows*cols);

  pg.connect(config, onConnection);

  function onConnection(err, client, done){

    if(err)
      return callback('could not connect to postgres with client:' + err, null);

    execClient(client, done);
  }

  function execClient(client, done) {

    client.query('set search_path to "$user", "public", "gis_schema";');

    var rendezVous = Rendezvous(rows*cols, function(){
      done();
      return callback(null, map);
    });

    for (var row = 0; row < rows; row++ ){
      for (var col = 0; col < cols; col++ ){

        var cell = col + row * cols;

        var XX = parseFloat(W) + col/(cols-1)*width;
        var YY = parseFloat(N) - row/(rows-1)*height;

        raster(client, XX, YY, done, storeCell(cell));

      }
    }

    function storeCell(cell){
      return function(data){
        map[cell] = data;
        rendezVous();
      }
    }
  }
};

function raster(client, XX, YY, done, cb){

  rasterLayer(client, XX, YY, done, onResult);

  function onResult (result) {
    cb(result);
  }

}

function getPointString(XX,YY){
  return 'ST_GeomFromText(\'POINT('+ XX.toString() +' '+ YY.toString() +')\', 3035)';
}

function rasterLayer(client, XX, YY, done, cb){

  var pointString = getPointString(XX,YY);

  var queryString = 'select a.code_06 from merged_CLC2006_ as a where ST_Contains(a.the_geom, '+pointString+');';

  client.query(queryString, onResults);

  function onResults(err, result){
    if (err) cb(err, null);
    done();
    cb(null, result.rows[0]['code_06'] );
  }
}
