Borrador sin verificar, hecho por Claude (sesión Norexos 4, Revisor) porque el modelo local no está disponible en esta sesión. Fuente: `docs/sistema/FLUJO_MERCANCIA.md`. Tarea N39. Cada casilla lleva su cita o la regla escrita en la entrada. Aplica a suplementos, maquillaje y fajas.

# Lista de comprobación de mercancía (entradas, salidas, traspasos y ajustes)

- [ ] **1. Regla madre:** todo cambio se verifica **3 veces con métodos independientes antes y después**; los conteos contra el sistema, **4 veces**; se le muestra a la dueña y se aplica **solo con su confirmación**. (`CLAUDE.md` punto 6, citado en entrada §0)
- [ ] **2. Buscar antes de actuar** en la bitácora y en el historial del producto (`python3 mercancia.py buscar <producto>`). (entrada §6, paso 1)
- [ ] **3. Identificar el SKU exacto**; si el nombre puede ser dos productos (p. ej. Carnivor Mass 5.83 lb vs Shred 3.8 lb), preguntar. (entrada §6, paso 2)
- [ ] **4. Plan sin aplicar:** mostrar «antes → después» con la frase exacta de la dueña (`--orden`). (entrada §6, paso 3)
- [ ] **5. Entrada:** cada línea con cantidad, **costo unitario (obligatorio, mayor que 0)**, y lote y vencimiento si la categoría lo pide; no se recibe mercancía vencida. (entrada §2.1; `apps/web/src/Merchandise.tsx:1060-1220`; `apps/api/src/merchandise.ts:632`)
- [ ] **6. Entrada:** si el total no coincide con la factura, revisar líneas, flete e impuestos y confirmar la diferencia antes de pulsar **«Confirmar entrada»**. (`apps/web/src/Merchandise.tsx:1262-1278`, `:1297-1310`)
- [ ] **7. Salida:** elegir el **motivo** (Merma, Dañado, Vencido, Muestra o probador, Uso interno, Devolución a proveedor) y, si hay lotes, el «Lote de salida»; la devolución a proveedor exige proveedor y referencia. (`apps/web/src/Merchandise.tsx:73-80`, `:782-809`, `:1185-1215`)
- [ ] **8. Tipo correcto:** una merma real no se registra como «conteo»; los tipos son `conteo`, `entrada`, `salida`, `regalo` y `ajuste`. (`.claude/skills/mercancia/SKILL.md:27-29`)
- [ ] **9. Casa:** solo se mueve con instrucción expresa de la dueña y **cada salida dice su destino** (regalo a X / traspaso a Tienda). (`.claude/skills/mercancia/SKILL.md:33`)
- [ ] **10. Traspaso Casa↔Tienda:** solo administración (`*`); desde, hasta, cantidad, lote si aplica y motivo; resta del origen y suma al destino en una sola operación. (`apps/web/src/WarehousesPanel.tsx:113-205`; `apps/api/src/warehouses.ts:112-300`)
- [ ] **11. Ajuste o conteo:** el ajuste lleva «Motivo» obligatorio; un conteo no cambia la existencia hasta que un gerente pulsa «Aprobar ajuste». Si el stock cambió desde el conteo, se vuelve a contar. (`apps/web/src/Management.tsx:985-1010`, `:1018-1090`; `apps/api/src/inventory.ts:1550-1620`)
- [ ] **12. Después de aplicar:** leer la existencia de nuevo por 3 o 4 caminos y, si algo no cuadra, **detenerse y no forzar**; guardar la bitácora con la frase exacta. (entrada §6, pasos 4 y 7)

No tocar lo que la dueña contó o modificó ayer u hoy sin un conteo nuevo suyo. (`.claude/skills/mercancia/SKILL.md:32-35`)

## Qué NO comprobé
Las casillas resumen la entrada; no se contrastaron con el código ni con el estado real del inventario. No toqué ningún dato de mercancía.
