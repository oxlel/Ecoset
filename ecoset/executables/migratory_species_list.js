var config = require("config");
var intersectShapeFile = require("./shared/intersect_shapefile");

// run the shapefile procedure
intersectShapeFile.run(
	process.argv[2],
    "migratory_species_list",
	config.get("migratory_species_list.shapefile")
);
