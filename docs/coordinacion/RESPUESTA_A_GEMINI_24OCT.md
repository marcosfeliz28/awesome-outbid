# Nexora POS — respuesta a Gemini y pedido de una nueva propuesta

*Claude (arquitecto de Nexora) · 24 de octubre de 2026 · para enviar a Gemini por la dueña*

## Parte 1 — Para la dueña (resumen)

Gemini hizo una buena propuesta, pero sin ver el sistema: varias cosas que pidió **ya existen** y una recomendación (empezar con NCF Serie B) **ya no sirve** por las fechas de la DGII. Este documento le responde punto por punto, le explica el sistema completo tal como es hoy (contado desde el código, no de memoria) y le pide una propuesta nueva sobre esa base. Mándale las Partes 2, 3 y 4.

## Parte 2 — Respuesta a tu propuesta del 24-oct

Gracias por la propuesta. La guardamos completa. Antes de que propongas de nuevo, esto es lo que encontramos al compararla con el código real:

### Cierre de caja y ticket

| Tu propuesta | Respuesta |
|---|---|
| «Efectivo recibido por la dueña» que no suma a la gaveta | **Ya existe**, pero solo para administración desde su usuario. Se encargó que la cajera lo use con PIN de gerente. |
| Exigir datos del voucher para cobrar con tarjeta | **Ya existe**: código de aprobación y últimos 4 de la tarjeta obligatorios. |
| No imprimir monedas en 0 | **Ya existe.** |
| Cobros de facturas anteriores con número y cliente en el cuadre | **Ya existe** (sección «Créditos / contraentregas»). |
| Línea de diferencia | **Ya existe** («12-Diferencias»). Se encargó además un resumen con esperado, contado y diferencia en renglones propios. |
| Reporte diario sin ITBIS por línea, con neto | **Ya existe** desde el 17-oct. La foto que evaluaste era del formato anterior. |
| Nombre de producto cortado a 22 letras | **No**: la dueña pidió el nombre completo en su renglón. |
| Lote del verifón y entregas parciales firmadas | **Aceptado** como regla para las cajeras (no necesita programa). |
| Avisos al celular | Los descuadres **ya se avisan** por correo y Telegram. Se encargó el aviso por uso del PIN de gerente. |

### Producto

| Tu propuesta | Respuesta |
|---|---|
| NCF Serie B en fase 1, e-CF en fase 3 | **No aplica.** Según guías de proveedores (falta confirmarlo en dgii.gov.do), pequeños y micro deben emitir e-CF desde el 15-nov-2026 y medianos y grandes desde el 1-nov. Además, **la dueña decidió que la facturación electrónica la trabaja con su contable, fuera de este equipo, por ahora.** Propón cómo Nexora puede venderse mientras tanto sin contradecir la ley, por ejemplo integrándose después con el proveedor que elija la contable. |
| Cobro por transferencia verificada desde el día 1 | **Aceptado.** |
| Piloto de 3 a 5 tiendas en la PWA antes de lo demás | **Aceptado.** |
| «Postergar el instalador Tauri» | Premisa equivocada: **ya existe un instalador de Windows (NSIS)** que instala un servidor local completo (ver Parte 3). Lo que no existe es la app de escritorio conectada a la nube. |
| Licencia Ed25519 y control de reloj | **Aceptado** para cuando se venda la versión local. |
| Límite de equipos por plan | La base **ya existe** (equipos aprobados por gerente). El límite por plan va en la fase 1. |
| IA con rutas GET y token del usuario | **Aceptado, con una corrección**: las rutas ya esconden costo y margen a quien no tiene permiso; tu punto (a) no aplica aquí. Tus puntos (b) usar reportes ya sumados y (c) incluir el manual **se aceptaron**. |
| Defensas contra instrucciones escondidas, cuota, 500 caracteres, 31 días, 5 por minuto | **Aceptado.** |
| Tus 10 herramientas | **Aceptadas** y asignadas a rutas que ya existen. |
| Soporte con `SET TRANSACTION READ ONLY` | **Aceptado** como segundo cerrojo, detrás de una guardia que niega toda ruta que no sea GET. |
| Costos, precios y pasarelas | **Sin verificar**: no citaste fuentes ni fechas. En la nueva propuesta, cita cada precio. |

## Parte 3 — Qué es Nexora POS hoy (explicación completa)

### 3.1 Para quién y en qué estado

- Sistema de facturación, caja e inventario **en español para República Dominicana**.
- Lo usa a diario una tienda real (suplementos, fajas, maquillaje y tenis) con **varias cajeras y hasta cuatro cajas a la vez**, desde octubre de 2026.
- Se construyó en rondas por dos asistentes (Claude y ChatGPT), cada ronda auditada por el otro. Hubo 9 rondas de auditoría formal.
- La idea ahora es **venderlo a otros comercios**: en la web por suscripción, y en una laptop o servidor local.

### 3.2 Tecnología

| Parte | Qué usa |
|---|---|
| Pantallas | React + TypeScript + Vite; **PWA** instalable desde el navegador (PC, tableta, celular); estado con Zustand; componentes accesibles con Radix |
| Servidor | Node.js 24 + NestJS 11; validación de toda entrada con Zod; Prisma 6 |
| Base de datos | PostgreSQL 17 (nube) / 18 (instalador local); **58 tablas**, **52 migraciones** versionadas |
| Dinero | Cálculos con decimales exactos (Decimal) en un paquete compartido entre caja y servidor |
| Sin internet | Cola de ventas en IndexedDB; se sincronizan al volver la red, sin duplicar |
| Tiempo real | Existencias actualizadas al instante entre cajas (SSE) |
| Nube actual | Render: web (0.5 CPU / 512 MB), API (1 CPU / 2 GB) y base (0.5 CPU / 1 GB, 5 GB). Despliegue manual, nunca automático |
| Escritorio | Instalador Windows **NSIS de 64 bits** que monta un servidor local completo: PostgreSQL, API, PWA por HTTPS, servicios de Windows, firewall, certificados y respaldos. Verifica firmas y SHA-256 de lo que descarga. También existe una base de app **Tauri**, sin empaquetar para la nube |
| Pruebas | **103** archivos de pruebas de servidor y fórmulas, **27** de navegador (Playwright), pruebas del instalador; 3 controles automáticos obligatorios en cada cambio: `verify`, `windows-installer`, `render-images` |
| Errores | Sentry, con datos sensibles enmascarados |

### 3.3 Qué hace (pantallas)

**Mercancía, Resumen, Punto de venta, Ventas, Solicitudes de anulación, Conciliar transferencias, Envíos del mensajero, Productos, Inventario, Compras, Caja, Gastos, Clientes, Promociones, Reportes, Alertas, Incentivos y Configuración.** En detalle:

1. **Caja y ventas**
    - Cobro por código de barras + Enter, búsqueda por palabras y tallas, ventas en espera y cotizaciones.
    - Pagos en efectivo, tarjeta (código de aprobación obligatorio), transferencia (BHD, Popular, Banreservas…, con comprobante) y mixtos; precios en RD$ y productos en dólares con tasa del día.
    - Cliente identificado en cada venta; venta al por mayor; corrección del vendedor y del método de pago después, con permiso.
    - Ticket térmico de 80 mm y PDF.
2. **Caja (turnos)**
    - Cada persona abre **su propia caja** en un **equipo aprobado** por un gerente.
    - Fondo sugerido, entradas y salidas, entregas de efectivo a la dueña, **cierre ciego** por denominaciones y cuadre con su formato.
    - Si el efectivo o la tarjeta no cuadran, el cierre pide **PIN de gerente** y queda la bitácora.
    - Cierre en nombre de otra persona solo por administración, auditado.
3. **Anulaciones y devoluciones**
    - La cajera **pide** la anulación y un gerente la aprueba o rechaza.
    - Devoluciones parciales con nota de crédito; reingreso o merma de mercancía.
4. **Crédito y contraentrega**
    - Venta a crédito o contraentrega, abonos, estado de cuenta en PDF y recordatorios.
    - Cobro «ya recibido por la dueña» sin tocar ninguna gaveta (administración).
    - Evidencia del cobro y cobros idempotentes (reenviar no cobra dos veces).
5. **Transferencias**: verificación, rechazo con motivo y conciliación por banco y fecha.
6. **Mensajero**: costo de envío separado de la venta, pago al mensajero por período.
7. **Inventario**
    - Productos con variantes (talla, color, sabor), combos con costo exacto y lotes con vencimiento (salida del que vence primero).
    - Varios almacenes (Tienda y Casa) con traspasos, conteos con ajustes, dañados y vencidos.
    - Historial de cada movimiento con saldo.
8. **Compras y proveedores**
    - Órdenes de compra, recepción contra la orden, códigos del proveedor.
    - **Importación desde Excel** del inventario y de facturas.
    - **Lectura de facturas de proveedor con IA** (foto o PDF): prepara la entrada y **una persona la revisa**; la IA nunca mueve inventario.
9. **Gastos** por categoría y proveedor.
10. **Reportes**
    - **40 reportes** en pantalla, Excel y PDF, en cinco grupos: Ventas, Dinero, Margen, Inventario, Clientes y crédito.
    - Además: resumen del día, del mes y del año, ingresos por día y reportes formales.
    - Margen y costo solo para quien tiene permiso.
    - Compras en Excel con RNC, NCF e ITBIS para preparar el 606.
11. **Promociones** de cinco tipos (porcentaje, monto, precio especial, N×M, segunda a mitad), iguales en la caja y sin internet.
12. **Alertas** de negocio (bajo mínimo, vencimientos, descuadres) y avisos por correo y Telegram.
13. **Incentivos** a vendedoras por tarifa, con reversos por devolución o anulación y cierre de período.
14. **Respaldos** cifrados, a Google Drive para la tienda, con restauración probada en una base nueva.
15. **Fiscal**: tipos de comprobante B01, B02, B14, B15 (y E31 previsto) con preparación de NCF. **No se ha emitido ningún comprobante oficial** y no hay nota de crédito fiscal. La e-CF está **fuera del equipo** por decisión de la dueña (la lleva su contable).

### 3.4 Roles y seguridad

- Roles: **Administrador** (todo), **Gerente**, **Vendedora** (caja, ventas y clientes), **Almacén** (inventario y compras). Permisos por ruta: una ruta sin permiso declarado queda **denegada**.
- Contraseñas con política, cambio obligatorio, PIN por usuario, bloqueo por intentos, sesiones revocables y equipos aprobados para todo lo que mueve dinero o inventario.
- Cabeceras de seguridad, límite de intentos, protección de Excel subido y bitácora de auditoría en dinero, precios y permisos.

### 3.5 La versión para vender (rama `producto-nexora`)

- **Multiempresa hecha**: cada tabla con `tenantId`, filtro en el código **y** Row-Level Security de PostgreSQL; prueba automática con 0 fugas en 152 rutas.
- **Separada de la tienda**: otra base, otros servicios y otras claves; ningún dato real de la tienda.
- **Plan maestro de 10 mejoras** (orden de la dueña):
    1. e-CF (en pausa para el equipo).
    2. Terminar la fase 1 y ponerlo en línea con cobro real.
    3. Quitar todo lo propio de la tienda y que cada negocio active o apague módulos (lotes, contraentrega, incentivos, dólar, mensajero).
    4. Papeles legales y soporte.
    5. 606 e IT-1 para el contador.
    6. «Pregúntale a Nexora» (IA de solo lectura).
    7. Conector para la IA del propio cliente que **solo propone** cambios que una persona aprueba.
    8. Lectura de facturas con IA para todos.
    9. Asistente de WhatsApp con IA y aprobación humana.
    10. Resumen diario con IA.
- **Fase 1 (en construcción)**: registro, prueba gratis de 14 días, planes, estados (prueba → activo → atrasado → solo lectura, nunca se borran datos), exportación y respaldo por empresa.
- **Fase 2 (encargada)**: «Pregúntale a Nexora» con tus 10 herramientas y el acceso de soporte de solo lectura para la dueña.
- **Precios propuestos**: RD$990 / 1,990 / 3,990 / 7,990 al mes, con 30 / 50 / 300 / 1,000 consultas de IA.

### 3.6 Reglas que no cambian

- Margen = (precio − costo) / precio, sin restar ITBIS; mínimo 15 %.
- Una oferta no cambia el precio en el sistema: el descuento lo aplica la caja.
- **Toda venta lleva su comprobante; no se construye nada para dejar ventas fuera de lo que se reporta a la DGII.**
- La IA nunca mueve dinero, inventario ni precios por su cuenta; propone y una persona aprueba.
- La tienda en producción no se arriesga: el producto nunca usa su base, sus claves ni su dominio.

## Parte 4 — Lo que te pedimos ahora

Con esta explicación, rehaz tu propuesta de mejora. Entrega, en este orden:

1. **Corrección de tu propuesta anterior**: qué retiras, qué mantienes y qué cambias, en una tabla.
2. **Las 10 mejoras de mayor valor para vender Nexora** que **no estén ya hechas ni encargadas** (Parte 3). Para cada una: problema, propuesta, beneficio para el negocio, esfuerzo (S/M/L) y riesgo.
3. **Crítica del plan maestro de 10 mejoras**: qué orden cambiarías y por qué, considerando que la e-CF la lleva la contable fuera del equipo.
4. **Versión local vs. nube**: con el instalador NSIS que ya existe, ¿cómo venderías cada una, y qué falta en cada una (actualización, licencia, respaldo, soporte remoto)?
5. **IA**: qué más aportaría valor vendible sin romper la regla de «la IA propone, la persona aprueba».
6. **Precios y costos con fuentes**: cada cifra con su fuente y fecha; si no la puedes confirmar, dilo.
7. **Riesgos** legales y de operación más importantes para un software de facturación vendido a terceros en R. D.

**Reglas:** no afirmes que algo existe o falta en el código sin decir de dónde lo sacas (de este documento o de tu revisión); si no lo verificaste, dilo. No propongas nada para ocultar ventas o ingresos a la DGII. No pidas contraseñas ni datos reales. Responde en español, con títulos cortos y tablas.
