# Foco en Punto de venta · `e9a738bb`

Candidato exacto `e9a738bb5eea4bb98a5cc765bf302f57b7b2649c` de `dot/15areas-sobre-prod-18nov`. Probé la aplicación real con Edge 157.0.4341.60 en 1440 × 900 y 390 × 844, con tema claro y oscuro, sobre una API local y una base de demostración descartable.

## Fallos reproducidos

- **Cobrar pierde el foco al cerrarse.** Con tres artículos ficticios en el carrito, enfoqué «Cobrar», lo abrí con Enter y cerré con Escape y con «Cerrar». En los ocho cierres el foco cayó en `body`. Los tres artículos y el total se conservaron. [Diálogo de cobro](https://github.com/marcosfeliz28/awesome-outbid/blob/e9a738bb5eea4bb98a5cc765bf302f57b7b2649c/apps/web/src/POS.tsx#L2532-L2557), [componente Modal](https://github.com/marcosfeliz28/awesome-outbid/blob/e9a738bb5eea4bb98a5cc765bf302f57b7b2649c/packages/ui/src/index.tsx#L119-L177)
- **El buscador global pierde el foco al cerrarse.** En escritorio lo abrí desde su botón. A 390 px ese botón está oculto y usé Ctrl+K desde el campo de producto. El buscador enfocó su entrada, mostró la opción «Ventas» y conservó el foco dentro del diálogo al tabular. Tras Escape el foco quedó en `body` en las cuatro variantes. [Botón del buscador](https://github.com/marcosfeliz28/awesome-outbid/blob/e9a738bb5eea4bb98a5cc765bf302f57b7b2649c/apps/web/src/App.tsx#L1171-L1175), [diálogo](https://github.com/marcosfeliz28/awesome-outbid/blob/e9a738bb5eea4bb98a5cc765bf302f57b7b2649c/apps/web/src/App.tsx#L1310-L1338)
- **Un solo Escape cerró dos capas.** Abrí Cuenta y luego el buscador con Ctrl+K. Escape cerró el buscador y Cuenta en 4/4 variantes. Al repetir desde el menú móvil, Escape cerró ambos en 2/2 variantes. En los seis casos el foco volvió al botón de la capa inferior, que también se había cerrado. Las pruebas del candidato describen que la capa inferior debe quedar abierta tras el primer Escape. [Gestión de capas](https://github.com/marcosfeliz28/awesome-outbid/blob/e9a738bb5eea4bb98a5cc765bf302f57b7b2649c/apps/web/src/App.tsx#L705-L746), [pruebas de menú y cuenta](https://github.com/marcosfeliz28/awesome-outbid/blob/e9a738bb5eea4bb98a5cc765bf302f57b7b2649c/tests/e2e/accesibilidad.spec.ts#L396-L418), [prueba de cuenta](https://github.com/marcosfeliz28/awesome-outbid/blob/e9a738bb5eea4bb98a5cc765bf302f57b7b2649c/tests/e2e/accesibilidad.spec.ts#L479-L495)

## Comportamientos confirmados

- Al abrir Cuenta, el foco entró en su primer botón. Con Cuenta como única capa, Escape devolvió el foco a su botón en las cuatro variantes.
- Al abrir el menú móvil, el foco entró en la primera opción y el contenido principal quedó inactivo. Las 37 pulsaciones de Tab y Shift+Tab por tema se mantuvieron dentro del menú. Con el menú como única capa, Escape devolvió el foco a «Abrir menú» en ambos temas.

Las seis capturas muestran los estados abiertos que se observaron en el navegador. `mediciones.json` registra el elemento enfocado tras cada cierre, la verificación de los archivos, cero solicitudes operativas y cero errores de página. En ambos recorridos terminaron el navegador, la aplicación, la API y la base de prueba, con cero procesos propios y cero puertos de prueba activos al final.
