# Matriz de sincronía entre reportes (A6, 2-nov-2026)

Lectura solo GET con `entrar.py` contra producción, 2-nov 8:20–8:45 a. m. hora RD.
Rangos en hora de Santo Domingo (UTC−4): la API usa `T00:00:00-04:00` / `T23:59:59.999-04:00`;
`reportes.py` resta 4 h; `/sales?date=` usa el día RD. Los 31 días de octubre leídos uno por uno
con `/sales?date=` dan las mismas 356 facturas que `/dashboard/summary`: **no hay corrimiento de medianoche UTC**.

Datos del período: **0 devoluciones** en todo 2026 (`devoluciones-producto` = 0), 0 transferencias rechazadas.
Por eso hoy las reglas de devolución no cambian ninguna cifra; los fallos de lógica encontrados son latentes.

## 1. Ventas netas (con ITBIS, menos devoluciones) — cuadran en todas las fuentes

| Fuente                                                                                                            | Hoy 2-nov | Mes actual (1–2 nov) | Mes anterior (oct) |     Año 2026 |
| ----------------------------------------------------------------------------------------------------------------- | --------: | -------------------: | -----------------: | -----------: |
| `/dashboard/summary` revenue                                                                                      |      0.00 |            12,850.00 |       1,465,804.50 | 1,478,654.50 |
| summary: suma daily / category / payments / sellers                                                               |         0 |            12,850.00 |       1,465,804.50 | 1,478,654.50 |
| `/dashboard/breakdown` y `/dashboard/year`                                                                        |         0 |            12,850.00 |       1,465,804.50 | 1,478,654.50 |
| ventas-por-hora, por-dia-semana, ranking-cajeras, categoria-mes, por-marca, ticket-promedio, unidades-por-factura |         0 |            12,850.00 |       1,465,804.50 | 1,478,654.50 |
| formas-pago-mes, formas-pago-categoria, por-mayor-detalle (Neto)                                                  |         0 |            12,850.00 |       1,465,804.50 | 1,478,654.50 |
| margen-por-producto/categoría/empresa/marca/cajera, utilidad-bruta-por-mes (Venta)                                |         0 |            12,850.00 |       1,465,804.50 | 1,478,654.50 |
| by-seller, by-payment (informes de siempre)                                                                       |         0 |            12,850.00 |       1,465,804.50 | 1,478,654.50 |
| informe formal mes (`totals.sold`) / income-by-day (Vendido neto)                                                 |         — |                    — |       1,465,804.50 |            — |
| `reportes.py` diario×31 / mensual («VENDIDO»)                                                                     |         — |                    — |       1,465,804.50 |            — |
| Facturas (summary = ventas-por-hora = formal)                                                                     |         0 |                    2 |                356 |          358 |

## 2. Costo, utilidad y margen — AQUÍ ESTÁ LA CONTRADICCIÓN (S-01, S-02)

| Fuente (octubre)                                                                |                 Venta base |      Costo | Utilidad / ganancia |                                                                     Margen |
| ------------------------------------------------------------------------------- | -------------------------: | ---------: | ------------------: | -------------------------------------------------------------------------: |
| Panel «Ganancia bruta» (`grossProfit`) + nota «% de margen» (`margin`)          | 1,242,207.25 **sin ITBIS** | 777,664.04 |      **464,543.21** |                                          **46.95 %** (calculado con ITBIS) |
| `/dashboard/breakdown`, `/dashboard/year`, utilidad-bruta-por-mes, margen-por-* |     1,465,804.50 con ITBIS | 777,664.04 |      **688,140.46** |                                                                    46.95 % |
| Estado de resultados (income-statement)                                         |     1,242,207.25 sin ITBIS | 777,664.04 |          464,543.21 |                                                                          — |
| Utilidad por producto (`profit`)                                                |     1,242,207.25 sin ITBIS | 777,664.04 |          464,543.21 | por fila **con** ITBIS (70.03 % en una fila cuya utilidad/venta es 64.6 %) |
| Informe formal                                                                  |               1,465,804.50 | 777,664.04 |                   — |                                            46.95 % («ITBIS no descontado») |
| `reportes.py` «GANANCIA»                                                        |               1,465,804.50 | 777,664.04 |          688,140.46 |                                                                          — |

- Mismo concepto «ganancia bruta», dos cifras: **464,543.21** y **688,140.46** (diferencia = ITBIS 223,597.25).
- En la tarjeta del panel: 464,543.21 ÷ 1,465,804.50 = **31.7 %**, pero la nota dice **46.95 %**. Es la cifra que confunde.
- Regla de la dueña: margen = (precio − costo)/precio **sin restar ITBIS** → 688,140.46 / 46.95 %. El estado de resultados
  fiscal (sin ITBIS) es correcto para la contable, pero debe decir que es otra base. **Requiere visto bueno de la dueña** (no se tocó).

Año 2026: panel 468,225.89 vs utilidad-bruta 693,783.32; mes actual 3,682.68 vs 5,642.86; margen 46.92 % / 43.91 % en ambos.

## 3. ITBIS, descuentos, envíos, anulaciones

| Concepto (octubre)          | Fuente A                                           | Fuente B                                                 | ¿Cuadra?                         |
| --------------------------- | -------------------------------------------------- | -------------------------------------------------------- | -------------------------------- |
| ITBIS                       | summary `tax` 223,597.25                           | formal `totals.tax` 223,597.25 (= 1,465,804.50 × 18/118) | Sí                               |
| Descuentos                  | descuentos-cajera 291,115.50                       | formal `discounts` 291,115.50                            | Sí                               |
| Envíos (aparte de la venta) | envios-mensajero 15,799.93                         | no entra en ninguna venta (Sale.total sin `courierFee`)  | Sí                               |
| Anulaciones                 | anulaciones 25 / 151,287.80 (por fecha de factura) | formal 25 / 151,287.80 (por `updatedAt`)                 | Hoy sí; criterio distinto (S-18) |
| Comisiones bancarias        | summary `fees` 8,387.25                            | income-statement 8,387.25                                | Sí                               |
| Mermas                      | summary `inventoryLoss` 91,321.42                  | income-statement 91,321.42                               | Sí                               |

## 4. Dinero que entró vs vendido (octubre)

| Fuente                                              |                                                                                                                                  Cifra | Qué es                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------: | -------------------------------------------------------------------------------- |
| Formal «Dinero ingresado» / income-by-day `moneyIn` |                                                                                                                           1,247,754.50 | ventas cobradas + abonos de créditos (155,650.00)                                |
| `reportes.py` mensual «COBRADO»                     |                                                                                                                           1,092,104.50 | vendido − crédito, **sin** abonos (S-09: etiqueta ahora «Cobrado de lo vendido») |
| Crédito generado                                    |                                                       373,700.00 en formal, formas-pago-mes, by-payment (cod 330,000 + crédito 43,700) | Sí                                                                               |
| Formas de pago                                      | efectivo 202,900 · transf. 562,214.50 · tarjeta 326,990 · crédito 373,700 en panel, formas-pago-mes, by-payment, formal, `reportes.py` | Sí                                                                               |

## 5. Crédito por cobrar

| Fuente                                                               |                   Cifra | Corte                                                          |
| -------------------------------------------------------------------- | ----------------------: | -------------------------------------------------------------- |
| creditos-por-antiguedad y clientes-con-mas-deuda, rango hasta 31-oct | 218,050.00 (9 facturas) | ventas hasta el cierre, saldo de hoy                           |
| igual, rango hasta 2-nov                                             |         227,900.00 (10) | incluye la venta del 1-nov                                     |
| Informe formal **de octubre** (antes del arreglo)                    |         227,900.00 (10) | **sin corte**: metía la factura de noviembre (S-06, corregido) |
| `reportes.py` mensual «POR COBRAR»                                   |              218,050.00 | saldo de hoy de las facturas del mes (etiqueta aclarada)       |

## 6. Valor de inventario

Panel `inventoryCost` = costo-vendido-vs-inventario = valor-inventario-almacen (suma) = inventory-value (suma) = **4,459,832.20**. Cuadra.

## 7. Devoluciones (opción A) — reglas por fuente (latente: hoy 0 devoluciones)

| Fuente                                                                   | Resta la devolución en…                                              |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Panel, breakdown, year, grupo Ventas, grupo Margen, by-seller/by-payment | mes de la **venta** (opción A) ✔                                     |
| Informe formal (totales y categorías)                                    | fecha de la **devolución** → **corregido a opción A** (S-04, S-05)   |
| `reportes.py` diario/mensual                                             | **no restaba** → corregido (S-08)                                    |
| formas-pago-mes, descuentos-cajera, por-mayor-detalle                    | fecha de la devolución; su guía dice «Por confirmar» (S-16, abierto) |
| income-by-day y columna diaria del formal                                | día de la devolución (flujo de dinero; S-17, abierto)                |

## 8. PDF revisados como imagen (14 reportes del exportador nuevo + 14 del PDF viejo + formal + cierre diario)

Exportador nuevo (`/reports/:name/export`, aún no en producción: daba 404; se generó localmente con las filas reales de octubre):
utilidad-bruta-por-mes, margen-por-categoria, margen-por-empresa, ranking-cajeras, formas-pago-mes, descuentos-cajera,
por-mayor-detalle, creditos-por-antiguedad, valor-inventario-almacen, ventas-por-hora, envios-mensajero, ticket-promedio,
anulaciones, costo-vendido-vs-inventario. Fallos encontrados y corregidos: S-11 a S-14.
PDF viejo (`/reports/:name?format=pdf`, el que hoy baja la pantalla para los informes de siempre): S-15.
Cierre diario `reportes.py`: S-10. Informe formal: S-07.
