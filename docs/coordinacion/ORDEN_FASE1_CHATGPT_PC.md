# Orden para ChatGPT PC — producto Nexora, FASE 1 (Claude, arquitecto · 20-oct-2026)

Revisé la fase 0 (`producto-nexora` hasta `07e5515`): 155 rutas, 152 con caso A/B, 0 fugas, CI verde (run 39498836013). **Aprobada.** Sigue en la misma rama; `nexora-cloud` solo entra con merge hacia `producto-nexora`, nunca al revés.

## Fase 1 — que una empresa nueva entre y trabaje sola
1. **Registro público** (`/registro`): negocio, correo, contraseña, tipo de negocio, código de empresa (slug único). Crea Tenant en `trial` 14 días, el usuario dueño y la configuración inicial. Verificación de correo antes de vender. Límite de intentos por IP.
2. **Asistente de arranque** (primera entrada): categorías sugeridas por tipo de negocio, importar productos desde Excel (reusar el importador), crear cajeras y la primera caja. Se puede saltar y retomar.
3. **Estados del Tenant:** `trial → active → past_due (7 días de gracia) → suspended` (solo lectura: puede ver y exportar, no vender). Avisos 7 y 3 días antes del fin de la prueba y del cobro. Nunca se borran datos.
4. **Cobro** detrás de una interfaz `BillingProvider` con un proveedor de prueba (sin dinero real) y planes Autoservicio/Básico/Pro/Premium de `ARQUITECTURA_NEXORA_PRODUCTO.md`. Límites por plan (sucursales, cajas, usuarios) aplicados en la API. Nexora no guarda tarjetas.
5. **Exportación completa por empresa** (Excel/JSON de todas sus tablas) disponible en cualquier estado, también suspendida.
6. **Respaldo por empresa:** volcado lógico de las filas de su `tenantId`, cifrado, con restauración probada en una base desechable.

## Puerta para pasar
- E2E: una empresa se registra, verifica el correo, carga 3 productos, abre caja y vende, sin ayuda humana. Otra empresa no ve nada de la primera.
- Prueba que lleva un Tenant por trial → past_due → suspended y comprueba solo lectura + exportación.
- Matriz de aislamiento sigue en 0 fugas con las rutas nuevas.
- 3 CI en verde. Informe en `RESULTADOS_CHATGPT.md`.

## No hacer
- No crear servicios ni bases en Render (Claude lo hace con permiso de la dueña).
- No cobrar dinero real ni conectar procesadores reales.
- No tocar la base, credenciales ni dominio de la tienda.
