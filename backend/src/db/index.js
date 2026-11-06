import fs from 'fs';
import path from 'path';
import pg from 'pg';
import sqlite3 from 'sqlite3';
import { config } from '../config/index.js';
import { SQLITE_INIT_SCHEMA } from './sqlite-schema.js';

const { Pool } = pg;

let pgPool = null;
let sqliteDb = null;
let activeEngine = 'sqlite'; // 'postgres' | 'sqlite'

export async function initDb() {
  // If PostgreSQL URL is provided and not explicitly set to sqlite, try PostgreSQL
  if (config.db.url && config.db.mode !== 'sqlite') {
    try {
      pgPool = new Pool({
        connectionString: config.db.url,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });

      // Test connection
      const client = await pgPool.connect();
      client.release();
      activeEngine = 'postgres';
      console.log('✅ Connected to PostgreSQL database.');

      // Run PostgreSQL migrations
      await runPostgresMigrations();
      return { engine: 'postgres' };
    } catch (err) {
      console.warn('⚠️ Could not connect to PostgreSQL:', err.message);
      console.log('🔄 Falling back to embedded SQLite database for zero-config operation...');
    }
  }

  // SQLite fallback
  const sqliteDir = path.dirname(config.db.sqlitePath);
  if (!fs.existsSync(sqliteDir)) {
    fs.mkdirSync(sqliteDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    sqliteDb = new sqlite3.Database(config.db.sqlitePath, (err) => {
      if (err) {
        console.error('❌ Failed to open SQLite database:', err);
        return reject(err);
      }
      activeEngine = 'sqlite';
      console.log(`✅ Connected to SQLite database at: ${config.db.sqlitePath}`);

      // Run SQLite schema initialization
      sqliteDb.exec(SQLITE_INIT_SCHEMA, (schemaErr) => {
        if (schemaErr) {
          console.error('❌ Failed to initialize SQLite schema:', schemaErr);
          return reject(schemaErr);
        }
        console.log('✅ SQLite schema verified and ready.');
        resolve({ engine: 'sqlite' });
      });
    });
  });
}

async function runPostgresMigrations() {
  const migrationPath = path.resolve(process.cwd(), '../migrations/001_initial_schema.sql');
  if (fs.existsSync(migrationPath)) {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pgPool.query(sql);
    console.log('✅ PostgreSQL initial schema migrations executed successfully.');
  }
}

/**
 * Universal Parameterized Query Runner
 * Supports standard PostgreSQL $1, $2, ... parameter markers.
 * Automatically adapts markers for SQLite (? syntax) and returns uniform { rows, rowCount }.
 */
export async function query(sql, params = []) {
  if (activeEngine === 'postgres') {
    const res = await pgPool.query(sql, params);
    return {
      rows: res.rows,
      rowCount: res.rowCount,
    };
  }

  // SQLite adapter
  return new Promise((resolve, reject) => {
    // Transform $1, $2, ... to ?
    let adaptedSql = sql.replace(/\$(\d+)/g, '?');

    // Handle SQLite specific date functions if any
    adaptedSql = adaptedSql.replace(/gen_random_uuid\(\)/gi, 'lower(hex(randomblob(16)))');

    const trimmed = adaptedSql.trim().toUpperCase();
    const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('PRAGMA');

    if (isSelect) {
      sqliteDb.all(adaptedSql, params, (err, rows) => {
        if (err) return reject(err);
        resolve({
          rows: rows || [],
          rowCount: rows ? rows.length : 0,
        });
      });
    } else {
      sqliteDb.run(adaptedSql, params, function (err) {
        if (err) return reject(err);
        resolve({
          rows: [],
          rowCount: this.changes,
          lastID: this.lastID,
        });
      });
    }
  });
}

/**
 * Transaction client wrapper
 */
export async function getClient() {
  if (activeEngine === 'postgres') {
    const client = await pgPool.connect();
    return {
      query: (sql, params) => client.query(sql, params),
      release: () => client.release(),
      beginTransaction: () => client.query('BEGIN'),
      commit: () => client.query('COMMIT'),
      rollback: () => client.query('ROLLBACK'),
    };
  }

  // SQLite transaction
  return {
    query: (sql, params) => query(sql, params),
    release: () => {},
    beginTransaction: () => query('BEGIN TRANSACTION'),
    commit: () => query('COMMIT'),
    rollback: () => query('ROLLBACK'),
  };
}

export async function closeDb() {
  if (pgPool) {
    await pgPool.end();
  }
  if (sqliteDb) {
    return new Promise((resolve) => {
      sqliteDb.close(() => resolve());
    });
  }
}

export function getActiveEngine() {
  return activeEngine;
}
