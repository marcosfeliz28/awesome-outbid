# Conciliación de precios y planes (solo lectura, 16-nov-2026)

Fuentes: A = origin/producto-nexora; B = origin/nexora-cloud docs/venta/HOJA_DE_PRECIOS.md (aprobada 7-nov); C = landing (apps/landing/precios.html, en/pricing.html) + LANDING_TEXTOS.md + PROPUESTA_PRECIOS.md (todo en origin/nexora-cloud).
Abreviaturas de archivo: BP = apps/api/src/billing-plans.ts (producto-nexora); HOJA = docs/venta/HOJA_DE_PRECIOS.md; PP = docs/venta/PROPUESTA_PRECIOS.md; LT = docs/venta/LANDING_TEXTOS.md; PR = apps/landing/precios.html (EN: en/pricing.html, mismas cifras, líneas ±2).

## 1. Tabla lado a lado

### A. Código (BP:6-9). Moneda DOP, periodo mes. Pago anual = 10 meses (BP:4, comentario)
| Plan | Precio | Cajas | Sucursales | Usuarios | IA | Fuente |
|---|---|---|---|---|---|---|
| Autoservicio | RD$1,250/mes | 1 | 1 | 2 | 100 preguntas (periodo no escrito; el código usa «month», platform-ai-packs.ts:48-59) | BP:6 |
| Básico | RD$2,000/mes | 2 | 1 | 3 | 250 | BP:7 |
| Pro | RD$4,000/mes | 6 | 2 | 10 | 600 | BP:8 |
| Premium | RD$7,000/mes | 20 | 5 | 30 | 1,500 | BP:9 |
| Paquetes IA extra | RD$399 = 100 preguntas; RD$999 = 300 | | | | | platform-ai-packs.ts:23 |
La web (Billing.tsx:55) muestra «RD$ X/mes» tomado de la API. No hay IA por usuario ni precio en US$ en A.

### B. HOJA_DE_PRECIOS (US$, aprobada 7-nov; ~RD$60 por US$, HOJA:3)
| Opción | Precio | Periodo | Cajas | Sucursales | Usuarios | IA | Fuente |
|---|---|---|---|---|---|---|---|
| Instalado | US$149 | pago único (~RD$9,000) | hasta 3 | 1 | no figura | no incluida | HOJA:7 |
| Renovación | US$39 | año (desde el 2.º) | no figura | no figura | no figura | no figura | HOJA:8 |
| IA de ventas | US$7 por usuario | mes | — | — | por usuario | 10 preguntas/día por usuario | HOJA:9 |
| Facturas con IA | 20/mes incluidas; extra US$0.30 | mes | — | — | — | sí (con la IA) | HOJA:10 |
| Nube Medio | US$69 | mes | 5 | 1 | no figura | no figura | HOJA:11 |
| Nube Completo | US$119 | mes | 10 | 3 | no figura | no figura | HOJA:12 |
| Instalación + carga inventario | US$75 | una vez | — | — | — | — | HOJA:13 |
| Piloto | 0 | 60 días | — | — | — | — | HOJA:14 |

### C. Landing y textos
| Tema | precios.html / pricing.html | LANDING_TEXTOS.md | PROPUESTA_PRECIOS.md |
|---|---|---|---|
| Instalado | US$149 único, 1 suc., hasta 3 cajas, renov. US$39/año (PR:30-33) | no figura precio (LT:74 remite a docs/venta/precios.md, que no figura en la rama) | «Propuesta 7-nov» igual que B (PP:55); lista US$249, renov. lista US$59 |
| IA ventas | US$7/usuario/mes, 10/día (PR:38-41) | no figura | US$7 (PP:56); lista US$9 |
| Facturas IA | 20/mes, extra US$0.30 (PR:46-47) | no figura | PP:57 igual |
| Nube Medio | US$69/mes, 1 suc., 5 cajas (PR:51-52) | no figura | US$69 (PP:58); lista US$79. Opción A vieja: «Medio» US$59, 1 suc., 5 cajas, 10 usuarios (PP:16) |
| Nube Completo | US$119/mes, 3 suc., 10 cajas (PR:56-57) | no figura | US$119 (PP:59); lista US$139. Opción A vieja: 3 suc., 10 cajas, 25 usuarios, 30 preg/día (PP:17) |
| Básico | no figura | no figura | Opción A vieja: US$29, 1 suc., 2 cajas, 3 usuarios, sin IA (PP:15); sección 7-nov: «Nube Básico: no se ofrece» (PP:60) |
| Instalación | US$75 (PR:61) | no figura | US$75 (PP:61); Opción A vieja: US$150/250/400 (PP:19) |
| Piloto | 60 días (PR:24) | «prueba gratis», sin tarjeta, sin plazo (LT:66) | 60 días (PP:63; PP:30 con 20 % dto. el 1.er año) |
| Moneda | US$, ref. ~RD$60 (PR:26) | «Precio en RD$» (LT:44) | US$ (PP:3); dueña decide moneda |
| Usuarios | no figura | no figura | solo en Opción A vieja (PP:15-17) |

## 2. Contradicciones
1. Moneda: A cobra en RD$ (BP:6-9; Billing.tsx:55 «RD$ …/mes»). B, landing y PP cobran en US$ (HOJA:3; PR:24; PP:3). LT:44 promete «Precio en RD$».
2. Nombres de planes distintos: A = Autoservicio/Básico/Pro/Premium (BP:6-9); B/landing = Instalado/Nube Medio/Nube Completo (HOJA:7,11,12). PP:60 dice que «Nube Básico» no se ofrece, pero A vende «Básico» (BP:7). No hay equivalencia escrita entre ambos.
3. Modelo de venta: A es solo suscripción mensual (Billing.tsx:50 «Elige un plan mensual»). B tiene pago único de US$149 sin mensualidad (HOJA:7). Aún en A no existe plan «Instalado».
4. Equivalencia de precio: Nube Medio US$69 ≈ RD$4,140 (HOJA:11, a RD$60) vs Pro RD$4,000 (BP:8) pero con 5 cajas vs 6 y 1 sucursal vs 2. Completo US$119 ≈ RD$7,140 vs Premium RD$7,000 (BP:9) pero 3 suc./10 cajas vs 5 suc./20 cajas. Los límites no coinciden en ningún par.
5. Cajas: A Pro = 6 (BP:8), Premium = 20 (BP:9); B Medio = 5 (HOJA:11), Completo = 10 (HOJA:12). Instalado = hasta 3 cajas (HOJA:7); A no tiene plan con 3 (tiene 1, 2, 6, 20).
6. Sucursales: A Pro = 2, Premium = 5 (BP:8-9); B Completo = 3 (HOJA:12); Medio = 1 (HOJA:11) mientras A da 1 sucursal solo a Autoservicio/Básico (BP:6-7).
7. Usuarios: A limita a 2/3/10/30 y lo hace cumplir con 409 (BP:6-9, 40-42). B y landing: no figura límite de usuarios (HOJA:11-12; PR:51-57), y la IA se cobra por usuario (HOJA:9).
8. IA, unidad y periodo: A da cuota mensual por plan, incluida (100/250/600/1500, BP:6-9) y vende paquetes RD$399/100 y RD$999/300 (platform-ai-packs.ts:23). B/landing: IA opcional a US$7 por usuario, 10 preguntas al día (HOJA:9; PR:38-41), apagada hasta poner clave (HOJA:19). Dos modelos de cobro incompatibles. PP:16-17 (Opción A vieja) a su vez da 10/30 preguntas por día.
9. Lectura de facturas con IA (20/mes, extra US$0.30, HOJA:10; PR:46-47): no figura en A (ninguna cifra de facturas con IA en BP ni en billing/platform-ai-packs).
10. Propuesta vieja vs aprobada dentro de PP: Opción A US$29/59/119 con 3 planes (PP:15-17) y Medio US$59 vs aprobado US$69 (PP:58); instalación US$150/250/400 (PP:19) vs US$75 (PP:61). PP:11 sigue rotulada «recomendada». Queda como texto contradictorio en el mismo archivo.
11. Precio de lista vs introducción: PP:55-61 da lista (US$249 / 59 / 9 / 79 / 139 / 150); HOJA y landing solo muestran introducción y dicen «pueden cambiar» (HOJA:22; PR:73). No es error, pero la hoja no dice cuánto durará la introducción ni la lista.
12. Pago anual: A = 10 meses por 12 (BP:4). B/landing: no figura descuento anual para nube (HOJA:11-12); PP:20 dice «2 meses gratis (≈ −16 %)» solo en la Opción A vieja. Instalado usa renovación anual de US$39 (HOJA:8; lista US$59 en PP:55).
13. Piloto: 60 días (HOJA:14; PR:24; PP:63) vs «prueba gratis sin tarjeta» sin plazo (LT:66). A no tiene prueba ni piloto: ningún plan de costo 0 (BP:6-9).
14. Fiscal: LT:32-33 y LT:57-58 prometen «Comprobantes NCF» (con «verificar con contador»); HOJA:18 y PR:70 dicen que Norexos no emite NCF ni e-CF. LT:6 ya pide quitarlo; sigue en el texto.
15. «Sin instalar nada / funciona en el navegador» (LT:17, LT:53-54) vs producto principal Instalado US$149 «en tu laptop» (HOJA:7).
16. Precio inicial de plan más barato: A empieza en RD$1,250 (≈US$21, BP:6) con 1 caja/2 usuarios; B el más barato es Instalado US$149 único o Nube Medio US$69 (≈RD$4,140); PP:60 «No hay plan de nube más barato que Medio» (HOJA:21) contradice a A, que sí ofrece nube más barata (Autoservicio/Básico, BP:6-7) con tenancy (PRODUCT_TENANCY, BP:32).
17. Referencias rotas: LT:74 manda a `docs/venta/precios.md`, que no figura; la fuente real es HOJA/PP.

## 3. Qué mantendría y qué decide la dueña
Mantendría (sin decidir): HOJA_DE_PRECIOS como fuente vigente de cifras en US$ (aprobada 7-nov), con landing PR/EN alineada (coinciden entre sí, sin diferencias en cifras); y el código de A como mecanismo de límites (cuotas ya cumplidas en servidor), pendiente de que se le asignen los números definitivos.
La dueña necesita decidir:
- Si la nube (A) se vende en RD$ con Autoservicio/Básico/Pro/Premium, o en US$ con Medio/Completo (o ambas, y su equivalencia).
- Qué límites reales (cajas, sucursales, usuarios) tendrá cada plan nube, y si se agrega límite de usuarios a B.
- IA: cuota mensual incluida con paquetes (A) o US$7 por usuario/día (B).
- Tasa RD$/US$ y si se muestra en pesos.
- Si hay plan de nube más barato que Medio (A ya lo permite; HOJA:21 dice que no).
- Plazo de «prueba gratis» (LT:66) vs piloto 60 días; y si lista/anual se publican.
- Retirar el texto antiguo (PP Opción A, LT NCF y «sin instalar») o marcarlo como histórico.

17 contradicciones
