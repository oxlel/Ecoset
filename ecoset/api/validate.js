(function () {
    var executables = require("./executables");

    // returns a non-empty string detailing the error if the job params are not valid 
    module.exports.isJobValid = function (job) {
        // check for null values
        for(var val in job) {
            if(job[val] == null) return "No job values can be null";
        }

        if (job.north === undefined || job.south === undefined || job.east === undefined || job.west === undefined) {
            return "Missing n/s/e/w definition";
        }
        if (job.executables === undefined) {
            return "Missing executable array definition";
        }

        // must be at least 1 executable
        if (job.executables.length == 0) return "At least one executable must be defined"

        // check if lat/lons are in the valid range
        if (job.north <= -90 || job.north >= 90) return "North = " + job.north + " is not a valid latitude value";
        if (job.south <= -90 || job.south >= 90) return "South = " + job.south + " is not a valid latitude value";
        if (job.east <= -180 || job.east >= 180) return "East = " + job.east + " is not a valid longitude value";
        if (job.west <= -180 || job.west >= 180) return "West = " + job.west + " is not a valid longitude value";

        // check if lat/lons form a box
        if (job.north <= job.south) return "North value (" + job.north + ") must be greater than south value (" + job.south + ")";
        if (job.east <= job.west) return "East value (" + job.east + ") must be greater than west value (" + job.west + ")";

        // check that executables exist
        var availableExecutables = executables.getExecutableDefinitions();
        for (var ex in job.executables) {
            var e = job.executables[ex];

            var foundExecutable = false;
            for (var av in availableExecutables) {
                var a = availableExecutables[av];
                if (a.name == e.name) {
                    foundExecutable = true;
                    var foundImplementation = false;
                    for (var im in a.implementations) {
                        var i = a.implementations[im];
                        if (i == e.implementation) {
                            foundImplementation = true;
                            break;
                        }
                    }
                    if (foundImplementation) {
                        break;
                    } else {
                        return "Implementation \"" + e.implementation + "\" does not exist for executable \"" + e.name + "\"";
                    }
                    break;
                }
            }
            if (!foundExecutable) {
                return "Executable \"" + e.name + "\" does not exist";
            }
        }

        return "";
    }

    // returns a non-empty string detailing the error if job id request params are not valid
    module.exports.isJobIdRequestValid = function(pollRequest) {
        for(var val in pollRequest) {
            if(pollRequest[val] == null) return "No poll request values can be null";
        }

        if(pollRequest.jobId === undefined) return "Poll request must specify the job id, e.g. { jobId: ... }";

        if(typeof pollRequest.jobId !== "string") return "'jobId' must contain a string value";

        return "";
    }
}());