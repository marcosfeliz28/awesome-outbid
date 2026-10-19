# Orden para Claude PC — revisar y probar los arreglos de la auditoría (19-oct-2026)

**Quién:** Claude PC (en la computadora de la dueña). **Qué:** segunda revisión, independiente, de los arreglos que Claude nube hizo a los 17 hallazgos de la auditoría de ChatGPT PC.

## Pasos
1. `git fetch origin` y usa la rama `claude/arreglos-auditoria-pc` (los arreglos) junto con `origin/nexora-chatgpt-auditoria:docs/auditoria-completa/` (los hallazgos).
2. Revisión adversarial: por cada hallazgo (Q-01, I-01, DIN-01, DIN-02, A2-01, D-01, D-02, N-01, N-02, W-01, Q-02, Q-03, Q-04, UI-01, INF-01, DOC-01, DOC-02) di si el arreglo lo cierra de verdad, si rompe algo y qué faltó. Busca también problemas nuevos parecidos que nadie vio.
3. Corre en la PC lo que la nube no puede: `pnpm check` completo (dos veces, para ver si el `EBUSY` de Windows volvió), las pruebas del instalador en PowerShell (`instalador/tests/*.ps1`) y, si es seguro y local, `pnpm verify` contra una base **local desechable** (nunca contra producción ni Render).
4. Si encuentras un fallo, arréglalo en la rama `claude-pc/revision-arreglos` (cambios mínimos, con prueba) y no despliegues: solo Claude nube despliega, con los 3 CI en verde.
5. Entrega: `docs/auditoria-completa/REVISION-CLAUDE-PC.md` con una tabla hallazgo → cerrado/parcial/abierto, comandos corridos con sus resultados exactos (aprobadas/fallidas/omitidas) y lo que no pudiste probar.

Reglas: no tocar datos de la tienda ni credenciales; responder a la dueña en español y corto.
