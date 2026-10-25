# AUD-VIVO · Configuración, usuarios y permisos

Estado: **plan pendiente de ejecución**. Este archivo no contiene hallazgos reproducidos, capturas ni resultados de uso en vivo.

## Alcance y condiciones

- Único producto autorizado: `https://nexorapos.net`.
- Única empresa autorizada: `aud-chatgpt`. Confirmar su identidad visible antes de cada grupo de operaciones.
- No abrir ni operar `nexora-pos-web.onrender.com`, Render u otras empresas.
- Navegación por la interfaz a ritmo humano, con una operación revisable por vez.
- Root confirma acceso y coordina los períodos de cambios. Mientras caja/ventas o IA verifican cifras, mantener configuración estable.
- Usar los roles reales que ofrezca la interfaz. No dar por existentes controles, permisos ni perfiles que aún no se han observado.
- No cambiar credenciales, PIN, propiedad, plan, facturación, integración de cobros, datos fiscales ni acceso de la cuenta principal. No eliminar ni desactivar usuarios preexistentes.
- No enviar invitaciones, correos, mensajes o notificaciones externos. Si la única alta disponible invita a terceros, dejar esa prueba pendiente.
- Registrar valores iniciales de los campos que se probarán, con secretos omitidos. Un cambio reversible de prueba debe quedar identificado y restaurarse después de verificar su persistencia.

## Preparación por la interfaz

1. Capturar empresa y perfil activo sin incluir credenciales o PIN.
2. Registrar secciones de Configuración y Usuarios disponibles, etiquetas reales y rol actual.
3. Distinguir estado guardado de edición pendiente: abandonar y volver al formulario antes de empezar.
4. Identificar un campo descriptivo sin efecto contable o fiscal, si existe. Usarlo únicamente dentro de `aud-chatgpt` y con coordinación de root.
5. Establecer cuentas de prueba independientes solo si el alta es interna y no comunica con terceros. Mantener intacta la cuenta principal.

## Casos de configuración

| ID | Prueba | Pasos previstos | Resultado esperado | Evidencia y cuidado |
|---|---|---|---|---|
| CFG-01 | Guardar en empresa nueva | Confirmar empresa; abrir Configuración; anotar valor inicial de campo descriptivo; editar con marca AUD-VIVO; pulsar Guardar una vez; observar mensaje; salir y volver; recargar cuando no haya operación pendiente. | El valor persiste y se comunica éxito; si falla, se informa el error y se conserva una edición recuperable. | Captura antes, después y tras volver; hora y etiqueta exacta. **Caso reportado por el usuario, no reproducido**. No crear otra empresa para probarlo. |
| CFG-02 | Cancelar edición | Modificar el mismo campo sin guardar; usar Cancelar o abandonar según la interfaz; volver. | No persistir cambios descartados; advertencia comprensible si el producto la ofrece. | Registrar la conducta real sin asumir que deba existir un modal específico. |
| CFG-03 | Validación | En un campo reversible observado, probar vacío y longitud límite documentada por la UI; no enviar datos fiscales o financieros ficticios. | Validación coherente; error junto al campo; no mostrar éxito sin persistencia. | Capturar etiqueta, valor no sensible y mensaje. La ausencia de un límite no demuestra fallo por sí sola. |
| CFG-04 | Estado de guardado | Pulsar Guardar una vez; observar carga, disponibilidad del botón, aviso y recuperación ante fallo. | Resultado inequívoco; ninguna confirmación falsa; edición recuperable. | No provocar solicitudes repetidas ni interrupciones artificiales de red. |
| CFG-05 | Consistencia entre sesiones | Tras guardar un cambio autorizado, abrir la misma sección en otra sesión de prueba del mismo tenant y volver a leer. | Mostrar el dato persistido en ambas sesiones; no mezclar empresas. | Coordinar ventanas para que ningún otro agente cambie ese campo. |
| CFG-06 | Restauración | Reponer exactamente el valor inicial, guardar y volver a comprobar. | Estado final igual al inicial para los campos intervenidos. | Si Guardar falla, documentar que la restauración quedó pendiente; no afirmar restaurado. |

## Casos de usuarios y permisos

| ID | Prueba | Pasos previstos | Resultado esperado | Límite |
|---|---|---|---|---|
| USR-01 | Inventario de roles | Como dueña, listar roles y capacidades que muestra el producto. | Nombres y permisos comprensibles; identificar cómo se asigna cada rol. | No inventar matriz de permisos por el nombre del rol. |
| USR-02 | Alta interna de prueba | Si existe alta sin invitación, crear una cuenta claramente AUD-VIVO para gerente o cajera con el mínimo acceso necesario. | Alta única en aud-chatgpt; rol visible; sin comunicaciones externas. | No elevar ni modificar la cuenta principal. Si requiere correo real/invitación, pendiente. |
| USR-03 | Acceso por rol | En sesiones separadas, acceder a secciones observadas de Caja, Productos, Reportes, Configuración y Usuarios. | Capacidades coinciden con permisos declarados o acordados explícitamente en UI. | No etiquetar como fallo un permiso de gerente desconocido; registrar indeterminado. |
| USR-04 | Ruta visible restringida | Desde una sesión con permiso limitado, usar únicamente una ruta que haya mostrado la UI del mismo sitio, sin consultar API ni otros tenants. | No permitir una operación que la propia política visible le niega; mensaje claro. | No enumerar rutas, identificadores, empresas ni servicios. |
| USR-05 | Cambio de permiso en usuario de prueba | La dueña retira una capacidad de la cuenta AUD-VIVO; esa cuenta vuelve a entrar a la pantalla y reintenta una acción reversible permitida antes. | La restricción se aplica; no se confirma un cambio no autorizado. | Coordinar y restaurar solo el usuario de prueba; nunca quitar acceso a la principal. |
| USR-06 | Logout y cambio de usuario | Cerrar sesión de prueba; observar retorno al acceso; iniciar otra cuenta de la misma empresa; volver a las secciones autorizadas. | El perfil y capacidades corresponden a la nueva cuenta; no queda una operación anterior completada bajo identidad incorrecta. | No capturar secretos o pantalla de PIN introducido. |
| USR-07 | IA y rol | Desde cada rol disponible, preguntar sobre un dato permitido observado y sobre una capacidad explícitamente restringida. | Respuestas consistentes con datos y permisos. Si el acceso está restringido, no revelar cifras ni detalles que la propia UI niega. | Coordinar IDs de preguntas con grupos IA para contar una sola vez; no preguntar por empresas externas. |
| USR-08 | Trazabilidad | Si existe historial de acciones, buscar la edición y operación propias de prueba. | Identidad, hora y objeto coinciden con la operación realizada. | Ausencia de historial no implica fallo si no es una función ofrecida. |

## Matriz a completar con observación

Usar `permitido`, `denegado`, `no ofrecido` o `indeterminado`. Una contradicción requiere una política o permiso visible como referencia.

| Capacidad observada | Dueña: permiso declarado / conducta | Gerente: permiso declarado / conducta | Cajera: permiso declarado / conducta |
|---|---|---|---|
| Consultar configuración | Pendiente | Pendiente | Pendiente |
| Guardar configuración reversible | Pendiente | Pendiente | Pendiente |
| Listar y administrar usuarios | Pendiente | Pendiente | Pendiente |
| Productos y stock | Pendiente | Pendiente | Pendiente |
| Abrir/operar/cerrar caja | Pendiente | Pendiente | Pendiente |
| Consultar reportes y crédito | Pendiente | Pendiente | Pendiente |
| Pregúntale a Nexora | Pendiente | Pendiente | Pendiente |

## Registro de hallazgo, únicamente después de reproducir

```text
ID: AUD-CFG/USR-___
Título:
Gravedad: crítica / alta / media / baja
Estado: confirmado / no reproducido / bloqueado
Fecha y hora: zona America/La_Paz
Empresa: aud-chatgpt
Perfil y permisos observados:
Precondiciones y dato inicial:
Pasos numerados por la interfaz:
Esperado y fuente que lo sustenta:
Observado, mensaje literal y persistencia:
Impacto concreto:
Repetición y frecuencia:
Capturas: ruta relativa, pantalla, momento y anotación
Estado final y restauración efectivamente verificada:
```

Gravedad según efecto probado: crítica si una operación permite comprometer alcance de empresa o integridad grave; alta si bloquea una operación esencial o autoriza una modificación explícitamente prohibida; media si requiere alternativa y afecta parte del flujo; baja si es presentación o comprensión sin alterar datos. No asignar gravedad por hipótesis.

Cada captura debe mostrar la pantalla real, contexto, resultado y marca temporal registrada en bitácora. Mantener originales; redactar una copia si contiene información sensible. Nunca capturar contraseñas, PIN ni tokens. No reemplazar una captura ausente por una recreación.

## Estado técnico de este plan

Se leyó `c2/control-browser` y se consultaron las herramientas disponibles. En esta sesión no se encontró `js` de Browser, herramientas de lectura de pestañas, handoff ni CUA REPL. La guía exige la herramienta de Browser para controlar su navegador y prohíbe sustituirla por Playwright o automatización de shell. Root coordina la resolución del acceso. No se ha visitado ni modificado el producto desde este agente.
