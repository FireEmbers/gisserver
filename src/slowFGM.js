/*
  Quick and dirty implementation of a cellular automata fire growth model 
  with a 16 cell stencil.

  It's quite slow, but functional  

*/

           //N   NE   E  SE  S  SW   W  NW   a   b   c   d   e  f   g  h 
var nCol = [ 0,   1,  1,  1, 0, -1, -1, -1, -1,  1, -2,  2, -2, 2, -1, 1];
var nRow = [ -1, -1,  0,  1, 1,  1,  0, -1, -2, -2, -1, -1,  1, 1,  2, 2];


function FGM(){

  initMaps();

  //Compute distance and Azimuth of neighbour
  //in a outward propagation configuration
  calcDistAzm();


  while (timeNext < INF){
    timeNow = timeNext;
    timeNext = INF;

    for ( row = 0; row < ROWS; row++){
      for ( col = 0; col < COLS; col++){
        cell = col + COLS*row;
        
        //If the cell burns only in the future, skips and update timeNext if necessary
        //finds the minimum timeNext from the cells ignition times
        if ( ignMap[cell] > timeNow && timeNext > ignMap[cell] ){

          timeNext = ignMap[cell];
          continue;
        } 
        if ( ignMap[cell] !== timeNow )
          continue;

        //Neighbour loop if ignMap[cell] = timeNow
        for (var n = 0; n < 16; n++){

          //neighbour index calc
          ncol = col + nCol[n];
          nrow = row + nRow[n];
          ncell = ncol + nrow*COLS;

          //Check if neighbour is inbound
          if ( !(nrow >= 0 && nrow < ROWS && ncol >= 0 && ncol < COLS))
            continue;


          var ignNcell = ignMap[ncell];

          // if cell is unburned, compute propagation time
          if ( !(ignNcell > timeNow && rosMaxMap[cell] >= smidgen ))
            continue;

          ros = spreadAnyAzimuth(cell, nAzm[n]);

          ignTime = timeNow + nDist[n] / ros;

          //Update ignition time
          if(ignTime < ignNcell)
            ignMap[ncell] = ignTime;

          //Update timeNext
          if( ignTime < timeNext )
            timeNext = ignTime;
        }
      }
    }
  }
}

module.exports = FGM;