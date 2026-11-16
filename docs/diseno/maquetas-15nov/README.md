# Maquetas estáticas del 15-nov

Entrega visual para la orden `docs/coordinacion/ORDENES_15NOV.md`. No es una
implementación de la aplicación: no llama a la API, no guarda datos y no cambia
reglas de caja, inventario, precios o dinero.

## Preview

Abrir [`index.html`](index.html) y entrar a cada pantalla:

1. [`caja.html`](caja.html)
2. [`direccion.html`](direccion.html)
3. [`mercancia.html`](mercancia.html)

El tema inicial sigue la preferencia clara u oscura del equipo. El control de
tema permite cambiarla solo para el preview. Las 18 capturas nuevas están en
[`capturas/`](capturas/): escritorio a 1440 × 900 y ventana móvil a 390 × 844.
Son seis capturas B1 en modo claro y doce B2 con Dirección 3D y Caja/Mercancía
2.5D en ambos temas. Las seis capturas oscuras sin sufijo `3d`/`25d` son la
evidencia histórica de la primera entrega y no cuentan dentro de las 18 nuevas.
Las capturas móviles son del viewport real, no de una página completa: así la
barra inferior fija aparece donde la persona realmente la ve y no en medio de
una imagen larga compuesta por el navegador.

## Decisiones visuales

- **Una identidad:** paleta «Aurora violeta» compartida por las tres pantallas;
  `#6d28d9` marca acciones y selección. Cobrar usa verde `#047857` como acción
  inequívoca de caja; no se agregaron estilos de marca distintos por módulo.
- **Jerarquía antes que decoración:** título, contexto, acción y contenido se
  distinguen por escala, espacio y superficie. Se usa profundidad violeta suave,
  sin vidrio ni efectos caros en barras fijas.
- **Lectura:** Inter para interfaz y Plus Jakarta Sans como primera opción para
  títulos/cifras, base 16 px y mínimo verificable de 14 px. Los importes usan
  cifras tabulares.
- **Oscuro real:** no es una inversión automática; tiene superficies, bordes,
  texto secundario y botones propios. El texto blanco sobre violeta supera
  7:1 y sobre el verde de Cobrar supera 5:1; ambos cumplen AA para texto normal.
- **Caja sin distracciones:** catálogo a la izquierda y venta actual estable a la
  derecha; el botón Cobrar permanece como única acción primaria. No se propuso
  animación en F4/F12 ni se alteró el flujo.
- **Dirección accionable y 3D:** cuatro indicadores, una sola visualización y
  una lista priorizada. Cada barra tiene número escrito además de altura. Las
  cifras monetarias de muestra se sustituyen por guiones para no presentarlas
  como resultados reales. La profundidad usa solo CSS y queda estática con
  movimiento reducido.
- **Caja y Mercancía 2.5D:** las tarjetas tienen capas y sombras contenidas, con
  siluetas genéricas construidas en CSS; no se usan marcas ni fotos de terceros.
- **Frascos completos en Caja:** cada silueta reserva 16 px sobre la tapa y ya
  no usa el desplazamiento negativo de la primera variante 2.5D. La altura se
  mantiene entre 54 y 72 px para conservar la forma a 1440 y 390 px.
- **Mercancía guiada:** tres pasos, formulario y tabla a la izquierda, revisión
  persistente a la derecha; en móvil se apilan y la tabla queda desplazable sin
  desbordar la página.
- **Movimiento:** las elevaciones opcionales usan transform/opacidad y solo se
  activan cuando el equipo no solicita movimiento reducido. En modo reducido
  las tres maquetas permanecen estáticas.

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

- Regresión original: `node docs/diseno/maquetas-15nov/verificar.mjs` terminó con
  código 1 porque todavía no existía `styles.css`.
- Regresión B1/B2: antes de implementar la nueva orden, el verificador terminó
  con código 1 (`ENOENT`) al exigir `capturas/caja-claro-1440.png`.
- Después: el mismo control pasa y exige tres HTML, CSS compartido, tema del
  equipo, violeta y verde AA, profundidad CSS, siete números visibles en la
  gráfica, movimiento reducido y las 18 capturas exactas.
- `node docs/diseno/maquetas-15nov/capturar.mjs` reproduce las 18 capturas con
  Chromium/Playwright y audita las tres páginas, dos tamaños y ambos temas:
  mínimo calculado 14 px, un solo `h1`, un solo `main` y 0 px de desbordamiento
  horizontal. Las capturas usan `prefers-reduced-motion: reduce`.
- `pnpm check` pasó después de generar el cliente Prisma local: typecheck y lint
  verdes; 121 archivos y 1,057 pruebas pasaron, 1 archivo y 10 pruebas quedaron
  omitidos, y los builds web/API terminaron correctamente. Vite solo emitió su
  advertencia conocida de un chunk mayor de 500 kB.
- Revisión visual de las capturas: se corrigió la altura inexistente de la gráfica
  de Dirección, el desbordamiento móvil de Mercancía y el contraste del botón
  primario oscuro antes de cerrar la entrega.
- Revisión B1/B2: se inspeccionó una captura clara de escritorio y una oscura
  móvil de cada pantalla. La barra móvil queda en el borde inferior del viewport,
  los números de la gráfica son visibles y Cobrar se distingue en verde.
- Corrección del 16-nov: la regresión nueva falló primero porque no existía el
  margen seguro de 16 px y Caja aún aplicaba `translateY(-3px)` a los frascos.
  Después del ajuste, el verificador pasó y se recapturaron las 18 vistas. Se
  inspeccionaron las cuatro vistas 2.5D de Caja en claro/oscuro y 1440/390.
- Revisión posterior: el control reprodujo que las capturas móviles anteriores
  medían 390 × 3027, 390 × 2305 y 390 × 1957, y que la barra fija quedaba en
  medio de la imagen larga. Se sustituyeron por capturas de ventana 390 × 844.
  También se reemplazaron dos etiquetas vagas de Dirección sin añadir cifras.

## Fuera de alcance

No se tocaron `apps/**`, lógica de negocio, DIS-02, EFI-01, instalación VM,
dinero, producción, Render, credenciales ni despliegues. Las maquetas no son una
certificación de la aplicación funcionando.
