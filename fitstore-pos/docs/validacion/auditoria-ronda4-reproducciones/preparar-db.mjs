import pg from './fitstore-pos/node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js';
import {readFileSync} from 'node:fs';
const url = 'postgresql://fitstore:fitstore_local@127.0.0.1:5434/';
const admin = new pg.Client({connectionString: url+'postgres'});
await admin.connect();
for (const name of ['fitstore_audit_r4','fitstore_audit_r4_upgrade']) {
  if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)
    await admin.query('CREATE DATABASE "'+name+'"');
}
await admin.end();
const upgrade = new pg.Client({connectionString:url+'fitstore_audit_r4_upgrade'});
await upgrade.connect();
await upgrade.query(readFileSync(new URL('./upgrade-pre-r4.sql',import.meta.url),'utf8'));
await upgrade.end();
console.log('Bases R4 y actualización R3→R4 aisladas listas.');
