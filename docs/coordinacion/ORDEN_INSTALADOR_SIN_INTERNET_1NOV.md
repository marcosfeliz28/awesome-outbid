# Orden: verificar que el instalador de PC (sin internet) de Norexos funciona (1-nov-2026)

Pedido de la dueña: comprobar que el **instalador para PC, sin internet,** de la aplicación Norexos funciona, y que todo lo nuevo de hoy (reportes en PDF y Excel, GV, cursos en dólares/pesos, animaciones) también funcione **sin conexión**.

## Parte 1 — Auditoría estática (agente de la nube; sin Windows)
Lee `instalador/` (README, `build.ps1`, `installer/`, `runtime/`, `service/`, `dependencias.lock.json`, `tests/`), `docs/INSTALADOR.md`, `docs/INSTALADOR_B8.md`, `docs/instalacion/` y el trabajo `windows-installer` de `.github/workflows/ci.yml` (+ el último run). Entrega `docs/auditoria/INSTALADOR_SIN_INTERNET_1NOV.md` con:
1. **Qué necesita internet hoy** (cada caso con archivo:línea): CDN, fuentes web, actualizaciones, verificación de licencia, respaldo a Google Drive, IA, correo, SMS/WhatsApp, URL fija de Render, descargas en la instalación, `pnpm`/`npm` en tiempo de ejecución. Para cada uno: ¿bloquea o degrada?, ¿hay modo sin conexión?
2. **Qué trae empaquetado** (Node, PostgreSQL, dependencias, fuentes, migraciones) y si la base se crea y migra sin red.
3. **Qué pasa con lo nuevo de hoy sin internet:** reportes PDF/Excel (fuentes y gráficas locales), moneda USD/RD$ de GV (la tasa se escribe a mano, sin consultar servicios), animaciones (sin recursos remotos), mapa y guías.
4. **Plan de prueba en una PC Windows limpia sin red** (pasos exactos, qué capturas tomar, qué resultado esperar) para que ChatGPT PC o la dueña lo ejecuten.
5. Lo que NO pudiste comprobar sin Windows, dicho con claridad.
No cambies código; solo reporta y propón arreglos mínimos. Rama `claude-pc/instalador-sin-internet`.

## Parte 2 — Prueba real en Windows (ChatGPT PC o Claude PC en la laptop, con el «sí» de la dueña)
Con el plan de la parte 1: PC limpia (o VM), **sin red** (cable y Wi-Fi apagados): instalar, arrancar, crear el negocio de prueba («Prueba Instalador», correo `prueba@nexora.local`, contraseña inventada y PIN de 6 dígitos que la dueña escribe en privado), abrir cada pantalla (tildes y ñ correctas), vender, abrir/cerrar caja, sacar un reporte en PDF y en Excel, apagar y volver a abrir, y actualizar/desinstalar. Resultado y capturas en `docs/coordinacion/PRUEBA_INSTALADOR_27OCT.md` (y enlace desde `RESULTADOS_CHATGPT.md`). Antes de instalar, ver si queda algo de la instalación vieja y avisar. No instalar nada más.

## Reglas
Sin credenciales en archivos; no tocar Render ni la base de la tienda; no mezclar ni desplegar (espera la autorización de Norexos 1).
