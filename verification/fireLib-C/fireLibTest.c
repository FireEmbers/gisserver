/*
 *******************************************************************************
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
 *******************************************************************************
 */

#include "fireLib.h"

/* NOTE 2: Change these to set uniform burning conditions. */
static size_t Model   = 1;      /* NFFL 1 */
static double WindSpd = 4.;     /* mph */
static double WindDir = 0.;     /* degrees clockwise from north */
static double Slope   = 0.0;    /* fraction rise / reach */
static double Aspect  = 0.0;    /* degrees clockwise from north */
static double M1      = .10;    /* 1-hr dead fuel moisture */

int main ( int argc, char **argv )
{

  double moisture[6]
  moisture[0] = M1;

  double Windspd_ftm  = 88. * WindSpd_mph;     /* convert mph into ft/min */

  FuelCatalogPtr catalog = Fire_FuelCatalogCreateStandard("Standard", 13);
  Fire_SpreadNoWindNoSlope(catalog, Model, moisture);
  Fire_SpreadWindSlopeMax(catalog, Model, Windspd_ftm, WindDir, Slope, Aspect);
  Fire_SpreadAtAzimuth(catalog, Model, 45, FIRE_NONE);

}