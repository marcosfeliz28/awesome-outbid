# Publicar la landing de Norexos en norexos.net

> Preparado por Claude PC el 2026-11-01 para la rama `claude-pc/landing-norexos-net`.
> **No ejecutado.** No se desplegó nada, no se tocó Render ni Cloudflare y no se
> registró ningún dominio. Lo ejecuta Claude nube cuando la dueña registre
> `norexos.net` y dé la orden escrita.

## 0. Qué se publica

- Carpeta: `apps/landing/` (HTML, CSS, `icon.svg`, `robots.txt`, `sitemap.xml`).
- Páginas: `/` (español) y `/en/` (inglés). Sin JavaScript, sin CDN, sin fuentes
  externas, sin cifras de precios.
- Enlace «Probar gratis»: `https://app.norexos.net/` (ver pendiente P1).
- Correo de soporte: `soporte@norexos.net` (debe existir antes de publicar, ver P3).

## 1. Servicio recomendado: sitio estático de Render

Render es el servicio que ya usa el proyecto y evita otra cuenta. Cloudflare Pages
sirve igual si la dueña prefiere; en ese caso los pasos de DNS cambian poco.

Plantilla de referencia: `docs/venta/dominio/render-landing.propuesta.yaml`
(revisarla antes de usarla; el nombre del servicio debe ser `norexos-landing`).

| Campo                   | Valor                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| Tipo                    | Static Site                                                             |
| Repositorio             | `marcosfeliz28/awesome-outbid`                                          |
| Rama                    | la que la dueña apruebe para publicar (no `nexora-cloud` hasta mezclar) |
| Comando de construcción | ninguno (dejar vacío)                                                   |
| Directorio a publicar   | `apps/landing`                                                          |
| Encabezados             | ninguno extra; la página no necesita CSP especial                       |
| Redirección `/en`       | no hace falta: `/en/` tiene su propio `index.html`                      |

## 2. Dominio y DNS (en el DNS de norexos.net)

Los valores exactos de Render (`*.onrender.com` o IP) aparecen al agregar el
dominio en el panel; no se inventan aquí.

| Tipo      | Nombre | Valor                                                         | Nota                                                 |
| --------- | ------ | ------------------------------------------------------------- | ---------------------------------------------------- |
| A o CNAME | `@`    | `<PENDIENTE: dato que da Render al agregar norexos.net>`      | En Cloudflare, nube gris hasta emitir el certificado |
| CNAME     | `www`  | `<PENDIENTE: nombre .onrender.com del sitio norexos-landing>` | Render redirige `www` al apex                        |
| CNAME     | `app`  | `<PENDIENTE: nombre .onrender.com del servicio POS>`          | Solo cuando se mueva el POS a `app.norexos.net`      |

## 3. Correo soporte@norexos.net

Ver `docs/venta/dominio/DNS_Y_CORREO.md` (sección 3). Hay que sustituir
`norexos.ai` por `norexos.net` en los valores de DMARC y en el buzón. Todos los
valores de MX, SPF y DKIM dependen del proveedor que elija la dueña: son
`<PENDIENTE>`, no se escriben a mano.

## 4. Redirección 301 desde nexorapos.net

**Orden obligatorio** (hoy `nexorapos.net` es el POS en uso; redirigirlo antes de
mover el POS deja sin acceso a las tiendas):

1. Publicar la landing en `norexos.net` y comprobar `https://norexos.net/` y `/en/`.
2. Mover el POS a `app.norexos.net` (CNAME `app` + dominio en el servicio del POS).
3. Comprobar que `https://app.norexos.net` entra al sistema.
4. Solo entonces crear la redirección de `nexorapos.net` y `www.nexorapos.net`
   a `https://norexos.net`, código **301**, conservando la ruta:
   - Cloudflare: Redirect Rules, dinámica, `concat("https://norexos.net", http.request.uri.path)`,
     con los registros de `nexorapos.net` en nube naranja.
   - Alternativa sin Cloudflare: `deploy/redirect-nexorapos.nginx.conf` con
     `return 301 https://norexos.net$request_uri;` (ajustar el dominio antes).

Nota: el CTA «Probar gratis» debe apuntar a `app.norexos.net` solo después del paso 3.

## 5. Certificado

- Render emite el certificado TLS automáticamente al verificar el dominio.
- Esperar a que aparezca «Certificate issued» en el panel antes de activar la
  nube naranja en Cloudflare (si se usa).
- Comprobar `https://norexos.net` sin advertencias.

## 6. Comprobaciones después de publicar

- `curl -sI https://norexos.net/` → `200`, `content-type: text/html`.
- `curl -sI https://norexos.net/en/` → `200`.
- `curl -s https://norexos.net/sitemap.xml` y `robots.txt` → contenido de `apps/landing/`.
- `https://www.norexos.net/` → redirige a `https://norexos.net/`.
- Repetir la verificación de Playwright (`docs/diseno/capturas/landing-norexos-net/`).
- Probar «Escribir a soporte» (mailto) en un correo real.

## 7. Pendientes que dependen de la dueña

- **P1.** Confirmar la dirección del POS para «Probar gratis» (`app.norexos.net`).
- **P2.** Registrar `norexos.net` y dar acceso al DNS.
- **P3.** Elegir el proveedor de correo de `soporte@norexos.net` y entregar sus registros.
- **P4.** Aprobar los planes y precios (hoy la sección dice «Próximamente»).
- **P5.** Confirmar la frase «Funciona con o sin internet» antes de publicar
  (la caja sí debe operar sin conexión; verificar con una prueba real).
- **P6.** Confirmar que se pueda decir «Reportes de ventas» (texto nuevo, no aprobado).
- **P7.** Decidir si se vuelve a incluir NCF/DGII (hoy fuera de la v1, según
  `docs/venta/META_DESCRIPCIONES.md`).
- **P8.** Auditoría de marca «Norexos» (`docs/marca/AUDITORIA_NOMBRE_MARCA.md`)
  antes de publicar en público.

## 8. Qué NO hace esta landing

Sin e-CF, sin DGII, sin «respaldo cifrado», sin «control de acceso», sin cifras
de crecimiento, sin precios.
