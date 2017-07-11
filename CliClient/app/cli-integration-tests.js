"use strict"

require('source-map-support').install();
require('babel-plugin-transform-runtime');

import fs from 'fs-extra';
import { Logger } from 'lib/logger.js';
import { dirname } from 'lib/path-utils.js';
import { DatabaseDriverNode } from 'lib/database-driver-node.js';
import { JoplinDatabase } from 'lib/joplin-database.js';
import { BaseModel } from 'lib/base-model.js';
import { Folder } from 'lib/models/folder.js';
import { Note } from 'lib/models/note.js';
import { Setting } from 'lib/models/setting.js';
import { sprintf } from 'sprintf-js';
const exec = require('child_process').exec

process.on('unhandledRejection', (reason, p) => {
	console.error('Unhandled promise rejection', p, 'reason:', reason);
});

const baseDir = dirname(__dirname) + '/tests/cli-integration';
const joplinAppPath = __dirname + '/main.js';

const logger = new Logger();
logger.addTarget('console');
logger.setLevel(Logger.LEVEL_ERROR);

const dbLogger = new Logger();
dbLogger.addTarget('console');
dbLogger.setLevel(Logger.LEVEL_INFO);

const db = new JoplinDatabase(new DatabaseDriverNode());
db.setLogger(dbLogger);

function createClient(id) {
	return {
		'id': id,
		'profileDir': baseDir + '/client' + id,
	};
}

const client = createClient(1);

function execCommand(client, command, options = {}) {
	let exePath = 'node ' + joplinAppPath;
	let cmd = exePath + ' --update-geolocation-disabled --env dev --profile ' + client.profileDir + ' ' + command;
	logger.info(client.id + ': ' + command);

	return new Promise((resolve, reject) => {
		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				logger.error(stderr);
				reject(error);
			} else {
				resolve(stdout.trim());
			}
		});
	});
}

function assertTrue(v) {
	if (!v) throw new Error(sprintf('Expected "true", got "%s"."', v));
	process.stdout.write('.');
}

function assertFalse(v) {
	if (v) throw new Error(sprintf('Expected "false", got "%s"."', v));
	process.stdout.write('.');
}

function assertEquals(expected, real) {
	if (expected !== real) throw new Error(sprintf('Expecting "%s", got "%s"', expected, real));
	process.stdout.write('.');
}

async function clearDatabase() {
	await db.transactionExecBatch([
		'DELETE FROM folders',
		'DELETE FROM notes',
		'DELETE FROM tags',
		'DELETE FROM note_tags',
		'DELETE FROM resources',
		'DELETE FROM deleted_items',
	]);
}

const testUnits = {};

testUnits.testFolders = async () => {
	await execCommand(client, 'mkbook nb1');

	let folders = await Folder.all();
	assertEquals(1, folders.length);
	assertEquals('nb1', folders[0].title);

	await execCommand(client, 'mkbook nb1');

	folders = await Folder.all();
	assertEquals(1, folders.length);
	assertEquals('nb1', folders[0].title);

	await execCommand(client, 'rm -r -f nb1');

	folders = await Folder.all();
	assertEquals(0, folders.length);
}

testUnits.testNotes = async () => {
	await execCommand(client, 'mkbook nb1');
	await execCommand(client, 'mknote n1');

	let notes = await Note.all();
	assertEquals(1, notes.length);
	assertEquals('n1', notes[0].title);

	await execCommand(client, 'rm -f n1');
	notes = await Note.all();
	assertEquals(0, notes.length);

	await execCommand(client, 'mknote n1');
	await execCommand(client, 'mknote n2');

	notes = await Note.all();
	assertEquals(2, notes.length);

	await execCommand(client, "rm -f 'blabla*'");

	notes = await Note.all();
	assertEquals(2, notes.length);

	await execCommand(client, "rm -f 'n*'");

	notes = await Note.all();
	assertEquals(0, notes.length);
}

testUnits.testCat = async () => {
	await execCommand(client, 'mkbook nb1');
	await execCommand(client, 'mknote mynote');

	let folder = await Folder.loadByTitle('nb1');
	let note = await Note.loadFolderNoteByField(folder.id, 'title', 'mynote');

	let r = await execCommand(client, 'cat mynote');
	assertTrue(r.indexOf('mynote') >= 0);
	assertFalse(r.indexOf(note.id) >= 0);

	r = await execCommand(client, 'cat -v mynote');
	assertTrue(r.indexOf(note.id) >= 0);
}

async function main(argv) {
	await fs.remove(baseDir);

	logger.info(await execCommand(client, 'version'));

	await db.open({ name: client.profileDir + '/database.sqlite' });
	BaseModel.db_ = db;
	await Setting.load();

	let onlyThisTest = 'testCat';
	onlyThisTest = '';

	for (let n in testUnits) {
		if (!testUnits.hasOwnProperty(n)) continue;
		if (onlyThisTest && n != onlyThisTest) continue;

		await clearDatabase();
		process.stdout.write(n + ': ');
		await testUnits[n]();
		console.info('');
	}
}

main(process.argv).catch((error) => {
	console.info('');
	logger.error(error);
});