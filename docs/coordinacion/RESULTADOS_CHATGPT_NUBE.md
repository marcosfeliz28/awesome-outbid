# Resultados de ChatGPT NUBE

## 2026-11-09 · Auditoría de marketing y Canva · `chatgpt-nube/auditoria-marketing-9nov`

### Alcance y veredicto

Audité en solo lectura `origin/claude-pc/marketing-ventas` (`28fa9236`) y
`origin/claude-pc/canva-ventas` (`1ba486fd`) contra
`docs/venta/PROPUESTA_PRECIOS.md:42-64` («Propuesta de introducción 7-nov») y
contra el comportamiento que existe en `origin/nexora-cloud` (`d927b2a8`).
También leí directamente el texto de los dos diseños privados enlazados desde
`CANVA_ENLACES.md`; no edité ni publiqué los diseños.

**Resultado: no deben usarse todavía como material comercial sin corregir cinco
afirmaciones.** Los importes sí coinciden con la propuesta aprobada; las piezas
dicen correctamente que Norexos no emite NCF/e-CF y que el soporte es en
español, y no encontré una promesa de soporte en inglés ni «disponible ya».

### Hallazgos

1. **ALTO · El precio cambia al decir que no incluye impuestos.**
   `docs/venta/marketing/PROPUESTA_COMERCIAL.md:28` añade «No incluyen
   impuestos», pero la propuesta aprobada (`PROPUESTA_PRECIOS.md:42-64`) no
   decide eso. Si se suma ITBIS u otro impuesto, el total cobrado deja de ser el
   precio anunciado. **Arreglo propuesto:** quitar esa frase hasta que la dueña y
   su contable decidan si los precios son finales o antes de impuestos; después,
   reflejar la decisión también en la fuente oficial de precios.
2. **ALTO · Canva garantiza un resultado que el sistema no puede garantizar.**
   La presentación visible dice «Caja y cierre sin descuadres»; su fuente está
   en `docs/venta/canva/CONTENIDO_VENTAS.json:34-36`. Norexos registra y exige
   justificar diferencias, pero no puede impedir que exista un descuadre.
   **Arreglo propuesto:** «Cierre ciego con diferencias identificadas» o «Caja y
   cierre bajo control».
3. **MEDIO · La venta sin internet se anuncia sin sus límites.**
   `MENSAJES_PRIMER_CONTACTO.md:13`, `PLAN_CONTENIDO_30_DIAS.md:24` y
   `PROPUESTA_COMERCIAL.md:7` dicen que la caja sigue vendiendo sin internet.
   En el producto solo ocurre si administración activa `allowOfflineSales`
   (`apps/web/src/POS.tsx:2142-2160`); además, crédito, contraentrega, nota de
   crédito y aprobaciones por PIN requieren conexión (`POS.tsx:2162-2184`).
   **Arreglo propuesto:** «Puede registrar ventas de contado sin internet cuando
   el modo sin conexión está habilitado; créditos y aprobaciones requieren
   conexión».
4. **MEDIO · Se vende como lista una instalación que aún no terminó la prueba
   real obligatoria.** `PROPUESTA_COMERCIAL.md:19-20` y ambos diseños de Canva
   presentan el producto instalado en laptop. El código del instalador existe,
   pero `docs/INSTALADOR.md:628-641` deja pendientes la construcción del `.exe`,
   instalación/reinicio en Windows 11, venta sin internet, restauración,
   actualización, reinstalación y firma Authenticode. **Arreglo propuesto:** no
   entregar la oferta instalada hasta pasar esa lista; mientras tanto marcarla
   «piloto sujeto a validación técnica en la laptop».
5. **MEDIO · Promesa de velocidad sin prueba.** La presentación de Canva dice
   «Vende en segundos» y `PLAN_CONTENIDO_30_DIAS.md:21` propone «cajera cobrando
   en segundos». No hay una medición o umbral de rendimiento que respalde esa
   afirmación. **Arreglo propuesto:** «Busca por nombre o código y cobra desde la
   misma pantalla».
6. **BAJO · Estado interno de precios desactualizado.** Los comentarios de
   `apps/landing/index.html:157` y `apps/landing/en/index.html:154` todavía dicen
   que la propuesta no está aprobada, aunque `PROPUESTA_PRECIOS.md:44` registra
   aprobación del 7-nov. No lo ve el cliente, pero puede inducir a una edición
   posterior equivocada. **Arreglo propuesto:** actualizar el comentario sin
   publicar precios hasta la decisión correspondiente.

### Comprobaciones que pasaron

- Los diez valores de `CONTENIDO_VENTAS.json:9-20` coinciden con
  `PROPUESTA_PRECIOS.md:53-63`: US$149, US$39/año, US$7/usuario/mes, 10
  preguntas/día, 20 lecturas incluidas, US$0.30 extra, US$69/mes, US$119/mes,
  US$75 y piloto de 60 días; la tasa RD$60/US$ está marcada como referencia por
  confirmar.
- Los dos diseños y la propuesta comercial dicen «no emite NCF ni e-CF»; no
  prometen factura fiscal.
- La página en inglés aclara que el soporte se presta en español
  (`apps/landing/en/index.html:198-202`); no encontré soporte en inglés.
- El texto visible extraído de Canva no contiene «hoy» ni «disponible ya». La IA
  figura como opcional y activable por decisión del negocio, coherente con el
  apagado y los topes de `apps/api/src/assistant.ts:656-675`.
- El JSON de contenido es sintácticamente válido y los dos enlaces de Canva
  resuelven a diseños existentes.

### Evidencia, autoauditoría y límites

- Comandos reproducibles: `git diff --name-status origin/nexora-cloud...HEAD`,
  búsquedas `rg` de promesas/precios y comparación de los valores JSON con la
  sección aprobada. La auditoría es de solo lectura: no corresponde una prueba
  que pase después de corregir porque, por orden, no modifiqué las ramas
  auditadas. Las búsquedas reproducen los cinco textos objetados antes de su
  corrección.
- Revisé por separado precios, fiscalidad, idioma de soporte, disponibilidad,
  IA, modo sin conexión y estado del instalador. Volví a contrastar cada
  hallazgo con código o documento fuente y descarté como problemas las funciones
  que sí existen: recibo impreso/PDF/WhatsApp/correo, alertas de existencias y
  vencimiento, exportación PDF y herramientas de IA opcionales.
- El conector de Canva permitió leer todo el texto visible, pero esta auditoría
  no certifica imágenes, logos, contraste, márgenes de impresión ni tipografía;
  eso requiere exportar/renderizar las piezas o abrirlas visualmente. Tampoco se
  probaron Windows 11, impresora, lector, Android o iPhone.
- No se cambió código funcional, precio, diseño, Render, producción, base ni
  credenciales; no hubo despliegue.

### Estado de pruebas y CI

`pnpm install --frozen-lockfile` y `pnpm db:generate` pasaron. `pnpm check`
terminó con código 0: typecheck y ESLint pasaron; **112 archivos de prueba
pasaron y 1 se omitió; 989 pruebas pasaron y 10 se omitieron**; los builds de
web y API pasaron. Vite emitió la advertencia no bloqueante ya conocida por un
chunk mayor de 500 kB. Los tres trabajos de CI se anotarán aquí después del push
del commit documental. No hay decisión necesaria para corregir las promesas 2,
3 y 5; la dueña/contable deben decidir el tratamiento de impuestos del hallazgo
1, y Windows debe validar el hallazgo 4.

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
