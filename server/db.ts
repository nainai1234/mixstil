import pg from 'pg';
import dotenv from 'dotenv';
import type { QueryResultRow } from 'pg';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://snooze:snooze@localhost:5432/snooze',
});

export const query = <T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) => pool.query<T>(text, params);
