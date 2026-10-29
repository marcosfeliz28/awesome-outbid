# Auditoría visual de Nexora POS — encargo para Gemini

**Quién pide:** la dueña de Nexora POS (software de punto de venta, inventario y caja para negocios de República Dominicana; se venderá como producto a otras empresas).
**Qué te pide:** que audites las 27 capturas de este paquete (ver lista abajo) y entregues un **informe de auditoría con mejoras concretas y una cotización de esfuerzo** (horas por mejora y orden de prioridad), para que dos asistentes de diseño (ChatGPT PC con Canva/Runway, y ChatGPT nube) y un equipo de programación lo ejecuten.

## El problema, en palabras de la dueña
El diseño actual «se ve muy sencillo, muy robótico, para lo que estamos gastando». Quiere algo que:
- tenga **movimiento** (con sentido, no decorativo vacío),
- **se vea caro**, de calidad premium, con **muchos detalles**,
- transmita **ingeniería de punta, algo revolucionario**, y a la vez **humano y altruista** (que el software ayuda al negocio pequeño),
- **cargue bien y rápido** (la página y la aplicación no pueden sentirse pesadas),
- y que cuando se venda, **la gente de software que lo use se sienta cómoda metiéndole mano** (código limpio, sistema de diseño claro, componentes reutilizables).
No debe parecer hecho por un aficionado o por una plantilla.

## Qué hay en las imágenes
- `EN-VIVO-portada-*`: la portada que ya está publicada (1440×900 y 390×844, movimiento normal y reducido).
- `despues-*-desktop/movil`: Catálogo, Inventario, Clientes, Reportes, Configuración, Mercancía y Asistente (diseño nuevo, aún sin publicar).
- `f1/despues-dashboard-desktop-dark`: tablero «Hoy» en oscuro. `antes-pos-desktop-dark`: la caja (punto de venta) antes del rediseño.
Estilo base aprobado: «Obsidian Lumina» (violeta sobre obsidiana, N prismática).

## Qué debes entregar (formato)
1. **Veredicto por pantalla** (nota 1–10 en: jerarquía visual, calidad percibida «premium», coherencia, densidad de detalle, accesibilidad, claridad para el usuario de caja). Di **qué se ve «robótico» y por qué**, con ejemplos exactos de la captura.
2. **Mejoras concretas y priorizadas** (alto/medio/bajo impacto): tipografía, espaciado, profundidad (capas, sombras, vidrio, brillo), microinteracciones, transiciones entre pantallas, estados de carga (esqueletos), ilustración/3D, iconografía, gráficos de datos. Para cada una: qué cambiar, cómo se vería, y la **referencia** (nombre de un producto o patrón comparable).
3. **Dirección de movimiento:** qué debe moverse, cuándo, cuánto dura, y qué **tecnología** recomiendas (CSS, Framer Motion/GSAP, Rive/Lottie, WebGL/Three.js) con su **costo en peso y rendimiento**. Límite duro: la aplicación es una PWA y ningún archivo de JavaScript puede pasar de 2 MiB (hoy el principal pesa 2,11 MB), así que el movimiento debe cargarse por partes y apagarse con «reducir movimiento».
4. **Sistema de diseño para desarrolladores:** cómo estructurar tokens, componentes y documentación (por ejemplo Storybook) para que un equipo externo pueda extenderlo sin romperlo.
5. **Cotización:** por cada mejora, horas estimadas de diseño y de programación, riesgo, y orden recomendado en 3 fases (rápida / media / ambiciosa).
6. **Riesgos y lo que NO debes tocar.**

## Reglas que no se pueden romper
- Las cajeras usan la versión **clara**; la administración elige claro/oscuro.
- No cambiar flujos ni las teclas de la caja (F2, F4, F8, F12), ni permisos, pagos, impuestos (ITBIS/NCF) ni la regla de «caja ciega» (la cajera con caja abierta no ve importes).
- Accesibilidad: contraste 4,5:1, foco visible, funciona con teclado, respeta «reducir movimiento», se ve bien a 390 px.
- Nada de cifras de marketing inventadas, ni logotipos de terceros.
- Texto en español.

## Cómo entregar
Un solo documento (Markdown o PDF) con las secciones 1–6, con las capturas citadas por su nombre de archivo. Si recomiendas piezas visuales nuevas, descríbelas con suficiente detalle para que un diseñador las produzca (composición, color, tamaño, duración).
