-- PC-05: el operador de facturación sólo ve las columnas necesarias para
-- contar cajas abiertas al evaluar un cambio de plan. Nunca ve importes.
GRANT SELECT ("tenantId", "closedAt") ON "CashSession" TO nexora_platform_billing;
DROP POLICY IF EXISTS platform_billing_operator ON "CashSession";
CREATE POLICY platform_billing_operator ON "CashSession"
  TO nexora_platform_billing USING (true);
