# C4 · Parche de Rust de PC-16: verificación · Claude PC · 26-oct-2026

**Resumen: no hay nada que aplicar.** El parche descrito en `PC16_PENDIENTES_RUST.md` (rama `claude-pc/windows-escritorio`) **ya está en `origin/producto-nexora` (`8ae06d8d`)**, en una versión más evolucionada. Esta PC no tiene Rust (`cargo`), así que **no se compiló ni se probó nada** y no se instaló nada; lo que sigue es lectura de código. Falta la compilación real, que debe hacerla ChatGPT PC o un ejecutor `windows-latest`.

| Punto del parche | Estado en `producto-nexora` | Dónde |
|---|---|---|
| `open_cash_drawer` recibe `reason: Option<String>` y lo pasa a `authorize_drawer` | **Cumplido** | `apps/web/src-tauri/src/main.rs:44,51,136` |
| La apertura manual manda el motivo; la automática no | **Cumplido** | `main.rs:146-148` (solo `if !automatic`); `desktopPrinter.ts:78,120` |
| Motivo de al menos 5 caracteres | **Parcial, y funciona** | Rust no lo valida (`main.rs:147` envía `reason.unwrap_or("")`); lo exigen la interfaz (`DesktopPrinterControls.tsx:73`) y la API (`cash.ts`, `z.string().trim().min(5).max(200)`, que responde 400). Más laxo que el parche, pero seguro |
| Cuerpo del pedido con `serde_json` | **Cumplido** | `main.rs:64,142-143,147,157`; `Cargo.toml:12` `serde_json = "1"` (Cargo.lock 1.0.154) y `reqwest = "0.13"` (Cargo.lock 0.13.5), coherentes |
| La respuesta se interpreta como JSON, no con `contains` | **Cumplido** | `main.rs:98-105` (`drawer_audit_id`: `serde_json::from_str`, exige `open==true` en la automática y un `auditId` UUID válido; falla cerrado) |
| Impresora fijada a la elegida | **Parcial, con salvedad** | `thermal.rs:164-168` solo exige que esté **instalada** en Windows; la selección guardada vive en `localStorage` (`desktopPrinter.ts:39`) y el Rust no la ve. Una ventana web comprometida podría elegir otra impresora instalada |
| Un solo pulso por venta, ventana de 2 minutos, caja abierta, ruta `automatic/sent` | **Cumplido** | `cash.ts` `automaticDrawerOpen` (`AUTO_DRAWER_WINDOW_MS`, `cashSession.closedAt: null`, mismo usuario y sucursal, pago en efectivo, bloqueo, máximo 2 intentos) y `automaticDrawerSent` |
| Reintento de 30 segundos | **No existe** | Lo que hay es el botón manual «Abrir gaveta otra vez» (`POS.tsx` ~2436); la API permite 2 intentos hasta que llega `sent` |

**Formas cliente-servidor (coinciden).** Argumentos de Tauri en `camelCase` desde JavaScript y `snake_case` en Rust (conversión normal de Tauri 2). Automática: la API responde `{auditId, open}` y Rust exige `open:true` más `auditId`; si ya está «enviado», responde `open:false` y no hay pulso. Manual: la API responde `{auditId}` sin `open` y Rust lo acepta (`main.rs:100`). `/sent`: Rust manda `{"auditId":...}` (`main.rs:64`) y la API espera `{auditId: uuid}`; el resultado se ignora (`let _`), así que un fallo ahí permite un segundo pulso (diseño documentado). Los errores de la API llegan a Rust como un fallo genérico: la cajera no ve el motivo concreto.

**Riesgos de compilación leídos (todos bajos).** Conversiones `&str`/`String` con `?` en `main.rs:109,114,121,128` compilan; `let Some(..) = .. else` (`:54`) pide Rust 1.65 o más (Tauri 2 ya lo exige); `authorize_drawer` no es un comando, así que no hay problema de tiempos de vida; `generate_handler!` (`main.rs:186-190`), `build.rs:215-219` y `capabilities/default.json` listan los mismos tres comandos (`list_printers`, `print_thermal`, `open_cash_drawer`). `option_env!("NEXORA_PRODUCT_URL")` es de compilación y `build.rs` hace `panic!` en la versión final si falta. **Riesgo real, no de código:** `reqwest 0.13` con las funciones por defecto arrastra TLS (rustls/aws-lc), que en Windows puede pedir `cmake` o NASM; si la compilación falla por eso, usar `reqwest = { version = "0.13", default-features = false, features = ["rustls"] }`.

## Quién debe compilar y probar
- **Esta PC no puede** (sin Rust ni permiso para instalar).
- **El CI no lo hace:** el trabajo `windows-installer` (`ci.yml`) corre en cualquier rama, pero ejecuta solo `vitest portabilidad` y `pnpm instalador:validar`; **no ejecuta `cargo build` ni `cargo test`**. Hay pruebas de Rust (`main.rs:161-182` y `thermal.rs:218-236`, esta última solo en Windows) que nadie corre.
- **Pasos para ChatGPT PC** (la laptop es suya para instalar): `git checkout origin/producto-nexora`; en `apps/web/src-tauri`: `cargo test --locked`, `cargo check --locked` (con `NEXORA_PRODUCT_URL` definido para la versión final); y una prueba manual con impresora real: venta en efectivo, pulso automático, `/sent` y apertura manual con un motivo de 5 o más caracteres.
- **Sugerencia:** añadir `cargo test --locked` al trabajo `windows-installer`, que ya corre en Windows.

No comprobé la lógica de `POS.tsx` que arma `drawerAuthorization` ni ejecuté ninguna prueba.
