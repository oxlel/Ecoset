var config = require("config");
var mergeAndWindow = require("./shared/merge_and_window");

console.log(process.argv);

// run the merge and window procedure
mergeAndWindow.run(
	process.argv[2],
	-9999,
	config.get("beta_diversity.tileDir"),
	"betadiversity_",
	"beta_diversity"
);
