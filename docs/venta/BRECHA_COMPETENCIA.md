# Brecha competitiva de Norexos POS

**Corte:** 9 de noviembre de 2026.  
**Base revisada:** `origin/nexora-cloud` en `b249c6e4`.  
**Alcance:** tiendas pequeñas y medianas de República Dominicana. No es una
certificación fiscal ni una cotización comercial.

## Cómo leer la comparación

- “Sí” significa que existe evidencia pública o en el repositorio.
- “Parcial” significa que existe una parte, pero no el flujo completo que una
  tienda dominicana necesita.
- “No confirmado” significa exactamente eso: no se encontró evidencia pública
  suficiente. No se interpreta como “no existe”.
- Los precios públicos pueden cambiar, no incluyen necesariamente implantación,
  hardware, impuestos ni integración fiscal dominicana.

Los cuatro referentes se eligieron porque tienen una página para República
Dominicana (Alegra), una localización dominicana documentada (Odoo), presencia
declarada en República Dominicana (Vendty), o disponibilidad internacional en
170 países y español (Loyverse). En el último caso, la venta y el soporte fiscal
específico en República Dominicana quedan **no confirmados**.

## Comparación

| Criterio | Norexos POS | Alegra POS | Odoo POS | Loyverse POS | Vendty |
|---|---|---|---|---|---|
| NCF / e-CF de República Dominicana | **No.** Emite recibo interno y declara expresamente que no es comprobante fiscal (`apps/web/src/Prints.tsx:507-520`). Tiene preparación de solicitud NCF, no emisión (`apps/web/src/Management.tsx:4311-4365`). | La página dominicana ofrece POS y una página separada de factura electrónica; integración exacta POS→e-CF y tipos soportados: **no confirmado**. [A1][A2] | La documentación enumera localización para República Dominicana; el alcance exacto de e-CF en POS y la certificación necesaria: **no confirmado**. [O1][O2] | No se encontró localización DGII/NCF/e-CF. **No confirmado**. [L1] | Publica “facturación electrónica”, pero la página describe principalmente el esquema colombiano; cumplimiento DGII: **no confirmado**. [V1][V2] |
| ITBIS | **Sí, cálculo interno.** Fórmula con tasa configurable y modo incluido/adicional (`packages/shared/src/index.ts:326-353`); no equivale a declaración fiscal. | Facturación y contabilidad para la página dominicana; detalle de ITBIS en POS: **no confirmado**. [A1] | La localización dominicana existe; cálculo y declaración exactos deben validarse con un implantador. [O1] | Impuestos configurables de POS, pero ITBIS/DGII específico: **no confirmado**. [L1] | Impuestos y facturación electrónica anunciados; ITBIS dominicano: **no confirmado**. [V1] |
| Caja ciega | **Sí.** A la cajera no se le calcula ni devuelve el esperado; gerencia sí puede verlo (`apps/api/src/cash.ts:759-805`). | **No confirmado.** | **No confirmado.** | **No confirmado.** | **No confirmado.** |
| Inventario | **Sí.** Stock, lotes, vencimientos, recepciones, almacén Casa y traspasos (`apps/api/src/inventory.ts`, `apps/api/src/warehouses.ts:45-100`). | Sí, anunciado como parte de la administración del negocio/POS. [A1] | Sí; la página POS anuncia inventario integrado. [O2] | Sí; inventario básico y analíticas se anuncian gratis, inventario avanzado como complemento. [L1][L2] | Sí; anuncia inventario, compras, bancos y multi-almacén. [V1][V2] |
| Varias sucursales | **Parcial.** Los datos se aíslan por `branchId`, pero no hay flujo comercial terminado para que una dueña cree y administre varias sucursales desde el producto. | **No confirmado** en la página revisada. | Sí; la página anuncia “multi-store”. [O2] | Sí; anuncia gestión de múltiples tiendas. [L1] | Sí; anuncia multi-negocios, inventario centralizado y traslados. [V1] |
| Instalado / nube | Ambos caminos existen en documentación: servidor local Windows (`docs/INSTALADOR.md:1-59`) y despliegue web. La operación SaaS multiempresa todavía requiere validación comercial y de aislamiento. | Nube. [A1] | Nube o despliegue propio según edición; las personalizaciones/implantación se cotizan aparte. [O3] | Nube con aplicaciones móviles. [L1] | Nube; declara que no se instala y se usa desde navegador. [V2] |
| Venta sin internet | **Sí, con cola e idempotencia.** PWA/IndexedDB y sincronización (`apps/web/src/api.ts:391-523`, `apps/api/src/sales.ts:1534-1639`). | **No confirmado** en la página dominicana revisada. | Sí; la página anuncia operación online/offline y sincronización al reconectar. [O2] | La aplicación móvil puede registrar ventas; comportamiento completo sin conexión: **no confirmado** en las páginas revisadas. [L1] | Sí; lo anuncia explícitamente. [V1] |
| Soporte en español | La interfaz y manuales están en español; un SLA de soporte comercial todavía **no está confirmado**. | Sí; contacto y sitio en español. [A1] | Sitio y documentación en español; alcance y costo de implantación/soporte dependen del proveedor. [O2][O3] | Sitio, ayuda y aplicación en español. [L1][L2] | Sí; anuncia WhatsApp, chat, correo y teléfono. [V1][V2] |
| Precio público visto | El repositorio contiene propuestas internas, no una tarifa pública cerrada; no se cambia aquí (`docs/venta/PROPUESTA_PRECIOS.md`). | La URL de precios respondió, pero el precio no apareció en el HTML público recuperado: **no confirmado**. [A3] | One App Free; Standard US$38.90/usuario/mes o US$31.10 con pago anual; Custom US$76.20/usuario/mes o US$61 anualizados, según la página consultada. [O3] | POS, Dashboard, KDS y CDS anunciados gratis; complementos con prueba de 14 días, pero los importes se cargan por país y no quedaron verificables en el HTML consultado. [L2] | Emprendedor COP$155,000/mes; Profesional COP$85,000/mes con pago anual; otros planes en la misma página. Moneda y aplicabilidad contractual en RD deben confirmarse. [V2] |

## Lo que Norexos ya hace bien

1. **Caja ciega comprobable en el código**, una diferenciación útil para dueñas
   que quieren reducir sesgo al contar efectivo.
2. **Operación local y sin internet**, con cola idempotente, además de una ruta
   de instalación en Windows y respaldo diario.
3. **Inventario adaptado al negocio real:** lotes, vencimientos, almacén Casa,
   traspasos, recepción y lectura de facturas.
4. **Controles de administración específicos:** transferencias pendientes,
   solicitudes de anulación, auditoría y permisos por rol.
5. **Producto en español y orientado a tareas**, no un ERP genérico que exige
   una implantación extensa.

## Brechas y costo de cerrarlas

Estimación de ingeniería para planificar, no cotización. Se usa una referencia
ilustrativa de **US$35 por hora**; excluye certificados, proveedor fiscal,
abogado, hardware, impuestos, soporte permanente y homologación de terceros.

| Brecha | Evidencia de hoy | Cierre mínimo verificable | Horas | Costo ilustrativo |
|---|---|---|---:|---:|
| Emisión NCF/e-CF certificada | El ticket declara “DOCUMENTO NO FISCAL” (`Prints.tsx:507-520`). | Integrar un proveedor autorizado o certificarse: secuencias, XML/firma, estados DGII, QR, notas de crédito, contingencia, conciliación y pruebas. | 240–480 | US$8,400–16,800 + proveedor/certificados |
| Multi-sucursal autoservicio | Hay aislamiento técnico por sucursal, pero no alta/administración comercial completa. | Alta de sucursal, permisos, inventario por ubicación, consolidado, límites de plan, migraciones y pruebas de fuga. | 120–220 | US$4,200–7,700 |
| Soporte comercial medible | Hay manuales, no SLA ni operación de soporte demostrada. | Bandeja de tickets, prioridades, plantillas, horario/SLA, métricas, exportación y procedimiento de escalamiento. | 60–100 | US$2,100–3,500 |
| Inglés completo | El código no tiene capa i18n; las pantallas contienen texto español directo (`apps/web/src/AiUsage.tsx:67-81`, `AssistantPanel.tsx:45-86`). | Catálogo ES/EN, selector, persistencia, formatos regionales y revisión humana de cada texto de dinero/fiscal. | 160–280 | US$5,600–9,800 |
| Rendimiento a escala | Hay consultas y listas sin paginar, por ejemplo cursos y transferencias GV (`apps/api/src/gv.ts:184-229,968-995`). | Cursores, límites, búsqueda del servidor, virtualización y pruebas con 10k/100k registros. | 80–140 | US$2,800–4,900 |
| Mantenibilidad del núcleo | `sales.ts` tiene 5,162 líneas; promociones están triplicadas entre API, POS y cola offline. | Extraer servicios por dominio, contratos tipados y una única fórmula compartida, sin cambiar resultados. | 160–300 | US$5,600–10,500 |
| Onboarding y migración desde otro POS | Hay importadores de inventario/GV, no un asistente comercial general. | Mapeo CSV/XLSX, simulación, informe de errores, repetición idempotente y guía para clientes. | 80–160 | US$2,800–5,600 |

## Las cinco brechas que más impiden vender

1. **NCF/e-CF real y certificable.** Sin esto no se debe prometer facturación
   fiscal dominicana.
2. **Calidad y mantenibilidad del núcleo.** Antes de crecer, reducir el riesgo de
   que un cambio rompa venta, caja, inventario u operación offline.
3. **Onboarding/importación repetible.** Una tienda no compra si migrar su
   inventario y clientes es una semana de trabajo manual.
4. **Soporte con SLA y recuperación ensayada.** El comprador necesita saber qué
   ocurre si no puede vender y cuánto tardará la respuesta.
5. **Multi-sucursal y rendimiento probado.** Es la diferencia entre vender a una
   tienda pequeña y conservarla cuando abre otra ubicación.

**Orden propuesto:** calidad del núcleo y onboarding en paralelo; seleccionar
proveedor/camino fiscal; piloto con restauración y soporte medidos; después
multi-sucursal/rendimiento; finalmente expansión completa ES/EN.

## Fuentes públicas

Consultadas el **9 de noviembre de 2026**.

- [A1 · Alegra POS República Dominicana](https://www.alegra.com/rdominicana/pos/)
- [A2 · Alegra factura electrónica República Dominicana](https://www.alegra.com/rdominicana/factura-electronica/)
- [A3 · Alegra precios República Dominicana](https://www.alegra.com/rdominicana/precios/)
- [O1 · Odoo, localizaciones fiscales (incluye Dominican Republic)](https://www.odoo.com/documentation/18.0/applications/finance/fiscal_localizations.html)
- [O2 · Odoo Point of Sale](https://www.odoo.com/es_ES/app/point-of-sale)
- [O3 · Odoo precios](https://www.odoo.com/es_ES/pricing-plan)
- [L1 · Loyverse POS en español](https://loyverse.com/es)
- [L2 · Loyverse precios](https://loyverse.com/es/pricing)
- [V1 · Vendty POS](https://vendty.com/)
- [V2 · Vendty precios](https://vendty.com/precios)
- [DGII · Proveedores de servicios de facturación electrónica autorizados](https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/Proveedores-servicios-FE-autorizados.aspx)

