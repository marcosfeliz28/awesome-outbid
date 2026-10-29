# Dominios externos en URLs literales (S4, tanda 3)

Borrador sin verificar. Fuente: `origin/producto-nexora` (`d6adc554`), rama `claude-pc/lote-local-tanda3`. Solo el **dominio** de cada URL `http(s)://` literal en apps/web/src y apps/api/src; nunca la ruta ni parámetros. Búsqueda `git grep -noE`; archivo:línea del primer uso. Sin secretos: no se copió nada más que el host.

| Dominio | Primer uso (archivo:línea) | Apariciones |
|---|---|---|
| `127.0.0.1` | `apps/api/src/assistant.ts:1311` | 1 |
| `192.168.x.x` | `apps/web/src/polyfills.ts:2` | 1 |
| `accounts.google.com` | `apps/api/src/drive-backup.ts:128` | 1 |
| `api.resend.com` | `apps/api/src/notifications.ts:70` | 3 |
| `api.telegram.org` | `apps/api/src/notifications.ts:47` | 1 |
| `ayuda.dgii.gov.do` | `apps/api/src/invoice.ts:367` | 1 |
| `dgii.gov.do` | `apps/api/src/invoice.ts:366` | 1 |
| `localhost` | `apps/api/src/drive-backup.ts:114` | 2 |
| `nexora-pos-web.onrender.com` | `apps/api/src/notifications.ts:89` | 1 |
| `oauth2.googleapis.com` | `apps/api/src/drive-backup.ts:129` | 2 |
| `open.er-api.com` | `apps/api/src/usd-rate.ts:11` | 1 |
| `wa.me` | `apps/web/src/Billing.tsx:63` | 4 |
| `www.googleapis.com` | `apps/api/src/drive-backup.ts:82` | 2 |
