# Estado Mercancía — Norexos 11 (30-oct-2026)

Fuente: `origin/claude/traspaso-mercancia` @ `8b3303b`, `docs/operacion/TRASPASO_MERCANCIA_N2.md`. Leídos también: CLAUDE.md, AGENTS.md, 5 skills, `docs/sistema/README.md`, bitácora. **No toqué datos, cobros ni cajas. No desplegué. No entré al sistema.**

## (a) Entendido como hecho (según N2; comprobado en bitácora donde se indica)
- Cuadres 26–29-oct; 59 cajas, 0 abiertas al 30-oct 08:00 UTC (dicho por N2, **no comprobado** en el sistema).
- FS-312 cash→card 2,500; FS-77 cerrada; FS-8 anulada (prueba). En bitácora: sí (FS-312 y FS-8 con línea; FS-77 con 1 línea).
- Verificadas con constancia: FS-318, 308, 316, 317, 319, 322, 331, 332, 335, 337, 339, 341 → las 12 tienen al menos una línea en bitácora.
- 30-oct: FS-328 (cash→transfer 7,800), FS-288 (a «por verificar»), FS-304 (tarjeta a caja de Wendy; caja temporal 73d90ec9 +2,600) → en bitácora (`ajustes3010`, 09:00 RD).
- Entradas 28-oct Excel GP Store: 8 líneas = **57 u., cuadra** con N2.
- Incentivos Lizbeth, pago final de Fari, usuario de Clary, PIN: sin rastro en repo (borradores en scratchpad de N2, perdidos; PIN/usuario no se anotan por regla).

## (b) Pendientes y dueño (fuente: traspaso §Pendiente)
| # | Pendiente | Dueño |
|---|---|---|
| 1 | FS-336 Edilena 4,550 Banreservas: verificar («mañana») | dueña decide; yo propongo con evidencia |
| 2 | FS-24 5,650 BHD (Fari, 14-oct): falta estado BHD ···0015 13–15 oct | dueña (estado de cuenta) |
| 3 | 12 transferencias del 25-oct (20,550): falta estado Banreservas/Popular del 25-oct | dueña (estados) |
| 4 | 65 transferencias sin verificar = 242,540 (desde 11-oct) | yo recontar con `informe-triple`; dueña verifica |
| 5 | FS-341: depósito 3,000 asignado por supuesto (nota decía efectivo, dif. 150/400) | dueña confirma |
| 6 | Pasar cobros «efectivo» que fueron transferencia (como FS-328) — recordatorio en PENDIENTES-DUENA | N11 con orden de la dueña |
| 7 | countedCard Lizbeth 27-oct (117000 vs 11,700): cierre no editable, explicado; aviso en `PROPUESTA-AVISO-CIERRE-TARJETA.md` | Norexos 1 (código) si ella aprueba |
| 8 | Cuentas por cobrar (~12 crédito/COD): recalcular | N11 + dueña dice cuáles cobradas |
| 9 | Fari: pagar 5,775 o 6,975; regla de incentivo de cursos; contador por 5,650 | dueña |
| 10 | Terminal GV 8,200 (FS-340), Addison 13,900, Popular ···3620 GGVG SRL, FS-302 (100), Clary Excel/citas/reto GV | por definir con la dueña |

## (c) Huecos o dudas
- **Bitácora:** 312 líneas, JSON válidas (18-oct 16:46 → 30-oct 09:00). Líneas 293 (FS-312) y 294 (cierre Wendy 75AA) sin `id`, `orden` ni `cuando_rd` (sin frase de la dueña).
- Salidas (Isopure, ISO100 5 lb, creatina ON, vencidos) sin línea **por orden de la dueña** (traspaso). Esto choca con la regla 6 de CLAUDE.md; la orden de la dueña manda, pero no puedo verlo en su propia frase: confirmar con ella que sigue vigente.
- Sin línea propia del cierre de Wendy del 28-oct; FS-24 no aparece (sin cambios hechos).
- «Cierres de Wendy» en el traspaso: 26, 27 sin ventas, 28; en bitácora solo veo el cierre del 27.
- Dos «dueños» posibles de PENDIENTES-DUENA vs traspaso: no cruzados línea por línea.

## (d) No pude comprobar
- Estado vivo del sistema (cajas, existencias, estado de facturas): no entré (no me lo pidieron).
- Bitácora vs sistema línea por línea (N2 tampoco pudo).
- Cifras 242,540 / 65 / 20,550 / 8,200 / 13,900: copiadas del traspaso, sin releer.
- Que PENDIENTES-DUENA.md coincida con el traspaso.

Espero instrucciones.
