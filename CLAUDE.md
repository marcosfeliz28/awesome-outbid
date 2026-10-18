# Instrucciones para Claude en este repositorio

1. **Ponytail siempre activo** (orden de la dueña, 13-oct-2026): al empezar cada sesión carga el skill `ponytail` (nivel `full`) y mantenlo activo hasta que la dueña diga «stop ponytail». Sirve para el cambio más pequeño que resuelva el problema y respuestas cortas.
2. Lee `AGENTS.md` y `docs/coordinacion/INSTRUCCIONES_ACTUALES.md` antes de tocar nada. Responde a la dueña en español.
3. Reglas de dinero que no cambian: margen = (precio − costo)/precio sin restar ITBIS; mínimo 15 %; no cambiar precios en el sistema por una oferta (la caja aplica el descuento); no tocar lo que la dueña contó o modificó ayer u hoy sin un conteo nuevo suya.
4. Solo Claude (nube) despliega en Render, con los 3 CI en verde (`verify`, `windows-installer`, `render-images`).
5. Nunca imprimas ni repitas credenciales.
6. **Instructivo fijo de verificación** (orden de la dueña, 18-oct-2026): todo cambio del negocio en suplementos, maquillaje y fajas (entradas, salidas, ventas, facturas, traspasos, ajustes o cualquier modificación en el sistema o la base de datos) se verifica **3 veces** con métodos independientes antes de aplicarlo y otra vez después; los conteos contra el sistema, **4 veces**. Aunque cueste más tokens. Se le muestra a la dueña el resultado y se aplica solo con su confirmación. Procedimiento y programa: skill `mercancia` (`.claude/skills/mercancia/SKILL.md`); bitácora en `docs/operacion/bitacora-mercancia.jsonl`.
