# Plan de la noche · Claude PC · 27-oct-2026

Para que Marcos lo lea cuando termine todo. Estado a las 7:05 p. m. RD.

## Quién hace qué
- **Nexora 1 (cerebro):** levantamiento completo, autoauditoría y backlog delegable (pedido en RESPUESTA_CLAUDE_PC_27OCT.md). Única que despliega y mezcla en producto-nexora y nexora-cloud.
- **Claude PC (esta sesión):** revisa cada 15 minutos, reporta a Nexora 1, abre sesiones ChatGPT solo para tareas que no choquen, y toma el mando si un chat se queda parado.
- **ChatGPT PC:** dos hilos. «Corrige CI de Fase 0» (visual-integracion-27oct, 2a0beec6 con regresión de Mercancía) y un chat nuevo (chatgpt-pc/mercancia-salida-fix, desde producto-nexora 78888542).
- **ChatGPT nube:** integra at11 sobre at04 (at04 a68fd008 integra limpio sobre producto; fase3 y fase4 ya están en producto).

## Ramas y estado
| Rama | Commit | Estado |
|---|---|---|
| claude-pc/pc23-anulacion-fix | c1fe8c0 | LISTA, en producto-nexora |
| claude-pc/a1-formula-utilidad | 498df5ee | LISTA, en producto-nexora |
| claude-pc/b01-ventas-caja-ciega | 0500b03a | LISTA, en producto-nexora |
| claude-pc/itbis-una-regla | 1a04cd33 | LISTA, en producto (en vivo) |
| claude-pc/b01-tienda | e9ce12e0 | LISTA (CI verde), sin mezclar |
| claude-pc/auditoria-visual | be96c112 | Auditoría de visual-integracion |
| claude-pc/at06-diseno | df961eaf | Diseño AT-06, espera decisiones de Marcos |
| claude-pc/qa-bajos | (en curso) | Bajos del QA, agente |
| chatgpt-pc/visual-integracion-27oct | a9bedbde verde / 2a0beec6 rojo | Regresión Mercancía |
| chatgpt-pc/mercancia-salida-fix | (en curso) | Chat nuevo de ChatGPT PC |
| chatgpt-nube/at04-ruta-320 | a68fd008 | Verde, integra limpio |
| chatgpt-nube/at11-postgres-estable | f3c57f1d | Verde, choca con at04 en vitest.config.ts |
| chatgpt-nube/fase3-puerta-producto, fase4-marca-producto | 305fb0ab, 1b2c2318 | Verdes, ya en producto-nexora |

## Decisiones que son de Marcos (o de la dueña)
- AT-06: identidad por persona (D1 a D8 en claude-pc/at06-diseno).
- Recibo PDF al cobrar (B-01): que salga completo o no.
- Mezcla de visual-integracion-27oct sobre producto: espera regresión y decisión de Nexora 1.
- Textos a ChatGPT: Nexora 1 los deja por escrito; yo los envío solo con el «sí» de Marcos en este chat.

## Límites que no cambian
No desplegar; no tocar Render ni producción; no mezclar en producto-nexora ni nexora-cloud; sin credenciales; no instalar OmniRoute, Headroom ni claude-mem; no borrar de forma permanente.
