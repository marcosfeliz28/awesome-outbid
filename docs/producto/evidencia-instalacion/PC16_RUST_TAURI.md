# INST-1 / PC-16: Rust, Tauri y gaveta

Fecha: 2026-10-25 (America/La_Paz)

Base auditada: `origin/claude/cpc10-gaveta-dolar` en `c6bb896d`.
Instrucción contrastada: `docs/producto/PC16_PENDIENTES_RUST.md` de
`claude-pc/windows-escritorio` (`90002ab`).

## Diferencia encontrada y corregida

La base ya incluía el argumento `reason`, la serialización con `serde_json`, la
autorización diferenciada manual/automática y la confirmación del pulso automático
en `/api/cash-sessions/drawer-open/automatic/sent`.

Faltaba validar localmente el contrato vigente de `apps/api/src/cash.ts`: el motivo
manual debe recortarse y tener al menos cinco caracteres antes de llamar a la API.
Se extrajo la construcción del cuerpo a `drawer_reference` y se agregaron regresiones
para motivo ausente/corto, recorte, comillas escapadas y ausencia de motivo en la
apertura automática.

La auditoría adversaria detectó además que la respuesta de
`/drawer-open/automatic/sent` se descartaba. Si el pulso físico ocurría y fallaba
esa llamada, la API dejaba una autorización pendiente y una repetición podía dar un
segundo pulso. Se descartó una primera propuesta de marcador local porque no puede
hacer atómico un pulso físico y una escritura de disco. La solución final mantiene
el reintento deliberado de la API y exige que `/automatic/sent` responda con éxito:
si falla, el comando propaga un error explícito que aclara que la gaveta sí abrió y
que lo pendiente es la confirmación de bitácora. La respuesta ya no se descarta.

## Herramientas instaladas

```text
rustup 1.29.1
rustc 1.99.1 (58cf8f9c3 2026-10-13)
cargo 1.99.1 (5f94df478 2026-08-27)
stable-x86_64-pc-windows-msvc (default)
Visual Studio Build Tools 2022 17.14.42
MSVC 14.44.35207
tauri-cli 2.12.4
```

La primera ejecución de `cargo test` detectó correctamente que faltaba el linker
MSVC (`error: linker 'link.exe' not found`). Se instaló el workload oficial
`Microsoft.VisualStudio.Workload.VCTools` y se repitieron ambas comprobaciones desde
Visual Studio Developer PowerShell x64.

## Salida de `cargo test`

Comando:

```powershell
cargo test --manifest-path apps/web/src-tauri/Cargo.toml
```

Salida final:

```text
Finished `test` profile [unoptimized + debuginfo] target(s) in 5.80s
Running unittests src\main.rs

running 7 tests
test audit_tests::drawer_requires_a_real_reference_uuid ... ok
test audit_tests::automatic_drawer_does_not_send_a_reason ... ok
test thermal::tests::customer_text_cannot_inject_drawer_or_cut_commands ... ok
test audit_tests::manual_drawer_requires_and_escapes_a_trimmed_reason ... ok
test audit_tests::automatic_pulse_confirmation_is_not_ignored ... ok
test audit_tests::drawer_opens_only_with_a_confirmed_audit ... ok
test thermal::tests::rejects_invalid_width_and_oversized_ticket ... ok

test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## Salida de `cargo build`

Comando:

```powershell
cargo build --manifest-path apps/web/src-tauri/Cargo.toml
```

Salida final:

```text
Compiling nexora-pos-desktop v0.1.0 (...\apps\web\src-tauri)
Finished `dev` profile [unoptimized + debuginfo] target(s) in 7.52s
```

No se usaron servicios, credenciales ni datos de la tienda; tampoco se tocó Render
ni se realizó despliegue.
