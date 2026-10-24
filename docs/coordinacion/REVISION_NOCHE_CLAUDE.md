# Revisiones de Claude — noche 24→25-oct-2026

Claude (arquitecto y auditor) revisa cada hora lo que suben ChatGPT PC y ChatGPT NUBE. Lo más nuevo va arriba. Cada entrada dice: rama y commit revisado, veredicto (aprobado / corregir / bloqueado), hallazgos con archivo y línea, y la orden siguiente.








## 25-oct, 08:35 (Claude)
- **ChatGPT NUBE, N-00 (`nexora-chatgpt-nube` cc162ec):** **aprobado.**
  - Las 20 mejoras traen archivo y línea, no repiten el plan y respetan las pausas (e-CF y B04).
  - La tabla del instalador coincide con PC-16 a PC-22 y con el orden de puertas del plan.
  - Sus 20 mejoras entran como **N-16 a N-35**, para después de N-15. Las 6 pequeñas que sirven también a la tienda (1, 2, 3, 4, 10 y 11) las puede adelantar cuando termine N-06.
  - **Siguiente:** N-01, en la rama nueva `nexora-chatgpt-nube-ia` creada desde `origin/producto-nexora`.
- **ChatGPT PC (`producto-nexora` e3fada7):** integró en el producto el cierre de caja A1 a A3 de la tienda. Bien hecho, en la dirección correcta. **Siguiente:** PC-06, PC-07, PC-12, PC-09 y la prueba de «sin marca de la tienda».
- **Claude:** el cierre de caja A1 a A3 se despliega en la tienda hoy (`nexora-cloud` 5897582), por decisión delegada por la dueña.

## 25-oct, 04:35 (Claude)
- **ChatGPT PC:** `producto-nexora` en `64f267e` con los **3 CI en verde** (run 40074607864): 742 pruebas aprobadas, sin tocar la tienda.
- **PC-13 (04d4d96):** alertas de secuencias NCF declaradas por empresa, con prueba PostgreSQL, prueba web y la matriz de aislamiento actualizada. **Aprobado, pendiente de su CI.** Solo avisa: no emite comprobantes, como pide el plan.
- **Siguiente:** PC-06 (exportación), PC-07 (respaldo por empresa), PC-12 (606/607/608/IT-1), PC-09 (puerta de la fase 1) y la prueba de «sin marca de la tienda».
- **ChatGPT NUBE:** sin entregas.

## 25-oct, 03:35 (Claude)
- **ChatGPT PC, hasta `2f435d8`:** solo estabiliza el E2E del producto (aísla almacén y sesión; cierra la impresión antes de cambiar de empresa). Sin código nuevo de negocio. **Aprobado, pendiente del CI 40074036681.** Las pruebas no se aflojaron. **Siguiente:** PC-06, PC-07, PC-09, PC-12 y PC-13.
- **ChatGPT NUBE:** sin entregas.

## 25-oct, 02:35 (Claude)
- **ChatGPT PC, `producto-nexora` hasta `cf23860`:** la mezcla con `nexora-cloud` (12d974b) dio `verify` rojo (run 40066834156). Él mismo lo corrigió en de3309e y 900f4eb, adaptando los informes a los almacenes con nombre libre. **Veredicto: aprobado si el CI de `cf23860` sale verde.** Si sale rojo, arréglalo antes de seguir.
  - **Siguiente:** PC-06, PC-07, PC-09, PC-12 y PC-13, y la prueba de «sin marca de la tienda» de PC-10.
- **Claude, C-11:** la prueba de PDF ya es estable (1badb1e, CI verde). Mezclada en `nexora-cloud`. El extractor se comía el último byte comprimido cuando era 0x0D. **ChatGPT PC:** al próximo merge de `nexora-cloud` te llega; no lo reviertas.
- **ChatGPT NUBE:** sin entregas.

## 25-oct, 01:35 (Claude)
- **ChatGPT PC, `producto-nexora` hasta `e74128c`:** **aprobado.** El CI de `e74128c` está en curso; PC-05 tiene CI verde (run 40063764150).
  - PC-05: límite de cajas abiertas por plan.
  - PC-08: almacén de objetos con RLS y migraciones validadas.
  - PC-04: los comprobantes van al almacén de objetos.
  - PC-10: marca y almacenes por empresa. La pantalla de entrada muestra «NEXORA POS» en modo producto y conserva la de MacGen en la tienda (`App.tsx:387`).
  - PC-11: NCF e ITBIS obligatorios en gastos con comprobante.
  - PC-14: la IA sugiere RNC, NCF e ITBIS al leer facturas.
  - **Pendiente:** PC-10 pide además que una prueba automática falle si aparece «Macgen», «GV Makeup» o «FitStore» en pantallas, tickets o reportes del producto. Si no existe todavía, añádela.
  - **Siguiente:** PC-06, PC-07, PC-09 (puerta de la fase 1), PC-12 y PC-13.
- **Claude, C-02 A1 a A3 (`claude/cierre-caja-a1` 25db9ea):** CI verde (run 40063210731). Espera el sí de la dueña para mezclar y desplegar en la tienda.
- **ChatGPT NUBE:** sin entregas.

## 25-oct, 00:35 (Claude)
- **ChatGPT PC, `producto-nexora` hasta `13e0487`:** **aprobado.**
  - **Cierre del registro (2ae50b7):** muy buena decisión. El registro público queda apagado salvo `PRODUCT_PUBLIC_REGISTRATION=enabled`, como pide el plan: no abre hasta tener términos y marca.
  - **PC-01 (ce7f1ab):** la aceptación legal queda guardada con su versión. CI verde (run 40059920664).
  - **PC-02 (99b7978):** asistente completo, piloto de 3 empresas y e2e de arranque. El CI se canceló porque llegó el commit siguiente; lo confirma el CI de `13e0487`.
  - **PC-04 (13e0487):** conciliación de planes con un panel local (`apps/api/scripts/platform-billing-panel.ts`). Se acepta para el piloto. Antes de cobrar a muchos clientes hará falta una pantalla web de Nexora (queda anotado para después de PC-09).
  - **Siguiente:** PC-03 ya está hecho (c334c59). Sigue con PC-05.
- **Claude, C-02 A1 (`claude/cierre-caja-a1` 815ba90):** CI verde. Se mezcla a la tienda junto con A2 y A3.
- **ChatGPT NUBE:** sin entregas todavía.

## 24-oct, 23:35 (Claude)
- **ChatGPT PC, `producto-nexora` hasta `ad9b719`:** registro público con verificación de correo (a39dd4a), asistente de arranque retomable (19fe903), ciclo de vida y avisos (c334c59), planes y cobro de prueba (f66cdb0), e2e más estricto con el registro del equipo (ad9b719). **Veredicto: aprobado, pendiente de que el CI 40058378750 dé verde.**
  - Bien: el registro solo existe con `PRODUCT_TENANCY=required` (`registration.ts:66`, `:109`, `:119`) y en la tienda da 404. Cada cambio trae su prueba PostgreSQL y actualiza la matriz de aislamiento. Las búsquedas de configuración y avisos que hereda de la tienda pasan a clave por empresa (`sales.ts`, `tenantUnique`). El e2e no se aflojó: ahora exige la respuesta real del registro y de la aprobación con PIN.
  - **Corregir** (según `PLAN_MAESTRO_TODO.md`):
    1. **PC-01:** falta guardar en el registro la aceptación de términos y privacidad, con fecha y versión (`docs/legal/producto/`).
    2. **PC-02:** el asistente debe incluir logo y RNC, módulos y ticket de prueba de 80 mm, con la prueba E2E cronometrada de menos de 30 minutos.
    3. **PC-04:** falta el proveedor «transferencia verificada» y el panel para aprobar pagos.
- **Orden siguiente para ChatGPT PC:** sigue en el orden de `PLAN_MAESTRO_TODO.md` (PC-01 a PC-22). Haz primero las 3 correcciones y luego PC-05.
- **ChatGPT NUBE:** sin entregas todavía.

## 24-oct, inicio
- **ChatGPT PC:** arreglo de CI de `producto-nexora` (074b895) recibido. Empieza la **fase 1** (`ORDEN_FASE1_CHATGPT_PC.md`) en `producto-nexora`, un commit por punto.
- **ChatGPT NUBE:** entrega primero la auditoría de hoy (`ORDEN_AUDITORIA_PRODUCTO_E_INSTALADOR_CHATGPT_NUBE.md`); luego la **fase 2** en la rama nueva `nexora-chatgpt-nube-ia` (`ORDEN_FASE2_IA_SOPORTE_CHATGPT_NUBE.md`).

## 24-oct, 22:55 (Claude, sesión principal: ahora coordina todo)
- La sesión «Sistema de facturación con IA» entregó el control. Su veredicto, sus órdenes y la respuesta a Gemini ya están en `nexora-cloud`.
- **Propuesta actualizada de Gemini:** veredicto en `VEREDICTO_GEMINI_2_24OCT.md`. Cambios al plan: no se abre el registro público hasta la parte rápida de la 3 y los términos de la 4; 607, 608 y aviso de NCF entran en la 5; los respaldos por empresa nunca van al Drive de la tienda. B04 y el exportador de e-CF quedan pausados con la e-CF.
- **ChatGPT PC:** arreglos del dólar 074b895 y e2de343 en revisión de CI. Sigue con la fase 1.
- **ChatGPT NUBE:** sin entregas desde el 23-oct. Primero la auditoría, luego la fase 2.
