import pg from './fitstore-pos/node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js';
const db=new pg.Client({connectionString:'postgresql://fitstore:fitstore_local@127.0.0.1:5434/postgres'});
await db.connect();
for(const name of ['fitstore_audit_r6','fitstore_audit_r6_upgrade']){
  if(!(await db.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount) await db.query('CREATE DATABASE "'+name+'"');
}
await db.end();
console.log('Bases de auditoría R6 aisladas creadas.');
