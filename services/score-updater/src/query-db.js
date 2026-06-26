import pg from 'pg';

const { Client } = pg;

const client = new Client({
  user: 'postgres',
  host: 'db.hbmtkaeymmvpjfarjpij.supabase.co',
  database: 'postgres',
  password: 'Ajp37338933@',
  port: 5432,
});

async function main() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT prosrc
      FROM pg_proc
      WHERE proname = 'get_group_ranking'
    `);
    console.log('--- RPC DEFINITION ---');
    console.log(res.rows[0].prosrc);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
