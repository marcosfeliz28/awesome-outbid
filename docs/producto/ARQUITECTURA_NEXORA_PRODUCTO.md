# Nexora POS como producto — arquitectura (Claude, arquitecto · 19-oct-2026)

Decisiones de la dueña (19-oct): producto que **corra solo**, que el cliente **descargue o abra en la web y use sin depender de ella** (aunque se cobre menos), **con IA aplicada**, en **web y en laptop** (la laptop puede usar internet para conectarse a nuestros servidores). **Sin tocar la base de datos ni el sistema de la tienda** (Grupo Macgen sigue en `nexora-cloud`, intacto). Claude diseña y revisa; **ChatGPT PC construye**.

Base: propuesta de ChatGPT PC (`origin/nexora-chatgpt-pc-saas:docs/propuestas/PRODUCTO-SAAS.md`). Cambios del arquitecto: autoservicio total desde la fase 1, plan de entrada más barato, laptop desde la fase 2 (en línea), offline real al final.

## 1. Separación total de la tienda
- Rama de producto: `producto-nexora` (sale de `nexora-cloud`; los arreglos de la tienda se traen con merge, nunca al revés sin revisión de Claude).
- Infraestructura propia en Render: servicios `nexora-saas-api`, `nexora-saas-web` y **una base PostgreSQL nueva**. Nunca la base `dpg-db3feel9fdbs73dias9g-a` de la tienda. Variables y secretos distintos. Dominio distinto.
- Ningún dato real de Grupo Macgen (clientes, ventas, empleadas) en el producto; datos de demostración generados.

## 2. Multiempresa (la pieza crítica)
- Tabla `Tenant` (empresa cliente: nombre, plan, estado `trial|active|past_due|suspended|cancelled`, fechas, país, moneda, zona horaria).
- Todas las tablas de negocio llevan `tenantId`. `branchId` sigue existiendo dentro de cada empresa (sucursales).
- Doble cerrojo: (a) el código filtra siempre por `actor.tenantId` (guardia central, igual que hoy `branchId`), y (b) **Row-Level Security de PostgreSQL** con `SET app.tenant_id` por transacción, para que un olvido en el código no exponga datos.
- Prueba obligatoria por endpoint: una empresa nunca lee, cambia, exporta ni restaura datos de otra (matriz automática sobre todas las rutas).

## 3. Autoservicio (que no dependa de la dueña)
1. **Registro** en la web: nombre del negocio, correo, contraseña, tipo de negocio → empresa creada con prueba gratis de 14 días y datos de ejemplo opcionales.
2. **Asistente de arranque**: categorías por tipo de negocio, importar productos desde Excel (el importador ya existe), crear usuarios y cajas, impresora.
3. **Cobro automático** mensual con tarjeta (procesador por decidir: Azul / CardNet / PayPal; Nexora no guarda tarjetas). Aviso 7 y 3 días antes; si falla el cobro, 7 días de gracia; luego **solo lectura** (nunca se borran ni secuestran datos) y exportación siempre disponible.
4. **Centro de ayuda**: guías cortas en español dentro del sistema + el asistente de IA.
5. **Soporte humano** solo por escalamiento (correo/WhatsApp de Nexora), no por defecto.
6. **Página de estado** y correos automáticos de incidentes.

## 4. IA aplicada (asistente por empresa)
- Botón «Pregúntale a Nexora» en todas las pantallas.
- Modelo económico por defecto (Claude Haiku) y uno mayor solo para casos complejos; el proveedor queda detrás de una interfaz para poder cambiarlo.
- Herramientas **de solo lectura** sobre los datos de SU empresa (ventas, inventario, reportes ya existentes) + manual del producto. **Nunca** mueve dinero, inventario ni precios; si el usuario quiere un cambio, la IA le dice dónde hacerlo.
- Cuota mensual por plan (consultas y tokens), contador visible, bloqueo al llegar al tope o paquete extra prepagado.
- Bitácora de cada conversación (empresa, usuario, costo), sin enviar datos de tarjeta ni contraseñas al modelo.
- Útil desde el día 1: «¿qué se vendió más esta semana?», «¿qué productos están por agotarse?», «¿cómo cierro la caja?», «explícame este reporte».

## 5. Web y laptop
- **Web (PWA)**: se instala desde el navegador en PC, tableta o celular. Es la vía principal.
- **Laptop (Windows, luego Mac)**: la app de escritorio **Tauri** que ya existe en `apps/web/src-tauri`, apuntando a la nube del producto. Descarga desde la página del producto, instalador firmado y **actualización automática**. Imprime directo a la impresora térmica. Usa internet para conectarse a nuestros servidores (fase 2). Funcionamiento sin internet completo con sincronización: fase 4, aparte.
- Apps de Google Play / App Store: fase 3, como acompañamiento gratuito (sin compras dentro de la app).

## 6. Planes (precios a validar con la dueña)
| Plan | Precio/mes | Para quién |
|---|---|---|
| **Autoservicio** | RD$990 | 1 sucursal, 1 caja, 2 usuarios, IA 30 consultas, solo ayuda en línea e IA |
| Básico | RD$1,990 | 1 sucursal, 2 cajas, 3 usuarios, IA 50 |
| Pro | RD$3,990 | 2 sucursales, 6 cajas, 10 usuarios, IA 300, soporte prioritario |
| Premium | RD$7,990 | 5 sucursales, 20 cajas, 30 usuarios, IA 1,000 |
Descuento de 2 meses por pago anual. Instalación, migración asistida y cambios a la medida se cotizan aparte.

## 7. Fases y puertas
| Fase | Qué | Puerta para pasar |
|---|---|---|
| 0 | Rama, infraestructura separada, Tenant + RLS, matriz de aislamiento | 0 fugas entre empresas en la matriz; CI verde |
| 1 | Registro, prueba gratis, asistente de arranque, cobro automático (modo prueba), suspensión a solo lectura, exportación | Una empresa nueva se registra, carga productos y vende sin ayuda humana (prueba E2E) |
| 2 | Asistente de IA con cuotas + app de laptop Tauri con actualización automática + página del producto | IA responde con datos de su empresa sin fugas; laptop instala/actualiza sola |
| 3 | Piloto con 3–5 negocios reales; apps móviles de acompañamiento | 30 días sin incidentes de datos; cobro real funcionando |
| 4 | Offline en laptop con sincronización | Conflictos de inventario/ventas resueltos y probados |

## 8. Reglas para quien construya
- Nada se despliega sin los 3 CI en verde y sin revisión de Claude. Solo Claude despliega.
- Prohibido usar la base, las credenciales o el dominio de la tienda.
- Cada fase: rama propia, pruebas que fallen antes y pasen después, informe en `docs/coordinacion/RESULTADOS_CHATGPT.md`.
