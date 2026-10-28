# Traspaso a DeepSeek web: qué sigue de la misión de la noche

No enviar a DeepSeek web nada de este repo hasta leer su respuesta de capacidades (`PREGUNTA_A_DEEPSEEK_WEB.md`). Nunca pegar claves, contraseñas, variables de entorno, tokens ni datos de clientes.

## Estado de la misión (`MISION_NOCHE_DEEPSEEK_28OCT.md`)

**Bloque 0 · Desbloqueo**
- 0.1 `verify` de `aab91c9a` en rojo (confirmado, orden 30). Falta el log del run 40623353697; no lo puede leer ni DeepSeek web ni Claude PC. Pendiente de Nexora 1 o de la dueña.
- 0.2 `App.tsx` y `styles.css` pasan a DeepSeek solo cuando la Fase 1 esté en `producto-nexora`. Hoy no lo está.

**Bloque 1 · Diseño (Fases 2 y 3)** · bloqueado por 0.2. No empezar.

**Bloque 2 · Producto vendible**
- D39/D40 (límites de planes): valores PROPUESTA en `docs/venta/precios.md`. Pendiente decisión de la dueña.
- D35–D38 (generadores 606, 607, 608 y validación de NCF): dinero y fiscal. Pendiente decisión de la dueña. No hacer por ahora.
- D21/D22 (formatos y validador RNC/cédula): subidos a `deepseek/d21` y `deepseek/d22`, sin LISTA. Falta que Llaves revise `packages/shared/src/format` y `validators`.
- D42 (pruebas de margen y redondeo): pendiente. Solo reportar fallos, no cambiar código.
- D41 (recorrido e2e de humo): pendiente. Sin contraseñas literales.
- Planes AT-06, facturación SaaS, migración de cliente, soporte y monitoreo: pendiente, son documentos.

**Bloque 3 · Marca, página pública y papeles**
- D31–D34 (landing): D31 y D32 sin cifras en `claude-pc/landing-sin-cifras` (033f8aa0). D34 en `deepseek/d34`, revisada y correcta.
- D10 y D33 (legales en borrador): subidos. Pendiente revisión humana con abogado.
- D7, D8, D12 (textos de la página), D24 y D25 (marca en el build): D25 subida; D7, D8 y D24 pendientes.

**Bloque 4 · Calidad, seguridad y rendimiento**
- D46 (benchmark): subido a `deepseek/d46`.
- Informes D15, D16, D17, D18, D19, D20, D43 en `docs/auditoria/`: D15, D17 y D18 subidos; D16, D19, D20 y D43 pendientes.
- Auditoría de las 17 ramas ya subidas: pendiente.
- D44 (`CONTRIBUTING.md` y `docs/DESARROLLO.md`): pendiente.

**Bloque 5 · Cierre:** `PROGRESO_DEEPSEEK_NOCHE.md` quedó vacío; hay que llenarlo al terminar.

## Lo que sí puede hacer DeepSeek web (si su respuesta lo confirma)
- Redactar documentos a partir de textos que le pegues: D7, D8, D24 (solo si se le pasa la lista), D16, D19, D20, D43, D44.
- Escribir funciones puras pequeñas con pruebas, solo cuando se le pegue el archivo afectado y su contrato. Nunca `App.tsx`, `styles.css`, dinero ni fiscal.

## Lo que no hace nadie sin decisión de la dueña
- Desplegar, tocar producción o Render.
- Mezclar en `producto-nexora` o `nexora-cloud`.
- Registrar la marca, contratar abogado, comprar dominio.
- Cualquier cambio en reglas de dinero, NCF o DGII.
