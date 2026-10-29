# Memoria fija de Nexora 1 (corte 29-oct-2026)
Para quien llegue sin haber participado. Sin claves ni credenciales (nunca se guardan aquí).

## Reglas de dinero (fijas, de la dueña)
- Margen = (precio − costo) / precio, sin restar ITBIS; mínimo 15 %. No cambiar precios en el sistema por una oferta (la caja aplica el descuento). No tocar lo que la dueña contó o modificó sin un conteo nuevo suyo.
- Cambios de mercancía o dinero: verificar 3 veces (conteos, 4) y aplicar solo con su confirmación. Caja ciega. e-CF y B04 en pausa.
- Solo Claude (nube, «Nexora 1») despliega en Render, con los 3 CI en verde (`verify`, `windows-installer`, `render-images`). La tienda (`nexora-cloud`) solo con cajas cerradas (GET /cash-sessions?status=open filtrando closedAt nulo) y OK de la dueña.

## Estructura
- Tienda: rama `nexora-cloud`; Render API `srv-db3fep59fdbs73dic6n0`, web `srv-db3feel9fdbs73diarn0` (workspace `tea-db3f7ofavr4c739hsgi0`). Producto (nexorapos.net): rama `producto-nexora`; API `srv-dbema1nb9u1s73a77jn0`, web `srv-dbem9lvb9u1s73a76l0g`. autoDeploy apagado; `trigger_deploy` despliega la cabeza de la rama. Orden: API primero (corre migraciones), luego web.
- Coordinación por archivo: `docs/coordinacion/RESPUESTA_CLAUDE_PC_27OCT.md` (órdenes numeradas, hoy hasta la 38). Claude PC (laptop) ejecuta con un modelo local Ollama de 7B (sin costo; solo piezas pequeñas). Mercancía (otra sesión) maneja inventario y traspasos. Los mensajes directos nube→laptop están bloqueados.
- La memoria externa «brain» rechazó guardar (403, plan de la cuenta): por eso esta memoria vive en el repositorio.

## Hecho (28 y 29-oct)
- GV publicado en la tienda, commit 548a789e: banco desplegable agrupado Génesis/Macgen (usa `settings.transferAccounts`; sin lista no se exige), «Anular» pago con razón para el rol gv (verificar/rechazar sigue solo con `gv:verify`), concepto «Pago completo» (migración 202610310002 amplía el CHECK `gv_payment_concept_valid`).
- Producto: Fase 1 visual y bundle desplegados. Cierre 28-oct: vendido RD$ 68,500, cobrado 49,450, crédito 16,450, ganancia 31,220; cajas cuadradas.
- Seguimiento automático: una rutina cada 3 h (las otras tres, apagadas por costo).

## Decisiones
- **Nombre: Norexos** (N-O-R-E-X-O-S), confirmado por la dueña el 29-oct. Pendiente de dominios y abogado: registrar norexos.com (+ .ai/.app) a nombre de la dueña; búsqueda formal de marca en clases 9/35/42; vigilar NEXOROS (reg. EE. UU. 6458723) y Norexa; no usar «neroxos». Logo con N se conserva. Plan: `docs/marca/PLAN_CAMBIO_DE_NOMBRE.md`; rama `marca/cambio-nombre` desde `producto-nexora`; no desplegar hasta dominios y abogado; la tienda no se renombra sin decisión de la dueña.
- Web en español e inglés: `docs/coordinacion/PLAN_INTERNACIONAL_28OCT.md`. App animada: `docs/diseno/PLAN_APP_ANIMADA_29OCT.md`.
- Trabajo de ChatGPT pasa a Claude PC + modelo local (`docs/coordinacion/COLA_LOTE_LOCAL.md`, rama `nexora1/cola-lote-local`); ChatGPT vuelve el 2-nov.

## Pendiente
- Dominios y abogado de Norexos (dueña). Botón «Cambiar fecha/curso» en inscripciones de GV (la API ya mueve de curso) y sistema de tickets/solicitudes. Asistente de IA dentro de GV solo con datos de GV; límites por plan sin definir.
- Procesador de pagos (Azul recomendado); tienda B-01/PC-23/A1 con decisión escrita; AT-06; relevo de despliegues cuando expire la sesión de Nexora 1.
- Para revisar del 28-oct: transferencias sin verificar con ref. «1111» (FS-0000316 a 319 y 322), descuentos aprobados por la misma vendedora (FS-0000323 de 38 %), anulación pendiente de FS-0000165.
