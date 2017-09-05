var config = require("config");

var inputData = "";
try {
	inputData = JSON.parse(process.argv[2]);
} catch (e) {
	// invalid input, halt the script
	console.error(e);
	process.exit(1);
}

require("./shared/assert_params")(inputData, ["datatable"], [], false, true);

var mergeAndWindow = require("./shared/merge_and_window");

// run the merge and window procedure
mergeAndWindow.run(
	process.argv[2],
	-9999,
	config.get("gbif_mammalia_zonal.tileDir"),
	"zonalmammalia_",
	"gbif_mammalia_zonal"
);
