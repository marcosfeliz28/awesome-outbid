import pg from './fitstore-pos/node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js';
const db=new pg.Client({connectionString:'postgresql://fitstore:fitstore_local@127.0.0.1:5434/postgres'});await db.connect();
for(const name of ['fitstore_audit_r7','fitstore_audit_r7_upgrade3','fitstore_audit_r7_import','fitstore_audit_r7_upgrade6']){
 if(!(await db.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)await db.query('CREATE DATABASE "'+name+'"'+(name.endsWith('upgrade6')?' WITH TEMPLATE fitstore_audit_r6_upgrade':''));
}await db.end();console.log('Bases aisladas R7 creadas; copia de R6 con historial aplicado preservado.');
