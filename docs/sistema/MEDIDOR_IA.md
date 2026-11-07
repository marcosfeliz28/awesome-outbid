# Medidor de uso y costo de IA

Para poner precio a la IA que se vende. Rama `claude-pc/ia-medidor` (aún no desplegado).

- **Qué mide:** cada lectura de factura con IA (`feature = "factura"`): modelo, tokens de entrada/salida/caché, costo en US$ y si salió bien. También se guarda la llamada que falla (tokens 0). Tabla `AiUsage` (`apps/api/prisma/schema.prisma`, migración `202611070001_ai_usage`). Sin llave foránea a propósito.
- **Dónde se guarda:** `recordAiUsage` en `apps/api/src/ai-usage.ts`, llamada desde `extractAnthropic` (`apps/api/src/invoice.ts`, opción `onUsage`) y `merchandise.ts`. Un fallo al guardar solo deja un log; nunca rompe la lectura.
- **Precios:** SOLO en `apps/api/src/ai-prices.ts`. **Hoy están en null (TODO):** el costo sale null y la web dice «sin precio». Hay que cargar los precios reales (US$ por millón de tokens) y verificarlos en la página de precios de Anthropic. Los tokens ya quedan guardados; el costo de filas viejas no se recalcula.
- **Consulta:** `GET /ai/usage?from=AAAA-MM-DD&to=AAAA-MM-DD` (por defecto, el mes en curso), solo administración (`*`). Devuelve totales por función, usuario y día (día de Santo Domingo).
- **Web:** tarjeta «Uso y costo de IA» en Configuración (`apps/web/src/AiUsage.tsx`), solo administración.
- **IA de ventas:** `feature = "ia_ventas"`, una fila por pregunta creada antes de llamar al modelo (sirve también de tope diario). Ver `IA_VENTAS.md`. Costo de hosting: aparte.
