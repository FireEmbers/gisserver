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

module.exports = function( N, S, E, W, rows, cols, cb){

  var width = parseFloat(E) - parseFloat(W);
  var height = parseFloat(N) - parseFloat(S);

  var client = new pg.Client(config);

  client.connect(function(err) {
    if(err) {
      throw 'could not connect to postgres' + err;
  }});

  //set variables
  client.query('set search_path to "$user", "public", "gis_schema";');

  var map = new Array(rows*cols);

  var queryString = 'CREATE TEMP TABLE pts (the_geom GEOMETRY);';

  var rendezVous = Rendezvous(rows*cols, function(){
    queryString +=
    'SELECT a.code_06, \
      ST_AsText(pts.the_geom) AS pt \
      FROM merged_clc2006_ a \
      JOIN pts \
      ON ST_Contains(a.the_geom, pts.the_geom); \
      DROP TABLE pts;';

    client.query(queryString, onResults);
  });

  function onResults(err, result){
    if (err) throw err;
    console.log(result)
    client.end();
  }


  for (var row = 0; row < rows; row++ ){
    for (var col = 0; col < cols; col++ ){

      var cell = col + row * cols;

      var XX = parseFloat(W) + col/(cols-1)*width;
      var YY = parseFloat(N) - row/(rows-1)*height;

      buildQuery(XX, YY, rendezVous);

    }
  }

  function buildQuery(XX, YY, rendezVous) {
    queryString += 'INSERT INTO pts VALUES (ST_SetSRID(ST_MakePoint(' +
      XX + ',' + YY +'),3035));';
    rendezVous();
  }

};