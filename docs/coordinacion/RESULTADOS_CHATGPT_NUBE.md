# Resultados de ChatGPT NUBE

## 2026-11-12 · D12 · contenido de ayuda por rol

- **Rama y base:** `chatgpt-nube/ayuda-contenido-12nov`, creada desde `origin/nexora-cloud` `8a83093723a884f7edb017d2f0916b371f556227`. La implementación está en `6a809cd700c59b1bd7eddf6f2b4a24cb4300a8e7`.
- **Paso 0:** comprobé las fuentes vigentes completas: `MANUAL-CAJERO.md`, `MANUAL-CAJERA-PREGUNTAS.md`, `EXPLICACION_DUENA.md` y las 30 respuestas de `QuickQuestions.tsx`. La base no contenía `docs/ayuda/` ni `docs/ayuda/borradores-local/`; por tanto, no había un borrador local que reutilizar o revisar.
- **Entrega D12:** añadí 18 páginas independientes en `docs/ayuda/`: 12 para cajera, 3 para gerente y 3 para dueña. Todas tienen `titulo`, `rol`, `pantalla` y `palabras_clave`, entre uno y seis pasos, y una línea «Si algo sale mal:». Conservé la corrección integrada de C5-1: para crédito se exige elegir un cliente; no se afirma que «Consumidor final» esté prohibido.
- **Regresión documental:** en la base, `test "$(git ls-tree -r --name-only origin/nexora-cloud docs/ayuda | wc -l)" -ge 1` terminó con código 1 porque había 0 páginas. Después, el validador de metadatos, roles, cantidad de pasos y manejo de errores pasó sobre las 18 páginas. `git diff --check` también pasó.
- **Control completo:** `pnpm check` terminó con código 0. Typecheck y ESLint pasaron; 116 archivos de prueba pasaron y uno se omitió; 1,028 pruebas pasaron y 10 se omitieron; los builds web y API pasaron. Vite solo emitió la advertencia conocida de un chunk mayor de 500 kB.
- **Autoauditoría:** cada paso numerado tiene 20 palabras o menos. Contrasté los botones operativos con la interfaz actual: abrir/cerrar caja, guardar cliente, finalizar venta, solicitar anulación y resolver ventas sin conexión coinciden. El diff de implementación solo añade contenido bajo `docs/ayuda/`; no modifica `apps/**`, `tests/e2e/**`, dinero, permisos ni API.
- **Límites:** no abrí la interfaz ni ejecuté pruebas E2E; esta pieza es contenido y `tests/e2e/**` pertenece a Claude nube. No pude revisar borradores de la IA local porque no existen en la base publicada. No desplegué, mezclé ni abrí PR; no toqué Render, producción, la base de la tienda ni credenciales. Los tres CI se comprobarán sobre el SHA final después del único push permitido.

## 2026-11-12 · Mejoras C5-1 · textos y ayuda

- **Rama y base:** `chatgpt-nube/ayuda-textos-12nov`, rebasada sin conflictos sobre `origin/nexora-cloud` `6bfa1aadd2443a4e45487cae61b2f74c19877822`. El commit de implementación es `ca514001ad75e21d49a1ba32dd81509de961458e`.
- **Pieza 1 conciliada, no repetida:** el arreglo original `chatgpt-nube/fix-e2e-12nov` (`8022a736`, run `43158775690`, tres CI verdes) ya está integrado por contenido en la base. La integración reescribió los SHA durante el rebase. Norexos 1 conserva la revisión e integración. Windows-Smoke continúa pendiente y no se declara certificado.
- **C5-1:** comparé las 30 respuestas de Preguntas rápidas, las ocho secciones del manual de caja y las 30 preguntas de la encuesta contra la interfaz actual. Corregí cinco discrepancias en los dos manuales. Documenté tres cambios exactos para `QuickQuestions.tsx` sin tocar `apps/**`, porque ese archivo pertenece a Claude nube. El detalle completo está en `docs/coordinacion/mejoras-12nov/C5-1_textos.md`.
- **Regresión antes/después:** antes del cambio, `vitest run tests/accessibility-contract.test.ts -t 'C5-1'` falló porque el manual no contenía `El fondo menor no requiere PIN`. Después pasó 1/1. La comprobación conjunta de `accessibility-contract` y `compliance` pasó 40 pruebas y omitió una.
- **Control final tras actualizar la base:** `pnpm check` terminó con código 0: typecheck y ESLint pasaron; 116 archivos de prueba pasaron y uno se omitió; 1,028 pruebas pasaron y 10 se omitieron; los builds web y API pasaron. Vite solo emitió la advertencia conocida de un chunk mayor de 500 kB.
- **Autoauditoría:** el control completo detectó que mi primer título de la sección de anulación rompía un contrato documental existente. Conservé el encabezado `solo administración` y actualicé debajo el flujo real de solicitud. Las pruebas afectadas pasaron después. Revisé el diff final: solo contiene los dos manuales, la tabla C5-1, una regresión textual y este informe; no contiene `apps/**` ni `tests/e2e/**`.
- **Límites:** no abrí la interfaz ni ejecuté E2E de navegador. No desplegué, no mezclé, no abrí PR y no toqué Render, producción, la base de la tienda ni credenciales. Los tres CI se comprobarán sobre el SHA final después del único push permitido.

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
