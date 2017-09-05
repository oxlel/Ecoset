(function () {
    var config = require("config");
    var path = require("path");
    var spawn = require("child_process").spawn;
    var winston = require("winston");

    /**
     * An arbitrary executable
     */
    function Executable(executablesDict, name, implementation, command, filepath, output_format, stat) {
        this.name = name;
        this.implementation = implementation;
        this.command = command;
        this.executablesDict = executablesDict;
        this.filepath = filepath;
        this.output_format = output_format;
        this.stat = stat;
        this.complete = false;

        // runs the executable
        this.run = function (inputData, log, callback) {
            inputData.output_format = this.output_format;
            inputData.stat = this.stat;
            var that = this;

            var error = null;
            var exec = spawn(this.command, [this.filepath, JSON.stringify(inputData)], {
                cwd: config.process.executablesDir
            }); // start the process

            // log the output (stdout) of the executable
            exec.stdout.on("data", function (data) {
                log(that.name + " [STDOUT]: " + data.toString().trim());
            });

            // log any errors encountered (stderr)
            exec.stderr.on("data", function (data) {
                log(that.name + " [STDERR]: " + data.toString().trim());
                winston.error(that.name + " [STDERR]: " + data.toString().trim());
                if (error == null) error = "";
                error += data.toString();
            });

            exec.on("exit", function (code) {
                if(code != 0 && error == null)
                    error = "Executable " + that.name + " exited with code " + code.toString();

                log("Executable " + that.name + " exited with code " + code.toString());
                log("Executable " + that.name + " has finished");

                // call appropiate callbacks - if stderr is not empty the job will be reported to have failed
                that.complete = true;
                callback(error, that.name);
            });
        }
    }

    // returns an array of all executable definitions (name/implementation)
    module.exports.getExecutableDefinitions = function () {
        var output = [];
        var executables = config.process.executables;
        for (var i in executables) {
            var e = executables[i];
            var x = {};
            x.name = e.name;
            x.implementations = [];
            for (var j in e.implementations) {
                var imp = e.implementations[j];
                x.implementations.push(imp.name);
            }
            output.push(x);
        }
        return output;
    }

    // creates a dictionary of "Executable" objects
    var createExecutablesDict = function (inputData) {
        var executables = config.process.executables;
        var dir = config.process.executablesDir;
        var executablesDict = {};

        // populate the dictionary
        for (var e in executables) {
            // for every possible executable
            var executable = executables[e];
            for (var f in inputData.executables) {
                // for every wanted executable
                var wantedExecutable = inputData.executables[f];
                if (wantedExecutable.name == executable.name) {
                    // we have a match!
                    for (var i in executable.implementations) {
                        // for each possible implementation
                        var imp = executable.implementations[i];
                        if (imp.name == wantedExecutable.implementation) {
                            // we have a match! Add it to the dict
                            executablesDict[JSON.stringify(wantedExecutable)] = new Executable(executablesDict, executable.name,
                                imp.name, imp.command, dir + "/" + imp.filename, wantedExecutable.output_format, wantedExecutable.stat);
                        }
                    }
                }
            }
        }
        return executablesDict;
    }

    // the entry point for this file
    module.exports.run = function (inputData, log, callback) {
        // start all executables
        var executablesDict = createExecutablesDict(inputData);
        for (var e in executablesDict) {
            var executable = executablesDict[e];
            executable.run(inputData, log, callback);
        }
    }

}());