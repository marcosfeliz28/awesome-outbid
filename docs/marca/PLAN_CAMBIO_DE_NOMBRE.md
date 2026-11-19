# Plan para cambiar el nombre del sistema (preparado por Nexora 1, 28-oct-2026)

**No se ejecuta todavía.** Se ejecuta solo cuando se cumplan las dos condiciones de la dueña: (1) la investigación profunda del nombre elegido sale sin choque y (2) el nombre y sus dominios están registrados a nombre de la dueña. Nombre nuevo = `<NUEVO>` (hoy en evaluación: Norexos / Orexos).

## Alcance medido (hoy)
Fuera de `docs/`, `tests/` y los candados, «nexora» (sin distinguir mayúsculas) aparece en unos 110 archivos:
| Zona | Archivos | Qué es |
|---|---|---|
| `apps/web` | 22 | Pantallas, título, ícono, privacidad, `runtime-config.js`, PWA |
| `apps/api` | 22 | Textos de correo, PDFs, nombre del producto, variables |
| `instalador/` | 39 de pruebas + 4 scripts + README, VERSION, recursos | Instalador de Windows, servicio y carpetas |
| `deploy/render` | 11 | Configuración de despliegue |
| `scripts/`, `taller/`, `.github/workflows`, `.claude/skills` | ~20 | Utilidades y CI |
Conteo en código: «Nexora POS» 67 veces; variables de entorno `NEXORA_…` 36; `nexora-pos` 16; «Nexora» suelto 241.

## Qué se cambia y qué NO
**Sí (texto visible y marca):** título de la página, portada, marco, ticket y PDF, correos, `privacidad.html`, `licencias.txt`, íconos y logotipo (la «N» se conserva solo si `<NUEVO>` empieza con N), textos del instalador, README, documentos de venta.
**Con cuidado (migración, no reemplazo ciego):**
1. **Variables de entorno `NEXORA_*`:** se aceptan las dos (la vieja y la nueva `<NUEVO>_*`) durante una versión; si no, el despliegue actual se cae.
2. **Nombre del servicio de Windows, carpeta de instalación y base local del instalador:** NO renombrar sin migración (los equipos ya instalados perderían el servicio y los datos). Cambiar solo el nombre visible.
3. **Dominios y servicios de Render** (`nexorapos.net`, `nexora-pos-web.onrender.com`, ids `srv-…`): no se tocan hasta tener el dominio nuevo apuntando; después se agrega el dominio nuevo y se deja el viejo redirigiendo.
4. **Llaves de almacenamiento del navegador (`localStorage`/`sessionStorage`, por ejemplo `nexora-config-tab`) y nombres de caché de la PWA:** conservar o migrar, para no cerrar sesiones ni perder borradores del carrito.
5. **Pruebas** (`tests/`, `instalador/tests`): actualizar las que comparan textos; no borrar ninguna.
**No se toca:** datos de clientes, bitácoras, historial de Git, nombres de tablas.

## Pasos (en orden, una rama `marca/cambio-nombre`)
1. Crear `apps/web/src/brand.ts` (y su espejo en la API) con **una sola constante** del nombre y los textos; reemplazar los textos sueltos por esa constante.
2. Cambiar textos visibles zona por zona, con captura antes y después en 390 y 1440.
3. Aceptar variables dobles `NEXORA_*` y `<NUEVO>_*`.
4. Reemplazar logotipo y favicon (solo si no empieza con N).
5. Correr `pnpm check`, e2e completo, `windows-installer` y `render-images`; los 3 CI en verde.
6. Documentos y página pública con el nombre nuevo.
7. Despliegue del producto (web y API) por Nexora 1; la tienda **no** cambia de nombre hasta decisión de la dueña.
8. Dominio nuevo: apuntar a Render, certificado, redirección 301 desde el dominio viejo.
Estimación: 8 a 14 horas de constructor + 2 de revisión; riesgo medio por el instalador y las variables.

## Quién
Constructor: ChatGPT (cuota vuelve el 2-nov), DeepSeek (cuando tenga cuota) o Claude PC con Gemini; revisa y despliega Nexora 1 o su relevo.
