const winston = require('winston');
const Transport = require('winston-transport');
const AppLog = require('../models/AppLog');

class PostgresSequelizeTransport extends Transport {
  constructor(opts = {}) {
    super(opts);
    this.dbReady = false;
  }

  setDbReady(ready) {
    this.dbReady = Boolean(ready);
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    if (!this.dbReady) {
      return callback();
    }

    const { level, message, timestamp, ...meta } = info;
    AppLog.create({
      level: String(level || 'info'),
      message: String(message || ''),
      meta: Object.keys(meta).length > 0 ? meta : null
    }).catch((err) => {
      // Avoid recursive logging loop if DB write fails
      console.error('[Logger] Failed to write log to PostgreSQL:', err.message);
    });

    callback();
  }
}

const pgTransport = new PostgresSequelizeTransport({ level: 'info' });

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] ${level}: ${message}${metaStr}`;
        })
      )
    }),
    pgTransport
  ]
});

function enableDatabaseLogging() {
  pgTransport.setDbReady(true);
}

module.exports = {
  logger,
  enableDatabaseLogging
};
