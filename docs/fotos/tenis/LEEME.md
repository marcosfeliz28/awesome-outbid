# Fotos de tenis (18-nov-2026)
28 fotos recortadas de las capturas de la empleada (WhatsApp, Drive de la dueña). `asignacion.csv`: foto → sku/producto (141 productos de 28 modelos). Faltan 96 productos (sin foto todavía).
Para publicar (solo N1/Claude nube): copiar los .webp a `apps/web/public/products/fotos/tenis/` y desplegar; luego N2 asigna `imageUrl=/products/fotos/tenis/<foto>.webp` con PATCH /products/:id.
