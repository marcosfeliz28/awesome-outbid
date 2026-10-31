# Respuestas a las preguntas de Taller

Rama `cola-n26` (= `nexora-cloud`, la tienda en vivo). Cada respuesta lleva su cita `archivo:línea`. Las preguntas 10 y 11 (dominio y correo) se omiten a propósito: las decide la dueña.

---

## 1. ¿Cómo abre la cajera el POS / la caja al empezar?

Son **dos pasos en dos pantallas**:

1. **Entrar**: usuario y contraseña, botón **«Entrar a mi tienda»** (`apps/web/src/App.tsx:466`, `:512`). Una cajera (`seller`) no tiene permiso de «Resumen» ni de «Mercancía», así que el sistema la lleva sola a **«Punto de venta»**, la primera pantalla del menú que sí puede ver (`apps/web/src/App.tsx:731-738`; permisos de `seller` en `packages/shared/src/index.ts:782`).
2. **Abrir la caja**: menú lateral › **Caja** › botón **«Abrir caja»** (o «Abrir mi caja» en el centro) › en la ventana **«Abrir mi caja»** escribe **«Efectivo inicial»** (el sistema sugiere lo que ella misma dejó al cerrar la última vez) › confirma (`apps/web/src/Management.tsx:1673-1677`, `:1738-1745`, `:2015-2055`). Si el fondo es menor que lo sugerido debe escribir **«Nota si el fondo es menor que el sugerido»** (`:2029-2039`).
3. Desde el Punto de venta, si no hay caja abierta, aparece el enlace **«Abre tu caja para comenzar»** que lleva a Caja (`apps/web/src/POS.tsx:1218-1221`), y el estado dice «Caja sin abrir» → «Caja abierta» (`:1024-1028`). Intentar cobrar sin caja: «Abre tu caja antes de cobrar.» (`:523`).

No hay "abrir POS" aparte: el Punto de venta se usa directamente, pero **no deja cobrar sin caja abierta**. Una persona solo puede tener una caja abierta (`apps/api/src/cash.ts:893-908`). Detalle: `FLUJO_CAJA_POS.md` §1.

---

## 2. ¿Cómo agrega un artículo al carrito? ¿Existe un botón «Agregar»?

- **NO existe un botón «Agregar».** Se agrega con **UN CLIC en la tarjeta del producto** en el catálogo: la tarjeta entera es un botón con `onClick={() => onAdd(p)}` (`apps/web/src/POS.tsx:1543`). El «+» que se ve en la esquina de la foto es solo un adorno dentro de ese mismo botón (`:1565-1567`).
- Si el producto tiene una sola variante, entra directo al carrito con cantidad 1; si tiene varias, se abre una ventana «Elige la combinación para esta venta.» y se pulsa la variante (`:425-430`, `:1284-1314`).
- Otras dos formas: **buscador** («Código o nombre del producto», F2; Enter agrega el producto si es único o el código exacto) (`:904-919`, `:815-853`) y **lector de código de barras / cámara** (`:776-813`, `:949-955`, `:2993`).
- Para más de una unidad: botones **+** y **−** de la línea del carrito (`:1086-1106`) o repetir el clic.
- Una tarjeta sin existencia está desactivada («Agotado») salvo que Configuración permita stock negativo (`:1551-1563`).

Detalle: `FLUJO_CAJA_POS.md` §3.

---

## 3. ¿Cuáles son los métodos de pago y en qué pantalla se eligen?

- **Pantalla:** en el Punto de venta, botón **«Cobrar»** (F12) abre la ventana **«Todo listo para cobrar»** (`apps/web/src/POS.tsx:1224-1234`, `:2438`). Ahí se elige el método, se escribe el monto y se pulsa **«Agregar pago»**; se pueden combinar varios y al final **«Finalizar venta»** (`:2535-2574`, `:2817-2824`, `:2927-2941`).
- **Botones exactos** (`:2536-2548`): **Efectivo**, **Dólares (US$)**, **Tarjeta**, **Transferencia**, **Nota de crédito**, **Contraentrega**, **Crédito**. Además el atajo **«Vender a crédito (queda pendiente)»** (`:2466-2473`).
- Crédito y Contraentrega usan el mismo método interno `cod`; cambia solo la etiqueta (`:2542-2548`, `:2071`).
- En el historial «Ventas» y en reportes de cobros posteriores (abonos) solo hay tres métodos: Efectivo, Tarjeta, Transferencia (`apps/web/src/Management.tsx:229-233`).

---

## 4. ¿Elige cuenta/banco en transferencia o tarjeta? ¿Cuál es el nombre visible?

- **Transferencia:** sí. Campo **«Cuenta donde cayó»**, una **lista desplegable** («Elige la cuenta…») con las cuentas que la administración cargó en Configuración › «Cuentas de banco para transferencias (una por línea)». Si esa lista está vacía, se escribe el banco a mano. Además **«Referencia»** (obligatoria) (`apps/web/src/POS.tsx:2776-2816`; lista en `:2023`; campo de Configuración `apps/web/src/Management.tsx:4046-4054`). En la base el valor se guarda en `Payment.bank` (`apps/api/prisma/schema.prisma` modelo `Payment`) y el servidor exige banco y referencia (`apps/api/src/sales.ts:996-997`).
- **Tarjeta:** pide **«Últimos 4 dígitos»**, **«Número de aprobación»**, **«Marca»** (Visa/Mastercard/Amex) y **«Tipo de tarjeta»** (Crédito/Débito); y, si Configuración tiene lista de «Terminales de tarjeta», un campo **«Terminal»** obligatorio («Elige el terminal…») (`apps/web/src/POS.tsx:2705-2775`, lista `:2024`). El terminal elegido se guarda también en `bank` (`:1970-1971`).
- **Los nombres de los bancos y terminales** (lo que ve la cajera en la lista) **no están en el código**: son datos de Configuración. NO ENCONTRADO en el código; hay que mirar Configuración › Negocio y reglas › Editar configuración, o `GET /settings` entrando con `entrar.py`. (En GV se agrupan en «Grupo Génesis» y «Grupo Macgen» según si el nombre contiene «génesis»: `apps/web/src/Gv.tsx:801-814`.)

---

## 5. La nota de crédito: ¿se imprime, cómo y dónde?

- Una nota de crédito nace al **devolver** una venta con método de reembolso **«Nota de crédito»** (Ventas › fila › **«Devolver»**, solo `sale:manage`, con caja propia abierta) (`apps/web/src/Management.tsx:3296-3319`, `:3639-3690`). El número de la devolución es **NC-000000** (`apps/api/src/sales.ts:3350`).
- **No se imprime sola al devolver.** Se imprime a mano: **Ventas** › abrir la venta (ícono del ojo) › botón **«Imprimir nota NC-…»** (solo `sale:manage`) (`apps/web/src/Management.tsx:3390-3404`).
- Lo que sale es un **PDF tamaño A4** (no ticket térmico): «Nota de crédito · NC-…», «Nota interna de crédito · no fiscal», fecha, importe, saldo, motivo y el **«Código para presentar en caja»** (32 caracteres) con las condiciones de uso (`apps/api/src/sales.ts:3469-3522`, ruta `GET /returns/:id/credit-note.pdf`). Se descarga y se imprime desde el visor de PDF.
- Para usarla después: en el cobro, método **Nota de crédito**, escribir el código y elegir la nota (`apps/web/src/POS.tsx:2610-2654`). Si la cajera no escribe el código, necesita el PIN de un gerente (`:1872-1884`).

---

## 6. Al finalizar la venta, ¿el comprobante se genera/imprime solo? ¿Cuál es el paso exacto?

- **Se genera solo** en el momento de «Finalizar venta»: aparece la ventana **«¡Una venta más, una meta más cerca!»** con el total, el número **FS-0000123**, el aviso «Venta registrada» y el cambio (`apps/web/src/POS.tsx:2336-2379`). El recibo ya está armado en esa ventana (`:2431-2433`, `InvoicePrint`).
- **Se imprime solo únicamente si** en Configuración está activa la opción **«Imprimir el recibo automáticamente al cobrar»** (`apps/web/src/Management.tsx:4031-4032`; `apps/web/src/POS.tsx:2267-2268`). De fábrica está **apagada** (`apps/api/src/admin.ts:123`, `default(false)`). **DUDOSO:** no se sabe si la dueña la activó en producción; se ve en Configuración.
- Si está apagada, el paso exacto es: en esa ventana pulsar **«Imprimir recibo»** (`:2381-2384`), que abre el diálogo de impresión del navegador (`window.print()`). También hay **«Recibo PDF»**, **«WhatsApp»**, **«Correo»** y **«Nueva venta»** (`:2385-2430`).
- El recibo es **«DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL»**; no lleva NCF salvo que la venta ya lo traiga y el modo sea electrónico (`apps/web/src/Prints.tsx:509-510`, `:546-553`). Ancho 80 o 58 mm según Configuración (`apps/api/src/admin.ts:91`).
- Para reimprimir luego: menú **Ventas** › ícono de descarga (PDF) de la fila (`apps/web/src/Management.tsx:3247-3257`).

---

## 7. ¿Cómo se llama la sección de citas en el menú de GV?

- En el menú lateral solo hay **un** ítem: **«GV Makeup Studio»** (`apps/web/src/App.tsx:282`). Dentro de esa pantalla (título «Cursos y cobros») hay pestañas: **«Cursos»**, **«Citas»**, **«Interesadas»**, **«Por verificar»** y **«Reportes»** (`apps/web/src/Gv.tsx:122`, `:129-174`).
- La sección de citas se llama **«Citas»** (`apps/web/src/Gv.tsx:147`). Al abrirla, el botón es **«Nueva cita»** y los estados son Agendada, Realizada, Cancelada, Reembolsada (`apps/web/src/GvCitas.tsx:109-119`, `:54-59`).

---

## 8. ¿La tabla de inscripciones de GV muestra PRECIO, PAGADO y PENDIENTE?

**Sí, las tres.** Columnas de la tabla de inscripciones de un curso, en orden: `CLIENTA`, `TELÉFONO`, **`PRECIO`**, **`PAGADO`**, **`PENDIENTE`**, `ESTADO`, `ASISTIÓ`, `SET` y una columna de acciones («Pago», «Editar») (`apps/web/src/Gv.tsx:385-393`; datos `:404-411`).

- PRECIO = precio acordado de esa inscripción. PAGADO = solo lo **verificado** (si hay transferencias sin verificar se agrega «(RD$ X por verificar)»). PENDIENTE = precio − pagado, nunca negativo (`apps/api/src/gv-money.ts:158-180`).
- Las **citas** no son tabla: son tarjetas con «Total … · Pagado … · Pendiente …» (`apps/web/src/GvCitas.tsx:153-160`).

---

## 9. ¿Existen «Primeros pasos» y «Plan y facturación» en nexora-cloud (App.tsx) o solo en producto-nexora?

**Solo en `producto-nexora`. No existen en `nexora-cloud`.**

- En esta rama (`nexora-cloud`) la lista del menú tiene 18 ítems y ninguno se llama «Primeros pasos» ni «Plan y facturación» (`apps/web/src/App.tsx:194-283`; búsqueda del texto en `apps/web/src`: sin resultados).
- En `producto-nexora` sí: «Primeros pasos» (`id: "onboarding"`) en `apps/web/src/App.tsx:245` y «Plan y facturación» (`id: "billing"`, permiso `*`) en `:249`. Leído con `git show origin/producto-nexora:apps/web/src/App.tsx` (rama del producto multiempresa; no es la tienda).
- Dato extra: esa rama del producto no tiene el ítem «GV Makeup Studio» en el menú (solo el cubo de la pantalla de entrada), según la misma lectura.

---

## 10-11. Omitidas

Dominio y correo: decide la dueña.
