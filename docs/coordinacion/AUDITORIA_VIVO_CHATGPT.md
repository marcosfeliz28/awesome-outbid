# AUD-VIVO · Nexora POS · ChatGPT nube

**Estado: BLOQUEADA ANTES DE EJECUTAR. Este documento recoge la preparación y los impedimentos de acceso; no acredita una auditoría del producto en vivo.**

Fecha: 25 de octubre de 2026. Zona de trabajo del equipo: `America/La_Paz` (UTC−04:00). La zona configurada en la empresa todavía no se ha observado.

## Resultado y cobertura real

No se ha abierto el producto, intentado el inicio de sesión ni realizado operaciones en ninguna empresa. No hay respuestas de Nexora, datos operativos leídos ni capturas del producto. La ausencia de hallazgos confirmados no significa que el producto haya aprobado las pruebas.

| Concepto | Estado comprobado |
| --- | --- |
| Inicio de sesión y empresa verificada en pantalla | No ejecutado |
| Perfiles dueña, gerente y cajeras utilizados | Ninguno; perfiles pendientes de observar |
| Operaciones sobre productos, caja, ventas, crédito o usuarios | 0 |
| Jornada operacional / tiempo de uso en vivo | No iniciada |
| Preguntas a Nexora previstas | 100, identificadas como 001–100 en los anexos |
| Preguntas enviadas / respuestas verificadas | 0 / 0 |
| Fallos nuevos confirmados del producto | Ninguno observado; pruebas no ejecutadas |
| Caso conocido de Guardar en Configuración | Reportado por el solicitante; reproducción no intentada |
| Capturas reales del producto | 0 |
| Rama remota `chatgpt-nube/auditoria-vivo` | Creada en `marcosfeliz28/awesome-outbid` desde `producto-nexora` (`c916ee724fbe14d5f45671792f216eb64961655d`); entrega preliminar documental |

## Alcance autorizado

- Producto: `https://nexorapos.net`.
- Empresa exclusiva: `aud-chatgpt`. Verificar su identidad visible antes de cada bloque de trabajo.
- Perfiles de uso previstos: dueña, gerente y cajeras, mediante sesiones con permisos reales del producto. Escribir «soy cajera» en una pregunta no demuestra un control de permisos.
- Fuera de alcance: otras empresas, `nexora-pos-web.onrender.com` y la plataforma Render. No se ha accedido a ellos.
- Ritmo: interacción ordinaria, una operación revisada por vez; sin carga, ráfagas ni reintentos ciegos de cobros.
- La contraseña y el PIN proporcionados no se incluyen en este documento, anexos ni evidencias.

## Impedimentos comprobados

Se distingue el bloqueo de navegación todavía vigente del acceso al repositorio, ya resuelto. Ninguno se atribuye como defecto a Nexora.

### ENT-01 · Falta una herramienta de navegación interactiva

- **Gravedad de producto:** no aplica.
- **Comprobación:** se leyó la guía Browser y se examinó el catálogo de herramientas para navegación, pestañas, capturas y control de navegador. No aparecen Browser `js`, herramientas de pestañas ni CUA REPL.
- **Esperado para poder auditar:** navegador interactivo disponible para entrar al producto, comprobar el tenant, operar la interfaz y conservar capturas.
- **Resultado:** no existe una superficie disponible para ejecutar esos pasos en esta sesión. No se ha probado la disponibilidad del sitio ni la validez de las credenciales; este bloqueo no demuestra un fallo de acceso de Nexora.
- **Captura:** no disponible; el impedimento precede a una sesión visual del producto.
- **TinyFish:** el solicitante autorizó su uso y la integración confirma `installed: true`. Sin embargo, el catálogo de acciones de esta conversación no expone sus herramientas. Una segunda comprobación por un agente reactivado tampoco las encontró. No se utilizó; no se pide reinstalar una integración ya instalada.
- **Dependencia vigente:** que se carguen las acciones de navegación de TinyFish en la conversación, o que se habilite Browser. La autorización para usar TinyFish ya está concedida.

Referencia de la limitación: [Browser · SKILL.md](skill://plugin_connector_1p_51c1ba70f47481919149861084681943/control-browser/SKILL.md). Instrucción aplicable: “Use only the associated Browser app's `js` tool to control this browser.” La guía contempla el navegador CUA en la nube como alternativa cuando está disponible; tampoco se expone aquí. No se ha sustituido el control por automatización de shell.

### ENT-02 · Acceso al repositorio — RESUELTO

- **Gravedad de producto:** no aplica.
- **Causa inicial:** se desconocían el repositorio correcto y la rama de producto; la rama predeterminada `main` del repositorio no representa Nexora.
- **Resolución:** el solicitante identificó `marcosfeliz28/awesome-outbid` y ordenó crear `chatgpt-nube/auditoria-vivo` desde `producto-nexora`. La lectura de `README.md` en esa rama confirma Nexora POS.
- **Base comprobada:** `producto-nexora`, commit `c916ee724fbe14d5f45671792f216eb64961655d`, árbol `b684d418e922e249038716d02faef35d2b526797`.
- **Acción realizada:** rama de auditoría creada mediante GitHub desde ese commit; sin cambiar la rama de base ni el código del producto.
- **Evidencia:** conector GitHub y [registro de acceso](aud-vivo/acceso_repo.md). No es una captura del producto.

### Instrucciones del proyecto leídas

Se leyeron `AGENTS.md`, `docs/coordinacion/INSTRUCCIONES_ACTUALES.md` completo, `TABLERO_NEXORA.md`, `PLAN_DE_TRABAJO.md` y `PLAN_MAESTRO_TODO.md` de `producto-nexora`; además, `REVISION_NOCHE_CLAUDE.md` completo de `nexora-cloud` (blob `53def6c3b947cacb07c78c5a61d4ac8acb6ba6e9`) mediante un agente. Son lecturas del repositorio, no acceso a la tienda ni a Render.

La orden explícita actual del solicitante fija empresa, alcance, archivo, rama y base de esta auditoría; prevalece sobre las asignaciones históricas de otras ramas y carriles. Solo se añaden este informe y sus anexos; no se corrige código, no se mezcla hacia `nexora-cloud` y no se despliega.

## Caso conocido comunicado por el solicitante

### CON-01 · «Guardar» en Configuración falla en empresas nuevas

- **Origen:** instrucción del solicitante del 25 de octubre de 2026.
- **Estado:** reportado; reproducción no intentada por ENT-01. No se declara descubierto, confirmado ni corregido.
- **Gravedad:** pendiente de conocer el impacto y reproducir el comportamiento.
- **Precondición a comprobar:** Configuración accesible dentro de `aud-chatgpt`, con el rol adecuado y un campo descriptivo reversible. La antigüedad de esta empresa no se ha observado; no crear otra para probar el caso.
- **Pasos propuestos, todavía no ejecutados:** abrir Configuración, registrar un valor inicial, editar ese campo, pulsar Guardar una vez, registrar el mensaje, salir y volver a leerlo. Si hay resultado incierto, comprobar persistencia antes de reintentar. Restaurar y verificar el valor original cuando sea posible.
- **Esperado:** persistencia coherente con el mensaje de guardado; si falla, error comprensible y edición recuperable.
- **Qué pasó en esta sesión:** no observado. No se pulsó Guardar.
- **Captura:** no disponible. Debe añadirse la pantalla real del error y la comprobación posterior cuando se ejecute.

## Organización del equipo

Se utilizaron los seis agentes auxiliares disponibles y la sesión principal para preparar trabajo en paralelo. La preparación no cuenta como uso real de los perfiles.

| Responsable | Área preparada | Ejecución en vivo |
| --- | --- | --- |
| Sesión principal | Coordinación, alcance, acceso, conciliación e integración del documento | No iniciada |
| estructura_tablero | Localización del repositorio y plantilla de evidencia | No iniciada |
| caja_ventas | Productos, apertura, ventas, pagos, devoluciones y movimientos | No iniciada |
| revision_maqueta | Crédito, reportes y cierres desde el perfil gerente | No iniciada |
| config_usuarios | Configuración, usuarios y permisos desde la perspectiva de dueña | No iniciada |
| ia_nexora | Preguntas 001–050 y fuentes de contraste | No iniciada |
| ia_segunda_mitad | Preguntas 051–100 y fuentes de contraste | No iniciada |

Las operaciones que cambien caja, inventario y crédito se serializarán. Los agentes de reportes e IA contrastarán cortes estables, con la misma empresa, sucursal, caja, período y zona horaria. Así, una operación concurrente no se confundirá con un error de respuesta.

## Jornada operacional preparada

El [plan de caja](aud-vivo/plan_caja.md) propone un ciclo completo de apertura a cierre, con productos identificados para auditoría, pagos por los medios que realmente ofrezca la UI, descuentos, cancelación previa al cobro, devolución, crédito, abono y movimientos de efectivo. Es un escenario pendiente, no un día de uso efectuado ni una simulación presentada como evidencia.

Sus importes de referencia solo se aplican si las funciones y reglas reales permiten ejecutar íntegramente el escenario. No se cambiarán impuestos o configuración para forzar el resultado. Debe registrarse el estado inicial real y recalcularse el libro si difiere.

| Control del escenario propuesto | Valor aritmético previsto; no observado |
| --- | ---: |
| Fondo inicial de efectivo | 200,00 |
| Ventas tras descuentos, antes de devolución | 430,00 |
| Devolución | 10,00 |
| Venta neta | 420,00 |
| Cobro de deuda, separado de venta | 30,00 |
| Crédito pendiente al final del escenario base | 40,00 |
| Efectivo teórico final | 390,00 |
| Stock final A / B / C | 28 / 24 / 16 |

Además de ese libro, el [plan de gerente](aud-vivo/plan_gerente.md) cubre liquidación de deuda, filtros, exportación si existe y cierres con diferencia conocida. Esos casos se ejecutarán por separado para no reutilizar los saldos finales del escenario base como si no hubieran cambiado.

## Verificación de las 100 respuestas de Nexora

Los anexos contienen exactamente 100 preguntas previstas. Los nombres e identificadores entre corchetes se completarán con datos observados antes de preguntar. No hay preguntas enviadas ni respuestas registradas todavía.

1. Capturar empresa, usuario/rol real, pantalla o tarjeta de origen, período, filtros y hora de corte.
2. Leer las pantallas fuente independientes: documentos de ventas, inventario, movimientos, crédito, cierres y reportes. Una respuesta de Nexora no valida otra respuesta de Nexora.
3. Registrar la pregunta literal efectivamente enviada y la respuesta íntegra, con sus fuentes si las muestra.
4. Recalcular cada cifra, período y alcance con el mismo corte. Distinguir ventas de cobros, efectivo de otros medios, costo de precio, margen de recargo y hecho de estimación.
5. Registrar por pregunta: perfil, fecha/hora y zona, contexto, respuesta, fuentes, cálculo esperado, resultado, ID del fallo y capturas. Los resultados posibles serán correcta, incorrecta, parcial, ambigua, no verificable, bloqueada o no ejecutada.
6. Para un fallo, conservar captura de la respuesta y de los datos que la contradicen; si falta evidencia, declarar la limitación. No recrear capturas.

Las preguntas condicionales solo se enviarán cuando existan las funciones y los registros necesarios. Si una no aplica, deberá sustituirse por otra pregunta contrastable y documentar el cambio para alcanzar 100 preguntas realmente enviadas; una pregunta bloqueada no cuenta para ese objetivo.

## Registro exigido para cada fallo

Usar la [plantilla de evidencia](aud-vivo/plantilla_evidencia.md): gravedad S1–S4 justificada por impacto observado, precondiciones, pasos exactos numerados, esperado con fuente o cálculo, resultado real literal, reproducibilidad, IDs afectados, captura y estado final de los datos.

- **S1 crítica:** exposición entre empresas, pérdida irreversible o corrupción financiera grave demostrada.
- **S2 alta:** flujo esencial bloqueado, permiso relevante incorrecto o cálculo con impacto material confirmado.
- **S3 media:** degradación o información incorrecta de alcance limitado con alternativa viable.
- **S4 baja:** presentación o interacción menor sin alterar los datos ni impedir el flujo.

No hay entradas de fallo confirmado que completar actualmente. ENT-01 sigue impidiendo ejecutar; ENT-02 está resuelto; CON-01 es un antecedente comunicado.

## Archivos preparados y entrega pendiente

- [Preguntas 001–050](aud-vivo/preguntas_001_050.md).
- [Preguntas 051–100](aud-vivo/preguntas_051_100.md).
- [Productos, caja y ventas](aud-vivo/plan_caja.md).
- [Crédito, reportes y cierres](aud-vivo/plan_gerente.md).
- [Configuración, usuarios y permisos](aud-vivo/plan_config.md).
- [Plantilla de evidencia](aud-vivo/plantilla_evidencia.md).
- [Comprobación de acceso al repositorio](aud-vivo/acceso_repo.md).

La rama `chatgpt-nube/auditoria-vivo` contiene una entrega preliminar de preparación y bloqueo, desde la base solicitada. La auditoría del producto sigue pendiente de disponer de las acciones de navegación. Después se ejecutarán los casos y se actualizará este mismo informe con resultados y capturas reales.

Validación documental realizada: 100 identificadores consecutivos, enlaces relativos existentes, ausencia de valores de credenciales y conciliación aritmética del escenario propuesto. No se ejecutaron `pnpm check`, integración, E2E ni pruebas del producto: esta entrega solo añade documentación y no acredita CI verde.
