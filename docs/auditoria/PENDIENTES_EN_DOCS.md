# Pendientes escritos en los documentos (tarea 88)

Borrador sin verificar, hecho por script. Fuente: `origin/producto-nexora` (`d6adc554`), rama `claude-pc/cola-b14-resto`. Búsqueda: grep sobre `docs` excluyendo `docs/operacion` y este mismo archivo, con las palabras TODO, FALTA, PENDIENTE y POR HACER. Cada fila: archivo:línea y la frase tal como aparece en el documento. Filas: 29.

| Archivo:línea | Frase |
|---|---|
| `docs/capturas/manual/generar-local.mjs:338` | ? "PRÁCTICA-PENDIENTE" |
| `docs/coordinacion/auditoria-2026-10-10/07-calidad.md:165` | - No hay TODO/FIXME ni `@ts-ignore`/`eslint-disable` (bien). |
| `docs/coordinacion/CARGA_INVENTARIO_DECISIONES.md:33` | Existencia: Creamy Vanilla 3 lb (1172)→34; Dutch Chocolate 3 lb (1173)→3; Banana Cream 3 lb (1156)→3. La dueña repitió «3 Chocolate» dos veces: se aplicó una (PENDIENTE confirmar si era otr |
| `docs/coordinacion/CARGA_INVENTARIO_DECISIONES.md:39` | Dutch Chocolate (1173) suma 3; Chocolate Peanut Butter (1632) 5; y el segundo «chocolate» es un sabor distinto que no está en el listado: producto nuevo «Isopure - Chocolate / 3 lb» (ID 1634, 3 u |
| `docs/coordinacion/claude-nube/reportes.py:93` | METODO = {"cash": "Efectivo", "card": "Tarjeta", "transfer": "Transferencia", "cod": "Crédito", "credit": "Crédito"} |
| `docs/coordinacion/claude-nube/reportes.py:111` | m = METODO.get(p["method"], p["method"]) |
| `docs/coordinacion/claude-nube/reportes.py:268` | filas.append([Paragraph(f"{'FALTAN' if v < 0 else 'SOBRAN'} {rd(abs(v))} {forma}", t2)]) |
| `docs/coordinacion/claude-nube/reportes.py:299` | el += [kpis([(rd(r["vendido"]), "VENDIDO (activas)"), (rd(r["cobrado"]), "COBRADO"), (rd(r["pend"]), "PENDIENTE A CRÉDITO"), (rd(r["ganancia"]), "GANANCIA")]), |
| `docs/coordinacion/INSTRUCCIONES_ACTUALES.md:188` | ## 3s. PLAN VIGENTE (11 oct, decisión de la dueña; REEMPLAZA los repartos 3o, 3q y 3r donde choquen): CHATGPT HACE CASI TODO; CLAUDE SOLO SUPERVISA Y DESPLIEGA |
| `docs/coordinacion/INSTRUCCIONES_ACTUALES.md:205` | 2. **Guías de operación para la dueña**, nuevas, en `docs/guias/`: `MONITOR_DE_CAIDAS.md` (monitor externo gratuito sobre `/healthz/deep` con palabra clave `"status":"ok"`), `TELEGRAM_BOT.md` (BotF |
| `docs/coordinacion/INSTRUCCIONES_ACTUALES.md:427` | 1. **Autorización:** recorre TODOS los controladores; cada endpoint con `@Permit` y prueba con un rol SIN permiso (403) y otro CON permiso. Busca acceso a datos de otra sucursal/usuario por `id` (IDO |
| `docs/coordinacion/INSTRUCCIONES_ACTUALES.md:479` | - 24-oct (noche): **plan maestro único** con todos los puntos de los tres carriles: `docs/coordinacion/PLAN_MAESTRO_TODO.md`. Manda sobre órdenes anteriores si chocan. El bloque A de cierre de caja  |
| `docs/coordinacion/ORDEN_40_MEJORAS_CHATGPT_PC.md:6` | Nexora POS es el sistema de Grupo Macgen (tienda de suplementos, maquillaje, fajas y ropa deportiva en Santo Domingo). Lee primero `AGENTS.md`, `CLAUDE.md`, `docs/coordinacion/INSTRUCCIONES_ACTUALES.m |
| `docs/coordinacion/PLAN_MAESTRO_TODO.md:14` | - `TASKS.md` y `docs/operacion/PENDIENTES-DUENA.md`. |
| `docs/coordinacion/RELEVO_CLAUDE_A_CHATGPT.md:4` | Este archivo es TODO el contexto. Léelo completo antes de actuar. Las órdenes de siempre |
| `docs/coordinacion/REVISION_NOCHE_CLAUDE.md:24` | - **BLOQUEO PARA MEZCLAR ✔:** ``main.rs`` (``authorize_drawer``) todavía no manda el motivo, y la API ahora lo exige en la apertura manual. **Mientras no se aplique el parche de Rust, la gaveta man |
| `docs/coordinacion/REVISION_NOCHE_CLAUDE.md:28` | - **PC-19 · licencia, partes de Windows (``b6a9ffa``, ``458fbfa``, ``dedff18``):** ``instalador/tests/Windows-License-Acl.ps1`` para correr **solo** en una máquina virtual limpia con el producto ins |
| `docs/coordinacion/REVISION_NOCHE_CLAUDE.md:423` | - **Corregir** (según `PLAN_MAESTRO_TODO.md`): |
| `docs/coordinacion/REVISION_NOCHE_CLAUDE.md:427` | - **Orden siguiente para ChatGPT PC:** sigue en el orden de `PLAN_MAESTRO_TODO.md` (PC-01 a PC-22). Haz primero las 3 correcciones y luego PC-05. |
| `docs/coordinacion/TRASPASO_CHATGPT_NUBE.md:28` | - Producto nuevo sin precio: créalo con precio y costo 0, y deja el aviso en `docs/operacion/PENDIENTES-DUENA.md`. Nunca inventes un precio. |
| `docs/coordinacion/TRASPASO_CHATGPT_NUBE.md:67` | 5. **Pendientes:** `docs/operacion/PENDIENTES-DUENA.md` es la lista viva. Actualízala y súbela. |
| `docs/coordinacion/TRASPASO_CHATGPT_NUBE.md:82` | - **Inventario de hoy:** conteo de maquillaje de Lisbeth aplicado (782 uds, 170 renglones, 24 productos nuevos 1648–1671 y Mota de Sarias 1672). 21 de esos productos **sin precio ni costo**. Detalle |
| `docs/DECISIONES.md:48` | - **Venta a crédito.** El botón «Vender a crédito (queda pendiente)» de la ventana de cobro pasa lo que falta (todo, o el resto tras un pago parcial) a `cod` sin escribir montos, con confirmació |
| `docs/INSTRUCCIONES_ARQUITECTURA.md:561` | [PEGAR AQUÍ TODO EL DOCUMENTO] |
| `docs/MANUAL.md:179` | 4. El ticket dice **CRÉDITO · PENDIENTE DE PAGO**, el monto pendiente y «DOCUMENTO NO FISCAL». |
| `docs/piloto/LISTO_PARA_VENDER.md:39` | | PC-24 (nombrado en el encargo, sin texto en el plan) | 🔴 | Sin evidencia en el repositorio: `PLAN_MAESTRO_TODO.md` lista PC-01 a PC-22 (y PC-23 en la revisión de las 02:45) | Claude nube debe ac |
| `docs/validacion/aceptacion-caja-brechas.json:184` | "evidence": "La venta se guarda en IndexedDB (localDB.sales) con su input completo y el ticket (POS.tsx:1453-1471), y el stock local baja (POS.tsx:1472; api.ts:383-412). La pendiente se ve en la barra |
| `docs/validacion/auditoria-ronda9-reproducciones/LEEME_AUDITORIA_RONDA9.txt:1` | FITSTORE POS — REPRODUCCIONES INDEPENDIENTES DE AUDITORÍA RONDA 9 |
| `docs/venta/precios.md:3` | > ⚠️ **BORRADOR / PROPUESTA PENDIENTE DE LA DUEÑA** |
