# Validación del instalador — 9 de noviembre

Base validada: `b249c6e481326bb3abf4e6af93f1836fd16ec065` (`origin/nexora-cloud`).
Entorno: Windows 11 Pro, compilación 26300. La base usada para las pruebas de
aplicación fue PostgreSQL temporal aislado en un puerto local alterno; no se
consultó ni modificó la base de la tienda.

## Resultado

| Paso | Resultado | Evidencia |
| --- | --- | --- |
| Validación estática del instalador | Pasa | `pnpm instalador:validar`: sintaxis de 67 scripts de PowerShell válida. |
| Construcción web y API | Pasa antes del empaquetado | Vite terminó la compilación web; la preparación del payload API también inició correctamente. |
| Generación del ejecutable instalable | **Falla — P0** | No se produjo `.exe`; por tanto no existen versión, tamaño ni SHA-256 que registrar. |
| Instalación en Windows limpio | No verificable | Depende del ejecutable ausente. |
| Inicio de sesión, venta, cierre, respaldo/restauración | No verificable desde instalador | Depende de una instalación correcta. |
| Actualización y reversión | No verificable | Depende de dos instaladores construidos correctamente. |

## Fallo prioritario

### P0 — el empaquetado se detiene y no entrega instalador

`pnpm instalador:compilar` termina con código 1 en
`instalador/build.ps1:299`. El mensaje indica que `Copy-Item` no encuentra un
archivo de documentación de npm bajo
`instalador/build/node-expand/node-v24.21.0-win-x64/node_modules/npm/docs/output/commands/`.

Impacto: no hay ejecutable para probar en Windows limpio, ni artefacto al que
calcular versión, tamaño o SHA-256. Es un bloqueo de salida, no una falla de la
base de la tienda.

Propuesta para quien corrija el empaquetador: revisar la lista de archivos que
se copia o expande en torno a la línea 299, de modo que no dependa de páginas
de documentación opcionales que no vienen en la distribución de Node usada.
Después, repetir la construcción desde un directorio limpio y verificar el
artefacto antes de instalarlo.

## Límites de esta corrida

El equipo dispone del ejecutable de Windows Sandbox, pero no se inició porque
la construcción falló antes de crear un instalador. No se cambió la red del
equipo ni se usaron cuentas, contraseñas o PIN reales.
