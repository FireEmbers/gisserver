function FGM(){

  /*
    Fast fire growth model based on cellular automata

    its super fast

    see Sousa et all, Simulation of surface fire fronts using fireLib and GPUs, 2012
  */

  var res = INF;
  var nitt = 0;
  var ignTimeMin;

  var ignMap_new = Array(ROWS*COLS);

  ignMap_new = ignMap;

  //Main iterative cycle
  //keeps going until solution is converged: residue is zero
  while (res > 0){
    ++nitt;

    //iterative function: computes new ignition time map 
    //for all cells
    launchItt();

    //computes residue
    res = computeRes();

    //ignMap_new is copied to ignMap
    swapMaps();

  }

  function launchItt(){

    for ( row = 0; row < ROWS; row++){
      for ( col = 0; col < COLS; col++){
        cell = col + COLS*row;

        //Skips ignition points
        if (ignMap[cell] === 0)
          continue;

        ignTimeMin = INF;

        //Neighbour loop
        for (var n = 0; n < 16; n++){

          //neighbour index calc
          ncol = col + nCol[n];
          nrow = row + nRow[n];
          ncell = ncol + nrow*COLS;

          //skips if neighbour is outbound
          if ( !(nrow >= 0 && nrow < ROWS && ncol >= 0 && ncol < COLS))
            continue;

          ros = spreadAnyAzimuth(cell, nAzm[n]);         

          


          var ignNcell = ignMap[ncell];

          // if cell is unburned, compute propagation time
          if ( !(ignNcell > timeNow && rosMaxMap[cell] >= smidgen ))
            continue;

          

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