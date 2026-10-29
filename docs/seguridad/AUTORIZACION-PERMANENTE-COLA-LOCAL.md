# Autorización permanente de la dueña para la cola local (29-oct-2026)

**Fuente:** mensaje de la dueña (Marcos) en el chat con el Revisor (Norexos 4), el 29-oct-2026. Sus palabras: *«Acepto la tanda 3. Y este tipo de confirmaciones yo quiero que se brinquen. Ustedes están trabajando bajo mi supervisión, pero no se puede parar un trabajo por una aceptación mía, cosa que ustedes van a hacer que no violentamos ningún término.»*

## Qué queda autorizado sin pedir aceptación tanda por tanda
1. **Tanda 3 (S1-S8)** de `docs/coordinacion/COLA_LOTE_LOCAL_REVISOR.md`: aceptada por la dueña.
2. **Toda tanda futura** de la cola local que cumpla **todas** estas condiciones (las mismas que ya regían las tandas 1 a 3):
   - solo **lectura** del repo; escribe únicamente un archivo nuevo en `docs/diseno/borradores-local/` (o la carpeta de `docs/` de la propia cola), nunca `docs/operacion`, `docs/legal`, `docs/seguridad`, `.env*` ni ramas `nexora-cloud`/`producto-nexora`;
   - **sin** dinero, mercancía, precios, credenciales, datos de clientes ni de producción;
   - criterio de aceptación **verificable** con `grep`, `ls` o `wc`, encabezado «Borrador sin verificar» y «PARCIAL» si no cubre todo;
   - la **revisa** Claude PC (o el Revisor) antes de subirla.

## Qué NO queda cubierto (sigue pidiendo su orden)
Llaves o credenciales de cualquier tipo, despliegues, cambios de dinero o mercancía, instalar plugins o herramientas nuevas, ampliar permisos de una sesión o herramienta (por ejemplo, DeepSeek), tocar producción, datos de clientes, y cualquier cosa que contradiga `CLAUDE.md`. El Revisor no puede otorgar nada de eso en su nombre.

## Cómo se aplica
- Las sesiones que ejecutan la cola (Claude PC, Nexora 1) pueden tratar esta autorización como **permanente** para lo descrito en el punto 2, citando este archivo. Si una sesión prefiere oírlo de la dueña directamente en su propio chat, basta con que la dueña lo repita allí **una vez**.
- Cada tanda sigue pasando por la revisión; lo que se salta es solo la aceptación previa.
- La dueña puede retirar esta autorización en cualquier momento escribiéndolo.
