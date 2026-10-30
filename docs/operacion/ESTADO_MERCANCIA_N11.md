# Estado Mercancía — Norexos 11 (30-oct-2026)

**Estado: ESPERANDO el traspaso.** `origin/claude/traspaso-mercancia` no existe aún (comprobado con `git fetch` y `git ls-remote`, 30-oct). No invento su contenido.

## Ya leído
CLAUDE.md, AGENTS.md, skills (mercancia, informe-triple, ordenes-duena, pensar-antes, base-sistema), `docs/sistema/README.md`, bitácora.

## Bitácora (comprobación parcial, sin traspaso)
- 312 líneas, todas JSON válidas, 18-oct 16:46 → 30-oct 09:00 (RD).
- Tipos: entrada 110, nota 71, conteo 64, traspaso 38, salida 27, correccion_metodo_pago 1, cierre_caja 1.
- Hueco de formato: las líneas 293 (corrección FS-0000312 cash→card, 27-oct) y 294 (cierre de caja Wendy 75AA, 27-oct) no tienen `id`, `orden` ni `cuando_rd` (usan `fecha`, `nota`). Sin frase exacta de la dueña.
- «Completa» contra el traspaso: NO comprobado (falta el traspaso).

## Pendiente
(a) Qué está hecho, (b) pendientes y dueño, (c) huecos, (d) lo no comprobado: se llenan al llegar el traspaso.
No toqué datos de mercancía, cobros ni cajas. No desplegué.
