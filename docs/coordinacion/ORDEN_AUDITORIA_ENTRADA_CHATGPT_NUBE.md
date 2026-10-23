# Orden para ChatGPT nube: auditar la nueva página de entrada (23-oct-2026)

**Pedido de la dueña:** «Vamos a hacer que ChatGPT nube lo audite también». Solo auditar: no cambies código ni despliegues.

## Qué auditar

- Rama `claude/entrada-futurista` (último commit `b9747cfb`), comparada con `nexora-cloud`:
  `git fetch origin && git diff origin/nexora-cloud...origin/claude/entrada-futurista`
- Archivos: `apps/web/src/App.tsx` (función `Login` y la constante `LOGIN_CUBE`) y `apps/web/src/styles.css` (bloque «Entrada futurista»).
- Qué es: una página de entrada oscura con una escena 3D hecha solo con CSS (piso en perspectiva, órbitas y un cubo cuyas 6 caras muestran los grupos que venden Grupo MacGen y GV Makeup Studio) y un formulario de vidrio. No usa librerías nuevas.

## Revisa, como mínimo

1. **Entrar sigue igual:** usuario, contraseña, «Mostrar contraseña», cambio obligatorio de contraseña (incluida la clave de cajera de 6 números) y mensajes de error. La lógica no se tocó; confirma que solo cambiaron textos y estilos.
2. **Legibilidad:** contraste del texto y de los errores sobre la tarjeta oscura, con el tema claro y con el oscuro.
3. **Celular (390 px):** sin desplazamiento horizontal y con el formulario completo visible.
4. **Rendimiento en las PC de caja:** animaciones infinitas, `backdrop-filter` y `filter: blur`. ¿Algo puede ponerlas lentas?
5. **Accesibilidad:** la escena tiene `aria-hidden`, y con `prefers-reduced-motion` las animaciones se apagan.
6. **Seguridad:** que nada choque con la CSP (`deploy/render/security-headers.conf`): sin estilos ni scripts externos y sin `style` en línea.
7. **Textos:** ¿los grupos del cubo coinciden con las categorías reales (Suplementos, Fajas, Tenis, Ropa deportiva, Accesorios de gym, Maquillaje, GV Cursos, GV Servicios, GV Productos)?

## Cómo entregar

- Escribe el resultado en `docs/coordinacion/RESULTADOS_CHATGPT.md`, en tu rama `nexora-chatgpt-nube`, y súbela a GitHub. Haz una sección «Auditoría entrada futurista 23-oct».
- Por cada hallazgo pon: severidad (alta, media o baja), archivo y línea, qué pasa y cómo arreglarlo.
- Si no encuentras nada, escríbelo así: «Sin hallazgos».
- Claude aplica las correcciones y despliega cuando el CI esté en verde y la dueña dé el visto bueno.
