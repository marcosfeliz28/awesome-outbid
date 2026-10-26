# Obsidian Lumina · Fase 3 · Inventario

## Qué cambió y por qué
Solo `Inventory` y `Kardex` en `apps/web/src/Management.tsx`, más `apps/web/src/lumina-inventario.css` (nuevo, importado con una línea).

- Cabecera: `<Heading title="Inventario" eyebrow={false}>` con subtítulo descriptivo. Antes era el lema «Cada unidad, bajo control» con etiqueta en mayúsculas. La pantalla no tenía botones de cabecera, así que no hay acción principal ni menú «Más» (no se inventó ninguna).
- Existencia con color y texto: la insignia añade «· Bajo» o «· Agotado» (misma regla de umbral que antes). Almacenes no vendibles siguen en neutro, sin etiqueta.
- Cifras (precio, costo, existencia, total, cantidad y saldo del Kardex) con `font-variant-numeric: tabular-nums`.
- Pestañas «Stock actual» / «Conteos físicos»: `aria-pressed` y subrayado grueso violeta + negrita (no solo color); altura 44 px; foco visible esmeralda (`--focus`).
- Carga: `TableSkeleton` mientras carga el stock y el Kardex. Kardex pasa a tarjetas (`cards`) en móvil y tiene estado vacío útil.
- Sin componentes nuevos en `admin-ui.tsx`.

## Pruebas (carpeta nueva con PostgreSQL desechable en 55182, API 3182, web 4182; ya borrados)
- `pnpm install --frozen-lockfile`, `db:generate`, `typecheck`, `lint`, `build`: pasan.
- `tests/accessibility-contract.test.ts`: 36/36.
- e2e `inventario-plataforma`: 5/5. `almacenes`: 3/5 en la última pasada completa; «vista previa de Casa» pasó al repetirla sola (inestable); «el conteo precarga…» falla también SIN mis cambios (comprobado con la compilación base): depende del orden de conteos pendientes acumulados.
- Accesibilidad (axe + auditoría propia) limitada a `inventory`: pasa a 390 px claro/oscuro y 1280 px claro; la cuarta variante cayó en un paso de Mercancía (no mía).
- No se tocaron specs e2e: ningún camino de clic cambió.

## No verificado
- La suite completa `accesibilidad` y `fuentes` no quedó en verde: fallan en pantallas ajenas (Configuración, Mercancía). El servidor de pruebas local perdió la conexión a la base varias veces durante corridas largas; ese ruido se separó repitiendo casos sueltos.
- Sin revisión visual con capturas ni contraste medido a mano; el contraste se apoya en los tokens existentes y axe.

## Riesgos
- «Agotado» se calcula con `v.stock` de la tienda (como el umbral previo), no con la del almacén elegido.
