import pg from './fitstore-pos/node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js';
const db=new pg.Client({connectionString:'postgresql://fitstore:fitstore_local@127.0.0.1:5434/postgres'});await db.connect();
for(const name of ['fitstore_audit_r8','fitstore_audit_r8_import','fitstore_audit_r8_upgrade7']){
 if(!(await db.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)await db.query('CREATE DATABASE "'+name+'"'+(name.endsWith('upgrade7')?' WITH TEMPLATE fitstore_audit_r7':''));
}
await db.end();console.log('Bases R8 aisladas y copia del historial R7 creadas.');
