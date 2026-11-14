# 01 — Empresas C: ERP / administración (Odoo, ERPNext, Zoho Inventory, QuickBooks)

Consulta: 14-nov-2026. Solo lectura, sin cuentas. Lo que no pude ver lo digo; nada inventado.
Sustitución: **QuickBooks POS (Desktop) ya no existe** (ver sección 4); se anota QuickBooks Online como lo vigente.

## 1. Odoo (POS + l10n_do)

| Campo | Dato |
|---|---|
| Sede / a quién vende | Sede: sin fuente; pymes y empresas, retail y restaurantes. https://www.odoo.com/app/point-of-sale-features |
| Precio | Plan gratis de 1 app ($0); Standard $24.90 y Custom $49.00 por usuario/mes, con cifras US$31.10/38.90 y US$61.00/76.20 en la misma página sin etiquetar cuál es anual o mensual; el descuento aplica 12 meses a usuarios iniciales. https://www.odoo.com/pricing |
| IA | La página de POS no menciona IA. https://www.odoo.com/app/point-of-sale-features |
| Caja | Sesiones y pagos sin conexión que sincronizan al volver; escáner (varios códigos por producto, códigos con precio/peso); balanza, terminales de pago, cajón; pedidos en paralelo; búsqueda rápida de productos y clientes; PC, tablet, iPad, Android. Impresoras y periféricos vía IoT Box (fuente de terceros). https://www.odoo.com/app/point-of-sale-features ; https://ecosire.com/blog/odoo-pos-retail-guide |
| Privacidad / acceso | Varias cajeras, con badge o PIN; tiendas/franquicias gestionadas desde un punto central. Roles finos, 2FA y auditoría: no comprobado. https://www.odoo.com/app/point-of-sale-features |
| Idiomas | La página de POS no lista idiomas del POS: no comprobado. |
| Fiscal RD | Oficial: `l10n_do` (contabilidad base), `l10n_do_edi` (e-CF vía Infile; E31, E32, E33, E34; XML, eNCF y firma digital; requiere cuenta Infile), `l10n_do_reports`, `l10n_do_check_printing`. ITBIS 18 %, 16 %, 0 %, exento; retenciones ITBIS/ISR; propina 10 %. La página no menciona POS, ni los formularios 606/607/608, ni certificación DGII. https://www.odoo.com/documentation/master/applications/finance/fiscal_localizations/dominican_republic.html . Módulos de terceros (pagos, sin verificar su certificación): NEXPRINT e-CF POS https://apps.odoo.com/apps/modules/18.0/nexprint_l10n_do_pos_ecf ; Grupo LDE https://apps.odoo.com/apps/modules/19.0/l10n_do_ncf_lde |
| Diseño visual | **no visto**: mi captura de odoo.com dio «403 Forbidden» (la descarté). Texto del proveedor: pantalla «clara e intuitiva», web en Chrome/Firefox/Safari. Paleta, tipografía, tema oscuro y tamaño de botones: sin fuente. https://www.odoo.com/app/point-of-sale-features |

## 2. ERPNext (Frappe) POS

| Campo | Dato |
|---|---|
| Sede / a quién vende | Frappe (sede: sin fuente); pymes; gratis y de código abierto (GPL-3.0). https://frappe.io/erpnext/pricing |
| Precio | Autoalojado gratis. Frappe Cloud: sitios desde $5/mes, servidores desde $20/mes, dedicado desde $125/mes, prueba de 14 días; empresa a medida. https://frappe.io/erpnext/pricing |
| IA | Ninguna encontrada en fuentes oficiales: no comprobado. |
| Caja | El manual oficial solo dice que el POS crea facturas pagadas con efecto en inventario y pago en un paso; sin detalle de atajos ni escáner. https://docs.frappe.io/erpnext/user/manual/en/pos-invoice . Sin conexión: **no confirmado en documentación oficial**; hay complementos de terceros (X POS, MIT, para v16, https://github.com/kodlyft/xpos ; app para v15 donde las reglas de precio no funcionan sin conexión, https://kanakinfosystems.com/frappe/apps/15.0/point_of_sale ; apps comerciales desde $999, https://ecosire.com/apps/erpnext/erpnext-offline-pos ). Un comentario antiguo de usuario dijo que el modo sin conexión no funcionaba en v12/13. https://frappe.io/blog/blog/erpnext-features/offline-pos-in-erpnext-7 |
| Privacidad / acceso | No comprobado (roles/permisos de ERPNext existen, pero no leí fuente). |
| Idiomas | No comprobado. |
| Fiscal RD | No encontré localización oficial para RD: sin fuente. |
| Diseño visual | Visto (captura de la página principal, no del POS): https://frappe.io/erpnext — tema claro, fondo blanco, barra lateral estrecha de iconos de línea, logo azul «E», titular en serif grande y texto gris sobrio, botones: uno blanco con contorno («Start free trial») y uno negro («Contact us»); muy aireado, baja densidad. No vi la pantalla de caja. Captura: capturas/erpnext.png |

## 3. Zoho Inventory

| Campo | Dato |
|---|---|
| Sede / a quién vende | Zoho (sede: sin fuente); pymes con inventario y pedidos. https://www.zoho.com/inventory/pricing-comparison/ |
| Precio (USD por organización/mes, sin impuestos) | Free $0 (1 usuario, 50 pedidos); Standard $39 mensual / $29 anual (3 usuarios, 500 pedidos, 2 ubicaciones); Premium $99/$79 (5, 3 000, 4); Plus $159/$129 (10, 7 500, 6); Enterprise $299/$249 (10, 15 000, 10). https://www.zoho.com/inventory/pricing-comparison/ |
| IA | La página de precios lista «Contextual chat» y «Smart Product Recommendations» sin explicar; existe un enlace «AI in Zoho Inventory» que no pude abrir (404). Zia no confirmada para Inventory. https://www.zoho.com/inventory/pricing-comparison/ |
| Caja | **No es un POS**: el sitio de producto y la lista de funciones no mencionan POS. Sí tiene lectura y generación de códigos de barras y apps iOS/Android/Windows. https://www.zoho.com/inventory/features/ |
| Privacidad / acceso | Etiqueta «User access control» que limita datos por rol. 2FA y auditoría: no mencionados en las páginas leídas. https://www.zoho.com/inventory/pricing-comparison/ |
| Idiomas | «Facturación multi-idioma» listada; idiomas de la interfaz no listados; el selector de edición solo muestra inglés. https://www.zoho.com/inventory/kb/general-overview/zom-pricing-plans.html |
| Fiscal RD | Sin fuente. |
| Diseño visual | Visto (página de producto, no la app): https://www.zoho.com/inventory/ — tema claro, fondo rosa pálido, titulares muy grandes en negro con la frase clave en rojo coral, botón rojo sólido de acción y botón blanco con borde; barra superior blanca con logo multicolor; ilustración de una persona con cajas y tarjetas flotantes con cifras («To be Packed», «To be Shipped»). Alta legibilidad por contraste y tamaño. No vi la app. Captura: capturas/zoho_inventory.png |

## 4. QuickBooks (Intuit) — POS descontinuado

| Campo | Dato |
|---|---|
| Estado | QuickBooks Desktop Point of Sale 19 se descontinuó el 3-oct-2023; Intuit ya no acepta registros y deshabilitó pagos y tarjetas de regalo. Intuit remite a Shopify como alternativa. https://quickbooks.intuit.com/email/lpayments ; https://www.digitaltransactions.net/intuit-is-ending-support-for-quickbooks-pos-triggering-a-scramble-for-small-merchants-business/ ; https://quickbooks.intuit.com/learn-support/en-us/account-management/pos-v19-end-of-life/00/1199241 (el aviso 3-oct-2023 sale en resultados de búsqueda; solo leí completo el artículo de Digital Transactions) |
| Sustituto del mismo tipo | QuickBooks Online (contabilidad, no caja). Precio: NerdWallet cita $38 a $275 al mes; Intuit sube tarifas desde renovaciones del 1-ago-2026 (fuentes de terceros). https://www.nerdwallet.com/article/small-business/business-software/how-much-does-quickbooks-cost (no leí las cifras: la página no cargó el texto) |
| IA | Intuit Assist, incluido en planes de pago según un blog de terceros (sin verificar). https://dev.to/incubadora_6c1fc80706dda7/quickbooks-ai-features-review-2026-321m |
| Caja, acceso, idiomas, fiscal RD, diseño | Sin fuente / no comprobado. Captura de quickbooks.intuit.com: no visto (tiempo de espera agotado). |

## Lectura rápida para Norexos
- Ninguna de las cuatro es un POS de tienda con e-CF listo para RD: Odoo es la única con localización dominicana oficial (e-CF vía Infile) y POS propio con modo sin conexión y PIN de cajera; ERPNext y Zoho no mostraron nada fiscal RD; QuickBooks POS ya no se vende.
- Zoho Inventory y QuickBooks Online son administración, no caja.

## No pude comprobar
- Diseño real de la pantalla de caja de las cuatro (solo vi páginas de marketing; Odoo dio 403, QuickBooks no cargó).
- Roles, 2FA y auditoría de Odoo, ERPNext, Zoho y QuickBooks; idiomas del POS de Odoo y de ERPNext.
- Funcionamiento sin conexión del POS nativo de ERPNext; IA real de Zoho y de ERPNext.
- Si los módulos e-CF de Odoo (oficial y de terceros) tienen certificación DGII; si cubren el POS; los 606/607/608.
- Precios de QuickBooks Online (cifras exactas) y de Odoo (cuál es anual).
- Sede de Odoo.
- Varios datos (IoT Box de Odoo, módulos de terceros, QuickBooks Online) vienen de resúmenes de buscador o blogs de terceros, no de páginas oficiales leídas completas.

## URLs (consultadas 14-nov-2026)
https://www.odoo.com/app/point-of-sale-features · https://www.odoo.com/pricing · https://www.odoo.com/documentation/master/applications/finance/fiscal_localizations/dominican_republic.html · https://apps.odoo.com/apps/modules/18.0/nexprint_l10n_do_pos_ecf · https://apps.odoo.com/apps/modules/19.0/l10n_do_ncf_lde · https://ecosire.com/blog/odoo-pos-retail-guide · https://frappe.io/erpnext · https://frappe.io/erpnext/pricing · https://docs.frappe.io/erpnext/user/manual/en/pos-invoice · https://github.com/kodlyft/xpos · https://kanakinfosystems.com/frappe/apps/15.0/point_of_sale · https://ecosire.com/apps/erpnext/erpnext-offline-pos · https://frappe.io/blog/blog/erpnext-features/offline-pos-in-erpnext-7 · https://www.zoho.com/inventory/ · https://www.zoho.com/inventory/pricing-comparison/ · https://www.zoho.com/inventory/features/ · https://www.zoho.com/inventory/kb/general-overview/zom-pricing-plans.html · https://quickbooks.intuit.com/email/lpayments · https://quickbooks.intuit.com/learn-support/en-us/account-management/pos-v19-end-of-life/00/1199241 · https://www.digitaltransactions.net/intuit-is-ending-support-for-quickbooks-pos-triggering-a-scramble-for-small-merchants-business/ · https://www.nerdwallet.com/article/small-business/business-software/how-much-does-quickbooks-cost · https://dev.to/incubadora_6c1fc80706dda7/quickbooks-ai-features-review-2026-321m
