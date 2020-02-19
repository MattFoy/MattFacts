const sqlite3 = require('sqlite3').verbose();

const dbPath = './db/data.db';

function getDb() {
	let db = new sqlite3.Database(dbPath);
	//console.log('Opened database connection.');
	return db;
}

function closeDb(db) {
	db.close((err) => {
		if (err) {
			console.error(err.message);
		}
		//console.log('Closed database connection.');
	});
}

function initializeDatabase(then) {
	let db = getDb();
	
	console.log("Initializing SQLite3 Database...");
	
	db.run('CREATE TABLE IF NOT EXISTS targets (id INTEGER PRIMARY KEY, name TEXT, number TEXT, UNIQUE(number))');

	db.run('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, target INTEGER, direction TEXT, timestamp INTEGER, message TEXT, sid TEXT, CONSTRAINT fk_target FOREIGN KEY (target) REFERENCES targets (ID))');

	closeDb(db);

	if (then && typeof then === 'function') { setTimeout(then, 500); }
}

function addTarget(name, number) {
	let db = getDb();
	console.log("Adding target: " + name + "(" + number + ")");

	db.run(`INSERT INTO targets(name, number) VALUES(?,?)`, [name,number], function(err) {
		if (err) {
			return console.log(err.message);
		}
	});

	closeDb(db);
}

function getTargetByNumber(number, then) {
	let db = getDb();

	db.all("SELECT id, name FROM targets WHERE number = ?", [number], (err, rows) => {
		if (err) {
			throw err;
		}
		let target = null;
		rows.forEach((row) => {
			target = { id: row.id, name: row.name, number: number };
		});

		if (then && typeof then === 'function') { then(target); }
	});

	closeDb(db);
}

function getTargetById(id, then) {
	let db = getDb();

	db.all("SELECT name, number FROM targets WHERE id = ?", [id], (err, rows) => {
		if (err) {
			throw err;
		}
		let target = null;
		rows.forEach((row) => {
			target = { id: id, name: row.name, number: row.number };
		});

		if (then && typeof then === 'function') { then(target); }
	});

	closeDb(db);
}

function saveSentMessage(target, text, sid) {
	let db = getDb();
	console.log("Sent text to " + target.name + "(" + target.number + "): " + text);

	// ((new Date()).getTime())

	db.run(`INSERT INTO messages (target, direction, timestamp, message, sid) VALUES(?,?,?,?,?)`, 
		[target.id, "out", ((new Date()).getTime()), text, sid], function(err) {
		if (err) {
			return console.log(err.message);
		}
	});

	closeDb(db);
}

function saveReceivedMessage(target, text, sid) {
	let db = getDb();
	console.log("Received message from " + target.name + "(" + target.number + "): " + text);

	db.run(`INSERT INTO messages (target, direction, timestamp, message, sid) VALUES(?,?,?,?,?)`, 
		[target.id, "in", ((new Date()).getTime()), text, sid], function(err) {
		if (err) {
			return console.log(err.message);
		}
	});

	closeDb(db);
}

function whenWasLastSentMessage(target, then) {
	let db = getDb();

	db.all("SELECT timestamp FROM messages WHERE target = ? AND direction = \"out\" ORDER BY timestamp DESC", [target.id], (err, rows) => {
		if (err) {
			throw err;
		}
		
		let latestDate = rows[0].timestamp;

		if (then && typeof then === 'function') { then(latestDate); }
	});

	closeDb(db);
}

module.exports = {
	initializeDatabase,
	addTarget,
	getTargetById,
	getTargetByNumber,
	saveSentMessage,
	saveReceivedMessage,
	whenWasLastSentMessage
}