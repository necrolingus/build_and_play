const { Client } = require('pg');
const { Sequelize } = require('sequelize');
require('dotenv').config();

const DB_HOST = process.env.POSTGRES_SERVER_IP || '127.0.0.1';
const DB_PORT = parseInt(process.env.POSTGRES_PORT || '5432', 10);
const DB_USER = process.env.POSTGRES_USER || 'postgres';
const DB_PASS = process.env.POSTGRES_PASSWORD || '';
const DB_NAME = process.env.POSTGRES_GAME_ENGINE_DB || 'game_engine';

// Create the Sequelize instance pointing to the target database
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

/**
 * Ensures the target database exists in Postgres, creating it if missing,
 * and then authenticates and syncs all Sequelize models.
 */
async function ensureDatabaseExists() {
  const adminClient = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: 'postgres'
  });

  try {
    await adminClient.connect();
    const res = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [DB_NAME]
    );

    if (res.rowCount === 0) {
      // Safe identifier quoting for database creation
      const safeDbName = DB_NAME.replace(/[^a-zA-Z0-9_]/g, '');
      await adminClient.query(`CREATE DATABASE "${safeDbName}"`);
      console.log(`[Database] Created missing PostgreSQL database: ${safeDbName}`);
    } else {
      console.log(`[Database] PostgreSQL database "${DB_NAME}" already exists.`);
    }
  } finally {
    await adminClient.end().catch(() => {});
  }
}

module.exports = {
  sequelize,
  ensureDatabaseExists,
  DB_NAME,
  DB_HOST
};
