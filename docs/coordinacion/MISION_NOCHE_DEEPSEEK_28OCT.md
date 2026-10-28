# Misión de la noche para DeepSeek Harness (28-oct-2026) — orden de la dueña

La dueña se acostó y pidió que DeepSeek trabaje toda la noche, en todas las áreas, hasta completar esta lista. Claude PC la lee y se la entrega (sin esperar a la dueña). Nexora 1 revisa cada 15 minutos (rutinas desfasadas) y mezcla/despliega solo lo que cumpla las reglas. Cuando DeepSeek termine todo, escribe **`DEEPSEEK-TERMINADO`** en `docs/coordinacion/PROGRESO_DEEPSEEK_NOCHE.md`; Nexora 1 recibe y detiene las revisiones.

## Reglas (no cambian)
Una rama `deepseek/<id>` por tarea; DeepSeek no empuja, **Claude PC lee el diff y empuja**; Claude PC escribe `LISTA: deepseek/<id> <commit>` solo con los 3 CI verdes (`verify`, `windows-installer`, `render-images`). Prohibido: despliegue, llaves/credenciales, reglas de dinero (`reports.ts` fórmulas, `cash.ts`, `sales.ts`), mercancía (entradas, salidas, traspasos, ajustes), migraciones, instalador/firma, `plugins-lock`, CI. Sin red nueva, descargas, lectura de variables de entorno ni dependencias nuevas sin pedirlo en `PEDIDOS_DEEPSEEK.md`. Sin contraseñas literales. Caja ciega intacta; atajos F2/F4/F8/F12 intactos. Margen = (precio−costo)/precio sin restar ITBIS, mínimo 15 %. Una prueba que falle antes y pase después en todo código. Anota cada tarea terminada en `PROGRESO_DEEPSEEK_NOCHE.md` (id, rama, commit, 3 líneas). Si te bloqueas 20 minutos, salta a la siguiente y deja la razón en el archivo.

## Bloque 0 · Desbloqueo (primero)
0.1 Si el `verify` de `chatgpt-pc/visual-fase1-gemini` (aab91c9a) sigue rojo tras el reintento: rama `deepseek/mezcla-fase1-fix`, descarga el artefacto del run, identifica la prueba e2e fallida y corrígela sin ocultarla. Si `producto-nexora` avanzó (ya trae F1-01 y D1/D3), mezcla `origin/producto-nexora` y resuelve conflictos conservando ambos lados.
0.2 Cuando Nexora 1 confirme la Fase 1 mezclada, el dueño de `App.tsx` y `styles.css` pasa a ser DeepSeek (ChatGPT en pausa hasta el 2-nov).

## Bloque 1 · Diseño (Fases 2 y 3) — tras 0.2
1.1 **F2-01** tokens en tres capas + los 12 primitivos `Nx*` (`packages/ui`), rama `deepseek/f2-01` (parte del `pedido-f2-01` ya retenido).
1.2 **D4** pruebas de accesibilidad y render de los `Nx*`.
1.3 **F2-03** POS: miniaturas sobre superficie translúcida, botón `+` ergonómico, `Cobrar F12` con jerarquía.
1.4 **D45** CSS por pantalla (Catálogo, Clientes, Reportes, Configuración) con los tokens de F2-01; retoma d47–d51 ya entregadas si siguen válidas.
1.5 **F3-01** apertura del asistente y transición de vistas (180 ms, `prefers-reduced-motion`), CSS nativo.
1.6 **D26 / F3-02** historias Storybook de los 12 primitivos.
1.7 **D52** rehecha sin leer el entorno ni contraseñas literales (usa la variable del arnés, tras `claude-pc/tests-sin-literales`).

## Bloque 2 · Producto vendible (Fase 3 del plan maestro) — código aislado
2.1 **D39/D40** `packages/shared/src/plans/` límites de planes (valores PROPUESTA) y cuota de consultas de IA por mes.
2.2 **D35–D38** `packages/shared/src/dgii/` generadores 606, 607, 608 y validación NCF (B04 pausado), funciones puras; cada regla dudosa `// verificar con contador`.
2.3 **D21/D22** formatos (RD$, fechas, NCF, teléfono) y validador de cédula/RNC con pruebas (si no están ya entregadas).
2.4 **D42** pruebas de tabla de margen/redondeo sobre funciones existentes; **solo reporta** si encuentra un fallo.
2.5 **D41** recorrido e2e de humo del producto (login, abrir caja, venta, cierre), sin contraseñas literales.
2.6 Plan de AT-06 operadora (`docs/venta/PLAN_AT06_OPERADORA.md`), facturación SaaS (`PLAN_FACTURACION_SAAS.md`), migración de cliente (`PLAN_MIGRACION_CLIENTE.md`), soporte y monitoreo (`PLAN_SOPORTE_Y_MONITOREO.md`).

## Bloque 3 · Marca, página pública y papeles (Fase 4) — sin publicar nada
3.1 `apps/landing/` (D31–D34) **sin cifras** («Precio por definir»); la página de estado solo hace `GET https://nexorapos.net/api/health`, sin credenciales, 5 s máximo.
3.2 Documentos: manual de usuario (D6), glosario y reglas (D9), instalación PC (D7), referencia de API (D8), términos y privacidad en BORRADOR «verificar con abogado» (D10), correos y onboarding (D11), textos de la página (D12), análisis de pasarela (D13), checklist de piloto (D14).
3.3 Revisión de restos de marca vieja en el build (D25) y de tildes rotas (D24).

## Bloque 4 · Calidad, seguridad y rendimiento (solo informes, sin tocar código salvo lo indicado)
4.1 Informes en `docs/auditoria/`: cobertura de pruebas (D15), código muerto (D16), textos (D17), accesibilidad (D18), rendimiento web (D19), seguridad en lectura (D20), mapa de pantallas (D43). Los hallazgos **críticos de seguridad** se marcan primero en `PROGRESO_DEEPSEEK_NOCHE.md`.
4.2 `CONTRIBUTING.md` y `docs/DESARROLLO.md` (D44).
4.3 Benchmark de 20 plataformas (D46) revisado y completado con precios y URLs; propuesta final de 10 mejoras priorizadas.

## Bloque 5 · Cierre
5.1 Resumen final en `PROGRESO_DEEPSEEK_NOCHE.md`: qué quedó listo (rama y commit), qué quedó bloqueado y por qué, qué necesita decisión de la dueña, y la línea `DEEPSEEK-TERMINADO`.
