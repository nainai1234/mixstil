import pg from 'pg';
import dotenv from 'dotenv';
import type { QueryResultRow } from 'pg';

dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://snooze:snooze@localhost:5432/snooze';
const databaseSslNoVerify = process.env.DATABASE_SSL_NO_VERIFY === 'true';
const connectionString = databaseSslNoVerify
  ? (() => {
      const url = new URL(databaseUrl);
      url.searchParams.delete('sslmode');
      url.searchParams.delete('uselibpqcompat');
      return url.toString();
    })()
  : databaseUrl;

export const pool = new Pool({
  connectionString,
  ssl: databaseSslNoVerify ? { rejectUnauthorized: false } : undefined,
});

export const query = <T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) => pool.query<T>(text, params);
