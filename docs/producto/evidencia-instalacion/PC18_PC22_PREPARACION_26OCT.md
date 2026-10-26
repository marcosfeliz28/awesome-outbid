# Preparación de PC-18 y PC-22 · 26-oct-2026

## Alcance

Se prepararon los dos instaladores desde `90002abe`. No se ejecutó ninguno,
no se instaló software de Nexora/FitStore, no se creó empresa, no se tocó
Render, la tienda en vivo ni credenciales.

## Artefactos verificados

| Edición | Archivo | Tamaño | SHA-256 | Firma |
|---|---|---:|---|---|
| Producto local | `Nexora-POS-Local-Setup-0.1.1.exe` | 90,622,757 bytes | `5FC5648DBF64CEEE4D62D39F63B171A51EE2D56B38EF0E5FFF04589278E3347D` | `NotSigned` |
| Tienda de prueba | `Nexora-POS-Setup-0.1.1-prueba.exe` | 142,509,775 bytes | `40D55992800A57AB8ACD125C28642BC261499B95536888A68D95F88E9834E1DD` | `NotSigned` |

La edición de tienda se produjo con `instalador/build.ps1` desde una ruta
físicamente corta (`C:\Users\marco\Downloads\npc22`), tras `pnpm install
--frozen-lockfile`. La salida final confirmó `Instalador listo` y el mismo
SHA-256 de la tabla.

## Hallazgo de preparación

NSIS falla al empaquetar desde una ruta larga por el archivo anidado de
`@aws-sdk/core`; una carpeta físicamente corta evita ese límite. Una unidad
virtual `subst` no es sustituto equivalente: pnpm conserva las rutas físicas
`C:` para `@fitstore/shared` y `verify-deploy-lock.mjs` las compara contra la
ruta virtual, por lo que falla cerrado. No se atribuye ese último caso al
instalador de producción.

## Estado antes de la prueba

- No existen `C:\Program Files\Nexora POS Local` ni
  `C:\ProgramData\Nexora POS Local`.
- No hay servicios `NexoraLocal*`.
- Se solicitó UAC una vez para la prueba local, pero se cerró sin aceptar y
  sin abrir el instalador; no hubo instalación.

## Pendiente para mañana

1. Con la dueña presente, aceptar UAC y ejecutar PC-18 con el instalador local.
2. Guardar capturas de cada pantalla y las salidas de servicios, puertos y
   `Verify-FitStore.ps1`.
3. Ejecutar PC-22 desde una tanda limpia, primero tienda y luego producto
   local; comparar servicios, puertos, sesiones y los datos de ambas bases.
4. Registrar SmartScreen/UAC como pendiente PC-17: ambos ejecutables siguen
   sin firma.
