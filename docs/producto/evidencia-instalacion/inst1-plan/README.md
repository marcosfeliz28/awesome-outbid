# Evidencia INST-1

Esta carpeta prepara la recoleccion de evidencia para INST-1. No certifica ninguna prueba: al crearla, todas las filas de `MATRIZ.md` y `RESULTADOS.md` siguen en estado `PENDIENTE`.

La ejecucion debe hacerse unicamente en maquinas virtuales desechables o en una PC limpia que no sea la tienda. No se usan datos, licencias ni credenciales reales; tampoco se toca Render.

## Estructura prevista

La evidencia real se copiara aqui desde cada entorno limpio con esta forma:

```text
inst1-plan/
  windows-10/
    capturas/
    salidas/
    instaladores-sha256.txt
    sistema.txt
  windows-11/
    capturas/
    salidas/
    instaladores-sha256.txt
    sistema.txt
  pc16-rust/
    cargo-test.txt
    cargo-build.txt
  pc19-acl/
    Windows-License-Acl.txt
  pc17-firma/
    certificado-requerido.md
```

Las subcarpetas se crean al incorporar evidencia real. No se agregan archivos vacios ni resultados simulados.

## Convencion de nombres

- Captura: `<paso>-<descripcion>-<OK|FALLA|BLOQUEADO>.png`.
- Salida: `<paso>-<descripcion>-<OK|FALLA|BLOQUEADO>.txt`.
- Cada archivo debe corresponder a una fila de `MATRIZ.md`.
- Las capturas deben mostrar fecha, hora y ventana completa cuando sea posible.
- Las salidas deben conservar el comando, su salida completa y el codigo de salida.

Ejemplos de nombres, no de resultados:

```text
windows-11/capturas/3-1-servicios-OK.png
windows-10/salidas/3-3-modo-silencioso-FALLA.txt
pc19-acl/Windows-License-Acl.txt
```

## Cabecera obligatoria por tanda

Antes de marcar cualquier fila, registrar en `RESULTADOS.md`:

1. Persona que ejecuto la prueba.
2. Fecha, hora y zona horaria.
3. Windows, edicion, version y compilacion (`winver` y `Get-ComputerInfo`).
4. Nombre de la VM o identificacion de la PC limpia.
5. Rama y SHA exacto usados para construir el instalador.
6. Version de `instalador/VERSION`.
7. SHA-256 de cada instalador.
8. Estado de firma del instalador.
9. Snapshot inicial y reinicios realizados.

## Reglas de aceptacion

- Solo se usa `OK` cuando existe una captura o salida verificable enlazada desde la fila.
- `FALLA` conserva el mensaje exacto, el codigo de salida y los registros disponibles.
- `BLOQUEADO` explica el recurso ausente, por ejemplo impresora termica o gaveta fisica.
- Una celda vacia o `PENDIENTE` significa que no se ejecuto.
- La prueba de impresora y gaveta fisicas no se sustituye por una simulacion de VM.
- `Windows-License-Acl.ps1` se ejecuta exclusivamente dentro de la VM limpia.
- Los archivos de evidencia no deben contener secretos, contrasenas, claves privadas ni datos de la tienda.

La guia operativa de referencia es `docs/producto/PRUEBA_WINDOWS_LIMPIO.md` de `origin/claude-pc/windows-escritorio`.
