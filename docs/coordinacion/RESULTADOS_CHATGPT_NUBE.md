# Resultados de ChatGPT NUBE

## 2026-11-09 · Auditoría de `claude-pc/diseno-impacto`

**Rama de auditoría:** `chatgpt-nube/auditoria-diseno-impacto-9nov`

**Entrega auditada:** `426aa6a56c2a9f74a7a3760838e00ceade7a066d`

### Veredicto

**No recomiendo mezclar la entrega sin corregir DI-01 a DI-04.** La capa visual no modifica `POS.tsx`, conserva F2/F4/F8/F12 y sus colores nuevos comprobados alcanzan AA. Sin embargo, el último commit publicado no pasa `verify`, el video identifica a Macgen/GV, «reducir movimiento» no detiene Recharts y el esqueleto deja vacío el estado accesible de carga. Además, la propia medición registra una pausa visible en CPU 4×.

### Hallazgos

1. **DI-01 · ALTA · El video promocional muestra identidad y contexto de la tienda.** En `docs/diseno/capturas/clips/promo-norexos-16x9.mp4`, aproximadamente 00:04, se leen «GRUPO MACGEN · GV MAKEUP STUDIO», «BIENVENIDA · MACGEN & GV» y la descripción de lo que vende Grupo MacGen/GV. Entre 00:08 y 00:16 también aparecen «Valeria Rivera», «Hola, Valeria», el país, cifras anuales y la opción «GV Makeup Studio». La versión vertical repite «Valeria». El generador inicia la sesión sembrada y graba el tablero real en `docs/diseno/capturas/clips/grabar-promo.cjs:102-160`; el nombre mostrado viene de `apps/api/prisma/seed.ts:115-126`. Aunque «Valeria Rivera» pertenece a la semilla y no se confirmó como persona real, **Macgen/GV sí identifica la operación para la que se construyó el sistema** y contradice la orden de que el promo no muestre datos de la tienda. **Arreglo propuesto:** grabar en una instancia exclusivamente comercial con empresa genérica «Tienda de demostración», usuarios ficticios inequívocos, menú sin GV/Macgen y cifras sintéticas; añadir una prueba que extraiga fotogramas/OCR y bloquee `Macgen|GV|Valeria|Grupo` antes de publicar.

2. **DI-02 · MEDIA · «Reducir movimiento» deja activa la animación nativa de Recharts.** La pantalla promete «nada se mueve» en `apps/web/src/Management.tsx:4166-4169`, pero el `<Area>` de la demostración no define `isAnimationActive={false}` cuando la preferencia es `reduce` (`apps/web/src/Demo.tsx:70-89`). El propio documento reconoce la excepción en `docs/diseno/DIRECCION_VISUAL_IMPACTO.md:91-95`. La E2E titulada «no anima nada» solo consulta el velo CSS y una estrella (`tests/e2e/impacto.spec.ts:71-92`), no la animación SVG de Recharts, por lo que da un verde incompleto. **Arreglo propuesto:** propagar una consulta reactiva de `prefers-reduced-motion` a cada gráfica y desactivar su animación; ampliar la E2E para observar el path de Recharts antes y después de varios cuadros.

3. **DI-03 · MEDIA · El modo Impacto elimina el mensaje accesible de carga.** `Loading` usa `role="status"` y el único texto «Cargando datos…» en `packages/ui/src/index.tsx:72-82`. Impacto aplica `display:none` a ese `span` y al SVG (`apps/web/src/impacto.css:123-140`), mientras el esqueleto restante es `aria-hidden`; el estado queda sin nombre para lector de pantalla. **Arreglo propuesto:** conservar «Cargando datos…» como `.sr-only` o añadir un texto equivalente no oculto del árbol accesible; cubrirlo con una prueba de nombre/estado accesible en modo Impacto.

4. **DI-04 · ALTA · El último commit publicado tiene `verify` rojo por 30 errores de ESLint.** La ejecución 42560797904 falla en `pnpm check`: `docs/diseno/capturas/clips/grabar-promo.cjs:3-190` usa CommonJS y globales de Node/navegador sin una configuración de lint aplicable (`@typescript-eslint/no-require-imports` y `no-undef` sobre `require`, `process`, `__dirname`, `localStorage`, `Buffer`, `document`, `location`, `window` y `console`). `windows-installer` y `render-images` sí pasan. **Arreglo propuesto:** convertir el generador a un módulo/configuración ya admitidos por el repositorio o declarar de forma acotada el entorno del script y formatearlo; volver a ejecutar los tres trabajos en el mismo SHA corregido. No corresponde ignorar el archivo globalmente sin justificar qué reglas dejan de aplicar.

5. **DI-05 · MEDIA · En CPU 4× Impacto registra tareas largas y un cuadro de 217 ms, pero la regresión solo exige el presupuesto a velocidad normal.** La evidencia de la propia rama muestra una tarea de 92 ms al abrir la demostración y dos de 74/68 ms al volver al resumen, con peor cuadro de 217 ms (`docs/diseno/DIRECCION_VISUAL_IMPACTO.md:73-83`). La prueba bloqueante no aplica throttling y solo rechaza tareas mayores de 50 ms en ese caso (`tests/e2e/impacto.spec.ts:95-154`). CLS desde el primer cuadro sí queda en 0. **Arreglo propuesto:** añadir un caso con CPU 4× y presupuesto explícito; en equipos lentos omitir View Transition/animación de gráficas o aplicar carga diferida a la demostración.

### Comprobaciones sin hallazgo

- **Caja/POS y teclas:** no hay cambios en `apps/web/src/POS.tsx`, `posKeyboard.ts` ni módulos de cobro. `withTransition` evita entrar o salir del POS; F2/F4/F8/F12 siguen en `POS.tsx`. No encontré cambios de dinero, ventas, caja o inventario en los commits propios de Impacto.
- **Contraste:** cálculo WCAG: aviso claro 6.37:1, aviso oscuro 7.28:1, violeta `#7c3aed` sobre blanco 5.70:1 y violeta claro `#a78bfa` sobre `#151b2b` 6.31:1. No encontré un par nuevo bajo 4.5:1.
- **Teclado:** el interruptor es un `input[type=checkbox]` etiquetado y la E2E lo activa con Espacio. La ruta de demostración se abre con un enlace normal.
- **Tamaño del bundle:** frente a `origin/nexora-cloud`, el JS principal pasó de 1,228,128 a 1,234,100 bytes (+5,972; +0.49 %) y CSS de 134.96 a 140.45 kB; el chunk de gráficas permaneció en 394.77 kB. No es un hallazgo por peso.
- **Terceros:** los dos MP4 auditados solo contienen video H.264, sin pista de audio; no encontré música, imágenes o clips de terceros dentro de esos archivos.

### Pruebas, autoauditoría y límites

- Inspeccioné los tres commits propios de la entrega, extraje fotogramas de ambos MP4 y verifiqué metadatos: 1920×1080/35.4 s y 1080×1920/24.77 s, H.264 y sin audio.
- `tests/impacto.test.ts`: 9/9 en verde. Es una prueba estática útil, pero DI-02 demuestra que no cubre todo el movimiento real.
- Build web de producción: verde. Comparé el peso con la misma base y dependencias.
- La entrega auditada `426aa6a5` tiene `windows-installer` y `render-images` verdes, pero `verify` rojo en la [ejecución 42560797904](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/42560797904). El texto local y remoto coincide: `✖ 30 problems (30 errors, 0 warnings)` en `grabar-promo.cjs` durante ESLint.
- `tests/impacto.test.ts` pasó **9/9**. `pnpm lint` reprodujo los mismos **30 errores**; por eso `pnpm check` no puede considerarse verde en este SHA. No se relajó ninguna prueba ni regla.
- No se modificó el código auditado, no se desplegó, no se accedió a Render, credenciales, producción ni a la base de la tienda.

### Decisión recomendada

Bloquear la publicación de los videos hasta DI-01 y la mezcla completa hasta DI-04. Corregir DI-02 y DI-03 antes de activar Impacto para clientes. DI-05 puede resolverse con un umbral aprobado o degradación automática para equipos lentos.

## 2026-11-08 · Asistente analista · `chatgpt-nube/asistente-analista`

- **Qué hice:** documenté el producto de IA analítica en `docs/ia/ASISTENTE_ANALISTA_SPEC.md`: ocho grupos de preguntas, las cinco herramientas actuales, seis lecturas faltantes, matriz de permisos para dueña/gerente/cajera y reconciliación obligatoria por tres caminos. Preparé `ASISTENTE_ANALISTA_EVAL_100.md` con exactamente 100 preguntas, respuestas y cálculos deterministas, incluidas trampas de PIN, otra empresa/sucursal, anulaciones, escrituras e inyección. En `ASISTENTE_ANALISTA_COSTOS.md` calculé cuatro escenarios con las tarifas implementadas en `ai-prices.ts` y conservé las cuotas vigentes de 100/250/600/1,500 preguntas.
- **Regresión documental:** antes, las tres comprobaciones `test -f` terminaron con código 1 porque los entregables no existían. Después, los tres archivos existen y no están vacíos; `rg -o 'AA-[0-9]{3}' ... | sort -u | wc -l` devuelve `100`; las búsquedas de PIN, otra sucursal, anulación, inyección, solo lectura, triple lectura y margen del 15 % pasaron. `git diff --check` pasó. Tras preparar el worktree con `pnpm install --frozen-lockfile` y `pnpm db:generate` (sin conectar ni migrar una base), `pnpm check` terminó con código 0: typecheck y lint pasaron, **112 archivos de prueba pasaron y 1 se omitió; 984 pruebas pasaron y 10 se omitieron**; los builds web/API pasaron. Vite emitió la advertencia no bloqueante ya conocida de un chunk mayor de 500 kB.
- **Autoauditoría:** las herramientas propuestas no aceptan empresa/sucursal desde el modelo y no escriben; cada una reutiliza una fuente existente y conserva el permiso del flujo original. La cajera no recibe totales gerenciales, costo, utilidad, esperado ni diferencia de cierre. Las anulaciones, devoluciones, pendientes y datos offline se tratan como excepciones, no como ingresos confirmados. Los cálculos monetarios tienen dos decimales y los porcentajes evitan dividir entre cero. Revisé que los casos AA-001 a AA-100 sean únicos y que los bloqueantes de seguridad estén identificados.
- **Costos y límites:** los tokens son supuestos, no mediciones. La tasa RD$65/US$ es una reserva de planificación, no una tasa vigente confirmada. Con una reserva de tres veces el techo estimado, el margen después de IA queda entre 78.3 % y 91.9 % en planes y entre 69.5 % y 74.6 % en paquetes. Esto no demuestra margen total ≥15 % porque faltan costos de hosting, soporte, impuestos y ventas; el documento incluye la fórmula para comprobarlo antes de vender.
- **Incidencias de preparación:** la primera ejecución de `pnpm check` falló con `tsc: not found` porque el worktree no tenía `node_modules`. Después de instalar desde el lockfile, la segunda falló en typecheck con errores como `Property 'customer' does not exist on type 'Database'` porque Prisma aún no estaba generado. No fueron fallos del cambio documental; tras generar el cliente, la corrida completa quedó verde.
- **Qué falta:** implementar y probar las seis herramientas en otra orden; medir promedio/P95 reales durante el piloto; aportar costos no IA y tasa cambiaria administrativa para certificar margen total. No se tocó código funcional, Render, producción, base ni credenciales; no se desplegó.

## 2026-11-07 · Auditoría del arreglo `flaky-password-telegram`

**Rama:** `chatgpt-nube/auditoria-flaky-password`  
**Base auditada:** `origin/nexora-cloud` en `1a42e1f3`; arreglo de origen `5815b56e` y adaptación de dobles `a8d8fb86`.

### Veredicto

**No encontré un hueco explotable de fuerza bruta.** El cambio de `update` a `updateMany` en `apps/api/src/security.ts:213-231` únicamente evita P2025 si una operación autorizada de cambio de contraseña ya borró la fila. En un fallo, el cupo de cuenta se reconstruye con el estado leído más ese fallo mediante `upsert` (`security.ts:244-265`); al llegar a 30 queda bloqueado durante el resto de la ventana y el intento siguiente se rechaza antes de ejecutar la comparación (`security.ts:200-208`).

La carrera requiere que, al mismo tiempo, termine con éxito un cambio o restablecimiento autorizado de contraseña. Esas operaciones incrementan `authVersion`; las claves de bloqueo incluyen esa versión (`apps/api/src/auth.ts:76-79`). Por eso el borrado/reinicio no permite seguir adivinando la contraseña anterior y el siguiente inicio usa otra identidad de bloqueo. El intento que pierde la carrera puede no incrementar su contador propio de 5 porque la fila desapareció antes del `UPDATE` crudo (`security.ts:237-243`), pero sí incrementa el cupo de cuenta y su credencial ya quedó invalidada. Un atacante no autenticado no dispone de una ruta para provocar ese borrado.

### Regresión y evidencia

- Añadí al test existente un caso de frontera: parte de 29 fallos, borra las filas dentro de la verificación, exige que el fallo 30 recree el cupo con `lockedUntil` y comprueba que el intento 31 no llama al verificador.
- Antes del arreglo (`75c20b3f`, padre de `5815b56e`): `tests/intentos-borrados.test.ts` falla **3/3**; el caso nuevo devuelve `Error: P2025` en vez de `{ status: 400, message: "Incorrecta." }`.
- Después (`1a42e1f3` + la regresión): `tests/intentos-borrados.test.ts` pasa **3/3**.
- Cobertura relacionada ya existente: `tests/auth-lockout.test.ts` comprueba el tope de 30 por cuenta y `tests/password-account.test.ts` la carrera de dos cambios simultáneos contra API/PostgreSQL.

### Autoauditoría y límites

- Revisé los tres caminos: acierto con fila borrada, fallo ordinario con fila borrada y frontera 29→30→rechazo 31.
- Revisé cambio obligatorio, cambio propio, restablecimiento administrativo y marcado de cambio obligatorio. Todos invalidan credenciales mediante `authVersion`; el reinicio de intentos es posterior a una operación autorizada, no una ruta pública independiente.
- No cambié autenticación, permisos, mensajes, límites, base, migraciones ni código de producción; solo amplié la regresión y este informe.
- El doble unitario reproduce la desaparición de filas, no el planificador real de PostgreSQL. La carrera y los límites reales quedan a cargo de `verify` en CI. No se accedió a producción, Render, credenciales ni a la base de la tienda.

### Estado

`pnpm check` terminó con código 0: typecheck, ESLint, **112 archivos de prueba pasaron y 1 se omitió; 985 pruebas pasaron y 10 se omitieron**, y los builds web/API terminaron correctamente. Vite emitió la advertencia ya conocida por un chunk mayor de 500 kB; no es un fallo y esta auditoría no modifica el bundle. La rama solo se declarará lista después del push y de comprobar `verify`, `windows-installer` y `render-images` sobre el último commit.
