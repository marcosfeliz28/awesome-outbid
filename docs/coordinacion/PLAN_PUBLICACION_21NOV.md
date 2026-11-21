# Plan de publicación del producto Norexos (21-nov-2026)

Orden de Marcos: repartir entre Norexos 1 (Claude nube), ChatGPT (nube y PC), Dot y la IA local (Claude PC / Taller) todo lo que falta de la revisión de los 20 puntos «antes de publicar».
Base: auditoría del 21-nov sobre `producto-nexora` e7412e9f (9 hechos, 9 parciales, 2 faltan).

## Reglas para todos
- Cada quien solo toca lo suyo. Nada de dinero, base de datos ni API en las ramas de diseño.
- Rama propia por tarea (`claude/*`, `chatgpt-nube/*`, `chatgpt-pc/*`, `dot/*`, `claude-pc/*`), sobre la punta actual de `producto-nexora`.
- Entrega: rama + SHA + 3 CI en verde (verify, windows-installer, render-images; en producto también verify-product).
- Las guardas de diseño byte a byte no se reanclan: se registran como ediciones.
- Lo que no se sepa: `[FALTA DATO]`, nunca inventado. Norexos 1 revisa y publica; Marcos acepta.

## Cronograma

| Bloque | Cuándo | Quién | Tarea | Depende de |
|---|---|---|---|---|
| A1 | Hoy, mañana | **Norexos 1** | `/venta/`: sacar los 2 scripts en línea a un `.js` propio (la CSP los bloquea: idioma ES/EN y animación no funcionan) | — |
| A2 | Hoy, mañana | **Norexos 1** | Meta description y etiquetas OG/Twitter en la PWA y `/venta/`; `favicon.ico`, `apple-touch-icon.png` (180), íconos PNG 192/512 en el manifest | B2 (imagen OG) |
| A3 | Hoy, tarde | **Norexos 1** | Página 404 propia en nginx (ruta inexistente → 404 real con página de la marca) | B4 (texto) |
| A4 | Hoy, tarde | **Norexos 1** | Velocidad de la PWA: quitar el modulepreload de charts y document-export (LCP 4,4 s → < 2,5 s) | — |
| A5 | Mañana | **Norexos 1** | Anti-spam del registro: campo trampa (honeypot) + tiempo mínimo; Turnstile si Marcos lo aprueba | — |
| A6 | Al tener dominio | **Norexos 1** | Publicar la landing (`apps/landing`) como sitio estático en Render con CSP y HSTS; sitemap/robots al dominio real; robots.txt de la PWA | D2 |
| A7 | Hoy | **Norexos 1** | Pasar al producto el aviso de margen bajo y el conteo ciego (en curso, rama aparte) | — |
| B1 | Hoy | **ChatGPT nube** | Landing ES/EN: CTA principal «Probar gratis por WhatsApp» (usa `[NÚMERO]` hasta que Marcos lo dé) y quitar «El canal de contacto se anunciará aquí» | — |
| B2 | Hoy | **Dot** | Imagen para compartir 1200×630 (marca Norexos, sin precios ni promesas de IA) en `apps/web/public/` y `apps/landing/` | — |
| B3 | Hoy | **ChatGPT nube** | `/venta/`: quitar `[FALTA DATO: dominio]` del pie; dejar `[CORREO]` y `[NÚMERO]` marcados para llenarlos de una vez | — |
| B4 | Hoy | **ChatGPT PC** | Texto y diseño de la página 404 (ES/EN, botón «Volver al inicio») como HTML estático simple, sin scripts en línea | — |
| B5 | Mañana | **ChatGPT PC** | Revisión de textos de venta: 4 planes, prueba de 7 días, sin promesas de IA en Autoservicio hasta que Marcos decida | — |
| C1–C8 | Hoy, noche | **IA local** | Borradores «sin revisar» (ver cola local, bloque 21-nov) | — |
| D1 | Cuando pueda | **Marcos** | Abogado: términos SaaS y política de privacidad B2B de Norexos (hoy solo hay borradores a nombre de Grupo Macgen) | C1–C2 sirven de base |
| D2 | Cuanto antes | **Marcos** | Dominio definitivo (norexos.net / norexos.ai / nexorapos.net), número de WhatsApp de ventas y correo de soporte | — |
| D3 | Cuando pueda | **Marcos** | Analítica: ninguna / sin cookies (Plausible, Cloudflare) / GA4 con banner | — |
| D4 | Pendiente | **Marcos** | IA en el plan Autoservicio: se queda o se quita | — |

## Orden de llegada a producción
1. A1, A3, A4 (código, sin depender de nadie).
2. B1–B4 + A2 (diseño y metadatos juntos, una sola mezcla).
3. A5 y A7.
4. Con D2: llenar número/correo/dominio en un solo commit y publicar la landing (A6).
5. Con D1: abogado aprueba → `PRODUCT_LEGAL_APPROVED` y, con la orden de Marcos, abrir el registro.

## Seguimiento
Cada entrega se anota aquí con rama, SHA y estado (✅ publicado, 🔍 en revisión, ⏳ pendiente).
