# Controles de GitHub · candidato 9fe7d80e

Rama `dot/15areas-integracion-18nov`, código `9fe7d80ee3eb8aeef4264059d98809e80943e741`, sobre `nexora-cloud` `e1a2e9356aeba846c3546853350909e5b29ed8d9`. Los árboles de API, paquete compartido y recursos de Productos coinciden con la base. Se conservan los 275 WebP.

Instalador e imágenes pasaron. El control `verify` sigue rojo para este SHA. [Ejecución completa](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44302110191)

## Resultado de verify

El control completo se detiene en `pnpm check`. GitHub publicó cuatro aserciones en dos archivos. [Job del commit exacto](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44302110191/job/134794197858)

1. `tests/accessibility-contract.test.ts:27`. En `App.tsx:779` se incorporó por error el título traducido del Informe mensual a una condición que espera un booleano. Restaurar la condición booleana anterior y conservar la traducción solo en el encabezado. La observación se limita a lectura del código. [Condición candidata](https://github.com/marcosfeliz28/awesome-outbid/blob/9fe7d80ee3eb8aeef4264059d98809e80943e741/apps/web/src/App.tsx#L779)
2. `tests/accessibility-contract.test.ts:92`. La prueba espera el literal «Negocio y reglas». El título ahora pasa por el traductor en `Management.tsx:4745`. Preservar la comprobación de que la opción aparece en español en su ruta real. [Título de la opción](https://github.com/marcosfeliz28/awesome-outbid/blob/9fe7d80ee3eb8aeef4264059d98809e80943e741/apps/web/src/Management.tsx#L4745)
3. `tests/operaciones-language.test.ts:34 y 52`. La prueba toma los tres últimos cambios de `PRESERVACION.json`. Tras incorporar otras áreas, esa selección ya no corresponde a Compras, Gastos y Clientes. El código conserva la fecha local comprobada. Seleccionar las tres entradas por un identificador estable y mantener las verificaciones de idiomas, fecha y operación. [Selección vigente](https://github.com/marcosfeliz28/awesome-outbid/blob/9fe7d80ee3eb8aeef4264059d98809e80943e741/tests/operaciones-language.test.ts#L9)

El candidato anterior `28ea6819` también falló en `pnpm check`, con una anotación para `URL` en el test Node. En `9fe7d80e` ese archivo ya importa `URL` de `node:url`. [Control del candidato anterior](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44300854327/job/134789886716)

La rama avanzó a `2e9299d9`. El código vuelve a separar el título del Informe mensual de la condición booleana de navegación. La nueva ejecución de ese SHA se comprueba por separado. [CI del sucesor](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44303408416)
