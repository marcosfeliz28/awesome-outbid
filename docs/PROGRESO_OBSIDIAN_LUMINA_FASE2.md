# Obsidian Lumina · fase 2: tablero del negocio e IA

Fecha: 26 de octubre de 2026. Rama: `chatgpt-nube/obsidian-lumina-fase2`.
Base: `chatgpt-nube/obsidian-lumina-fase1`, commit `c594cdafa9aa8f546b873894e5c67bb8824d182f` (PR #8). Los tres trabajos de CI de esa base terminaron en verde, ejecución `40270978049`. Esta fase se entrega como PR dependiente, sin fusionar ni desplegar. El CI del nuevo commit se consulta en su PR.

## OL2 · entrega implementada

El tablero ejecutivo se activa exclusivamente en producto multiempresa, administración/gerencia y con permiso de reportes. Conserva las acciones y autorizaciones existentes. La tienda independiente y la caja mantienen su presentación anterior.

- Cuatro métricas al frente: ventas netas de devoluciones, ganancia bruta, ventas completadas y ticket promedio. Si no hay permiso para ganancia, se muestra inventario actual a precio de venta. Las cifras provienen de `dashboard/summary`, sin fórmulas nuevas; faltantes se muestran como «No disponible».
- «Hoy» es el período inicial; rango y actualización llevan zona de Santo Domingo. El día se actualiza al cruzar medianoche. Los gráficos y la comparación anual pasan después de métricas y pendientes.
- «Tu día, en claro» consulta el resumen con ambas fechas de hoy explícitas. Distingue ventas con ITBIS, ganancia y efectivo cobrado. Su lectura con IA tiene botón, estado ocupado, error, fecha de generación y cuota restante; no se genera automáticamente.
- «Pregúntale a Nexora» abre una pregunta revisable desde métricas, resumen, alertas y tarjetas analíticas. Abrir no envía ni consume cuota. Conserva un borrador previo y requiere elegir para reemplazarlo. Las preguntas usan plantillas cerradas: no incluyen mensajes arbitrarios de alertas, nombres, importes ni identificadores de registros.
- Alertas actuales: muestra existente de hasta seis pendientes, prioridad por severidad, color más texto, estado y origen en reglas del sistema. Navegación al reporte solo con el permiso vigente. No se presentan como predicciones de IA ni como totalidad de pendientes. La pregunta asociada explica cómo priorizar; no promete verificar esa muestra.
- Asistente adaptado a los tokens compartidos; navegación con Tab/Shift+Tab, Escape y retorno del foco a la tarjeta. Nueva conversación limpia mensajes y contexto. Instancia separada por usuario/sucursal. Resumen descarta respuestas tardías al cambiar día, usuario, sucursal o visibilidad de ganancia.
- Estados de carga, error y ausencia de ventas diferenciados. Alto contraste y diseño de 320 a 1440 px; animación de gráficos desactivada en el tablero ejecutivo y respeto a movimiento reducido.

No se modificaron APIs, base de datos, fiscalidad, fórmulas de dinero, pagos, autenticación ni permisos. Se conserva el flujo existente de propuesta de anulación del asistente y su confirmación explícita. El resumen diario no ejecuta ni presenta propuestas de mutación.

## Fuentes y límites de la IA

La implementación conserva `POST /assistant/ask` con historial de mensajes y las herramientas autorizadas del servidor. Las tarjetas no conceden acceso adicional. El botón del resumen consume la cuota existente, incluso si el servidor reserva una consulta que luego falla. La interfaz no reintenta automáticamente.

La lectura generada no sustituye las cifras del tablero:

1. `facturacion_por_usuario` obtiene reportes con fechas, pero también un resumen habitual sin fechas. La pregunta prohíbe atribuir ese último resumen al día seleccionado.
2. El ranking y el tablero pueden diferir por la fecha con la que se contabilizan devoluciones. Las plantillas piden fuente, período y límites; no prometen conciliación exacta.
3. Las herramientas no verifican todas las tarjetas (p. ej., distribución anual u horaria). En esos casos, la pregunta es explicativa y pide reconocer información no disponible.
4. Las alertas del tablero no tienen filtro de fechas; la herramienta de IA consulta por fecha de creación y tiene otro límite. Se evitó enviar el período de ventas como si identificara la muestra visible. No se añade un GET `/alerts` automático, que ejecutaría reglas en el servidor.
5. Interpretar una respuesta no prueba su veracidad. Las capturas y pruebas de esta fase usan respuestas sintéticas; no acreditan precisión de un modelo real ni la auditoría AUD-VIVO de 100 preguntas.

## Referencias incorporadas

Se mantienen la dirección y los prototipos de `design/obsidian-lumina` y `macgen-gv`, documentados en la fase 1. Se revisó el JSON aportado `nexora_obsidian_lumina_v2_chatgpt_db.json`: tokens, módulos ejecutivos, prompts y documentos incluidos. Aporta contexto de diseño; sus totales de auditoría (77 correctos, 17 mejorables, 6 fallos) no contienen evidencia individual de 100 comprobaciones. No se incorporaron promesas no verificadas de velocidad, ausencia de fugas o ahorros, ni glassmorphism pesado, ni flujos de autenticación de demostración. No fue necesario modificar Drive.

## Verificación reproducible

- `pnpm check`: PASS, tipos, lint, 135 archivos aprobados/1 omitido; 871 pruebas aprobadas/10 omitidas; compilación web y API. Advertencia existente de chunks grandes, sin relajar límites.
- `node tests/obsidian-dashboard.mjs` contra Vite producto local: PASS. Datos del reporte, día/rango, prioridad de alertas, cero consultas automáticas, borrador conservado, preguntas bajo 500 caracteres, retorno/trampa de foco, conversación nueva, caída 503 (el cliente existente la interpreta sin conexión), cuota 429, propuesta no ejecutada por resumen, gerente sin margen, errores y ceros reales. Sin errores JavaScript ni desbordamiento a 1440/901/780/390/320 px.
- Regresión sobre base original `2f147d2`, Vite producto puerto 4263: mismo script falla en la primera comprobación, encabezado «Tu día, en claro» ausente. No se afirma que todos los pasos se ejecutaran sobre la base anterior. Salida en `capturas/obsidian-lumina-fase2/regresion.txt`.
- Control de tienda independiente: `LUMINA_LEGACY=1 LUMINA_TEST_URL=http://127.0.0.1:4262 node tests/obsidian-lumina.mjs` PASS; conserva apariencia y selector claro/oscuro.
- `VITE_PRODUCT_TENANCY=required pnpm --filter @fitstore/web build`: PASS.
- Smoke de producción (`LUMINA_PRODUCTION=1`, preview local puerto 4265): PASS; galería de desarrollo oculta y ruta bloqueada. El script completo `obsidian-dashboard.mjs` también pasa sobre esa compilación; las capturas finales provienen del preview producto.
- Integración contra API compilada local `:3068` y PostgreSQL descartable `:5548`: corrida completa, 26 archivos aprobados/1 fallido; 471 pruebas aprobadas/15 fallidas de 486 (628,22 s). Todos los fallos fueron en Drive por falta de `pg_dump` en el entorno. Con cliente PostgreSQL 18.4, primera repetición de Drive: 23/24; la restauración falló por incompatibilidad de `libpq`. Corregida la ruta de bibliotecas mediante lanzadores temporales de los binarios reales: repetición final **Drive 24/24, salida 0** (25,47 s). Los 486 casos quedan cubiertos entre la corrida y la repetición; no se afirma una corrida completa verde posterior. No se cambiaron pruebas, límites ni guardas. API propia detenida y credenciales temporales eliminadas. El CI remoto debe confirmar la suite completa del commit entregado.

Las pruebas visuales interceptan API con fixtures y bloquean solicitudes externas. No se iniciaron sesiones en nexorapos.net, no se usaron empresas reales ni se operó Render.

## Capturas

- [Tablero desktop](capturas/obsidian-lumina-fase2/tablero-desktop.png)
- [Tablero móvil](capturas/obsidian-lumina-fase2/tablero-mobile.png)
- [Pregunta desde una tarjeta](capturas/obsidian-lumina-fase2/nexora-contextual-desktop.png)
- [Asistente móvil](capturas/obsidian-lumina-fase2/nexora-mobile.png)
- [Lectura de IA sintética](capturas/obsidian-lumina-fase2/resumen-ia-desktop.png)
- [Alto contraste](capturas/obsidian-lumina-fase2/tablero-alto-contraste.png)
- [Error de reporte](capturas/obsidian-lumina-fase2/error-datos.png)
- [Registro de comprobaciones](capturas/obsidian-lumina-fase2/verificacion.json)

## Revisión y continuación

Revisión paralela de estructura, herramientas de IA y compatibilidad: corregidos el contexto temporal incorrecto de alertas, el contexto retenido al iniciar conversación nueva y el retorno de foco. Límite preexistente detectado fuera del cambio: `YearPie` conserva el mes seleccionado al cambiar de año, mientras el enlace de detalle usa el año nuevo; requiere corrección específica y prueba antes de certificar esa interacción. No se cambió la lógica anual en esta fase.

Pendientes: prueba con lector de pantalla y hardware reales, verificación de respuestas del modelo contra datos autorizados en entorno de prueba, y revisión/CI del commit entregado. La siguiente fase visual es catálogo, inventario, clientes, reportes y configuración. Este documento no autoriza cambios en herramientas de IA, contabilidad, permisos ni despliegue.
