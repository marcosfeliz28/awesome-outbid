# Orden para ChatGPT PC — Nexora POS como producto para vender (19-oct-2026)

**Quién:** ChatGPT PC (puedes usar tus agentes). **Qué entrega:** propuesta escrita con números, sin código. Tómate el tiempo necesario. La dueña te dará más información directamente.

## Lee primero
`AGENTS.md`, `CLAUDE.md`, el informe previo `git show origin/producto-saas:docs/producto-saas/INFORME_CAMINO_B.md` y `origin/producto-local` (3ad A). No repitas lo que ya está; amplíalo y corrígelo.

## Qué quiere la dueña
1. **Vender Nexora POS a otros negocios** con cobro mensual.
2. **Apps en Google Play y App Store** (celular/tableta): cómo publicarlas (Capacitor u otra vía), costos de cuentas de desarrollador, reglas de las tiendas sobre cobros (comisión de Apple/Google vs cobrar por fuera con tarjeta), y qué cambia en el código.
3. **Cobro**: Apple Pay / Google Pay y tarjeta (Stripe, Azul, CardNet u otros que operen en República Dominicana), facturación recurrente, impuestos (ITBIS) y cómo se suspende a quien no paga.
4. **Una IA de soporte para cada cliente** (como Claude hace aquí): qué modelo/proveedor, costo por conversación, cómo limitar respuestas por plan (cuotas), qué datos puede ver (solo los de ese cliente), cómo evitar que dé consejos peligrosos o toque dinero, y registro de todo.
5. **Base de datos en una nube que paguemos** (multi-cliente): una base por cliente o una compartida con separación por cliente; costo por cliente en Render u otra nube; copias de seguridad; seguridad y privacidad (Ley 172-13 de RD).
6. **Versión instalada en PC** que funcione sin internet y sincronice con nuestra nube cuando haya conexión: arquitectura, conflictos, licencias por equipo.
7. **Pedidos de cambios a la medida**: cómo se cotizan y cobran (paquetes de horas, tarifa), cómo se priorizan, y cómo no rompen a los demás clientes.
8. **Protección del negocio**: el código y la base deben ser privados; licencia propietaria; contratos/términos de servicio; marca.

## Números que debes calcular
- Costo mensual por cliente (nube, base, copias, correo/avisos, IA con su cuota, soporte) en 3 escenarios: 10, 50 y 200 clientes.
- Planes propuestos (ej. Básico / Pro / Premium) con precio en RD$ y US$, qué incluye cada uno, cuota de IA, y **margen** de cada plan (margen = (precio − costo)/precio; meta mínima 15 %, ideal mucho mayor en software).
- Costo de arranque (cuentas de desarrollador, legal, marca, adaptaciones de código para multi-cliente) y en cuántos meses se recupera.
- Competencia en RD y la región (precios reales con enlaces).

## Entrega
Rama `nexora-chatgpt-pc-saas`, archivo `docs/propuestas/PRODUCTO-SAAS.md`, con fuentes enlazadas. Al final: plan por fases (qué hacer primero, segundo, tercero) y las decisiones que la dueña debe tomar, con opciones concretas. Resumen de 5 líneas para la dueña. Sin datos reales de clientes ni credenciales. Claude revisa antes de construir nada.
