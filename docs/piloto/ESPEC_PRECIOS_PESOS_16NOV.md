# Especificación: alinear hoja, landing, textos y contratos al código en pesos (16-nov-2026, solo lectura, nada ejecutado)

Verdad (código, origin/producto-nexora, BP = apps/api/src/billing-plans.ts:6-9; paquetes IA = platform-ai-packs.ts:23):

| Plan | RD$/mes | Cajas | Sucursales | Usuarios | Preguntas IA/mes |
|---|---|---|---|---|---|
| Autoservicio | 1,250 | 1 | 1 | 2 | 100 |
| Básico | 2,000 | 2 | 1 | 3 | 250 |
| Pro | 4,000 | 6 | 2 | 10 | 600 |
| Premium | 7,000 | 20 | 5 | 30 | 1,500 |

Paquetes IA extra: 100 preguntas = RD$399; 300 = RD$999 (solo el mes en que se acreditan). Pago anual = 10 meses (BP:4).
Archivos (rama origin/nexora-cloud): HOJA = docs/venta/HOJA_DE_PRECIOS.md; PR = apps/landing/precios.html; EN = apps/landing/en/pricing.html (mismas líneas ±2); LT = docs/venta/LANDING_TEXTOS.md; PP = docs/venta/PROPUESTA_PRECIOS.md; IDX = apps/landing/index.html; C1 = docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md; C5 = .../05_CONDICIONES_DE_COBRO.md; C6 = .../06_CONTRATO_LICENCIA_INSTALADO.md. Existe además la versión imprimible hoja-de-precios.html (no se leyó su ubicación: cambiarla igual que HOJA).

## Tabla (una fila por contradicción del informe)

| # | Dónde (archivo:línea) | Texto actual | Texto propuesto | Riesgo |
|---|---|---|---|---|
| 1 Moneda | HOJA:1,3; PR:7,24,26; EN:24,27; PP:3; C1:41,267; C5:17-19; C6:56 | «Precios en US$… ~RD$60 por US$ (confirmar tasa)»; «Moneda de cobro [USD / DOP]»; columnas «(USD)» | «Precios en RD$ por mes. Autoservicio RD$1,250; Básico RD$2,000; Pro RD$4,000; Premium RD$7,000.» Borrar la línea de tasa (PR:26, EN:27, HOJA:3). C1:267 y C5:17: «DOP». C5:18-19 (tasa y ajuste ±5 %): suprimir o marcar «no aplica en pesos». LT:44 «Precio en RD$» pasa a ser cierto, sin cambio. FALTA DECISIÓN DE LA DUEÑA: si el precio lleva ITBIS aparte (C5:25 lo suma; Billing.tsx:55 muestra RD$ sin decir) | Medio: cobrar en pesos sin cláusula de ajuste expone a la dueña a la devaluación; el contrato debe cambiarlo un abogado |
| 2 Nombres de planes | HOJA:7,11,12; PR:29,50,55; EN:~29,50,55; PP:15-17,55-60; C1:43-44 | «Instalado», «Nube Medio», «Nube Completo» (y «Medio/Completo» en C1) | Sustituir por los 4 nombres del código: Autoservicio, Básico, Pro, Premium. PP:60 «Nube Básico: no se ofrece» se borra o se marca histórico (Básico existe, BP:7) | Medio: si ya hay clientes del piloto con «Medio/Completo», decir en cuál plan quedan (FALTA DECISIÓN DE LA DUEÑA: equivalencia de los clientes actuales) |
| 3 Modelo de venta (pago único vs mensual) | HOJA:7-8; PR:29-34; EN:~29-34; PP:55; C6:56 | «US$149 pago único… Sin mensualidad» | Ver sección «Instalado» abajo: no hay plan equivalente en el código. Hasta que decida, retirar la tarjeta Instalado de PR:28-35 y EN y dejar solo los 4 planes mensuales | Alto: vender Instalado sin soporte en código ni en el cobro |
| 4 Equivalencia de precio | HOJA:11-12; PR:49-58; PP:58-59; C1:43-44 | Medio US$69 (~RD$4,140) 5 cajas/1 suc.; Completo US$119 (~RD$7,140) 10 cajas/3 suc. | Borrar ambas filas. En su lugar, Pro RD$4,000 (6 cajas, 2 sucursales, 10 usuarios) y Premium RD$7,000 (20 cajas, 5 sucursales, 30 usuarios). No escribir «equivale a» | Bajo si se borra; no mantener la equivalencia porque los límites no coinciden en ningún par |
| 5 Cajas | HOJA:7,11,12; PR:32,52,57; EN:~32,52,57; PP:15-17,55,58,59; C1:43-44; C6:56 | «hasta 3», «5», «10» cajas | 1 / 2 / 6 / 20 cajas según plan (BP:6-9). Instalado «hasta 3 cajas»: sin cifra en pesos (sección Instalado) | Medio: el código cumple el tope en servidor (409, BP:40-42): lo escrito debe igualarlo o habrá reclamos |
| 6 Sucursales | HOJA:7,11,12; PR:32,52,57; PP:15-17; C1:43-44 | «1», «3», «hasta 3» | 1 / 1 / 2 / 5 sucursales (BP:6-9) | Medio: igual que 5 |
| 7 Usuarios | HOJA:9,11-12; PR:38,51-57 (no figura); C1:43-44 (10 y 25) | Sin límite; C1 dice 10 y 25 usuarios | Agregar columna «Usuarios»: 2 / 3 / 10 / 30 (BP:6-9). C1:43-44 reemplazar 10 y 25 por las cifras del código | Medio: el código bloquea al llegar al tope; la hoja actual no lo avisaba |
| 8 IA: unidad y periodo | HOJA:9,19; PR:36-43; EN:~36-43; PP:16-17,56; C1:43-46; C4 (04_TERMINOS_USO_IA_VENTAS.md, buscar «10 preguntas») ; C6:56 | «US$7 por usuario al mes… 10 preguntas al día por usuario», «30 preguntas/día» | Cuota mensual incluida en cada plan: 100 / 250 / 600 / 1,500 preguntas al mes. Borrar tarjeta «IA de ventas US$7» (PR:36-43, EN, HOJA:9). Texto: «Si llegas al límite del mes puedes comprar un paquete: 100 preguntas RD$399 o 300 por RD$999 (valen solo ese mes)» (igual al mensaje del código, platform-ai-packs.ts:24-26). Cambiar «10 preguntas diarias» por «preguntas al mes» en C1:46, C6:56 y C4. HOJA:19 «apagada hasta la clave»: FALTA DECISIÓN DE LA DUEÑA: si la cuota ya se vende como incluida o sigue apagada | Alto: dos modelos de cobro incompatibles; no prometer «por día» ni «por usuario» porque el código cuenta por empresa y por mes |
| 9 Facturas con IA | HOJA:10; PR:44-48; EN:~44-48; PP:57; C1:46 | «20 al mes incluidas; extra US$0.30» | El código no tiene esa cifra. Retirar la tarjeta hasta decidir. FALTA DECISIÓN DE LA DUEÑA: si la lectura de facturas cuenta dentro de las preguntas del plan, se cobra aparte (cuánto en RD$) o no se ofrece | Medio: es la IA cara (~US$0.10 por factura, PP:51); sin tope en código |
| 10 Propuesta vieja vs aprobada | PP:11-20, 24, 30, 42-63 | Opción A US$29/59/119 «recomendada»; instalación 150/250/400 | Poner arriba de PP:11 «HISTÓRICO, reemplazado el 16-nov por los precios en pesos del código» y repetir la tabla de 4 planes en RD$. No borrar el historial | Bajo |
| 11 Lista vs introducción | HOJA:22; PR:73; EN:~73; PP:55-61; C1:39,46; C6:56 | «precios de introducción… pueden cambiar»; listas US$249/59/9/79/139/150 | Las listas están en US$ y ya no aplican; quitarlas de C1:39,46 y C6:56. Texto: «Precios en RD$ por mes; pueden cambiar con aviso». FALTA DECISIÓN DE LA DUEÑA: si hay precio de introducción distinto de los RD$ del código y por cuánto tiempo | Bajo |
| 12 Pago anual | HOJA (no figura); PP:20; C1:46; C5:71 | «2 meses gratis» solo en PP vieja; C1 «descuento de dos meses (PENDIENTE)» | Código: anual = 10 meses. Si se publica: «Pago anual: 10 meses por 12. Autoservicio RD$12,500; Básico RD$20,000; Pro RD$40,000; Premium RD$70,000». FALTA DECISIÓN DE LA DUEÑA: si se publica el anual | Bajo; cifras = 10 × mensual (cálculo, no invento) |
| 13 Piloto vs «prueba gratis» | HOJA:14; PR:24; EN:24; PP:30,63; LT:66; IDX:66; C1:46 | Piloto 60 días / «Empezar prueba gratis… (sin tarjeta)» / «60 días con instalación incluida» | El código no tiene plan de costo 0. Unificar en una sola frase. FALTA DECISIÓN DE LA DUEÑA: ¿piloto de 60 días sin costo (para quiénes, en qué plan) o «prueba gratis» sin plazo? Mientras tanto quitar «prueba gratis» de LT:66 | Medio: prometer gratis sin mecanismo en el sistema |
| 14 NCF / fiscal | LT:32-33, 41-42, 57-58 | «Comprobantes NCF… emite comprobantes con las secuencias NCF», «¿Emite NCF? Sí» | Beneficio 5: «Recibos y comprobantes no fiscales. Norexos no emite NCF ni e-CF; los comprobantes fiscales se emiten por otro medio.» Fila de comparativa (LT:42): «Comprobantes NCF» → «Recibos no fiscales». FAQ 4: «No. Norexos emite recibos no fiscales.» Borrar «verificar con contador» ya innecesario | Alto: afirmación fiscal falsa frente a HOJA:18 y PR:70; corregir antes de publicar |
| 15 «Sin instalar nada» | LT:17-18, 53-54; IDX:63-64, 136-139 | «Empieza hoy; sin instalar nada»; «No; funciona en el navegador» | Con planes solo en nube, la frase es cierta pero debe decir qué es: «Funciona en el navegador, en la nube; no instalas servidor.» Quitar «Empieza hoy» si no hay alta inmediata. Si el equipo de caja requiere app instalada, agregar «para vender sin internet instálalo en tu PC» (ya en LT:54). FALTA DECISIÓN DE LA DUEÑA: si Instalado sigue existiendo (si sí, la frase se mantiene tal como está) | Medio |
| 16 Plan más barato | HOJA:21; PP:60; PR (no figura) | «No hay plan de nube más barato que Medio» | «Desde RD$1,250 al mes (Autoservicio: 1 caja, 2 usuarios, 100 preguntas de IA al mes).» Borrar HOJA:21 y PP:60 | Medio: PP:49 dice que ningún plan de nube bajo ~US$62 cumple 15 % de margen; Autoservicio RD$1,250 (≈US$21) parece estar bajo ese umbral con hosting dedicado. FALTA DECISIÓN DE LA DUEÑA: confirmar margen ≥15 % con hosting compartido (regla de la dueña: (precio−costo)/precio, sin restar ITBIS) |
| 17 Referencia rota | LT:74-75 | «se leen de `docs/venta/precios.md` como PROPUESTA» | «Los precios de la sección de planes salen de `apps/api/src/billing-plans.ts` (RD$).» | Bajo |

## Preguntas para la dueña sobre lo que no tiene equivalente en el código (no se fija ninguna tasa)

- **Instalado (pago único US$149, renovación US$39/año):** no existe plan ni cobro en el código. Preguntas: (a) ¿se retira como producto y se vende solo los 4 planes mensuales? (b) ¿se mantiene, y entonces con qué precio en RD$ para el pago único y para la renovación anual, decidido por ella sin pasar por una tasa? (c) ¿Autoservicio (1 caja, 1 sucursal, RD$1,250) reemplaza a Instalado para el cliente de una tienda? Mientras responde: quitar la tarjeta de PR:28-35 y EN y no mostrar US$ en ninguna parte. El contrato C6 queda vigente solo si ella decide mantener Instalado; si no, marcar C6 «no se usa» y pasar la cláusula 4 a pesos.
- **Instalación y carga de inventario (US$75):** ¿precio en RD$ o se incluye gratis? (HOJA:13; PR:59-63; C1:46; C6:56)
- **Módulos extra (US$15-25/mes):** C1:46, PP:22, ¿en RD$ cuánto?
- **Soporte por plan** (columna «Soporte» de C1:41-44: correo/chat/prioritario): el código no lo implementa; ¿se mantiene la promesa por plan?
- **Paquetes de IA RD$399 y RD$999:** ya están en pesos y coinciden con el código. Falta que HOJA, PR, EN y C1 los muestren, y que digan que valen solo en el mes en que se compran.

## Cierre

Cambios: 17 contradicciones + 5 preguntas sin equivalente = 22 cambios (cada fila afecta varios archivos: HOJA, PR, EN, hoja imprimible, LT, IDX, PP, C1, C4, C5, C6). Requieren decisión de la dueña: 11 (filas 1, 2, 8, 9, 11, 12, 13, 15, 16 más Instalado, Instalación/carga, módulos y soporte).

Decisiones:
1. ¿El precio en RD$ lleva ITBIS aparte? 
2. ¿En qué plan quedan los clientes que hoy tienen «Medio/Completo»?
3. ¿Se mantiene Instalado? Si sí: precio único y renovación en RD$ (sin tasa).
4. ¿Instalación y carga de inventario: precio en RD$ o incluida?
5. IA: ¿se retira la IA a US$7 por usuario/día y queda la cuota mensual por plan (con paquetes RD$399/RD$999)? ¿Está apagada hasta poner clave o ya se vende?
6. Lectura de facturas con IA: ¿cuenta dentro de la cuota, precio aparte en RD$, o se retira?
7. ¿Precio de introducción distinto del RD$ del código? ¿Hasta cuándo?
8. ¿Se publica el pago anual (10 meses por 12)?
9. Piloto: ¿60 días gratis o «prueba gratis»? ¿Para quién?
10. Margen de Autoservicio RD$1,250 con hosting compartido (≥15 %).
11. Módulos extra en RD$ y soporte por plan.

Sin decisión, correcciones seguras (no dependen de la dueña): fila 3 (quitar Instalado y cifras en US$ de la web), 4, 5, 6, 7, 10, 14, 17.
