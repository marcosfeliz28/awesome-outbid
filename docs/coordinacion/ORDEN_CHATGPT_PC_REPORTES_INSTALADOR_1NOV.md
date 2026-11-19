# Orden grande para ChatGPT PC — reportes amigables e instalador (1-nov-2026, Norexos 1)

La dueña pidió aprovechar a ChatGPT PC al máximo con esto. Trabaja en bucle (`COLA_PERMANENTE_CHATGPT.md`): una pieza a la vez, una rama por pieza, prueba que falle antes y pase después, 3 CI verdes del último SHA, capturas a 390 y 1366 px. Tú construyes; Norexos 1 revisa, mezcla y despliega. Sin credenciales; no tocas la API de dinero ni `apps/api` (la pieza A del motor de exportación la hace otro agente en `claude-pc/reportes-export`; `claude-pc/reportes-guia` trae los textos de cada reporte). Dueño de `App.tsx`, `styles.css`, `Management.tsx`, `FormalReports.tsx`, `MonthReport.tsx`, `Gv.tsx` (solo UI) y `Tienda.tsx` (solo UI): tú. Consulta el mapa antes de leer a ciegas.

## BLOQUE 1 — Pantalla de reportes amigable (todas las versiones)
1. **Botones «PDF» y «Excel»** en cada reporte, con el periodo y filtros que se ven; estados cargando/error/vacío; descarga con nombre claro (`<reporte>-<desde>-a-<hasta>.pdf`). Rama `chatgpt-pc/reportes-botones`. Se conecta a `GET /reports/:id/export?format=pdf|xlsx` (rama `claude-pc/reportes-export`); mientras no exista, maqueta con datos de ejemplo detrás de una bandera apagada.
2. **Panel «¿De qué trata este reporte?»** sobre cada reporte (qué es, para qué sirve, cómo se lee) y ayuda «?» en cada columna, con los textos del catálogo `guia` (rama `claude-pc/reportes-guia`); plegable, accesible, sin depender de internet.
3. **Página «Guía de reportes»** (buscador + lista por grupo: Ventas, Dinero, Margen, Inventario, Clientes y crédito, GV, Tienda) que explica cada reporte en español claro.
4. **Gráficas en pantalla** coherentes con las del PDF (mismos colores, títulos y leyendas); reutiliza `recharts`; contraste 4.5:1; legibles en blanco y negro.
5. **Maqueta del informe imprimible** (portada, recuadro «De qué trata», cifras clave, gráficas, tablas, notas) en `docs/diseno/informes/`, versión clara para imprimir, estilo Obsidian Lumina.
6. **Pruebas e2e (Playwright)** de los botones y del panel en 3 reportes (uno de ventas, uno de dinero, uno de inventario), con y sin permiso de costo/margen, y verificación de que la cajera con caja abierta no ve importes.
7. **Vista previa antes de descargar** (opcional): primera página del PDF en un modal.

## BLOQUE 2 — Instalador de PC (sin internet y con internet): auditar y probar en serio
Orden completa: `ORDEN_INSTALADOR_SIN_INTERNET_1NOV.md`. La dueña autorizó la prueba real. Antes: lee `docs/auditoria/INSTALADOR_SIN_INTERNET_1NOV.md` (la deja el agente de auditoría en `claude-pc/instalador-sin-internet`).
8. **Plan de prueba ejecutable** a partir de esa auditoría: guion paso a paso, tabla «paso | sin internet | con internet | captura | resultado».
9. **Prueba real en la laptop, dos pasadas:** (a) **sin red** (Wi-Fi y cable apagados): instalar, arrancar, crear negocio de prueba, vender, abrir/cerrar caja, sacar reportes PDF y Excel, apagar y reabrir, desinstalar; (b) **con red**: lo mismo más actualización, respaldo y sincronización si existen. La dueña escribe contraseña y PIN en privado. Antes de instalar, revisar y avisar si queda algo de la instalación vieja. Capturas con tildes y ñ correctas.
10. **Informe** de la prueba en `docs/coordinacion/PRUEBA_INSTALADOR_27OCT.md` con lo que falló, el error exacto y la causa probable; no arregles a ciegas.
11. **Arreglos mínimos** de lo que falle en la parte visual o de textos del instalador (no tocar firma de código ni certificados).

## BLOQUE 3 — Lo que ya tenías
12. Animación futurista y dura (login y Tablero primero; caja sin movimiento durante el cobro; apagable). 13. Imágenes y activos de marca. 14. PC-16 (Rust). 15. `lumina-adentro-b`, `f1-01-bundle`.

## Reporte
Entrada corta en `RESULTADOS_CHATGPT.md` por pieza: qué hiciste, rama y SHA, 3 CI, qué falta, qué decide la dueña. Si algo es ambiguo, pregunta ahí y sigue con otra pieza.
