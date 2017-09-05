var config = require("config");
var mysql = require("mysql");
var jsonfile = require("jsonfile");

// parse the input data
var inputData = "";
try {
    inputData = JSON.parse(process.argv[2]);
} catch (e) {
    // invalid input, halt the script
    console.error(e);
    process.exit(1);
}

var bufferedNorth = inputData.north + 3;
var bufferedSouth = inputData.south - 3;
var bufferedEast = inputData.east + 3;
var bufferedWest = inputData.west - 3;

// ensure the buffer is still valid lat/lon
if(bufferedNorth > 90) bufferedNorth = 90;
if(bufferedSouth < -90) bufferedSouth = -90;
if(bufferedEast > 180) bufferedEast = 180;
if(bufferedWest < -180) bufferedWest = -180;

require("./shared/assert_params")(inputData, ["datatable"], [], false, true);

// connect to the mysql server
var connection = mysql.createConnection({
    host: config.get("gbif_list.mysql_host"),
    user: config.get("gbif_list.mysql_user"),
    password: config.get("gbif_list.mysql_password"),
    database: config.get("gbif_list.mysql_database")
});


connection.connect(function (err) {
    if (err) {
        console.error("Could not connect to the GBIF MySQL database - " + err.stack);
        process.exit(1);
    }

    console.log("Successfully established connection to GBIF MySQL database");

    var data;

    // send the query
    connection.query("select gbif_class as taxon, count(distinct gbif_species) as species, count(gbif_species) as count \
        from gbif \
        where gbif_species<>'' and \
        gbif_kingdom=\"Animalia\" and \
        mbrcontains(geomfromtext(CONCAT('LINESTRING(', ?, ' ', ?, ',', ?, ' ',  ?, ')')), gbif.coordinate) \
        group by gbif_class; \
    ", [bufferedSouth, bufferedWest, bufferedNorth, bufferedEast], function(err, results, fields) {
        if(err) {
            console.error(err);
            process.exit(1);
        }
        data = results;
        connection.query("select gbif_kingdom as taxon, count(distinct gbif_species) as species, count(gbif_species) as count \
            from gbif \
            where gbif_species<>'' and \
            gbif_kingdom=\"Plantae\" and \
            mbrcontains(geomfromtext(CONCAT('LINESTRING(', ?, ' ', ?, ',', ?, ' ',  ?, ')')), gbif.coordinate) \
            group by gbif_kingdom; \
        ", [bufferedSouth, bufferedWest, bufferedNorth, bufferedEast], function(err, results, fields) {
            if(err) {
                console.error(err);
                process.exit(1);
            }        
            console.log("SQL queries were successful");

            jsonfile.writeFileSync(inputData.outputDir + "/gbif_count_output.json", data.concat(results));
            process.exit(0);
            console.log("Successfully retrieved and written GBIF counts for the area of interest");
        });
    });
});