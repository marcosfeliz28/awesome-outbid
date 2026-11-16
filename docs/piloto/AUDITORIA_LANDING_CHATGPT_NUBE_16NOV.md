# Auditoría focal de la landing frente a la hoja de precios

Fecha de lectura: **16-nov-2026**. Alcance: solo lectura. Fuente aprobada:
`docs/venta/HOJA_DE_PRECIOS.md`. Páginas revisadas:
`apps/landing/precios.html` y `apps/landing/en/pricing.html`.

La página de precios continúa **sin publicar**: ambas versiones conservan
`noindex, nofollow` y una advertencia que exige orden escrita de la dueña antes
de enlazarla (`precios.html:6,12`; `en/pricing.html:6,12`).

## Precios y límites visibles

| Concepto | Español | Inglés | Hoja aprobada | ¿Coincide? |
| --- | --- | --- | --- | --- |
| Piloto | 60 días (`precios.html:24`) | 60 días (`en/pricing.html:24`) | 60 días sin costo (`HOJA_DE_PRECIOS.md:14`) | Sí |
| Instalado | US$149; 1 sucursal, hasta 3 cajas; renovación US$39/año (`precios.html:29-34`) | Mismas cifras (`en/pricing.html:31-36`) | US$149 y US$39 (`HOJA_DE_PRECIOS.md:7-8`) | Sí |
| IA de ventas | US$7/usuario/mes; 10 preguntas/día (`precios.html:37-42`) | Mismas cifras (`en/pricing.html:39-43`) | US$7 y 10/día (`HOJA_DE_PRECIOS.md:9`) | Sí |
| Facturas con IA | 20/mes; extra US$0.30 (`precios.html:45-47`) | Mismas cifras (`en/pricing.html:46-48`) | 20/mes y US$0.30 (`HOJA_DE_PRECIOS.md:10`) | Sí |
| Nube Medio | US$69; 1 sucursal, 5 cajas (`precios.html:50-52`) | Mismas cifras (`en/pricing.html:51-53`) | US$69; 1 sucursal, 5 cajas (`HOJA_DE_PRECIOS.md:11`) | Sí |
| Nube Completo | US$119; 3 sucursales, 10 cajas (`precios.html:55-57`) | Mismas cifras (`en/pricing.html:56-58`) | US$119; 3 sucursales, 10 cajas (`HOJA_DE_PRECIOS.md:12`) | Sí |
| Instalación opcional | US$75, una laptop (`precios.html:60-62`) | Mismas cifras (`en/pricing.html:61-63`) | US$75, una laptop (`HOJA_DE_PRECIOS.md:13`) | Sí |

## Las tres promesas dudosas

| Promesa | HTML actual | Borrador que aún la contiene | Resultado |
| --- | --- | --- | --- |
| NCF/e-CF | Dice que Norexos **no** los emite y que sus recibos no son fiscales (`precios.html:68-71`; `en/pricing.html:69-72`), alineado con `HOJA_DE_PRECIOS.md:18`. | `docs/venta/LANDING_TEXTOS.md:32,42,57-58` promete comprobantes NCF. | HTML correcto; borrador contradictorio, no usar para publicar. |
| «Sin instalar nada» | La frase no aparece en ningún archivo bajo `apps/landing/`. La página distingue la opción instalada y las opciones nube. | `docs/venta/LANDING_TEXTOS.md:17-18,53-54`. | No está en el HTML; retirar o separar por modalidad en el borrador. |
| «Precio en RD$» | Declara precios en US$ y solo una referencia aproximada de RD$60 por US$, pendiente de confirmar (`precios.html:24-26`; `en/pricing.html:24-28`). | `docs/venta/LANDING_TEXTOS.md:44`. | HTML correcto; no prometer precio final en RD$ hasta que la dueña fije tasa y moneda. |

## Conclusión

Las dos páginas HTML coinciden entre sí y con la hoja aprobada para las cifras
mostradas. El riesgo de publicación está en `LANDING_TEXTOS.md`, que conserva
las tres afirmaciones antiguas. No se cambió ese borrador porque esta tarea era
de verificación, no de aprobación comercial ni edición de precios.

