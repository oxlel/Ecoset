var config = require("config");
var mergeAndWindow = require("./shared/merge_and_window");

// run the merge and window procedure
mergeAndWindow.run(
	process.argv[2],
	255,
	config.get("migratory.tileDir"),
	"migratory_",
	"migratory"
);
