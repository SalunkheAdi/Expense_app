import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool, Client } = pg;
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shared_expenses';

export let pool = null;

export async function initDb() {
  // 4. Seed default users
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
  const dbClient = await pool.connect();
  try {
    console.log('Running database migrations...');
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        pin VARCHAR(10) NOT NULL
      )
    `);
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT
      )
    `);
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS group_memberships (
        id SERIAL PRIMARY KEY,
        group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_date DATE NOT NULL,
        left_date DATE
      )
    `);
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
        is_approved INT DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS expense_splits (
        id SERIAL PRIMARY KEY,
        expense_id INT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(12, 2) NOT NULL,
        share_value NUMERIC(10, 4)
      )
    `);
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
  } finally {
    dbClient.release();
  }
}

export async function query(text, params) {
  return pool.query(text, params);
}
export default { initDb, query };
