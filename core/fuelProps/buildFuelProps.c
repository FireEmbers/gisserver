#include "fireLib.h"

int main ( int argc, char *argv[] ){

  FuelCatalogPtr catalog;
  double particle_load = 0.23;  //0.23 lb/sqft = 1.123 kg/m^2

  FILE *fptr; 
  size_t model = 14;
  size_t particle = 0;
  size_t life = 0;

  printf ("\n>>Creating standard fire models...");
  catalog = Fire_FuelCatalogCreateStandard("Standard", 14);
  printf ("Done.\n");

  //Create aditional custom model based on NFFL1
  //Only the PARTICLE LOAD is customized at the moment
  if ( Fire_FuelModelCreate (
    catalog,                                //FuelCatalogData instance
    model,                                  //fuel model number
    "CUSTOM",                               //Name
    "Custom Fuel model",                    //longer description
    0.197,                                  //bed depth (ft) -> 0.06 m
    Fuel_Mext(catalog, 1),                  //moisture of extinction (dl)
    Fuel_SpreadAdjustment(catalog, 1),      //spread adjustment factor (dl)
    1) != FIRE_STATUS_OK ) {                //maximum number of particles

      fprintf(stderr, "%s\n", FuelCat_Error(catalog));
      Fire_FuelCatalogDestroy(catalog);
      return (NULL);
  }

  //Add a particle to the custom model nº 14
  printf ("\n>>Creating custom fire model...");

  if ( Fire_FuelParticleAdd (
    catalog,                      // FuelCatalogData instance pointer
    14,                           //Custom fuel model id
    Fuel_Type(catalog,1,0),   
    0.23,                 // Custom particle load              (lbs/ft2)
    3500,                          // surface-area-to-volume ratio     (ft2/ft3)
    Fuel_Density(catalog,1,0),    //density                          (lbs/ft3)
    Fuel_Heat(catalog,1,0),       //heat of combustion               (btus/lb)
    Fuel_SiTotal(catalog,1,0),    //total silica content               (lb/lb)
    Fuel_SiEffective(catalog,1,0))//effective silica content           (lb/lb)
        != FIRE_STATUS_OK ){

      fprintf(stderr, "%s\n", FuelCat_Error(catalog));
      Fire_FuelCatalogDestroy(catalog);
      return (NULL);
  }
  else
    printf("Done\n");

  printf ("\n>>Fire_FuelCombustion...");
//////////////////////////////////////////////////////////////////////////////////////////
  model = 1; //APAGAR
//////////////////////////////////////////////////////////////////////////////////////////
  Fire_FuelCombustion(catalog, model);
  printf ("Done.\n");

  fptr = fopen("fuelProps.dat", "w");



model = 1;
  fprintf(fptr, "Fuel_AreaWtg(catalog,model,particle)\n"     
                "Fuel_LifeRxFactor(catalog,model,life)\n"    
                "Fuel_PropFlux(catalog,model)\n"        
                "Fuel_Mext(catalog,model)\n"
                "Fuel_LifeAreaWtg(catalog,model,life)\n"
                "Fuel_SigmaFactor(catalog,model,particle)\n"
                "Fuel_BulkDensity(catalog,model)\n"
                "Fuel_WindB(catalog,model)\n"
                "Fuel_WindK(catalog,model)\n"
                "Fuel_SlopeK(catalog,model)\n"
                "Fuel_WindE(catalog,model)\n"
                "-----------------------------------------------\n"
                "%.5e \n" 
                "%.5e \n"
                "%.5e \n"
                "%.5e \n"
                "%.5e \n"
                "%.5e \n"
                "%.5e \n"
                "%.5e \n"
                "%.5e \n"
                "%.5e \n"
                "%.5e \n",
                Fuel_AreaWtg(catalog,model,particle),
                Fuel_LifeRxFactor(catalog,model,life),
                Fuel_PropFlux(catalog,model),
                Fuel_Mext(catalog,model),
                Fuel_LifeAreaWtg(catalog,model,life),
                Fuel_SigmaFactor(catalog,model,particle),
                Fuel_BulkDensity(catalog,model),
                Fuel_WindB(catalog,model),
                Fuel_WindK(catalog,model),
                Fuel_SlopeK(catalog,model),
                Fuel_WindE(catalog,model));

}

//Print stuff about fuel that maters 



