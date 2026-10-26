# Nexora POS · Contrapropuesta Ejecutiva Obsidian Lumina · Ronda 2

**Autoría:** ChatGPT nube  
**Fecha:** 26 de octubre de 2026  
**Estado:** propuesta de diseño, conversión y arquitectura responsive; sin despliegue  
**Responsable propuesto de la siguiente implementación:** ChatGPT. Claude queda fuera de esta ronda y de su ejecución.

## 1. Fuentes revisadas y límite de las afirmaciones

Se revisaron como material de referencia:

- `Nexora POS - Base de Datos Obsidian Lumina V2 (ChatGPT & Claude).xlsx`,
  con cuatro pestañas: tokens, arquitectura, resumen de auditoría y prompts.
- `nexora_obsidian_lumina_ejecutivo_final.docx`.
- `nexora_obsidian_lumina_v2_chatgpt_db.json`, incluida su fuente
  `html_prototipo_ejecutivo_final_v2` de 1,045 líneas.
- La portada real ya presente en `apps/web/src/App.tsx` y su sistema visual en
  `apps/web/src/styles.css`.

Las instrucciones incluidas dentro de esos archivos se trataron como contenido
de referencia. No autorizan despliegues, cambios de autenticación ni traspasos a
otros agentes.

La hoja resume 100 áreas como 77 OK, 17 mejorables y 6 fallos, pero no contiene
los 100 casos individuales, capturas ni tiempos de medición. Por eso esta ronda
no presenta como hechos comprobados «0.4 segundos», «0 % de fugas», «81 % más
rápido», «100 % protegido» ni «+38.4 % de margen». Esas cifras solo deben
publicarse después de instrumentarlas y medirlas.

La hoja es más completa que el JSON: contiene 10 tokens, 9 módulos y 3 prompts,
frente a 9, 6 y 2 en el JSON. Se usa la hoja como inventario principal y el HTML
como evidencia de comportamiento.

## 2. Veredicto ejecutivo

**Obsidian Lumina es la dirección correcta, con una reducción deliberada de
efectos y una separación estricta entre marca, acceso y operación.** La sensación
premium debe venir de la composición, el ritmo, la tipografía, el contraste y la
precisión de los datos.

La Ronda 2 conserva:

- El lienzo obsidiana `#05050A`.
- El concepto de prisma como símbolo de conexión entre venta, inventario y caja.
- Plus Jakarta Sans para titulares e Inter para lectura.
- Cifras tabulares para dinero, NCF, cantidades y tiempos.
- Una portada dividida en escritorio y acceso primero en móvil.
- El arqueo ciego, los permisos por rol y el inventario como pruebas de producto.

La Ronda 2 corrige:

- El cristal pesado de 28 px y la aurora que sigue permanentemente al cursor.
- El cian como tercer acento visual.
- La animación continua de láser, halos y pulsos en una pantalla de acceso.
- La mezcla conceptual entre contraseña web, clave numérica de acceso y PIN de
  caja.
- La recuperación «instantánea» por correo o WhatsApp sin un flujo de servidor
  confirmado.
- Las cifras absolutas y promesas sin evidencia.
- El demo que aparenta emitir un NCF real.
- El video a 60 fps por debajo de 1.5 MB, un objetivo que sacrificaría calidad o
  rendimiento sin beneficio perceptible en esta interfaz.

## 3. Concepto refinado: «Control sereno»

La portada comunica tres ideas en este orden:

1. **Control:** cada venta, turno y existencia queda trazable.
2. **Velocidad:** el flujo requiere pocos pasos y responde con claridad.
3. **Confianza:** cada rol ve y hace exactamente lo que le corresponde.

La dirección visual se siente como una terminal financiera sobria. El prisma es
una firma de marca, no una escena de ciencia ficción. La luz aparece para indicar
foco, acción, estado o continuidad; no compite con el formulario.

### Titular recomendado

> **Cada venta en orden. Cada peso bajo control.**

Texto de apoyo:

> Vende, controla inventario y cierra cada turno con la información que necesita
> tu negocio, desde un solo sistema.

Prueba funcional visible:

- Arqueo ciego para contar sin sesgo.
- Márgenes reservados a los roles autorizados.
- Entradas, salidas y traspasos con historial.
- Reportes fiscales disponibles según la configuración de la empresa.

CTA principal para quien vuelve: **Entrar a mi empresa**.  
CTA secundario si el entorno lo permite: **Ver una tienda de demostración**.  
Enlace terciario condicionado a registro público habilitado: **Crear empresa**.

### Otras dos rutas de titular

1. **Vende rápido. Cierra claro. Decide con datos.**  
   Más directo y comercial; funciona bien en campañas.
2. **Tu tienda avanza. Tus números responden.**  
   Más emocional; requiere un subtítulo más descriptivo.

## 4. Sistema visual Ronda 2

La implementación debe consumir los tokens compartidos actuales. No se crea un
segundo sistema visual para la portada.

| Función | Token recomendado | Uso |
| --- | --- | --- |
| Lienzo | `--bg: #05050A` | Fondo principal oscuro |
| Superficie | `--surface: #0D0F18` | Campos y tarjetas base |
| Superficie elevada | `--surface-raised: #131726` | Panel de acceso |
| Texto | `--text: #EEF0F8` | Lectura principal |
| Texto secundario | `--muted: #A3ABC2` | Ayuda y descripciones |
| Esmeralda | `--accent-emerald: #43E3B1` | CTA principal, éxito y foco |
| Violeta | `--accent-violet: #8B5CF6` | Marca, selección y ubicación |
| Borde | `--border-strong` | Separación perceptible sin halo |

Reglas:

- Una sola acción rellena por bloque.
- Esmeralda para la acción de conversión o confirmación; violeta para selección,
  navegación y firma de marca.
- Ningún gradiente contiene más de dos acentos.
- Desenfoque máximo de 12–14 px, solo en la portada y con respaldo opaco.
- Sombra ambiental amplia y tenue; controles sin resplandor permanente.
- Radio coherente: 10 px en campos, 12 px en botones, 16 px en paneles.
- Inter para cuerpo; Plus Jakarta Sans solo en marca y titulares; `tabular-nums`
  antes que una fuente monoespaciada completa para tablas extensas.
- El modo claro conserva superficies sólidas y contraste AA. La portada puede
  iniciar oscura; la preferencia interna de administración sigue siendo del
  usuario.

## 5. Arquitectura de acceso segura y comprensible

En el código actual existe una pestaña titulada «PIN de 6 dígitos», aunque la
ayuda aclara que se trata de la contraseña numérica para entrar al sistema y no
del PIN de caja. Esa contradicción debe resolverse antes de añadir más diseño.

### Tres credenciales, tres nombres y tres contextos

1. **Contraseña web**  
   Se usa para entrar a la cuenta desde un navegador. Campos: empresa, usuario y
   contraseña. Recuperación mediante el flujo real del servidor.
2. **Clave numérica de acceso**  
   Si el producto mantiene una contraseña de seis dígitos para ciertos roles,
   debe llamarse exactamente así. Nunca debe rotularse «PIN de caja».
3. **PIN de caja**  
   Se usa dentro de una empresa ya autenticada y en un equipo autorizado para
   cambiar de operadora o aprobar una acción de caja. No aparece como método de
   autenticación pública.

### Flujo recomendado

- En la portada pública se muestra **Contraseña web**.
- Si la empresa admite clave numérica de acceso, el enlace dice **Entrar con mi
  clave numérica** y explica el rol al que aplica.
- **Abrir caja en este equipo** solo aparece cuando existe un terminal aprobado
  y una empresa vinculada localmente.
- El PIN de caja nunca viaja por el flujo `/auth/login` ni se presenta como
  sustituto de contraseña.
- Escribir números en el campo de contraseña puede mostrar una ayuda discreta;
  no cambia de modo automáticamente ni conserva el valor al cambiar de flujo.
- No se incluyen claves, PIN demo o contraseñas precargadas en producción.
- «¿Olvidaste tu contraseña?» describe el mecanismo que realmente existe. Un
  correo o WhatsApp de desbloqueo requiere token de un solo uso, caducidad,
  revocación de sesiones, límite de intentos y auditoría antes de publicarse.

## 6. Composición en escritorio · 1366 × 768

### Barra superior · 64 px

- Marca a la izquierda.
- Estado del servicio solo si proviene de telemetría real.
- Ayuda accesible y selector de tema a la derecha.
- Sin selector de «cuatro vistas del prototipo» en producción.
- Sin datos técnicos falsos como «DGII activo · 12 ms».

### Cuerpo · rejilla 7/5

**Columna izquierda:**

- Etiqueta breve «Nexora POS».
- Titular de dos líneas, máximo 56–64 caracteres.
- Subtítulo de máximo 150 caracteres.
- Cuatro pruebas de producto en una rejilla 2×2.
- Prisma estático o video sobrio como apoyo, por debajo de la propuesta de valor.

**Columna derecha:**

- Panel de acceso de 420–460 px.
- Encabezado, ayuda y formulario en una sola lectura vertical.
- Código de empresa recordado como valor editable, no como control decorativo.
- Acción principal única.
- Recuperación, demo y registro con menor peso visual.

La página debe caber en 768 px de alto con zoom al 100 % sin ocultar el botón de
entrada. Si el contenido crece por errores o cambio de contraseña, el documento
puede desplazarse naturalmente.

## 7. Arquitectura móvil · 390 × 844

Orden exacto:

1. Marca compacta de 52–56 px.
2. Panel de acceso completo.
3. Enlace de recuperación.
4. CTA de demo o registro, si está habilitado.
5. Franja de confianza con dos beneficios visibles.
6. Titular y resto de la historia comercial.
7. Imagen del prisma con carga diferida.

Reglas móviles:

- El botón de entrada debe verse en la primera pantalla siempre que no haya un
  mensaje de error extendido.
- Controles de 48 px como mínimo y separación de 8 px.
- Teclado numérico solo en el flujo que realmente lo necesita.
- Sin aurora dependiente del puntero, parallax, autoplay obligatorio o tarjetas
  flotantes.
- El video usa `poster`; en `prefers-reduced-motion: reduce` y `Save-Data` se
  presenta únicamente la imagen.
- La animación nunca cambia la geometría del formulario.
- Texto base mínimo de 16 px en campos para evitar zoom automático en iOS.
- El panel mantiene 16 px de margen lateral y no produce desplazamiento
  horizontal a 320, 360, 390 o 430 px.

## 8. Prisma, movimiento y rendimiento

### Tratamiento recomendado

- El prisma se muestra como una pieza material sobria, con cámara fija.
- Un destello de borde de 800–1,200 ms puede ejecutarse una vez al cargar.
- El fondo permanece casi estático después de ese gesto.
- La respuesta al puntero se limita a equipos con `pointer: fine` y se detiene
  cuando la pestaña pierde visibilidad.

### Presupuesto

| Recurso | Presupuesto |
| --- | ---: |
| Poster AVIF/WebP | ≤ 120 KB |
| Video WebM | objetivo 650–900 KB; máximo 1.2 MB |
| Video MP4 de respaldo | ≤ 1.5 MB |
| Duración | 5–6 s |
| Fotogramas | 24 o 30 fps |
| Resolución | 1280×720 escritorio; poster móvil |
| JS adicional de la portada | ≤ 20 KB gzip |
| LCP móvil p75 | < 2.5 s |
| CLS | < 0.1 |
| INP p75 | < 200 ms |

No se carga Spline, WebGL o una librería de animación pesada en el camino crítico
del acceso. El video debe ser decorativo, silencioso, sin texto incrustado y con
dimensiones reservadas.

## 9. Demo y onboarding

### Demo

- Ruta separada y aislada de datos reales.
- Etiqueta persistente **Demostración · datos ficticios**.
- El comprobante se describe como simulado; no «emite NCF».
- Reinicio de datos sencillo y ninguna escritura sobre una empresa real.
- El objetivo es completar una venta de ejemplo en menos de un minuto, no
  reproducir toda la plataforma en la portada.

### Onboarding

La idea de dos pasos es buena, pero los presets de giro no deben configurar
silenciosamente impuestos, NCF o reglas fiscales. Deben proponer valores y pedir
confirmación donde la ley o el negocio lo exijan.

Flujo:

1. Empresa y giro: nombre comercial, país/moneda y plantilla opcional.
2. Primer producto: nombre, precio y tratamiento fiscal visible.
3. Tras la primera venta: lista de tareas para RNC, logo, usuarios, NCF y demás
   configuración necesaria.

Las métricas «6→2», «22→5» y «13.5→2.5 min» se convierten en hipótesis. Se mide
tiempo hasta primera venta, abandono por paso y tasa de corrección posterior.

## 10. Accesibilidad y confianza

- Contraste WCAG AA en ambos temas.
- Foco visible de 3 px, sin depender solo del color.
- Pestañas con flechas, Home/End, `aria-selected`, `aria-controls` y paneles con
  identificadores únicos.
- Diálogos con título, foco inicial, trampa de foco, cierre con Escape y retorno
  del foco al disparador.
- Errores enlazados a su campo con `aria-describedby` y resumen si hay varios.
- Estados con icono o texto además de color.
- Animación anulada con `prefers-reduced-motion`.
- Soporte de zoom al 200 %, teclado completo y `forced-colors`.
- La atenuación de campos hermanos nunca reduce etiquetas o ayuda por debajo del
  contraste mínimo.

## 11. Conceptos de marca

### A. Prisma de enlace · recomendado

Una N construida con dos planos sólidos que se encuentran en un nodo central.
Funciona a 16 px, puede ser monocromática y admite una versión material para la
portada.

### B. N de doble riel

Dos rieles paralelos representan venta e inventario; el trazo diagonal representa
la conciliación. Es el concepto más legible para favicon, ticket e impresora.

### C. Apertura contable

Una N dentro de una abertura geométrica inspirada en una bóveda. Comunica
seguridad, pero debe evitar parecer una empresa bancaria o de criptomonedas.

Entregables de marca obligatorios:

- SVG maestro monocromático.
- SVG a dos colores.
- Símbolo cuadrado a 16, 24, 32, 48 y 180 px.
- Wordmark horizontal y vertical.
- Versiones para fondo claro, oscuro e impresión térmica de un color.
- Zona de seguridad, tamaño mínimo y variables de color.

Una imagen generativa sirve como exploración. El SVG final requiere reconstrucción
vectorial y revisión óptica; no se debe autocalcar un PNG y llamarlo logotipo final.

## 12. Prompts Pro refinados

### 12.1 Ideogram · exploración de wordmark y símbolo

```text
Create a premium identity exploration for “NEXORA POS”, a reliable point-of-sale,
inventory and cash-control platform for real retail businesses. Design a simple
architectural N monogram made from two precise interlocking planes meeting at one
clear central nexus. Mature executive technology aesthetic, calm and trustworthy,
flat vector construction, strong silhouette, optical balance, generous negative
space. Show one horizontal wordmark and one standalone icon. Obsidian #05050A,
emerald #43E3B1 and violet #8B5CF6; also include a one-color black version.
Geometric sans-serif wordmark, readable spelling: NEXORA POS. Plain presentation,
no mockup, no glass background, no 3D scene, no extra symbols, no gradients inside
the one-color mark, no tiny details, no slogan, no watermark.
```

**Selección:** escoger por silueta en miniatura y legibilidad del nombre, no por
el render material.

### 12.2 Midjourney · exploración del símbolo

```text
minimal architectural N monogram for Nexora POS, two interlocking geometric planes
meeting at a single central nexus, mature enterprise fintech and retail operations
identity, strong flat-vector silhouette, precise optical geometry, generous
negative space, works at 16px and in one-color thermal printing, obsidian black,
one restrained emerald accent and one restrained violet accent, brand-system design
sheet on neutral background, front view, no mockup, no text, no letters other than
the N, no shield, no coin, no shopping cart, no circuit-board cliché, no glow,
no lens flare, no photorealistic glass --ar 1:1 --style raw --s 75 --v 6.1
```

Generar después una ronda monocromática con el mismo seed. La geometría elegida se
reconstruye manualmente en SVG.

### 12.3 ChatGPT Images · lámina de dirección de marca

```text
Create a clean brand direction board for Nexora POS. The central asset is a simple
vector-ready N monogram formed by two interlocking planes and one unmistakable
central connection point. Show: (1) black one-color mark, (2) white one-color mark,
(3) restrained two-color version using #43E3B1 and #8B5CF6, (4) 24px app-icon test,
and (5) horizontal NEXORA POS wordmark. Use a white or neutral gray presentation
background. Keep every shape broad, balanced and reproducible as SVG. Avoid
photorealism, mockups, bevels, glass, neon, shadows, coins, carts, shields and
decorative micro-lines. The word NEXORA must be spelled exactly.
```

### 12.4 Sora · loop principal de escritorio

```text
Six-second perfectly seamless brand loop for the login page of Nexora POS, 16:9,
1280x720, 24 fps. Locked camera. A single architectural N-shaped prism made of
smoked obsidian and satin dark metal rests in a quiet #05050A environment. A very
thin emerald #43E3B1 line enters from the lower left, crosses the central nexus,
briefly becomes violet #8B5CF6 at the far edge, then returns the object and lighting
to the exact first frame. Slow controlled optical refraction, subtle realistic
material response, large negative space, mature enterprise design, calm premium
lighting. No camera movement, no particles, no floating UI, no text, no numbers,
no people, no cash, no coins, no logos other than the abstract N, no hard flashes,
no cyberpunk city, no audio, no watermark. First and last frames must match exactly.
```

### 12.5 Hailuo / MiniMax · loop alternativo

```text
Locked-off product cinematography, six-second seamless loop. One minimal N-shaped
architectural prism in smoked obsidian glass and brushed dark titanium, centered
slightly left with generous empty space. Deep #05050A background. A narrow emerald
light #43E3B1 travels once through the central connection and fades into a restrained
violet #8B5CF6 rim before returning to the identical opening frame. Slow, precise,
quiet, adult enterprise aesthetic; realistic reflections and controlled contrast.
No camera move, no zoom, no rotation, no text, no UI, no particles, no humans,
no money imagery, no lens flare, no flicker, no watermark. Seamless exact loop.
```

### 12.6 Runway · loop con control de movimiento

Usar como imagen inicial el poster aprobado y solicitar:

```text
Preserve the exact composition and geometry of the input image. Static camera and
static object. Animate only one thin emerald light ray moving through the central
nexus and a soft violet edge response. Motion intensity 2/10. Materials remain dark,
sharp and realistic. End on the exact initial lighting state for a seamless six-
second loop. No morphing, no camera motion, no new objects, no text, no particles,
no flicker, no watermark.
```

### 12.7 Poster AVIF/WebP y respaldo para movimiento reducido

```text
Premium still-life hero image for Nexora POS login. One simple architectural
N-shaped prism in smoked obsidian and satin dark metal, subtle emerald light at the
central nexus and a restrained violet edge, deep #05050A background, calm executive
technology aesthetic, realistic controlled reflections, large negative space for
interface composition, static front three-quarter view, high local contrast around
the object. No text, no UI, no people, no cash, no coins, no particles, no bloom,
no cyberpunk elements, no watermark. 16:9, optimized for a dark web hero.
```

### 12.8 Prompt de revisión final para ChatGPT Pro

```text
Actúa como director de producto, accesibilidad y rendimiento de Nexora POS. Revisa
estas capturas de la portada en 1366×768, 390×844, 320×568 y zoom 200 %, junto con
los resultados Lighthouse y axe. Evalúa: claridad de contraseña web frente a clave
numérica y PIN de caja; visibilidad de la acción principal; contraste WCAG AA; orden
de foco; teclado; reduced-motion; LCP, CLS e INP; peso y comportamiento del video;
veracidad de cada promesa comercial. Devuelve una tabla con gravedad, evidencia,
pasos para reproducir, corrección exacta y criterio de aceptación. No propongas
cambios de API, autenticación, permisos, pagos, reglas fiscales ni base de datos.
No despliegues. Si falta evidencia, marca “no comprobado” y pide la medición.
```

## 13. Medición de conversión

Eventos mínimos, sin PII:

- `login_view`
- `login_submit`
- `login_success`
- `login_error` con categoría controlada
- `login_recovery_open`
- `numeric_access_open`
- `demo_open`
- `registration_open`
- `onboarding_step_complete`
- `first_sale_complete`

Embudo principal:

1. Visita → inicio de acceso.
2. Inicio → acceso correcto.
3. Visita nueva → demo o registro.
4. Registro → empresa creada.
5. Empresa creada → primera venta.

Las pruebas A/B cambian una variable cada vez: titular, orden de CTA o presencia
del video. No se comparan dos portadas completamente distintas en una sola prueba.

## 14. Plan de ejecución por fases

### P0 · claridad y seguridad

- Corregir «PIN de 6 dígitos» por el nombre real del mecanismo.
- Mantener el PIN de caja dentro del equipo y la sesión autorizados.
- Eliminar promesas o telemetría no medida.
- Alinear recuperación con el flujo real.
- Completar accesibilidad del selector y formularios.

### P1 · conversión y móvil

- Aplicar el titular y las pruebas de producto aprobadas.
- Poner el acceso primero a 390 px.
- Asegurar el botón dentro de la primera pantalla.
- Separar demo y onboarding en rutas aisladas.
- Instrumentar el embudo.

### P2 · marca y movimiento

- Elegir un concepto de símbolo mediante pruebas a 16 px y en ticket térmico.
- Reconstruir el SVG maestro.
- Producir poster y loop bajo el presupuesto.
- Activar movimiento progresivamente y medir LCP/INP.

### Criterio de salida

- 320–1366 px sin desbordamiento horizontal.
- Acceso completo por teclado y lector de pantalla.
- Contraste AA en claro y oscuro.
- `prefers-reduced-motion` sin movimiento decorativo.
- LCP móvil p75 menor de 2.5 s y CLS menor de 0.1.
- Cero credenciales demo en producción.
- Cada afirmación comercial respaldada por una función verificable o una métrica.
- Autenticación, permisos, datos y reglas fiscales sin cambios durante la fase visual.

## 15. Decisión final para la dueña

Se recomienda aprobar:

1. El concepto **Control sereno** dentro de Obsidian Lumina.
2. El titular **Cada venta en orden. Cada peso bajo control.**
3. El concepto de logo **Prisma de enlace**.
4. Acceso primero en móvil y video reducido a poster cuando corresponda.
5. Una fase P0 de claridad de credenciales antes de producir más efectos.
6. El flujo de trabajo **ChatGPT → revisión de la dueña → implementación por
   ChatGPT**, con Gemini como revisión opcional si la dueña lo solicita y sin
   participación de Claude.

## 16. Mensaje listo para el contraanálisis opcional de Gemini

> Revisa la Contrapropuesta Ejecutiva Obsidian Lumina Ronda 2 creada por ChatGPT,
> junto con la maqueta desktop 1366×768, la maqueta móvil 390×844 y su HTML.
> Evalúa cada decisión como **aprobar, ajustar o rechazar**, siempre con evidencia.
> Concéntrate en diseño adulto y premium, claridad de conversión, arquitectura a
> 390 px, accesibilidad, rendimiento y separación entre contraseña web, clave
> numérica de acceso y PIN de caja. Comprueba que ninguna promesa comercial use
> cifras sin medición. Devuelve únicamente: decisiones finales, riesgos concretos,
> correcciones con criterio de aceptación y las tres pruebas más importantes antes
> de implementar. No cambies autenticación, permisos, APIs, pagos, reglas fiscales
> ni base de datos. No despliegues y no prepares ningún traspaso a Claude. La dueña
> revisará el resultado y ChatGPT será responsable de la implementación.

