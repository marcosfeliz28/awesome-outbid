# Pendientes de la noche (30-oct-2026) — lista viva de Norexos 1
Orden de la dueña: todo lo planeado se hace de principio a fin; si algo falla se arregla, y si no, se detiene ESA tarea y se vuelve cada hora. Skill `noche-autonoma`. Estados: HACER · EN CURSO · BLOQUEADA(motivo) · LISTA.

| # | Tarea | Quién | Estado | Siguiente paso |
|---|---|---|---|---|
| 1 | Herramientas de cobros (FS-328, FS-288, FS-304) | Norexos 2 | EN CURSO | Aplicar con 3 verificaciones + confirmación de la dueña; bitácora |
| 2 | T32 bug «Ver detalle del mes» (63128b91, rama claude/desglose-mes) | Taller | LISTA para CI | Esperar los 3 CI; auditar; mezclar en nexora-cloud; desplegar (autorizado) |
| 3 | T32 desglose por cobro/banco/línea + top 10 unidades y monto + mes anterior/siguiente | Taller | EN CURSO | Pruebas de suma con devoluciones (D-05); luego implementar |
| 4 | T33 IA de ventas en la tienda (solo lectura, tope 30/día, cajera solo lo suyo) | Taller | HACER (tras 3) | Rama claude/ia-ventas-linea desde nexora-cloud |
| 5 | Docs verificados de Taller (rama claude/taller-docs-verificados cf66ae14) | Taller/N1 | HACER | Verificar CI; mezclar en nexora-cloud |
| 6 | Landing inglés completa (rama claude/taller-landing-en 5a3f5fe5) | Taller/N1 | HACER | CI verde; mezclar en producto-nexora |
| 7 | Cola local N34–N41 y bloque 15 (NOCHE_CLAUDE_PC_30OCT.md) | Claude PC | EN CURSO | LISTA de claude-pc/cola-n-nueva 579e249e (docs): mezclar tras CI |
| 8 | Reparto local (REPARTO_LOCAL_PC.md de Claude PC) | N1 | HACER | Confirmar reparto en COLA_LOTE_LOCAL.md |
| 9 | Forja 3 resto (F3-01, F3-02, F3-04, F3-05) | fork | BLOQUEADA(no puedo escribirle) | Está en RESPUESTA_CLAUDE_PC orden 75; revisar su LISTA |
| 10 | Pedidos del Consultor (Norexos 6) | Consultor | EN CURSO | Repartir cada PEDIDO nuevo a Taller/Claude PC |
| 11 | Revisión diaria (reportes.py) | N1 | BLOQUEADA(faltan NEXORA_CLAUDE_USER/PASSWORD en el entorno) | La dueña debe configurarlas |
| 12 | Cambio de nombre Norexos en código (E1) | por asignar | HACER | Esperar decisiones de E3 de la dueña |
| 13 | Verificar si alguna sesión alcanza a Claude PC | N2/N5/Taller | HACER | Pregunta enviada |

## Decisiones de la dueña pendientes (no frenan el trabajo)
Dominio de la portada y casilla de soporte; qué es «la Lacto»; 4 decisiones E3; correo/banco de Mercancía (FS-24, 12 transferencias del 25-oct, 65 sin verificar = 242,540); countedCard de Lizbeth (117000 vs 11,700).

## Registro
- 30-oct 02:32 UTC: API y web de la tienda desplegados (e47a557d) con herramientas de cobros.
