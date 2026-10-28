# Tareas listas para DeepSeek Harness (Nexora 1, 28-oct-2026)

Reglas para todas: rama `deepseek/<id>` desde `producto-nexora`; **no empuja** (Claude PC lee el diff y empuja); sin red nueva, descargas, lectura de variables de entorno ni dependencias nuevas; no toca `App.tsx`, `styles.css`, dinero, mercancía, migraciones, despliegue, CI, instalador ni `plugins-lock`; una prueba que falle antes y pase después cuando haya código; no ve `tests/` con literales hasta que `claude-pc/tests-sin-literales` esté mezclada. Entrega: 5 líneas + `git diff --stat`. Revisa y mezcla Nexora 1 con los 3 CI en verde.

## D1 · Script de peso del bundle
Crea `scripts/check-bundle.mjs`: recorre `apps/web/dist/assets/*.js`, imprime el tamaño de cada archivo y sale con código 1 si alguno pasa de 1,90 MiB (1 992 294 bytes). Agrega `"check:bundle": "node ../../scripts/check-bundle.mjs"` en `apps/web/package.json`. Prueba: un test que cree una carpeta temporal con un archivo de 2 MiB y otro de 1 MiB y verifique salida 1 y 0. No toques `vite.config.ts` (carril R).

## D3 · Documentos de venta (solo texto, `docs/venta/`)
1. `PRECIOS_BORRADOR.md`: tabla de planes (propuesta; la dueña decide precios y límites de consultas de IA por plan), qué incluye cada uno, política de prueba, cancelación. Marca todo precio como «PROPUESTA».
2. `SOPORTE_Y_FAQ.md`: guía de inicio de 5 minutos, 15 preguntas frecuentes (caja, inventario, facturas, usuarios, copia de seguridad, instalar en PC), canales de soporte y tiempos objetivo.
3. `REPORTES_606_607_608_ESPECIFICACION.md`: especificación sin código de los formatos DGII 606 (compras), 607 (ventas) y 608 (anulados): campos, orígenes en nuestro modelo de datos (léelo en `packages/shared/src` y `apps/api/prisma`), validaciones y huecos. No inventes reglas fiscales: cita la norma de la DGII o marca «verificar con contador».

## D4 · (después de F2-01) Pruebas de los primitivos `Nx*`
En `packages/ui`, pruebas de accesibilidad y de render para cada primitivo. Rama `deepseek/nx-pruebas`.

## D5 · Ilustraciones de estados vacíos
SVG nuevos y livianos (<8 KB cada uno) en `apps/web/public/ilustraciones/` para: clientes, ventas, equipos, alertas. Mismo estilo y paleta que `vacio-carrito.svg`. Sin texto dentro del SVG, sin scripts, sin enlaces externos.

---
# COLA CORRIDA (28-oct): DeepSeek sigue en orden, sin esperar aprobación entre tareas
Ejecuta una rama por tarea (`deepseek/<id>`), entrega 5 líneas y pasa a la siguiente. Solo te detienes si una tarea pide algo de la lista prohibida de arriba. Todo lo que sea texto para clientes va marcado «BORRADOR». Todo lo legal/fiscal lleva «verificar con abogado/contador».

## Bloque A · Documentación (solo `docs/`, riesgo cero)
- **D6** `docs/venta/MANUAL_USUARIO.md`: manual paso a paso por rol (dueña, gerente, cajera): abrir/cerrar caja, vender, devolver, cobrar crédito, inventario, reportes. Lee la app (`apps/web/src`) para nombrar pantallas y botones exactos.
- **D7** `docs/venta/INSTALACION_PC.md`: guía del instalador local (Windows), requisitos, errores comunes y su solución. Solo lectura del instalador.
- **D8** `docs/venta/API_REFERENCIA.md`: lista de rutas de `apps/api/src` (método, ruta, rol requerido, cuerpo, respuesta). Solo lectura.
- **D9** `docs/venta/GLOSARIO_Y_REGLAS.md`: margen (precio−costo)/precio sin restar ITBIS, mínimo 15 %, caja ciega, créditos, traspasos, NCF; con ejemplos numéricos.
- **D10** `docs/venta/TERMINOS_Y_PRIVACIDAD_BORRADOR.md`: borrador de términos de servicio y política de privacidad para el SaaS (RD, Ley 172-13). Cada cláusula con «verificar con abogado».
- **D11** `docs/venta/EMAILS_Y_ONBOARDING.md`: textos de correos (bienvenida, prueba por vencer, recibo, recuperación de contraseña) y pasos de bienvenida dentro de la app.
- **D12** `docs/venta/LANDING_TEXTOS.md`: textos de la página pública (titular, 6 beneficios, comparativa honesta, FAQ, llamadas a la acción) en español dominicano neutro, sin promesas que el sistema no cumpla.
- **D13** `docs/venta/PASARELA_DE_PAGO_ANALISIS.md`: comparativa de Stripe, Azul, CardNet y PayPal para RD (comisiones, requisitos, moneda DOP, suscripciones, API). Solo texto; cita fuentes oficiales y marca lo no confirmado. No integres nada.
- **D14** `docs/venta/CHECKLIST_PILOTO.md`: lista para el primer cliente piloto (datos a pedir, migración de inventario, capacitación de 2 h, métricas de éxito, plan de salida).

## Bloque B · Informes de solo lectura (escribe el informe en `docs/auditoria/`, sin tocar código)
- **D15** `docs/auditoria/COBERTURA_TESTS.md`: qué módulos de `apps/api/src` y `packages/shared/src` no tienen prueba y las 20 pruebas más valiosas por escribir (con nombre y caso).
- **D16** `docs/auditoria/CODIGO_MUERTO.md`: exportaciones, archivos y dependencias sin uso, con evidencia (grep) por cada una.
- **D17** `docs/auditoria/TEXTOS_APP.md`: errores ortográficos, tildes, mezcla de tú/usted, anglicismos y mensajes de error confusos en `apps/web/src` y `apps/api/src` (archivo:línea y texto propuesto). No edites; solo lista.
- **D18** `docs/auditoria/ACCESIBILIDAD.md`: botones sin nombre, contraste, foco, orden de tabulación, en `apps/web/src` (archivo:línea y arreglo propuesto).
- **D19** `docs/auditoria/RENDIMIENTO_WEB.md`: dependencias pesadas, imports no divididos, listas sin virtualizar, re-renders evidentes (archivo:línea). Insumo para el carril R.
- **D20** `docs/auditoria/SEGURIDAD_LECTURA.md`: rutas sin control de rol, entradas sin validar, secretos en el repo, cabeceras HTTP, límites de intentos. Solo hallazgos con evidencia; los críticos me los marcas primero.

## Bloque C · Código aislado (archivos nuevos, con prueba que falle antes y pase después)
- **D5** ilustraciones SVG de estados vacíos (arriba).
- **D21** `packages/shared/src/format/`: utilidades puras de formato (RD$, fechas dd/mm/aaaa, NCF, teléfono RD, cédula) con pruebas de tabla. Sin cambiar los usos existentes; se enganchan después.
- **D22** `packages/shared/src/validators/cedula-rnc.ts`: validación de cédula y RNC dominicanos (dígito verificador), con pruebas. Cita la fuente del algoritmo.
- **D23** `apps/web/public/` iconos PWA y favicon en todos los tamaños desde el logo vigente (SVG→PNG con herramienta ya instalada; si no hay, entrega solo los SVG).
- **D24** `scripts/check-i18n-tildes.mjs`: revisa que los textos visibles no tengan caracteres rotos (Ã, â€) ni palabras comunes sin tilde; con prueba.
- **D25** `scripts/check-product-brand-extra.mjs`: busca restos de «MacGen», «GV Makeup», «FitStore» en el build del producto (complementa `check-product-brand.mjs`; no lo reemplaza), con prueba.
- **D4** pruebas de primitivos `Nx*` (cuando F2-01 esté mezclada) y **D26** historias Storybook de los 12 primitivos (después de D4).

## Bloque D · Preparación (diseño en papel, sin implementar)
- **D27** `docs/venta/PLAN_AT06_OPERADORA.md`: plan de implementación de AT-06 a partir de `claude-pc/at06-diseno`, con las preguntas D1–D8 convertidas en opciones con ventajas/riesgos para la dueña.
- **D28** `docs/venta/PLAN_FACTURACION_SAAS.md`: modelo de datos y flujo de suscripciones (planes, ciclos, fallo de pago, cancelación, prorrateo, factura con NCF), sin código.
- **D29** `docs/venta/PLAN_MIGRACION_CLIENTE.md`: cómo importar inventario/clientes de un negocio nuevo (CSV/Excel), validaciones y reporte de errores.
- **D30** `docs/venta/PLAN_SOPORTE_Y_MONITOREO.md`: alertas, registros, respaldo y restauración, qué vigilar y cada cuánto.

## Orden sugerido
D5 → D6 → D9 → D21 → D22 → D17 → D18 → D15 → D8 → D12 → D13 → D10 → D11 → D14 → D7 → D16 → D19 → D20 → D23 → D24 → D25 → D27 → D28 → D29 → D30 → (D4, D26 cuando se desbloqueen).
