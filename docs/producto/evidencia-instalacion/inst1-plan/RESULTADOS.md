# Resultados INST-1

> Plantilla. Estado al crear este archivo: **ninguna prueba consignada**.

## Identificacion de la tanda

| Campo | Valor |
|---|---|
| Responsable | PENDIENTE |
| Fecha, hora y zona | PENDIENTE |
| Windows, edicion y compilacion | PENDIENTE |
| VM o PC limpia | PENDIENTE |
| Snapshot inicial | PENDIENTE |
| Rama | `chatgpt-pc/instalacion` |
| SHA probado | PENDIENTE |
| Version del instalador | PENDIENTE |
| SHA-256 del instalador de producto | PENDIENTE |
| SHA-256 del instalador de tienda | PENDIENTE / no aplica |
| Firma Authenticode | PENDIENTE |
| Reinicios realizados | PENDIENTE |
| Hardware de impresion | PENDIENTE / no disponible |

## Resumen por punto

| Punto | Estado | Comandos o pruebas | Evidencia enlazada | Observaciones |
|---|---|---|---|---|
| PC-16 Rust/Tauri | PENDIENTE | `cargo test`; `cargo build` | — | |
| PC-16 impresora/gaveta | PENDIENTE | Matriz 3.6 | — | No sustituible por VM sin hardware |
| PC-18 instalacion/desinstalacion | PENDIENTE | Matriz 3.1, 3.3, 3.5, 3.9 y 3.10 | — | Debe pasar en Windows 10 y 11 |
| PC-22 coexistencia | PENDIENTE | Matriz 3.2, 3.4, 3.8, 3.11 y 3.12 | — | Debe pasar en Windows 10 y 11 |
| PC-19 licencia/ACL | PENDIENTE | Matriz 3.7 y `Windows-License-Acl.ps1` | — | Script solo en VM limpia |
| PC-17 firma | PENDIENTE | Identificacion exacta del certificado requerido | — | Instalador se arma sin firma por ahora |

## Resultado de comandos

Pegar solo resúmenes verificables y enlazar la salida completa:

```text
Comando:
Entorno:
Inicio:
Fin:
Codigo de salida:
Resultado: OK | FALLA | BLOQUEADO
Archivo de salida:
```

## Fallos y bloqueos

| Fecha y hora | Entorno | Paso | Mensaje o codigo exacto | Registro/captura | Accion posterior |
|---|---|---|---|---|---|
| PENDIENTE | — | — | — | — | — |

## Veredicto de la tanda

- Resultado general: **PENDIENTE**.
- Pruebas no ejecutadas: todas al crear esta plantilla.
- Diferencias entre Windows 10 y Windows 11: PENDIENTE.
- Riesgos abiertos: PENDIENTE.
- SHA candidato para CI: PENDIENTE.
- CI `verify`: PENDIENTE.
- CI `windows-installer`: PENDIENTE.
- CI `render-images`: PENDIENTE.

No reemplazar `PENDIENTE` por una conclusion sin evidencia. El informe final del repositorio se actualiza por separado cuando existan el SHA publicado y los tres CI verdes.
