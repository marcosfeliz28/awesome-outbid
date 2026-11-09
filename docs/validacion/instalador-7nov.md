# Validación del instalador · 7-nov-2026

Estado al 9-nov-2026: **parcial; no certificado para venta**.

## Fuente y compilación

- Rama: `chatgpt-pc/instalador`.
- Base actualizada con `git pull --ff-only origin nexora-cloud`.
- Commit base: `655570eba498eb3481901d671d38101c672749ba`.
- Entorno de construcción: Windows, Node `v24.21.0`, pnpm `11.19.0`.
- Comandos ejecutados:
  - `pnpm install --frozen-lockfile` — correcto.
  - `pnpm instalador:compilar` — correcto.
- Versión: `0.1.1-prueba`.
- Archivo: `instalador/dist/Nexora-POS-Setup-0.1.1-prueba.exe`.
- Tamaño: `141744665` bytes (`135.18 MiB`).
- SHA-256: `ab2793442471581a04fcca08e66603a5ec03ddde3f2c967b5760f25599cdac19`.
- Firma Authenticode: `NotSigned`.

El archivo generado no se añade a Git porque `instalador/dist/` es un artefacto
de construcción. Se conserva en el worktree local indicado arriba.

## Validación automatizada

`pnpm instalador:validar` ejecutó correctamente las primeras regresiones, la
sintaxis de 67 archivos PowerShell y la comprobación del lock/payload. Terminó
en rojo en `Payload-Privacy.ps1` porque Prisma intentó resolver
`binaries.prisma.sh` y DNS devolvió `getaddrinfo ENOTFOUND`. No se relajó ni se
omitió la prueba.

## Intento de Windows limpio

Se intentó usar la VM Hyper-V `FitStore-INST1-Win11`, con 8 GiB de RAM. Para
liberar memoria sin perder una sesión existente, la VM Windows 10 se guardó en
estado `Saved`. La VM Windows 11 arrancó, pero Microsoft Hyper-V UEFI informó:

```text
The boot loader did not load an operating system.
No operating system was loaded.
```

El disco `C:\Hyper-V\FitStore-INST1\Win11\disk.vhdx` no contiene un Windows
arrancable y no hay una ISO de Windows 11 disponible localmente. Por tanto, **no
se ejecutó el instalador** y no se acreditan todavía instalación, creación de la
dueña, venta, cierre de caja, respaldo, restauración, actualización, rollback,
reinicios ni desinstalación. Tampoco hay tiempos reales de primera instalación.

## Revisión de la guía

La ruta de compilación, el nombre del artefacto y la advertencia de firma de
`docs/INSTALADOR.md` coinciden con lo observado. Las afirmaciones sobre el
comportamiento instalado no pudieron contrastarse porque falta una Windows 11
limpia arrancable.

## Pendiente exacto antes de vender

1. Proveer o instalar una imagen oficial de Windows 11 limpia en la VM.
2. Verificar de nuevo el SHA-256 del mismo `.exe` dentro de la VM.
3. Ejecutar el flujo completo de instalación y `Windows-Smoke.ps1`.
4. Medir duración de primera instalación y reiniciar dos veces.
5. Probar venta, cierre, respaldo, restauración y desinstalación conservando datos.
6. Construir N+1 y probar actualización y rollback conservando base, usuarios y respaldos.
7. Adquirir un certificado de firma de código y firmar el instalador; mientras
   esté sin firma, SmartScreen puede advertir al cliente.
8. Preparar el manual de una página con capturas reales después de la prueba.

No se consultó ni modificó Render, producción, la base de la tienda o credenciales.
