import moment from 'moment';
import fs from 'fs-extra';

class Logger {

	constructor() {
		this.targets_ = [];
		this.level_ = Logger.LEVEL_ERROR;
	}

	setLevel(level) {
		this.level_ = level;
	}

	level() {
		return this.level_;
	}

	clearTargets() {
		this.targets_.clear();
	}

	addTarget(type, options = null) {
		let target = { type: type };
		for (let n in options) {
			if (!options.hasOwnProperty(n)) continue;
			target[n] = options[n];
		}

		this.targets_.push(target);
	}

	log(level, object) {
		if (this.level() < level || !this.targets_.length) return;

		let levelString = '';
		if (this.level() == Logger.LEVEL_INFO) levelString = '[info] ';
		if (this.level() == Logger.LEVEL_WARN) levelString = '[warn] ';
		if (this.level() == Logger.LEVEL_ERROR) levelString = '[error] ';
		let line = moment().format('YYYY-MM-DD HH:mm:ss') + ': ' + levelString;

		for (let i = 0; i < this.targets_.length; i++) {
			let t = this.targets_[i];
			if (t.type == 'console') {
				let fn = 'debug';
				if (level = Logger.LEVEL_ERROR) fn = 'error';
				if (level = Logger.LEVEL_WARN) fn = 'warn';
				if (level = Logger.LEVEL_INFO) fn = 'info';
				if (typeof object === 'object') {
					console[fn](line, object);
				} else {
					console[fn](line + object);
				}
			} else if (t.type == 'file') {
				if (typeof object === 'object') object = JSON.stringify(object);
				fs.appendFile(t.path, line + object + "\n", (error) => {
					if (error) throw error;
				});
			}
		}
	}

	error(object) { return this.log(Logger.LEVEL_ERROR, object); }
	warn(object)  { return this.log(Logger.LEVEL_WARN, object); }
	info(object)  { return this.log(Logger.LEVEL_INFO, object); }
	debug(object) { return this.log(Logger.LEVEL_DEBUG, object); }

}

Logger.LEVEL_NONE = 0;
Logger.LEVEL_ERROR = 10;
Logger.LEVEL_WARN = 20;
Logger.LEVEL_INFO = 30;
Logger.LEVEL_DEBUG = 40;

export { Logger };