# Nexora POS · sistema visual Obsidian Lumina V2

Propuesta de trabajo, 27-oct-2026. Conserva la identidad aprobada: obsidiana,
violeta y N prismática; esmeralda para estado y foco. Producto y tienda/GV
conservan sus marcas separadas. La cajera usa claro; administración puede elegir.

## Color y contraste

Contraste WCAG calculado sobre colores sólidos, sin redondear antes de evaluar;
los degradados, transparencias y fondos con imágenes requieren medición aparte.

| Uso | Texto / fondo | Relación |
|---|---|---:|
| Claro principal | `#1b2134` / `#ffffff` | 15,99:1 |
| Claro secundario | `#64748b` / `#ffffff` | 4,76:1 |
| Acción | `#ffffff` / `#7c3aed` | 5,70:1 |
| Acción hover | `#ffffff` / `#6d28d9` | 7,10:1 |
| Claro éxito / error / aviso | `#047857` / blanco; `#c92e43` / blanco; `#92400e` / blanco | 5,48 / 5,31 / 7,09:1 |
| Oscuro principal / secundario | `#eef0f8` / `#0d0f18`; `#a3abc2` / `#0d0f18` | 16,80 / 8,34:1 |
| Oscuro acción secundaria / éxito | `#a78bfa` / `#0d0f18`; `#43e3b1` / `#0d0f18` | 7,02 / 11,71:1 |
| Oscuro error / aviso | `#ff8fa3` / `#0d0f18`; `#fbbf24` / `#0d0f18` | 8,84 / 11,45:1 |

Solo se autorizan estos pares en los fondos indicados; objetivo mínimo 4,5:1
para texto, 3:1 para controles y foco. No transmitir estado solo con color.

## Tipografía y estructura

Inter variable 100–900 para lectura; Plus Jakarta Sans 200–800 para títulos;
JetBrains Mono 100–800 para cifras y códigos (`tabular-nums`). Las tres son
SIL OFL 1.1, empaquetadas localmente; no añadir otra familia. Los cinco archivos
WOFF2 referenciados suman 222.804 bytes (217,6 KiB): cada uno es menor de 200 KB,
pero su suma supera 200 KB. **Pendiente:** medir la carga real por pantalla y
reducirla si el límite de 200 KB es agregado; no prometer su cumplimiento aún.

Espaciado base: 4, 8, 12, 16, 24, 32 y 48 px; radios 8/12/16 px; zonas táctiles
de al menos 44 × 44 px. Superficies sólidas con bordes discretos; sombras suaves
y halo solo en elementos destacados. Lucide para iconos, siempre con nombre
accesible en botones sin texto.

## Componentes y movimiento

- Botón: normal, hover, foco visible y deshabilitado; acción violeta, etiqueta
  legible y foco que no dependa solo del color. Campo: normal, foco, error con
  mensaje asociado, y deshabilitado; no borrar etiquetas al escribir.
- Tarjetas: jerarquía clara y dato principal; tablas: encabezados, orden y
  desplazamiento interno accesible. Gráficos siempre acompañados de cifras o
  tabla; vacíos y errores explican el siguiente paso, sin datos inventados.
- Portada: emblema y movimiento breve, con alternativa estática; sin audio
  automático. Caja: respuestas táctiles breves, sin video de fondo ni cambios
  que desplacen controles. `prefers-reduced-motion` elimina efectos decorativos.
- Mantener `.product-card`, `.cart-items`, `.connection`, `.main-content`,
  flujos, permisos y teclas F2/F4/F8/F12. Ningún importe protegido aparece en
  caja ciega. Probar 1440 × 900, 1366 × 768, 390 × 844 y también 320 px.

## Pendientes antes de aprobar

Los PR interiores #16, #11, #13 y #14 estaban abiertos y con `verify` rojo al
revisar. En #16 se observaron desbordes horizontales de 3–12 px a 320 px; no
integrar sin corregirlos y verificar el último SHA. Medir el contraste real
sobre todas las superficies, el foco por teclado y el peso efectivo de fuentes
e imágenes. Esta ficha documenta los pares medidos, no certifica cada pantalla.
