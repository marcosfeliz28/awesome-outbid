-- INC: incentivos por cajera (docs/INCENTIVOS.md).
--
-- Idempotente y sin riesgo para un despliegue:
-- * Las columnas nuevas de "Sale" y "Quote" son booleanas con valor constante
--   (false): en PostgreSQL 11+ se agregan sin reescribir la tabla y las ventas
--   existentes quedan como ventas normales (no mayoristas).
-- * Las tablas nuevas usan IF NOT EXISTS; no se borra ni se modifica ningún
--   dato existente y no se generan incentivos para ventas anteriores.
-- * Los índices únicos sólo se crean si no hay repetidos (una tabla creada a
--   mano podría tenerlos): en ese caso se avisa con NOTICE y el despliegue
--   sigue; la idempotencia la garantiza además la transacción de la venta.
-- Las fechas son «timestamp sin zona» en UTC, como el resto del esquema.

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "wholesale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "wholesale" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "IncentiveRate" (
    "id" UUID NOT NULL,
    "branchId" TEXT NOT NULL DEFAULT 'main',
    "categoryId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IncentiveRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IncentiveEntry" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "saleItemId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "categoryId" UUID,
    "categoryName" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "rateAtSale" DECIMAL(14,2) NOT NULL,
    "wholesale" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(14,2) NOT NULL,
    "period" TEXT NOT NULL,
    "originPeriod" TEXT NOT NULL,
    "note" TEXT,
    "branchId" TEXT NOT NULL DEFAULT 'main',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncentiveEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IncentivePeriodClose" (
    "id" UUID NOT NULL,
    "branchId" TEXT NOT NULL DEFAULT 'main',
    "period" TEXT NOT NULL,
    "closedBy" UUID NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncentivePeriodClose_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IncentiveSettlement" (
    "id" UUID NOT NULL,
    "branchId" TEXT NOT NULL DEFAULT 'main',
    "period" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "userName" TEXT NOT NULL,
    "units" JSONB NOT NULL,
    "salesCount" INTEGER NOT NULL,
    "wholesaleSales" INTEGER NOT NULL,
    "gross" DECIMAL(14,2) NOT NULL,
    "deductions" DECIMAL(14,2) NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "pendingCollection" DECIMAL(14,2) NOT NULL,
    "priorDeductions" DECIMAL(14,2) NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "closedBy" UUID NOT NULL,
    "closedByName" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncentiveSettlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IncentiveEntry_branchId_period_userId_idx" ON "IncentiveEntry"("branchId", "period", "userId");
CREATE INDEX IF NOT EXISTS "IncentiveEntry_saleId_idx" ON "IncentiveEntry"("saleId");

-- Únicos: se crean sólo si los datos lo permiten (nunca fallan el despliegue).
DO $$
DECLARE
  spec RECORD;
  dupes BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('IncentiveRate_branchId_categoryId_key', 'IncentiveRate', '"branchId", "categoryId"'),
      ('IncentiveEntry_saleItemId_kind_refId_key', 'IncentiveEntry', '"saleItemId", "kind", "refId"'),
      ('IncentivePeriodClose_branchId_period_key', 'IncentivePeriodClose', '"branchId", "period"'),
      ('IncentiveSettlement_branchId_period_userId_key', 'IncentiveSettlement', '"branchId", "period", "userId"')
    ) AS t(index_name, table_name, columns)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = current_schema() AND indexname = spec.index_name
    ) THEN
      EXECUTE format(
        'SELECT count(*) FROM (SELECT 1 FROM %I GROUP BY %s HAVING count(*) > 1) d',
        spec.table_name, spec.columns
      ) INTO dupes;
      IF dupes = 0 THEN
        EXECUTE format(
          'CREATE UNIQUE INDEX %I ON %I (%s)',
          spec.index_name, spec.table_name, spec.columns
        );
      ELSE
        RAISE NOTICE 'INC: % tiene % grupo(s) repetido(s); el índice único % queda pendiente.',
          spec.table_name, dupes, spec.index_name;
      END IF;
    END IF;
  END LOOP;
END $$;
