# Referencia de API: encuesta de cajera

Base de la ruta: `/survey` (verificado en `apps/api/src/cashier-survey.ts`, `@Controller("survey")`).

| Método | Ruta | Función TypeScript | Qué hace |
|---|---|---|---|
| GET | `/survey/mine` | `mine(actor)` | DUDOSO: confirmar qué devuelve |
| POST | `/survey/mine` | `save(body, actor)` | Guarda la encuesta de la cajera (inferido del nombre) |
| GET | `/survey/summary` | `summary(actor)` | DUDOSO: confirmar qué resume |

Total de rutas: 3.

> Revisado por Claude PC. El modelo local había escrito la base como `/cashier-surveys`; corregido a `/survey` según el código.
