# Instalación limpia de Windows y aceptación pendiente · 14-nov-2026

## Resultado observado

**Windows 10 Pro se instaló desde el ISO en el disco vacío de la VM y arrancó hasta la configuración inicial OOBE. No se llegó al escritorio ni se instaló o ejecutó Nexora dentro de la VM.** El punto pendiente es completar manualmente la etapa de cuenta de Windows. La máquina quedó guardada en estado **Saved**, con su conexión gráfica cerrada; la VM de Windows 11 permanece **Off**.

Esta prueba corrige el supuesto anterior de «ISO dañado/no arrancable»: el medio actual es legible, sus ejecutables de arranque comprobados tienen firmas válidas y permitió copiar Windows, reiniciar desde el disco y llegar a OOBE. No se atribuye al ISO un error de DISM 740: ese código indicó falta de elevación para la consulta, no daño del medio. Tampoco se certifica cada bloque comprimido de las imágenes Windows.

- Orden: sección «Cola 14-nov» de `docs/coordinacion/ORDENES_CHATGPT_PC.md`, `origin/nexora-cloud` **`1d118b16e779ab41827d60daee0e59295747f643`**.
- Rama documental: `chatgpt-pc/despues3-14nov`.
- Destino exclusivo: **FitStore-INST1-Win10**, Hyper-V generación 2, 4 procesadores virtuales, memoria de inicio 8 GiB.
- Disco de destino observado en Windows Setup: **Drive 0 Unallocated Space, 80.0 GB libres de 80.0 GB**. Se eligió **Custom: Install Windows only (advanced)**; no se borró ni formateó ningún disco del host.
- No se ingresaron cuentas, correo, claves reales, clave de producto ni datos de la tienda. No se copió Node ni el repositorio a la VM. No se cambiaron opciones de privacidad ni se eludieron advertencias de Windows.

## Identidad y comprobaciones del ISO

| Dato | Valor verificado |
| --- | --- |
| Archivo | `C:\Hyper-V\FitStore-INST1\Win10.iso` |
| Tamaño | **4,893,900,800 bytes** |
| SHA-256 | `0CDD9E1B3E669F52DB1604DED9F743354A032D119A87B432551CE23A09D24E52` |
| Última modificación | 25-oct-2026, 16:07:07 UTC−04 |
| Volumen montado de solo lectura | UDF, etiqueta `WIN10_X64`, archivos accesibles |
| EFI comprobado | `efi\boot\bootx64.efi`, 1,590,656 bytes, firma **Valid** de Microsoft Windows, versión `10.0.19041.3636` |
| Gestor comprobado | `bootmgr.efi`, 1,574,256 bytes, firma **Valid** de Microsoft Windows, versión `10.0.19041.3636` |
| Otros ejecutables comprobados | `setup.exe` y `sources\setup.exe`: firmas **Valid**, Microsoft |
| `sources\boot.wim` | 450,382,622 bytes; cabecera `MSWIM`, 208 bytes, parte 1/1; XML analizable con Windows PE x64 y Windows Setup x64 |
| `sources\install.esd` | 4,160,744,150 bytes; cabecera `MSWIM`, 208 bytes, parte 1/1; XML analizable con 7 ediciones, incluida Windows 10 Pro |

Los recursos XML de WIM/ESD terminan exactamente al final de sus archivos; sus metadatos declaran arquitectura x64 y versión base 10.0.19041/3803. Esos metadatos y las versiones de los ejecutables **no sustituyen un `winver` del sistema ya configurado**, que quedó pendiente. Ninguna imagen trae una tabla de integridad utilizable para comprobar todos sus recursos comprimidos.

El ISO también contiene UDF: que `tar -tf` listara únicamente la raíz ISO9660 no demostraba que estuviera vacío. La comprobación posterior mediante montaje de solo lectura confirmó el contenido. Los montajes de consulta se desmontaron; al cierre, `Get-DiskImage` indicó **Attached=False** en el host.

Antecedente: `C:\Users\marco\Downloads\nexora-instalacion-limpia-12nov\docs\coordinacion\RESULTADOS_CHATGPT.md:228-234` documentaba el fallo de arranque del 12-nov. Ese fallo era real, pero no determinaba por sí mismo la causa. El 14-nov se observó el prompt del DVD, se resolvió su entrada a tiempo y Windows Setup arrancó. No se presenta la lectura del ISO como equivalente a una instalación terminada: esta vez también se ejecutó la instalación hasta OOBE.

## Recorrido gráfico ejecutado

Las imágenes son capturas JPEG sin retoque de la conexión de Hyper-V; el contenido de la VM se ve dentro del marco de la conexión. Se conservan los bytes recibidos y se ajustó únicamente su extensión a `.jpg`. No son capturas de una instalación en la laptop de trabajo.

| Paso | Resultado | Evidencia |
| --- | --- | --- |
| Arranque del medio | Windows Setup visible, después del prompt del DVD | [Carga desde DVD](capturas/despues3-14nov/WIN10-03-carga-desde-dvd.jpg), [Setup arrancado](capturas/despues3-14nov/WIN10-04-setup-arrancado.jpg) |
| Inicio de instalación | Pulsar Install now | [Inicio](capturas/despues3-14nov/WIN10-10-install-now.jpg) |
| Activación | Elegir la opción normal «I don't have a product key»; no se ingresó una clave | [Sin clave de producto](capturas/despues3-14nov/WIN10-11-sin-clave-producto.jpg) |
| Edición | Windows 10 Pro x64 | [Edición seleccionada](capturas/despues3-14nov/WIN10-12-edicion-pro.jpg) |
| Tipo y destino | Custom sobre el único disco vacío de 80 GB | [Tipo de instalación](capturas/despues3-14nov/WIN10-13-tipo-instalacion.jpg), [disco vacío](capturas/despues3-14nov/WIN10-14-disco-vacio-80gb.jpg) |
| Copia | Copia de archivos Windows completada; preparación progresó del 21 % al 98 %, sin error observado | [Preparación](capturas/despues3-14nov/WIN10-15-copiando-instalacion.jpg) |
| Primer reinicio | Arrancó desde el disco virtual y mostró Getting ready | [Reinicio](capturas/despues3-14nov/WIN10-16-fin-copia-windows.jpg), [primer arranque](capturas/despues3-14nov/WIN10-17-primer-arranque-getting-ready.jpg) |
| OOBE | Región y teclado; avanzó por la preparación inicial de red | [Región](capturas/despues3-14nov/WIN10-18-oobe-region.jpg) |
| Punto pendiente | Pantalla «Let's add your account», con correo/teléfono/Skype y opción Offline account visibles; no se interactuó con los campos de acceso | [Cuenta pendiente](capturas/despues3-14nov/WIN10-20-oobe-cuenta.jpg) |
| Cierre | Guardar la VM en Saved y cerrar vmconnect | [Estado guardado](capturas/despues3-14nov/WIN10-21-vm-guardada.jpg) |

Inicio observado de copia al disco: **14-nov, 08:43:52 UTC−04** (`2026-11-14T12:43:52.408Z`). La copia, reinicio y llegada a OOBE ocurrieron durante esta sesión; no se midió un tiempo de instalación hasta escritorio porque esa fase no terminó. La región y teclado elegidos en esta VM de prueba fueron United States/US, correspondientes a los valores visibles del instalador en inglés.

## Punto que requiere intervención manual

El asistente de Windows llegó a una pantalla de cuenta, no a un error del ISO. Se detuvo la automatización por la regla de la skill [Computer Use](C:/Users/marco/.codex/plugins/cache/openai-bundled/computer-use/26.1106.51428/skills/computer-use/SKILL.md): **«Do not automate user authentication dialogs»**, en [guidance.md](C:/Users/marco/.codex/plugins/cache/openai-bundled/computer-use/26.1106.51428/docs/guidance.md), sección «Non-negotiable Windows Automation Safety». La selección de una cuenta y la continuación de OOBE deben completarse manualmente. No se ingresó ninguna credencial ni se creó una cuenta Microsoft o local.

No se puede afirmar todavía que el Windows limpio esté listo para operar: faltan completar OOBE, llegar al escritorio y capturar la versión instalada. Después podrá continuarse con el EXE preparado, sin instalar Node ni abrir el repositorio dentro de la VM. Si aparece una advertencia que exija intervención de la persona, debe registrarse y no eludirse.

## Artefacto Nexora preparado, todavía no ejecutado

La identidad del EXE se comprobó en el host **sin ejecutarlo**. La preparación del DVD de datos no significa que Nexora se haya instalado en la VM.

| Dato | Valor |
| --- | --- |
| Commit fuente | **`1d118b16e779ab41827d60daee0e59295747f643`**, igual al HEAD examinado |
| CI | [43594157456](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/43594157456), trabajo `windows-installer` terminado en success |
| Artefacto | `14113569389`, EXE y archivo de huella del CI |
| Ruta local | `C:\Users\marco\AppData\Local\Temp\nexora-ci-43594157456-14nov\Nexora-POS-Setup-0.1.1-prueba.exe` |
| Versión de archivo | **`0.1.1-prueba`** |
| Tamaño | **141,778,408 bytes** |
| SHA-256 | **`42F50D6F44481258BD3C3E02F543B24972815052B290F35CB96C87BE1A2C548F`**, coincidente con la huella del CI |
| Firma Authenticode | **NotSigned** |
| DVD local de datos | `C:\Users\marco\AppData\Local\Temp\nexora-ci-43594157456-14nov\Nexora-CI-1d118b16.iso`, 141,832,192 bytes |
| SHA-256 del DVD de datos | `D17FBCC31FBF028AB921A3931BF13E897207CFDEE2ED6CB7C0C4B4DE061689D0` |

El DVD de datos contiene únicamente el EXE y su `.sha256.txt`; se comprobó mediante montaje de solo lectura y quedó desmontado. No es un medio de arranque de Windows y no se sustituyó el DVD de Windows durante la instalación del sistema operativo. Al cierre se consultó el CI del SHA exacto: `verify`, `windows-installer` y `render-images` terminaron en **success**. Ese resultado no se presenta como aceptación gráfica de Nexora.

## Aceptación pendiente y estado final

| Prueba | Estado al cierre |
| --- | --- |
| ISO legible y arranque de Setup | **Comprobado** |
| Instalar Windows en disco vacío y arrancar hasta OOBE | **Comprobado** |
| Completar cuenta/OOBE y llegar al escritorio | **Pendiente de intervención manual** |
| Versión final de Windows en pantalla | **No comprobada** |
| Instalar y abrir el EXE exacto del CI dentro de la VM | **No ejecutado** |
| Crear dueña, vender y cerrar caja en Nexora instalado | **No ejecutado** |
| Respaldo y restauración del Nexora instalado | **No ejecutado** |
| Actualización/retroceso del producto instalado | **No ejecutado** |

Estado final verificado mediante Hyper-V: **FitStore-INST1-Win10 = Saved**, **FitStore-INST1-Win11 = Off**. La ventana de conexión desapareció de `sky.list_windows()` y no quedó un proceso `vmconnect` abierto. No se modificaron servicios del host, otras VM, código, credenciales reales, Render ni producción. No hubo despliegue.
