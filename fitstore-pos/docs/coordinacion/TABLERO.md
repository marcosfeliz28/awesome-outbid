# Tablero de coordinación: nube ↔ PC

Dos sesiones de Claude trabajan sobre la rama `claude/facturacion-app-architecture-a3bz90`:

- **NUBE:** sesión "Arquitectura aplicación facturación multiproducto". Coordina y tiene 2 agentes a la vez.
- **PC:** sesión "FitStore POS entorno validación", en Windows, con unos 4 agentes a la vez.

La nube puede escribirle a la PC con mensajes de sesión. La PC le responde a la nube **en este archivo**, y la nube lo lee en cada revisión periódica, más o menos cada hora. Antes de cada `push`, hay que hacer `git pull --rebase`.

## Reglas

1. **Nadie edita archivos que el otro tiene asignados** (tabla de abajo). Las pruebas nuevas van al final de `tests/api.test.ts` y de `tests/e2e/store.spec.ts`, cada una en un describe propio.
2. **Auditoría cruzada:** cuando un lado termina un trabajo, lo anota en «Listo para auditar» con el commit. El otro lo audita de forma adversarial, con agentes que intentan refutar cada hallazgo, y escribe sus hallazgos en `docs/coordinacion/auditoria-<quien>-<n>.md`. **Quien tiene asignado el archivo corrige**, con una prueba que falle antes.
3. **Datos del negocio:** no se suben el Excel real, los costos ni las fotos de clientes.
4. **Meta de la dueña:** vender rápido y controlar toda la mercancía (también desde el celular), con 4 cajas a la vez, cuadre de caja con su formato e impresión en la térmica de 80 mm. Lo fiscal lo maneja su contable.

## Asignación de archivos (actualizar al cambiar)

| Dueño | Archivos                                                                                                                                                                                              | Trabajo                                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| NUBE  | apps/api/src/admin.ts, cash.ts, sales.ts, reports.ts (salvo zona horaria), packages/shared, apps/web/src/POS.tsx, Management.tsx, helpers.tsx, Dashboard.tsx, App.tsx (atajos), styles.css (impresos) | Cuadre, reportes, factura, contraentrega, impresión y 4 cajas (`docs/tienda/CUADRE_REPORTES_FACTURA.md`) |
| NUBE  | apps/api/src/inventory.ts, merchandise.ts, catalog.ts, apps/web/src/Merchandise.tsx, Purchases.tsx                                                                                                    | Brechas de mercancía 04, 35, 36 y 37 (`docs/validacion/aceptacion-caja-brechas.json`)                    |
| PC    | auth.ts y security.ts (sólo zona horaria), reports.ts:~130 (zona horaria), tests/api.test.ts:9 y runImport, scripts/*.mjs, .gitattributes, la barra superior y las fuentes, rutas de capturas e2e     | Windows y zona horaria (37 riesgos de la revisión local)                                                 |

## Listo para auditar

| Commit  | Lado | Qué                                                                                    | Auditado por   | Resultado |
| ------- | ---- | -------------------------------------------------------------------------------------- | -------------- | --------- |
| 6083548 | NUBE | Ronda 9: 43 hallazgos corregidos (`docs/validacion/ronda9-correcciones-revision.json`) | PC (pendiente) |           |

## Mensajes de la PC para la nube

(La PC escribe aquí lo que necesita que la nube sepa o haga: fecha, hora y texto.)
