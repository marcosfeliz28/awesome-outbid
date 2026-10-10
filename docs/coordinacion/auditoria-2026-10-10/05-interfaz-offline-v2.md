# Auditoría 05 v2 · Interfaz, accesibilidad, PWA/offline, cola Dexie y caja

**Alcance:** `origin/nexora-cloud` @ `a12c980` (worktree desacoplado propio; solo lectura, sin cambios de código ni push).
**Fecha:** 2026-10-10. Compara contra `05-interfaz-offline.md` (v1 @ `3e5521c`).

**Entorno de prueba (todo desmontado al final):** PostgreSQL propio (`/var/lib/postgresql/aud-v2-05`, puerto 55705) con las 11 migraciones hasta `202610210004` aplicadas y semilla demo; API compilada (`node dist/main.js`, `NODE_ENV=production`, puerto 3705); `vite preview` de la PWA real con service worker (puerto 4705); Playwright + Chromium con perfil persistente (IndexedDB y SW conservados entre ejecuciones), escritorio 1280×800 y 1366×768 y celular 390×844 táctil; axe-core 4.10.2 (WCAG 2.1 A/AA). Guiones en `scratchpad/aud-v2-05/` (`t3`…`t15`). Roles: cajera (`vendedor@`), administradora (`admin@`). Producción no se tocó.

Evidencia de pruebas del repo: `tests/pwa-update.test.ts`, `tests/offline-review-web.test.ts` y `tests/accessibility-contract.test.ts` pasan (34 pruebas), pero la mayoría son comprobaciones de texto sobre el código fuente y de funciones puras; no ejercitan el navegador. `tests/offline-policy.test.ts` necesita Prisma generado (no se ejecutó). Por eso las conclusiones de abajo salen de la repetición real en navegador.

## Resumen

| Severidad | Nuevos | v1 aún abiertos o parciales |
|---|---|---|
| Crítico | 0 | 0 |
| Alto | 0 | 0 |
| Medio | 4 (N1, N2, N3, N3b) | 3 (M5, M6, M9 parcial) |
| Bajo | 7 (N4 a N10) | 9 abiertos + 2 parciales (B2, B11) |
| Alto v1 residual | 0 | 2 parciales (A3: caso carrito vacío sin conexión; A2: detalle del conflicto, ver N8) |

De los 5 ALTO de v1: **A1, A4 y A5 corregidos con evidencia**, **A2 corregido en lo esencial** (queda un resto, N8), **A3 parcial** (queda un caso). De los 9 MEDIO: 6 corregidos (M1, M2, M3, M4, M7, M8), 1 parcial (M9) y 2 abiertos (M5, M6). De los 13 BAJO: 2 corregidos (B3, B13), 2 parciales (B2, B11) y 9 abiertos.

Sin hallazgos nuevos críticos ni altos. axe-core: 0 violaciones en inicio de sesión, POS vacío, POS con error visible, selector de cliente, cobro, Caja, ventana de cierre, Resumen de administradora y Configuración (con la tarjeta de Drive).

---

## 1. Tabla v1 → estado

| v1 | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| A1 | Ticket siempre «Consumidor final» | **Corregido** | `POS.tsx:2020-2027` guarda `customer` en el recibo antes de `clearCart()`; `POS.tsx:2103` usa `receipt.customer`. Prueba en navegador: venta a «Adriana Torres» → el ticket dice «Vendido a: Adriana Torres»; el recibo provisional offline también (`t5`, `t9`). |
| A2 | Conflicto offline sin salida, bloquea el cierre | **Corregido en lo esencial; resto parcial** | Nuevo `apps/api/src/offline-sale-review.ts` (`:71`, `POST sales/offline-review/discard`: PIN de gerente o sesión de gerente, evidencia en bitácora, alerta). UI: `Management.tsx:1459-1470` (gerencia ve la cola de toda la sucursal), `:1664-1763`, `DiscardOfflineSale` `:1985`. Probado: la cajera ve «Descartar con PIN de gerente», lo descarta con PIN 234567, la fila desaparece y quedan `offline_sale_conflict` + `offline_sale_discarded` (`approval=pin`) (`t10`, `t11`). La ventana de cierre avisa antes de contar (`Tienda.tsx:100-113`, `:226`). Resto: ver N8 y N4. |
| A3 | Cierre por inactividad sin conexión | **Parcial** | `App.tsx:704-719` (`holdsWork`): con carrito o ventas pendientes ya no se cierra la sesión; probado sin conexión, 31 y +35 min (`t9`). Sigue abierto: con carrito vacío y sin pendientes, 31 min sin conexión cierran la sesión y el inicio de sesión dice «Sin conexión con el servidor.» (`t8`). Además aparece un efecto secundario (N2). |
| A4 | Escaneo durante la carga del catálogo | **Corregido** | `POS.tsx:350-372` (cola `scanQueue`), `:464-503`. Con `/api/products` a 4 s se escanearon 3 códigos: el buscador quedó vacío, «3 códigos en espera» y al llegar el catálogo entraron los 3 (`t6`). |
| A5 | Carrito casi invisible | **Corregido (con margen de mejora)** | A 1366×768 el área del carrito mide 271 px (antes 140), la última línea se trae a la vista (`POS.tsx:499-514`) y quedan 3 de 5 líneas completas; las líneas siguen midiendo 89 px (`t5`). En celular hay barra fija con contador y botón «Ver carrito» que desplaza a `#pos-cart` (`POS.tsx:1206-1235`, probado). |
| M1 | Carrito solo en memoria | **Corregido** | `cartDraft.ts` (IndexedDB por usuario) + `main.tsx`. F5 con 2 líneas y cliente: se recuperan las 2 líneas y el cliente (`t3`). PWA ya en `registerType: "prompt"` (`vite.config.ts:41`). Ver N3 y N7. |
| M2 | Un solo aviso, sin sonido | **Corregido con regresión** | Dos ranuras de aviso (`helpers.tsx:117-155`), `scanSound.ts`, aviso de cliente dentro de la ventana (`POS.tsx:478`). Pero el error persistente nuevo tapa el cobro: N1. |
| M3 | Pantallas colgadas sin conexión | **Corregido** | `Management.tsx:1469` (`networkMode: "always"`), `helpers.tsx:164-175`. Sin conexión: Caja muestra «Ventas guardadas en este dispositivo»; «En espera» muestra «Sin conexión: esta información necesita internet» + Reintentar (`t9`). |
| M4 | Selector de cliente sin búsqueda | **Corregido, con matiz** | `POS.tsx:1365-1390`, «Consumidor final» primero. Matiz: N5. |
| M5 | Cierre ciego contradictorio | **Abierto** | `Tienda.tsx:194-196` sigue pasando el cuadre completo a `onClosed`; los textos siguen contradiciéndose («se mostrarán únicamente a administración» en Caja vs. cuadre impreso con totales del sistema). |
| M6 | Devoluciones y reimpresión | **Abierto** | `Management.tsx:2925-2937`: sigue siendo un artículo por devolución; no hay «Reimprimir ticket» ni búsqueda por cliente. |
| M7 | «Limpiar» sin deshacer | **Corregido** | `POS.tsx:453-475` (`clearWithUndo`, 8 s, botón «Deshacer»). El carrito se vació y apareció el aviso (`t7`). Falla en silencio si ya se escaneó algo nuevo (`if (cart.length) return`): menor. |
| M8 | Ticket sin variante | **Corregido** | `POS.tsx:146-150` `lineName` usado en el snapshot (`:1859-1861`). |
| M9 | Manuales vs pantallas | **Parcial** | `docs/MANUAL-CAJERO.md` ya dice «(también se ve sin internet)» y la guía del primer día existe; pero el botón sigue diciendo «Offline» (B2) y el cierre ciego sigue sin cumplirse (M5). |
| B1 | Áreas táctiles pequeñas | **Abierto** | Celular 390 px: botón de conexión 15×15, «Quitar» 28×28, descuento global 34×22, cerrar aviso 18×18, avatar 32×32 (`t12`). |
| B2 | Textos en inglés | **Parcial** | Tipos de alerta traducidos (`Management.tsx:1430-1451`); sigue «Offline» en `App.tsx:930`. |
| B3 | Nombres propios en el cobro | **Corregido** | `POS.tsx:2296` «Sólo la administración…». |
| B4 | 403 en `/dashboard/summary` | **Abierto** | Se repite en cada inicio de sesión de la cajera (`t2`, `t3`). |
| B5 | Bundle de 1 MB | **Abierto** | Build: `index-*.js` 1.040 kB (331 kB gzip), precache 2.067 KiB. |
| B6 | Atajos F7/F9/F10 sacan del POS | **Abierto** | `App.tsx` sin cambios en esos atajos. |
| B7 | «Venta al por mayor» ambiguo | **Abierto** | `Incentives.tsx:101` igual. |
| B8 | Alertas sin variante | **Abierto** | `alerts.ts`: «`${v.product.name}: ${stock} unidades…`». |
| B9 | «En espera» sin cliente ni total | **Abierto** | Componente `HeldSales` sin cambios. |
| B10 | `F12` en el botón del celular | **Abierto** | `kbd` visible en celular (`t12`). |
| B11 | Texto «mfeliz», sin cambio de contraseña | **Corregido en parte** | Placeholder «Tu usuario o correo» (`App.tsx:363`) y «Cambiar mi contraseña» (`App.tsx:~990`, `ChangeOwnPassword`); sigue sin «mostrar contraseña». |
| B12 | Importar factura: variante por código | **Abierto** | `Merchandise.tsx` sin cambios. |
| B13 | «Cambiar vendedor» sin conexión | **Corregido** | `App.tsx:974-988` con aviso «Necesitas conexión para cambiar de vendedor.». |

---

## 2. Hallazgos nuevos y regresiones

### Medio

**N1. Un error de escaneo «persistente» se queda encima del cobro y nunca caduca (regresión del arreglo de M2)**
- **Dónde:** `helpers.tsx:46-55` (`persistentError`, `sticky`), `POS.tsx:726`, `:844`; `clearPersistentErrors()` solo se llama al agregar un artículo (`POS.tsx:373`); `charge()` (`POS.tsx:477`) no lo limpia.
- **Escenario (probado, 1366×768):** la cajera escanea un código inexistente, ve «Código no encontrado: 123456789012.», pulsa F12. El aviso rojo queda fijo (z-index 200) sobre la ventana de cobro, en la zona de «Pendiente / Cambio», pegado al botón «Finalizar venta» (`t15.png`). No desaparece solo y en celular queda arriba, sobre el encabezado.
- **Arreglo mínimo:** llamar a `clearPersistentErrors()` en `charge()` y al abrir cualquier ventana; que el error persistente caduque a los 10-15 s o al teclear en el buscador.

**N2. La protección contra el cierre por inactividad también desactiva el cierre de sesión por inactividad cuando hay un carrito abandonado**
- **Dónde:** `App.tsx:704-719`: si hay artículos en el carrito o ventas `pending`, llama a `active()`, que reinicia el reloj. No tiene tope.
- **Escenario (probado sin conexión, 31 min; en línea sigue el mismo camino de código):** una cajera deja un artículo en el carrito y se va. La terminal con su sesión abierta nunca se bloquea, ni de noche, mientras haya carrito. Con el borrador persistente (N3b) el carrito además sobrevive al cierre del navegador.
- **Arreglo mínimo:** tope absoluto (por ejemplo 4× el plazo o 2 h) tras el cual se bloquea la pantalla sin borrar el carrito; solo exentar el cierre cuando hay ventas `pending` sin sincronizar y no hay conexión.

**N3. El borrador del carrito se borra tarde: una recarga justo tras cobrar resucita la venta ya cobrada**
- **Dónde:** `cartDraft.ts:107-125` (debounce de 600 ms + `requestIdleCallback` hasta 2 s) y `POS.tsx` (`clearCart()` tras la venta).
- **Escenario (probado):** venta registrada, recibo en pantalla, F5 a los 150 ms → «Se recuperó tu venta en curso (6 artículos).» con las 5 líneas ya vendidas (`t5`). A los 3,5 s ya no ocurre (`t6`). La ventana existe también si el equipo se apaga, el navegador se cierra o `window.print()` (impresión automática) bloquea los temporizadores. Resultado posible: cobrar dos veces lo mismo (con otro `offlineUuid`).
- **Arreglo mínimo:** borrar el borrador de forma síncrona en el camino de éxito de la venta (`await localDB.cache.delete(draftKey)` antes de mostrar el recibo, o dentro de `clearCart`), y guardar en el borrador el `offlineUuid` de la venta en curso para no restaurar uno ya registrado.

**N3b. El borrador no caduca**
- **Dónde:** `cartDraft.ts:56-80` no compara `savedAt`.
- **Escenario (probado: el carrito sobrevivió al cierre y reapertura del navegador):** la cajera cierra el día sin vaciar el carrito; al día siguiente entra y le aparece un carrito viejo con cliente y descuentos (solo un aviso de 6 s). Con N2 el carrito tampoco pierde la sesión.
- **Arreglo mínimo:** descartar borradores de más de 12 h o de otra sesión de caja; mostrar un aviso que no se cierre solo con «Descartar».

### Bajo

**N4. La ayuda de un conflicto clasifica mal «no corresponde al horario de esta caja» y dice que ya no se puede reintentar**
- **Dónde:** `pendingSales.ts:254` (`/sin conexi[oó]n|offline/i`) y botón «Reintentar» visible en `Management.tsx`.
- **Escenario (probado):** el servidor rechaza con «La venta offline no corresponde al horario de esta caja.»; la ayuda dice «Las ventas sin conexión están desactivadas: ya no se puede reintentar. Pide a gerencia que la descarte…», mientras la misma fila ofrece «Reintentar». Mensaje contradictorio y falso (las ventas offline siguen activadas).
- **Arreglo mínimo:** comparar contra el texto exacto «Las ventas sin conexión están desactivadas» y añadir un caso para «horario de esta caja» (reloj del equipo, caja ya cerrada: descartar con PIN).

**N5. Enter en la búsqueda de clientes elige el primer resultado por coincidencia en cualquier parte del nombre.** `POS.tsx:1378`. Escribir «Ana» + Enter selecciona «Adriana Torres», no «Ana Herrera» (`t5`). En venta a crédito, deuda a nombre equivocado. *Arreglo:* ordenar primero por inicio de palabra y exigir un clic o ↓ cuando haya varios resultados.

**N6. El aviso de nueva versión tapa el encabezado.** `pwaUpdate.ts:64-85`: `position: fixed; top: 12px; z-index: 2147483000`, 92 px de alto a 1280 px (cubre la búsqueda y el estado de conexión); colores fijos, no sigue el tema. Funciona: con carrito dice «Podrás instalarla al terminar esta venta» sin botón; con carrito vacío aparece «Actualizar ahora» y recarga (`t7`). *Arreglo:* anclarlo en la parte baja o dentro del flujo de la barra superior.

**N7. Varias pestañas: solo la que aplica la actualización recarga.** `pwaUpdate.ts:35-41` (`controllerchange` solo en la pestaña que pulsó) con `clientsClaim: true`. Las demás pestañas quedan con JS viejo bajo un SW nuevo cuyo precache ya no tiene los archivos antiguos. *No probado en navegador; por análisis.* *Arreglo:* escuchar `controllerchange` siempre y recargar si el carrito está vacío.

**N8. Una venta en conflicto no sube su detalle hasta que alguien la descarta.** `offline-sale-review.ts:71+` recibe `detail` solo en el descarte; en el conflicto la bitácora guarda totales (`paymentTotal`, `attemptedExpectedTotal`). Si se borran los datos del navegador antes de descartar, el servidor no sabe qué artículos eran (resto de v1-A2). *Arreglo:* que `sales/sync` guarde en el `AuditLog` de conflicto el detalle (artículos y pagos).

**N9. La actualización automática solo mira el carrito.** `pwaUpdatePolicy.ts:21-27`: con pestaña oculta bastan 30 s sin uso para recargar, aunque haya un formulario a medias (compra, recepción de mercancía, conteo de cierre) en otra página. *Arreglo:* no recargar con modales o formularios abiertos (`document.querySelector('[role=dialog]')`) ni con borradores sin guardar.

**N10. La tarjeta de Drive expone en pantalla los nombres de variables de entorno del servidor** (`GOOGLE_OAUTH_CLIENT_ID…`, `BACKUP_ENCRYPTION_KEY`) y la dirección de regreso (`DriveBackup.tsx`, bloque «Falta configurarlo»). Solo para administración; sin valores. *Arreglo:* mostrarlo solo en un detalle plegado.

---

## 3. Verificado sin problema (nuevo)
- Actualización PWA real: SW nuevo en espera, aviso correcto con y sin carrito, aplicación con recarga y sesión conservada (`t7`); `navigateFallbackDenylist` evita que `/api` y `/healthz` caigan en la app.
- Venta offline completa: recibo provisional con «Vendido a», conserva sesión con pendientes, panel de Caja visible sin conexión, sincronización idempotente.
- Bloqueo de inicio de sesión: a la 6.ª contraseña errónea sale «Cuenta bloqueada temporalmente. Espera 15 minutos o pide a la administración que use «Restablecer contraseña»…» (texto claro en español).
- PIN de 6 dígitos: los campos de PIN aceptan 4-6 (compatibles con PIN antiguos) y la creación de usuario pide 6.
- `crypto.randomUUID` en HTTP de red local está cubierto por `polyfills.ts`.
- Cola de idempotencia en formularios (`operationId` en gastos, movimientos, pagos a proveedor): se genera al abrir el formulario, no al guardar, de modo que un reintento no duplica.

## 4. No verificado
- Hallazgos N7 y la regla de 48 h de ventas offline. Impresión física térmica y lectores reales de pantalla. Safari/iOS y Android real. Descarte por gerente con sesión propia sobre la venta de otra persona (cubierto solo por la prueba de API `offline-review-api.test.ts`, que necesita base de datos; el camino de PIN sí se probó). Módulo Drive con credenciales reales de Google.
