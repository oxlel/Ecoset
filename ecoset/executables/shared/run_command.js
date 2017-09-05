/**
 * Small helper module to run shell commands (like GDAL) and return/suppress the output
 */
(function () {
    var spawn = require("child_process").spawn;
    
    module.exports.runCommand = function (command, opts, suppressStdout, suppressStderr, callback) {
		console.log("Running console command: \"" + command + " " + opts.join(" ") + "\", suppressing STDOUT: " + suppressStdout + " suppressing STDERR: " + suppressStderr);

		var exec = spawn(command, opts);
		
		var output = "";
		exec.stdout.on("data", function (data) {
			if(!suppressStdout) console.log("[" + command + " " + opts.join(" ") + "]: " + data.toString());
			output += data;
		});

		exec.stderr.on("data", function (data) {
			if(!suppressStderr) console.error(data.toString());
		});

		exec.on("exit", function (code) {
			callback(null, output);
		});
	}
}());