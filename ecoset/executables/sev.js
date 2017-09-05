var config = require("config");
var fileExists = require('file-exists');
var fs = require("fs");
var jsonfile = require("jsonfile");
var JSONStream = require('JSONStream');
var syncFiber = require("sync");

// parse the input data
var inputData = "";
try {
    inputData = JSON.parse(process.argv[2]);
} catch (e) {
    // invalid input, halt the script
    console.error(e);
    process.exit(1);
}

var ranExecutables = [];
for (var i = 0; i < inputData.executables.length; i++) {
    var executable = inputData.executables[i];
    ranExecutables.push(executable.name);
}


// get the list of input executables
var executables = config.get("sev.executables");

// make sure the required executables are running/have run
for (var i = 0; i < executables.length; i++) {
    var executable = executables[i];

    if (ranExecutables.indexOf(executable.name) == -1) {
        console.log(executable.name);
        console.log(ranExecutables);
        console.error(executable.name + " needs to be ran for the SEV to complete");
        process.exit(1);
    }
}

// block until all output files are done - ensures SEV is ran last
while (true) {
    var done = 0;

    for (var i = 0; i < executables.length; i++) {
        var executable = executables[i];

        if (fileExists.sync(inputData.outputDir + "/" + executable.name + "_output.json")) {
            done++;
        }
    }

    if (done >= executables.length) break;
}

// returns the summary section of an "_output.json" file
function getSummary(path, callback) {
    var stream = fs.createReadStream(path, {
        encoding: 'utf8'
    });
    var valueParser = JSONStream.parse(["summary"]);

    stream.pipe(valueParser);

    valueParser.on("data", function (d) {
        callback(null, d);
    });
}

// returns the rows and columns (as data.rows, data.cols in callback) in an "_output.json" file
function getRowsColumns(path, callback) {
    var data = {};
    var stream = fs.createReadStream(path, {
        encoding: 'utf8'
    });
    var colsParser = JSONStream.parse(["data", "ncols"]);
    var rowsParser = JSONStream.parse(["data", "nrows"]);

    stream.pipe(colsParser);
    stream.pipe(rowsParser);

    colsParser.on("data", function (d) {
        data.cols = d;
        if (data.rows != null) callback(null, data);
    });

    rowsParser.on("data", function (d) {
        data.rows = d;
        if (data.cols != null) callback(null, data);
    });
}

// returns the nodata value of an "_output.json" file
function getNoDataValue(path, callback) {
    var stream = fs.createReadStream(path, {
        encoding: 'utf8'
    });
    var valueParser = JSONStream.parse(["data", "nodata"]);

    stream.pipe(valueParser);

    valueParser.on("data", function (d) {
        callback(null, d);
    });
}

// returns the actual data of an "_output.json" file
function getRawData(path, callback) {
    var stream = fs.createReadStream(path, {
        encoding: 'utf8'
    });
    var dataParser = JSONStream.parse(["data", "raw"]);

    stream.pipe(dataParser);

    dataParser.on("data", function (d) {
        callback(null, d);
    });
}

var rows = null;
var cols = null;

// read in all json files, and ensure they have the same size
syncFiber(function () {
    for (var i = 0; i < executables.length; i++) {
        var executable = executables[i];

        var size = getRowsColumns.sync(null, inputData.outputDir + "/" + executable.name + "_output.json");
        if (rows == null && cols == null) {
            rows = size.rows;
            cols = size.cols;
        } else {
            if (rows != size.rows || cols != size.cols) {
                console.error("Output files have mismatched sizes! Cannot create SEV average. Expected size = [" + rows + "," + cols + "] - got [" + size.rows + "," + size.cols + "]");
                process.exit(1);
            }
        }
    }
    console.log("SEV can continue - input files have correct size -  [" + rows + "," + cols + "]");

    // create the empty output array
    var output = [];
    for (y = 0; y < rows; y++) {
        output[y] = [];
        for (x = 0; x < cols; x++) {
            output[y][x] = null;
        }
    }

    // store min and max z scores
    var min = null;
    var max = null;
    var weightTotal = 0;

    for (var i = 0; i < executables.length; i++) {
        var executable = executables[i];

        console.log("Processing data for SEV from: " + executable.name);

        // retrieve the summary info (mean, stdev etc), the nodata value, and the actual data from the output file
        var summary = getSummary.sync(null, inputData.outputDir + "/" + executable.name + "_output.json");
        var nodata = getNoDataValue.sync(null, inputData.outputDir + "/" + executable.name + "_output.json");
        var data = getRawData.sync(null, inputData.outputDir + "/" + executable.name + "_output.json");

        // loop through all values for this file, calculating z-score and updating mean z-score values
        for (var iy = 0; iy < data.length; iy++) {
            var row = data[iy];
            for (var ix = 0; ix < row.length; ix++) {
                var value = row[ix];
                var z = -9999;

                // z score is retained as nodata for nodata values, otherwise calc properly
                if (value != nodata) z = ((value - summary.mean) / summary.stdDev) * executable.weight;

                if (z == -9999 || output[iy][ix] == -9999) {
                    output[iy][ix] = -9999;
                } else {
                    if (i == 0) {
                        output[iy][ix] = z; // set the value
                    } else {
                        output[iy][ix] += z; // add to the value
                    }
                }
            }
        }
        weightTotal += executable.weight;
    }
    // output is now a 2d array of sum of all z-values

    if (weightTotal == 0) {
        console.error("Weight total must be positive (>0)");
        process.exit(1);
    }

    // find min and max after converting sum values to averages
    for (var iy = 0; iy < output.length; iy++) {
        var row = output[iy];
        for (var ix = 0; ix < row.length; ix++) {
            var value = row[ix];
            if (value != -9999) {
                output[iy][ix] = value / weightTotal;

                if (min == null && max == null) min = max = output[iy][ix];

                if (output[iy][ix] < min) min = output[iy][ix];
                if (output[iy][ix] > max) max = output[iy][ix];
            }
        }
    }

    // stretch the values
    console.log("SEV z-values computed, starting stretching process, min=" + min + " max=" + max);
    var minStretched = null;
    var maxStretched = null;
    var sum = 0;
    var count = 0;
    for (var iy = 0; iy < output.length; iy++) {
        var row = output[iy];
        for (var ix = 0; ix < row.length; ix++) {
            var value = row[ix];
            if (value != -9999) {
                output[iy][ix] = Math.round(((value - min) / (max - min)) * 255);

                if (minStretched == null && maxStretched == null) minStretched = maxStretched = output[iy][ix];

                if (output[iy][ix] < minStretched) minStretched = output[iy][ix];
                if (output[iy][ix] > maxStretched) maxStretched = output[iy][ix];

                sum += output[iy][ix];
                count++;
            }
        }
    }

    // calculate the mean
    var mean = 0;
    if (count > 0) mean = sum / count;

    // calculate standard deviation
    var sumMeanDiffSquared = 0;
    for (var iy = 0; iy < output.length; iy++) {
        var row = output[iy];
        for (var ix = 0; ix < row.length; ix++) {
            var value = row[ix];
            if (value != -9999) {
                sumMeanDiffSquared += (value - mean) * (value - mean);
            }
        }
    }
    var stdDev = Math.sqrt(sumMeanDiffSquared / count)

    // construct the final output object
    var outputObj = {
        summary: {
            min: minStretched,
            max: maxStretched,
            mean: mean.toFixed(3),
            stdDev: stdDev.toFixed(3),
            type: "Byte"
        }
    };

    if(inputData.output != "datatable") {
        outputObj.data = {
            ncols: cols,
            nrows: rows,
            nodata: -9999,
            raw: output
        };
    }

    jsonfile.writeFileSync(inputData.outputDir + "/sev_output.json", outputObj);
    process.exit(0);
});