# Resultados de ChatGPT NUBE

## 2026-11-09 · Cola 9-nov (2): brecha, calidad y arreglos seguros

**Rama:** `chatgpt-nube/calidad-9nov`

**Base:** `origin/nexora-cloud` en `b249c6e4`

**Commits funcionales:** `15171d14`, `fe367152`, `2ec41bb3`, `f3ed3a4e`

### Entregas

- `docs/venta/BRECHA_COMPETENCIA.md`: comparación verificable contra Alegra, Odoo, Loyverse y Vendty; estado de 17 capacidades; fuentes y fecha de consulta; brechas con estimación de esfuerzo y las cinco prioridades. Los costos son estimaciones de planificación claramente rotuladas, no precios de Norexos.
- `docs/calidad/AUDITORIA_CALIDAD_9NOV.md`: 13 hallazgos con archivo y línea, gravedad, riesgo y corrección propuesta; incluye tamaño, duplicación, tipos, errores, accesibilidad, rendimiento, pruebas, documentación y deuda técnica.
- Dos arreglos acotados: README vigente de Norexos con límite fiscal explícito y anuncios accesibles para carga/error del medidor de IA. No cambian cálculos, cobros, ventas, caja, inventario, permisos ni datos.

### Regresión y verificación local

- README, antes del arreglo: **2 fallos de 2** porque no existían la identificación vigente de Norexos ni la sección `Desarrollo local`; después: **2/2 pasan** en `tests/calidad-documentacion-9nov.test.ts`.
- Accesibilidad, antes del arreglo: **2 fallos de 2** porque `AiUsageFeedback` no existía; después: **2/2 pasan** renderizando el componente real en `tests/calidad-accesibilidad-9nov.test.tsx`.
- La primera verificación del worktree falló porque el cliente Prisma no estaba generado (`Property 'customer' does not exist on type 'Database'`). `pnpm db:generate` lo generó desde el esquema, sin conectarse a una base ni ejecutar migraciones.
- `pnpm check` terminó con código 0: typecheck y ESLint pasaron; **117 archivos de prueba pasaron y 1 se omitió; 1,022 pruebas pasaron y 10 se omitieron**; los builds web y API pasaron. Vite mantuvo la advertencia no bloqueante conocida sobre un chunk mayor de 500 kB.

### Autoauditoría y límites

- El diff contra la base contiene únicamente README, dos informes, el componente `AiUsage`, dos regresiones y su inclusión en Vitest.
- No se modificó código de dinero ni precios, y no se cambió lógica de negocio. No se accedió a Render, producción, base de la tienda, claves ni PIN; no hubo despliegue ni PR.
- Las afirmaciones no confirmadas de competidores están marcadas como tales. La situación fiscal de Norexos se describe como límite del producto, no como asesoría legal ni como capacidad de emitir comprobantes.
- **CI:** pendiente de ejecutar sobre el commit de entrega; esta sección se actualizará con `verify`, `windows-installer` y `render-images` antes de declarar la rama lista.

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
