# Licencias de terceros y afirmaciones en documentos/UI — Nexora POS (BORRADOR)

Borrador técnico, no es asesoría legal. Licencias leídas de `package.json` en `node_modules` (la red no permitió `pnpm licenses list`, que falla por índice faltante). Clausura de dependencias de ejecución de apps/api, apps/web, packages/shared y packages/ui: 345 paquetes (aprox.; incluye algunos de compilación que el resolvedor arrastra).

## Parte A. Licencias

Resumen: MIT 274+, ISC 28, Apache-2.0 12, BSD-3 6, BlueOak 5, otros 14. No hay GPL/LGPL/AGPL efectivas en el árbol de ejecución.

| Componente | Licencia | Obligación | ¿Aviso presente? | Acción |
|---|---|---|---|---|
| **Inter** (`@fontsource-variable/inter` 5.3.0, archivos .woff2 en `dist/assets`) | SIL OFL 1.1 (© The Inter Project Authors) | Incluir copyright y texto de la licencia al redistribuir; no vender la fuente sola; nombre reservado | **Falta**. Los .woff2 se empaquetan sin LICENSE (`dist` no contiene archivo de licencias; el CSS referencia los archivos directamente) | Añadir al aviso de terceros y a la app (Ajustes > Acerca de) |
| **Plus Jakarta Sans** (`@fontsource-variable/plus-jakarta-sans` 5.3.0) | SIL OFL 1.1 (© The Plus Jakarta Sans Project Authors, Tokotype) | Igual | **Falta** | Igual |
| **lucide-react** 0.468.0 (íconos) | ISC; partes derivadas de Feather en MIT | Conservar aviso de copyright y permiso | **Falta** | Añadir aviso Lucide Contributors y Cole Bemis (Feather) |
| **swagger-ui-dist** 5.32.13 | Apache-2.0 | Conservar licencia y NOTICE | Falta si se empaqueta (Swagger apagado por defecto) | Incluir o excluir del paquete de producción |
| **dexie** 4.4.6, **rxjs** 7.8.2, **reflect-metadata**, **@prisma/client** 6.19.0, **@swc/helpers**, **@opentelemetry/api**, **web-vitals**, **crc-32**, **ecdsa-sig-formatter**, **readdir-glob** | Apache-2.0 | Entregar copia de la licencia y NOTICE si existe | **Falta** (el aviso del instalador solo cubre Node, PostgreSQL, WinSW, VC++, NSIS) | Añadir lista agregada con enlaces o texto |
| **React 19, react-dom, recharts, zustand, @tanstack/react-query, @radix-ui/react-dialog, @zxing/browser, workbox-window, pdfkit, exceljs, NestJS, helmet, zod, decimal.js, etc.** | MIT | Aviso de copyright y permiso en copias sustanciales (el JS empaquetado de `dist` no conserva comentarios de licencia: 0 coincidencias) | **Falta** | Generar `THIRD_PARTY_NOTICES` desde el lockfile |
| **d3-ease, bcryptjs, qs, ieee754, duplexer2, buffer-equal-constant-time** | BSD-3-Clause | Reproducir copyright, condiciones y descargo | **Falta** | Igual |
| **dotenv** | BSD-2-Clause | Igual | Falta | Igual |
| **glob, minimatch, minipass, path-scurry, lru-cache** | BlueOak-1.0.0 | Entregar el aviso de licencia | Falta | Igual |
| **tslib** | 0BSD | Ninguna | n/a | n/a |
| **fast-sha256, big-integer** | Unlicense | Ninguna | n/a | n/a |
| **@zxing/text-encoding** | Unlicense OR Apache-2.0 | Elegir Unlicense | n/a | Anotar la elección |
| **jszip 3.10.2** (vía exceljs) | MIT OR GPL-3.0-or-later (doble) | Elegir MIT | Falta | Declarar MIT |
| **pako 1.0.11** | MIT AND Zlib | Ambos avisos | Falta | Incluir |
| **argparse 2.0.1** | Python-2.0 (PSF) | Aviso | Falta | Incluir |
| **png-js**, **buffers** | Campo `license` vacío en package.json (NO VERIFICADO: repositorios indican MIT) | Confirmar | Falta | Revisar texto en el repositorio de origen |
| **sentry 0.45.0** (vía `@sentry/bundler-plugins`, herramienta de compilación) | **FSL-1.1-Apache-2.0** (fuente disponible, uso competidor restringido; se convierte a Apache a los 2 años) | Uso interno permitido; no ofrecer competencia a Sentry | n/a | Confirmar que no se distribuye en el instalador; anotar |
| **@sentry/react, @sentry/node** 11.4.0 | MIT (NO VERIFICADO el campo en el árbol; contenido muestreado) | Aviso | Falta | Incluir |
| **Node.js 24.21.0** (instalador) | MIT (el binario agrupa OpenSSL, ICU, V8 y otros) | Archivo LICENSE de Node completo | Aviso solo con enlace al LICENSE | Incluir el LICENSE de Node que viene en el zip |
| **PostgreSQL 18.6 (EDB)** | PostgreSQL License; el zip de EDB agrega componentes con otras licencias | Texto de licencia | Texto presente | Revisar licencias de componentes EDB |
| **WinSW 2.12.0** | MIT | Texto | Presente | Mantener |
| **VC++ Redistributable** | Términos de Microsoft | Redistribución permitida con el instalador | Enlace presente | Mantener |
| **NSIS** | zlib/libpng (solo compilación) | Ninguna | Mencionado | Mantener |

### Imágenes, íconos y marca

| Activo | Origen / licencia | Observación | Acción |
|---|---|---|---|
| `apps/web/public/icon.svg` y `instalador/assets/icon.svg` | Logotipo "N" propio (SVG trivial dibujado a mano) | Autoría propia no documentada | Anotar autoría en el repositorio |
| `instalador/assets/fitstore.ico` | Origen NO VERIFICADO; marca "FitStore" | El producto se llama Nexora; verificar que no sea un ícono de tercero | Confirmar origen; renombrar si procede |
| `apps/web/public/products/*.svg` (5 ilustraciones) | Gráficos SVG de código propio (gradientes y formas) | Autoría no documentada | Anotar que son originales |
| Capturas en `docs/*.png` | Capturas propias de la app | Contienen datos de demostración | Mantener |
| Nombres de marca "Nexora" / "FitStore" | Marca interna; el repositorio mezcla ambos nombres (README, instalador, THIRD_PARTY_NOTICES dicen FitStore) | Riesgo de confusión y de conflicto de marcas | Unificar y buscar anterioridad antes de comercializar |

### Brechas del aviso de terceros

> **G14 (resuelto):** `node scripts/licencias-web.mjs` genera `apps/web/public/licencias.txt` (lo que entra en el JS/CSS compilado, fuentes y service worker, con textos completos; contrastado con `pnpm licenses list --json --prod --filter @fitstore/web`) y completa `instalador/THIRD_PARTY_NOTICES.txt`. La app lo enlaza desde «Acerca de» (menú lateral). Origen del ícono y de las SVG: `ORIGEN_DE_ACTIVOS.md`. Los puntos 1 a 4 siguientes quedan como registro de lo que faltaba.

1. `instalador/THIRD_PARTY_NOTICES.txt` cubre solo cinco componentes binarios; ninguna librería npm ni las fuentes.
2. El instalador NSIS no muestra página de licencias (solo Bienvenida, Instalación, Fin) y la app web no enlaza el aviso (búsqueda sin resultados).
3. El aviso se copia a la carga del instalador (`build.ps1` línea 263) pero no se sirve en la PWA.
4. Propuesta: generar `THIRD_PARTY_NOTICES.txt` en la compilación (por ejemplo con `pnpm licenses list --prod --json` con red), incluir los textos OFL completos y mostrar un enlace "Licencias de terceros" en Ajustes.

## Parte B. Afirmaciones en documentos y UI

| # | Ubicación | Texto actual | ¿Respaldo en el código? | Acción | Texto sugerido |
|---|---|---|---|---|---|
| 1 | `README.md` línea 3 | "Aplicación de demostración de facturación e inventario…" | Sí, y no dice que sea fiscal | Mantener | Añadir: "Uso interno; no emite comprobantes fiscales." |
| 2 | `README.md` línea 5 | "No se ha publicado un servidor externo ni emitido un comprobante fiscal oficial." | Parcial: hay despliegue en Render preparado (`render.yaml`, "Prepare Nexora POS for secure cloud deployment") | Reescribir | "Esta versión no emite comprobantes fiscales (NCF/e-CF) válidos ante la DGII." |
| 3 | `apps/web/src/Management.tsx` ~2948 | "NCF/e-CF reservado para integración futura. Los recibos son internos." | Sí: el código guarda `ncfType`, no firma ni envía nada | Mantener | Sin cambio |
| 4 | `Management.tsx` ~2900 | "Preparar solicitud (sin emisión fiscal)" | Sí | Mantener | — |
| 5 | `POS.tsx` ~1764 | "Documento interno, no fiscal." | Sí | Mantener | — |
| 6 | `POS.tsx` ~1888 | opción "B01 · Crédito fiscal" | El nombre es el tipo oficial; el código no asigna NCF real | Mantener, con aclaración | "B01 · Crédito fiscal (solo solicitud)" |
| 7 | `POS.tsx` ~1902 | "Preparación de datos. El comprobante sigue siendo interno hasta su emisión fiscal." | Sí | Mantener | — |
| 8 | `Prints.tsx` 359 y `sales.ts` 1926 | "Solicitud NCF … · pendiente de emisión fiscal" | Sí; el ticket queda sin NCF válido | Mantener | — |
| 9 | `sales.ts` 1547 y 1898 | "Nota interna de crédito · no fiscal", "Documento interno — no fiscal" | Sí | Mantener | — |
| 10 | `Prints.tsx` ~308 | Campo "NCF:" con valor vacío si no hay | Muestra campo fiscal sin valor | Reescribir | Ocultar la fila cuando `ncf` esté vacío, o rotular "NCF (no emitido)" |
| 11 | `App.tsx` 295 | "Datos ficticios · comprobantes internos no fiscales" | Sí (solo si `VITE_SHOW_DEMO_CREDENTIALS`) | Mantener | — |
| 12 | `Management.tsx` 2870 y `docs/MANUAL.md` 112 | "Desactivado es lo más seguro" (ventas sin conexión) | Respaldado por diseño (sin reserva entre equipos) pero es absoluto | Reescribir | "Desactivado evita vender la misma última unidad desde dos equipos sin conexión." |
| 13 | `docs/MANUAL.md` 19 | "política segura" | Vago | Reescribir | Describir la política concreta |
| 14 | `docs/ENTREGA.md` línea 11 | "anulación auditada" | Hay registro de motivo/usuario/movimiento (`sales.ts` ~973); "auditada" no implica auditoría externa | Reescribir | "anulación con registro de usuario y motivo" |
| 15 | `docs/AUDITORIA_RONDA*.md`, `REVISION_CLAUDE*.md`, `INSTRUCCIONES_AUDITORIA_GEMINI_CLOUD.md` | "Auditoría" realizada por modelos de IA (ChatGPT, Gemini, Claude) | No son auditorías profesionales ni certificación | Reescribir título/portada | Rotular "Revisión automatizada con IA (no es una auditoría independiente)"; no citar como respaldo ante terceros |
| 16 | `docs/SENTRY-API.md` título "Monitoreo seguro de la API" | Saneado implementado (`sanitizeApiEvent`) pero "seguro" es absoluto; además no cubre la web (Sentry web siempre activo) | Reescribir | "Monitoreo de errores de la API con datos saneados" y añadir sección del Sentry web |
| 17 | `docs/DEPLOY-RENDER.md` ~100 | "El snippet de seguridad instala CSP, HSTS…" | Sí (`security-headers.conf`); el propio doc dice que las pruebas en Nginx real están pendientes | Mantener con matiz | Mantener la nota de pruebas pendientes |
| 18 | `docs/INSTALADOR.md` 34, 112 | "Guárdalos en un lugar seguro", "conexión directa segura" | Instrucción al usuario, no promesa | Mantener | — |
| 19 | `docs/INSTALADOR.md` 346 | "`pnpm lint`: sin errores" | Descripción de un criterio de calidad | Mantener | — |
| 20 | `docs/fiscal/REQUISITOS_FISCALES_RD.md` línea 3 | "no certifica que FitStore ya los implemente" y "No puede afirmarse…" | Sí, está bien acotado | Mantener | — |
| 21 | `docs/fiscal/REQUISITOS_FISCALES_RD.md` ~185 | "Hacer respaldos cifrados" | Es recomendación; el código no cifra el volcado (solo `--sse` de S3 si se activa) | Mantener con aclaración | "recomendado; el sistema aún no los cifra por su cuenta" |
| 22 | `docs/RESPALDO_CLOUD_RENDER.md` 58 | "aplicar cifrado y ciclo de vida" al bucket | Es una instrucción de configuración; la copia usa `--sse` | Mantener | — |
| 23 | `docs/ENTREGA.md` | Tabla de cobertura con "Interfaz de cambio de talla" pendiente, etc. | Reconoce pendientes | Mantener | — |
| 24 | `Merchandise.tsx` 1546 | "Las fotos y PDF se envían a Anthropic (Claude) para leer sus líneas." | Sí, acorde al código | Mantener y ampliar | "…a Anthropic (EE. UU.). No subas documentos con datos de clientes." |
| 25 | Manifest PWA / `index.html` | "Facturación e inventario para tu tienda" | "Facturación" puede leerse como facturación fiscal | Reescribir | "Caja e inventario para tu tienda" |
| 26 | `POS.tsx` 877-960 | "hasta el 100 %" (descuentos) | Es un límite numérico, no una afirmación | Mantener | — |
| 27 | Cualquier texto de "ITBIS 18% incluido/adicional" (`Management.tsx` ~2944) | Configuración mostrada | Refleja el parámetro; `docs/fiscal` advierte que no sustituye clasificación tributaria | Mantener | Añadir "según tu configuración" |

Palabras buscadas sin hallazgo en UI/plantillas de ticket: «garantizado», «cumple con», «sin errores» (solo `docs/INSTALADOR.md` 346), «a prueba de», «cifrado» (solo docs de respaldo), «certificado» (certificado TLS local del instalador, no fiscal; es correcto).

## Parte C. Texto sugerido (breve)

- **Aviso fiscal para README/Ajustes**: "Nexora POS es un sistema interno de caja e inventario. Sus recibos y notas son documentos internos y no sustituyen un comprobante fiscal (NCF/e-CF). La emisión fiscal debe hacerse con un mecanismo autorizado por la DGII."
- **Aviso en Entrada de mercancía (foto/PDF)**: "La imagen o el PDF se envía a Anthropic, proveedor de IA ubicado en EE. UU., solo para leer las líneas de la factura. No subas documentos que contengan datos personales de clientes."
- **Aviso de monitoreo (Ajustes > Acerca de)**: "La aplicación envía a Sentry (EE. UU.) informes de fallos con datos técnicos sin nombres, montos ni contenido de pantalla."

## No verificado

- Licencias exactas de `png-js`, `buffers`, `@sentry/*` y paquetes con campo vacío; texto completo de licencias de componentes agrupados en Node/EDB.
- Autoría original de `fitstore.ico` y de las ilustraciones SVG.
- Dependencias Rust de Tauri (no hay `Cargo.lock` revisado) y librerías nativas de Capacitor.
- Plantillas de ticket en `docs/mockups/index.html` y manuales no se revisaron línea por línea; la búsqueda fue por palabras clave.
