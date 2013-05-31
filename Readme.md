#PostGis CLC server 

Query scripts for Corine Land Cover (CLC) data access.

The idea is to get a rectangular area from the CLC layers stored in postgis and use that data to feed the fuel models of fireLib. 

The output is a matrix where each element corresponds to a specific category of terrain (CLC format).


##Usage 

`var getCorine = require('gisserver');`

`getCorine( N, S, E, W, rows, cols, functions(data){ fuelMap = data });`

* N, S, E, W are the limiting coordinates of the rectangular area, in a string format. eg: `var W = 2660547; var E = 2666430; var N = 1954031; var S = 1948355;`

* rows and cols are the resolution of the map

* The fuelMap is used in the call back function and it's in CLC format. 

##Output example

data = [111,111,311,111,...];

111 - Continuous urban fabric

311 - Broad-leaved forest

312 - etc








