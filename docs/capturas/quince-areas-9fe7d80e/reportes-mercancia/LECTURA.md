# Validación visual local — Reportes, informe formal, día/mes y Mercancía

Fecha: 2026-11-18
Candidato exacto: `9fe7d80ee3eb8aeef4264059d98809e80943e741` (`dot/15areas-integracion-18nov`)
Base declarada: `e1a2e935`
Estado remoto observado: ejecución `44302110191`, con `verify` rojo; instalador e imágenes pasan. Este candidato **no se declara integrable**.

## Alcance y condiciones

- Pantallas permitidas: `Reportes`, `Informe formal`, `Ingresos por día`, `Informe mensual` y `Mercancía`.
- Tamaños: 1440 × 1000 y 390 × 1000.
- Temas/idiomas: claro ES y oscuro EN (cuatro combinaciones solicitadas).
- Navegador local sobre `127.0.0.1:14295`; ningún servidor de API, PostgreSQL, SSE o servicio externo.
- La API fue interceptada completamente con respuestas simuladas y datos ficticios. Las únicas respuestas no-GET fueron el refresco de sesión y el registro ficticio del terminal, también interceptados localmente. Toda otra escritura quedó bloqueada con 405.
- Usuario sintético de rol permitido, sin probar cambios de rol, accesos indebidos, seguridad ni operaciones de negocio.
- No se hicieron ventas, descargas, importaciones, confirmaciones, cambios de inventario ni llamadas a Render/producción.
- Importe largo deliberado: `98,765,432.17`; se comprobó que el valor no cambiara y que los fragmentos monetarios quedaran en una línea.
- No se comparó con ninguna lámina supuesta; la revisión evalúa únicamente el candidato ejecutable.

## Resultado del arnés

`4 passed (15.8s)` en la última corrida. Se generaron 24 PNG (7.56 MiB) y `metricas-saneadas.json`. Cero escrituras de negocio observadas.

## Hallazgos

### OPS-9F-01 — Media — nombres largos se recortan en las tablas Top 10 del informe mensual móvil

- Evidencia: `390-light-es-mes.png` y `390-dark-en-mes.png`.
- Código: `apps/web/src/MonthReport.tsx:283` y `apps/web/src/MonthReport.tsx:314`; regla relacionada `apps/web/src/premiumWorkspace.css:41-42`.
- Reproducción: abrir `Informe mensual` a 390 px con un producto llamado `PRODUCTO FICTICIO DE NOMBRE MUY EXTENSO`.
- Resultado: en las dos tablas Top 10, la celda de producto tiene 354 px disponibles pero 485 px de contenido. El contenedor mide 356 px tanto en `clientWidth` como en `scrollWidth`, por lo que no existe desplazamiento horizontal que recupere los 131 px ocultos.
- Esperado: permitir salto de línea en el valor `Producto` o un mecanismo de expansión accesible sin alterar el nombre.
- Nota: los importes largos permanecen íntegros; el defecto afecta el nombre del producto, no el monto.

### OPS-9F-02 — Media — Mercancía en inglés conserva controles y estados en español

- Evidencia: `1440-dark-en-mercancia.png` y `390-dark-en-mercancia.png`.
- Código: `apps/web/src/Merchandise.tsx:184`, `:224`, `:1302`, `:1314`; historial compartido en `apps/web/src/Purchases.tsx:519`.
- Reproducción: idioma EN, abrir `Goods received / Merchandise`.
- Resultado: aparecen `Buscar producto`, `Nombre, SKU, sabor, talla o color`, `Sin productos`, `Confirmar entrada` y `Todavía no hay recepciones.` dentro de una pantalla mayormente inglesa.
- Esperado: enviar esas cadenas por el catálogo de idioma de Mercancía. El formulario interno de importación no se abrió; su posible idioma queda fuera de esta comprobación.

## Comprobaciones que pasaron

- Las cuatro combinaciones mantienen el ancho del documento igual al viewport: 1440/1440 y 390/390; no hay desbordamiento horizontal global.
- Contraste medido en muestras representativas de tabla/KPI/cabecera: 12.25:1 a 17.68:1.
- Los importes `98,765,432.17` no fueron redondeados, abreviados ni partidos en dos líneas.
- Las tablas anchas de `Ingresos por día` se mantienen dentro de una región anunciada y desplazable horizontalmente. En móvil el total ancho sigue disponible por desplazamiento; no se contó como pérdida de datos.
- La barra móvil `Mercancía` aparece solo a 390 px, con botón de 52 px y reserva de 104 px al final del contenido. Fondo claro: `rgb(247, 251, 248)`; oscuro: `rgb(8, 41, 31)`.
- La pantalla principal de Mercancía no muestra la barra fija sobre sí misma y no genera desbordamiento global.
- Reportes, Informe formal, Ingresos por día e Informe mensual cargaron en ES y EN con datos ficticios.

## Límites

- Esta es una validación de presentación, no una certificación funcional, financiera, de permisos ni de seguridad.
- No se probó el PDF/CSV, la importación de factura, el escáner/cámara, el detalle del día ni los botones que escriben.
- No se usó API real ni base de datos; por tanto no se validan contratos del servidor.
- El CI exacto está rojo en `verify`; este informe no contradice ese bloqueo.

## Archivos

- Métricas: `metricas-saneadas.json`.
- Capturas: 24 PNG con prefijos `1440-light-es`, `1440-dark-en`, `390-light-es`, `390-dark-en` y sufijos `reportes`, `formal`, `ingresos-dia`, `mes`, `mercancia-atajo`, `mercancia`.
