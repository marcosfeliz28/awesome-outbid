# Auditoría de calidad del código · 9-nov-2026

**Commit auditado:** `b249c6e4` (`origin/nexora-cloud`).  
**Ámbito:** `apps/api/src`, `apps/web/src` y `packages/shared`.  
**Método:** lectura estática, inventario de rutas y pruebas, conteos reproducibles
con `wc`/`rg`, y ejecución del conjunto al cerrar la rama. No se usaron datos de
producción ni se modificó lógica de dinero.

## Resumen

La cobertura funcional del dinero es amplia y existen pruebas de integración
para ventas, devoluciones, caja, crédito, conciliación y reportes. El riesgo
principal ya no es “no hay pruebas”, sino que el núcleo es demasiado grande,
varias reglas se repiten y `pnpm check` no comprueba los tipos de `tests/`.
También quedan deuda de internacionalización, paginación y semántica accesible.

## Hallazgos

### Alta

| ID | Archivo:línea | Hallazgo y riesgo | Arreglo propuesto |
|---|---|---|---|
| CAL-01 | `apps/api/src/sales.ts:592-612`; `apps/web/src/POS.tsx:117-145`; `apps/web/src/pendingSales.ts:13-44` | La fórmula de promociones vive tres veces. API y cola bloquean promociones por lote; el POS no contiene ese guard. Una futura edición puede mostrar un total y cobrar otro. Es dinero: **no se corrige en esta rama**. | Mover alcance y fórmula a `packages/shared`, con Decimal y una tabla de casos ejecutada contra API, POS y cola offline antes de retirar copias. |
| CAL-02 | `apps/api/src/sales.ts` (5,162 líneas), `apps/web/src/Management.tsx` (4,767), `apps/web/src/POS.tsx` (3,004), `apps/api/src/reports.ts` (2,351) | Archivos con muchas responsabilidades aumentan conflictos y hacen difícil demostrar que un cambio es local. `sales.ts` mezcla ventas, pagos, anulaciones, devoluciones, crédito, PDF y conciliación. | Extraer por casos de uso detrás de interfaces, un módulo por vez y con pruebas de caracterización; no hacer una reescritura total. |
| CAL-03 | `vitest.config.ts:8-120`; `vitest.integration.config.ts:5-55`; `apps/api/tsconfig.json:11`; `apps/web/tsconfig.json:10` | Las pruebas se incluyen a mano y no forman parte de los `tsconfig` de API/web. Un spec nuevo puede no correr si no se agrega a la lista, y errores TypeScript de pruebas no bloquean `pnpm check`. | Añadir una comprobación que compare `tests/**/*.test.ts(x)` con ambas listas y un `tsconfig.tests.json` gradual. Corregir errores existentes antes de volverlo obligatorio. |
| CAL-04 | `apps/api/src/common.ts:833-849` | En un 500 se captura de forma saneada, pero también se ejecuta `console.error(exception)` crudo. Errores del ORM pueden incluir argumentos o datos del cliente en logs. | Registrar un objeto saneado (tipo, código, ruta, correlación) y conservar el stack solo en el sistema de monitoreo con su filtro de datos. Prueba con un error que contenga PII ficticia. |

### Media

| ID | Archivo:línea | Hallazgo y riesgo | Arreglo propuesto |
|---|---|---|---|
| CAL-05 | `apps/api/src/gv.ts:184-229,968-995`; `apps/web/src/Gv.tsx:1047-1112` | Cursos con todas sus inscripciones/pagos y transferencias pendientes se cargan sin `take`, cursor ni límite. El servidor y el navegador crecen linealmente y la pantalla renderiza toda la lista. | Cursor y límite (50–100), búsqueda/filtro del servidor, total separado y prueba con 10,000 filas. |
| CAL-06 | `apps/web/src/Gv.tsx:131-185` | Los botones se declaran `role="tab"`, pero todos quedan en el orden de tabulación y no implementan flechas, `aria-controls`, `id` ni `role="tabpanel"`. Lectores y teclado reciben una interfaz de pestañas incompleta. | Usar el primitivo `NxTabs` o implementar patrón WAI-ARIA: roving `tabIndex`, flechas/Home/End y asociación tab/panel. |
| CAL-07 | `apps/web/src/AiUsage.tsx:66-81` | Los estados “Cargando” y error no se anunciaban a tecnología asistiva. **Corregido de forma segura en esta rama** con componentes renderizables y regresión. | Mantener `role="status"` para carga y `role="alert"` para error; repetir el patrón en consultas asíncronas. |
| CAL-08 | `apps/web/src/AiUsage.tsx:67-81`; `apps/web/src/AssistantPanel.tsx:45-86`; ausencia de módulo i18n en `apps/web/src` | La interfaz está escrita directamente en español. La web comercial puede ser bilingüe, pero el producto no puede cambiar idioma sin editar componentes. | Catálogo por claves, formato de fecha/número por locale y revisión humana especial para dinero/fiscal. |
| CAL-09 | `apps/web/src/api.ts:324-355,389-390` | `api<T = any>` y `post<T = any>` permiten que cualquier respuesta llegue sin contrato. Además el filtro API devuelve `code`, pero la web crea el error solo con `message` y `status`, perdiendo `code`; algunos flujos terminan dependiendo de texto. | Tipo `ApiError {status, code, message}` y contratos de respuesta compartidos por ruta; migración gradual sin tocar reglas de negocio. |
| CAL-10 | `apps/api/src` (629 apariciones de `any`), `apps/web/src` (359), `packages/shared` (3) | El uso de `any` se concentra precisamente en límites API/ORM/UI. Cambios de forma pueden compilar y fallar en ejecución. | Activar `no-explicit-any` por carpeta nueva y reemplazar primero respuestas y JSON de dominio por `unknown` + Zod. |
| CAL-11 | `tests/api.test.ts` (12,464 líneas); `tests/e2e/store.spec.ts` (2,881) | Suites monolíticas comparten preparación y hacen costosa la repetición/diagnóstico. Un fallo tardío oculta más señal y dificulta correr un caso aislado. | Dividir por dominio con fixtures herméticas y base/namespaces propios; conservar los mismos escenarios y cifras. |
| CAL-12 | `tests/accessibility-contract.test.ts` y otros contratos que leen archivos como texto | Varias pruebas validan cadenas del fuente, no el comportamiento renderizado. Un renombrado inocuo falla y un componente inaccesible puede pasar si conserva la cadena. | Preferir `renderToStaticMarkup` para semántica y pruebas de navegador para foco/teclado. La nueva regresión de `AiUsage` renderiza el componente real. |

### Baja

| ID | Archivo:línea | Hallazgo y riesgo | Arreglo propuesto |
|---|---|---|---|
| CAL-13 | `README.md:1-5,34-50,89-113` | El README seguía llamando al producto FitStore, lo presentaba como demo no publicada y mezclaba rondas históricas con la guía actual. Confunde instalación y soporte. **Corregido en esta rama** sin tocar datos ni lógica. | Mantener una introducción Norexos vigente y mover historia de rondas a documentos históricos. |
| CAL-14 | `apps/web/src/styles.css` (6,776 líneas) | Una hoja global de este tamaño facilita colisiones de selectores y CSS no usado; también encarece revisar contraste por pantalla. | Dividir por pantalla/componente conservando tokens y añadir una comprobación de selectores huérfanos como aviso, no bloqueo inicial. |
| CAL-15 | `apps/web/src/Gv.tsx:1055-1059` | El rechazo usa `window.prompt`; funciona con teclado, pero no ofrece descripción persistente, contador, ayuda ni manejo consistente de errores. | Reutilizar un modal accesible con `<label>`, motivo requerido, foco inicial/retorno y `role="alert"`. |

## Pruebas faltantes o controles que faltan en rutas de dinero

No se encontró una ruta principal de venta/caja/devolución completamente sin
prueba de integración. Sí faltan controles sistemáticos:

1. **Matriz ruta→regresión obligatoria.** Los decoradores de dinero de
   `sales.ts:1528-5027`, `cash.ts:759-1543` y `reports.ts:304-1579` no se
   comparan automáticamente con los specs. Una ruta nueva puede quedar fuera.
2. **Contratos tipados de respuesta.** Las pruebas HTTP suelen tipar como `any`;
   un campo renombrado puede escapar si la aserción no lo toca.
3. **Prueba de paridad de promociones por comportamiento.** Existe deuda
   triplicada (CAL-01); la prueba debe ejecutar el mismo vector contra las tres
   implementaciones, no buscar texto.
4. **Carga/paginación en conciliación.** `GET /payments/pending-transfers` y
   `GET /gv/transfers/pending` necesitan prueba con miles de filas y cursor.
5. **Aislamiento por archivo/base.** Las suites grandes deben poder repetirse dos
   veces sobre una base limpia sin depender del orden previo.

## Arreglos seguros aplicados en esta rama

| Tema | Cambio | Regresión |
|---|---|---|
| Documentación | README actualizado a Norexos, estado fiscal exacto y guía corta vigente. | `tests/calidad-documentacion-9nov.test.ts` |
| Accesibilidad | Estados de carga/error del medidor de IA anunciables. | `tests/calidad-accesibilidad-9nov.test.tsx`, render real a HTML |

No se modificó venta, caja, devoluciones, reportes, precios, migraciones ni
datos. Las correcciones de alto riesgo quedan propuestas, no aplicadas.

