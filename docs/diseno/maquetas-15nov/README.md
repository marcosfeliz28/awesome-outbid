# Maquetas estáticas del 15-nov

Entrega visual para la orden `docs/coordinacion/ORDENES_15NOV.md`. No es una
implementación de la aplicación: no llama a la API, no guarda datos y no cambia
reglas de caja, inventario, precios o dinero.

## Preview

Abrir [`index.html`](index.html) y entrar a cada pantalla:

1. [`caja.html`](caja.html)
2. [`direccion.html`](direccion.html)
3. [`mercancia.html`](mercancia.html)

El modo oscuro está activo al abrir cada maqueta. El control «Modo claro» cambia
la presentación sin JavaScript. Las seis capturas revisadas están en
[`capturas/`](capturas/): escritorio a 1440 × 900 y ventana móvil a 390 × 844.
Las capturas móviles son del viewport real, no de una página completa: así la
barra inferior fija aparece donde la persona realmente la ve y no en medio de
una imagen larga compuesta por el navegador.

## Decisiones visuales

- **Una identidad:** paleta «Aurora violeta» compartida por las tres pantallas;
  el violeta marca acciones y selección, y los colores semánticos solo expresan
  estado. No se agregaron estilos de marca distintos por módulo.
- **Jerarquía antes que decoración:** título, contexto, acción y contenido se
  distinguen por escala, espacio y superficie. Se usa profundidad violeta suave,
  sin vidrio ni efectos caros en barras fijas.
- **Lectura:** Inter para interfaz y Plus Jakarta Sans como primera opción para
  títulos/cifras, base 16 px y mínimo verificable de 14 px. Los importes usan
  cifras tabulares.
- **Oscuro real:** no es una inversión automática; tiene superficies, bordes,
  texto secundario y botones propios. Contrastes calculados: texto claro
  17.71:1, secundario claro 5.46:1, botón claro 8.32:1, texto oscuro 16.12:1,
  secundario oscuro 8.85:1 y botón oscuro 8.32:1.
- **Caja sin distracciones:** catálogo a la izquierda y venta actual estable a la
  derecha; el botón Cobrar permanece como única acción primaria. No se propuso
  animación en F4/F12 ni se alteró el flujo.
- **Dirección accionable:** cuatro indicadores, una sola visualización y una
  lista priorizada. Las cifras de muestra se sustituyen por guiones para evitar
  presentar importes ficticios como resultados.
- **Mercancía guiada:** tres pasos, formulario y tabla a la izquierda, revisión
  persistente a la derecha; en móvil se apilan y la tabla queda desplazable sin
  desbordar la página.
- **Movimiento futuro:** la maqueta usa solo la transición corta del tema. Si se
  implementa, el resto debe usar transform/opacidad y respetar
  `prefers-reduced-motion`.

## Evidencia y correspondencia

- Caja conserva catálogo, «Venta actual» y «Cobrar» según
  `docs/sistema/PANTALLAS.md:44-49`.
- Dirección conserva «EL PULSO DE TU NEGOCIO», período, ventas, señales y
  favoritos según `docs/sistema/PANTALLAS.md:122-125`.
- Mercancía conserva entrada/salida, búsqueda, importación y revisión antes de
  confirmar según `docs/sistema/PANTALLAS.md:94-98`.
- Tipografía, mínimo de 14 px, profundidad, modo oscuro y datos de demostración
  siguen `docs/diseno/DIRECCION_VISUAL_IMPACTO.md:11-38,67-71`.
- La caja evita movimiento que retrase el cobro y el CSS apaga transiciones no
  esenciales con movimiento reducido, conforme a
  `docs/diseno/PLAN_APP_ANIMADA_29OCT.md:3-10`.
- `docs/diseno/MAPA_PANTALLAS.md` se leyó completo, pero se declara borrador
  parcial y no enumera estas vistas; por eso la correspondencia funcional se
  contrastó con `docs/sistema/PANTALLAS.md` y las fuentes solo en lectura.
- La primera entrega registró correctamente que
  `docs/coordinacion/potente-14nov/PROPUESTA_VERSION_POTENTE.md` no existía aún
  en `origin/nexora-cloud`. La fuente se incorporó después en `4818c607` y la
  revisión de Claude nube en `6369cdd3`; la comparación posterior está en
  [`MATRIZ_REVISION_15NOV.md`](MATRIZ_REVISION_15NOV.md).

## Revisión realizada

- Regresión previa: `node docs/diseno/maquetas-15nov/verificar.mjs` terminó con
  código 1 porque todavía no existía `styles.css`.
- Después: el mismo control pasa y exige tres HTML, CSS compartido, tema oscuro,
  texto mínimo de 14 px, movimiento reducido y seis pares de contraste AA.
- Chromium/Playwright revisó las tres páginas a 1440 × 900 y 390 × 844: mínimo
  calculado 14 px, un solo `h1`, un solo `main` y 0 px de desbordamiento horizontal.
- `pnpm check` pasó después de generar el cliente Prisma local: typecheck y lint
  verdes; 121 archivos y 1,057 pruebas pasaron, 1 archivo y 10 pruebas quedaron
  omitidos, y los builds web/API terminaron correctamente. Vite solo emitió su
  advertencia conocida de un chunk mayor de 500 kB.
- Revisión visual de las capturas: se corrigió la altura inexistente de la gráfica
  de Dirección, el desbordamiento móvil de Mercancía y el contraste del botón
  primario oscuro antes de cerrar la entrega.
- Revisión posterior: el control reprodujo que las capturas móviles anteriores
  medían 390 × 3027, 390 × 2305 y 390 × 1957, y que la barra fija quedaba en
  medio de la imagen larga. Se sustituyeron por capturas de ventana 390 × 844.
  También se reemplazaron dos etiquetas vagas de Dirección sin añadir cifras.

## Fuera de alcance

No se tocaron `apps/**`, lógica de negocio, DIS-02, EFI-01, instalación VM,
dinero, producción, Render, credenciales ni despliegues. Las maquetas no son una
certificación de la aplicación funcionando.
