var pg = require('pg');
var config = {
  user: 'fsousa',
  password: null,
  host: '/var/run/postgresql',
  database: 'gisdb'
};

var client = new pg.Client(config);

client.connect();

client.query('set search_path to "$user", "public", "gis_schema";')
var query = client.query('select a.* from "./clc06_c322" as a, portugalcontlaea as b where ST_Contains(b.the_geom, a.the_geom) limit 2;');
query.on('row', onRow);

function onRow(row) {
  console.log(row.id);
}

query.on('end', function() { 
  client.end();
});

