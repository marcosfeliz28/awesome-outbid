import assert from 'node:assert/strict';
import { URL } from 'node:url';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const documentation = readFileSync(new URL('../../docs/INSTALADOR.md', import.meta.url), 'utf8');

test('3i documentación refleja límites reales de ACL, recuperación y retención', () => {
  for (const required of [
    'el original puede seguir con permisos públicos',
    'sin `backupReaderSid` válido',
    'Azure AD',
    'se elimina automáticamente al completar `verified`',
    'no existe una aceptación diferida',
    'ACL temporal a la cuenta actual',
    'LocalService recibe lectura',
    'no excluye los respaldos referenciados por un marcador',
    'dentro de la transacción',
  ]) {
    assert.ok(documentation.includes(required), `Falta límite documentado: ${required}`);
  }
  assert.ok(!documentation.includes('anterior y el respaldo previo hasta completar la prueba de aceptación.'));
});
