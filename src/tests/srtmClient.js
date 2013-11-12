  var ccvonrequire 
  var pg = require('pg');
  var config = {
    user: 'fsousa',
    password: null,
    host: '/var/run/postgresql',
    database: 'srtmdb'
  };

module.exports = function( N, S, E, W, cb){

  var client = new pg.Client(config);

  client.connect();

  polyCreate(client, N, S, E, W, cb);

};

function polyCreate(client, N, S, E, W, cb){

  var queryId = Math.ceil(Math.random()*100);

  var polyStr = 'poly_' + queryId;

  var polyQuery =
    'create table ' + polyStr+ ' as select \
    ST_GeomFromText( \'POLYGON(('
      + W + ' ' + N + ', '
      + E + ' ' + N + ', '
      + E + ' ' + S + ', '
      + W + ' ' + S + ', '
      + W + ' ' + N + ' ))\', 3035) as poly_col;';

  client.query(polyQuery, onPolyCreate);

  function onPolyCreate(err, result){

    if (err) throw err;

    clipIt(client, queryId, polyStr, cb);

  }
}

function clipIt(client, queryId, polyStr, cb){

  var clipedStr = 'cliped_' + queryId;

  var clipQuery =
    'create table '+ clipedStr +' as select rid, st_clip ( a.rast, b.poly_col ) as rast \
    from srtm_35_04 as a, ' + polyStr + ' as b where ST_Intersects(a.rast, b.poly_col);';

  client.query(clipQuery, onClipCreate);

  function onClipCreate(err, result){

    if (err) throw err;

    unionize(client, queryId, polyStr, cb);

  }
}

function unionize(client, queryId, polyStr, cb){

  var tableStr = 'cliped_' + queryId;
  var unionStr = 'nion_'+ queryId;

  var unionQuery =
    'create table ' + unionStr + ' as select ST_Union(rast) as rast from ' + tableStr +' ;';

  client.query(unionQuery, onUnionCreate);

  function onUnionCreate(err, result){

    //if (err) thorw err;

    getMap(client, tableStr + ', ' + unionStr + ', ' + polyStr, unionStr, cb);

  }
}

function getMap(client, tablesToDrop, tableToPrint, cb){

  var queryString = '\ select ST_metadata(rast) from ' + tableToPrint +';\
    SELECT x, y, ST_Value(rast, 1, x, y) As height \
    FROM ' + tableToPrint + ' CROSS JOIN generate_series(1, 1000) As x CROSS JOIN generate_series(1, 1000) As y \
    WHERE  x <= ST_Width(rast) AND y <= ST_Height(rast);';

  client.query(queryString, onResults);

  function onResults(err, result){

    if (err) throw err;

    cb( result );

    dropAndClose(client, tablesToDrop);

  }
}

function dropAndClose(client, tablesToDrop){

  client.query('drop table '+ tablesToDrop + ' ;', function(){client.end();});

}