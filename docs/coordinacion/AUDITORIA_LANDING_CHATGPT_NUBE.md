# Orden para ChatGPT NUBE — auditoría de solo lectura de la landing norexos.net

**Qué auditar:** rama `claude-pc/landing-norexos-net` (SHA de código verificado `ebcb245`; carpeta `apps/landing/`: `index.html`, `en/index.html`, `landing.css`, `robots.txt`, `sitemap.xml`, `icon.svg`). Notas previas: `docs/coordinacion/RESULTADOS_LANDING.md` y `docs/venta/PUBLICAR_LANDING_NOREXOS_NET.md`.

**Reglas:** solo lectura. No cambies archivos de la landing, no mezcles en `nexora-cloud`, no despliegues, no toques Render, claves, DNS ni dominio. Responde en español. Si encuentras algo, repórtalo; no lo corrijas.

## Revisa y reporta (aprobado / hallazgo + archivo y línea)
1. **Cifras y promesas:** ninguna cifra de marketing sin medir, ningún precio o plan inventado, ninguna promesa sin respaldo (por ejemplo «gratis», «más ventas», fiscal/DGII/e-CF).
2. **Marcadores de la dueña:** los `DECIDE-DUEÑA` están en ES y EN y cubren planes, precios, contacto `soporte@norexos.net` y destino `app.norexos.net`.
3. **Enlaces:** internos (`#...`, `en/`, `../`), `mailto:`, canonical, hreflang, sitemap y robots. Marca los externos que no se pueden comprobar sin red.
4. **Todo estático:** ninguna petición ni script/fuente/imagen de terceros; nada que envíe datos fuera.
5. **Accesibilidad:** contraste AA claro y oscuro, `alt`, foco visible, orden de encabezados, `lang`, enlace «Ir al contenido», teclado.
6. **Responsive:** 390 px y 1366 px sin desborde horizontal ni texto cortado.
7. **Español primero:** ES es la portada, EN es equivalente y sin textos que digan otra cosa.
8. **Seguridad (`seguridad-20`):** nada sensible en el HTML, sin credenciales, sin datos de producción.

## Entrega
Escribe el resultado en `docs/coordinacion/RESULTADOS_AUDITORIA_LANDING.md` (rama `nexora-chatgpt-nube`, desde `origin/nexora-cloud`): lista corta de hallazgos por gravedad y qué falta decidir a la dueña. Luego avisa a Claude.
