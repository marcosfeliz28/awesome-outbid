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
