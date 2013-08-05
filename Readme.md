#PostGis CLC and SRTM server 

Query scripts for Corine Land Cover (CLC) and SRTM height data access.

The idea is to get a rectangular area from the CLC layers stored in postgis and use that data to feed the fuel models of fireLib. 

The output is a matrix where each element corresponds to a specific category of terrain (CLC format).

The SRTM module queries a database where the height data in WGS84 is stored, returning a rectangular area projected in ETRS89-LAEA.


##Usage 

### CLC module

`var getCorine = require('clcServer');`

`getCorine( N, S, E, W, rows, cols, functions(data){ fuelMap = data });`

* N, S, E, W are the limiting coordinates of the rectangular clip area (string format, Easting/Northing). eg: `var W = 2660547; var E = 2666430; var N = 1954031; var S = 1948355;`


* rows and cols are the resolution of the map

* The fuelMap is used in the call back function and it's in CLC format. 

###SRTM module

`var getSrtm = require('srtmServer');`

`getSrtm( N, S, E, W, functions(data){ heightMap = data });`

* N, S, E, W are the same for CLC module

* rows and cols are the resolution of the map

* The heightMap is in meters and ETRS89-LAEA system. 


## CLC Output example

data = [111,111,311,111,...];

111 - Continuous urban fabric

311 - Broad-leaved forest

312 - 

## SRTM Output example

```
{ command: 'SELECT',
  rowCount: 625,
  oid: NaN,
  rows: 
   [ { st_metadata: '( EASTING, NORTHING,ROWS,COLS,PIXEL HEIGHT,PIXEL WIDTH,SKEWX,SKEWY,SRID,BAND)' },
     { x: 1, y: 1, height: 992 },
     { x: 1, y: 2, height: 1004 },
     { x: 1, y: 3, height: 111 },
     ...                          ] }
```

st_metadata contains information about the clipped raster. It's important to notice that, because of the way the clipping area intersects the raster pixels, the values for E/N of the clipped area will be slightly different from the input E/N at `getSRTM`.


##To do

srtm server output needs to be tested
