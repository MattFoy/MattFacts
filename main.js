const { spawn } = require("child_process");
const http = require('http');
const express = require('express');
const { urlencoded } = require('body-parser');
const twilio = require('twilio');
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const mattFacts = require('./matt-facts.json');
const data = require('./database.js');

;(function registerWebhook() {
	// Spawn a ngrok child process
	let ngrok = spawn("./bin/ngrok", ["http", "1337"]);

	// Establish some basic event triggers
	ngrok.stdout.on("data", data => { console.log(`ngrok - stdout: ${data}`);	});
	ngrok.stderr.on("data", data => { console.log(`ngrok - stderr: ${data}`);	});
	ngrok.on('error', (error) => { console.log(`ngrok - error: ${error.message}`); });
	ngrok.on("close", code => { console.log(`ngrok - child process exited with code ${code}`); });
	process.on('exit', function(code) {
    console.log("Killing child process");
    ngrok.kill();
    console.log("Main process exited with code", code);
  });

	setTimeout(function() {
		// Ask the ngrok local API for the endpoint it created
		http.get("http://127.0.0.1:4040/api/tunnels", function(resp) {
			let data = '';

			// A chunk of data has been recieved.
			resp.on('data', (chunk) => { data += chunk; });

			// The whole response has been received. Print out the result.
			resp.on('end', () => {
				var parsedData = JSON.parse(data);
				var ngrokUrl = parsedData.tunnels[0].public_url;
				console.log(`ngrok URL: ${ngrokUrl}`);

				// Update the Twilio Messaging Service with the new webhook
				var client = new twilio(mattFacts.accountSid, mattFacts.authToken);
				client.messaging.services
					.get(mattFacts.messagingServiceSid)
					.update({inboundRequestUrl: ngrokUrl + "/sms"})
					.then(service => { setInterval(mainLoop, 5000); });
			});
		}).on("error", (err) => {
			console.log("Error: " + err.message);
		});
	}, 5000);
}());

// get a random MattFact™
function getFact() {
	return mattFacts.facts[Math.floor(Math.random() * mattFacts.facts.length)];
}

// get the text footer to display under all MattFacts
function getFooter() {
	return '\n<To unsubscribe, reply "Matt_' + makeid(8) + '">'
}

function sendSMS(targetId, messageBody) {
	var client = new twilio(mattFacts.accountSid, mattFacts.authToken);

	data.getTargetById(targetId, function(dbTarget) {
		if (!dbTarget) {
			console.log("Error, no target with id " + targetId)
		} else {
			client.messages.create({
					body: messageBody,
					to: dbTarget.number,	// Text this number
					from: mattFacts.twilioNumber // From a valid Twilio number
			})
			.then(function(msg) {
				data.saveSentMessage(dbTarget, messageBody, msg.sid);
			});
		}
	});
}

// Thanks https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
function makeid(length) {
	 var result					 = '';
	 var characters			 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	 var charactersLength = characters.length;
	 for ( var i = 0; i < length; i++ ) {
			result += characters.charAt(Math.floor(Math.random() * charactersLength));
	 }
	 return result;
}

;(function() {
	data.initializeDatabase(function() {
		for (let i = 0; i < mattFacts.targets.length; i++) {
			;(function(target) {
				data.getTargetByNumber(target.number, function(dbTarget) {
					if (!dbTarget) {
						data.addTarget(target.name, target.number);
					} else {
						//console.log("Target already added. ID: " + dbTarget.id);
						setTimeout(function() {
							data.getTargetByNumber(target.number, function(dbTarget) {
								//sendSMS(dbTarget.id, 'Hi ' + target.name + ', thanks for subscribing to MattFacts™! You will now receive fun, periodic MattFacts™. Your premium subscription will expire on 2021/03/31. To learn more, visit https://matthewfoy.ca/mattfacts');
								sendSMS(dbTarget.id, "Happy April fools' day!");
								setTimeout(function() {
									sendSMS(dbTarget.id, getFact() + getFooter());
								}, 2000);
							});
						}, 200);
					}
				});
			}(mattFacts.targets[i]));
		}
	});

	/*
	const app = express();
	app.use(urlencoded({ extended: false }));

	app.post('/sms', (req, res) => {
		let twiml = new MessagingResponse();

		data.getTargetByNumber(req.body.From, function(dbTarget) {
			data.saveReceivedMessage(dbTarget, req.body.Body, req.body.MessageSid);
			
			let message = "";
			if (req.body.Body.indexOf('Matt_') === 0) {
				message = '<Unrecognized command>\n';
			}
			message += getFact();
			twiml.message(message);
			res.writeHead(200, {'Content-Type': 'text/xml'});
			res.end(twiml.toString());
			data.saveSentMessage(dbTarget, message, '');
		});
	});

	http.createServer(app).listen(1337, () => {
		console.log('Express server listening on port 1337');
	});
	*/
}());

function mainLoop() {
	console.log((new Date()).toString());
	for (let i = 0; i < mattFacts.targets.length; i++) {
		;(function(target) {
			data.getTargetByNumber(target.number, function(dbTarget) {
				if (dbTarget) {
					data.whenWasLastSentMessage(dbTarget, function(d) {
						if (((new Date()).getTime()) - d > 1000 * 60 * mattFacts.messageInterval) {
							sendSMS(dbTarget.id, getFact() + getFooter());
						}
					});
				}
			});
		}(mattFacts.targets[i]));
	}
}