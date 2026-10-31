# Dominio norexos.ai: DNS, correo y redirección

> Preparado el 2026-10-31 (orden 95, parte C). Sin credenciales. Todo valor que
> solo conoce el proveedor va como `<PENDIENTE: dato que da el proveedor>`; no
> se inventó ninguno. Nada de esto se ha aplicado ni desplegado.

## 1. Cómo se sirve hoy y qué se propone

- Hoy el POS corre en Render (`nexora-pos-web`, ver `render.yaml`) y
  `nexorapos.net` apunta a él con un CNAME en Cloudflare
  (`docs/piloto/LISTO_PARA_VENDER.md`, fila del dominio). No hay landing
  servida por separado en la rama `nexora-cloud`: `apps/landing/` vive en las
  ramas de la landing y aún no está integrada.
- Opción más simple: **sitio estático de Render** para la landing
  (`render-landing.propuesta.yaml`, en esta carpeta), con `norexos.ai` y
  `www.norexos.ai`. Sin cómputo, sin tocar API ni base.
- El POS pasaría a `app.norexos.ai` (dominio extra del servicio actual).
- Importante: hoy `nexorapos.net` **es** el POS. Redirigirlo a `norexos.ai`
  antes de mover el POS a `app.norexos.ai` dejaría sin acceso a las tiendas.
  Orden correcto en la sección 5.

## 2. Registros DNS (en el DNS de norexos.ai, p. ej. Cloudflare)

| Tipo             | Nombre | Valor                                                                                                                        | Notas                                                                              |
| ---------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A o CNAME (apex) | `@`    | `<PENDIENTE: dato que da Render al agregar norexos.ai al sitio estático>`                                                    | Render indica si pide A (IP) o CNAME; en Cloudflare el CNAME en el apex se aplana. |
| CNAME            | `www`  | `<PENDIENTE: nombre .onrender.com del sitio estático nexora-landing>`                                                        | Render redirige www al apex.                                                       |
| CNAME            | `app`  | `<PENDIENTE: nombre .onrender.com de nexora-pos-web (hoy nexora-pos-web.onrender.com según el repo; confirmar en el panel)>` | Solo cuando se agregue `app.norexos.ai` en Render.                                 |
| TXT              | `@`    | `<PENDIENTE: verificación de dominio si Render o el proveedor de correo la piden>`                                           | Una por proveedor.                                                                 |

Si el DNS está en Cloudflare, los registros que apuntan a Render deben estar en
«solo DNS» (nube gris) hasta que Render emita el certificado; después se puede
activar el proxy. Render exige que no haya registros AAAA o A sueltos que
apunten a otro lado para el mismo nombre.

## 3. Correo de soporte@norexos.ai

Proveedor de correo: `<PENDIENTE: decisión de la dueña; p. ej. un buzón alojado
o reenvío>`. Los valores salen de su panel.

| Tipo               | Nombre                             | Valor                                                                               |
| ------------------ | ---------------------------------- | ----------------------------------------------------------------------------------- |
| MX                 | `@`                                | `<PENDIENTE: servidores y prioridades que da el proveedor>`                         |
| TXT (SPF)          | `@`                                | `v=spf1 include:<PENDIENTE: dominio SPF del proveedor> ~all`                        |
| TXT o CNAME (DKIM) | `<PENDIENTE: selector>._domainkey` | `<PENDIENTE: clave pública o destino que genera el proveedor; la entrega la dueña>` |
| TXT (DMARC)        | `_dmarc`                           | `v=DMARC1; p=none; rua=mailto:soporte@norexos.ai; adkim=r; aspf=r`                  |

Reglas:

- **SPF**: un solo registro TXT que empiece por `v=spf1` en el apex. Si hay
  más de un servicio que envía, se juntan los `include:` en el mismo registro.
- **DKIM**: la genera el proveedor al activar el dominio. Hay que copiarla
  tal cual; no se escribe a mano ni se guarda ninguna clave privada.
- **DMARC**: se empieza con `p=none` (solo informes) durante unas dos semanas.
  Cuando SPF y DKIM pasen en los informes, subir a `p=quarantine` y luego a
  `p=reject`. Es una recomendación de arranque, no un dato del proveedor.
- Si Cloudflare tiene activo el reenvío de correo, el SPF y los MX los pone
  Cloudflare; no mezclar con otro proveedor.

## 4. Redirección 301 desde nexorapos.net

Opción A (recomendada, sin servicio nuevo): en Cloudflare, donde ya está el
DNS de `nexorapos.net`, una regla de redirección (Rules, Redirect Rules):

- Si el nombre de host es `nexorapos.net` o `www.nexorapos.net`.
- Entonces redirección dinámica a `concat("https://norexos.ai", http.request.uri.path)`,
  código **301**, conservando la cadena de consulta.
- Los registros DNS de `nexorapos.net` deben seguir existiendo y con proxy
  activo (nube naranja) para que la regla se ejecute.

Opción B: nginx propio con `deploy/redirect-nexorapos.nginx.conf` (ejemplo
listo, con `return 301 https://norexos.ai$request_uri;`). Necesita un servicio
donde correrlo; solo vale la pena si no se usa Cloudflare.

Una vez hecha, el CTA de la landing («Empezar prueba gratis») debe apuntar a
`https://app.norexos.ai`, no a `nexorapos.net`.

## 5. Orden de ejecución

1. La dueña registra `norexos.ai` y entrega acceso al DNS (sin pasar
   contraseñas en archivos o chats del repo).
2. Se integra `apps/landing/` en `nexora-cloud` y se adopta el bloque de
   `render-landing.propuesta.yaml` (más su prueba en `tests/cloud-deploy.test.ts`).
3. Agregar `norexos.ai` y `www.norexos.ai` al sitio estático en Render; poner
   los registros de la sección 2; esperar el certificado.
4. Agregar `app.norexos.ai` a `nexora-pos-web`, cambiar `WEB_ORIGIN` de la API
   a `https://app.norexos.ai` y `APP_PUBLIC_URL` en el mismo paso. Las tiendas
   reinstalan la PWA desde la dirección nueva (`docs/DEPLOY-RENDER.md`).
5. Correo: activar el dominio en el proveedor y poner MX, SPF, DKIM, DMARC.
6. Recién entonces activar la redirección 301 de `nexorapos.net`.

## 6. Verificación

Sustituir `<DKIM_SELECTOR>` por el selector real del proveedor.

```bash
# DNS
dig +short norexos.ai A
dig +short www.norexos.ai CNAME
dig +short app.norexos.ai CNAME

# Landing y certificado
curl -I https://norexos.ai
curl -I https://www.norexos.ai          # esperado: 301 hacia norexos.ai

# Redirección desde el dominio viejo (esperado: 301 y Location con la misma ruta)
curl -I "https://nexorapos.net/precios?x=1"
# Location: https://norexos.ai/precios?x=1

# Correo
dig +short MX norexos.ai
dig +short TXT norexos.ai | grep spf1
dig +short TXT <DKIM_SELECTOR>._domainkey.norexos.ai
dig +short TXT _dmarc.norexos.ai
```

Comprobación de extremo a extremo: enviar un correo desde soporte@norexos.ai a
un buzón externo, abrir «mostrar original» y confirmar `spf=pass`,
`dkim=pass` y `dmarc=pass` en las cabeceras `Authentication-Results`.

Nota: los comandos `curl` contra `nexorapos.net` los bloquea la guardia del
taller (producción); los corre la dueña o Nexora 1 desde su máquina.

## 7. Qué depende de la dueña

- Registrar `norexos.ai` y decidir dónde queda su DNS.
- Elegir el proveedor de correo para soporte@norexos.ai y entregar los valores
  de MX, SPF y **DKIM** que muestra su panel.
- Agregar los dominios en Render (Custom Domains) y confirmar los nombres
  `.onrender.com` y las IP que Render muestre.
- Aprobar el orden de la sección 5 (en especial mover el POS a
  `app.norexos.ai` antes de redirigir `nexorapos.net`).
- Crear la regla de redirección en Cloudflare (o decidir usar nginx).
