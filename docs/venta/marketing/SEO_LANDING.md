# Revisión SEO de la landing (ES y EN)

Hecha a mano: los skills `searchfit-seo:*` no están disponibles en esta sesión. Alcance: `apps/landing/`. Nada se publica sin orden de la dueña.

## Ya estaba bien

Título y descripción por idioma, `canonical`, `hreflang` es-DO/en/x-default, Open Graph, `robots.txt`, `sitemap.xml`, enlace «saltar al contenido», `lang` en los enlaces de idioma.

## Cambiado en esta rama (mínimo, sin precios ni promesas)

- Datos estructurados JSON-LD (`Organization`, `WebSite`, `SoftwareApplication` sin `offers`) en ES y EN.
- `twitter:card`; `aria-labelledby` en las secciones con su `h2`.
- Pregunta nueva en las FAQ: **«¿Norexos emite NCF o e-CF?» → No** (ES y EN).

## Pendiente (depende de la dueña) — [COMPLETAR]

| Tema                     | Detalle                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Dominio                  | `norexos.net` está en canonical/sitemap; el contrato usa `soporte@norexos.ai`. Unificar: [COMPLETAR] |
| Imagen social            | No hay `og:image` ni `og:image:alt`; hace falta una imagen 1200×630: [COMPLETAR]                     |
| Contacto                 | WhatsApp y correo reales; luego se agregan al JSON-LD (`contactPoint`) y a la página: [COMPLETAR]    |
| Nombre legal             | Para `Organization.legalName`: [COMPLETAR]                                                           |
| Lead dice «comprobantes» | Puede leerse como fiscal; sugerir «recibos» cuando la dueña apruebe el texto                         |
| `LANDING_TEXTOS.md`      | Sigue diciendo que emite NCF y menciona «Nexora»: contradice la regla actual; corregir el borrador   |
| Páginas                  | Una sola página por idioma; para posicionar hacen falta páginas por tema (no se crean sin pedido)    |
