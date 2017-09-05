(function () {
	var kue = require("kue");
	var ui = require("kue-ui");
	var config = require("config");
	var express = require("express");
	var uuid = require("node-uuid");
	var winston = require("winston");
	var moment = require("moment");
	var path = require("path");
	var fs = require("fs");
	var del = require("del");
	const { execSync } = require('child_process');
	var syncFiber = require("sync");
	var redis = require("redis");
	var fileExists = require('file-exists');

	var executables = require("./executables");

	// the below code allows the project to be ran without docker
	var queue;
	if(config.get("kue.useDockerRedis")) {
		queue = kue.createQueue({
			redis: {
				port: '6379',
				host: 'redis',
				db: 3 
			}
		});
	} else {
		queue = kue.createQueue();
	}

	// An enum of possible job states
	const JobStates = {
		NONEXISTENT: "NONEXISTENT",
		QUEUED: "QUEUED",
		PROCESSING: "PROCESSING",
		READY: "READY",
		FAILED: "FAILED"
	}

	var app = express(); // express app for ui
	var client;

	if(config.get("kue.useDockerRedis")) {
		client = redis.createClient('6379', 'redis', {
			prefix: "state:"
		});
	} else {
		client = redis.createClient({
			prefix: "state:"
		});
	}

	client.on("error", function (err) {
		winston.warn("Error thrown by node redis connection: " + err);
	});

	// setup alternative kue ui
	ui.setup({
		apiURL: "/dashboard",
		baseURL: "/kue-ui",
		updateInterval: 5000
	});

	// set the title accordingly
	kue.app.set("title", "Ecoset");

	// mount kue dashboard (and api)
	app.use("/dashboard", kue.app);
	// mount kue-ui
	app.use("/kue-ui", ui.app);

	/**
	 * Submits an ecoset job by saving it into the kue job queue.
	 * Callback returns an error (if one occurred) and the job id.
	 */
	module.exports.submitJob = function (job, callback) {
		job.id = uuid.v1();
		job.title = "[" + moment().format() + "] [" + job.id + "] N: " + job.north + ", S: " + job.south + ", E: " + job.east + ", W: " + job.west;

		var process = queue.create("ecoset", job).save(function (err) {
			if (err) {
				winston.warn("Job id: " + job.id + " failed to be saved to the kue queue");
				client.set(job.id, JobStates.FAILED);
				callback(err, job.id);
			} else {
				winston.info("Job id: " + job.id + " successfully saved to the kue queue");
				client.set(job.id, JobStates.QUEUED);
				callback(null, job.id);
			}
		});

		process.on("complete", function (result) {
			winston.info("Job id: " + job.id + " successfully finished ecoset processing");
			client.set(job.id, JobStates.READY);
		}).on("failed attempt", function (errorMessage, doneAttempts) {
			winston.info("Job id: " + job.id + " failed ecoset processing");
			client.set(job.id, JobStates.FAILED);
		}).on("failed", function (errorMessage) {
			winston.info("Job id: " + job.id + " failed ecoset processing");
			client.set(job.id, JobStates.FAILED);
		});
	}

	/**
	 * Polls the redis store for job state by job id.
	 */
	module.exports.pollJob = function (jobId, callback) {
		// check that job with id exists
		client.exists(jobId, function (err, reply) {
			if (reply === 1) {
				client.get(jobId, function (err, reply) {
					if (err) callback(err, null);
					else callback(null, reply);
				});
			} else {
				// job doesn't exist
				callback(null, JobStates.NONEXISTENT);
			}
		});
	}

	/**
	 * Returns the location of the output.json file for the specified job
	 */
	module.exports.fetchJob = function (jobId, callback) {
		// check that job with id exists
		client.exists(jobId, function (err, reply) {
			if (reply === 1) {
				client.get(jobId, function (err, reply) {
					if (err) callback(err, null);
					else {
						if(reply == "READY") {
							var outputDir = path.format({
								dir: config.process.outputDir + "/" + jobId
							});
							callback(null, outputDir + "/output.json");
						} else {
							callback(new Error("Job \"" + jobId + "\" is not ready, it's state is: " + reply));
						}
					}
				});
			} else {
				// job doesn't exist
				callback(new Error("Job \"" + jobId + "\" does not exist on the server"));
			}
		});
	}

	/**
	 * Called when a brand new job has been submitted - creates the initial raw data output.
	 * Every job must go through this process before other tasks can be run on that job.
	 */
	queue.process("ecoset", config.get("kue.maxConcurrentJobs"), function (process, done) {
		var job = process.data;

		client.set(job.id, JobStates.PROCESSING);
		winston.info("Starting processing of job: " + JSON.stringify(job));
		process.log(moment().format() + "\t Started processing");

		// create output directory for job
		var outputDir = path.format({
			dir: config.process.outputDir + "/" + job.id
		});
		if (fs.existsSync(outputDir)) {
			process.log(moment().format() + "\t Output folder already exists, removing for reprocessing");
			winston.info("Output folder already exists, removing for reprocessing");
			del.sync([outputDir + "**"], {
				"force": true
			});
		}
		fs.mkdirSync(outputDir);
		process.log(moment().format() + "\t Created output directory: " + outputDir);
		winston.info("Created output directory: " + outputDir);

		// format data to be passed to each executable
		var inputData = {
			north: job.north,
			south: job.south,
			east: job.east,
			west: job.west,
			executables: job.executables,
			outputDir: outputDir
		}

		var completed = 0;
		var total = job.executables.length;
		executables.run(inputData, function (text) {
			process.log(moment().format() + "\t" + text);
			winston.info(text);
		}, function (err, data) {
			// called when an individual executable finishes
			if (err != null) {
				// executable did not complete successfully
				return done(new Error(err));
			}

			completed++;
			process.progress(completed, total);

			if (completed == total) {
				console.log("All executables have finished - writing output.json");
				syncFiber(function () {
					// build the final json file
					fs.writeFileSync(outputDir + "/output.json", "{\"north\": " + job.north + ",\"south\":" + job.south + ",\"east\":" + job.east + ",\"west\":" + job.west + ",\"output\":[");
					for (var i = 0; i < job.executables.length; i++) {
						var exec = job.executables[i];

						if(!fileExists.sync(outputDir + "/" + exec.name + "_output.json")) {
							console.log(exec.name + " has not outputted anything!!!!");
							process.warn("Executable " + exec.name + " has not returned an output JSON file");
							winston.warn("Executable " + exec.name + " has not returned an output JSON file");
							continue;
						}
						console.log(exec.name + " - writing section");
						fs.appendFileSync(outputDir + "/output.json", "{ \"name\":\"" + exec.name + "\",\"implementation\":\"" + exec.implementation + "\",\"output_format\":\"" + exec.output_format + "\",\"stat\":\"" + exec.stat + "\",\"data\":");
						execSync("cat " + outputDir + "/" + exec.name + "_output.json >> " + outputDir + "/output.json");

						// delete the "[executable]_output.json" file
						//try { fs.unlink.sync(null, outputDir + "/" + exec.name + "_output.json") } catch(e) {};

						if (i < job.executables.length - 1) {
							fs.appendFileSync(outputDir + "/output.json", "},");
						}
						console.log(exec.name + " - written section");
					}
					fs.appendFileSync(outputDir + "/output.json", "}]}");
					
					process.log(moment().format() + "\t Job " + job.id + " has completed");
					done(null, outputDir + "/output.json");
				});
			}
		});
	});

	// listen for connections to the dashboard (and alt ui)
	app.listen(config.get("kue.port"));
}());