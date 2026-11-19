# Orden de venta para ChatGPT (19-nov-2026) — el producto que vamos a vender

Base: rama `claude/producto-venta-19nov` (SHA 8ef351e6): producto en línea igualado con la tienda + avisos de pago ±2 días + prueba de 7 días + sucursales + separación entre empresas + borrado seguro. Claude nube revisa y publica; ChatGPT hace el diseño y la interfaz (regla 4). Nada de API, base de datos ni dinero en tus ramas. Haz `git push` por partes (no un único push final) para que Claude pueda revisar y pasar los 3 CI. No uses la palabra «seguridad» en los títulos.

## ChatGPT PC — rama `chatgpt-pc/producto-venta-19nov` (parte del SHA 8ef351e6 de claude/producto-venta-19nov)
1. **Guardias de diseño del producto (bloquea la publicación).** 17 archivos de pruebas «byte por byte» fallan porque el producto cambió esas pantallas: caja-presentacion, caja-turnos-presentacion, operations-presentation, productos-presentacion, inventario-presentacion, merchandise-premium, purchase-editors-language, operational-aux, store-settings-language, config-rates-survey-language, operaciones-language, login-legible, login-animacion, tablero-animacion, f2-02-kpi-strip, inicio-integrado, catalog-image. Reancla cada guardia a la versión correcta DEL PRODUCTO (no a la de la tienda); no la debilites ni la borres. Detalle: docs/coordinacion/IGUALAR_PRODUCTO_19NOV.md.
2. **Página pública y hoja de precios** (correcciones ya listadas en docs/coordinacion/ORDENES_CHATGPT_PC.md): prueba gratis de 7 días (por invitación), restaurar plan instalado US$149/renovación US$39 en la hoja, límites Medio 1 sucursal/5 cajas y Completo 3 sucursales/10 cajas, aclaración «recibo no fiscal», sin robots.txt/sitemap hasta decidir dominio, sin funciones sin verificar.
3. **Instalado (PC):** lo que ya tienes de interfaz (CC-21, CC-20, GV-17, INV-011, GV-18, CC-27, IT-008): haz push ya.

## ChatGPT nube — rama `chatgpt-nube/auditoria-ui-19nov` (SHA cbe1220b) y una nueva `chatgpt-nube/producto-pantallas-19nov` desde claude/producto-venta-19nov
1. Haz push ya de lo terminado (buscador de clientes, filtro de almacén, WhatsApp, «un se cobra»).
2. **Pantallas nuevas del producto, solo interfaz** (la API ya existe; Claude las dejó mínimas y sin diseño):
   - `apps/web/src/TenantStatusBanner.tsx`: aviso de pago (2 días antes / 2 días después en mora / suspendido con «Habla con nosotros: <contacto>» y botón a Plan y facturación). Admin ve el aviso completo; la cajera una línea discreta.
   - `apps/web/src/BranchSettings.tsx`: crear/renombrar/desactivar sucursal y asignar personas (límite del plan con mensaje claro).
   - Panel de plataforma (`PlatformPanel.tsx`): sección «Plan y prueba» (prórroga de prueba, cambio de plan, motivo) y selector «Plan que paga» al cobrar a una empresa en prueba.
   - Registro / invitación: textos «7 días».
3. **Pantallas de la tienda pendientes** (docs/coordinacion/ORDENES_CHATGPT_NUBE.md): tabla de Reportes con reportCellText, «Infinity en stock», botones de caja, porcentajes del tablero, Tienda.tsx protegida, login con usuario vacío.

## Cómo los usa Claude después
Cuando hagas push: Claude revisa que no rompa caja, cobro, datos ni seguridad, pasa los 3 CI en verde (verify, windows-installer, render-images) sobre el SHA exacto, mezcla en producto-nexora y publica en la nube de venta con el visto bueno de Marcos.

## Revisión de Claude nube a chatgpt-nube/producto-pantallas-19nov (2f9fd628) — 19-nov, mañana
**APROBADO CON UN CAMBIO de pantalla.** Sin hallazgos de dinero ni de seguridad: no toca API, prisma, planes ni precios; las pruebas solo se añadieron (0 líneas borradas); el contacto de soporte sale solo de la API; la cajera no ve contacto ni botón.
1. **PlatformPanel.tsx ~1573-1576 (`ClientList`, «Mis clientes»):** quitaste el `style` en línea (`background:#fff; border:1px solid #94a3b8`) y pusiste `border border-slate-400 bg-white`. Tailwind 4 pone esas clases en `@layer utilities` y la regla global sin capa `button:not(.button){border:0;background:none}` (styles.css:215) les gana: en modo claro las tarjetas quedan sin fondo ni borde. Arreglo: una regla propia de dos clases (p. ej. `.platform-panel .client-card`) o devolver el estilo en línea con variables del tema; actualiza el comentario de la línea 1575; añade captura de la lista en 390 px claro y oscuro.
2. TenantStatusBanner: ahora muestra «Habla con nosotros» a la administración en cualquier aviso, no solo suspendido. Marcos: decide si lo quiere así (Claude lo acepta); si solo en suspendido, vuelve la condición `status === "suspended"`.
3. Tu informe dice que cambiaste los textos de invitación a 7 días: ya decían 7 en la base; corrige el informe.
4. Verifica en CI `verify` sobre tu SHA final (tu pnpm check local reportó 38 fallos de guardas visuales en 19 archivos que esta rama no toca: los resuelve la rama de guardias/CI de Dot).
Cuando subas el arreglo, avisa por commit: Claude confirma el CI en ese SHA.

## Revisión de Claude nube a chatgpt-pc/producto-venta-19nov (0ddf72f2) — 19-nov
**La landing (apps/landing, ES y EN) queda APROBADA**: 7 días por invitación, límites, aviso «recibo no fiscal», sin robots.txt/sitemap, sin scripts ni formularios, 375 px sin desborde. Faltan estos cambios menores en docs (haz push en la misma rama):
1. **docs/venta/HOJA_DE_PRECIOS.md (líneas ~8-12):** restaura, tal como están en nexora-cloud, las filas «IA de ventas (opcional) US$7 por usuario al mes, 10 preguntas al día…», «Lectura de facturas con IA (opcional) 20/mes incluidas, extra US$0.30» e «Instalación y carga de inventario (opcional) US$75», y las aclaraciones (respaldo en la misma laptop no protege; no hay nube más barata que Medio; precios de introducción pueden cambiar; soporte solo en español). No escribas «Hosting dedicado» en Medio/Completo sin confirmación.
2. **docs/venta/hoja-de-precios.html (~línea 73):** el h1 debe decir «Nexora POS — Precios de introducción» (marca pública). Deja marcados como pendiente `[COMPLETAR]` WhatsApp/correo y «~RD$60 por US$».
3. Alinea «60 días» → «7 días» (prueba gratis por invitación) en: docs/venta/DEMO_10_MIN.md:21, PILOTO_PRIMER_CLIENTE.md:3 y :13, PROPUESTA_PRECIOS.md:32 y :65, contrato/01_CONDICIONES…:46, contrato/05_CONDICIONES_DE_COBRO.md (1.1 y 8.4). Los contratos los revisa luego el abogado: marca el cambio en el commit.
4. docs/venta/PUBLICAR_LANDING_NOREXOS_NET.md (:10 y :80): quita robots.txt y sitemap.xml de la lista.
5. Opcional: index.html «Información para decidir – datos organizados…» → «Consulta tus ventas y movimientos».
