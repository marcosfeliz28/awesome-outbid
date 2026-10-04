# Revisión de FitStore POS (código entregado por ChatGPT)

## Resumen

El trabajo de ChatGPT está **bien hecho y bastante completo**.

Lo que comprobé ejecutándolo yo mismo:
- `pnpm check` (tipos, lint, 9 pruebas de fórmulas y compilación): **pasa**.
- Las 11 pruebas de integración contra PostgreSQL con datos de demostración: **pasan**.
- La app abre en PC y en celular, con diseño cuidado y sin errores.

Lo que funciona bien:
- Cálculo del ITBIS incluido en el precio.
- Pagos combinados, con cambio solo sobre el efectivo.
- Ventas simultáneas sin dejar stock negativo.
- Ventas sin internet que no se duplican.
- Costo promedio y costo de aterrizaje.
- El vendedor nunca ve costos ni ganancias.

Pero hay **errores reales que se deben corregir antes de usarla en la tienda**. La mayoría los reproduje ejecutando la app, no solo leyendo el código.

## Prioridad ALTA (corregir antes de usar)

1. **El bloqueo por intentos fallidos se puede saltar.**
   - Enviando muchos intentos a la vez (o repartidos entre varios inicios de sesión), un vendedor puede adivinar el PIN del gerente sin que la cuenta se bloquee.
   - Con ese PIN puede entrar como gerente o administrador y ver costos.
   - Archivos: `apps/api/src/auth.ts` (login y `/auth/pin`), `apps/api/src/sales.ts` (función `approve`), `apps/api/src/main.ts` (límite de intentos).
2. **Un vendedor puede bloquear la cuenta del dueño o del gerente** durante 15 minutos, y repetirlo cuantas veces quiera, solo con equivocarse a propósito 5 veces con su PIN.
3. **Se venden productos ya vencidos.**
   - Un lote sigue vendiéndose hasta el día siguiente a su vencimiento, por la diferencia de hora entre el servidor (UTC) y República Dominicana.
   - Los ajustes de inventario aceptan fechas de vencimiento pasadas.
   - Archivo: `apps/api/src/inventory.ts`.

## Prioridad MEDIA

4. **Stock con lote y sin lote se desordena.** Si un producto tiene 10 unidades sin lote y llega 1 unidad con lote, el sistema muestra 11 pero no deja vender 2.
5. **Cierre de caja:**
   - La diferencia suma todos los métodos juntos, así que un faltante de efectivo se esconde con un sobrante de tarjeta.
   - Además, el gerente no puede cerrar la caja de un vendedor.
6. **La clave secreta de ejemplo (`JWT_SECRET`) se acepta tal cual.** Si se instala sin cambiarla, cualquiera podría fabricarse un acceso de administrador.
7. **Ventas offline y caja cerrada:**
   - Las ventas hechas sin internet quedan en conflicto para siempre si se sincronizan después de cerrar la caja.
   - El mensaje de error muestra detalles internos del servidor.
8. **Reporte de compras a proveedores:** filtra las compras por fecha pero suma los pagos de todas las fechas, así que da saldos negativos.
9. **Fechas en reportes:**
   - Se usa la hora UTC en vez de la de República Dominicana: el vencimiento se ve un día después y las ventas de después de las 8:00 p. m. del último día del mes caen en el mes siguiente.
   - La "semana" del panel principal queda de 6 días por la noche.

## Prioridad BAJA

10. El panel principal y el reporte de ganancias tratan distinto las devoluciones de productos dañados, por lo que la ganancia no cuadra entre ellos.
11. Una venta ya guardada con PIN de gerente puede fallar al reintentarse si cambió el PIN.
12. Dos usuarios podrían abrir la misma caja al mismo tiempo.

## Funciones del documento maestro que faltan

- Descuento por monto (hoy solo por %).
- Usar la nota de crédito como forma de pago.
- Ventas a crédito con abonos.
- Comprobantes fiscales (NCF).
- Cierre de sesión por inactividad (`sessionTimeoutMinutes` se guarda pero no se aplica).
- Revocar sesiones al cambiar contraseña o PIN.
- Opción de permitir stock negativo con advertencia.
- Auditoría específica de descuentos aprobados por el gerente y de cierres de caja con diferencia.
- Mapa de horas pico, comparativos contra el año anterior, alertas de "baja venta" y "descuentos inusuales".
- Instaladores para PC y celular ya compilados.

---

## Mensaje para pegar en ChatGPT

```
Revisé el proyecto fitstore-pos ejecutándolo (pnpm check, pruebas de integración con
PostgreSQL y la interfaz en navegador). Todo compila y pasa, pero hay errores reales,
la mayoría reproducidos contra la API. Corrígelos en este orden. Para cada uno agrega
una prueba en tests/api.test.ts que falle antes y pase después. Al final ejecuta
pnpm check y pnpm test:integration y entrégame el proyecto completo en ZIP.

ALTA
1. Bloqueo por intentos (auth.ts login y /auth/pin, sales.ts approve, main.ts):
   - Incrementa intentos y decide el bloqueo de forma ATÓMICA en la base de datos
     (UPDATE ... SET failedAttempts = failedAttempts + 1 ... RETURNING), no desde una
     lectura previa.
   - No reinicies el contador de PIN al iniciar sesión con contraseña.
   - Los fallos del PIN de gerente en una venta deben contar contra el gerente
     (o un contador propio) y bloquear tras 5.
   - Aplica límite de intentos también a /api/sales y configura app.set("trust proxy", 1)
     para que funcione detrás de nginx.
   - Prueba: 10 intentos concurrentes con PIN incorrecto y luego el correcto -> debe
     estar bloqueado.
2. Un vendedor no debe poder bloquear la cuenta de otro: separa el bloqueo de PIN del
   bloqueo de la cuenta (el PIN bloqueado solo impide cambiar de usuario por PIN, no
   invalida la sesión con contraseña) y limita intentos por usuario que llama.
3. Vencimientos (inventory.ts):
   - Un lote vencido no se vende: compara con la fecha actual en la zona
     America/Santo_Domingo.
   - Rechaza fechas de vencimiento pasadas en ajustes, igual que en compras.

MEDIA
4. takeStock: el stock sin lote debe tratarse como un "lote vacío" implícito. Caso de
   prueba: 10 unidades sin lote + 1 con lote -> se pueden vender 2. Corrige igual
   applyCount.
5. Caja (cash.ts):
   - Guarda y muestra la diferencia POR MÉTODO (efectivo, tarjeta, transferencia), sin
     netearlas, y alerta por la diferencia de efectivo.
   - Permite que el gerente cierre la caja de un vendedor (cashLock con manager=true).
   - Registra en auditoría los cierres con diferencia.
6. main.ts: en producción rechaza al arrancar el JWT_SECRET de ejemplo y secretos de baja
   entropía.
7. Ventas offline:
   - Acepta sincronizar una venta en la caja que estaba abierta en la hora offline de la
     venta, aunque ya esté cerrada, o impide cerrar caja con ventas pendientes en el
     dispositivo.
   - Nunca devuelvas e.message crudo: usa mensajes seguros en español.
8. reports.ts compras/cuentas por pagar: aplica el mismo rango de fechas a los pagos o
   calcula un saldo acumulado.
9. Fechas: agrupa y formatea todo con la zona America/Santo_Domingo (consumo mensual,
   vencimientos, fechas impresas, inicio de semana en Dashboard.tsx).

BAJA
10. Unifica cómo se resta el costo de devoluciones no reingresadas entre el dashboard
    (sales.ts) y el reporte de utilidad (reports.ts).
11. En sales.ts busca el offlineUuid existente ANTES de validar el PIN de gerente.
12. Evita dos cajas abiertas en la misma terminal: índice único parcial en registerId
    donde closedAt es null.

FALTANTES DEL DOCUMENTO (después de lo anterior)
- Descuento por monto en línea.
- Nota de crédito como forma de pago.
- Ventas a crédito con abonos.
- Aplicar sessionTimeoutMinutes.
- Revocar refresh tokens al cambiar contraseña o PIN.
- Auditar discount_approved cuando el gerente aprueba.
- Opción de stock negativo con advertencia.
- Alertas de baja venta y descuentos inusuales.
- Mapa de horas pico y comparativo contra el año anterior.
- NCF preparado.
```
