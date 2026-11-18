# Validación visual local — Mercancía

Fecha: 2026-11-18
Candidato exacto: `6e8eb624ede4d1544be615e7ebc22277fe2c67da`
Alcance: textos de confirmación de entrada/salida, documentación de proveedor, CTA de escaneo y disposición normal.

## Condiciones

- UI real en `127.0.0.1:14295`; API totalmente simulada y datos exclusivamente ficticios.
- Combinaciones: 1440 claro ES, 1440 oscuro EN, 390 claro ES y 390 oscuro EN.
- Usuario sintético con rol permitido. No se probaron accesos indebidos ni seguridad.
- Se abrió el bloque de documentación y se cambió entre las pestañas Entrada/Salida. No se confirmó ninguna operación, no se cargó PDF, no se abrió cámara, no se escaneó y no se hizo ninguna llamada a producción/Render.
- Todas las escrituras de negocio estaban bloqueadas con respuesta 405. Escrituras observadas: cero.

## Resultado

Última corrida: `4 passed (8.8s)`. Se generaron 8 PNG y `metricas-saneadas.json`.

## Lo corregido y comprobado

- Confirmación de entrada: `Confirmar entrada` en ES y `Confirm receipt` en EN.
- Confirmación de salida: `Confirmar salida` en ES y `Confirm stock removal` en EN.
- Ayuda documental: texto completo en ES y EN según el idioma.
- CTA principal de escaneo/suma: 45 px de alto a 1440 y 57 px a 390; contraste mínimo contra el tramo más oscuro del degradado: **5.50:1**, en la muestra de este botón.
- Ancho del documento igual al viewport en los ocho estados: no aparece desbordamiento horizontal global.
- La pantalla conserva la estructura Entrada/Salida, documentación, código/escáner, buscador, resumen y historial en ambos tamaños y temas.

## Hallazgos

### MER-6E-01 — Media — los campos internos de documentación siguen en español al usar EN

- Evidencia: `1440-dark-en-entrada-documento.png` y `390-dark-en-entrada-documento.png`.
- Código: `apps/web/src/Purchases.tsx:94-165`, reutilizado por `apps/web/src/Merchandise.tsx`.
- Resultado: aunque el título y la ayuda ya están en inglés, permanecen `Número de factura`, `NCF del proveedor`, `Fecha de la factura`, `Condición de pago`, `Según el proveedor`, `Contado`, `Crédito`, `ITBIS de la factura` y `Para la contable; no cambia el costo.`
- Propuesta: parametrizar `DocumentFields` por idioma o mover estas cadenas al catálogo común, sin cambiar los valores enviados al servidor.

### MER-6E-02 — Media — permanecen textos españoles generales y de salida en Mercancía EN

- Evidencia: `1440-dark-en-salida.png` y `390-dark-en-salida.png`.
- Código: `apps/web/src/Merchandise.tsx:77-83`, `:184`, `:224`, `:1046`, `:1301`; estado de historial en `apps/web/src/Purchases.tsx:519`.
- Resultado en EN: `Buscar producto`, placeholder `Nombre, SKU, sabor, talla o color`, `Sin productos`, `Todavía no hay recepciones.` y las razones `Merma`, `Dañado`, `Vencido`, `Muestra o probador`, `Uso interno`, `Devolución a proveedor`.
- Propuesta: llevar el nombre del buscador, placeholder, vacío, historial y etiquetas de razones al catálogo `merchandiseText`. Mantener inalterados los valores internos de razón que consume la API.

## Límites

- Validación de presentación; no certifica el servidor, persistencia, inventario, cámara, lector, archivos ni permisos.
- El botón de confirmación permaneció deshabilitado porque no se agregó ningún producto; el texto y la disposición sí fueron comprobados sin efectuar la operación.
- No se cargó la importación de factura y no se usaron credenciales ni datos reales.

## Archivos

- `metricas-saneadas.json`.
- Capturas por combinación: `*-entrada-documento.png` y `*-salida.png`.
