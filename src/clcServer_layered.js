//The CLC database is organized by tables, one for each clc table

var pg = require('pg');
  var config = {
    user: 'fsousa',
    password: null,
    host: '/var/run/postgresql',
    database: 'gisdb'
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

  client.connect();

  //set variables
  client.query('set search_path to "$user", "public", "gis_schema";');

  var map = new Array(rows*cols);

  var rendezVous = Rendezvous(rows*cols, function(){
    client.end();
    cb(map);
  });


  for (var row = 0; row < rows; row++ ){
    for (var col = 0; col < cols; col++ ){

      var cell = col + row * cols;

      var XX = parseFloat(W) + col/(cols-1)*width;
      var YY = parseFloat(N) - row/(rows-1)*height;

      raster(client, XX, YY, storeCell(cell)); 

    }
  }

  function storeCell(cell){
    return function(data){
      map[cell] = data;
      rendezVous();
    }
  }
};

function raster(client, XX, YY, cb){

  var layersRemaining = layers.slice();

  next();

  function next() {

    doRasterLayer(layersRemaining.shift());
  }

  function doRasterLayer(layer) {

    rasterLayer(client, XX, YY, layer, onResult);

    function onResult (result) {
      
      if (result)
        cb(layer)
      else
        next();

    }

  }

}

function getPointString(XX,YY){
  return 'ST_GeomFromText(\'POINT('+ XX.toString() +' '+ YY.toString() +')\', 3035)';
}

function rasterLayer(client, XX, YY, layer, cb){

  var pointString = getPointString(XX,YY);

  var queryString = 'select a.gid from "pt_table_clc06_c'+layer+'" as a where ST_Contains(a.the_geom, '+pointString+');';
  client.query(queryString, onResults);

  function onResults(err, result){

    if (err) throw err;

    cb( !! result.rows.length );
  }
}

var layers = [
  "111",
  "112",
  "121",
  "122",
  "123",
  "124",
  "131",
  "132",
  "133",
  "141",
  "142",
  "211",
  "212",
  "213",
  "221",
  "222",
  "223",
  "231",
  "241",
  "242",
  "243",
  "244",
  "311",
  "312",
  "313",
  "321",
  "322",
  "323",
  "324",
  "331",
  "332",
  "333",
  "334",
  "335",
  "411",
  "412",
  "421",
  "422",
  "423",
  "511",
  "512",
  "521",
  "522",
  "523"
];
