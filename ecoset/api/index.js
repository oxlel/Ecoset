var express = require("express");
var bodyParser = require("body-parser");
var config = require("config");
var winston = require("winston");
winston.cli();
var manager = require("./manager");
var validate = require("./validate");
var executables = require("./executables");
var app = express();
app.use(bodyParser.json());

/**
 * The API endpoint "/submit"
 * Takes user input in the form of JSON - checks that the JSON is valid, then hands the job
 * off to the job manager to process. Returns the id of the job once it has been submitted.
 */
app.post("/submit", function (request, response) {
	var job = request.body;
	winston.info("/submit request received: " + JSON.stringify(job));
	var error = validate.isJobValid(job);
	if (error == "") {
		manager.submitJob(job, function (err, id) {
			if (err) {
				response.status(500).send({ success: false, message: "Job submission failed", jobId: null});
				response.end();
			} else {
				response.status(200).send({ success: true, message: "Job successfully submitted, id: " + id, jobId: id});
				response.end();
			}
		});
	} else {
		winston.warn("Request " + JSON.stringify(job) + " contains invalid parameters, error = " + error);
		response.status(400).send({ success: false, message: "Bad request data: " + error, jobId: null });
		response.end();
	}
});

/**
 * The API endpoint "/poll"
 * Takes user input in the form of JSON - contains the job id to poll
 */
app.post("/poll", function (request, response) {
	var pollRequest = request.body;
	winston.info("/poll request received: " + JSON.stringify(pollRequest));
	var error = validate.isJobIdRequestValid(pollRequest);
	if (error == "") {
		manager.pollJob(pollRequest.jobId, function(err, state) {
			if(state == "FAILED") {
				response.status(200).send({ success: true, message: "Job " + pollRequest.jobId + " has " + state, jobState: state });
			} else {
				response.status(200).send({ success: true, message: "Job " + pollRequest.jobId + " is " + state, jobState: state });
			}
			response.end();
		});
	} else {
		winston.warn("Poll request " + JSON.stringify(pollRequest) + " contains invalid parameters, error = " + error);
		response.status(400).send({ success: false, message: "Bad request data: " + error, jobState: null });
		response.end();
	}
});

/**
 * The API endpoint "/fetch"
 * Takes user input in the form of JSON - contains the job id to fetch data from
 */
app.post("/fetch", function (request, response) {
	var fetchRequest = request.body;
	winston.info("/fetch request received: " + JSON.stringify(fetchRequest));
	var error = validate.isJobIdRequestValid(fetchRequest);
	if (error == "") {
		manager.fetchJob(fetchRequest.jobId, function(err, outputFile) {
			if(err) {
				winston.warn("Error fetching job, error = " + err);
				response.status(500).send({ success: false, message: err.toString() })
			} else {
				response.sendFile(outputFile);
			}
		});
	} else {
		winston.warn("Fetch request " + JSON.stringify(fetchRequest) + " contains invalid parameters, error = " + error);
		response.status(400).send({ success: false, message: "Bad request data: " + error });
		response.end();
	}
});

// sneaky function to handle json error response manually
app.use(function (err, request, response, next) {
	if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
		if(request.originalUrl == "/submit") {
			winston.warn("Request contains invalid parameters, error = " + err);
			response.status(400).send({ success: false, message: "JSON is invalid - " + err, jobId: null });
			response.end();
		}
	}
});

// start the server and make it listen for connections on port from config
app.listen(config.get("api.port"));
winston.info("Express server listening on port: " + config.get("api.port"));