# Manual corto para la cajera (verificado)

Fuente: `apps/web/src/POS.tsx`, `apps/web/src/Management.tsx`, `apps/web/src/App.tsx` y `apps/api/src/admin.ts` de `origin/nexora-cloud`. Respuestas con cita en `docs/sistema/RESPUESTAS_A_TALLER.md`.

1. **Entrar:** usuario y contraseña, botón «Entrar a mi tienda» (`App.tsx:468`, `:512`). La cajera llega sola a **Punto de venta** (`App.tsx:733-740`).
2. **Abrir la caja:** menú **Caja** › **«Abrir caja»** › escribir **«Efectivo inicial»** › confirmar (`Management.tsx:1673-1677`, `:2015-2055`). Sin caja abierta, el POS no deja cobrar: «Abre tu caja antes de cobrar.» (`POS.tsx:523`).
3. **Elegir cliente:** presiona **F4** (`POS.tsx:1048`, `:567`).
4. **Agregar artículos:** un clic en la **tarjeta del producto** (no hay botón «Agregar») (`POS.tsx:1543`). También el buscador (F2), el lector de código y la cámara (`POS.tsx:904-919`, `:2993`).
5. **Cantidad:** botones **+** y **−** de la línea del carrito (`POS.tsx:1086-1106`).
6. **Descuento global:** campo **«Descuento global»** (`POS.tsx:1187`).
7. **Ver subtotal y total:** **«Subtotal»** (`POS.tsx:1183`) y **«Total a cobrar»** (`POS.tsx:1215`).
8. **Cobrar:** botón **«Cobrar»** o **F12** (`POS.tsx:1232`, `:1233`). Se abre **«Todo listo para cobrar»** (`POS.tsx:1224-1234`).
9. **Elegir método de pago:** **Efectivo**, **Dólares (US$)**, **Tarjeta**, **Transferencia**, **Nota de crédito**, **Contraentrega**, **Crédito** (`POS.tsx:2536-2548`). Después **«Agregar pago»** y, para terminar, **«Finalizar venta»** (`POS.tsx:2817-2824`, `:2927-2941`).
10. **Transferencia:** en **«Cuenta donde cayó»** elegir la cuenta de la lista y escribir la **«Referencia»** (`POS.tsx:2776-2816`). Tarjeta: **«Últimos 4 dígitos»**, **«Número de aprobación»**, **«Marca»** y **«Tipo de tarjeta»** (`POS.tsx:2705-2775`).
11. **Confirmar la venta:** aparece **«¡Una venta más, una meta más cerca!»** con el número FS-… y el aviso «Venta registrada» (`POS.tsx:2336-2379`).
12. **Solicitar NCF:** elegir **«Solicitud de NCF»** (`POS.tsx:2583`); tipo **B01 · Crédito fiscal** o **B02 · Consumidor final** (`POS.tsx:2589-2590`).
13. **Nota de crédito:** se crea al devolver una venta; **no se imprime sola**. Para imprimirla: **Ventas** › abrir la venta › **«Imprimir nota NC-…»** (`Management.tsx:3390-3404`). Sale un PDF A4 con el «Código para presentar en caja» (`apps/api/src/sales.ts:3469-3522`).
14. **Imprimir el recibo:** en la ventana de la venta, **«Imprimir recibo»** (`POS.tsx:2381-2384`). Hay también **«Recibo PDF»**, **«WhatsApp»**, **«Correo»** y **«Nueva venta»** (`POS.tsx:2385-2430`).

## Nota sobre la impresión automática
- Si en Configuración está activa **«Imprimir el recibo automáticamente al cobrar»** (`Management.tsx:4031-4032`), el recibo sale solo. De fábrica está **apagada** (`apps/api/src/admin.ts:123`).
- No se sabe si la tienda la tiene activada hoy: se revisa en **Configuración**. Este manual no lo afirma.
