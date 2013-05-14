/*

    run with 

        ./fireSim 1arg 2arg 3arg 4arg 5arg 6arg

    1arg: Rows/Cols
    2arg: windSpeed [m/s]
    3arg: windDir   [º from North]
    4arg: moistures [fraction]
    5arg: slope file name
    6arg: aspect file name

*/

      
 /*******************************************************************************
 *
 *  fireSim.c
 *
 *  Description
 *      A very simple fire growth simulator to demonstrate the fireLib library.
 *
 *  Notice
 *      THIS IS FOR ILLUSTRATIVE PURPOSES ONLY, AND IS NOT AN ACCURATE FIRE
 *      GROWTH MODEL!!  THE 8-NEIGHBOR CELL CONTAGION ALGORITHM RESULTS IN
 *      SIGNIFICANT GEOMETRIC FIRE SHAPE DISTORTION AT SLIGHT ANGLES FROM
 *      45 DEGREES!
 *
 *  Legalities
 *      Copyright (c) 1996-1999 by Collin D. Bevins.  All rights reserved.
 *
 *  Try the Following Modifications
 *      Change the Rows, Cols, CellWd or CellHt to change map size & resolution.
 *      Fill the fuelMap[] array with heterogenous and/or discontinuous fuels.
 *      Put some NoFuel (0) breaks into fuelMap[] for the fire to spread around.
 *      Fill the slpMap[] and aspMap[] arrays with variable terrain.
 *      Fill the wspdMap[] and wdirMap[] arrays with variable wind.
 *      Fill the m***Map[] arrays with variable fuel moistures.
 *******************************************************************************/
#define DegToRad(x)     ((x)*0.017453293)
#define RadToDeg(x)     ((x)*57.29577951) 

int Rows;
int Cols;

double CellWd;    /* Cell width (E-W) in feet. */  //1 m = 3.2808 ft
double CellHt;    /* Cell height (N-S) in feet. */ //1 m = 3.2808 ft 

#include "fireLib.h"

#define INFINITY 999999999.     /* or close enough */

static int PrintMap (double *map, char *fileName);

int main ( int argc, char *argv[] )
{

    Rows = atoi(argv[1]);
    Cols = atoi(argv[1]);

    CellWd = 3.2808399*3000/Cols;    /* Cell width (E-W) in feet. */  //1 m = 3.2808 ft
    CellHt = 3.2808399*3000/Cols;    /* Cell height (N-S) in feet. */ //1 m = 3.2808 ft 
    
    /* NOTE 2: Change these to set uniform burning conditions. */
    size_t Model   = 1;                 /* NFFL 1 */
    double WindSpd = atof(argv[2]);     /* m/s */
    double WindDir = atof(argv[3]);                /* degrees clockwise from north */

    double M1      = atof(argv[4]);    /* 1-hr dead fuel moisture */
    double M10     = 0;                /* 10-hr dead fuel moisture */
    double M100    = 0;                /* 100-hr dead fuel moisture */
    double Mherb   = 0;                /* Live herbaceous fuel moisture */
    double Mwood   = 0;                /* Live woody fuel moisture */


    double slp_tmp, asp_tmp;     //slope and aspect temporary values    
    char buffer[100];               //buffer when    usedm fgets skips lines

    /* neighbor's address*/     //N   NE   E  SE  S  SW   W  NW   a   b   c   d   e  f   g  h 
    static int nCol[16] =        { 0,   1,  1,  1, 0, -1, -1, -1, -1,  1, -2,  2, -2, 2, -1, 1};
    static int nRow[16] =        { -1, -1,  0,  1, 1,  1,  0, -1, -2, -2, -1, -1,  1, 1,  2, 2};

    static int nTimes = 0;      /* counter for number of time steps */
    FuelCatalogPtr catalog;     /* fuel catalog handle */
    double nDist[16];            /* distance to each neighbor */
    double nAzm[16];             /* compass azimuth to each neighbor (0=N) */
    double timeNow;             /* current time (minutes) */
    double timeNext;            /* time of next cell ignition (minutes) */
    int    row, col, cell;      /* row, col, and index of current cell */
    int    nrow, ncol, ncell;   /* row, col, and index of neighbor cell */
    int    n, cells;            /* neighbor index, total number of map cells */
    size_t modelNumber;         /* fuel model number at current cell */
    double moisture[6];         /* fuel moisture content at current cell */
    double fpm;                 /* spread rate in direction of neighbor */
    double minutes;             /* time to spread from cell to neighbor */
    double ignTime;             /* time neighbor is ignited by current cell */
    int    atEdge;              /* flag indicating fire has reached edge */
    size_t *fuelMap;            /* ptr to fuel model map */
    double *ignMap;             /* ptr to ignition time map (minutes) */
    double *flMap;              /* ptr to flame length map (feet) */
    double *slpMap;             /* ptr to slope map (rise/reach) */
    double *aspMap;             /* ptr to aspect map (degrees from north) */
    double *wspdMap;            /* ptr to wind speed map (ft/min) */
    double *wdirMap;            /* ptr to wind direction map (deg from north) */
    double *m1Map;              /* ptr to 1-hr dead fuel moisture map */
    double *m10Map;             /* ptr to 10-hr dead fuel moisture map */
    double *m100Map;            /* ptr to 100-hr dead fuel moisture map */
    double *mherbMap;           /* ptr to live herbaceous fuel moisture map */
    double *mwoodMap;           /* ptr to live stem fuel moisture map */

    FILE *slope_file, *aspect_file; 

    printf("Running fireSim with Rows:%d, U:%lf, Dir:%lf\n", Rows, WindSpd, WindDir);

    /* NOTE 3: allocate all the maps. */
    cells = Rows * Cols;
    if ( (ignMap   = (double *) calloc(cells, sizeof(double))) == NULL
      || (flMap    = (double *) calloc(cells, sizeof(double))) == NULL
      || (slpMap   = (double *) calloc(cells, sizeof(double))) == NULL
      || (aspMap   = (double *) calloc(cells, sizeof(double))) == NULL
      || (wspdMap  = (double *) calloc(cells, sizeof(double))) == NULL
      || (wdirMap  = (double *) calloc(cells, sizeof(double))) == NULL
      || (m1Map    = (double *) calloc(cells, sizeof(double))) == NULL
      || (m10Map   = (double *) calloc(cells, sizeof(double))) == NULL
      || (m100Map  = (double *) calloc(cells, sizeof(double))) == NULL
      || (mherbMap = (double *) calloc(cells, sizeof(double))) == NULL
      || (mwoodMap = (double *) calloc(cells, sizeof(double))) == NULL
      || (fuelMap  = (size_t *) calloc(cells, sizeof(size_t))) == NULL )
    {
        fprintf(stderr, "Unable to allocate maps with %d cols and %d rows.\n",
            Cols, Rows);
        return (1);
    }

    /* NOTE 4: initialize all the maps -- modify them as you please. */
    

    if ( (slope_file = fopen(argv[5],"r")) == NULL ){
        printf("Unable to open output map \"%s\".\n", argv[5]);
        return (FIRE_STATUS_ERROR);
    }

    if ( (aspect_file = fopen(argv[6],"r")) == NULL ){
        printf("Unable to open output map \"%s\".\n", argv[6]);
        return (FIRE_STATUS_ERROR);
    }
    
    
    /*for (n = 0; n < 6; n++){
            fgets(buffer, 100, slope_file);
            fgets(buffer, 100, aspect_file);
    }
    */
    for ( cell=0; cell<cells; cell++ )
    {
        fscanf(aspect_file, "%lf", &asp_tmp);
        fscanf(slope_file, "%lf", &slp_tmp);
        slpMap[cell] = slp_tmp/100;
                                                             //Slope in firelib is a fraction
        asp_tmp = (asp_tmp - 90 < 0) ?                      //while in Grass is percentage rise/reach.
                asp_tmp - 90 + 360  : asp_tmp - 90 ;        //Aspect in firelib is N=0 and clockwise 
        aspMap[cell]       = 360 - asp_tmp;                 //while aspect in Grass is E=0 counter-clockwise
        fuelMap[cell]  = Model;
        wspdMap[cell]  = 196.850393701 * WindSpd;           /* convert m/s into ft/min */
        wdirMap[cell]  = WindDir;
        m1Map[cell]    = M1;
        m10Map[cell]   = M10;
        m100Map[cell]  = M100;
        mherbMap[cell] = Mherb;
        mwoodMap[cell] = Mwood;
        ignMap[cell]   = INFINITY;
        flMap[cell]    = 0.;
    }

    /* NOTE 5: set an ignition time & pattern (this ignites the middle cell). */
    cell = Cols/4 + Cols*(Rows/4);
    ignMap[cell] = 0.0;

    /* NOTE 6: create a standard fuel model catalog and a flame length table. */
    ////////////////////////////////
    //Create fuel catalog
  
    //Create 13 + 0 (no fuel model) standard NFFL models and creates space for 
    //aditional custom model
    catalog = Fire_FuelCatalogCreateStandard("Standard", 14);
    
    //Create aditional custom model based on NFFL1
    //Only the PARTICLE LOAD is customized at the moment
    if ( Fire_FuelModelCreate (
        catalog,                                //FuelCatalogData instance
        14,                                     //fuel model number
        "CUSTOM",                               //Name
        "Custom Fuel model",                    //longer description
        0.197,                                  //bed depth (ft)
        Fuel_Mext(catalog, 1),                  //moisture of extinction (dl)
        Fuel_SpreadAdjustment(catalog, 1),      //spread adjustment factor (dl)
        1) != FIRE_STATUS_OK )                  //maximum number of particles
    {
        fprintf(stderr, "%s\n", FuelCat_Error(catalog));
        Fire_FuelCatalogDestroy(catalog);
        return (NULL);
    }
    //Add a particle to the custom model nº 14
    
    if ( Fire_FuelParticleAdd (
        catalog,                        // FuelCatalogData instance pointer
        14,                             //Custom fuel model id
        Fuel_Type(catalog,1,0),   
        0.23,                    // Custom particle load              (lbs/ft2)
        3500,                            // surface-area-to-volume ratio     (ft2/ft3)
        Fuel_Density(catalog,1,0),      //density                          (lbs/ft3)
        Fuel_Heat(catalog,1,0),         //heat of combustion               (btus/lb)
        Fuel_SiTotal(catalog,1,0),      //total silica content               (lb/lb)
        Fuel_SiEffective(catalog,1,0))  //effective silica content           (lb/lb)
                    != FIRE_STATUS_OK )
    {
        fprintf(stderr, "%s\n", FuelCat_Error(catalog));
        Fire_FuelCatalogDestroy(catalog);
        return (NULL);
    }
  
    
    Fire_FlameLengthTable(catalog, 500, 0.1);

    /* Calculate distance across cell to each neighbor and its azimuth. */
    for ( n=0; n < 16; n++ ) {
      nDist[n] = sqrt ( nCol[n] * CellWd * nCol[n] * CellWd
                      + nRow[n] * CellHt * nRow[n] * CellHt );

      if (n < 8)
        nAzm[n] = n * 45.;
      else {

        nAzm[n] = atanf( (nCol[n] * CellWd) / (nRow[n] * CellHt) );

        if ( nCol[n] > 0  && nRow[n] < 0) //1st quadrant 
          nAzm[n] = RadToDeg(  fabs( nAzm[n] ) );

        if ( nCol[n] > 0  && nRow[n] > 0) //2st quadrant 
          nAzm[n] = 180. - RadToDeg( nAzm[n] ) ;

        if ( nCol[n] < 0  && nRow[n] > 0) //3st quadrant 
          nAzm[n] = RadToDeg( fabs( nAzm[n] ) )+ 180.;

        if ( nCol[n] < 0  && nRow[n] < 0) //4st quadrant 
          nAzm[n] = 360. - RadToDeg( fabs( nAzm[n] ));
      }
    }



    /* NOTE 7: find the earliest (starting) ignition time. */
    for ( timeNext=INFINITY, cell=0; cell<cells; cell++ )
    {
        if ( ignMap[cell] < timeNext )
            timeNext = ignMap[cell];
    }

    /* NOTE 8: loop until no more cells can ignite or fire reaches an edge. */
    atEdge = 0;
    //while ( timeNext < INFINITY && ! atEdge )
    while ( timeNext < INFINITY)
    {
        timeNow  = timeNext;
        timeNext = INFINITY;
        nTimes++;

        /* NOTE 9: examine each ignited cell in the fuel array. */
        for ( cell=0, row=0; row<Rows; row++ )
        {
            for ( col=0; col<Cols; col++, cell++ )
            {
                /* Skip this cell if it has not ignited. */
                if ( ignMap[cell] > timeNow )
                {
                    /* NOTE 12: first check if it is the next cell to ignite. */
                    if ( ignMap[cell] < timeNext )
                        timeNext = ignMap[cell];
                    continue;
                }

                /* NOTE 10: flag if the fire has reached the array edge. */
                if ( row==0 || row==Rows-1 || col==0 || col==Cols-1 )
                    atEdge = 1;

                /* NOTE 11: determine basic fire behavior within this cell. */
                modelNumber = fuelMap[cell];
                moisture[0] = m1Map[cell];
                moisture[1] = m10Map[cell];
                moisture[2] = m100Map[cell];
                moisture[3] = m100Map[cell];
                moisture[4] = mherbMap[cell];
                moisture[5] = mwoodMap[cell];
                Fire_SpreadNoWindNoSlope(catalog, modelNumber, moisture);
                Fire_SpreadWindSlopeMax(catalog, modelNumber, wspdMap[cell],
                    wdirMap[cell], slpMap[cell], aspMap[cell]);

                /* NOTE 12: examine each unignited neighbor. */
                for ( n=0; n<16; n++ )
                {
                    /* First find the neighbor's location. */
                    nrow = row + nRow[n];
                    ncol = col + nCol[n];
                    if ( nrow<0 || nrow>=Rows || ncol<0 || ncol>=Cols )
                        continue;
                    ncell = ncol + nrow*Cols;

                    /* Skip this neighbor if it is already ignited. */
                    if ( ignMap[ncell] <= timeNow )
                        continue;

                    /* Determine time to spread to this neighbor. */
                    Fire_SpreadAtAzimuth(catalog, modelNumber, nAzm[n], FIRE_NONE);
                    if ( (fpm = Fuel_SpreadAny(catalog, modelNumber)) > Smidgen)
                    {
                        minutes = nDist[n] / fpm;

                        /* Assign neighbor the earliest ignition time. */
                        if ( (ignTime = timeNow + minutes) < ignMap[ncell] )
                        {
                            ignMap[ncell] = ignTime;
                            Fire_FlameScorch(catalog, modelNumber, FIRE_FLAME);
                            flMap[ncell] = Fuel_FlameLength(catalog,modelNumber);
                        }

                        /* Keep track of next cell ignition time. */
                        if ( ignTime < timeNext )
                            timeNext = ignTime;
                    }
                }   /* next neighbor n */
            }   /* next source col */
        }   /* next source row */
    } /* next time */

    printf("There were %d time steps ending at %3.2f minutes (%3.2f hours).\n",
        nTimes, timeNow, timeNow/60.);

    /* NOTE 13: save the ignition & flame length maps. */
    PrintMap(aspMap,"aspect.Map");
    PrintMap(slpMap,"slope.Map");
    PrintMap(ignMap, "ign.Map");
    PrintMap(flMap, "flame.Map");
    
    return (0);
}

int PrintMap ( double* map, char* fileName )
{
    FILE *fPtr;
    int cell, col, row;

    if ( (fPtr = fopen(fileName, "w")) == NULL )
    {
        printf("Unable to open output map \"%s\".\n", fileName);
        return (FIRE_STATUS_ERROR);
    }

    for ( row = 0; row < Rows; row++ )
    {
        for ( cell=row*Cols, col=0; col<Cols; col++, cell++ )
        {
            fprintf(fPtr, "  %5.2f ", (map[cell]==INFINITY) ? 000.00 : map[cell]);
        }
        fprintf(fPtr, "\n");
    }
    fclose(fPtr);
    return (FIRE_STATUS_OK);
}
