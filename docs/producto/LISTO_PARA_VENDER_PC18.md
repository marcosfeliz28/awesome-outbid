# PC-18 · Nexora POS Local: lista para vender

**Fecha de la prueba:** 26-oct-2026
**Equipo:** laptop Windows 11 de la dueña
**Edición:** `Nexora POS Local` (NSIS, servidor y PostgreSQL en la PC)
**Estado actual:** **NO LISTA PARA VENDER**. La primera instalación real terminó con error y no llegó al primer inicio.

Este documento es el anexo de evidencia de PC-18/PC-22. No reemplaza la lista
general `docs/piloto/LISTO_PARA_VENDER.md` de `nexora-cloud`. Cuando la entrega
quede aprobada, la lista general debe enlazar este archivo y conservar los
pendientes PC-17, PC-19, PC-20 y PC-22.

## Regla de evidencia

- `✅` significa comprobado en esta laptop con evidencia guardada.
- `🟡` significa revisado en código o prueba automática, pero no confirmado en
  una instalación terminada.
- `🔴` significa que falló o no pudo comprobarse.
- Una compilación o una prueba automática verde no sustituye una reinstalación
  completa en Windows.

## Resultado de la primera instalación real

| ID          |  Severidad | Hallazgo observado                                                                                                                                                                                                                                                          | Estado de la corrección                                                                                                                                                                                                                |
| ----------- | ---------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PC18-WIN-01 |       Alta | Todas las pantallas visibles interpretaban texto UTF-8 con otra codificación: `dueÃ±o`, `contraseÃ±a`, `dÃ­gitos`, `configuraciÃ³n` y `CÃ³digo`.                                                                                                                            | Corrección en curso: `.nsi` con BOM UTF-8, `Unicode true`, compilación con `/INPUTCHARSET UTF8` y regresión que rechaza `Ã`, `Â` y `â€`. Falta reinstalar y revisar cada pantalla.                                                     |
| PC18-WIN-02 |       Alta | La pantalla del dueño exigía 12 caracteres, aunque para esta edición local la regla ordenada es de 4 a 20 caracteres, sin requisito de mayúscula, número ni símbolo.                                                                                                        | Corrección en curso y limitada al alta inicial local. Debe probarse 3 (rechaza), 4 (acepta), 20 (acepta), 21 (rechaza) y confirmar que la nube conserva mínimo 12.                                                                     |
| PC18-WIN-03 | Bloqueante | La configuración terminó con `No se pudieron aplicar las migraciones Código: 1`. El registro de PostgreSQL indicó `permission denied to create role`: una migración intentó crear los roles internos con el usuario de aplicación, que correctamente no tiene `CREATEROLE`. | Corrección en curso: crear y endurecer los roles internos durante el arranque privilegiado, antes de ejecutar Prisma, sin conceder `CREATEROLE` a la aplicación. Falta repetir una instalación real y confirmar todas las migraciones. |

### Evidencia de la ejecución fallida

1. **Pantalla de creación del dueño:** se observó texto dañado y la política de
   12 caracteres.
   `CAPTURA PENDIENTE DE COPIAR AL REPOSITORIO: pc18-01-dueno-fallo.png`
2. **Pantalla de progreso/error:** se observó texto dañado y el aviso de que la
   configuración no terminó; los datos existentes no se borraron.
   `CAPTURA PENDIENTE DE COPIAR AL REPOSITORIO: pc18-02-configuracion-fallo.png`
3. **Detalle de migración:** el instalador mostró `No se pudieron aplicar las
migraciones Código: 1`.
   `CAPTURA PENDIENTE DE COPIAR AL REPOSITORIO: pc18-03-migracion-fallo.png`
4. **Registro técnico:** guardar una copia redactada de
   `C:\ProgramData\Nexora POS Local\logs\instalador.log`, sin contraseñas,
   PIN, tokens ni cadenas de conexión.
   `ARCHIVO PENDIENTE: pc18-instalador-redactado.log`

## Revisión de texto pantalla por pantalla

La revisión final debe hacerse sobre el instalador **reconstruido**, no sobre el
ejecutable que falló. Cada fila necesita captura o registro real.

| Pantalla o salida               | Texto que debe revisarse                                                                                     | Evidencia después de corregir                                | Estado                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------- |
| Bienvenida                      | `Nexora POS Local`, `instalación`, botones y descripción sin caracteres dañados                              | `pc18-10-bienvenida.png`                                     | ⬜ Pendiente                                       |
| Crear usuario dueño             | `dueño`, `contraseña`, `Repetir contraseña`, `PIN (6 dígitos)`, `guárdalas`; aviso `de 4 a 20 caracteres`    | `pc18-11-dueno.png`                                          | 🔴 Falló en la primera ejecución; repetir          |
| Validaciones del dueño          | Nombre, correo, contraseñas que no coinciden, límites 3/4/20/21 y PIN                                        | capturas `pc18-12a` a `pc18-12e`                             | ⬜ Pendiente                                       |
| Respaldo local                  | `respaldo`, `conservarán`, `configúrala`, ruta de Nexora Local y aviso de copia fuera de la laptop           | `pc18-13-respaldo.png`                                       | ⬜ Pendiente                                       |
| Progreso de instalación         | `Instalando`, `Por favor espere`, nombres y rutas de Nexora Local                                            | `pc18-14-progreso.png`                                       | 🔴 La primera ejecución terminó con error; repetir |
| Mensajes de error               | `configuración`, `migraciones`, `Código`, `aplicación`, `instalación`, rutas y registro legibles             | `pc18-15-error-controlado.png` o prueba automatizada         | 🔴 El primer mensaje tenía mojibake; repetir       |
| Pantalla final                  | Mensaje de finalización y opción de abrir Nexora POS Local                                                   | `pc18-16-final.png`                                          | 🔴 No alcanzada                                    |
| Acceso directo                  | Nombre `Nexora POS Local`, icono y apertura de la dirección local correcta                                   | `pc18-17-acceso-directo.png`                                 | 🔴 No verificado                                   |
| Primer inicio e ingreso         | Entrar con el correo y la contraseña creados; no debe aceptar las credenciales de otra plataforma            | `pc18-18-login.png`                                          | 🔴 No alcanzado                                    |
| Aplicación instalada            | Tablero local, venta de prueba y funcionamiento después de reiniciar Windows                                 | `pc18-19-aplicacion.png`, `pc18-20-venta.png`                | 🔴 No alcanzado                                    |
| Respaldo y restauración aislada | Respaldo creado, SHA/manifest válido y restauración en base desechable                                       | registro redactado + `pc18-21-respaldo.png`                  | 🔴 No alcanzado                                    |
| Desinstalador conservador       | Preguntas de conservación/borrado sin mojibake; conserva base y respaldos por defecto e informa su ubicación | `pc18-22-desinstalador.png`, `pc18-23-datos-conservados.png` | 🔴 No alcanzado                                    |

También deben revisarse palabra por palabra los mensajes de los scripts `.ps1`,
los errores del registro y la salida silenciosa. La prueba automática debe
fallar si cualquiera de los textos del instalador contiene las secuencias
`Ã`, `Â` o `â€`.

## Matriz obligatoria de contraseña del dueño

| Modo             | Longitud | Resultado esperado             | Evidencia                       |
| ---------------- | -------: | ------------------------------ | ------------------------------- |
| Instalador local |        3 | Rechazo                        | prueba automática + captura     |
| Instalador local |        4 | Aceptación                     | prueba automática + instalación |
| Instalador local |       20 | Aceptación                     | prueba automática               |
| Instalador local |       21 | Rechazo                        | prueba automática + captura     |
| Nube / Render    |       11 | Rechazo; la regla no se afloja | prueba automática               |
| Nube / Render    |       12 | Aceptación                     | prueba automática               |

La excepción local solo puede existir durante la creación inicial del dueño
mediante `NEXORA_LOCAL_INSTALL=1`; no debe persistirse en `.env`, servicios,
registro ni archivos de respuesta. El bloqueo por intentos fallidos no cambia.

## Reinstalación que debe completarse antes de cambiar el estado

1. Construir el NSIS corregido y registrar versión, SHA-256 y estado de firma.
2. Confirmar que el ejecutable probado es el recién construido.
3. Ejecutar la instalación elevada y guardar capturas de todas las filas de la
   tabla anterior. No fotografiar ni copiar la contraseña ni el PIN.
4. Confirmar que las migraciones terminan y que los servicios
   `NexoraLocalPostgreSQL`, `NexoraLocalAPI` y `NexoraLocalWeb` quedan en marcha.
5. Ingresar con el usuario creado, hacer una venta ficticia y cerrar/reabrir la
   aplicación.
6. Crear y verificar un respaldo; probar restauración solo en una base
   desechable.
7. Desinstalar en modo conservador y comprobar que informa y conserva los
   datos; no usar purga en esta prueba.
8. Ejecutar las pruebas automáticas y anotar el SHA con los tres trabajos de CI
   verdes.

## Resultado final (no completar antes de tener evidencia)

- Instalador construido: `Nexora-POS-Local-Setup-0.1.1-prueba.exe`
- SHA-256: `4EF853C57D09C0D82251776F6B5E752520D5506D540AD6BE883250049F2C0003`
- Firma Authenticode: `NotSigned` (PC-17 continúa pendiente)
- Migraciones aplicadas: `PENDIENTE`
- Primer ingreso: `PENDIENTE`
- Venta ficticia: `PENDIENTE`
- Respaldo y restauración aislada: `PENDIENTE`
- Desinstalación conservadora: `PENDIENTE`
- Pruebas automáticas: `pnpm check` verde (793 aprobadas, 11 omitidas);
  `pnpm instalador:validar` verde; 63 migraciones aplicadas en PostgreSQL
  desechable con el usuario de aplicación sin `CREATEROLE`.
- CI (`verify`, `windows-installer`, `render-images`): `PENDIENTE`

**Veredicto vigente:** la ejecución del 26-oct encontró tres fallos reales y se
detuvo correctamente. No se puede ofrecer ni distribuir esta versión hasta
reconstruirla, repetir todo el recorrido y cerrar además los pendientes de
producto PC-17, PC-19, PC-20 y PC-22.
