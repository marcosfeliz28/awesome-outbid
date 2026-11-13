# Respaldo de las guías locales (orden 124)

Cada paso se apoya en código (citas de la revisión de ChatGPT nube en `docs/coordinacion/RESULTADOS_CHATGPT_NUBE.md`; las de s1 paso 3 y s6 paso 1-2 se comprobaron además a mano).

| Guía | Paso | Respaldo |
| --- | ---: | --- |
| cajera-s1 | 1 | `apps/web/src/passwordChange.ts:6-13`, `:23-35`; `apps/web/src/App.tsx:548-564` |
| cajera-s1 | 2, 4 | `apps/web/src/Management.tsx:1753-1759`, `:1713-1751` |
| cajera-s1 | 3 | `apps/web/src/Management.tsx:2030-2068`; `apps/api/src/cash.ts:859-880` (nota, sin PIN) |
| cajera-s1 | 5 | `apps/api/src/common.ts:768`; `apps/web/src/realtime.tsx:515-565` |
| cajera-s2 | 1 | `apps/web/src/POS.tsx:960-976`, `:1022-1028` |
| cajera-s2 | 2-3 | `apps/web/src/POS.tsx:1031-1082`, `:1127-1289`, `:1361-1388` |
| cajera-s2 | 4 | `apps/web/src/POS.tsx:1106-1123`, `:1435-1549` |
| cajera-s2 | 5-6 | `apps/web/src/POS.tsx:1288-1311`, `:1073-1082` |
| cajera-s4 | 1-4 | `apps/web/src/Management.tsx:1695-1708`, `:2072-2105` |
| cajera-s4 | 5 | `apps/api/src/cash.ts:974-1033` |
| cajera-s4 | 6 | `apps/api/src/cash.ts:987-1003` (idempotente; sin comprobante: no hay respaldo) |
| cajera-s6 | 1-2 | `apps/web/src/Management.tsx:3372-3386`, `:3685-3715` |
| cajera-s6 | 3 | `apps/web/src/QuickQuestions.tsx:547-552` |
| cajera-s6 | 4 | `apps/web/src/Management.tsx:3412-3420`, `:3826-3887` |
| cajera-s6 | 5-6 | `apps/web/src/Management.tsx:3393-3409`, `:3670-3683` |
| cajera-s8 | 1-2 | `apps/web/src/App.tsx:1122-1147`; `apps/web/src/offlinePolicy.ts:3-12`; `apps/web/src/POS.tsx:2232-2260` |
| cajera-s8 | 3-4 | `apps/web/src/Management.tsx:1765-1924`; `apps/web/src/pendingSales.ts:190-197`, `:297-313` |
| cajera-s8 | 5 | `apps/web/src/POS.tsx:2254-2260` |
| cajera-s8 | 6 | `apps/web/src/cartDraftPolicy.ts:5-13`, `:29-38`; `apps/web/src/App.tsx:885-943`; `apps/web/src/pendingSales.ts:382-396` |

s3, s5 y s7 NO existen en `claude-pc/ayuda-local-12nov` ni en ninguna rama remota: `[FALTA DATO]`. No se inventaron; hay que generarlas primero (cola local con Ollama, no disponible en la nube).
