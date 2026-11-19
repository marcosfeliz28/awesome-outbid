# Plan maestro por fases — Nexora POS (27-oct-2026)

Autor: Claude nube («Nexora 1 · Software», arquitecto). Orden de la dueña: recontar todo, listar lo que falta **para poder vender el software**, repartirlo a ChatGPT nube y ChatGPT PC (más Claude PC, Taller, Revisor y Mercancía donde corresponda), por fases, y que Nexora 1 solo estructure, revise y despliegue. Motivo: la sesión de Nexora 1 vence el **jueves 29-oct**; hoy es martes. Todo lo que sigue está pensado para que otra sesión pueda retomarlo con solo leer este archivo y `MEMORIA_NEXORA_1_27OCT.md`.

**Lo que no sé lo marco «sin confirmar».** Las fechas y estados del plan de 24-oct (`PLAN-10-MEJORAS-PRODUCTO.md`) son de hace 3 días; la Fase 0 pide verificarlos contra el código antes de fiarse.

---

## 0. Dónde nos quedamos (recuento)

**En vivo hoy**
- *Tienda de la dueña* (Grupo MacGen / GV Makeup Studio, rama `nexora-cloud`): commit `7bec2ee8`, con Preguntas, encuesta, «Mis ventas de hoy» (arqueo ciego) y arreglos de GV. CI de la rama verde en `52e7ead0`. Salud OK.
- *Producto Nexora POS* (rama `producto-nexora`, nexorapos.net): portada y «bóveda de acceso» Obsidian Lumina V2 en vivo desde el 26-oct (`c6148bac`). Solo cambia la pantalla de entrada; el interior sigue con el diseño antiguo.

**Listo para subir, esperando el «sí» de la dueña**
- Portada nueva «N prismática grande» (`chatgpt-pc/lumina-motion-integracion`, `287db57e`): 3 CI en verde, se mezcla sin crear commits nuevos.

**Entregado pero sin CI o con base vieja**
- ChatGPT nube: PR #16 (Catálogo, Inventario, Clientes), #11 (3 hallazgos medios de QA), #13 (Mercancía y Asistente), #14 (Reportes, Configuración, Equipos), #15 (B-01 ventas ciegas, solo propuesta), #12 (política de plugins, solo texto). Salen de la base vieja `8ae06d8d`, están encadenados y chocarán con la portada nueva.
- Claude PC: `pc23-anulacion-fix` (cambia reglas de dinero; 4 puntos menores en corrección), `a1-formula-utilidad` (una sola fórmula de utilidad), `b01-ventas-caja-ciega` (bandera apagada; falta ticket y PDF). Los 3 CI en verde, sin mezclar.
- Instalador de Windows (`chatgpt-pc/cola3-26oct`, `ba5c3c2e`): tildes y contraseña local corregidas; falta la prueba física en la laptop.

**Decisiones de la dueña abiertas:** ver `PENDIENTES_27OCT.md` (ventas ciegas, `netProfit`, reglas de PC-23, anular FS-0000008, cobros de créditos, transferencias, promociones de rotación, plugins, instalador, entorno Taller).

---

## 1. Qué significa «vender el software»: lo que falta, explicado
Hoy Nexora funciona muy bien para **una sola tienda: la suya**. Para venderlo a otros negocios hay que poder responder «sí» a estas diez preguntas de un cliente nuevo:

1. **¿Puedo registrarme yo solo?** Registro, confirmación de correo, empresa propia separada de las demás.
2. **¿Puedo probarlo gratis?** 14 días de prueba, con límites claros, sin pedir tarjeta.
3. **¿Cómo pago y qué pasa si no pago?** Planes, cobro (hoy solo «de prueba», sin dinero real), solo lectura al vencer, exportación y respaldo de mis datos.
4. **¿Es legal?** Términos, privacidad (Ley 172-13), licencias. Esto depende de un abogado, no solo de código.
5. **¿Se ve profesional y confiable?** Marca propia (sin rastros de Macgen), diseño de nivel comercial, página pública de venta con planes y precios.
6. **¿Me ayudan si algo falla?** Soporte (acceso de solo lectura para el equipo), guía de inicio, manual por rol (cajera, administradora).
7. **¿Me sirve con mi contador?** Reportes 606/607/608 e IT-1, secuencias NCF; la factura electrónica (e-CF) está **pausada por orden de la dueña** y la lleva ella con su contable.
8. **¿Es seguro?** Separación entre empresas, permisos por rol, caja ciega, auditoría, respaldos.
9. **¿Qué tiene de especial?** Inteligencia artificial: leer facturas de proveedores, «Pregúntele a Nexora», resumen diario por correo, WhatsApp (los dos últimos más adelante).
10. **¿Puedo instalarlo?** Versión web y versión de escritorio para Windows (instalador).

Cada fase de abajo cubre una o varias de estas diez.

---

## FASE 0 — Congelar la base y verificar el estado real (ahora, 1 día)
**Qué es y por qué:** antes de construir hay que saber qué está de verdad hecho. El plan de 24-oct está desactualizado y hay 10+ ramas sin mezclar. Sin esto se pisan unos a otros.
**Quién:** ChatGPT nube (auditoría total, solo lectura) + Claude nube (revisa y ordena la mezcla).
**Tareas:**
1. Auditar todo (orden en `ORDEN_AUDITORIA_TOTAL_CHATGPT_NUBE_27OCT.md`) y producir `docs/qa/AUDITORIA_TOTAL_27OCT.md`.
2. Actualizar la tabla de estado del `PLAN-10-MEJORAS-PRODUCTO.md` con el estado real (mezclado / en rama / pendiente) por mejora.
3. Fijar el orden de mezcla (portada → #16 → #11 → #13 → #14; B-01, A1 y PC-23 solo con decisión de la dueña).
**Hecho =** informe con hallazgos por severidad y archivo:línea, y la tabla del plan al día.
**Skills a usar:** `arena` (para comparar propuestas en desacuerdo), `webapp-testing` (pruebas de navegador), `ponytail` (cambios mínimos).
**Pegar a ChatGPT nube:** «Lee `docs/coordinacion/ORDEN_AUDITORIA_TOTAL_CHATGPT_NUBE_27OCT.md` y `PLAN_MAESTRO_POR_FASES_27OCT.md` (Fase 0). Actualiza además la tabla del plan con el estado real. Solo lectura; no despliegues ni toques Render.»

## FASE 1 — Diseño profesional de punta a punta (en curso, 1–2 semanas)
**Qué es y por qué:** la dueña considera que lo visual «está muy sencillo para lo que se gasta». Un software que se vende se juzga en 10 segundos por su cara: portada, página de venta, tablero, caja. Claude no diseña bien; lo hacen ChatGPT PC y nube con Canva y Runway.
**Quién:** ChatGPT PC (marco, portada, tablero «Hoy», caja clara, activos de marca) + ChatGPT nube (Catálogo, Inventario, Clientes, Reportes, Configuración, Mercancía/Equipos, Asistente, página pública). Orden completa: `BRIEF_DISENO_VISUAL_CHATGPT_PC_27OCT.md` y `ORDEN_DISENO_INTERNO_26OCT.md`.
**Tareas (en orden):** (a) subir portada nueva (necesita «sí»); (b) sistema de diseño de una página + tokens; (c) marco/barra lateral/cabecera; (d) tablero «Hoy»; (e) caja clara; (f) pantallas B; (g) activos de marca (SVG, favicon, imagen social, estados vacíos); (h) rebasar la cadena #16→#14 sobre la portada nueva.
**Hecho =** cada pieza con prueba, 3 CI verdes, capturas 1440/1366/390 en claro y oscuro, y `LISTA: <rama> <commit>`.
**Skills:** `frontend-design` (dirección estética sin plantillas), `webapp-testing` (capturas y navegador), Playwright MCP (ya instalado en Claude PC), plugins Canva/Runway de ChatGPT.
**Riesgo:** peso del JS (límite PWA 2 MiB), contraste y arqueo ciego. El brief los marca.

## FASE 2 — Cerrar el dinero y la caja (1 semana; decide la dueña)
**Qué es y por qué:** nadie compra un POS si la caja no cuadra. Hay tres piezas ya construidas que esperan decisión.
**Quién:** Claude PC (corrige y completa), ChatGPT nube (B-01 y revisión), Mercancía (verifica datos de la tienda), Claude nube (revisa y despliega).
**Tareas:** (1) PC-23: corregir los 4 puntos menores (vencimiento previo, Luhn solo en dígitos, etiqueta fija en bitácora, NBSP→409); (2) A1: nota de versión («Ventas» ahora incluye ITBIS); (3) B-01: ocultar también ticket y PDF a la cajera con caja abierta y probar en navegador con la bandera encendida; decidir créditos; (4) `netProfit` y rentabilidad del cuadre (`cash.ts:488-507`): decisión de la dueña sobre ITBIS.
**Hecho =** cada rama con prueba que falla antes y pasa después y la decisión de la dueña por escrito.
**Skills:** `mercancia` (verificación 3/4 veces para cualquier dato de la tienda), `arena` si hay dos formas de arreglar algo.

## FASE 3 — Producto vendible: registro, prueba, planes, cobro, respaldo (2–6 semanas)
**Qué es y por qué:** es lo que convierte una tienda en un SaaS. La separación entre empresas se aprobó el 20-oct (155 rutas, 0 fugas). La «fase 1» del plan (registro, 14 días gratis, planes, cobro de prueba, solo lectura al vencer, exportación y respaldo por empresa) está encargada a ChatGPT PC; su estado real es **sin confirmar**.
**Quién:** ChatGPT PC (construye) + ChatGPT nube (audita) + Claude nube (Render, despliegue) + la dueña (procesador de pago real).
**Tareas:** terminar registro público (cerrado hasta que todo esté listo), correo de confirmación (Resend, activo en la tienda; falta remitente con dominio propio), planes y límites, cobro real con procesador (abrir la cuenta de comercio tarda semanas: **pedirla ya**), solo lectura al vencer, exportación y respaldo por empresa, prueba de carga y de separación entre empresas otra vez.
**Hecho =** una empresa nueva puede registrarse, probar 14 días, pagar y exportar; auditoría de ChatGPT nube sin críticos ni altos.
**Skills:** `webapp-testing` para el flujo completo, `arena` para decisiones de diseño de planes, `session-handoff` al cerrar cada sesión larga.

## FASE 4 — Marca, página pública y papeles (en paralelo, 1–3 semanas)
**Qué es y por qué:** sin marca propia, sin legales y sin una página donde ver precios, no hay venta.
**Quién:** ChatGPT nube (página pública y contenido), ChatGPT PC (quitar Macgen del producto), dueña (nombre, abogado, ONAPI), Claude nube (borradores legales en `docs/legal`).
**Tareas:** (1) elegir un solo nombre («Nexora») y revisar la marca en ONAPI; (2) quitar lo de Macgen del producto (nombre, logo, RNC, ticket, bancos) — `PRODUCT_TENANCY_REQUIRED` ya separa las entradas; (3) página pública de planes (`chatgpt-nube/pagina-venta`); (4) términos, privacidad (Ley 172-13) y licencias con el abogado; (5) soporte: acceso de solo lectura y guía de 5 minutos (`chatgpt-nube/soporte-venta`); (6) manual por rol.
**Hecho =** un visitante ve qué es, qué cuesta, y puede registrarse aceptando los términos.
**Skills:** `searchfit-seo:*` (SEO de la página pública), `marketing:*` y `small-business:*` solo para redactar contenido (revisar siempre), `frontend-design`.

## FASE 5 — Contadores y cumplimiento (semanas 8–10; e-CF sigue pausada)
**Qué es y por qué:** los contadores recomiendan lo que les ahorra trabajo. Reportes 606/607/608 e IT-1, NCF e ITBIS en gastos, lectura de RNC/NCF/ITBIS en facturas, aviso de secuencias NCF por agotarse. **Regla fija:** nada que permita dejar ventas fuera de lo que se reporta a la DGII. La e-CF la lleva la dueña con su contable; **no programar hasta nueva orden**.
**Quién:** ChatGPT PC (construye), contador de la dueña (prueba el primer 606 real), ChatGPT nube (audita).
**Hecho =** primer 606 generado y aprobado por el contador con datos de prueba.

## FASE 6 — Inteligencia artificial (semanas 7–16 y después)
**Qué es y por qué:** es lo que diferencia a Nexora. En este orden: (a) lectura de facturas con modelo más barato (mejora 8; necesita 10 fotos/PDF reales de suplidores distintos); (b) «Pregúntele a Nexora» solo lectura, con consultas por plan (propuesta 30/50/300); (c) resumen diario por correo; (d) conector MCP/OAuth para la IA del cliente con bandeja de cambios propuestos (la dueña decide si puede *proponer*); (e) asistente de WhatsApp (depende de la verificación de Meta; al final).
**Quién:** ChatGPT nube (b, c, d, e), ChatGPT PC (a, d en conjunto), Claude nube (revisa y despliega), dueña (decisiones y cuentas).
**Skills:** `claude-api` para la parte de modelos de Claude (ids actuales de modelo, caché, estructuradas), `arena` para elegir diseño de consultas.

## FASE 7 — Instalador y distribución de escritorio (1 semana, con la laptop libre)
**Qué es y por qué:** muchos negocios dominicanos quieren una versión instalable. Hay un instalador con UTF-8 y contraseña local 4–20 caracteres; falta la prueba física.
**Quién:** ChatGPT PC (prueba en la laptop con datos inventados), Claude PC (apoyo y capturas), dueña (el «sí» y la contraseña, que escribe ella).
**Hecho =** instalación limpia, todas las pantallas sin letras raras, entrada y caja funcionando, documento `PRUEBA_INSTALADOR_27OCT.md`.

## FASE 8 — Operación y relevo (esta semana, antes del jueves)
**Qué es y por qué:** Nexora 1 vence el jueves y es la **única** sesión que despliega y tiene las llaves. Sin relevo, nada sube.
**Tareas:** (1) designar una sesión sucesora con las llaves (la dueña lo hace en su entorno) y documentar en `docs/operacion/` el procedimiento exacto de despliegue (comando, servicios Render, comprobaciones, reversión); (2) recrear las rutinas (hora, diaria, vigilante) en la sucesora; (3) transferir `MEMORIA_NEXORA_1_27OCT.md`; (4) cerrar los despliegues pendientes que tengan «sí» antes del jueves; (5) el Taller termina la huella de Task Observer; (6) el Revisor audita los plugins instalados.
**Hecho =** otra sesión demuestra un despliegue de prueba bajo supervisión.

---

## 2. Reparto resumido (qué hace cada herramienta)
| Quién | Hace | No hace |
|---|---|---|
| **ChatGPT nube** | Auditoría total, vistas B, página pública, soporte, IA (b, c, d, e), pruebas | Desplegar, Render, base, credenciales |
| **ChatGPT PC** | Diseño (portada, marco, caja, tablero, activos con Canva/Runway), fase 1 SaaS, 606, instalador, quitar Macgen | Idem |
| **Claude PC** | Arreglos y pruebas en ramas, verificación local, Playwright, capturas | Desplegar, borrar, instalar riesgosos |
| **Taller** | Probar plugins y herramientas pesadas sin llaves | Producción |
| **Revisor** | Auditar plugins y seguridad (solo lectura) | Instalar |
| **Mercancía** | Inventario, cobros, cajas con verificación 3/4 veces | Cambios sin confirmación de la dueña |
| **Nexora 1 (hasta el jueves)** | Estructura, revisa, despliega con 3 CI verdes | Diseñar; escribir código grande |
| **Dueña** | Decisiones, cuentas (procesador de pago, Meta, Resend), abogado, ONAPI | — |

## 3. Reglas comunes a todas las fases
Ver `CLAUDE.md`: margen = (precio−costo)/precio sin restar ITBIS y mínimo 15 %; no cambiar precios por una oferta; no tocar lo que la dueña contó sin conteo nuevo; no imprimir credenciales; prueba que falle antes y pase después; 3 CI verdes (`verify`, `windows-installer`, `render-images`); solo la sesión con llaves despliega; la factura electrónica queda pausada.
