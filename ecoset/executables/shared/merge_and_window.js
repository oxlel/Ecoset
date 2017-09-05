// merge_and_window.js - a node module to run gdal tools to merge and window a group of tif files to create
//                       a single tif file output

// process goes like this:
// calculate tiles to stitch -> stitch tiles -> window (crop) query area

(function () {
	var fs = require("fs");
	var parseString = require("xml2js").parseString;
	var syncFiber = require("sync");
	var lineByLineReader = require("line-by-line");
	var base64 = require('file-base64');
	const { execSync } = require('child_process');

	var rc = require("./run_command");

	// load the tiles.csv file into a lookup table
	var bounds2name = {};
	var fileContents = fs.readFileSync(__dirname + "/tiles.csv");
	var lines = fileContents.toString().split("\n");

	for (var i = 0; i < lines.length; i++) {
		var data = lines[i].split(",");
		bounds2name[[parseInt(data[1].trim()), parseInt(data[2].trim()),
			parseInt(data[3].trim()), parseInt(data[4].trim())
		]] = data[0];
	}

	// this function is asynchronous due to the "node sync" library - however some of the functions
	// ran below are specifically synchronous
	module.exports.run = function (args, noDataValue, tileDir, tilePrefix, outfile, buffer=0) {
		// get the input data
		var inputData = "";
		try {
			inputData = JSON.parse(args);
		} catch (e) {
			// invalid input, halt the script
			console.error(e);
			process.exit(1);
		}

		inputData.north = inputData.north + buffer;
		inputData.south = inputData.south - buffer;
		inputData.east = inputData.east + buffer;
		inputData.west = inputData.west - buffer;

		// ensure the buffer is still valid lat/lon
		if(inputData.north > 90) inputData.north = 90;
		if(inputData.south < -90) inputData.south = -90;
		if(inputData.east > 180) inputData.east = 180;
		if(inputData.west < -180) inputData.west = -180;

		// ensure the supplied parameters are valid
		require("./assert_params")(inputData, ["raw", "datatable", "tif"], ["degraded"], false, true);

		var outfile = inputData.outputDir + outfile;

		// build a list of tile names to be merged
		var tileList = [];
		var westInt = Math.floor(inputData.west);
		var southInt = Math.floor(inputData.south);
		var eastInt = Math.ceil(inputData.east);
		var northInt = Math.ceil(inputData.north);
		for (var x = westInt; x < eastInt; x++) {
			for (var y = southInt; y < northInt; y++) {
				var tileName = bounds2name[[x, (x + 1), y, (y + 1)]];
				if (tileName != undefined)
					tileList.push(tileName);
			}
		}

		// build a list of tif file locations
		var tileFileList = [];
		for (var t in tileList) {
			var tileName = tileList[t];
			tileFileList.push(tileDir + "/" + tileName.substring(0, 3) + "/" + tilePrefix + tileName + ".tif");
		}

		// spawn the merge process
		var commandOpts = [__dirname + "/gdal_merge.py", "-init", noDataValue, "-a_nodata", noDataValue, "-o", outfile + "_merged.tif"]
		commandOpts = commandOpts.concat(tileFileList);
		var output = rc.runCommand.sync(null, "python", commandOpts, false, false);

		// spawn the windowing process
		commandOpts = ["-of", "gtiff", "-te", inputData.west, inputData.south, inputData.east, inputData.north, outfile + "_merged.tif", outfile + ".tif"];
		output = rc.runCommand.sync(null, "gdalwarp", commandOpts, false, false);

		if(inputData.output_format != "tif") {
			if(inputData.output_format != "datatable") {
				// translate tif file, scale if specified
				var newX = 0;
				var newY = 0;
				if(inputData.stat == "degraded") {
					var scaleFactor = (inputData.east - inputData.west) / (inputData.north - inputData.south);
					if(inputData.east - inputData.west > inputData.north - inputData.south) {
						// wider
						newX = 1000;
						newY = Math.round(1000 / scaleFactor);
					} else {
						// taller
						newY = 1000;
						newX = Math.round(1000 * scaleFactor);
					}
				}

				if(inputData.stat == "degraded") {
					commandOpts = ["-outsize", newX, newY, "-r", "nearest", "-of", "AAIGrid", outfile + ".tif", outfile + "_scaled.asc"];
					output = rc.runCommand.sync(null, "gdal_translate", commandOpts, false, true);
				} else {
					commandOpts = ["-of", "AAIGrid", outfile + ".tif", outfile + ".asc"];
					output = rc.runCommand.sync(null, "gdal_translate", commandOpts, false, true);
				}
			}
			// create an info file for the main tif - shows min/max values and mean/stddev
			output = rc.runCommand.sync(null, "gdalinfo", ["-json", "-stats", outfile + ".tif"], true, true);
			// sometimes the above commands returns an error as the first line, ignore if this is the case
			if(output.split("\n")[0].split(" ")[0] == "ERROR") {
				output = output.split("\n");
				output.splice(0, 1);
				output = output.join("\n");
			}
			infoObj = JSON.parse(output);

			var summaryString = "{\"summary\": {";
			if(infoObj.bands[0].minimum !== undefined)
				summaryString += "\"min\":" + infoObj.bands[0].minimum + ",";
			if(infoObj.bands[0].maximum !== undefined)
				summaryString += "\"max\":" + infoObj.bands[0].maximum + ",";
			if(infoObj.bands[0].mean !== undefined)
				summaryString += "\"mean\":" + infoObj.bands[0].mean + ",";
			if(infoObj.bands[0].stdDev !== undefined)
				summaryString += "\"stdDev\":" + infoObj.bands[0].stdDev + ",";
			if(infoObj.bands[0].type !== undefined)
				summaryString += "\"type\":\"" + infoObj.bands[0].type + "\",";
			
			summaryString = summaryString.slice(0, -1);
			if(inputData.output_format != "datatable") {
				summaryString += "},\"data\": {";
			} else {
				summaryString += "}}";
			}

			// write the start of the json file - has to be done this way so that no large
			// data is stored in javascript memory at any point.
			fs.writeFileSync(outfile + "_output.json", summaryString);
		
			// raw data is not returned if datatable is specified as output format
			if(inputData.output_format != "datatable") {

				// to support large files, read the data in with a stream - line by line
				var lr = null;

				if(inputData.stat == "degraded") {
					lr = new lineByLineReader(outfile + "_scaled.asc");
				} else {
					lr = new lineByLineReader(outfile + ".asc");
				}

				var lineCount = 0;
				var ncols = 0;
				var nrows = 0;
				var nodata = 0;
				var startLine = -1;

				lr.on("line", function (line) {
					lineSplit = line.split(" ");
					if(lineSplit[0] == "ncols") {
						fs.appendFileSync(outfile + "_output.json", "\"ncols\":" + lineSplit.pop() + ",");
					} else if(lineSplit[0] == "nrows") {
						nrows = +lineSplit.pop();
						fs.appendFileSync(outfile + "_output.json", "\"nrows\":" + nrows.toString() + ",");
					} else if(lineSplit[0] == "NODATA_value") {
						fs.appendFileSync(outfile + "_output.json", "\"nodata\":" + lineSplit.pop() + ",\n\"raw\":[");
					} else if(!isNaN(lineSplit[0])) {
						if(startLine == -1) startLine = lineCount;

						var lineData = (line.substr(1)).split(" ");
						for (var i = 0; i < lineData.length; i++) {
							lineData[i] = +lineData[i];
						}
						if(lineCount - startLine + 1 < nrows)
							fs.appendFileSync(outfile + "_output.json", JSON.stringify(lineData) + ",");
						else 
							fs.appendFileSync(outfile + "_output.json", JSON.stringify(lineData) + "]}}");
					}
					lineCount++;
				});

				// the "end of file" event needs to be wrapped in a function to allow synchronous execution
				function endFileReadWrapper(callback) {
					lr.on("end", function () {
						callback();
					});
				}
				endFileReadWrapper.sync(null);
			}
		} else {
			// write the tif data as a base64 encoded string to a json file
			var output = execSync("base64 " + outfile + ".tif > " + outfile + ".b64");
			fs.writeFileSync(outfile + "_output.json", "{\"base64\":\"");
			var append = execSync("cat " + outfile + ".b64 >> " + outfile + "_output.json");
			fs.appendFileSync(outfile + "_output.json", "\"}");
		}

		// delete the unwanted files (if they exist)
		try { fs.unlink.sync(null, outfile + "_merged.tif") } catch(e) {};
		try { fs.unlink.sync(null, outfile + ".tif") } catch(e) {}; // this should be saved to a cache in future
		try { fs.unlink.sync(null, outfile + ".prj") } catch(e) {};
		try { fs.unlink.sync(null, outfile + ".b64") } catch(e) {};
		try { fs.unlink.sync(null, outfile + "_scaled.prj") } catch(e) {};
		try { fs.unlink.sync(null, outfile + ".tif.aux.xml") } catch(e) {};
		try { fs.unlink.sync(null, outfile + ".asc") } catch(e) {};
		try { fs.unlink.sync(null, outfile + "_scaled.asc") } catch(e) {};
		try { fs.unlink.sync(null, outfile + ".asc.aux.xml") } catch(e) {};
		try { fs.unlink.sync(null, outfile + "_scaled.asc.aux.xml") } catch(e) {};

		return;
	}.async();
}());