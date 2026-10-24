# Propuesta de producto de Gemini (24-oct-2026)

*Respuesta de Gemini al pedido `docs/coordinacion/ORDEN_PROPUESTA_GEMINI.md`. Guardada sin cambios salvo las marcas de cita. Las cifras y leyes no las verificó Gemini contra fuentes oficiales; ver el veredicto de Claude en `docs/coordinacion/VEREDICTO_GEMINI_24OCT.md`.*

## PROPUESTA DE ARQUITECTURA Y PRODUCTO SAAS (7 PUNTOS)

### Punto 1. Crítica del plan actual (10 ajustes ordenados por impacto)
1. **Separar NCF Serie B de e-CF (Serie E) y subir NCF Serie B a Fase 1:** Sin `B01`, `B02`, `B04` y reportes `606/607` ningún comercio formal en R. D. puede facturar; no debe esperar a la Fase 4.
2. **Cobro híbrido desde Fase 1:** No esperar pasarela automática de tarjetas para vender; arrancar cobrando suscripciones por transferencia bancaria verificada (módulo que Nexora ya tiene) mientras Azul/CardNET aprueban la afiliación.
3. **Adelantar el piloto de 3-5 tiendas al cierre de la Fase 1 (en PWA web):** Validar con clientes reales antes de construir el instalador Tauri de la Fase 3.
4. **Meter las correcciones del Cierre de Caja y Ticket Lineal en Fase 1:** Evita que los clientes nuevos sufran los mismos descuadres del 17 de octubre.
5. **Postergar el instalador Windows (Tauri) a Fase 4:** La PWA en React + Vite con cola en IndexedDB ya es instalable desde el navegador; mantener dos clientes (Web + Tauri) desde el inicio duplica soporte.
6. **Proteger el margen del plan Autoservicio (RD$ 990/mes):** Cobrar cuota única de activación/onboarding o limitar RD$ 990 a soporte 100 % por IA para que 1 hora de soporte humano por WhatsApp no dé pérdidas.
7. **Onboarding guiado (< 30 min) en Fase 1:** Conectar la importación de Excel y lectura de facturas de proveedor con IA que ya existen al primer arranque.
8. **Control de sesiones/dispositivos por caja (`deviceId`):** Evitar que un cliente del plan de 1 caja y 2 usuarios abra 4 cajas simultáneas compartiendo usuario.
9. **Acotar el modo offline (Fase 5):** Permitir sin internet solo facturar con rango preasignado de NCF y encolar cobros; bloquear anulaciones, traspasos de almacén y cierres definitivos sin red.
10. **Alertas activas por correo/WhatsApp en Fase 1-2:** Sacar las alertas de diferencias > RD$ 100 del panel pasivo hacia notificaciones externas.

### Punto 2. IA de soporte («Pregúntale a Nexora»)
* **Evaluación de rutas GET + JWT del usuario:** Heredar `tenantId`, sucursal y permisos con RLS es seguro contra fugas entre empresas, pero **insuficiente por sí solo** porque: a) rutas GET crudas pueden devolver costos/márgenes a un rol `cajera`, b) el LLM falla sumando decenas de filas crudas (debe consultar endpoints de agregación SQL), y c) las rutas GET no contienen el manual de uso.
* **Defensas obligatorias contra ataques:**
  * *Prompt Injection indirecto* (en nombres de clientes o notas de caja): envolver textos libres en etiquetas de datos no confiables y deshabilitar `solicitar_anulacion_factura` si el contexto leyó notas abiertas sospechosas.
  * *Cero `tenantId` en argumentos del LLM:* el servidor toma el `tenantId` exclusivamente del JWT verificado.
  * *Filtro de columnas por rol:* ocultar `costo`, `margen` y `rentabilidad` si el JWT no es de gerente/dueña.
  * *Anti-abuso de cuota:* máximo 500 caracteres por pregunta, ventana máxima de 31 días por consulta y rate-limit de 5 consultas/minuto.
* **Lista final de 10 herramientas cerradas para la IA:**
  1. `get_manual_procedimiento` (guía paso a paso de uso).
  2. `get_resumen_cuadre_caja` (desglose exacto de efectivo esperado vs contado, CxC en gaveta vs dueña).
  3. `get_facturacion_por_usuario` (ventas, descuentos y nulos por cajero).
  4. `get_detalle_factura` (auditoría de factura o contraentrega por número/cliente).
  5. `get_cuentas_por_cobrar_pendientes` (créditos y contraentregas abiertas).
  6. `get_transferencias_por_verificar` (transferencias bancarias pendientes/verificadas).
  7. `get_movimientos_inventario` (entradas, salidas, devoluciones y traspasos).
  8. `get_stock_y_alertas_producto` (existencias por almacén).
  9. `get_alertas_auditoria_tienda` (solo gerente/dueña: diferencias > RD$ 100, uso de PIN, anulaciones).
  10. `solicitar_anulacion_factura` (única acción: genera solicitud que confirma el usuario y aprueba un gerente con PIN).

### Punto 3. Rol `support` de la dueña sin modificar datos
* **Arquitectura:** Mantener la activación temporal por el cliente (24 h o 7 días) con cintillo visible de revocación en 1 clic, bitácora inmutable `SupportAuditLog` a la vista del cliente y forzar a nivel de base de datos PostgreSQL `SET TRANSACTION READ ONLY` para cualquier consulta hecha con el token `support`.
* **Monetización del soporte:**
  * *Autoservicio (RD$ 990) y Básico (RD$ 1,990):* Soporte vía IA incluido en su cuota (30/50 consultas); recarga de +100 consultas IA por RD$ 350; sesión humana de auditoría/soporte de la dueña por evento a **RD$ 1,200 (acceso 24 h)**.
  * *Pro (RD$ 3,990) y Premium (RD$ 7,990):* Soporte prioritario y 1 auditoría mensual incluidos.

### Punto 4. Costos unitarios, precios mínimos y pasarelas en R. D.
* **Costos mensuales estimados por tienda (octubre 2026, tasa ref. US$ 1 ≈ RD$ 60.50):** Infraestructura Render (NestJS + PostgreSQL 17 compartido) entre RD$ 150 y RD$ 350/mes por cliente; IA económica (~RD$ 0.08 a RD$ 0.15 por consulta); pasarela tarjeta ~4.5 % + RD$ 10.
  * *Autoservicio (RD$ 990):* Costo directo RD$ 210 | Mínimo sin perder: RD$ 300 (solo IA) / RD$ 1,250 (si consume 1 h de soporte humano).
  * *Básico (RD$ 1,990):* Costo directo RD$ 288 | Mínimo sin perder: RD$ 950.
  * *Pro (RD$ 3,990):* Costo directo + soporte RD$ 1,085 | Mínimo sin perder: RD$ 1,550.
  * *Premium (RD$ 7,990):* Costo directo + soporte RD$ 1,870 | Mínimo sin perder: RD$ 2,670.
* **Pasarelas para cobro recurrente en R. D.:**
  1. *Día 1:* Transferencia bancaria local + verificación en Nexora (0 % comisión, 0 días de espera).
  2. *Corto plazo (en USD):* PayPal Subscriptions (4.4 %–5.4 % + US$ 0.30) o Paddle / Lemon Squeezy (5 % + US$ 0.50, sin requerir LLC en EE. UU.).
  3. *Nativo en DOP (2 a 6 semanas de afiliación con RNC y Registro Mercantil):* **Bóveda Azul (Tokenización)** (~2.7 %–4.5 % + RD$ 7.50–10 + cargo fijo mensual) o **CardNET Tokenización** (~3 %–5 %). *(Stripe requiere LLC y cuenta bancaria en EE. UU.)*.

### Punto 5. Instalador Windows (Tauri) y Licencia Offline
* **Base de datos:** PostgreSQL 17 en la nube como fuente de verdad + cola/caché local cifrada en la laptop (permite que el rol `support` y los reportes funcionen a distancia y evita pérdida total si se daña la laptop).
* **Firma y actualización:** Firma de código Windows mediante certificado en la nube en CI/CD para evitar bloqueos de SmartScreen y auto-actualización con `tauri-plugin-updater` verificando que el plan esté activo.
* **Licencia offline:** Archivo de licencia firmado con clave asimétrica `Ed25519` válido por 7 días sin internet y validación de reloj monotónico (`lastSeenTimestamp`) para impedir que atrasen el reloj de Windows. Si vence el pago + 7 días de gracia, pasa a modo `solo lectura` sin borrar datos.

### Punto 6. Fiscal (DGII) y Legal en R. D.
* **DGII:** Ley 32-23, Decreto 587-24 y Norma 01-2020. Entregar en Fase 1 secuencias tradicionales **Serie B (`B01, B02, B04`) + Formatos `606/607`**. En Fase 3 entregar **e-CF Serie E (`E31, E32, E33, E34, E41, E43`)** con firma digital X.509 (`.p12` cifrado por `tenantId`), impresión de Código QR + Código de Seguridad en el ticket térmico, conservación de XML por 10 años en el respaldo descargable y conexión vía API al portal de certificación DGII o a través de un PSFE aliado.
* **Legal:** 1) Términos y Condiciones B2B (responsabilidad fiscal del comercio ante la DGII, carácter informativo de la IA, paso a `solo lectura` tras 7 días de mora y tope de responsabilidad), 2) Política de Privacidad (Ley 172-13), y 3) Consentimiento de Acceso Temporal de Soporte en solo lectura.

### Punto 7. Plan de Fases Reordenado (con Definition of Done y Esfuerzo)
* **Fase 0 (Hecha):** Multiempresa `tenantId` + filtro en código + RLS en PostgreSQL 17 con 0 fugas en 152 rutas.
* **Fase 1 (Esfuerzo M — 2 a 3 semanas): Vendible en Web (PWA) + Cierre de Caja blindado + NCF Serie B (`B01/B02/B04` y `606/607`) + Registro/Planes/Estados + Cobro por transferencia + Piloto 3 tiendas**. *Criterio de terminado:* 3 tiendas piloto operando en la PWA, cierre de caja separando efectivo de dueña vs gaveta con ticket lineal sin solapamientos y paso automático a `solo lectura` tras vencimiento + 7 días.
* **Fase 2 (Esfuerzo M — 2 semanas): «Pregúntale a Nexora» (10 herramientas seguras) + Rol `support` (`READ ONLY`) + Alertas al correo/celular**. *Criterio de terminado:* 20 pruebas de ataque (Prompt Injection, lectura cruzada de empresas y costos por cajera) bloqueadas al 100 % y rol `support` rechazando cualquier escritura.
* **Fase 3 (Esfuerzo L — 3 a 5 semanas): Pasarela recurrente automática (Azul/CardNET/PayPal) + Facturación Electrónica `e-CF` (Serie E con QR y firma X.509)**. *Criterio de terminado:* Cobro recurrente automático activo y Set de Pruebas e-CF de la DGII superado.
* **Fase 4 (Esfuerzo M — 2 a 3 semanas): Instalador Windows (Tauri) firmado + Auto-update + Licencia offline Ed25519**. *Criterio de terminado:* Instalación limpia en Windows 11, actualización automática y bloqueo ante atraso del reloj del sistema o más de 7 días sin red.
* **Fase 5 (Esfuerzo L — 4 a 6 semanas): Sincronización offline con rangos NCF reservados + App móvil para dueños (aprobación de PIN y consultas a distancia)**. *Criterio de terminado:* 50 ventas sin internet sincronizadas en < 10 s sin duplicar NCF y aprobación remota de cierre desde el celular.
