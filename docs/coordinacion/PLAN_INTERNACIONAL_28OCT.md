# Plan: producto internacional, web en español e inglés (orden de la dueña, 28-oct-2026)

**Decisión de la dueña:** la web debe tener la opción **español / inglés** para que todo el mundo la pueda usar, y el nombre de la marca debe ser **internacional**, no latino. Esto queda anotado como trabajo a hacer; no se empezó todavía.

## Lo que cambia
1. **Nombre de marca internacional** (auditoría `docs/marca/AUDITORIA_NOMBRE_MARCA.md`, requisito actualizado).
2. **Internacionalización (i18n) de la interfaz**: selector ES/EN en la portada y en Configuración; el idioma se guarda por usuario y por negocio; el predeterminado sale del navegador. Todos los textos visibles salen del código a archivos de traducción (`es.json`, `en.json`); los mensajes de error de la API también (código de error + texto traducido en el cliente).
3. **Formatos locales**: fecha, número, moneda por negocio (hoy RD$ fijo), huso horario por negocio.
4. **Cumplimiento por país (lo más grande):** NCF, DGII, 606/607/608, ITBIS y ONAPI son **solo de República Dominicana**. Para otros países hay que hacer «paquetes fiscales» por país (impuestos, comprobantes, reportes). Primero: negocios de otros países pueden usar el sistema **sin facturación fiscal** (recibos internos) hasta que exista su paquete. Decidir con contador/abogado qué países primero.
5. **Documentos legales, precios y página pública en los dos idiomas**; precio en USD además de DOP.
6. **Procesador de pagos internacional** (Stripe u otro) además del local.
7. **Asistente de IA** y textos de correo en el idioma del usuario.

## Fases propuestas
| Fase | Qué | Quién | Estimación |
|---|---|---|---|
| I-0 | Decidir nombre internacional | Dueña + auditoría GPT/Gemini/DeepSeek | esta semana |
| I-1 | Infraestructura i18n (librería, archivos es/en, selector, formatos) sin traducir todo | Constructor (ChatGPT PC tras el 2-nov, o DeepSeek con cuota) | 12–20 h |
| I-2 | Extraer y traducir todos los textos de `apps/web/src` (~50 archivos, ver `docs/auditoria/MAPA_PANTALLAS.md`) y los errores de la API | Constructor + revisión de un humano bilingüe | 25–40 h |
| I-3 | Página pública, precios, legales, correos, soporte en EN | Constructor + abogado | 10–15 h |
| I-4 | Primer paquete fiscal fuera de RD (a decidir) | Contador local + constructor | por definir |

**Regla:** `App.tsx` y `styles.css` siguen con un solo dueño a la vez; I-1 toca `App.tsx` (selector) y debe esperar a que el dueño de ese archivo lo suelte. Ninguna traducción de términos fiscales (NCF, ITBIS) se inventa: se deja el término original con explicación.
