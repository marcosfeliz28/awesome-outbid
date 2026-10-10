import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('3j guía distingue integridad, atomicidad y cobertura de actividad', () => {
  const text = readFileSync(new URL('../../docs/INSTALADOR.md', import.meta.url), 'utf8');
  for (const required of ['no acredita autenticidad', 'hash previo registrado', 'nombre de la copia privada', 'LOGIN ya restituido', 'no demuestra que la base esté parcial', 'Brand', 'KitComponent', 'SaleItem', 'PurchaseItem', 'ExpenseCategory', 'Counter', 'AuthAttempt', 'AuthSession', 'SupplierImportProfile', 'SupplierCode', 'RealtimeEvent']) {
    assert.ok(text.includes(required), `Falta límite 3j: ${required}`);
  }
  assert.ok(!text.includes('conserva NOLOGIN **a propósito**: la base puede estar parcial'));
});
