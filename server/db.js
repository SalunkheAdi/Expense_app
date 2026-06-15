import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool, Client } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shared_expenses';

let pool = null;

// Parse the connection string to extract the database name
let dbName = 'shared_expenses';
let baseConnectionString = '';
try {
  const urlParts = new URL(connectionString);
  dbName = urlParts.pathname.slice(1) || 'shared_expenses';
  urlParts.pathname = '/postgres';
  baseConnectionString = urlParts.toString();
} catch (e) {
  console.error('Failed to parse DATABASE_URL, using defaults:', e.message);
  baseConnectionString = 'postgresql://postgres:postgres@localhost:5432/postgres';
}

export async function initDb() {
  console.log(`Initializing database connection. Target DB: "${dbName}"`);
  
  // 1. Ensure the database exists by connecting to 'postgres' first
  // Neon and other serverless pg platforms require SSL and may block arbitrary DB creation
  const isNeon = connectionString.includes('neon.tech');
  const sslConfig = isNeon ? { rejectUnauthorized: false } : false;

  const client = new Client({ 
    connectionString: baseConnectionString,
    ssl: sslConfig
  });
  
  try {
    await client.connect();
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (res.rowCount === 0) {
      console.log(`Database "${dbName}" does not exist. Creating...`);
      // CREATE DATABASE cannot run inside a transaction block, raw query is fine
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✓ Database "${dbName}" created successfully.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.warn(`⚠️ Warning: Could not verify or create database "${dbName}" automatically: ${err.message}`);
    console.warn('Attempting to connect directly to the target database and run migrations...');
  } finally {
    try {
      await client.end();
    } catch (e) {
      // Ignore cleanup error
    }
  }

  // 2. Initialize the connection pool for the target database
  pool = new Pool({ 
    connectionString,
    ssl: sslConfig
  });

  // 3. Create tables
  const dbClient = await pool.connect();
  try {
    console.log('Running database migrations...');
    
    // Users Table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        pin VARCHAR(10) NOT NULL
      )
    `);

    // Groups Table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT
      )
    `);

    // Group Memberships Table with active periods
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS group_memberships (
        id SERIAL PRIMARY KEY,
        group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_date DATE NOT NULL,
        left_date DATE,
        CONSTRAINT check_dates CHECK (left_date IS NULL OR joined_date <= left_date)
      )
    `);

    // Expenses Table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        description VARCHAR(255) NOT NULL,
        amount NUMERIC(12, 4) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        exchange_rate NUMERIC(10, 4) NOT NULL DEFAULT 1.0000,
        amount_inr NUMERIC(12, 2) NOT NULL,
        paid_by_id INT NOT NULL REFERENCES users(id),
        split_type VARCHAR(20) NOT NULL,
        date DATE NOT NULL,
        notes TEXT,
        is_approved INT DEFAULT 1, -- 0 = pending staging, 1 = approved
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Expense Splits Table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS expense_splits (
        id SERIAL PRIMARY KEY,
        expense_id INT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(12, 2) NOT NULL,
        share_value NUMERIC(10, 4)
      )
    `);

    // Settlements Table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS settlements (
        id SERIAL PRIMARY KEY,
        group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        payer_id INT NOT NULL REFERENCES users(id),
        payee_id INT NOT NULL REFERENCES users(id),
        amount NUMERIC(12, 2) NOT NULL,
        date DATE NOT NULL,
        notes TEXT,
        is_approved INT DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✓ Tables checked and created.');

    // 4. Seed default flatmates/users if users table is empty
    const usersCountRes = await dbClient.query(`SELECT COUNT(*) FROM users`);
    const count = parseInt(usersCountRes.rows[0].count, 10);
    if (count === 0) {
      console.log('Seeding default users...');
      const defaultUsers = [
        { name: 'aisha', display_name: 'Aisha', pin: '1111' },
        { name: 'rohan', display_name: 'Rohan', pin: '2222' },
        { name: 'priya', display_name: 'Priya', pin: '3333' },
        { name: 'meera', display_name: 'Meera', pin: '4444' },
        { name: 'sam', display_name: 'Sam', pin: '5555' },
        { name: 'dev', display_name: 'Dev', pin: '6666' }
      ];
      
      for (const u of defaultUsers) {
        await dbClient.query(
          `INSERT INTO users (name, display_name, pin) VALUES ($1, $2, $3)`,
          [u.name, u.display_name, u.pin]
        );
      }
      console.log('✓ Default users seeded.');
    }
  } catch (err) {
    console.error('Error running migrations/seeders:', err.message);
    throw err;
  } finally {
    dbClient.release();
  }
}

export async function query(text, params) {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call initDb() first.');
  }
  return pool.query(text, params);
}

export async function getClient() {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call initDb() first.');
  }
  return pool.connect();
}

export default {
  initDb,
  query,
  getClient
};
