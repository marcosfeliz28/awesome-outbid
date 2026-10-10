-- Una caja pertenece a un usuario (decisión 38). Varias personas pueden tener
-- su caja abierta a la vez en la misma computadora: el equipo deja de ser
-- único entre cajas abiertas. Sigue vigente one_open_cash_per_user (una caja
-- abierta por usuario). No toca ni mueve filas existentes: sólo relaja la
-- restricción y deja un índice normal para buscar las cajas de un equipo.
DROP INDEX IF EXISTS one_open_cash_per_register;
CREATE INDEX IF NOT EXISTS "CashSession_branchId_registerId_open_idx"
  ON "CashSession" ("branchId", "registerId") WHERE "closedAt" IS NULL;
