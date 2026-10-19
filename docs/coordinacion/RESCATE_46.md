# Rescate de 46 archivos locales

Fecha: 19 de octubre de 2026

Rama: `claude-pc/rescate-46`

Commit inicial del rescate: `643af0bd929489294aa578eccd60b85be768ebbb`

Referencia de comparación: `origin/nexora-cloud` (`8b6655ddca34584cf5b4af6b7aba21d1cc298327`)

Se preservaron y publicaron las 46 rutas locales en la rama indicada, sin mezclar nada en `nexora-cloud`. El escaneo de patrones de secretos no encontró claves evidentes; las coincidencias fueron nombres de campos y credenciales ficticias de pruebas. `git diff --cached --check` señaló espacios finales en dos documentos históricos; se conservaron intactos conforme a la orden de rescate.

## Ocho rutas pendientes de comparación

| Ruta local | Diferencia útil frente a `origin/nexora-cloud` | Decisión sugerida |
|---|---|---|
| `apps/api/src/alerts.ts` | La versión local es más antigua y simplificada. Cloud ya conserva alertas manuales, limita detalles sensibles por permiso y añade caché/invalidation y evaluación paginada/batch. | Ya superado; no trasplantar el archivo. |
| `apps/api/src/cash.ts` | La versión local precede a controles presentes en Cloud: consolidación de caja, exclusión de transferencias rechazadas, transferencia del sistema y PIN de gerente ante diferencia de tarjeta, además de nota por límite. | Ya superado; no trasplantar el archivo. |
| `apps/api/src/reports.ts` | Cloud incluye filtros/agrupaciones más recientes para ventas completadas/anuladas e informes de caja; el cambio local es un snapshot anterior. | Ya superado; no trasplantar el archivo. |
| `apps/web/src/Tienda.tsx` | La versión local tiene menos código. Cloud ya incorpora más flujo de caja ciega/cierre y manejo autenticado de comprobantes; no se identificó una función local pendiente que justifique reemplazarla. | Ya superado; revisar hunks concretos solo si aparece una necesidad nueva. |
| `docs/AUDITORIA_CLAUDE_2_CORRECCIONES.md` | Informe histórico local fechado 8-oct; su contexto/base no representa el estado actual de Cloud. | No usar como instrucciones actuales ni sobreescribir documentación de Cloud. |
| `docs/RONDA_NEXORA_CHATGPT.md` | Informe histórico local del 8-oct; contiene afirmaciones ligadas a una ronda/base anterior. | No usar como fuente vigente ni sobreescribir la versión de Cloud. |
| `tests/api.test.ts` | La versión de Cloud es más extensa y ya contiene regresiones posteriores, incluidas evidencia de pagos y controles de cuadre. | Ya superado; no reemplazar ni copiar el archivo completo. |
| `tests/claude-round2.test.ts` | La versión de Cloud es sustancialmente más extensa y usa regresiones/integración más completas que el snapshot local. | Ya superado; no reemplazar ni copiar el archivo completo. |

Conclusión: no se recomienda fusionar ninguno de estos ocho archivos completos ni aplicar trasplantes sin una necesidad concreta, un diff de hunks y pruebas dirigidas. Claude conserva la decisión final sobre cualquier cambio.

## Verificación

- Rama de rescate publicada en `origin/claude-pc/rescate-46`; el remoto confirmó el mismo SHA `643af0bd929489294aa578eccd60b85be768ebbb`.
- Los ocho archivos se compararon con `origin/nexora-cloud`, no con `main`.
- No se ejecutó la suite: esta entrega preserva cambios locales y documenta diferencias; no modifica la aplicación ni despliega.
- La limpieza del checkout y de artefactos locales se hará únicamente después de confirmar los destinos exactos y que son descartables.
