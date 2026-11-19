# Evidencia de solo lectura: fotos de suplementos (17-nov-2026)

Generada por Claude nube con su cuenta de sistema, solo con consultas de lectura (GET y HEAD). No se cambió nada en producción para prepararla. No contiene clientes, ventas ni datos personales.

## Vía de lectura para Dot (sin credenciales)

- **Archivos de imagen: públicos.** Cada URL de la columna `url_publica_archivo` se abre en el navegador sin iniciar sesión (ejemplo: `https://nexora-pos-web.onrender.com/products/fotos/INV-1014.webp`).
- **Datos del producto (`imageUrl`): requieren sesión.** No hay una vía de lectura sin cuenta. La alternativa con el mínimo acceso es que Marcos cree para Dot un usuario de rol `seller` (solo lectura de catálogo y caja) desde Usuarios, y le dé la clave en persona. Claude no lo crea ni amplía permisos.

## Archivos

| Archivo | Filas | Qué muestra |
|---|---|---|
| `publicadas_127.csv` | 127 | Productos con foto en la tienda: SKU, id, nombre, `imageUrl` actual, URL pública, respuesta HEAD y campos cambiados |
| `retenidas_18.csv` | 18 | Las 18 retenidas: `imageUrl` vacío; el archivo existe en la web pero no está asignado |

## Resultado (consulta en la columna `consulta_utc`)

- Sistema: 968 productos activos, **127 con foto**; los 127 son exactamente los de `publicadas_127.csv`.
- Las 127: `HEAD 200 image/webp` en todas; único campo cambiado respecto de la copia tomada el 17-nov antes de asignar: **`imageUrl`** (de vacío a `/products/fotos/<SKU>.webp`). El cambio queda en la auditoría del sistema (`update product`, usuario `claude`).
- Las 18 retenidas: `imageUrl` vacío; **ningún campo cambiado**; su archivo responde `200 image/webp` pero no se muestra en la tienda.
- Web servida: `nexora-pos-web` en `d559eb5d` (Live en Render).

## Afirmaciones (no son evidencia del sistema)

- La coincidencia foto ↔ producto (marca, sabor, presentación) la revisó Claude a ojo en hojas de contacto con el nombre del sistema; no hay prueba automática de que la etiqueta coincida.
- Derechos de uso de las imágenes: no comprobados.
