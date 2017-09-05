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

     // count the rows in the query area
    connection.query("select count(*) as count \
        from gbif \
        where gbif_species<>'' and \
        mbrcontains(geomfromtext(CONCAT('LINESTRING(', ?, ' ', ?, ',', ?, ' ', ?, ')')), gbif.coordinate); \
    ", [bufferedSouth, bufferedWest, bufferedNorth, bufferedEast], function(err, results, fields) {
        if(err) {
            console.error(err);
            process.exit(1);
        }

        var limit = 50000;
        var count = results[0].count;
        var modskip = parseInt(Math.ceil(count / limit));

        console.log("The query area contains " + count + " records - limiting to roughly " + limit);
        
        // send the query
        connection.query("select gbif_genus as genus, gbif_species as species, gbif_decimallatitude as lat, gbif_decimallongitude as lon, gbif_kingdom as kingdom, gbif_class as class, gbif_institutioncode as institutionCode, gbif_org_lookup.title as title \
            from gbif \
            left join gbif_org_lookup \
            on gbif.gbif_publishingorgkey=gbif_org_lookup.gbif_publishingorgkey \
            where gbif_species<>'' and \
            gbif_gbifid mod ? = 0 and \
            mbrcontains(geomfromtext(CONCAT('LINESTRING(', ?, ' ', ?, ',', ?, ' ',  ?, ')')), gbif.coordinate) \
            limit ?; \
        ", [modskip, bufferedSouth, bufferedWest, bufferedNorth, bufferedEast, limit], function(err, results, fields) {
            if(err) {
                console.error(err);
                process.exit(1);
            }

            console.log("SQL query was successful");
            jsonfile.writeFileSync(inputData.outputDir + "/gbif_list_output.json", results);
            console.log("Successfully retrieved and written GBIF records for the area of interest");
            process.exit(0);
        });
    });
});