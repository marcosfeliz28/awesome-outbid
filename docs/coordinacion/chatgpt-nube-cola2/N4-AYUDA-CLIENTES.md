# N4 · Contenido de ayuda para clientes

**Estado:** ENTREGADO

**Fecha:** 2026-10-26 11:57 UTC

## Entrega

- Documento: `docs/producto/AYUDA_CLIENTES.md`.
- Incluye el contenido breve del botón **Ayuda** y exactamente 15 preguntas frecuentes para una dueña nueva.
- Cubre primera venta, apertura y cierre de caja, productos, cajeras, NCF opcional, crédito, PIN frente a contraseña y soporte.

## Verificación

Los nombres y pasos se contrastaron con `apps/web/src/App.tsx`, `POS.tsx`, `Management.tsx`, `Tienda.tsx` y la documentación vigente. Se comprobó que:

- cada venta necesita cliente y caja abierta;
- **Nuevo producto** no registra por sí solo una entrada de existencia;
- el NCF es una preparación opcional y no una emisión fiscal;
- el crédito queda en **Caja › Créditos pendientes**;
- contraseña y PIN cumplen funciones diferentes;
- la aplicación todavía no muestra un contacto fijo de soporte dentro de **Ayuda**.

Comprobaciones ejecutadas:

```text
pnpm exec prettier --check docs/producto/AYUDA_CLIENTES.md
All matched files use Prettier code style!

FAQ numeradas: 15
Signos de cierre de pregunta en el documento: 15
git diff --check: sin errores
```

No se cambió código, no se desplegó y no se tocó Render.
