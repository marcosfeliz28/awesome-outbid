# ESTADO · Investigación «versión potente» (14-nov-2026) — DETENIDA tras fase 3

## Hecho (fases 1–3, todo subido a `investigacion/potente-14nov`)
- Fase 1: 6 agentes sonnet → `01_EMPRESAS_A…F` + 20 capturas en `capturas/`.
- Fase 2: 2 agentes opus → `02_TABLA_EMPRESAS.md` (25 empresas distintas; ≥ 20 confirmadas).
- Fase 3: 1 agente opus → `03_CRUCE_NOREXOS.md` (citas archivo:línea abiertas por el agente).

## Gasto aproximado de tokens de agentes
Fase 1 ≈ 735k · Fase 2 ≈ 290k · Fase 3 ≈ 163k → **≈ 1.19 M de 2 M** (más ~100k de esta sesión). Quedan ≈ 0.7 M para las fases 4–5.

## Qué quedó sin comprobar
- Ninguna pantalla real de caja/panel de ninguna empresa: solo páginas públicas de marketing (el diseño viene de portadas; Odoo, QuickBooks, Zettle y Mercado Pago sin captura).
- PIN, 2FA, auditoría y «qué ve la cajera» casi sin fuente en la mayoría; NCF/e-CF ninguna global lo publica (solo Odoo/Alegra/Nexprint con matices).
- Lista oficial DGII de proveedores (403): Alegra vía Alanube solo por terceros; Facturapp NO es proveedor autorizado según su propia página. Aviso 06-26 no leído.
- Conflictos de precio sin resolver: Treinta, Vendty, Siigo POS, QuickBooks, Mercado Pago, RestaurantOS, Square EE. UU. (bloqueado), Zettle EE. UU.
- Norexos: nada visto en pantalla (app no ejecutada); no se confirmó que este árbol sea igual a `nexora-cloud`; 606/607 y categoría DGII de MacGen/GV sin revisar. Perplexity no conectado; WebSearch solo EE. UU.

## Qué haría en la fase 4 (solo con luz verde)
3 agentes opus (~150k c/u): (1) comodidad + IA útil + facilidad para empleadas nuevas; (2) estética actual y avanzada (la más extensa, con descripción clara de cómo se vería) + privacidad/acceso; (3) administración bilingüe + producto vendible + cumplimiento dominicano (e-CF, plazo 15-nov-2026). Cada propuesta: competidores con fuente, Norexos hoy (archivo:línea), propuesta, esfuerzo P/M/G, si toca dinero, cómo comprobarla. Fase 5: `PROPUESTA_VERSION_POTENTE.md` con 10–15 decisiones para la dueña. Costo estimado ≈ 0.5–0.6 M, dentro del tope.

**Espero luz verde de la dueña o de Norexos 1. No sigo a la fase 4 sin ella.**

---
# ACTUALIZACIÓN FINAL (14-nov-2026) — fases 4 y 5 hechas, DETENIDO

Luz verde recibida de la sesión «Norexos 1 · Software» (verificada por título/repo vía get_session).

## Entregado
`04a_COMODIDAD_IA_NUEVAS.md` (19 propuestas) · `04b_ESTETICA_PRIVACIDAD.md` (14 de estética + 6 de privacidad) · `04c_BILINGUE_VENDIBLE_RD.md` (18) · **`PROPUESTA_VERSION_POTENTE.md`** (57 propuestas citadas, 15 decisiones para la dueña).

## Gasto real final de tokens de agentes
Fases 1–3 ≈ 1.19 M · Fase 4 ≈ 0.49 M (152k+163k+175k) · Fase 5 ≈ 0.18 M → **≈ 1.86 M de 2 M** (más el consumo propio de esta sesión, pequeño). Dentro del techo; no se usó «fable».

## Avisos
- e-CF 15-nov-2026 = HALLAZGO a confirmar con la contable (lista DGII dio 403; grupo DGII de MacGen/GV sin confirmar).
- 04a corrige al 03: la caja SÍ muestra ventas sin conexión pendientes (`App.tsx:1124-1149`).
- Árbol: `apps/` y `packages/` idénticos a `origin/nexora-cloud` (ed5826f) — comprobado con git diff vacío; algunos agentes citaron el commit e959914 (rama de trabajo, solo docs distintas).
- 3 propuestas repetidas entre documentos (COM-01≈VIS-04, COM-04≈RD-05, COM-05≈PRIV-03).
- Nada visto en pantalla; las 20 capturas son páginas de marketing (8 de ellas no reabiertas en fase 4). No se abrieron ramas chatgpt-*.
- Nada de esto autoriza construir.
