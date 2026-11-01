# Hallazgos para Norexos 1 (1-nov-2026)

De: Claude (filtro de la auditoría de DeepSeek y de la animación de reportes). Rama: `claude-pc/anim-reportes`. Para: Norexos 1, que reaudita y decide.

## 1. Instrucción de la dueña a Norexos 1

La dueña pidió, con sus palabras: que Norexos 1 decida qué se hace de ahora en adelante; que si hay que construir, proceda de inmediato; que use los agentes de la PC y de la nube; y que delegue todo lo que tenga acceso a la computadora, a la PC y a Claude.

Siguen vigentes, y esto no lo cambia ninguna otra instrucción (`CLAUDE.md`):
- Dinero: margen = (precio − costo)/precio sin restar ITBIS; mínimo 15 %; no cambiar precios por una oferta; no tocar lo que la dueña contó o modificó ayer u hoy sin un conteo nuevo suyo.
- Solo Claude (nube) despliega, con los 3 CI en verde (`verify`, `windows-installer`, `render-images`).
- Todo cambio de mercancía sigue el procedimiento del skill `mercancia`.
- Nunca imprimir ni repetir credenciales.

## 2. Estado del trabajo propio

| Qué | Estado |
|---|---|
| Pieza 3 de animación (reportes y desglose), commit `7316e7e` | Hecha. Los 3 CI en verde en ese SHA. Prueba `tests/reportes-animacion.test.ts` (falló antes del CSS, pasa después). |
| Commits siguientes (`a9896d1` a `f050a40` y este) | Solo documentación. CI del último consultado: en curso al momento de redactar. Hay que volver a consultarlo. |
| Pieza 5 de animación (Inventario) y 6 (Configuración) | **Sin empezar.** |
| Línea `LISTA:` en `LISTA_CLAUDE_PC.md` y marca de HECHA en `COLA_PERMANENTE_CLAUDE_PC.md` | **No escritas.** |
| Decisión sobre propuestas de animación de DeepSeek y Gemini | `docs/coordinacion/DECISION_ANIMACION_NOREXOS1.md`. Pendiente de tu revisión. |

## 3. Cómo se hizo la auditoría y sus límites

- DeepSeek solo ve el texto que la dueña le pega. No tiene acceso al repo. Todo lo que dependa de algo que no vio quedó **no comprobado** y se lista en la sección 7 con una «Q».
- Se auditaron 134 archivos de `apps/api/src`, `apps/web/src`, `packages/shared/src` y `packages/ui/src`, en 57 paquetes y 7 fases. Detalle y veredictos por paquete: `docs/auditoria/REGISTRO_AUDITORIA_DEEPSEEK.md`.
- Yo (Claude) verifiqué las citas contra el código. Donde dice «confirmado», leí el archivo y la línea. Donde dice «aceptado sin revisar a fondo», no lo comprobé uno por uno.
- DeepSeek se equivocó varias veces al afirmar cosas sobre modelos de Anthropic y sus betas (sección 5). Sus gravedades suelen estar sobrestimadas.

## 4. Hallazgos confirmados en el código

| ID | Hallazgo | Archivo:línea | Gravedad | Qué decidir o hacer |
|---|---|---|---|---|
| H-01 | Un pago con `currency: "USD"` cuenta como efectivo en dólares aunque el método sea tarjeta o transferencia. El POS solo manda USD como efectivo (`POS.tsx:1777`), pero el servidor no lo rechaza (`sales.ts:490`). | `cash.ts:89-92`, `152-154`, `387-393` | Medio | **Dinero.** Rechazar en el servidor USD con método distinto de efectivo, con prueba que falle antes. |
| H-02 | Solo las rutas listadas tienen límite de peticiones autenticadas; las de administración no. No hay otro limitador global (`app.ts:109-110`) ni `limit_req` en lo que leí de Nginx. | `rate-limit.ts:184-229` | Medio | Ampliar la lista o poner un límite general. |
| H-03 | El nombre del aprobador entra al HTML del correo sin escapar; cajera y cliente sí se escapan. `userName` devuelve el nombre crudo. | `notifications.ts:697`, `101-103`, `427-434` | Bajo-medio | Escapar con `cleanText`. Solo lo explota quien renombra usuarios. |
| H-04 | El reprecio de ventas offline no acota el descuento por línea a 100 %. `lineTotals` tampoco acota el porcentaje: con más de 100 el total sale negativo. | `pendingSales.ts:69-86`, `packages/shared/src/index.ts:322-336` | Bajo-medio | **Dinero y offline.** Escenario: el precio baja entre la venta y la sincronización y el descuento por monto supera el bruto nuevo. Requiere prueba. |
| H-05 | Los límites de scrypt al descifrar un respaldo aceptan hasta unos 8 GiB de memoria (`maxmem` línea 73). El propio comentario del código dice que no debe pedir gigabytes. | `drive-backup-core.ts:111-124` | Bajo-medio | Bajar los límites al descifrar. |
| H-06 | La categoría es única por nombre en todo el sistema, así que se comparte entre sucursales; la importación la reutiliza. | `schema.prisma:62`, `inventory-import.ts:379-386` | Medio | **Decisión de modelo de datos.** No es cambio chico. |
| H-07 | Fechas fijas en el código: `2026-10-27` (rotación DGII) y `2026-10-16` (corrección de conteos). | `formal-report.ts:364`, `inventory.ts:386` | Bajo | Pasar a una constante con nombre y comentario. **No usar variable de entorno**: un valor mal puesto cambia en silencio qué períodos se calculan. |
| H-08 | Suma de incentivos convierte `Decimal` a número; `paidFraction` sin tope entre 0 y 1. | `incentives.ts:599-603`, `309-311` | Bajo-medio / bajo | **Dinero.** Corregir con `Decimal` y registrar el caso de dato corrupto. |
| H-09 | Nombre de mensajería «Addison» fijo en API y web. | `courier.ts:101`, `CourierFeeEditor.tsx:20` | Bajo | Pasar a configuración. |
| H-10 | Si no hay tasa del dólar, la alerta de diferencias en USD se silencia. | `cash.ts:1389-1393` | Bajo | Marcar la alerta cuando falte la tasa. No usar `?? 1` (inventa una tasa). |
| H-11 | Varias lecturas exigen permisos de escritura. | `admin.ts:250` y otras | Bajo | Revisar permisos. |
| H-12 | El PDF de ingresos llega a 10,000 movimientos y CSV/XLSX a 50,000; suma con `Number(m.amount)`. | `income-report.ts:471`, `356`, `261-264` | Bajo | Decisión de la dueña; la suma toca un cuadre de caja. |
| H-13 | El formulario de pago GV arranca en RD$ aunque el curso sea en US$. | `Gv.tsx` (fragmento) | Bajo | `Gv.tsx` lo trabaja otro agente: no se toca. |
| H-14 | Componentes compartidos: `className` pisado, `aria-controls` sin panel, atributo no válido, `NxMoney` lanza con NaN, `button:not(.button)` pisa `.nx-button`. | `nx-primitivos.tsx:25`, `147-170`, `222-225`; `nx-button.ts:34-39`; `styles.css:155-158` | Bajo | `NxButton` no se usa hoy en `apps/web`: sin impacto. |
| H-15 | `download()` no tiene tiempo máximo. Además, si `refreshSession()` no falla y el 401 persiste, se llama a sí misma sin tope. Esto último es observación mía, no de DeepSeek. | `api.ts:545-553` | Bajo | Añadir tiempo máximo y límite de reintentos. |
| H-16 | `setInterval` dentro de `controllerchange` sin limpiar. | `pwaUpdate.ts:81-85` | Bajo | Guardar y limpiar el intervalo. |
| H-17 | `FormModal` aplica `step="0.01"` a todos los campos. | `helpers.tsx:340-353` | Bajo | Aplicarlo solo a números. |
| H-18 | Al restaurar un borrador solo se activa «al por mayor» si el borrador lo trae; no hay reset explícito. | `cartDraft.ts:162-167` | Bajo | Confirmar el efecto (Q-11). |

## 5. Falsos positivos de DeepSeek (no repetir)

| Afirmación | Por qué se rechaza |
|---|---|
| `claude-opus-5-5` «es un modelo inválido» (marcado como crítico, tres veces) | El modelo está en el SDK instalado (`agents.ts:943`) y el proyecto lo usa a propósito (`docs/coordinacion/VEREDICTO_GEMINI_2_24OCT.md:37`). Lo que sí es decisión de la dueña es el **costo** del modelo. |
| La beta `server-side-fallback` y `betaZodOutputFormat` «podrían no existir» | Ambas están en el SDK instalado. |
| `openingSuggestion` «no está definida» | Está en `cash.ts:1435`. DeepSeek solo vio las primeras 1,400 líneas. |
| `/health/ready` revela la base de datos | Es a propósito (comentario S-06 en `app.ts`): solo dice listo o no listo. |
| `@RequireTerminal()` falta en pagos a proveedores y gastos (alto) | Ningún endpoint de `admin.ts` lo usa; ponerlo bloquea la administración desde equipos que no son caja. Es decisión de negocio (H-19). |
| `AuditLog.userId = "sistema"` rompe una clave foránea | No hay clave foránea. |
| Hallazgos «críticos» de dinero GV en US$ | No comprobados; ver Q-04 y Q-05. |

## 6. Decisiones que no son bugs

- **H-19:** ¿Los pagos a proveedores, gastos y anulaciones de gastos (`admin.ts:587, 675, 722`) deben exigir caja registrada (`@RequireTerminal()`)? Además conviene revisar quién tiene `expense:write`.
- **H-20:** ¿Se deja pública `/health/ready`?
- **Costo del modelo de IA para facturas:** ¿se mantiene `claude-opus-5-5` (el más caro)?
- **H-06:** ¿Categorías compartidas entre sucursales o por sucursal?
- **H-12:** ¿El PDF debe tener el mismo límite que CSV y XLSX?

## 7. Lista Q: pendiente para ChatGPT (disponible desde el 2-nov)

Todo lo que DeepSeek no pudo comprobar por no tener acceso, y lo que yo no pude comprobar leyendo. Orden sugerido: primero Q-04, Q-05, Q-08 y Q-06 (dinero).

| Q | Qué comprobar | Por qué quedó pendiente |
|---|---|---|
| Q-01 | Cabeceras y configuración real de Nginx en producción (`curl -I`), y vigencia del certificado. | Necesita el entorno en vivo. En el repo solo leí `client_max_body_size 5m` y encabezados de caché. |
| Q-02 | Si el límite de peticiones en memoria alcanza con varias instancias (¿Redis?). | Es una decisión de infraestructura. |
| Q-03 | Llamada real a `extractAnthropic` con el modelo y las betas actuales. | Necesita clave de API y no se debe gastar sin permiso. |
| Q-04 | **GV, importación de pagos en US$:** `planGvImportPayments` suma con moneda por defecto RD$ (`gv-money.ts:565-569`) y `ImportOwner` no trae la moneda del curso. Escribir una prueba con un curso en US$: ¿se compara bien contra `o.total`? | Hace falta ejecutar la función con datos de prueba. Posible fallo de dinero. |
| Q-05 | **GV, reembolsos en US$:** `refundAmount` no tiene columna de moneda (`schema.prisma:1098`, `1175`) y el reporte neto resta `refunds` sin convertir mientras `total` usa `valorPesos` (`gv.ts:598-642`). **Pregunta a la dueña:** ¿en qué moneda se registra un reembolso de un curso en US$? | Depende de una decisión de negocio. |
| Q-06 | **Caja ciega:** ¿la API de solicitudes de anulación devuelve los importes de pagos cuando `hiddenUntilClose` es verdadero? La pantalla (`VoidRequests.tsx:98-101`) los muestra siempre. | Hay que probar el endpoint con una venta de cajera con turno abierto. |
| Q-07 | `reportes/margen.ts` usa `unitCost` y `reports.ts` usa `bookedLineCosts`. ¿Cuadran con combos y devoluciones parciales? | Hay que comparar cifras con datos de prueba. |
| Q-08 | Probar H-04: precio que baja entre la venta y la sincronización, con descuento por monto mayor al bruto nuevo. | Hay que ejecutar el reprecio. |
| Q-09 | Probar H-03: crear un usuario con nombre `<b>x</b>` y ver cómo sale el correo. | Hay que ver si la creación de usuarios acepta ese nombre. |
| Q-10 | `credit-reminder.ts:162`: rendimiento del `distinct` con volumen real (`EXPLAIN`). | Se necesita una base con volumen. |
| Q-11 | Reset de «al por mayor» al cambiar de vendedor (`cartDraft.ts`). | Prueba de interfaz. |
| Q-12 | `download()` con fallo de refresco de sesión y con red colgada. | Prueba de interfaz. |
| Q-13 | Confirmar con DevTools que el token de acceso vive solo en memoria y el refresco en cookie `httpOnly`. En `api.ts` solo vi `localStorage` para el tema y la identidad del equipo. | Necesita navegador. |
| Q-14 | Segunda revisión independiente de los paquetes «sin hallazgo» aceptados sin revisar a fondo: F2-P06 a P16, F3-P05 a P07, F4-P04, F5-P01, F6-P01, F7 sin hallazgo. | No los comprobé uno por uno. |
| Q-15 | Confirmar que DeepSeek no truncó la lectura en los documentos grandes (fases 6 y 7: unos 361 mil tokens). Mis muestras coincidieron con el código, pero no es garantía. | No se puede saber desde fuera. |
| Q-16 | Los 50 puntos de `ENCARGO_AUDITORIA_DEEPSEEK_V2.md` no se contestaron como tal; DeepSeek auditó por paquetes. Revisar los que no quedaron cubiertos (por ejemplo 42 peso del bundle, 49 alertas de monitoreo, 50 restauración de respaldo). | Eran otro formato de encargo. |

## 8. Lo que no se auditó

- `tests/` (178 archivos, 65 mil líneas): nunca se enviaron a DeepSeek. No se sabe cuántas pruebas pasan sin comprobar nada.
- `apps/api/prisma/` (esquema, migraciones, semilla): no iba en los paquetes. Lo vi solo donde cité líneas de `schema.prisma`.
- `deploy/`, `render.yaml`, `scripts/`, flujos de CI y `docs/`.
- Dependencias (`pnpm audit`).

## 9. Lo que yo no comprobé

- Los paquetes marcados «sin hallazgo» fueron aceptados con muestras, no uno por uno.
- El CI de los commits de solo documentación posteriores a `7316e7e`.
- La animación en navegador o celular: se verificó por pruebas que leen el CSS, no visualmente.
- No se probó nada contra datos reales: todo se hizo leyendo código.

## 10. Prioridad sugerida (la decide Norexos 1)

1. H-01 con prueba que falle antes (dinero, hueco de validación).
2. Q-04, Q-05, Q-06 y Q-08 (cerrar las dudas de dinero antes de tocar código).
3. H-03 y H-02 (seguridad, cambios chicos).
4. H-05 y H-07.
5. Pieza 5 de animación (Inventario) y 6 (Configuración), y marcar la pieza 3 como HECHA en la cola.
