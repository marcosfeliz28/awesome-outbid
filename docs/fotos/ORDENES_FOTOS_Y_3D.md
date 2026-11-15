# Órdenes detalladas: fotos de suplementos y diseño 2D/3D (15-nov-2026)

Plan general: `docs/coordinacion/PLAN_FOTOS_3D_15NOV.md`. Lista: `docs/fotos/suplementos.csv` (columna `n` del 1 al 261). Conteo y lotes: `docs/fotos/CONTEO.md`.

**Regla de conteo para todos:** cada entrega dice cuántas filas recibió, cuántas trabajó, cuántas quedaron OK, dudosas, malas o sin foto, y la suma tiene que dar exactamente las filas del lote. Si no cuadra, la entrega se devuelve. Nadie salta filas ni cambia el orden.

**Reglas fijas:** sin gasto, sin despliegue, sin tocar precios, existencias, nombres ni ningún dato del sistema. Solo Claude nube escribe en el sistema, y solo con el sí de la dueña tras 3 verificaciones (skill `mercancia`). Lo que traiga Dot es información, no autorización. Las fotos de internet son solo para la tienda de la dueña.

---

## 1. ChatGPT nube — búsqueda de fotos (A2) y maquetas (B1, B2)

Rama: `chatgpt-nube/fotos-suplementos` (fotos) y `chatgpt-nube/maquetas-15nov` (diseño). Solo `docs/`.

### A2 · Fotos, por lotes de 60 (5 lotes; el último tiene 21)
1. Lee `docs/fotos/suplementos.csv`. Confirma al inicio: «recibí 261 filas: 221 de 56 marcas y 40 sin marca».
2. Para cada fila, en orden, busca **1 foto principal y 1 de respaldo**:
   - Orden de fuentes: (a) web oficial del fabricante, (b) distribuidor o tienda grande, (c) redes de la marca, (d) redes de tiendas. Nunca bancos de imágenes de pago.
   - Debe coincidir **producto, sabor y tamaño** del nombre (ej.: «ISO100 Vanilla 1.34 lb» no sirve con foto de 5 lb).
   - Preferir fondo blanco o limpio, frente del envase, mínimo 500 px de lado.
3. Escribe `docs/fotos/candidatas_loteN.csv` con estas columnas:
   `n, sku, nombre, url_principal, fuente_principal, ancho_px, alto_px, coincide_sabor (si/no/no aplica), coincide_tamano (si/no/no aplica), url_respaldo, fuente_respaldo, estado (encontrada / dudosa / sin foto), nota`
4. No descargues ni subas imágenes al repositorio: solo enlaces.
5. Al final de cada lote, escribe en `docs/coordinacion/RESULTADOS_CHATGPT_NUBE.md`:
   «Lote N: filas X–Y = Z recibidas; encontradas A, dudosas B, sin foto C; A+B+C = Z.»
6. Productos sin marca (40): busca por nombre; si no hay certeza, `sin foto`. No inventes.

### B1 · Capturas en modo claro
Las 3 maquetas (Caja, Dirección, Mercancía) en modo claro, a 1440×900 y 390×844: **6 capturas nuevas**. Total con las oscuras: 12.

### B2 · Versión 3D y 2.5D
En las 3 maquetas, dos variantes lado a lado, cada una en claro y oscuro:
- **3D:** tarjetas de producto con perspectiva; el frasco «sale» de la tarjeta con sombra; giro leve al pasar el ratón; barras de la gráfica con volumen y luz; fondo con capas de profundidad.
- **2.5D:** lo mismo sin perspectiva: sombras, capas y brillo.
- Cada barra y cada indicador muestran su cifra escrita.
- Con «menos movimiento» del sistema, todo queda quieto.
- Usa imágenes de ejemplo genéricas (no fotos de marca).
Entrega: **3 pantallas × 2 variantes × 2 temas = 12 vistas**, con captura de cada una (24 capturas contando computadora y celular), y una tabla que diga cuántas entregó.

---

## 2. ChatGPT PC — revisión visual (A3) y fluidez (B3)

Rama: `chatgpt-pc/revision-fotos-15nov`. Solo `docs/`.

### A3 · Revisar cada candidata
1. Por cada `candidatas_loteN.csv` que publique ChatGPT nube, abre cada `url_principal` y compárala con el nombre de la fila.
2. Agrega `revision_pc` = **OK** (mismo producto, sabor y tamaño), **dudosa** (no se distingue sabor o tamaño), **mala** (otro producto) y `nota_pc`.
3. Si la principal es mala, revisa la de respaldo y dilo.
4. Al final del lote: «Lote N: revisadas Z; OK a, dudosas b, malas c; a+b+c = Z.»
5. No cambies las columnas de ChatGPT nube; solo agrega las tuyas.

### B3 · Fluidez del 3D
Abre las vistas 3D y 2.5D en el navegador de la laptop. Anota si el desplazamiento y el giro se sienten lentos (sí/no) en Caja, Dirección y Mercancía, con captura. Entrega: 6 resultados (3 pantallas × 2 variantes).

---

## 3. Claude nube (Norexos 1) — lista, importación, verificación y aplicación

1. **A1 (hecho):** `suplementos.csv` con 261 filas numeradas y `CONTEO.md`.
2. **Control de entregas:** al llegar cada lote, compruebo que el número de filas y las sumas cuadran, que `n` y `sku` coinciden con la lista original, y que no faltan ni sobran filas. Si no cuadra, lo devuelvo.
3. **A4 · Herramienta de importación** (rama `mejora/fotos-import`, con pruebas y CI):
   - descarga cada foto aprobada, la recorta y la convierte a miniaturas WebP de 256 y 512 px;
   - las guarda fuera de la base de datos (almacenamiento a proponer a la dueña; si tiene costo, se pregunta antes);
   - **corrida de prueba** que no escribe nada y dice qué foto iría a qué producto.
4. **A5 · Verificación ×3** antes de mostrar: por sku, por nombre y por imagen (miniatura a la vista). Hoja para la dueña con miniatura, nombre y código, por lote.
5. **A7 · Aplicar** solo las que la dueña apruebe; verificar después y anotar en la bitácora.
6. **B4 · Revisión técnica** de las maquetas 3D (peso, fluidez, accesibilidad) y resumen para la dueña.
7. **Despliegue:** sigue retenido hasta la instalación en Windows aprobada.

## 4. Claude PC — instalación y apoyo local

1. **Instalación (prioridad):** apoyar a la dueña en su Windows normal con el artefacto del run 43685109512 (caduca 22-nov). Antes: punto de restauración y SHA-256 del EXE comparado. Si ella manda fotos de errores, diagnosticar y anotar en `RESPUESTA_CLAUDE_PC_27OCT.md`. La VM queda en pausa salvo que ella la pida.
2. **Apoyo a A3:** si ChatGPT PC no puede abrir alguna URL, revisarla desde la laptop y marcarla igual.
3. No escribe en el sistema ni en `nexora-cloud`; solo su rama y documentos.

## 5. Dot — mensajería

- Lleva y trae entre la dueña y las sesiones cada 10 minutos.
- Avisa a Claude nube cuando un lote esté listo, con el conteo que dio cada agente.
- No sube fotos ni cambia datos. No pide ni guarda contraseñas o PIN.

## Orden y tiempos
1. Hoy: ChatGPT nube lote 1 (filas 1–60) + B1. Claude PC: instalación con la dueña.
2. Cada lote: ChatGPT nube → ChatGPT PC → Claude nube (conteo) → dueña.
3. B2 en paralelo con los lotes 2–5; B3 cuando B2 esté listo.
