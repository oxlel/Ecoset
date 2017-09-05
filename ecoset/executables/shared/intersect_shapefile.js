(function () {

    var fs = require("fs");
    var shp = require("shpjs");
    var rc = require("./run_command");
    var exec = require("child_process").exec;
    var syncFiber = require("sync");
    var jsonfile = require("jsonfile");

    module.exports.run = function (args, name, shapeFile) {
        var inputData = "";
        try {
            inputData = JSON.parse(args);
        } catch (e) {
            // invalid input, halt the script
            console.error(e);
            process.exit(1);
        }

        console.log("Converting shapefile to GeoJSON");
        var file = inputData.outputDir + name + ".json";
        
        var args = ["-spat", inputData.west, inputData.south, inputData.east, inputData.north, file, shapeFile, "-f", "GeoJSON"];
        exec("ogr2ogr -spat " + inputData.west + " " + inputData.south + " " + inputData.east + " " + inputData.north + " \"" + file + "\" \"" + shapeFile + "\" -f GeoJSON", {}, function(err, stdout, stderr) {
            if(err) {
                console.error(err);
                process.exit(1);
            }
            
            if(stderr) {
                console.error(stderr);
                process.exit(1);
            }

            console.log(stdout);

            jsonfile.readFile(file, function(err, obj) {
                if(err) {
                    console.error(err);
                    process.exit(1);
                }
                var props = [];

                for (var f in obj.features) {
                    props.push(obj.features[f].properties);
                }

                fs.writeFileSync(inputData.outputDir + name + "_output.json", JSON.stringify(props));
                fs.unlink(file, function(err) {});
            });

        });
    }.async();
}());