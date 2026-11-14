# Instalación limpia · informe de Claude PC · 14-nov-2026 (orden 126)

**Estado: BLOQUEADO antes del paso 1.** No hay instalación de Nexora dentro de la VM, no hay captura de `winver` ni de caja/venta/cierre/respaldo.

Rama: `claude-pc/instalacion-limpia-14nov`, desde `origin/nexora-cloud` (ae3c750b). Solo documentos, sin código, sin Render, sin producción, sin datos reales.

## Comprobaciones hechas en el host (sin ejecutar nada)

| Dato | Valor observado |
| --- | --- |
| VM | `FitStore-INST1-Win10`, Hyper-V generación 2, 4 procesadores, 8 GiB de inicio |
| Estado de la VM | **Saved** (no se inició ni se abrió la consola en esta sesión) |
| EXE preparado | `Nexora-POS-Setup-0.1.1-prueba.exe`, 141,778,408 bytes |
| SHA-256 del EXE | `42F50D6F44481258BD3C3E02F543B24972815052B290F35CB96C87BE1A2C548F`, **coincide** con el informe de ChatGPT PC (orden 126) |
| Copia a la VM | No hecha (depende de llegar al escritorio) |

## Paso a paso (orden 126)

| Paso | Resultado | Motivo |
| --- | --- | --- |
| 1 · Cuenta de Windows (cuenta local de prueba) | **No ejecutado** | Crear la cuenta y escribir su clave requiere permiso explícito; no lo tengo. La última pantalla registrada por ChatGPT PC es «Let's add your account». No se ha verificado en esta sesión. |
| 2 · `winver` y captura | No probado | Depende del paso 1. |
| 3 · Copia del EXE, SHA-256, instalación, tamaño, tiempo, avisos de Windows | No probado | Solo se comprobó el hash en el host. |
| 4 · Abrir caja, venta, cierre, respaldo y restauración | No probado | Depende de 1 a 3. |
| 5 · Guardar la VM en Saved y cerrar conexiones | No aplica | La VM sigue en Saved sin cambios desde esta sesión. |
| 6 · Informe | Este documento | Estado parcial. |
| 7 · Un solo push y 3 CI | Ver commit en la respuesta | |

## Qué hace falta para continuar

1. Que confirmes que puedo crear la cuenta local de prueba en la VM. La clave la escribirías tú o la pondrías en tu gestor de contraseñas; yo no la anoto en ningún archivo.
2. O bien, que tú completes el paso 1 y me dejes la VM en el escritorio. Entonces sigo con los pasos 2 a 6.
3. Para ver las pantallas necesito acceso de control de pantalla al host (ventana de Hyper-V). No lo he pedido en esta sesión.

## Nota

Este informe no declara la instalación «certificada». Su único resultado verificado es la coincidencia del SHA-256 del EXE.
