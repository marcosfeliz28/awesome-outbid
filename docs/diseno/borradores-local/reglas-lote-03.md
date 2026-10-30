1. Si se rechaza una `pending_verification`, entonces solo se rechaza una (`sales.ts:2911`).
2. Si el código no existe, entonces se ofrece **«Crear producto rápido»**: Nombre, Categoría, Código de barras, Precio de venta… (`:1444-1500`). Un código repetido en dos productos no elige ninguno en silencio (`:99-109`).
3. Si solo `*` (administración) ve **«Traspasar mercancía»**, entonces «El movimiento resta del origen y suma al destino en una sola operación.» Se elige el producto, se pulsa **«Traspasar»** y se llena la ventana **«Traspasar · producto»**: **Desde**, **Hasta**, **Cantidad** (3 decimales), «Lote (si aplica)», **Motivo** (mín. 3 letras) (`:113-205`).
4. Si cobra créditos, entonces solo cobra créditos **en efectivo** (`apps/api/src/sales.ts:4190-4195`). Pide anulaciones; no las ejecuta.
5. Si es «GV Makeup Studio», entonces solo tiene acceso a cursos, citas, interesadas, por verificar sin poder verificar, reportes. Sin acceso a configuración, usuarios, costos, inventario ni datos de MacGen. No carga el catálogo de la caja (`apps/web/src/realtime.tsx:147-153`).

Qué hice: Reescribí las reglas como frases «Si … entonces …» de máximo 25 palabras, conservando las citas al final de cada frase.

Qué NO comprobé: No revisé ningún archivo adicional ni verifiqué el contenido de los archivos mencionados.