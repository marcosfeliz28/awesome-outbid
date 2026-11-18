# Productos · primer corte, 18-nov

Base: `24d0213a7c3408b2f8baf6c4417ea8e702f1b63f` (premium 92d + fotos). Rama: `dot/productos-higgsfield-18nov`.
Referencia inspeccionada: `norexos-productos-higgsfield-01.png`, Library `libfile_fde3_f-95e37ef8dde881918c5b2c86507cddf1_00021c7591648191a2873caeaff1ea36`.

## Alcance
- Wrapper de presentación del catálogo real; datos del filtro existente.
- Verde/oro, profundidad con sombras y bordes, hover y pulsación sutiles, azul, claro/oscuro/negro, foco visible y movimiento reducido.
- Ficha lateral con selector accesible y fotografía real; abre el modal original. En móvil baja después del listado.
- Conteos de productos/categorías **visibles**, no total del negocio; sin fotografía cuenta imágenes vacías o placeholders SVG. Carga/error no se confunden con cero.
- Ningún endpoint nuevo, mutación, permiso o precio modificado. Tabla, importación, formularios, stock y datos originales conservados byte por byte, probado al retirar wrapper.

## Autoauditoría
- Regresión del wrapper antes: 2 pruebas fallaron, 3 pasaron; después: 5 pasan.
- Tipado de web y build web pasan. Pruebas focales de presentación, mensajes y citas: 24 pasan (incluida prueba reversible añadida).
- `pnpm check` global bloqueado por dependencias locales de packages/ui: `TS7026 JSX.IntrinsicElements`, warning node_modules missing. No se declara check ni CI verde.
- Chromium no permite iniciar: `process_singleton_posix.cc:297 socket() failed: Operation not permitted`. Sin capturas ni E2E verificadas en este entorno. Debe validarse en PC a 1440/390, ambos temas, cambio repetido de filtros y producto, abrir/cerrar ficha, teclado y permisos.
- Los nuevos textos de resumen/ficha son ES/EN. El formulario y tabla heredados conservan español; **no es traducción completa del módulo**.
- Primer corte, no réplica final certificada: pendiente QA visual de contraste, responsive, fotos y materiales contra la lámina. No desplegado, sin merge/PR.

## Riesgos contenidos
Dinero/costos: no se añade costo a la ficha; se etiqueta precio de primera variante expresamente. No se inventa precio si no hay variantes. No cambia cálculo ni checkout. Privacidad: solo datos ya recibidos por catálogo. Selección resuelve al primer producto visible si el seleccionado sale del filtro. Mutaciones e importación quedan en handlers originales y con los permisos existentes. Ningún cambio de API/base, Render o credenciales.
