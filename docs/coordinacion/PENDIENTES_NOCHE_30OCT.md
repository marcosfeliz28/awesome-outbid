# Pendientes de la noche (30-oct-2026) — lista viva de Norexos 1
Orden de la dueña: todo lo planeado se hace de principio a fin; si algo falla se arregla, y si no, se detiene ESA tarea y se vuelve cada hora. Skill `noche-autonoma`. Estados: HACER · EN CURSO · BLOQUEADA(motivo) · LISTA.

| # | Tarea | Quién | Estado | Siguiente paso |
|---|---|---|---|---|
| 1 | Herramientas de cobros (FS-328, FS-288, FS-304) | Norexos 2 | LISTA (30-oct 02:38 UTC) | Aplicados y en bitácora. Queda la nota 14 |
| 2 | T32 bug «Ver detalle del mes» (63128b91, rama claude/desglose-mes) | Taller | LISTA para CI | Esperar los 3 CI; auditar; mezclar en nexora-cloud; desplegar (autorizado) |
| 3 | T32 (pruebas de suma con devoluciones verdes, 8a259ea5; falta banco, línea/top 10 y mes anterior/siguiente) desglose por cobro/banco/línea + top 10 unidades y monto + mes anterior/siguiente | Taller | EN CURSO | Pruebas de suma con devoluciones (D-05); luego implementar |
| 4 | T33 IA de ventas en la tienda (solo lectura, tope 30/día, cajera solo lo suyo) | Taller | HACER (tras 3) | Rama claude/ia-ventas-linea desde nexora-cloud |
| 5 | Docs verificados de Taller (rama claude/taller-docs-verificados cf66ae14) | Taller/N1 | HACER | Verificar CI; mezclar en nexora-cloud |
| 6 | Landing inglés completa (rama claude/taller-landing-en 5a3f5fe5) | Taller/N1 | HACER | CI verde; mezclar en producto-nexora |
| 7 | Cola local N34–N41 y bloque 15 (NOCHE_CLAUDE_PC_30OCT.md) | Claude PC | EN CURSO | LISTA de claude-pc/cola-n-nueva 579e249e (docs): mezclar tras CI |
| 8 | Reparto local (REPARTO_LOCAL_PC.md de Claude PC) | N1 | HACER | Confirmar reparto en COLA_LOTE_LOCAL.md |
| 9 | Forja 3 resto (F3-01, F3-02, F3-04, F3-05) | fork | BLOQUEADA(no puedo escribirle) | Está en RESPUESTA_CLAUDE_PC orden 75; revisar su LISTA |
| 10 | Pedidos del Consultor (Norexos 6) | Consultor | EN CURSO | Repartir cada PEDIDO nuevo a Taller/Claude PC |
| 11 | Revisión diaria (reportes.py) | N1 | BLOQUEADA(faltan NEXORA_CLAUDE_USER/PASSWORD en el entorno) | La dueña debe configurarlas |
| 12 | Cambio de nombre Norexos en código (E1) | por asignar | HACER | Esperar decisiones de E3 de la dueña |
| 14 | Cuadre de Wendy tras FS-328: transferencia esperada 9,700 vs contada 2,200 (−7,500) y caja temporal de Claude con +2,600 tarjeta contada sin esperado | dueña | Espera conteo/decisión suya | No tocar lo contado sin conteo nuevo de la dueña (CLAUDE.md). Posible mejora: reporte con marca «ajustado» |
| 15 | Tildes: refinar scripts/tildes-nuevas.mjs (ignorar URLs/código) | Claude PC (fork) | EN CURSO: rama claude-pc/tildes-urls ef0c1b08 (43→6 hallazgos + prueba de 4 casos 4/4; CI pendiente) | Mezclar tras CI; si choca con claude/taller-bloque15 (mismo script), conservar la versión de tildes-urls y re-generar el informe |
| 16 | Bloque 15 canónico = claude/taller-bloque15; claude-pc/bloque15 y claude-pc/bloque15-norexos4 solo referencia | Taller | CI en curso (5b7fd6d2) | Mezclar en nexora-cloud con CI verde |
| 17 | Desglose del mes (renglones no cobrados, banco, top 10, mes ant./sig.) + T33 IA de ventas | Norexos 8 (session_01CjMpH4UeCp2AuCD8Jei7Bq) desde 06:39 UTC; Norexos 7 (session_01CjMpH5C7JcGB28H1vGM9qp) hizo el paso 1 (c91ae77d) y quedó bloqueado en un permiso de Send Message | EN CURSO: pasos 2–4 y T33 | Taller (Norexos 3) quedó BLOQUEADO desde 05:38 esperando permiso de «Send Message»; no puedo interrumpirlo (el clasificador lo negó). Cuando la dueña despierte: aprobar o descartar ese permiso en la sesión de Taller |
| 13 | Verificar si alguna sesión alcanza a Claude PC | N2/N5/Taller | HACER | Pregunta enviada |

## Decisiones de la dueña pendientes (no frenan el trabajo)
Dominio de la portada y casilla de soporte; qué es «la Lacto»; 4 decisiones E3; correo/banco de Mercancía (FS-24, 12 transferencias del 25-oct, 65 sin verificar = 242,540); countedCard de Lizbeth (117000 vs 11,700).

## Registro
- 30-oct 02:32 UTC: API y web de la tienda desplegados (e47a557d) con herramientas de cobros.
