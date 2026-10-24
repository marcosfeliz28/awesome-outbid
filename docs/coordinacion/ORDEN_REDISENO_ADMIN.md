# Orden: rediseño del tablero del administrador (24-oct-2026)

**Lo que pide la dueña:**
- El tablero del administrador (lo que ve la dueña al entrar: el desglose de ventas por mes, etc.) debe verse **moderno, futurista y de producto caro**, sobre todo en el celular. Botones grandes que se usen con el pulgar, y en la computadora, cómodos con el mouse.
- **La caja de las cajeras NO se toca:** sigue sencilla, básica, elegante y bonita.

**Punto de partida:**
- Código actual: `apps/web/src/Dashboard.tsx`, con `YearPie`, `IncomeByDay`, `PaymentMixPie`, `MonthReport`, «Así van tus ventas», «Un poco de atención», favoritos, categorías, comparativo anual y horas pico.
- Claude nube hizo 3 estilos de muestra (A «Cristal nocturno» oscuro con neón; B «Ejecutivo claro»; C «Centro de mando», con botones grandes y lo que pasa en vivo). La dueña escoge el rumbo.

**Reglas:**
- Solo propuestas en documento y maqueta; nada de código del producto hasta que la dueña escoja.
- Los números de la maqueta son marcadores como `[RD$ 0,000]`; ningún dato real de la tienda.
- Debe funcionar a 320 px y ser accesible (contraste 4.5:1, botones de 44 px como mínimo).
- Sin marca de la tienda.
- La regla fija: usar la mayor cantidad de agentes posible en paralelo.

## Cada uno, por separado, sin ver al otro

### ChatGPT PC → `docs/coordinacion/PROPUESTA_ADMIN_CHATGPT_PC.md`
- 2 estilos completos para el celular y la computadora: colores, letras, tarjetas, gráficos, navegación y animaciones suaves.
- Una lista de **20 mejoras concretas** al tablero, cada una con su archivo y línea en `Dashboard.tsx`. Ejemplos: meta del mes, comparar con el mes pasado, ganancia real, gráfico que se toca para ver el día, modo oscuro, accesos rápidos, «en vivo».
- Una maqueta HTML estática en `docs/propuestas/admin/chatgpt-pc/`.

### ChatGPT nube → `docs/coordinacion/PROPUESTA_ADMIN_CHATGPT_NUBE.md`
Lo mismo, con énfasis en **la IA dentro del tablero**:
- resumen del día en 3 líneas;
- «pregúntale a Nexora» desde cualquier tarjeta;
- alertas inteligentes: qué se agota, quién debe, qué vende menos.

### Gemini → `docs/coordinacion/PROPUESTA_ADMIN_GEMINI.md`
- Compara el tablero con el de 5 sistemas de punto de venta modernos (por ejemplo Square, Shopify POS, Toast, Lightspeed y Loyverse): qué hacen mejor y qué conviene copiar como idea, sin copiar su diseño.
- 10 ideas «wow» que se puedan hacer.

### Claude PC
Cuando lleguen las 3 propuestas, compararlas en una tabla: qué es igual, qué es distinto y cuáles son las mejores 10 ideas. Claude nube decide con la dueña.

## Arreglos de producto que siguen pendientes (ChatGPT PC, antes del rediseño)
Hallazgos de Claude PC (CPC-9) sobre `nexora-chatgpt-pc-producto` 32d3526, con detalle en `REVISION_NOCHE_CLAUDE.md`. No se mezcla hasta que estén cerrados:
1. **Gaveta (PC-16):** la apertura automática al cobrar exige ahora `cash:drawer` (`POS.tsx:2237`), así que una cajera nunca abre la gaveta al cobrar. Debe abrir sola al cobrar en efectivo, como antes. El permiso solo se pide para abrirla **a mano**. Además, si la API cae, el ticket tiene que imprimirse igual.
2. **Tasa del dólar (PC-15):** que la tienda siga actualizándose sola. La confirmación por salto de más del 5 % es solo un aviso a la dueña, no un freno.
3. **Licencia (PC-19):**
   - la licencia lleva la empresa y el equipo, para que no se pueda copiar;
   - un reloj corregido no impide renovar;
   - la cola sin conexión no se atasca: una venta mala no bloquea el lote;
   - `/API/sales/sync` sin saltos por mayúsculas;
   - la retención no borra datos con la licencia vencida;
   - `build.ps1` rechaza en release la clave pública de pruebas.
4. Lo que quedó parcial de CPC-8: la bandera de gaveta pegada, el tope de salto, la impresora fija, las cookies, la prueba vencida, la sucursal sin Settings y el redondeo.
