# Matriz de evidencia INST-1

Estado inicial: **PENDIENTE — no ejecutado**.

Copiar una fila por entorno cuando una prueba se repita. No cambiar a `OK` sin enlazar evidencia real.

| ID | Entorno | Paso | Comprobacion | Estado | Evidencia | SHA de codigo / SHA-256 instalador | Notas |
|---|---|---|---|---|---|---|---|
| PC-16 | PC de desarrollo | Rust 1 | Versiones de `rustc`, `cargo` y herramientas Tauri | PENDIENTE | — | — | |
| PC-16 | PC de desarrollo | Rust 2 | `cargo test` en `apps/desktop/src-tauri` | PENDIENTE | — | — | |
| PC-16 | PC de desarrollo | Rust 3 | `cargo build` en `apps/desktop/src-tauri` | PENDIENTE | — | — | |
| PC-16 | PC limpia con impresora | 3.6.1 | Ticket termico de 80 mm, corte, tildes y letra ene | PENDIENTE | — | — | Requiere equipo fisico |
| PC-16 | PC limpia con impresora | 3.6.2 | Venta en efectivo abre la gaveta una sola vez | PENDIENTE | — | — | Requiere equipo fisico |
| PC-16 | PC limpia con impresora | 3.6.3 | Tarjeta y transferencia no abren la gaveta | PENDIENTE | — | — | Requiere equipo fisico |
| PC-16 | PC limpia con impresora | 3.6.4 | Impresora desconectada no pierde la venta | PENDIENTE | — | — | Requiere equipo fisico |
| PC-16 | PC limpia con impresora | 3.6.5 | Apertura manual exige motivo/permiso y confirma el pulso | PENDIENTE | — | — | Requiere equipo fisico |
| PC-18 | Windows 10 limpio | 3.1 | Instalar producto solo; carpeta, servicios, puertos y verificador | PENDIENTE | — | — | |
| PC-18 | Windows 11 limpio | 3.1 | Instalar producto solo; carpeta, servicios, puertos y verificador | PENDIENTE | — | — | |
| PC-22 | Windows 10 limpio | 3.2 | Tienda primero, producto despues; coexistencia completa | PENDIENTE | — | — | Manual |
| PC-22 | Windows 11 limpio | 3.2 | Tienda primero, producto despues; coexistencia completa | PENDIENTE | — | — | Adjuntar `resultado.json` si corre el guion |
| PC-18 | Windows 10 limpio | 3.3 | Guardia de ruta normal, silenciosa y variantes | PENDIENTE | — | — | Registrar codigo 4 o cuelgue real |
| PC-18 | Windows 11 limpio | 3.3 | Guardia de ruta normal, silenciosa y variantes | PENDIENTE | — | — | Registrar codigo 4 o cuelgue real |
| PC-22 | Windows 10 limpio | 3.4 | Servicios y puertos despues de reinicio y apagado brusco | PENDIENTE | — | — | |
| PC-22 | Windows 11 limpio | 3.4 | Servicios y puertos despues de reinicio y apagado brusco | PENDIENTE | — | — | |
| PC-18 | Windows 10 limpio | 3.5 | Crear empresa, completar inicio, hacer venta y verla en reportes | PENDIENTE | — | — | Datos ficticios |
| PC-18 | Windows 11 limpio | 3.5 | Crear empresa, completar inicio, hacer venta y verla en reportes | PENDIENTE | — | — | Datos ficticios |
| PC-19 | Windows 10 VM | ACL | Ejecutar `Windows-License-Acl.ps1` solo en la VM | PENDIENTE | — | — | Nunca en la tienda |
| PC-19 | Windows 11 VM | ACL | Ejecutar `Windows-License-Acl.ps1` solo en la VM | PENDIENTE | — | — | Nunca en la tienda |
| PC-19 | Windows 10 limpio | 3.7 | Sin licencia, licencia de prueba, vencida/alterada, reloj y sin internet | PENDIENTE | — | — | Sin claves reales |
| PC-19 | Windows 11 limpio | 3.7 | Sin licencia, licencia de prueba, vencida/alterada, reloj y sin internet | PENDIENTE | — | — | Sin claves reales |
| PC-22 | Windows 10 limpio | 3.8 | Respaldo, tarea programada y restauracion desechable | PENDIENTE | — | — | |
| PC-22 | Windows 11 limpio | 3.8 | Respaldo, tarea programada y restauracion desechable | PENDIENTE | — | — | |
| PC-18 | Windows 10 limpio | 3.9 | Actualizacion N a N+1 y rollback con datos intactos | PENDIENTE | — | — | Requiere dos instaladores |
| PC-18 | Windows 11 limpio | 3.9 | Actualizacion N a N+1 y rollback con datos intactos | PENDIENTE | — | — | Requiere dos instaladores |
| PC-18 | Windows 10 limpio | 3.10 | Desinstalar conservando datos, reinstalar y borrar datos con confirmacion | PENDIENTE | — | — | Solo VM desechable |
| PC-18 | Windows 11 limpio | 3.10 | Desinstalar conservando datos, reinstalar y borrar datos con confirmacion | PENDIENTE | — | — | Solo VM desechable |
| PC-22 | Windows 10 limpio | 3.11 | Usuario, venta, licencia y tarea persisten tras reinicio | PENDIENTE | — | — | |
| PC-22 | Windows 11 limpio | 3.11 | Usuario, venta, licencia y tarea persisten tras reinicio | PENDIENTE | — | — | |
| PC-17 | Documental | Firma | Registrar certificado requerido, proveedor evaluado y ausencia de firma actual | PENDIENTE | — | — | No comprar ni usar credenciales desde esta tarea |

## Capturas minimas por sistema operativo

- Windows y compilacion.
- Estado limpio antes de instalar: servicios y puertos vacios.
- Instalador y aviso de SmartScreen por instalador sin firma, si aparece.
- Servicios y puertos del producto.
- Creacion de empresa y primera entrada.
- Venta de prueba y ticket.
- Gaveta, solo si existe hardware real.
- Coexistencia de tienda y producto.
- Estado posterior al reinicio.
- Desinstalacion y comprobacion de residuos.

## Cierre

No concluir PC-18 ni PC-22 con una sola version de Windows. No concluir PC-16 sin impresora y gaveta reales. La prueba de licencia no convierte PC-19 en vendible si aun faltan emisor, rotacion de claves o atadura final.
