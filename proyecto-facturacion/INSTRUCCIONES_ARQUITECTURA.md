# 📘 Documento Maestro de Arquitectura — App de Facturación e Inventario "FitStore POS"
### Tienda multicategoría: Suplementos · Ropa deportiva · Fajas · Accesorios de gimnasio · Maquillaje

> **Para ChatGPT (o cualquier asistente/desarrollador):** este documento es la fuente única de verdad del proyecto. Trabaja de forma **continua y autónoma**, fase por fase, siguiendo el orden de la sección 16. Solo consulta al dueño del proyecto cuando: (a) una decisión de negocio no esté definida aquí, (b) haya una contradicción, o (c) necesites credenciales/datos reales. Para todo lo demás, aplica las **decisiones por defecto** de la sección 18 y documenta lo que asumiste.

---

## 0. Índice
1. Visión y objetivos
2. Alcance de la Fase 1 (y lo que NO entra)
3. Investigación de mercado: comparación con soluciones existentes
4. Usuarios, roles y permisos
5. Módulos funcionales (requisitos detallados)
6. Reglas de negocio y fórmulas
7. Pagos (efectivo, transferencia, tarjeta y combinaciones)
8. Estadísticas, reportes y alertas
9. Arquitectura técnica (stack recomendado)
10. Modelo de base de datos
11. API (endpoints)
12. Diseño UI/UX y sistema visual
13. Pantallas (wireframes descritos)
14. Seguridad, auditoría y respaldos
15. Requisitos no funcionales
16. Plan de trabajo por etapas (roadmap para el desarrollador)
17. Criterios de aceptación y pruebas
18. Decisiones por defecto (supuestos)
19. Preguntas abiertas para el dueño
20. Prompt listo para pegar en ChatGPT

---

## 1. Visión y objetivos

Construir una aplicación de **punto de venta (POS), facturación e inventario** que funcione en **PC (Windows/Mac), celulares (Android/iOS) y navegador web**, con una sola base de código y una sola base de datos central, para una tienda que vende:

| Categoría | Ejemplos | Particularidades de inventario |
|---|---|---|
| Suplementos | Proteína, creatina, pre-entreno, vitaminas | **Lote y fecha de vencimiento**, sabor, tamaño (lb/servicios) |
| Ropa deportiva | Leggings, tops, camisetas, shorts | **Variantes talla × color** |
| Fajas | Fajas colombianas, cinturillas, chalecos | Talla, nivel de compresión, color |
| Accesorios de gym | Guantes, straps, shakers, bandas, cinturones | Talla opcional, color |
| Maquillaje | Bases, labiales, pestañas, skincare | **Tono**, lote y **vencimiento** |

**Objetivos medibles:**
- Facturar una venta en **menos de 30 segundos** (escaneo o búsqueda + cobro).
- Saber en tiempo real: inventario, ganancia, gastos y qué productos se mueven o no.
- Detectar automáticamente productos **bajo mínimo**, **sin movimiento** y **próximos a vencer** para sacarlos en **ofertas especiales / liquidación**.
- Cualquier vendedor puede vender cualquier producto de cualquier categoría.

---

## 2. Alcance de la Fase 1

### ✅ Incluye
- POS / facturación con múltiples métodos de pago y pagos combinados.
- Catálogo de productos con categorías, variantes, códigos de barra, lotes y vencimientos.
- Inventario: entradas (compras), salidas (ventas), ajustes, mermas, devoluciones, conteo físico.
- Proveedores y compras (con costo real de entrada).
- Clientes (básico: nombre, teléfono, cédula/RNC, historial).
- Gastos operativos (alquiler, luz, nómina, publicidad, etc.).
- Caja: apertura, cierre, arqueo, entradas/salidas de efectivo.
- Estadísticas y dashboard, reportes exportables (PDF/Excel).
- Alertas (stock bajo, sin rotación, vencimiento, gasto excedido, margen bajo).
- Promociones y ofertas de liquidación.
- Usuarios, roles, permisos y bitácora de auditoría.
- Funcionamiento **offline** en el POS con sincronización.

### ❌ Fuera de la Fase 1 (Fase 2+)
- Tienda en línea / e-commerce y catálogo público.
- Multi-sucursal (dejar el modelo de datos **preparado**: campo `branch_id`).
- Programa de lealtad/puntos avanzado, comisiones complejas por vendedor (en Fase 1 solo reporte de ventas por vendedor).
- Contabilidad completa (catálogo de cuentas, asientos).
- Integración directa con pasarela de pagos (en Fase 1 la tarjeta se registra manualmente con su número de aprobación del datáfono).
- Facturación electrónica oficial (dejar **preparado**; ver pregunta 19).

---

## 3. Investigación de mercado: comparación con soluciones existentes

| Solución | Fortalezas que copiamos | Debilidades que evitamos |
|---|---|---|
| **Square POS** | POS rápido y bonito, pagos divididos, reportes claros | Enfocado en EE.UU., inventario por lote débil |
| **Shopify POS** | Variantes talla/color excelentes, diseño limpio | Costoso, depende del e-commerce |
| **Loyverse** | Gratis, offline, multi-dispositivo, alertas de stock bajo | Reportes avanzados y vencimientos solo de pago/limitados |
| **Lightspeed Retail** | Inventario profundo, matriz de variantes, compras a proveedor | Caro, curva de aprendizaje alta |
| **Odoo POS + Inventario** | Lotes, vencimientos, módulos integrados | Complejo de configurar, pesado |
| **Alegra / Siigo** (LatAm) | Facturación fiscal latinoamericana, reportes contables | POS menos ágil, diseño más "contable" |
| **Vendty / Treinta** (LatAm) | Simples, pensados para pequeños negocios, móvil | Analítica limitada |

**Conclusión del arquitecto:** construimos un sistema con la **rapidez y diseño de Square/Shopify**, la **matriz de variantes de Lightspeed**, el **control de lotes/vencimiento de Odoo**, el **offline de Loyverse** y la **adaptación fiscal local de Alegra**, pero **simple** para el día a día.

Funcionalidades "estándar de la industria" que deben existir sí o sí: búsqueda instantánea, escáner de código de barras (incluso con la cámara del celular), ticket térmico 80mm y 58mm, factura A4 PDF, envío del recibo por WhatsApp/correo, devoluciones con nota de crédito, descuentos por línea y por total, cierre de caja con arqueo, reportes por rango de fechas, exportación a Excel.

---

## 4. Usuarios, roles y permisos

| Rol | Puede |
|---|---|
| **Administrador (dueño)** | Todo. Configuración, costos, ganancias, usuarios, eliminar/anular, ver todos los reportes |
| **Gerente/Encargado** | Inventario, compras, gastos, reportes, aprobar descuentos altos y anulaciones, cierre de caja |
| **Vendedor/Cajero** | Vender cualquier producto, cobrar, abrir/cerrar su caja, ver stock y precio de venta. **NO ve costos ni ganancias** |
| **Almacén** (opcional) | Recibir mercancía, ajustes con motivo, conteo físico |

- Permisos **granulares** (matriz rol × permiso) editables por el admin.
- Descuentos: el vendedor puede aplicar hasta X% (configurable, por defecto 10%); por encima requiere **PIN del gerente**.
- Anular factura: solo gerente/admin, siempre con motivo; queda en auditoría.
- Login con correo + contraseña; en el POS, cambio rápido de vendedor con **PIN de 4–6 dígitos**.

---

## 5. Módulos funcionales

### 5.1 Productos y catálogo
- Campos: nombre, SKU, código(s) de barra, categoría, subcategoría, marca, proveedor principal, descripción, foto(s), unidad, **costo**, **precio de venta**, precio mayorista (opcional), impuesto aplicable (sí/no y tasa), stock mínimo, stock máximo, ubicación en tienda, estado (activo/inactivo).
- **Variantes**: atributos configurables por categoría (talla, color, sabor, tamaño, tono). Generación automática de la matriz (ej.: leggings S/M/L/XL × negro/azul = 8 SKU), cada variante con su stock, código de barra y (opcionalmente) precio propio.
- **Lotes y vencimiento** (suplementos y maquillaje obligatorios; otros opcionales): número de lote, fecha de vencimiento, cantidad por lote. Salida por **FEFO** (primero en vencer, primero en salir).
- **Kits/combos** (ej.: "Proteína + Shaker"): producto compuesto que descuenta inventario de sus componentes.
- Importación masiva desde Excel/CSV con plantilla descargable y validación.
- Generación e impresión de **etiquetas con código de barras**.

### 5.2 Punto de venta (POS) / Facturación
- Búsqueda por nombre, SKU o escaneo (lector USB/Bluetooth o cámara).
- Carrito: cantidad, descuento por línea (% o monto), descuento global, nota.
- Selección de cliente (o "Consumidor final"); crear cliente rápido.
- Venta asignada al **vendedor** que la realiza (para reportes).
- Cobro con pagos múltiples (sección 7), cálculo de cambio/devuelta.
- Ventas **en espera** (aparcar carrito y retomarlo).
- Cotizaciones/proformas convertibles en factura.
- Impresión: ticket térmico 58/80 mm, factura A4 PDF, envío por WhatsApp/correo.
- Devoluciones y cambios (ej.: cambio de talla) → nota de crédito, reingreso a inventario o a merma si el producto está dañado/abierto (suplementos y maquillaje abiertos **no** regresan a stock vendible).
- Ventas a crédito (opcional, configurable) con cuentas por cobrar y abonos.
- Numeración secuencial de facturas, sin huecos; anulaciones visibles, nunca borradas.

### 5.3 Inventario
- Kardex por producto/variante (historial de cada movimiento con fecha, usuario, tipo, cantidad, costo, saldo).
- Tipos de movimiento: compra, venta, devolución de cliente, devolución a proveedor, ajuste (+/−) con motivo, merma (vencido, dañado, robo, muestra/probador), transferencia (futuro multi-sucursal), conteo físico.
- **Conteo físico** con el celular (escaneando), comparación teórico vs. real y ajuste aprobado.
- Valorización del inventario a **costo promedio ponderado**.

### 5.4 Compras y proveedores
- Proveedores: nombre, RNC/ID fiscal, contacto, teléfono, condiciones de pago.
- Orden de compra → recepción (total o parcial) → actualiza stock, costo promedio, lotes y vencimientos.
- Costos adicionales de importación/flete prorrateables al costo del producto (**costo de aterrizaje**).
- Cuentas por pagar a proveedores y registro de pagos.
- **Sugerencia de compra** automática basada en consumo promedio y stock mínimo.

### 5.5 Gastos
- Categorías: alquiler, electricidad, agua, internet, nómina, comisiones, publicidad/redes, transporte, empaques/bolsas, mantenimiento, impuestos, otros.
- Gasto: fecha, categoría, monto, método de pago, proveedor (opcional), comprobante (foto), recurrente (mensual).
- **Presupuesto mensual por categoría** → alerta cuando se supera el 80% y el 100%.

### 5.6 Caja
- Apertura con monto inicial, por usuario/terminal.
- Entradas y salidas de efectivo (ej.: pago a mensajero) con motivo.
- Cierre: sistema calcula esperado por método (efectivo, tarjeta, transferencia); cajero declara lo contado; muestra **diferencia (sobrante/faltante)**. Reporte de cierre imprimible.

### 5.7 Clientes
- Nombre, teléfono, correo, cédula/RNC, fecha de cumpleaños (para promociones), historial de compras, total gastado, última compra.

### 5.8 Promociones y ofertas especiales (liquidación)
- Tipos: % de descuento, monto fijo, 2x1, 3x2, segundo a mitad de precio, combo con precio especial, precio especial por rango de fechas.
- Aplicables a producto, variante, categoría, marca o lote específico.
- **Asistente de liquidación**: lista los productos candidatos (sección 8.3) y permite crear la promoción con un clic, mostrando el margen resultante y avisando si se vende bajo costo.

### 5.9 Configuración
- Datos del negocio (nombre, logo, RNC, dirección, teléfono), moneda, impuestos, formato de factura, numeración, impresoras, % máximo de descuento por rol, umbrales de alertas, tema claro/oscuro.

---

## 6. Reglas de negocio y fórmulas

- **Costo promedio ponderado** al recibir compra:
  `nuevo_costo = (stock_actual × costo_actual + cant_recibida × costo_unit_recibido) / (stock_actual + cant_recibida)`
- **Costo de aterrizaje** = costo factura proveedor + (flete + aduana + otros) prorrateado por valor o por unidades.
- **Subtotal línea** = cantidad × precio − descuento línea.
- **Impuesto** calculado por línea sobre la base gravada (configurable precio con impuesto incluido o no). Redondeo a 2 decimales al final por línea; total = Σ líneas.
- **Ganancia bruta** = ventas netas − costo de lo vendido (costo guardado **en el momento de la venta**, no el actual).
- **Margen %** = ganancia bruta / ventas netas × 100.
- **Markup %** = (precio − costo) / costo × 100.
- **Ganancia neta** del período = ganancia bruta − gastos del período.
- **Punto de equilibrio mensual** = gastos fijos / margen promedio %.
- **Rotación de inventario** = costo de lo vendido / inventario promedio a costo.
- **Días de inventario** = stock actual / venta diaria promedio (últimos 30 días).
- **Punto de reorden** = venta diaria promedio × días de entrega del proveedor + stock de seguridad.
- **Ticket promedio** = ventas netas / número de facturas.
- **Clasificación ABC**: A = productos que suman 80% de la venta, B = siguiente 15%, C = último 5%.
- No se permite vender con stock negativo (configurable: permitir con advertencia).
- Nada se borra: se **anula** o **desactiva**, siempre con usuario, fecha y motivo.

---

## 7. Pagos

Métodos: **Efectivo**, **Transferencia bancaria**, **Tarjeta de crédito/débito**; preparado para agregar otros (crédito de tienda, nota de crédito, pago móvil, etc.).

- Una factura puede tener **N pagos** de distintos métodos (ej.: RD$2,000 efectivo + RD$1,500 tarjeta + RD$500 transferencia).
- La pantalla de cobro muestra: total, pagado, **pendiente** y **cambio** en grande.
- Solo el **efectivo** genera cambio.
- **Transferencia**: banco, número de referencia y opcional foto del comprobante; estado *pendiente de verificación* → *verificada* (gerente).
- **Tarjeta**: tipo (crédito/débito), marca (Visa/Mastercard/Amex), últimos 4 dígitos, número de aprobación. Comisión del banco configurable (%) para calcular la ganancia real.
- No se puede cerrar la factura hasta que pagado ≥ total (salvo venta a crédito autorizada).
- Botones rápidos: "Monto exacto", billetes comunes (100, 200, 500, 1000, 2000).
- Reporte de ventas por método de pago y conciliación diaria.

---

## 8. Estadísticas, reportes y alertas

### 8.1 Dashboard (pantalla de inicio del admin)
Tarjetas KPI: ventas de hoy / semana / mes (con % vs. período anterior), ganancia bruta, gastos del mes, ganancia neta, ticket promedio, # facturas, valor del inventario a costo y a precio de venta.
Gráficos: ventas por día (línea, últimos 30 días), ventas por categoría (barras), top 10 productos, ventas por vendedor, ventas por método de pago, horas y días pico (mapa de calor), gastos por categoría vs. presupuesto.

### 8.2 Reportes (filtro por fechas, categoría, vendedor, método de pago; exportar PDF/Excel)
1. Ventas detalladas y resumidas.
2. **Consumo mensual** por producto/categoría (unidades y montos, comparativo mes vs. mes y año vs. año).
3. Utilidad por producto, categoría y marca.
4. Inventario valorizado y kardex.
5. Productos bajo stock mínimo y sugerencia de compra.
6. Productos sin movimiento (30/60/90 días).
7. Productos próximos a vencer (30/60/90 días).
8. Clasificación ABC.
9. Gastos por categoría y vs. presupuesto.
10. Estado de resultados simplificado (ventas − costo − gastos).
11. Cierres de caja y diferencias.
12. Ventas por vendedor.
13. Devoluciones, anulaciones y descuentos otorgados (control de fraude).
14. Mejores clientes.
15. Compras por proveedor y cuentas por pagar/cobrar.

### 8.3 Motor de alertas y candidatos a oferta especial
Las alertas aparecen en una campana 🔔 en la app, en el dashboard y (opcional) por correo/WhatsApp/notificación push. Se evalúan con un proceso programado diario + en tiempo real al vender.

| Alerta | Regla por defecto | Acción sugerida |
|---|---|---|
| Stock bajo | stock ≤ stock mínimo | Crear orden de compra |
| Agotado | stock = 0 | Reponer / ocultar |
| Sobre-stock | stock > stock máximo o > 120 días de inventario | Promoción |
| **Sin rotación** | sin ventas en 60 días y stock > 0 | **Candidato a oferta** |
| **Baja venta** | ventas último mes < 50% del promedio de 3 meses | **Candidato a oferta** |
| **Próximo a vencer** | vence en ≤ 60 días (suplementos/maquillaje) | **Liquidación urgente** |
| Vencido | fecha pasada | Retirar → merma |
| Gasto excedido | gasto de categoría ≥ 80% / 100% del presupuesto | Revisar |
| Margen bajo | margen de producto < 15% o venta bajo costo | Revisar precio |
| Diferencia de caja | |diferencia| > monto configurable | Revisar cierre |
| Descuentos inusuales | vendedor supera X descuentos/día | Auditoría |

**Puntaje de liquidación** (para ordenar candidatos): combina días sin venta, días para vencer, capital inmovilizado (stock × costo) y margen disponible. El asistente propone un descuento que no baje del costo (o avisa si es necesario por vencimiento).

Todos los umbrales son **configurables** por el admin, globales y por categoría/producto.

---

## 9. Arquitectura técnica (stack recomendado)

**Una sola base de código para web, PC y celular:**

| Capa | Tecnología recomendada | Por qué |
|---|---|---|
| Frontend web + PWA | **React + TypeScript + Vite** (o Next.js) | Ecosistema enorme, rápido |
| UI | **Tailwind CSS + shadcn/ui** (Radix) + **Lucide icons** | Diseño moderno y consistente |
| Gráficos | **Recharts** o **Apache ECharts** | Dashboards bonitos |
| Móvil (Android/iOS) | **Capacitor** envolviendo la misma app (cámara para escanear, impresión Bluetooth) | Reutiliza 100% del código |
| Escritorio (Windows/Mac) | **Tauri** (ligero) o Electron | Impresión térmica directa, instalable |
| Estado/datos | **TanStack Query** + Zustand | Caché y sincronización |
| Formularios/validación | React Hook Form + **Zod** (esquemas compartidos con backend) | Menos errores |
| Backend | **Node.js + NestJS** (o Fastify) en TypeScript | Mismo lenguaje en todo |
| ORM | **Prisma** | Migraciones y tipado |
| Base de datos | **PostgreSQL** | Transacciones robustas, reportes |
| Offline | **IndexedDB (Dexie)** en el POS + cola de sincronización | Vender sin internet |
| Jobs/alertas | BullMQ + Redis (o cron en el backend) | Alertas programadas |
| Archivos | S3 compatible (Cloudflare R2/Supabase Storage) | Fotos y comprobantes |
| Autenticación | JWT + refresh tokens, contraseñas con Argon2/bcrypt | Seguro |
| Reportes | PDF (pdfmake/React-PDF), Excel (ExcelJS) | Exportación |
| Hosting | Backend en Railway/Render/Fly.io/VPS; DB en Supabase/Neon/RDS; frontend en Vercel/Netlify | Bajo costo inicial |

**Alternativa más rápida (válida):** **Supabase** (PostgreSQL + Auth + Storage + funciones) + React. Reduce el backend propio; usar Row Level Security para permisos. El desarrollador debe elegir una y justificarla; la recomendación por defecto es **NestJS + Prisma + PostgreSQL**.

**Estructura de repositorio (monorepo con pnpm/Turborepo):**
```
/apps/web        → React PWA (también empaquetada por Capacitor y Tauri)
/apps/api        → NestJS
/packages/shared → tipos, esquemas Zod, fórmulas de negocio (testeadas)
/packages/ui     → componentes del sistema de diseño
/docs            → este documento, decisiones (ADR), manual de usuario
```

**Diagrama lógico:**
```
[PC Tauri] [Celular Capacitor] [Navegador PWA]
        \          |           /
         └── API REST (HTTPS, JWT) ──┐
                                     ├── PostgreSQL
                                     ├── Redis (jobs/alertas)
                                     └── Almacenamiento de archivos
```

**Offline:** el POS descarga catálogo, precios y stock; si no hay red, guarda ventas localmente con un UUID y número provisional; al reconectar, sincroniza en orden, el servidor asigna el número definitivo y resuelve conflictos de stock (registra alerta si quedó negativo).

---

## 10. Modelo de base de datos (PostgreSQL)

Todas las tablas: `id (uuid)`, `created_at`, `updated_at`, `created_by`, `branch_id` (preparado), y borrado lógico donde aplique. Montos en `numeric(14,2)`, cantidades en `numeric(14,3)`.

```
business_settings(id, name, legal_id, address, phone, logo_url, currency, tax_included, ...)
users(id, name, email, password_hash, pin_hash, role_id, active)
roles(id, name) ; permissions(id, code) ; role_permissions(role_id, permission_id)

categories(id, name, parent_id, requires_lot, requires_expiry, attributes_json)
brands(id, name)
suppliers(id, name, legal_id, phone, email, payment_terms_days, lead_time_days)
products(id, name, sku, category_id, brand_id, supplier_id, description, tax_rate,
         min_stock, max_stock, is_kit, active)
product_variants(id, product_id, sku, barcode, attributes_json {talla,color,sabor,tono},
                 cost_avg, price, wholesale_price, min_stock, active)
product_images(id, product_id, url, sort)
kit_components(kit_variant_id, component_variant_id, qty)
lots(id, variant_id, lot_number, expiry_date, qty_on_hand, cost)
stock_levels(variant_id, branch_id, qty_on_hand, qty_reserved)
inventory_movements(id, variant_id, lot_id, type, qty, unit_cost, balance_after,
                    ref_type, ref_id, reason, user_id, created_at)

customers(id, name, phone, email, legal_id, birthday, credit_limit, notes)
sales(id, number, status[draft,held,completed,voided], customer_id, seller_id,
      cash_session_id, subtotal, discount_total, tax_total, total, cost_total,
      notes, voided_reason, voided_by, offline_uuid, created_at)
sale_items(id, sale_id, variant_id, lot_id, qty, unit_price, unit_cost,
           discount, tax, line_total, promotion_id)
payments(id, sale_id, method[cash,transfer,card,credit,store_credit], amount,
         tendered, change, bank, reference, card_brand, card_last4,
         approval_code, fee_amount, status[ok,pending_verification], proof_url)
returns(id, sale_id, number, reason, total, refund_method, user_id)
return_items(id, return_id, sale_item_id, qty, restock bool)
credit_notes(id, customer_id, return_id, amount, balance)
quotes(id, ...) ; quote_items(...)

purchase_orders(id, number, supplier_id, status, expected_date, total)
purchase_order_items(id, po_id, variant_id, qty, unit_cost)
goods_receipts(id, po_id, received_at, freight, other_costs, user_id)
goods_receipt_items(id, receipt_id, variant_id, qty, unit_cost, landed_cost, lot_number, expiry_date)
supplier_payments(id, supplier_id, amount, method, reference, date)

expense_categories(id, name, monthly_budget)
expenses(id, category_id, date, amount, method, supplier_id, description,
         receipt_url, recurring bool)

cash_registers(id, name) 
cash_sessions(id, register_id, user_id, opened_at, opening_amount, closed_at,
              expected_cash, counted_cash, expected_card, expected_transfer, difference, notes)
cash_movements(id, session_id, type[in,out], amount, reason)

promotions(id, name, type[percent,amount,nxm,combo,special_price], value,
           starts_at, ends_at, scope_json, active, is_clearance)
alerts(id, type, severity, entity_type, entity_id, message, status[new,seen,resolved], created_at)
alert_rules(id, type, threshold_json, scope_json, channels_json, active)
audit_log(id, user_id, action, entity, entity_id, before_json, after_json, ip, created_at)
```

Índices: `barcode`, `sku`, `sales(created_at)`, `sale_items(variant_id)`, `inventory_movements(variant_id, created_at)`, `lots(expiry_date)`.
Vistas materializadas (refresco nocturno + bajo demanda): `mv_daily_sales`, `mv_monthly_consumption`, `mv_product_profit`, `mv_abc`.

**Regla clave:** venta, pagos, movimientos de inventario y descuento de lotes se guardan en **una sola transacción**.

---

## 11. API REST (resumen)

```
POST /auth/login  POST /auth/refresh  POST /auth/pin-switch
GET/POST/PATCH /products, /products/:id/variants, /categories, /brands
POST /products/import  GET /products/search?q=&barcode=
GET /inventory/stock  GET /inventory/kardex/:variantId
POST /inventory/adjustments  POST /inventory/counts  POST /inventory/counts/:id/apply
GET/POST /suppliers  /purchase-orders  POST /purchase-orders/:id/receive
GET/POST /customers
POST /sales  POST /sales/:id/hold  POST /sales/:id/void  GET /sales/:id/receipt(.pdf)
POST /sales/sync (lote de ventas offline)
POST /returns  GET/POST /quotes
POST /cash-sessions/open  POST /cash-sessions/:id/movements  POST /cash-sessions/:id/close
GET/POST /expenses  /expense-categories
GET/POST/PATCH /promotions  GET /promotions/clearance-candidates
GET /reports/{sales,monthly-consumption,profit,inventory-value,low-stock,no-movement,
             expiring,abc,expenses,income-statement,cash,by-seller,by-payment}?from=&to=&format=json|pdf|xlsx
GET /dashboard/summary
GET /alerts  PATCH /alerts/:id  GET/PUT /alert-rules
GET/PUT /settings  GET/POST /users /roles
GET /audit-log
```
Documentar con **OpenAPI/Swagger**. Validación con Zod/class-validator. Errores en español y claros.

---

## 12. Diseño UI/UX y sistema visual

### 12.1 Personalidad de marca
**Energética, femenina-fitness, premium pero cercana.** Debe sentirse como una tienda de moda deportiva moderna, no como un programa contable.

### 12.2 Paleta de colores (tokens)
| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `primary` | `#7C3AED` (violeta) | `#A78BFA` | Botones principales, enlaces |
| `accent` | `#EC4899` (rosa fucsia) | `#F472B6` | Destacados, ofertas, maquillaje/fajas |
| `energy` | `#10B981` (verde) | `#34D399` | Éxito, ganancias, cobrar |
| `warning` | `#F59E0B` | `#FBBF24` | Stock bajo, por vencer |
| `danger` | `#EF4444` | `#F87171` | Agotado, pérdidas, anular |
| `bg` | `#F8FAFC` | `#0B0F19` | Fondo |
| `surface` | `#FFFFFF` | `#151B2B` | Tarjetas |
| `text` | `#0F172A` | `#E2E8F0` | Texto |
| `muted` | `#64748B` | `#94A3B8` | Texto secundario |

Colores por categoría (chips y gráficos): Suplementos `#7C3AED`, Ropa `#0EA5E9`, Fajas `#EC4899`, Accesorios `#F97316`, Maquillaje `#E11D48`.
Contraste mínimo **WCAG AA**. Modo claro y **oscuro** (el POS de noche se agradece).

### 12.3 Tipografía y estilo
- Títulos: **Poppins** o **Plus Jakarta Sans** (semibold). Texto y números: **Inter** con números tabulares para montos.
- Bordes redondeados 12–16 px, sombras suaves, mucho espacio en blanco, iconos Lucide de línea.
- Micro-animaciones (Framer Motion): agregar al carrito, cobro exitoso con check animado, contadores KPI.
- Gradiente de marca para encabezados/tarjeta principal: `#7C3AED → #EC4899`.

### 12.4 Principios UX
- **Mobile-first y táctil**: botones mínimo 44×44 px; en el POS botones grandes.
- **Teclado primero en PC**: atajos (F2 buscar, F4 cliente, F8 en espera, F12 cobrar, Esc cancelar, Ctrl+K paleta de comandos).
- Máximo 3 toques/clics para vender un producto escaneado.
- Estados vacíos con ilustración y acción sugerida; skeleton loaders; mensajes en español claro.
- Confirmación solo en acciones destructivas; deshacer cuando sea posible.
- Indicador visible de **Offline / Sincronizando / En línea**.
- Responsivo: celular (1 columna, navegación inferior), tablet (POS en 2 paneles), PC (barra lateral).
- Accesibilidad: foco visible, etiquetas en inputs, no depender solo del color.

### 12.5 Componentes del sistema de diseño
Botón (primario, secundario, fantasma, peligro), input con ícono, buscador global, chip de categoría, tarjeta de producto (foto, nombre, precio, stock con semáforo), tarjeta KPI con tendencia ↑↓, tabla con filtros/orden/paginación/exportar, modal, drawer lateral, toast, badge de alerta, selector de variantes (botones de talla y círculos de color), teclado numérico en pantalla, gráfico, stepper, avatar de vendedor.

Entregar un **Storybook** o página de "guía de estilos" con todos los componentes.

---

## 13. Pantallas (wireframes descritos)

1. **Login**: logo, fondo con gradiente de marca, correo/contraseña; en dispositivo POS, cuadrícula de vendedores + PIN.
2. **Dashboard**: saludo + fecha; fila de 4 KPI; gráfico de ventas 30 días; ventas por categoría; top productos; panel derecho de alertas ("5 productos bajo mínimo", "3 lotes vencen este mes" con botón "Crear oferta").
3. **POS (pantalla estrella)**:
   - PC/tablet: izquierda, buscador + chips de categoría + cuadrícula de productos con foto; derecha, carrito (líneas, cantidades +/−, descuentos), cliente, totales grandes y botón verde **COBRAR**.
   - Celular: lista/buscador con botón de escáner flotante; carrito como hoja inferior deslizante.
   - Al elegir producto con variantes: modal con tallas/colores/sabores y stock de cada combinación.
4. **Cobro**: total enorme; botones de método (Efectivo / Tarjeta / Transferencia / + Dividir); lista de pagos agregados; pendiente y cambio; teclado numérico; billetes rápidos; botón "Finalizar". Luego pantalla de éxito con: Imprimir · WhatsApp · Correo · Nueva venta.
5. **Productos**: tabla/cuadrícula con filtros (categoría, marca, stock, estado), semáforo de stock; ficha de producto con pestañas: General · Variantes · Lotes · Precios · Kardex · Estadísticas.
6. **Inventario**: stock actual, ajustes, conteo físico (modo escáner), por vencer.
7. **Compras**: órdenes, recepción, proveedores, cuentas por pagar, sugerencia de compra.
8. **Gastos**: lista, nuevo gasto con foto del recibo, presupuesto vs. real con barras de progreso.
9. **Caja**: abrir/cerrar, movimientos, arqueo con desglose de billetes.
10. **Clientes**: lista, ficha con historial.
11. **Promociones / Liquidación**: candidatos con puntaje, días sin venta, vencimiento, margen; crear oferta en un clic.
12. **Reportes**: catálogo de reportes con filtros y exportación.
13. **Alertas**: centro de notificaciones con filtros y estado.
14. **Configuración**: negocio, impuestos, facturación, impresoras, usuarios/roles, umbrales de alertas, tema.

---

## 14. Seguridad, auditoría y respaldos
- HTTPS obligatorio; JWT de corta duración + refresh; contraseñas con Argon2/bcrypt; PIN con hash.
- Permisos verificados **en el backend** (no solo ocultos en pantalla). El vendedor nunca recibe el campo costo en la API.
- Bitácora de auditoría de: precios y costos cambiados, descuentos sobre el límite, anulaciones, ajustes de inventario, cierres de caja con diferencia, cambios de permisos.
- Bloqueo tras 5 intentos fallidos; cierre de sesión por inactividad (configurable).
- Respaldos automáticos diarios de la base de datos con retención de 30 días + exportación manual.
- Variables secretas fuera del código (.env); dependencias actualizadas.

## 15. Requisitos no funcionales
- Búsqueda de producto < 300 ms; registrar venta < 1 s en línea.
- Soportar al menos 50,000 productos/variantes y 1,000,000 de líneas de venta sin degradación.
- Disponibilidad objetivo 99.5%; POS funcional offline.
- Idioma: español (preparado para i18n). Moneda y formato de fecha locales.
- Código con ESLint + Prettier, pruebas automáticas, CI (GitHub Actions), migraciones versionadas.

---

## 16. Plan de trabajo por etapas (orden obligatorio)

Cada etapa termina con: código funcionando, pruebas, demo descrita y lista de supuestos tomados.

| Etapa | Entregable |
|---|---|
| **0. Fundaciones** | Monorepo, CI, DB, Prisma, auth, roles/permisos, layout responsivo, sistema de diseño + guía de estilos, modo claro/oscuro |
| **1. Catálogo** | Categorías, marcas, productos, variantes, códigos de barra, fotos, importación Excel, etiquetas |
| **2. Inventario y compras** | Proveedores, órdenes, recepción con lotes/vencimiento, costo promedio y de aterrizaje, kardex, ajustes, conteo físico |
| **3. POS y pagos** | Carrito, variantes, descuentos con PIN, clientes, pagos combinados, ticket/PDF/WhatsApp, ventas en espera, cotizaciones |
| **4. Caja, devoluciones y anulaciones** | Apertura/cierre/arqueo, notas de crédito, cambios de talla |
| **5. Gastos** | Categorías, presupuestos, recurrentes, comprobantes |
| **6. Estadísticas y reportes** | Dashboard, 15 reportes, exportación PDF/Excel |
| **7. Alertas y liquidación** | Motor de reglas, centro de alertas, notificaciones, asistente de ofertas |
| **8. Offline y empaquetado** | PWA offline + sync, app Android/iOS (Capacitor), escritorio (Tauri), impresión térmica |
| **9. Pulido y entrega** | Pruebas de usabilidad, rendimiento, seguridad, manual de usuario, datos de demostración, despliegue |

Datos de demostración (seed): 5 categorías, ~60 productos realistas con variantes, 3 proveedores, 4 usuarios (uno por rol), 6 meses de ventas simuladas para que el dashboard se vea vivo.

---

## 17. Criterios de aceptación y pruebas (ejemplos)
- Vender 1 proteína (lote que vence primero) + 1 legging talla M negro, pagando parte efectivo y parte tarjeta: stock baja correctamente en la variante y lote correctos, el cambio se calcula solo sobre efectivo, la ganancia usa el costo del momento.
- Un vendedor no puede ver costos en ninguna pantalla ni respuesta de API.
- Descuento de 25% por un vendedor exige PIN de gerente y queda en auditoría.
- Al recibir una compra, el costo promedio se recalcula según la fórmula.
- Un producto sin ventas en 60 días aparece en "Candidatos a oferta"; un lote que vence en 45 días genera alerta.
- Gasto de publicidad que supera el 80% del presupuesto genera alerta.
- Cierre de caja muestra diferencia correcta por método.
- Venta hecha sin internet se sincroniza al reconectar sin duplicarse.
- Pruebas unitarias de todas las fórmulas (sección 6) en `packages/shared`; pruebas E2E (Playwright) del flujo de venta completo.

---

## 18. Decisiones por defecto (aplicar si el dueño no indica otra cosa)
- País: **República Dominicana**, moneda **RD$ (DOP)**, impuesto **ITBIS 18%**, precios **con impuesto incluido**, comprobantes fiscales **NCF** preparados (e-CF de la DGII en fase futura).
- Una sola tienda, hasta 5 usuarios simultáneos.
- Valorización: costo promedio ponderado; salida de lotes FEFO.
- No se permite stock negativo.
- Descuento máximo del vendedor: 10%.
- Umbrales: sin rotación 60 días; por vencer 60 días; margen bajo 15%; gasto 80%/100%.
- Impresora térmica 80 mm.
- Stack: React + TS + Tailwind/shadcn + Capacitor + Tauri / NestJS + Prisma + PostgreSQL.
- Nombre provisional: **"FitStore POS"**; paleta violeta–fucsia.

## 19. Preguntas abiertas para el dueño (ChatGPT debe hacerlas solo si las necesita)
1. ¿País y obligaciones fiscales? ¿Requiere comprobantes fiscales (NCF / factura electrónica e-CF de la DGII) desde la Fase 1?
2. ¿Nombre real de la tienda, logo y colores de marca?
3. ¿Cuántos vendedores y cuántas computadoras/celulares van a facturar a la vez?
4. ¿Habrá comisiones por vendedor? ¿Con qué regla?
5. ¿Se vende a crédito? ¿Precios al por mayor?
6. ¿Qué impresora y lector de códigos tienen (o hay que recomendar)?
7. ¿Presupuesto mensual de hosting y preferencia de nube?
8. ¿Se aceptan cambios/devoluciones de suplementos y maquillaje? ¿Política de días?
9. ¿Enviar facturas por WhatsApp es prioritario?
10. ¿Tienen ya un listado de productos en Excel para importar?

---

## 20. Prompt listo para pegar en ChatGPT

```
Actúa como un equipo completo de desarrollo de software (arquitecto, diseñador UX/UI,
desarrollador full-stack y QA). Te adjunto el "Documento Maestro de Arquitectura" de una
aplicación de facturación, inventario y estadísticas para una tienda de suplementos, ropa
deportiva, fajas, accesorios de gimnasio y maquillaje. Debe funcionar en PC, celular y web.

Reglas de trabajo:
1. El documento es la fuente única de verdad. Síguelo etapa por etapa (sección 16) sin saltarte pasos.
2. Trabaja de forma continua. Al terminar cada etapa entrega: resumen, estructura de archivos,
   código completo, migraciones, pruebas, instrucciones para ejecutar y la lista de supuestos.
   Luego continúa con la siguiente etapa sin esperar, salvo que yo diga "pausa".
3. Si algo no está definido, usa las "Decisiones por defecto" (sección 18) y anótalo.
   Solo pregúntame cuando sea una decisión de negocio crítica (sección 19) o falten datos reales.
4. Dedica atención especial al diseño: aplica el sistema visual de la sección 12, entrega
   primero la guía de estilos y mockups de las pantallas clave (POS, Cobro, Dashboard,
   Liquidación) antes de programarlas.
5. Código en TypeScript, limpio, comentado en español donde aporte, con pruebas.
6. Nunca elimines datos financieros: anula con motivo y auditoría.

Empieza ahora con: (a) confirmación breve de que entendiste el alcance, (b) las preguntas
de la sección 19 que consideres imprescindibles (máximo 5), y (c) la Etapa 0.

[PEGAR AQUÍ TODO EL DOCUMENTO]
```
