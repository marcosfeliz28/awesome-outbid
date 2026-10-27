# Informe del recorrido QA de Nexora — 26-oct-2026

**Alcance y entorno.** Solo copia local de pruebas: PostgreSQL 16 en `/tmp` (puerto 5435, base nueva con la semilla del repositorio), API compilada de `nexora-cloud` (`8d409cf`) en `127.0.0.1:3001` y la PWA con `vite preview` en `127.0.0.1:4173`. No se tocó Render, `nexora-pos-web.onrender.com` ni `nexorapos.net`, ni datos o credenciales de producción. No se modificó código de la aplicación. Los scripts rechazan cualquier destino que no sea `127.0.0.1`/`localhost`.

**Cómo se hizo.** Playwright (Chromium) por rol × ancho (1366×768 y 390×844) × tema (claro y oscuro, con el botón real del encabezado; se verificó `data-theme`). En cada pantalla: errores de consola y de página, respuestas 4xx/5xx y peticiones fallidas, desborde horizontal de la página, axe-core 4.10.2 (WCAG 2.0/2.1 A y AA; no está en el repositorio, se inyectó desde fuera con `--axe=`), nombres accesibles de botones/campos, foco visible con Tab y captura. Además, matriz de permisos por API (`permisos.json`) y comprobación de cada ruta `#…` que el rol no ve.

**Resultado en una línea:** 0 críticos, 1 alto, 3 medios, 4 bajos. Desborde horizontal de la página: 0 en 300 revisiones de pantalla. Excepciones de JavaScript: 0.

## Fallos por gravedad

### Alto

**A1. La cajera con caja abierta ve los importes de sus ventas de hoy en «Ventas» (el arqueo ciego se rompe).**
- Pantalla: Ventas (`#sales`). Rol: cajera. Tamaño/tema: todos (1366 y 390, claro y oscuro).
- Evidencia: `docs/qa/recorrido-26oct/cajera/sales-1366-claro.png`. Con la caja abierta y una venta de contado hecha hoy, la lista muestra «FS-0000847 · Adriana Torres · RD$ 300.00 · Saldo RD$ 0.00 · Efectivo». `GET /api/sales` como cajera devuelve `total` y `payments` (método e importe) de cada venta. Con «Caja → Arqueo ciego activo» y «Preguntas → ¿Cuánto vendí hoy?» (que dice «Los importes: se ven al cerrar tu caja (cierre ciego)») la regla es clara; sumando esa lista más el fondo conocido, la cajera calcula el efectivo esperado y puede cuadrar el conteo.
- Causa probable: `apps/api/src/sales.ts:1622-1700` (`list`) filtra solo por `sellerId` y no aplica el mismo ocultamiento que `apps/api/src/reports.ts:1433-1483` (`hiddenUntilClose`); la pantalla es `apps/web/src/Management.tsx:3130-3180` (`SalesHistory`).
- Nota: puede ser intencional para reimprimir recibos; si la dueña quiere ciego completo, hay que ocultar importes/pagos de las ventas de la caja abierta de la cajera. El resto del cuadre sí es ciego (`GET /api/cash-sessions` no manda `expected`, la pantalla Caja y el cierre no muestran esperado ni diferencia).

### Medio

**M1. Una ruta prohibida monta la pantalla y dispara sus peticiones antes de redirigir.**
- Pantallas: todas las que el rol no ve (p. ej. `#pos`, `#inventory`, `#reports`). Roles: gv (17 rutas Macgen), cajera (Mercancía, Inventario, Compras, Gastos, Promociones, Reportes, Alertas, Incentivos, GV). Tamaño/tema: iguales en los cuatro.
- Evidencia: `resultados.json` de `gv` y `cajera`, filas `prohibida-*`. El rol termina en su pantalla (`#gv` o la primera permitida: la redirección sí funciona y la API responde 403 a todo), pero antes salen entre 1 y 7 peticiones 403 por ruta (gv→`#pos`: `/api/products`, `/api/customers`, `/api/cash-sessions`, `/api/promotions`, `/api/categories`, `/api/settings`; cajera→`#merchandise`: 5; cajera→`#reports`: `/api/reportes`, `/api/reports/sales`).
- Causa probable: `apps/web/src/App.tsx:1192` renderiza `pages[page]` en el primer pase y la redirección es un `useEffect` posterior (`App.tsx:733-740`). Riesgo: ruido de 403/alertas y un destello de la pantalla ajena; si algún día un endpoint olvidara su `@Permit`, la pantalla se llenaría.

**M2. Tooltip de «Ventas del año por mes» ilegible en tema oscuro (contraste 1,03:1).**
- Pantalla: Resumen (`#dashboard`). Roles: admin y gerente. Tamaño: 1366 y 390. Tema: oscuro.
- Evidencia: axe `color-contrast` (serio): `.year-pie-tip > strong` color `#111827` sobre `#151b2b`; captura `admin/dashboard-1366-oscuro.png` (el recuadro sobre el círculo no se lee).
- Causa probable: `apps/web/src/styles.css:6343` usa `color: var(--ink, #111827)` y `--ink` no está definida en ningún lado, así que siempre cae al gris casi negro; el fondo sí cambia con el tema (`var(--surface)`). Usado en `apps/web/src/YearPie.tsx:101,119`.

**M3. «Ventas» en celular (390 px): Total, Pagos y «Solicitar anulación» quedan fuera de la vista.**
- Pantalla: Ventas. Roles: cajera (y admin/gerente, misma tabla). Tamaño: 390. Tema: ambos.
- Evidencia: `cajera/sales-390-oscuro.png` y `-claro.png`: la columna Fecha se parte en 4 líneas («26 / oct / de / 2026»), «TOTAL» sale cortado y el resto de columnas exige desplazar la tabla de lado sin pista visual. No hay desborde de la página (la tabla se desplaza dentro de su contenedor), por eso las revisiones automáticas lo dan por válido.
- Causa probable: `DataTable` / `.table-wrap` (`apps/web/src/helpers.tsx`, `apps/web/src/styles.css:1330` y reglas móviles ~3658) sin vista de tarjetas en pantallas angostas; la tabla se usa en `Management.tsx:3130-3180`.

### Bajo

**B1. Contraste 4,37:1 (mínimo 4,5) en «ayer» del Resumen, tema claro.** Resumen, admin y gerente, 1366 y 390, claro; 7 nodos (`.day-yesterday > small`, `#64748b` sobre `#eff6ff`, 11 px). Evidencia: axe `color-contrast`; `admin/dashboard-1366-claro.png`. Causa: `apps/web/src/styles.css:6281-6283` (`.day-figures small { color: var(--muted) }`) sobre el fondo `--day-bg` de `styles.css:6250-6253`.

**B2. Error de consola y 400 al abrir la aplicación sin sesión.** Pantalla de entrada, todos los roles y tamaños: `POST /api/auth/refresh` responde 400 («La sesión ha expirado») y el navegador lo imprime como «Failed to load resource: 400». Es el intento normal de recuperar la sesión, pero ensucia la consola y cualquier monitoreo de 4xx. Causa: `apps/api/src/auth.ts:755-762` (`bad(...)` = 400; correspondería 401) y `apps/web/src/api.ts:228-237` / `App.tsx:683`.

**B3. `POST /api/auth/refresh` abortado (`net::ERR_ABORTED`) de forma intermitente.** 5 casos sueltos al cambiar de pantalla (admin Ventas ×2, gerente POS/Ventas, cajera Productos), sin efecto visible. Evidencia: `resultados.json`. Causa probable: dos renovaciones concurrentes o una navegación que cancela la petición (`api.ts:228-237`, rotación de uso único en `auth.ts:773-777`); conviene revisar si alguna vez saca a alguien de la sesión.

**B4. El anillo de foco de las pestañas de GV se recorta.** Pantalla GV (Cursos/Citas/…), 390 px, ambos temas: la pestaña «Reportes» (segunda fila) muestra el anillo cortado. Evidencia: `gv/gv-cursos-390-oscuro.png`. Causa: `apps/web/src/styles.css:1465-1472` (`.tabs { overflow-x: auto }` recorta el `outline-offset: 3px` de `styles.css:235-239`).

### Revisado y descartado (no son fallos)
- «Foco sin indicador» en `input` (30 casos admin/gerente) = falso positivo del campo de fecha: un paso de Tab cae en un subcampo interno del `type=date` sin `:focus-visible`; los demás pasos sí muestran anillo de 3 px.
- Al final de la corrida de admin (último paso, menú móvil 390 oscuro) salieron `ERR_CONNECTION_REFUSED`/`ERR_INCOMPLETE_CHUNKED_ENCODING`: mi API local se detuvo por el límite de tiempo de la sesión. No es un fallo de Nexora.
- La palabra «esperado» y «diferencias» en Caja de la cajera son solo encabezados de la tabla; los valores son «—».

## Comprobaciones pedidas por la dueña

| Comprobación | Resultado |
|---|---|
| Cajera con caja abierta no ve importes (arqueo ciego) | **Parcial.** Cumple en Caja, cierre («Conteo ciego»), `/api/cash-sessions` (sin `expected`) y Preguntas («cierre ciego»). **Falla en Ventas** (A1). |
| GV no ve nada de Macgen | **Cumple.** Menú solo «GV Makeup Studio»; las 18 rutas Macgen redirigen a `#gv`; los 20 GET de Macgen probados dan 403. Pero ver M1 (403 previos a redirigir). |
| Macgen (cajera) no ve nada de GV | **Cumple.** Sin entrada de menú; `#gv` redirige; los 5 GET de `/api/gv/*` dan 403. Admin y gerente ven los dos módulos por permiso (`gv:read`), por diseño. |
| Reportes y costos ocultos a la cajera | **Cumple.** Sin «Reportes», Resumen, Gastos, Compras ni Incentivos en el menú; `/api/reportes`, `/api/dashboard/summary`, `/api/reports/*`, `/api/purchase-orders` dan 403. En todas las respuestas JSON que recibió no apareció ninguna clave `cost*`, `margin*`, `profit*` ni `expected*`, y el texto de sus pantallas no contiene costo/margen/ganancia/utilidad (admin y gerente sí reciben `costAvg`, `unitCost`, `margin`). |

## Tabla de cobertura

Combinaciones: 4 roles × 2 anchos × 2 temas = 16. Revisiones de pantalla con captura: 300 (admin 118, gerente 110, cajera 46, gv 26) más 132 comprobaciones de rutas prohibidas. Capturas en `docs/qa/recorrido-26oct/<rol>/<pantalla>-<ancho>-<tema>.png` (PNG de 128 colores, 8,6 MB), datos crudos en `<rol>/resultados.json` y `permisos.json`.

| Área | admin | gerente | cajera | gv | Notas |
|---|---|---|---|---|---|
| Vender / POS | sí | sí | sí | no ve | |
| Cobrar (ventana de pago) | sí | sí | sí | no ve | Se abre y se cierra; **no** se finalizó el cobro en el barrido (una venta de contado de preparación sí se hizo por UI). |
| Cerrar caja (Cuadre y cierre) | sí | sí | sí | no ve | Solo la ventana abierta; no se cerró ninguna caja. |
| Caja (cerrada y abierta) | sí | sí | solo abierta | no ve | La cajera ya tenía caja abierta desde la preparación, así que su estado «cerrada» no tiene captura (se vio por texto, no se guardó). |
| Tablero / Resumen | sí | sí | no ve | no ve | |
| Catálogo (Productos), Inventario, Clientes | sí | sí | Productos y Clientes | no ve | Inventario no es visible para la cajera. |
| Reportes | sí | sí | no ve | no ve | Solo la lista de reportes; no se abrió cada uno de los ~30. |
| Configuración | sí | sí | no ve | no ve | Solo la pantalla inicial; no cada sección ni cada formulario de edición. |
| Preguntas / Mis ventas de hoy | sí | sí | sí | no ve | Lista y respuesta «¿Cuánto vendí hoy?». Las otras ~29 preguntas y la encuesta no. |
| Mercancía, Compras, Gastos, Promociones, Alertas, Incentivos, Solicitudes de anulación | sí | sí | solo Solicitudes de anulación | no ve | |
| Conciliar transferencias, Envíos del mensajero | sí | no ve | no ve | no ve | Solo administración. |
| GV: cursos, detalle de curso (alumnas y pagos), citas, interesadas, por verificar, reportes | sí | sí | no ve | sí | Detalle de curso = inscripciones y pagos. Formularios de alta no abiertos. |
| Menú móvil (390) | sí | sí | sí | sí | |
| Rutas prohibidas | n/a | 2 | 13 | 18 | Cada una redirige (ver M1). |

**Qué no se recorrió y por qué.**
- Modo sin conexión, impresión de recibos/cuadres, PDF y Excel descargables, escáner/cámara: requieren hardware o archivos, fuera de una corrida automática.
- Flujos que cambian dinero o inventario más allá de la preparación (finalizar cobros mixtos, devoluciones, anulaciones, cierres de caja, importar inventario): se evitaron a propósito para no alterar la base ni abrir pasos del instructivo de verificación; esta es una copia de pruebas, pero la corrida es de lectura.
- Subpantallas internas de Configuración, de Mercancía y cada uno de los reportes: se capturó la pantalla de entrada.
- Pantalla de entrada (login) no se capturó por rol; sí se midió su consola/red (B2).
- Navegadores distintos de Chromium y dispositivos físicos; contraste calculado solo con axe en los estados que quedaron abiertos (no en estados de hover).
- Rol «almacén» (existe en la semilla, no pedido).
- El menú móvil de admin al final de la corrida tiene red/consola contaminadas (servidor local detenido), ver «descartado».

## Cómo repetirlo

```
# base local (como root: initdb con dueño postgres), API y PWA locales, con .env de prueba
node tests/qa/preparar.mjs            # usuario gv, equipo aprobado, datos de GV
node tests/qa/venta-semilla.mjs       # caja abierta y una venta de contado de la cajera
node tests/qa/recorrido.mjs admin,gerente,cajera,gv --axe=/ruta/axe.min.js
node tests/qa/permisos.mjs            # matriz de permisos por API
python3 -I tests/qa/comprimir.py docs/qa/recorrido-26oct
```
