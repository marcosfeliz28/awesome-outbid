# Orden para ChatGPT nube: cola del 26-oct-2026 (6 tareas)

La dueña está despierta hasta las 2:00 a. m. (hora de RD, 06:00 UTC). Claude nube revisa la rama de entrega **cada 15 minutos** y te contesta en `docs/coordinacion/chatgpt-nube-26oct/RESPUESTA_CLAUDE.md`.

## Cómo entregar

- **Rama de entrega:** `chatgpt-nube/cola-26oct`, sacada de `nexora-cloud`. **Haz push después de cada tarea terminada**, no al final.
- **Un archivo por tarea**, en `docs/coordinacion/chatgpt-nube-26oct/`: `T1-...md`, `T2-...md`, etc. Cada hallazgo lleva archivo:línea, gravedad (crítica, alta, media o baja), cómo reproducirlo y el arreglo propuesto. Lo crítico va arriba con la palabra **URGENTE**.
- **Solo lectura del código existente.** Puedes agregar **archivos nuevos** de pruebas (T5) y documentos. No modifiques código de la aplicación, migraciones, `.github/workflows`, Render ni credenciales. No despliegues.
- **Orden:** haz primero lo más urgente. Si una tarea depende de una rama que todavía no existe, pasa a la siguiente y vuelve luego.

## Ramas que vas a leer

- `origin/claude/producto-mezcla-4`: el producto con todas las correcciones y el botón «Preguntas».
- `origin/claude/modulo-gv` y `origin/claude/modulo-gv-citas`: el módulo GV. El agente de Claude lo está corrigiendo ahora con tu auditoría anterior.
- `origin/claude/obsidian-lumina-f1`: el nuevo diseño, fase 1.
- Base ya desplegada del producto: `2f147d2d`.

## T1 · URGENTE: verificar que cada hallazgo de tu auditoría de GV quedó resuelto

Cuando `claude/modulo-gv` tenga las correcciones (un commit nuevo después de `6c292009`, con GV-01 a GV-16), revisa uno por uno: «resuelto», «parcial» o «sigue abierto», con la evidencia (archivo:línea y la prueba que lo cubre). Mira también que las correcciones no abran un hallazgo nuevo. **Entrega:** `T1-verificacion-gv.md`.

## T2 · Auditar la mezcla 4 del producto

Revisa `origin/claude/producto-mezcla-4`, que junta: auditorías de ChatGPT y Gemini ya corregidas, inicio sencillo en 2 pantallas, cobros manuales, NCF, IA y soporte, botón «Preguntas», encuesta de la caja, `mis ventas de hoy`. Busca:
- dinero (cuadre, vuelto, anulaciones), autoaprobación, NCF repetido o con huecos;
- separación entre empresas (`tenantId`, RLS), el operador de la plataforma viendo datos de un negocio;
- regresiones entre ramas (algo que una rama arregló y otra deshizo al mezclar).
**Entrega:** `T2-mezcla4.md`.

## T3 · Revisar todas las migraciones nuevas contra la base desplegada

Las migraciones posteriores a `2f147d2d` (por ejemplo `202610280024_*`, `202610290001_sold_by_unit`, `202610290002_platform_payment_void`, `202610300001_ncf_coherencia`, `202610300002_pla02_*`, `202610310001_cashier_survey`, `202611010001_tenant_fk_indice`) se aplicarán sobre la base viva del producto. Para cada una: ¿es aditiva?, ¿puede fallar con datos reales (duplicados, nulos)?, ¿bloquea tablas grandes?, ¿el orden de los prefijos y las dependencias es correcto?, ¿se puede repetir sin daño? Y para la de GV (`202610260901_gv`, `202610260902_gv_citas`) sobre la base de la **tienda** (la de Macgen). **Entrega:** `T3-migraciones.md`.

## T4 · La regla del efectivo en «Mis ventas de hoy» y «Preguntas»

La dueña quiere que la cajera vea lo que lleva vendido. El riesgo: si ve su efectivo del día, sabe cuánto debe haber en la gaveta y rompe la caja ciega. Revisa `GET /api/sales/mine/:period`, el botón «Preguntas» y la encuesta (`apps/api/src/*`, `Preguntas*`, `CashierSurvey`):
- ¿una cajera puede deducir el efectivo esperado con la información que ve (total menos tarjeta y transferencia, devoluciones, cobros de la dueña)?
- ¿se cuela algún costo, margen o dato de otra vendedora?
- ¿la IA responde «¿cuánto vendí hoy?» sin gastar cuota, y solo con lo suyo?
Propón la regla exacta para equilibrar comodidad y caja ciega. **Entrega:** `T4-efectivo-y-caja-ciega.md`.

## T5 · Pruebas nuevas, solo en archivos nuevos

Escribe pruebas adversarias para GV, en **archivos nuevos** (por ejemplo `tests/gv-adversarial-api.test.ts`) y sin tocar ninguno existente: sobrepagos, doble clic en pagos, verificación por la misma persona, importación repetida y con claves reutilizadas, rol `gv` contra rutas de Macgen, estados cerrados que aceptan pagos, fechas inválidas, montos con 3 decimales. Deben **fallar hoy** si el hallazgo sigue abierto y pasar cuando esté corregido. No las agregues a `vitest.config.ts`; dime en el documento cómo se incluyen. **Entrega:** los archivos de prueba y `T5-pruebas-gv.md`.

## T6 · Plan del rol de base de datos de mínimo privilegio para la plataforma (PLA-05)

Tu hallazgo PLA-05 quedó sin hacer: las rutas del operador usan una conexión propietaria de toda la base. Diseña, **sin implementar**, el rol de PostgreSQL con los permisos justos (crear empresas, invitaciones, pagos, paquetes de IA, bitácora), la migración que lo crea, qué variable de entorno nueva hace falta y cómo se pasa sin cortar el servicio en Render. Incluye cómo probar que ese rol no puede leer ventas, clientes ni productos de ninguna empresa. **Entrega:** `T6-rol-plataforma.md`.

## Qué hace Claude nube mientras tanto

Cada 15 minutos lee tu rama, corrige lo que encuentres y te responde en `RESPUESTA_CLAUDE.md`. Si te falta algo para seguir, escríbelo al inicio de tu último archivo con la palabra **BLOQUEADO**.
