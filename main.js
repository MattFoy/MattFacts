const http = require('http');
const express = require('express');
const { urlencoded } = require('body-parser');
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const mattFacts = require('./matt-facts.json');
const data = require('./database.js');

function getFact() {
	return mattFacts.facts[Math.floor(Math.random() * mattFacts.facts.length)];
}

function sendSMS(targetId, messageBody) {
	var twilio = require('twilio');
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

;(function() {
	data.initializeDatabase(function() {
		for (let i = 0; i < mattFacts.targets.length; i++) {
			let target = mattFacts.targets[i];

			data.getTargetByNumber(target.number, function(dbTarget) {
				if (!dbTarget) {
					data.addTarget(target.name, target.number);
					setTimeout(function() {
						data.getTargetByNumber(target.number, function(dbTarget) {
							sendSMS(dbTarget.id, 'Thanks for signing up for MattFacts™! You will now receive fun, hourly MattFacts™.\n\n'
								+ getFact()
								+'\n<To unsubscribe, reply "STOP">');
						});
					}, 200);
				} else {
					console.log("Target already added. ID: " + dbTarget.id);
				}
			});
		}
	});

	const app = express();
	app.use(urlencoded({ extended: false }));

	app.post('/sms', (req, res) => {
		const twiml = new MessagingResponse();

		data.getTargetByNumber(req.body.From, function(dbTarget) {
			data.saveReceivedMessage(dbTarget, req.body.Body, req.body.MessageSid);

			let message = 'Thanks for your active interest in MattFacts™.\n' + getFact() + '\n<To unsubscribe, reply "STOP">';

			twiml.message(message);
			res.writeHead(200, {'Content-Type': 'text/xml'});
			res.end(twiml.toString());
			data.saveSentMessage(dbTarget, message, '');
		});
	});

	http.createServer(app).listen(1337, () => {
		console.log('Express server listening on port 1337');
	});

	function mainLoop() {
		console.log((new Date()).toString());
		for (let i = 0; i < mattFacts.targets.length; i++) {
			data.getTargetByNumber(mattFacts.targets[i].number, function(dbTarget) {
				if (!dbTarget) {

				} else {
					data.whenWasLastSentMessage(dbTarget, function(d) {
						if (((new Date()).getTime()) - d > 1000 * 60 * 5) {
							console.log("It's been more than 5 minutes since we sent him a text...");

							sendSMS(dbTarget.id, getFact() + "\n<To unsubscribe reply \"STOP\">");
						}
					});
				}
			});
		}
	}

	setInterval(mainLoop, 5000);


	/*
	var twilio = require('twilio');
	var client = new twilio(mattFacts.accountSid, mattFacts.authToken);

	client.messages.create({
			body: 'Hello from Node',
			to: '+15197817739',	// Text this number
			from: mattFacts.twilioNumber // From a valid Twilio number
	})
	.then((message) => console.log(message.sid));
	*/
}());
	