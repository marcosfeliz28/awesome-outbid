# Resultados de auditoría · landing norexos.net

Fecha: 6-nov-2026. Código auditado: `ebcb245` en
`claude-pc/landing-norexos-net`. Auditoría de solo lectura: no se modificó la
landing, no se desplegó y no se tocaron Render, DNS, dominio ni credenciales.

## Veredicto

**Aprobada con cuatro hallazgos medios y dos pendientes de publicación.** No se
encontraron precios inventados, referencias a DGII/e-CF, datos de terceros,
credenciales, peticiones externas, desbordes a 390/1366 px ni fallos de contraste
AA en los colores revisados.

## Hallazgos

1. **Medio · promesa sin medición:** «Vende en segundos» y «Sell in seconds»
   (`apps/landing/index.html:82`, `apps/landing/en/index.html:81`) son una promesa
   de velocidad sin prueba o métrica. Conviene medirla o sustituirla por una
   descripción objetiva antes de publicar.
2. **Medio · disponibilidad todavía no decidida:** «Empieza hoy; sin instalar
   nada» / «Start today; nothing to install» (`index.html:63`,
   `en/index.html:64`) se muestra mientras los planes dicen «Próximamente» y el
   destino `app.norexos.net` sigue marcado `DECIDE-DUEÑA`. Además, la propia FAQ
   explica que el modo sin internet puede requerir instalarlo en la PC
   (`index.html:147-150`, `en/index.html:145-148`). La dueña debe aprobar la
   disponibilidad y el texto final.
3. **Medio · capacidad por confirmar:** «escala a varias sucursales y bodegas» /
   «grows to several branches and warehouses» (`index.html:153-155`,
   `en/index.html:151-153`) es una afirmación comercial que no tiene una prueba
   de aceptación enlazada en la landing. Confirmarla contra el producto que se
   venderá o suavizarla.
4. **Medio · ES y EN no equivalentes:** español promete soporte en español,
   mientras inglés promete soporte en inglés (`index.html:165-170`,
   `en/index.html:163-168`). El soporte en inglés no está incluido en el
   marcador de decisión; requiere aprobación expresa o una traducción
   equivalente a la oferta real.
5. **Pendiente externo:** canonical, `hreflang`, `robots.txt`, sitemap y rutas
   internas son coherentes. La comprobación HTTP de `norexos.net` y
   `app.norexos.net` fue bloqueada por la red del entorno (`CONNECT tunnel
   failed, response 403`), por lo que existencia, redirecciones y certificados
   quedan **NO CONFIRMADOS**. El `mailto:` tampoco confirma que el buzón exista.
6. **Pendiente de seguridad al publicar:** el código estático no contiene
   scripts, formularios, secretos ni datos de producción. CSP, HSTS,
   `X-Content-Type-Options`, `Referrer-Policy` y permisos del hosting no pueden
   verificarse antes del despliegue; deben comprobarse en la respuesta HTTP.

## Ocho puntos revisados

- **Cifras y promesas:** sin precios, planes inventados, «gratis», DGII/e-CF ni
  promesa de más ventas. Hallazgos 1–3 arriba.
- **Marcadores de la dueña:** aprobado. `DECIDE-DUEÑA` está en ES y EN y cubre
  planes, precios, `soporte@norexos.net` y `app.norexos.net`
  (`index.html:127`, `en/index.html:125`).
- **Enlaces:** anclas internas, `en/`, `../`, canonical, `hreflang`, sitemap y
  robots aprobados en revisión local. Los destinos públicos quedan NO
  CONFIRMADOS por el bloqueo de red.
- **Todo estático:** aprobado. No hay JavaScript, formularios, CDN, fuentes ni
  imágenes de terceros. Playwright observó únicamente peticiones al servidor
  local de la landing.
- **Accesibilidad:** aprobado con los textos actuales. Orden de encabezados
  correcto; `lang` correcto; enlace para saltar al contenido es el primer foco;
  foco visible para enlaces y `summary`; controles de al menos 48 px; movimiento
  reducido respetado. Contraste mínimo calculado: 6.79:1 en claro y 6.99:1 en
  oscuro, superior a 4.5:1. El único gráfico, `icon.svg`, tiene título accesible.
- **Responsive:** aprobado por Playwright en ES y EN a 390 y 1366 px:
  `scrollWidth === clientWidth`, sin elementos recortados ni anclas rotas.
- **Español primero:** aprobado: `/` usa `es-DO` y `/en/` usa `en`. Hallazgo 4
  sobre la promesa distinta de soporte.
- **Seguridad-20:** aprobado en contenido: sin secretos, tokens, datos de
  Macgen/FitStore, datos de clientes ni llamadas a terceros. Quedan pendientes
  los encabezados y TLS del hosting.

## Decisiones de la dueña

1. Aprobar planes/precios y cuándo puede decirse «Empieza hoy».
2. Confirmar que `app.norexos.net` es el destino correcto y está disponible.
3. Confirmar que existe `soporte@norexos.net` y si habrá soporte en inglés.
4. Confirmar la promesa de varias sucursales/bodegas y decidir si se conserva
   «Vende en segundos».
5. Autorizar la publicación y la verificación posterior de TLS y encabezados.
