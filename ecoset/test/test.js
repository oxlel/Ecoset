var assert = require("assert");
var config = require("config");
var fs = require("fs-extra");
var winston = require("winston");

describe("api", function () {
    winston.level = "warn";
    describe("validate", function () {
        var validate = require("../api/validate");
        describe("#isValidJob", function () {
            // helper function to create a basic job object
            function createJobObject(n, s, e, w, executables) {
                return {
                    north: n,
                    south: s,
                    east: e,
                    west: w,
                    executables: executables
                };
            }

            describe("Empty JSON", function () {
                it("should not allow empty JSON", function () {
                    var job = {};
                    assert.equal(validate.isJobValid(job), "Missing n/s/e/w definition");
                });
            });

            describe("Null values", function () {
                it("should not allow null values in job object", function () {
                    var job = createJobObject(null, null, null, null);
                    assert.equal(validate.isJobValid(job), "No job values can be null");
                });
            });

            describe("Empty executable array", function () {
                it("should not allow empty jobs (no executables) to run", function () {
                    var job = createJobObject(1, -1, 1, -1, []);
                    assert.equal(validate.isJobValid(job), "At least one executable must be defined");
                });
            });

            describe("North coord less than -90", function () {
                it("should not allow the north value to be less than -90", function () {
                    var job = createJobObject(-90.1, 0, 0, 0, [{
                        name: "executable1",
                        implementation: "1"
                    }]);
                    assert.equal(validate.isJobValid(job), "North = -90.1 is not a valid latitude value");
                });
            });

            describe("North coord greater than 90", function () {
                it("should not allow the north value to be greater than 90", function () {
                    var job = createJobObject(90.1, 0, 0, 0, [{
                        name: "executable1",
                        implementation: "1"
                    }]);
                    assert.equal(validate.isJobValid(job), "North = 90.1 is not a valid latitude value");
                });
            });

            describe("South coord less than -90", function () {
                it("should not allow the south value to be less than -90", function () {
                    var job = createJobObject(0, -90.1, 0, 0, [{
                        name: "executable1",
                        implementation: "1"
                    }]);
                    assert.equal(validate.isJobValid(job), "South = -90.1 is not a valid latitude value");
                });
            });

            describe("South coord greater than 90", function () {
                it("should not allow the south value to be greater than 90", function () {
                    var job = createJobObject(0, 90.1, 0, 0, [{
                        name: "executable1",
                        implementation: "1"
                    }]);
                    assert.equal(validate.isJobValid(job), "South = 90.1 is not a valid latitude value");
                });
            });

            describe("East coord less than -180", function () {
                it("should not allow the east value to be less than -180", function () {
                    var job = createJobObject(0, 0, -180.1, 0, [{
                        name: "executable1",
                        implementation: "1"
                    }]);
                    assert.equal(validate.isJobValid(job), "East = -180.1 is not a valid longitude value");
                });
            });

            describe("East coord greater than 180", function () {
                it("should not allow the east value to be greater than 180", function () {
                    var job = createJobObject(0, 0, 180.1, 0, [{
                        name: "executable1",
                        implementation: "1"
                    }]);
                    assert.equal(validate.isJobValid(job), "East = 180.1 is not a valid longitude value");
                });
            });

            describe("West coord less than -180", function () {
                it("should not allow the west value to be less than -180", function () {
                    var job = createJobObject(0, 0, 0, -180.1, [{
                        name: "executable1",
                        implementation: "1"
                    }]);
                    assert.equal(validate.isJobValid(job), "West = -180.1 is not a valid longitude value");
                });
            });

            describe("West coord greater than 180", function () {
                it("should not allow the west value to be greater than 180", function () {
                    var job = createJobObject(0, 0, 0, 180.1, [{
                        name: "executable1",
                        implementation: "1"
                    }]);
                    assert.equal(validate.isJobValid(job), "West = 180.1 is not a valid longitude value");
                });
            });

            describe("Nonexistent executable", function () {
                it("should not allow a job to request a nonexistent executable", function () {
                    var job = createJobObject(1, 0, 1, 0, [{
                        name: "test",
                        implementation: "test"
                    }]);
                    assert.equal(validate.isJobValid(job), "Executable \"test\" does not exist");
                });
            });

            describe("Nonexistent executable implementation", function () {
                it("should not allow a job to request a nonexistent executable implementation", function () {
                    var job = createJobObject(1, 0, 1, 0, [{
                        name: "executable1",
                        implementation: "2"
                    }]);
                    assert.equal(validate.isJobValid(job), "Implementation \"2\" does not exist for executable \"executable1\"");
                });
            });
        });

        describe("#isJobIdRequestValid", function () {
            // helper function to create a basic poll request object
            function createPollRequestObject(jobId) {
                return {
                    jobId: jobId
                };
            }

            describe("Empty JSON", function () {
                it("should not allow empty JSON", function () {
                    var pollRequest = {};
                    assert.equal(validate.isJobIdRequestValid(pollRequest), "Poll request must specify the job id, e.g. { jobId: ... }");
                });
            });
            describe("Null jobId", function () {
                it("should not allow a null jobId", function () {
                    var pollRequest = createPollRequestObject(null);
                    assert.equal(validate.isJobIdRequestValid(pollRequest), "No poll request values can be null");
                });
            });
            describe("Non-string jobId", function () {
                it("should not allow a non-string jobId", function () {
                    var pollRequest = createPollRequestObject(123);
                    assert.equal(validate.isJobIdRequestValid(pollRequest), "'jobId' must contain a string value");
                });
            });
        });
    });
});