//clc server tests with raster queries. Probably not to be continued


  var pg = require('pg');
  var config = {
    user: 'fsousa',
    password: null,
    host: '/var/run/postgresql',
    database: 'gisdb'
  };

module.exports = function( N, S, E, W, rows, cols, cb){

  var client = new pg.Client(config);

  client.connect();

  client.query('set search_path to "$user", "public", "gis_schema";');

  clipCreate(client, N, S, E, W, cb);

};

function clipCreate(client, N, S, E, W, cb){

  var queryId = Math.ceil(Math.random()*100);

  var clipName = 'clip_' + queryId;

  var polyStr =
      'ST_GeomFromText( \'POLYGON(('
      + W + ' ' + N + ', '
      + E + ' ' + N + ', '
      + E + ' ' + S + ', '
      + W + ' ' + S + ', '
      + W + ' ' + N + ' ))\', 3035) ';

  var clipQuery =
  'CREATE view "gis_schema".' + clipName + ' as select  gid, st_intersection(a, b.the_geom) as the_geom\
    FROM ' + polyStr +' as a, gis_schema.clc06_c311 as b  \
    WHERE st_intersects(a, b.the_geom);\
    INSERT INTO geometry_columns(f_table_catalog, f_table_schema, f_table_name, f_geometry_column, coord_dimension, srid, "type")\
    SELECT \'\', \'gis_schema\', \'' + clipName + '\', \'the_geom\', ST_CoordDim(the_geom), ST_SRID(the_geom), GeometryType(the_geom)\
    from gis_schema.clc06_c311 limit 1;';

  client.query(clipQuery, onClipCreate);

  function onClipCreate(err, result){

    if (err) throw err;

    rasterize(client, clipName, queryId);

  }
}

function rasterize(client, clipName, queryId){

  var rasterName = 'raster_' + queryId;

  var rastQuery =
  'CREATE view "gis_schema".' + rasterName + ' as select  ST_AsRaster(a.the_geom, 150, 150, \'2BUI\') as rast\
    FROM gis_schema.' + clipName +' as a ;';

    console.log(rastQuery);

  client.query(rastQuery, onRasterize);

  function onRasterize(err, result){

    if (err) throw err;

  }
}

function dropAndClose(client, tablesToDrop){

  client.query('drop table '+ tablesToDrop + ' ;', function(){client.end();});
}

