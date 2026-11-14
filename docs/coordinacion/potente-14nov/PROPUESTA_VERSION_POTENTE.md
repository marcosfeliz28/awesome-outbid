# Propuesta: versión potente de Norexos (14-nov-2026)

Para la dueña. Fase 5, solo lectura: junta lo de `02_TABLA_EMPRESAS.md`, `03_CRUCE_NOREXOS.md`, `04a_COMODIDAD_IA_NUEVAS.md`, `04b_ESTETICA_PRIVACIDAD.md` y `04c_BILINGUE_VENDIBLE_RD.md`. **Nada de esto autoriza construir.** Cada cosa se hace solo si usted la aprueba.

Reglas de dinero que no cambian con ninguna propuesta: margen = (precio − costo) / precio, sin restar ITBIS; mínimo 15 %; una oferta nunca cambia el precio en el sistema (la caja aplica el descuento); no se toca lo que usted contó o cambió ayer u hoy sin un conteo nuevo suyo. Lo que toca dinero lleva la verificación ×3 de la casa y su confirmación.

---

## 1. Resumen en 12 líneas

1. **Colores más ordenados:** el violeta de Norexos se queda como marca (ninguna de las 25 empresas lo usa) y el verde queda solo para «Cobrar» y el dinero que entra (PC-VIS-01).
2. **Un solo modo oscuro**, hoy hay dos negros distintos; quedaría uno con tres niveles de fondo (PC-VIS-02).
3. **Montos más fáciles de leer:** «RD$» pequeño y gris, el número grande (PC-VIS-03).
4. **Caja nueva:** pestañas «Favoritos / Ofertas» arriba, 4 columnas en la laptop, 2 en el celular, y el carrito como barra abajo en el celular (PC-VIS-04, PC-COM-01).
5. **El botón Cobrar dice el monto** («COBRAR RD$ 6,050.00»), para que la cajera confirme sin mirar arriba (PC-VIS-05).
6. **Panel «Hoy en una mirada»:** una cifra grande de lo vendido hoy comparada con el mismo día de la semana pasada y tres tarjetas que llevan a una acción (PC-VIS-07).
7. **Bloqueo con PIN** a los pocos minutos sin tocar, sin perder el carrito (PC-PRIV-01), y un **ojo para ocultar cifras** cuando hay clientes cerca (PC-PRIV-02).
8. **Bitácora en frases:** «Luis cambió el precio de Faja M de RD$ 1,900 a RD$ 1,800» en vez de códigos (PC-PRIV-05).
9. **IA que solo propone:** una bandeja donde esperan los borradores de la IA y una persona los aprueba; con tope de gasto mensual en RD$ (PC-IA-01, PC-IA-02).
10. **Empleadas nuevas:** hoja de bienvenida, recorrido de 5 pasos y botón «Llamar a la gerente» (PC-NEW-01, -02, -04).
11. **Factura fiscal:** Norexos hoy no emite e-CF. Hay una fecha (15-nov-2026) que **hay que confirmar con su contable**; primero su respuesta, después se decide el camino (PC-RD-01).
12. **Para vender Norexos:** el plan de nube Medio (US$69) sale más caro que Alegra Pro (US$39), y Alegra incluye e-CF. Usted decide el precio (PC-VEND-02).

---

## 2. Las 25 empresas

Fuente: `02_TABLA_EMPRESAS.md`, filas 25-36 y 110-122. Todas las páginas se consultaron el 14-nov-2026. Marcas: **V** = verificado en la página oficial ese día; **F1** = página oficial vista en la fase 1 (el mismo día), sin volver a abrirla; **T** = solo de terceros (reseñas, foros, prensa). Lo que no tenía fuente quedó fuera.

| #   | Empresa                | País                      | A quién vende                                      | Precio público                                                                                                                           | Fuente (consultada 14-nov-2026)                                                                                             | Estado                                                    |
| --- | ---------------------- | ------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Square (Retail)        | EE. UU.                   | Tiendas pequeñas y medianas                        | Plus CA$79, £49, A$109 al mes por local; Free $0. EE. UU. 49/149 USD solo de terceros (la página de EE. UU. dio error 429)               | https://squareup.com/gb/en/point-of-sale/retail/pricing · https://squareup.com/help/ca/article/6357                         | V (fuera de EE. UU.) / T (EE. UU.)                        |
| 2   | Shopify POS            | Canadá                    | De la primera venta a grandes marcas               | Basic 39, Grow 105, Advanced 399 USD/mes; POS Pro 89 por local                                                                           | https://www.shopify.com/pos/pricing                                                                                         | F1                                                        |
| 3   | Lightspeed Retail      | Canadá                    | Minoristas independientes y cadenas                | Basic 89, Core 149, Plus 289 USD/mes (pago anual)                                                                                        | https://www.lightspeedhq.com/pos/retail/pricing/                                                                            | F1                                                        |
| 4   | Clover (Fiserv)        | EE. UU.                   | Pymes: restaurante, tienda, servicios              | Basic 349 USD o 16/mes; Standard 1,899 + 84.95/mes; Advanced 2,648 + 104.90/mes                                                          | https://www.clover.com/pricing/retail                                                                                       | F1                                                        |
| 5   | Zettle / PayPal POS    | EE. UU. (PayPal)          | Comercio pequeño y ambulante                       | Sin mensualidad; lector $29; Terminal $199; 2.29 % + 9 ¢ (la página oficial muestra precios del Reino Unido)                             | https://www.zettle.com/us/pricing · https://www.merchantmaverick.com/reviews/zettle-review                                  | T                                                         |
| 6   | SumUp                  | Reino Unido / Europa      | Pymes                                              | POS Lite $0/mes con 2.60 % + 10 ¢; registro + lector $499; POS Plus $49/mes                                                              | https://www.sumup.com/en-us/pos/pos-lite/                                                                                   | F1                                                        |
| 7   | Toast                  | EE. UU.                   | Restaurantes; también tiendas                      | «Desde $0/mes» + equipo (V); $69/mes (T)                                                                                                 | https://pos.toasttab.com/pricing                                                                                            | V / T                                                     |
| 8   | Loyverse               | Chipre/Letonia (T)        | Tiendas y cafés pequeños                           | POS gratis; extras por tienda: historial $7, empleados $25, inventario avanzado $25 al mes                                               | https://loyverse.com/pricing                                                                                                | V                                                         |
| 9   | Odoo POS               | Bélgica                   | Pymes y empresas                                   | Gratis con 1 app; Standard $24.90 anual / $31.10 mensual por usuario; Custom $49.00 / $61.10 (lectura de la página, ver nota en 02)      | https://www.odoo.com/pricing                                                                                                | V                                                         |
| 10  | ERPNext POS            | India (Frappe)            | Pymes; código abierto                              | Instalado en su equipo gratis; Frappe Cloud desde $5/mes                                                                                 | https://frappe.io/erpnext/pricing                                                                                           | F1                                                        |
| 11  | Zoho Inventory         | India (Zoho)              | Pymes con inventario (no es caja)                  | Free $0; Standard 39/29, Premium 99/79, Plus 159/129, Enterprise 299/249 USD/mes (mensual/anual)                                         | https://www.zoho.com/inventory/pricing-comparison/                                                                          | F1                                                        |
| 12  | QuickBooks             | EE. UU. (Intuit)          | Contabilidad de pymes; su caja cerró el 3-oct-2023 | 38/85/140/340 al mes según una fuente; 35/65/99/235 según otra. **Conflicto**; la página oficial no cargó                                | https://costbench.com/software/accounting/quickbooks-online/hidden-costs/ · https://subger.com/en/service/quickbooks-online | T (conflicto)                                             |
| 13  | Alegra (incluye RD)    | Colombia; sitio RD propio | Pymes, comercios, contadores                       | POS USD 25 / 39 / 55 al mes; anual 22.50 / 35.10 / 49.50. Facturación USD 15 / 29 / 45                                                   | https://www.alegra.com/rdominicana/precios/                                                                                 | V                                                         |
| 14  | Siigo                  | Colombia                  | Pymes, contadores, restaurantes                    | POS por año: Esencial COP 345,000; Inicio 527,310 (otra página dice 498,015: conflicto); Avanzado 764,915                                | https://www.siigo.com/sistema-pos/                                                                                          | V (con conflicto)                                         |
| 15  | Bsale                  | Chile (también PE, MX)    | Pymes y emprendedores                              | Básico 1.5 UF, Estándar 1.9 UF, Full 2.9 UF + IVA al mes; caja solo en Estándar y Full                                                   | https://www.bsale.cl/sheet/precios                                                                                          | Parcial (solo resumen de búsqueda; no se abrió la página) |
| 16  | Treinta                | Colombia; «+21 países»    | Tiendas de barrio, belleza, restaurantes           | Esencial COP 39,900 / 35,910 trimestral / 29,925 anual; Pro 79,900 / 71,910 / 59,925 (el total trimestral de Pro en la página no cuadra) | https://www.treinta.co/                                                                                                     | V (con conflicto)                                         |
| 17  | Kyte                   | Brasil                    | Pequeño comercio, mayorista                        | Free; PRO 9.99, GROW 13.99, PRIME 19.99 al mes (moneda no escrita)                                                                       | https://kyteapp.com/pricing                                                                                                 | V                                                         |
| 18  | Vendty                 | Colombia                  | Restaurantes y comercios                           | COP/mes: Emprendedor 155,000; Profesional 85,000; Empresarial 140,000 (página incoherente)                                               | https://vendty.com/precios                                                                                                  | V (con conflictos)                                        |
| 19  | Fudo                   | Argentina                 | Restaurantes, bares, cafés                         | Avanzado USD 35, Pro USD 45 al mes; Recepcionista IA + USD 40                                                                            | https://fu.do/precios                                                                                                       | V                                                         |
| 20  | Mercado Pago Point     | Argentina; LatAm          | Comercios y autónomos                              | Point Smart ARS 44,999; comisiones distintas en la misma página (conflicto)                                                              | https://www.mercadopago.com.ar/herramientas-para-vender/lectores-point/point-smart                                          | V (con conflicto)                                         |
| 21  | Tiendanube POS         | Argentina/Brasil; México  | Tiendas en línea con local                         | MXN/mes: Gratis; Básico 149; Tiendanube 374; Avanzado 999                                                                                | https://www.tiendanube.com/mx/canales/punto-de-venta                                                                        | V                                                         |
| 22  | Poster POS             | Hong Kong / EE. UU.       | Cafés, restaurantes, tiendas                       | Tienda: $26/$29, $44/$49, $62/$69 al mes (moneda no escrita)                                                                             | https://joinposter.com/en/pricing-retail                                                                                    | V                                                         |
| 23  | Facturapp              | República Dominicana      | Colmados, ferreterías, farmacias, boutiques        | RD$/mes + ITBIS: Gratis (50 documentos); 990; 1,990; 3,990; 7,990; anual = 10 meses. **Dice no ser proveedor autorizado (PSFE)**         | https://facturapp.do/precios/ · https://facturapp.do/dgii/                                                                  | V                                                         |
| 24  | Nexprint (módulo Odoo) | República Dominicana      | Usuarios de Odoo 17/18/19                          | USD 285.04 pago único; requiere Odoo aparte                                                                                              | https://apps.odoo.com/apps/modules/18.0/nexprint_l10n_do_pos_ecf                                                            | V                                                         |
| 25  | RestaurantOS Pro       | República Dominicana      | Solo restaurantes                                  | **Conflicto:** 1,499/mes (Capterra) contra «desde 34/mes» (GetApp); sin sitio oficial; ambas páginas dieron 403                          | https://www.capterra.com/p/10043478/RestaurantOS-Pro/ · https://www.getapp.com/all-software/a/restaurantos-pro/             | Solo tercero                                              |

Fiscal dominicano: de las 25, solo Alegra (e-CF 31/32, V), Nexprint (E31-E47 con QR, V), Odoo (F1) y Facturapp (E31/E32, F1; no es PSFE, V) publican algo de e-CF. Ninguna global lo trae.

---

## 3. Qué tienen ellos y Norexos no, y al revés

Fuente: `03_CRUCE_NOREXOS.md` §1 (líneas 15-32) y §2 (líneas 38-57). Las citas de código las abrió el agente de la fase 3; la app no se ejecutó.

### 3.1 Ellos lo tienen, Norexos no

| Qué                                         | Quién                                       | Norexos hoy                                                                                         |
| ------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Emitir e-CF de verdad a la DGII             | Alegra V, Nexprint V, Odoo F1, Facturapp F1 | No emite; recibo «DOCUMENTO NO FISCAL» (`apps/web/src/Prints.tsx:510`; `apps/api/src/admin.ts:110`) |
| QR oficial DGII en el ticket                | Nexprint V                                  | No encontrado                                                                                       |
| e-CF sin internet que se envía después      | Alegra V                                    | No aplica (no hay e-CF)                                                                             |
| Barra de estado de impresora/lector/escáner | Square V                                    | No encontrada en `POS.tsx`                                                                          |
| Inglés en la app                            | Square V, Shopify V                         | Solo español (`apps/web/index.html:2`)                                                              |
| Pestañas de favoritos / mosaicos de color   | Square V, Loyverse V                        | Una sola cuadrícula (`apps/web/src/POS.tsx:1622`)                                                   |
| Descripciones de producto con IA            | Square F1, Kyte V                           | No encontrado                                                                                       |
| Recepcionista por WhatsApp                  | Fudo V                                      | No; avisos por Telegram (`apps/api/src/notifications.ts:1`)                                         |
| Pronóstico de demanda                       | Lightspeed F1, Zoho V                       | Sugerencia fija (ya propuesto: D9)                                                                  |
| Escaneo continuo con cámara                 | Square F1                                   | La cámara se cierra tras cada código (ya propuesto: C14)                                            |

Corrección: 03 decía que no sabía si la caja muestra las ventas por subir. **Sí las muestra:** «En línea / Sin conexión · N» (`apps/web/src/App.tsx:1124-1149`, según 04a línea 18).

### 3.2 Norexos lo tiene y ellos no lo publican

| Qué                                                            | Dónde en Norexos                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Su fórmula de margen, sin restar ITBIS                         | `packages/shared/src/index.ts:484-487`                                             |
| Aviso de margen bajo en la caja (solo informa)                 | `apps/web/src/POS.tsx:2995`                                                        |
| Descuento seguro (el mayor que deja el margen en 15 %)         | `packages/shared/src/index.ts:532-537`                                             |
| Tope de descuento de la cajera (10 % por defecto) y PIN encima | `apps/api/src/sales.ts:640`                                                        |
| Motivo obligatorio del descuento                               | `packages/shared/src/index.ts:571`; `apps/api/src/sales.ts:788`                    |
| Registro de quién autorizó cada descuento                      | `apps/api/src/sales.ts:1505-1516`                                                  |
| PIN de gerente; nadie se aprueba a sí mismo (usted sí)         | `apps/api/src/security.ts:92`, `:99`, `:123`                                       |
| Verificación de transferencias solo por usted                  | `apps/api/src/sales.ts:3136-3138`; `apps/web/src/TransferReconciliation.tsx:77-87` |
| Venta sin internet que no se duplica                           | `apps/web/src/offlinePolicy.ts:5-12`; `apps/web/src/POS.tsx:1913-1915`             |
| Aprobación de equipos nuevos por la gerente                    | `apps/web/src/realtime.tsx:537-538`                                                |
| Cierre a ciegas (la cajera no ve lo esperado)                  | `apps/api/src/common.ts:69-72` (Facturapp también lo tiene)                        |
| La vendedora nunca ve costos                                   | `apps/api/src/common.ts:368-370`                                                   |
| Atajos F2, F4, F8, F12                                         | `apps/web/src/App.tsx:838`, `:850`; `apps/web/src/POS.tsx:1323`                    |
| Búsqueda por voz                                               | `apps/web/src/POS.tsx:993`                                                         |
| GV: cursos y citas con pagos                                   | `apps/api/src/gv-citas.ts:301`; `apps/api/src/gv.ts:546`                           |
| Medidor de gasto de IA y tope diario                           | `apps/web/src/AiUsage.tsx:25`; `apps/api/src/ai-daily-limit.ts:5`                  |
| NCF e ITBIS del suplidor en compras                            | `apps/api/prisma/schema.prisma:580`, `:584`                                        |

---

## 4. Propuestas por área

57 propuestas (19 en 04a, 20 en 04b, 18 en 04c). Ninguna está aprobada. Formato: **ID** · qué hace · esfuerzo (P = horas, M = 1-3 días, G = una semana o más) · ¿toca dinero? · dónde está el detalle.

Hay tres repetidas entre documentos: PC-COM-01 y las pestañas de PC-VIS-04; PC-COM-04 y PC-RD-05 (aviso fiscal); PC-COM-05 y PC-PRIV-03 («ver como este rol»). Si se aprueban, se hacen una sola vez.

### 4.1 Comodidad (04a)

- **PC-COM-01** · Pestañas «Más vendidos» y «En oferta» al principio de la caja (el precio no cambia) · P · no · `04a:24`
- **PC-COM-02** · «Probar equipo» al abrir la caja · M · no · `04a:37`
- **PC-COM-03** · Tope de descuento por persona, además del general · M · **sí** · `04a:52`
- **PC-COM-04** · Franja de estado fiscal para usted, sin tapar el trabajo · P · no · `04a:70`
- **PC-COM-05** · «Ver como este rol» al editar permisos · M · no · `04a:83`
- **PC-COM-06** · Inglés en la caja, solo para la versión que se vende · G · no · `04a:96`

### 4.2 IA útil (04a). Todas: la IA propone y una persona confirma; nunca escribe sola en ventas, inventario, precios ni pagos

- **PC-IA-01** · Bandeja única «Propuestas de la IA»; al aprobar se usa la ruta y el PIN de siempre · M · **sí** (al aprobar algo de dinero) · `04a:116`
- **PC-IA-02** · Tope de gasto mensual de IA en RD$, aviso al 80 %, se apaga al 100 % · P-M · no (es gasto del proveedor) · `04a:132`
- **PC-IA-03** · Descripciones de producto en borrador, aprobadas en lote · P · no · `04a:150`
- **PC-IA-04** · Producto nuevo desde foto de etiqueta o código; el precio lo escribe la persona · M · no · `04a:166`
- **PC-IA-05** · Consultas desde la app de Claude, solo lectura (MCP) · M · no · `04a:180`
- **PC-IA-06** · Recepcionista por WhatsApp para cursos y citas de GV · G · no · `04a:196`
- **PC-IA-07** · Conteo dictado que llena el borrador de la hoja de conteo · M · **sí** (termina en ajuste) · `04a:214`

### 4.3 Empleadas nuevas (04a)

- **PC-NEW-01** · Hoja de bienvenida al crear una usuaria (sin contraseña escrita) · P · no · `04a:233`
- **PC-NEW-02** · Recorrido de 5 pasos la primera vez que entra a Caja · P-M · no · `04a:246`
- **PC-NEW-03** · Periodo de prueba de la empleada nueva (tope de descuento menor) · M · **sí** · `04a:258`
- **PC-NEW-04** · Botón «Llamar a la gerente» en la caja · P-M · no · `04a:274`
- **PC-NEW-05** · Ficha rápida del producto para vender · P · no · `04a:287`
- **PC-NEW-06** · «Primeras dos semanas»: resumen por empleada nueva para la gerente · M · no · `04a:299`

### 4.4 Privacidad y acceso (04b)

- **PC-PRIV-01** · Bloqueo rápido con PIN (3 min) en vez de cerrar sesión; el carrito se conserva · M · no · `04b:431`
- **PC-PRIV-02** · Botón «ocultar cifras» en el panel y los informes · P · no · `04b:460`
- **PC-PRIV-03** · «Ver como cajera»: vista previa de lo que ve cada rol · M · no · `04b:469`
- **PC-PRIV-04** · Teléfono y cédula de clientes tapados también para la gerencia, con botón «Mostrar» que queda registrado · M · no · `04b:478`
- **PC-PRIV-05** · Bitácora en frases con antes y después · M · no · `04b:487`
- **PC-PRIV-06** · Lista de equipos y sesiones abiertas, con cierre a distancia · M · no · `04b:509`

### 4.5 Estética (04b): la sección más larga

Nada de esto se vio en pantalla: lo de Norexos sale del código y lo de la competencia sale de páginas de venta. Aquí van las 10 mejores con «cómo se vería»; las otras cuatro (PC-VIS-09 a -12) están abajo en una línea y con detalle en 04b.

**PC-VIS-01 · Paleta con papeles fijos** · M · no · `04b:57`
Cuatro papeles y nada más: **violeta** = marca y acción general; **verde** = solo Cobrar, Abonar y cifras positivas; **ámbar** = atención (stock bajo, venta sin enviar); **rojo** = peligro (anular, faltante). Todo lo demás en grises.
Cómo se vería: el violeta pasa de `#7c3aed` a `#6d28d9`, un tono más oscuro que se ve «más caro» y deja leer mejor el texto blanco. Modo oscuro: violeta claro `#a78bfa`. Verde de cobrar `#047857` (oscuro: `#10b981`). El anillo de foco del botón Cobrar pasa a ser verde, no violeta.

**PC-VIS-02 · Un solo modo oscuro con tres niveles** · M · no · `04b:85`
Hoy hay dos negros distintos. Quedaría: fondo `#0e111a` → tarjeta y carrito `#161a26` → menús y ventanas `#1d2232`, cada nivel un poco más claro, en vez de sombras. En oscuro, el botón Cobrar sube de tono para seguir siendo lo más brillante de la pantalla.

**PC-VIS-03 · Montos con estilo propio** · P · no · `04b:104`

```
Línea del carrito      RD$ 1,250.00      16 px; «RD$» más pequeño y gris
Total a cobrar     RD$ 4,830.00          32 px en laptop / 28 px en celular
Cifra del panel    RD$ 24,580            40 px / 32 px
                   ↑ 18 % vs. el mismo día de la semana pasada (verde o rojo, con flecha)
```

Los números no «bailan» (todos los dígitos del mismo ancho). Negativos con signo «−» y en rojo, nunca solo el color.

**PC-VIS-04 · Caja en laptop (1366 px) y celular (390 px)** · G · no (hay que repetir las pruebas de cobro) · `04b:124`
Laptop: menú de iconos a la izquierda; buscador arriba con «F2»; pestañas «Favoritos · Ofertas · Suplementos · Maquillaje…»; 4 columnas de tarjetas (5 en pantallas anchas, 3 en pequeñas) con foto cuadrada, nombre, precio y existencia; carrito de 380 px a la derecha con TOTAL y COBRAR · F12 de 64 px. Toda la tarjeta se puede tocar, no solo el «+».
Celular:

```
┌──────────────────────────────┐
│ ☰  Caja · Ana     ● En línea │
│ [🔍 Buscar o escanear   📷 ] │
│ Favoritos Ofertas Suplem… →  │
│ ┌──────┐┌──────┐  2 columnas │
│ │ foto ││ foto │             │
│ │RD$ … ││RD$ … │             │
│ └──────┘└──────┘             │
├──────────────────────────────┤
│ 3 artículos   RD$ 6,050.00 ▲ │  tocar abre el carrito
│ [        COBRAR          ]   │
└──────────────────────────────┘
```

«Favoritos» los elige usted con una estrella en Productos.

**PC-VIS-05 · Carrito como ticket** · M · no · `04b:178`

```
[foto] Proteína Whey 2 lb        RD$ 2,450
       GV-0123 · Vainilla        [− 1 +]
Subtotal                    RD$ 5,141.53
(%) ITBIS incluido          RD$   908.47
════════════════════════════════════════
TOTAL                       RD$ 6,050.00
[ 💳  COBRAR RD$ 6,050.00        F12 ]
  ⏸ Espera     📄 Cotizar      🗑 Limpiar
```

El monto va dentro del botón. «Limpiar» queda gris y apartado para no tocarlo por error.

**PC-VIS-06 · Barra de estado de la caja** · M · no · `04b:209`

```
Caja 1 · Ana · abierta 8:02 a. m.   ● En línea   ⬆ 0 por subir
sin internet:                       ● Sin conexión  ⬆ 3 por subir (ámbar)
```

La píldora de impresora («🖨 Lista») solo aparece cuando exista impresión directa (MOD-03): no se inventa un estado.

**PC-VIS-07 · Panel «Hoy en una mirada»** · M · no · `04b:230`
Arriba, «Buenos días» con la fecha y la tienda. Una tarjeta grande: **Vendido hoy RD$ 24,580**, con una línea pequeña y «↑ 18 % vs. sábado pasado · 31 ventas». Al lado, «Margen de hoy 32 % ✓ sobre el 15 %» (solo para quien tenga permiso). Debajo, tres tarjetas que llevan a una acción: «Caja · 2 abiertas ›», «Stock bajo · 7 productos ›», «Por cobrar · RD$ 18,300 ›». Las cifras son de ejemplo. Se compara con el mismo día de la semana anterior porque un sábado contra un viernes engaña.

**PC-VIS-08 · Tablas legibles** · M · no · `04b:260`
Filas de 48 px, montos alineados a la derecha, cabecera que se queda fija al bajar, sin mayúsculas (con tildes se leen peor), estado con punto de color **y** palabra («● Pagada», «● Por revisar»).

**PC-VIS-13 · Recibo térmico ordenado** · M · **sí** (imprime montos; se verifica cifra por cifra) · `04b:360`
Logo en blanco y negro puro (para que no salga como mancha), nombre del negocio, RNC, cajera y cliente, líneas con nombre en negrita, subtotal, «ITBIS incluido 18 %», **TOTAL** grande, efectivo y devuelta, «DOCUMENTO NO FISCAL» y «¡Gracias por su compra!». Tamaños fijos para papel de 80 y de 58 mm; en 58 mm la letra nunca más grande que en 80.

**PC-VIS-14 · Página de venta con pantallas reales** · M · no · `04b:396`
Fondo oscuro con el mismo violeta de la app (hoy la página usa otro violeta, `#5b3fc4`), titular «Vende, cuadra y controla tu tienda desde un solo lugar», foto real de la caja en una laptop y en un celular, y una tarjeta «Vendido hoy RD$ 24,580 ↑ 18 %». Sin ventanas emergentes, cuentas regresivas ni chat flotante. Las capturas salen de la base de demostración, nunca con clientes reales.

Las otras cuatro:

- **PC-VIS-09** · Un solo diseño para «cargando / vacío / error»; mientras carga nunca se ve un RD$ 0.00 · M · no · `04b:283`
- **PC-VIS-10** · Iconos: un solo juego, dos tamaños (20 y 24 px), siempre con texto · P · no · `04b:309`
- **PC-VIS-11** · Solo 4 animaciones permitidas (producto agregado, ventana que abre, venta cobrada ✓, carga) · P · no · `04b:318`
- **PC-VIS-12** · Primer arranque: tarjeta «Deja lista tu tienda, 3 de 5» con progreso · M · no · `04b:336`

### 4.6 Administración bilingüe (04c)

- **PC-I18N-01** · Idioma por usuaria: usted puede ver Administración en inglés y la cajera sigue en español · M · no · `04c:19`
- **PC-I18N-02** · Empezar por Administración y Reportes, no por la caja; el borrador de traducción se revisa antes · M · no · `04c:20`
- **PC-I18N-03** · Formato de números y fechas según el idioma; la moneda siempre RD$ · P · **sí** (muestra montos) · `04c:21`
- **PC-I18N-04** · NCF, e-CF, ITBIS, RNC y 606/607/608 nunca se traducen · P · no · `04c:22`
- **PC-I18N-05** · Excel con columnas fijas; solo se traducen los títulos (la plantilla de la contable no se rompe) · M · no · `04c:23`
- **PC-I18N-06** · Instalador y página de venta en inglés, solo con su orden escrita · P · no · `04c:24`

### 4.7 Producto vendible (04c)

- **PC-VEND-01** · Un solo archivo de planes para la hoja de precios, la página de venta y el sistema · P · no · `04c:49`
- **PC-VEND-02** · Plan «Nube Inicial» o argumento claro frente a Alegra; **sin cifra propuesta** · P · **sí** (precio de venta) · `04c:50`
- **PC-VEND-03** · Precio en RD$ con tasa y fecha fijadas por usted · P · **sí** · `04c:51`
- **PC-VEND-04** · Medir cuánto tarda instalar, de doble clic a primera venta, y publicar el número · P · no · `04c:52`
- **PC-VEND-05** · Datos de ejemplo borrables para el cliente nuevo; nunca en su tienda · M · **sí** (crea y borra inventario) · `04c:53`
- **PC-VEND-06** · Decirle al comprador qué hacer con la factura fiscal mientras Norexos no emita; texto revisado por la contable · P · no · `04c:54`

### 4.8 Cumplimiento dominicano (04c)

- **PC-RD-01** · Primero la respuesta escrita de su contable (grupo DGII, plazo, camino, sin internet) · P · no · `04c:90`
- **PC-RD-02** · Si se elige el camino B: anotar en Norexos el e-NCF emitido por otro medio y una lista diaria de «ventas sin comprobante» · M · **sí** (marca ventas; no cambia montos) · `04c:91`
- **PC-RD-03** · Excel «606» de compras con las columnas de la DGII · M · **sí** (cifras fiscales) · `04c:92`
- **PC-RD-04** · «607» de ventas y «608» de anulados, solo si la contable confirma que aplican · M · **sí** · `04c:93`
- **PC-RD-05** · Una línea con el estado fiscal real en Resumen/Configuración; nada de ventanas que tapen la caja · P · no · `04c:94`
- **PC-RD-06** · Si se elige el camino A: solo el diseño de la conexión con un proveedor autorizado, sin código · P (diseño) / G (construirlo) · **sí** · `04c:95`

---

## 5. Orden sugerido

**Fase 1: victorias rápidas que no tocan dinero (casi todo esfuerzo P)**
PC-RD-01 (pregunta a la contable, va primero), PC-VIS-03, PC-VIS-10, PC-VIS-11, PC-PRIV-02, PC-COM-01, PC-COM-04 / PC-RD-05 (una sola), PC-NEW-01, PC-NEW-05, PC-IA-03, PC-I18N-04, PC-VEND-01, PC-VEND-04, PC-VEND-06.

**Fase 2: cambios medianos que no tocan dinero**
Lo visual: PC-VIS-01 y -02 (con DIS-07), -05, -06, -07, -08, -09, -14. Privacidad: PC-PRIV-01, -03 (junto con PC-COM-05), -04, -05, -06. Empleadas e IA: PC-COM-02, PC-NEW-02, -04, -06, PC-IA-02 (antes de encender IA nueva), PC-IA-04, PC-IA-05. Inglés: PC-I18N-01, -02, -05, -06 (solo si usted dice sí al inglés).

**Fase 3: lo que toca dinero o es grande (cada una con verificación ×3 y su sí)**
PC-VIS-04 (después de DIS-08), PC-VIS-13, PC-VIS-12 (depende de EST-01/MOD-02), PC-COM-03, PC-NEW-03, PC-IA-01, PC-IA-07, PC-I18N-03, PC-VEND-02, -03, -05, PC-RD-02, -03, -04, -06, PC-COM-06, PC-IA-06.

---

## 6. Decisiones para usted

1. **Fecha e-CF del 15-nov-2026 y grupo DGII.** Es un **hallazgo a confirmar, no un hecho**: una noticia de la DGII del 19-oct-2026 dice que el 15-nov-2026 vence la prórroga para «pequeños, micro y no clasificados». No se sabe a qué grupo pertenecen Grupo MacGen ni GV.
   Opciones: (a) llamar hoy a su contable; (b) esperar. **Recomendación: (a)**, con las preguntas ya escritas en `docs/fiscal/PREGUNTAS_CONTADOR.md` (1, 2, 7 y 8).
2. **Camino fiscal.** (A) emitir desde la caja con un proveedor autorizado (grande, no llega a esta fecha); (B) emitir por otro medio y anotarlo en Norexos; (C) no emitir desde Norexos. **Recomendación:** no decidir hasta tener la respuesta de la contable; si hace falta algo ya, B es el puente más corto.
3. **Encender IA nueva y tope de gasto.** (a) Primero el tope mensual en RD$ (PC-IA-02) y después la IA nueva; (b) encender sin tope mensual; (c) no encender nada nuevo. **Recomendación: (a).** El monto lo fija usted.
4. **Qué toca dinero, una por una.** Cada una se aprueba por separado y lleva verificación ×3: PC-COM-03 (tope de descuento por persona), PC-NEW-03 (periodo de prueba), PC-IA-01 (aprobar propuestas de IA), PC-IA-07 (conteo dictado), PC-I18N-03 (formato de montos), PC-VIS-13 (recibo), PC-VEND-02 (precio de plan), PC-VEND-03 (RD$ y tasa), PC-VEND-05 (datos de ejemplo), PC-RD-02, -03, -04 y -06. **Recomendación:** empezar por PC-VIS-13 y PC-RD-03, que no cambian ningún cálculo; las de descuentos, después.
5. **Paleta.** (a) Seguir con violeta y oscurecerlo a `#6d28d9`; (b) seguir con el violeta de hoy `#7c3aed`; (c) cambiar de color. **Recomendación: (a).** Ninguna de las 25 usa violeta, así que la distingue.
6. **Modo oscuro.** (a) Uno solo, con tres niveles (PC-VIS-02); (b) dejarlo como está. **Recomendación: (a).**
7. **Inglés.** (a) No por ahora; (b) solo Administración y Reportes para usted o un socio (PC-I18N-01/02); (c) toda la app, incluida la caja (PC-COM-06). **Recomendación: (b) solo si se va a vender fuera; la tienda en RD no lo necesita.**
8. **Plan de nube barato.** (a) Crear «Nube Inicial» con un precio cercano a Alegra (USD 25) o Facturapp (RD$ 990); (b) vender el Instalado de pago único (US$149) como la opción barata; (c) no cambiar nada. **Recomendación:** (a) o (b), pero decídalo con la objeción delante: Alegra Pro cuesta US$39 e incluye e-CF, y Nube Medio cuesta US$69 y no lo incluye. No se propone ninguna cifra.
9. **Precio en pesos.** (a) Publicar en RD$ con la tasa y la fecha que usted fije, aclarando si lleva ITBIS; (b) seguir en US$. **Recomendación: (a).**
10. **Bloqueo rápido.** ¿Después de cuántos minutos sin tocar se bloquea la caja con PIN? (a) 3; (b) otro de 1 a 10; (c) no bloquear. **Recomendación: (a) 3 min.** El cierre de sesión a los 30 min sigue como hoy.
11. **Datos de clientes tapados para la gerencia** (PC-PRIV-04). (a) Sí, con botón «Mostrar» registrado; (b) no. **Recomendación: (a).**
12. **Consultas desde la app de Claude** (PC-IA-05, solo lectura). (a) Sí, solo para usted; (b) también para la gerencia; (c) no. **Recomendación: (a).**
13. **Recepcionista WhatsApp para GV** (PC-IA-06, esfuerzo G). (a) Ahora; (b) después de la fase 2; (c) no. **Recomendación: (b).**
14. **Panel.** ¿Comparar contra el mismo día de la semana pasada (recomendado) o contra ayer? ¿Quitar los decimales cuando la cifra pase de RD$ 10,000? **Recomendación:** semana pasada; sin decimales en el panel y con decimales en la caja.
15. **Empezar o no.** (a) Autorizar solo la fase 1; (b) esperar. **Recomendación: (a)**, empezando por la pregunta a la contable.

---

## 7. Lo que no se comprobó

- **Nada se vio en pantalla:** la app de Norexos no se ejecutó en ninguna fase. Todo lo que se dice de Norexos sale de leer el código. Colores, tamaños y el recibo impreso no se vieron.
- **Las capturas de la competencia son páginas de venta,** no cajas en uso. Las «cajas de muestra» son imágenes promocionales pequeñas; los colores se estimaron a ojo. No hay captura de Odoo, QuickBooks, Zettle, Mercado Pago, Nexprint ni RestaurantOS, y 8 capturas no se abrieron en la fase 4.
- **Precios en conflicto sin resolver:** Treinta (total trimestral Pro), Vendty, Siigo POS Inicio, QuickBooks, Mercado Pago (comisiones), RestaurantOS, Square EE. UU. (bloqueado) y Zettle EE. UU. (solo el Reino Unido). Bsale solo por resumen de búsqueda.
- **DGII:** la lista oficial de proveedores autorizados dio **403**. No se pudo comprobar si Alanube o INDEXA siguen autorizados; lo de Alegra a través de Alanube viene solo de terceros. El texto del Aviso 06-26 no se leyó. El formato vigente del 606/607/608 no se leyó.
- **Grupo DGII de MacGen y GV:** desconocido; por eso la fecha del 15-nov es un hallazgo a confirmar.
- **Rama del código:** 03 no comprobó que su árbol fuera igual a la tienda en vivo; 04a sí lo comparó (diff vacío en `apps` y `packages`). La rama `producto-nexora` no estaba en el clon: lo de «Plan y facturación» y «Primeros pasos» viene de documentos.
- El borrador de traducción al inglés está marcado «sin verificar».
- Contrastes de color calculados a mano.
