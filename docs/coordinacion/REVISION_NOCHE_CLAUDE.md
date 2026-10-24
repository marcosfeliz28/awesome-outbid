# Revisiones de Claude — noche 24→25-oct-2026

Claude (arquitecto y auditor) revisa cada hora lo que suben ChatGPT PC y ChatGPT NUBE. Lo más nuevo va arriba. Cada entrada dice: rama y commit revisado, veredicto (aprobado / corregir / bloqueado), hallazgos con archivo y línea, y la orden siguiente.




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
