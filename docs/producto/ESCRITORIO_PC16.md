# PC-16 · Nexora POS de escritorio (fase cloud)

**24 de octubre de 2026. Producto aislado; no desplegado.**

La app Tauri abre la PWA del producto desde un **único origen HTTPS** fijado al compilar. Conserva el inicio de sesión y las cookies en ese origen. La función nativa lista las impresoras de Windows y envía el texto del ticket o cuadre como trabajo RAW ESC/POS, sin diálogo. En «Impresora térmica» se elige la impresora y se prueba un ticket no fiscal. La gaveta se abre al imprimir automáticamente una venta con efectivo o con el botón explícito «Abrir gaveta». Un documento que no sea un ticket térmico conserva el diálogo normal del navegador.

## Construcción en Windows

1. Tener Node 24, pnpm 11, Rust estable, WebView2 y herramientas C++ de Windows.
2. Ejecutar `pnpm install --frozen-lockfile` en la raíz.
3. Definir `NEXORA_PRODUCT_URL` con el **origen HTTPS real del producto**, por ejemplo `https://pos.ejemplo.invalid` solo en pruebas. No admite rutas, usuario, contraseña, HTTP ni fragmentos.
4. Ejecutar `pnpm producto:tauri:build`. El script genera configuración Tauri y una capacidad remota para **ese origen exacto**, compila la PWA y produce un NSIS **sin firma** bajo `apps/web/src-tauri/target/release/bundle/nsis/`.

El dominio de la tienda y sus datos no están en el paquete. Los archivos de configuración generados no se versionan. El origen se cambia con una compilación nueva, no por un campo editable que pueda redirigir las credenciales.

## Seguridad y alcance

- Tauri acepta llamadas nativas solo desde la página HTTPS configurada. Los comandos admiten únicamente nombres de impresoras enumeradas por Windows y tickets de hasta 64 KiB. Los datos del ticket se convierten a texto; códigos ESC/POS aportados por un cliente se reemplazan por `?`.
- La impresión usa código de página CP858 y comandos comunes de corte y pulso de gaveta. Debe probarse en la impresora térmica y gaveta concretas. La presentación del HTML se convierte a texto y podría requerir ajustes de columnas para algunos modelos.
- Si no hay impresora configurada, se muestra un error; no se reenvía un ticket a otra impresora. La versión del navegador conserva `window.print()`.
- Esta fase necesita internet para la PWA cloud. El servidor local, licencia, copia fuera de la PC, firma y actualizaciones pertenecen a PC-18 a PC-21.
- El CI compila con `https://pos.example.invalid` **solo como prueba** y no publica ese instalador. Falta compilar con el dominio aprobado y ensayar impresión, gaveta y sesión en Windows 10 y 11 limpios (PC-22).
