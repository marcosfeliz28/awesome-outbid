# ORDEN · ChatGPT PC · Auditoría completa del trabajo de construcción del 1-nov (A–Z)

Por orden directa de la dueña (2-nov). Norexos 1 es el cerebro: tú auditas y reportas, no mezclas ni despliegas.
**Solo lectura** sobre `marcosfeliz28/awesome-outbid`, rama `nexora-cloud` (HEAD actual). Tu único escrito es el informe, en la rama `chatgpt-pc/auditoria-punto1-2nov`, archivo `docs/auditoria/AUDITORIA_PUNTO1_2NOV.md`. Empuja UNA sola vez al terminar (cada push cancela el CI previo).

## Prohibido
Credenciales de Render, base de datos, producción o cuentas: nunca las pidas ni las escribas. Nada de tocar la tienda en vivo ni datos reales. No cambies código fuera del informe. Si algo requiere arreglo, descríbelo; Norexos 1 decide.

## Método
Para cada punto: lee el diff real (`git log --since=2026-11-01 --no-merges`, 57 commits), corre las pruebas con PostgreSQL local, y da veredicto **OK / HALLAZGO (Alto-Medio-Bajo) / NO COMPROBADO** con archivo:línea y cómo reproducir. Dos métodos independientes por hallazgo Alto. Di siempre qué NO pudiste comprobar.

## Lista A–Z (todo lo construido el 1-nov)
- **A. Exportación PDF/Excel (43 reportes):** `apps/api/src/reportes/export*.ts`, `reports.ts` (`GET /reports/:name/export`). Permisos `reports:read` y `profit:read`, límite 20,000 filas, neutralización de fórmulas, nombre de archivo, auditoría, arqueo ciego.
- **B. Guía de reportes** (`reportes/guia.ts`, `GET /reportes/:name/guia`): texto correcto en español, sin cifras inventadas, cada reporte con guía.
- **C. Gráficas automáticas y tildes** del PDF: lectura visual de muestras (`docs/diseno/informes/muestras`).
- **D. Exportación de reportes GV** (`gv-export.ts`).
- **E. Pantalla de reportes** (`apps/web/src/Management.tsx`, `reportExport.ts`): botones, permisos, errores, sin innerHTML, rutas con encodeURIComponent.
- **F. Devoluciones opción A** (`reports.ts`): resumen, año anterior, tendencia, utilidad, desglose; fila «Devoluciones sin detalle»; coherencia con dashboard y `/reports/profit`; zona America/Santo_Domingo; casos de borde de medianoche y cambio de mes.
- **G. Costo de merma** (`wasteCost`) en desglose frente a año y resumen.
- **H. GV incentivo por pago** (`gv-incentives.ts`): a quien cobró, orden determinista, redondeo por acumulado, el 100 % llega exacto.
- **I. GV pago anulado** no consume el tope; mes de anulación en hora RD.
- **J. GV reembolso en RD$** (orden 106) y curso US$ pagado en pesos con tasa (`gv-money.ts`, migración `gv_pago_usd_solo_efectivo`).
- **K. Catálogo de cursos** (`GET /gv/catalog`) sin exponer incentivo ni costos.
- **L. Arreglo del CI** (b2ae5fbd): que sea causa raíz y no parche; pruebas de fecha cerca de medianoche UTC.
- **M. Regla de margen:** confirmar que NINGÚN flujo bloquea una venta por margen <15 % y que el margen no resta ITBIS.
- **N. Seguridad-20** (`.claude/skills/seguridad-20/SKILL.md`): aplica los 20 controles a todo endpoint nuevo.
- **O. Pruebas:** que no haya pruebas saltadas, desactivadas o en cuarentena; cobertura de lo nuevo.
- **P. Funciona sin internet:** sin llamadas externas en exportación y pantalla (instalador PC); revisa dependencias nuevas.
- **Q. Rendimiento:** exportar 20,000 filas (tiempo y memoria), consultas SQL del desglose.
- **R. Documentación `docs/sistema`:** citas ancladas correctas, CAMBIOS.md al día.
- **S. Migraciones:** reversibles y seguras sobre datos reales (solo lectura del SQL, nunca aplicarlas a producción).
- **T. Textos en español** claros, sin términos técnicos para la dueña.
- **U. Coherencia entre versiones:** tienda, instalador PC, GV, Tienda en línea.
- **V. Accesibilidad básica** de los botones y el recuadro de guía.
- **W. Órdenes y colas** (`docs/coordinacion/`): contradicciones entre documentos, órdenes sin dueño.
- **X. Mapa graphify** (`docs/sistema/mapa`): sin secretos dentro del grafo ni de los 551 documentos.
- **Y. Secretos:** busca claves, tokens, contraseñas o IPs en lo agregado desde el 1-nov (incluye docs y pruebas).
- **Z. Riesgos de despliegue:** qué puede fallar al desplegar API y web, orden recomendado, plan de reversa.

## Entrega
Tabla resumen (A–Z con veredicto), hallazgos ordenados por gravedad, y lo NO comprobado. Máximo 3 líneas de resumen arriba para la dueña, en español. Después sigue con tu cola permanente.
