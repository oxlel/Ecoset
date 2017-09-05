var config = require("config");
var mergeAndWindow = require("./shared/merge_and_window");

// run the merge and window procedure
mergeAndWindow.run(
	process.argv[2],
	255,
	config.get("migratory_buffered.tileDir"),
	"migratory_",
	"migratory_buffered",
    3
);
