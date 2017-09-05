/**
 * A small shared helper function to allow the executable to quickly abort if the parameters it has been
 * passed are not valid
 */
module.exports = function (inputData, output_formats, stats, of_undef, st_undef) {
    var fail = false;
    if((output_formats.indexOf(inputData.output_format) == -1)) {
        if((of_undef && inputData.output_format != undefined && inputData.output_format != "") || !of_undef) {
            console.error("output_format \"" + inputData.output_format + "\" is not one of the allowed formats: " + output_formats);
            fail = true;
        }
    }

    if((stats.indexOf(inputData.stat) == -1)) {
        if((st_undef && inputData.stat != undefined && inputData.stat != "") || !st_undef) {
            console.error("stat \"" + inputData.stat + "\" is not one of the allowed formats: " + stats);
            fail = true;
        }
    }

    if(fail) {
        process.exit(1);
    }
};