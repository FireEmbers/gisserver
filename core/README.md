#Core code for Wildfire 

This module is the core function for a deterministic forest fire simulator based on cellular automata
and fireLib (Rothermel and friends).

##Usage

To run the module simple do this in a node file:

`var core = require('fireapp');`

`core(dataUnit, Rows, Cols, aspectArray, slopeArray );`

* **Rows** and **Cols** are the size of the mesh, 
* **aspectArray** and **slopeArray** are the terrain aspect and slope
* **dataUnit** is the vector of uniform properties, currently: 
    * dataUnit[0] = FuelMoisture(%)
    * dataUnit[1] = WindVeloctity (m/s) 
    * dataUnit[2] = WindDirection (º clockwise from north) 

Function returns an array of igition times in JSON format

##CrowdProcess usage

The program.js file in src is minified and browsified in build/program.min.js.

Next, the file is loaded in the web browser with an ajax request for instance and a Run function 
is created to be loaded in to the CrowdProcess API:

`Run (dataUnit){return core(dataUnit, Rows, Cols, aspectArray, slopeArray );}`

##Test

test tings with 'test' in test folder

