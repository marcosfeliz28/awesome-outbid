# Plan maestro: todo lo que falta para vender Nexora (Claude, arquitecto · 24-oct-2026)

**Orden de la dueña (24-oct):** trabajar todo sin parar, sin esperar la auditoría de cada punto. Claude audita después.

**Fuentes que junta este plan:**
- `PLAN-10-MEJORAS-PRODUCTO.md` (la competencia de agentes);
- `ARQUITECTURA_NEXORA_PRODUCTO.md`;
- `ORDEN_FASE1_CHATGPT_PC.md`;
- `ORDEN_AJUSTES_GEMINI_CHATGPT_PC.md`;
- `ORDEN_FASE2_IA_SOPORTE_CHATGPT_NUBE.md`;
- `VEREDICTO_GEMINI_24OCT.md` y `VEREDICTO_GEMINI_2_24OCT.md`;
- `ORDEN_AUDITORIA_PRODUCTO_E_INSTALADOR_CHATGPT_NUBE.md`;
- `docs/propuestas/40-MEJORAS.md` (rama `nexora-chatgpt-pc-40mejoras`);
- `TASKS.md` y `docs/operacion/PENDIENTES-DUENA.md`.

**Si una orden anterior choca con este plan, manda este plan.**

## Reglas para los tres

1. **Ramas.**
   - ChatGPT PC trabaja en `producto-nexora`.
   - ChatGPT NUBE trabaja en `nexora-chatgpt-nube` (la auditoría) y en `nexora-chatgpt-nube-ia` (todo lo demás, creada desde `origin/producto-nexora`).
   - Claude trabaja en `nexora-cloud` (la tienda) y en `claude/*`.
2. **Un commit por punto,** con el número del punto en el mensaje (p. ej. `PC-04: …`). Cada punto lleva una prueba que falla antes y pasa después. `pnpm check` en verde antes de subir.
3. **No se espera la auditoría.** Al terminar un punto se sube y se sigue con el siguiente. Claude revisa cada hora y deja las correcciones arriba en `REVISION_NOCHE_CLAUDE.md`. **Antes de empezar cada punto, lee ese archivo** y arregla primero lo que Claude marque como «corregir». Si el CI de tu último commit sale rojo, arréglalo antes de seguir.
4. **Al terminar cada punto,** anota en `RESULTADOS_CHATGPT.md` una línea: punto, commit, prueba y estado del CI.
5. **Nunca:**
   - tocar Render, la base, las credenciales o el dominio de la tienda;
   - desplegar;
   - cobrar dinero real;
   - usar claves reales de IA en pruebas;
   - crear nada para dejar ventas fuera de la DGII.
6. **Reglas de dinero:**
   - el margen es (precio − costo) / precio, sin restar ITBIS, y nunca baja del 15 %;
   - una oferta nunca cambia el precio base;
   - la IA propone y una persona aprueba.
7. **Pausado por la dueña (no programar):** factura electrónica e-CF, nota de crédito fiscal B04 y conector para el proveedor de e-CF.

---

## Carril ChatGPT PC: el producto (`producto-nexora`)

### Fase 1: que un negocio nuevo entre, pruebe y pague solo (mejora 2)
- **PC-01** Registro público `/registro`:
  - datos del negocio, correo, contraseña, tipo de negocio y código de empresa;
  - verificación de correo antes de vender;
  - límite de intentos por IP;
  - **aceptación de términos y privacidad** (`docs/legal/producto/`) con fecha y versión guardadas.
- **PC-02** Asistente de arranque (se puede saltar y retomar), que se completa en **menos de 30 minutos** (prueba E2E cronometrada con 3 productos):
  1. nombre, logo y RNC;
  2. tipo de negocio y categorías sugeridas;
  3. módulos que usará;
  4. productos por Excel o leyendo una factura con IA;
  5. cajeras y primera caja;
  6. **ticket de prueba de 80 mm**.
- **PC-03** Estados del negocio:
  - `trial` (14 días) → `active` → `past_due` (7 días de gracia) → `suspended`, que es solo lectura: puede ver y exportar, no vender;
  - avisos 7 y 3 días antes;
  - nunca se borran datos.
- **PC-04** Cobro detrás de `BillingProvider`, con 2 proveedores:
  - uno de prueba;
  - **«transferencia verificada»**: el negocio sube su comprobante y Nexora lo aprueba con la conciliación que ya existe, sin duplicarla. Incluye un panel de Nexora para aprobar pagos de planes. Los datos de la cuenta de Nexora van en la configuración, nunca en el código.
- **PC-05** Límites por plan aplicados en la API: sucursales, cajas, usuarios y **equipos aprobados** (pasar del límite da 409 con un mensaje claro). Los planes son Autoservicio, Básico, Pro y Premium.
- **PC-06** Exportación completa por empresa (Excel y JSON), disponible en cualquier estado.
- **PC-07** Respaldo por empresa:
  - cifrado;
  - en un destino aislado por empresa, **nunca el Google Drive de la tienda**;
  - con restauración probada en una base desechable.
- **PC-08** Fotos y PDF (comprobantes de pago, facturas de proveedor) **fuera de PostgreSQL**, en un almacenamiento de objetos por empresa detrás de una interfaz. En pruebas se guardan en una carpeta local.
- **PC-09** Puerta de la fase 1:
  - E2E en que un negocio se registra, verifica, carga productos, abre caja y vende sin ayuda;
  - trial → suspended con solo lectura y exportación;
  - matriz de aislamiento en 0 fugas;
  - **3 negocios ficticios** trabajan un día completo en la PWA.

### Quitar lo de la tienda (mejora 3, parte rápida). Requisito para abrir el registro.
- **PC-10** Pasar a configuración por empresa todo lo que hoy es de Macgen:
  - nombre, logo, RNC, pie del ticket y cuentas de banco;
  - la pantalla de entrada, con su cubo y sus textos;
  - los nombres de los almacenes, que ahora se escriben libremente;
  - el README, que todavía dice «FitStore».

  Una búsqueda automática en la prueba falla si aparece «Macgen», «GV Makeup» o «FitStore» en pantallas, tickets o reportes del producto.

### Reportes para el contador (mejora 5). Sin emitir comprobantes.
- **PC-11** Gastos con NCF e ITBIS. En las entradas con comprobante, el NCF y el ITBIS pasan a ser obligatorios.
- **PC-12** Archivos **606, 607 y 608** en formato oficial de la DGII y hoja base del **IT-1**.
- **PC-13** Aviso cuando a una secuencia de NCF le quedan menos de 20 números o 15 días para vencer. Solo avisa.
- **PC-14** La lectura de facturas con IA también trae el **RNC, el NCF y el ITBIS** del suplidor, y llena el 606.

### Cada negocio a su medida (mejora 3, parte larga)
- **PC-15** Interruptores por empresa: lotes y vencimientos, contraentrega, incentivos, tasa del dólar y mensajero. Lo apagado desaparece de pantallas, tickets y reportes.

### Fase 3: instalador vendible
- **PC-16** App de escritorio Tauri (`apps/web/src-tauri`) conectada a la nube del producto, que imprime directo y sin preguntar en la térmica de 80 mm y abre la gaveta.
- **PC-17** Instalador firmado y **actualización automática**. Deja escrito qué certificado de firma hace falta; lo compra la dueña.
- **PC-18** Versión local (NSIS, servidor en la PC):
  - actualizador con respaldo previo, migración y vuelta atrás si falla.
- **PC-19** Licencia Ed25519:
  - se renueva cada 7 días contra la nube;
  - bloquea si se atrasa el reloj;
  - pasa a solo lectura si no paga;
  - la cola sin internet respeta la fecha de vencimiento.
- **PC-20** La versión local sube el respaldo diario fuera de la PC (nube de Nexora o disco externo) y muestra una **alerta roja si pasan 48 horas sin respaldo**.
- **PC-21** La versión local usa la IA a través de un intermediario en la nube, con licencia y cuota, **sin claves dentro de la PC**. El soporte llega por un túnel de salida que se enciende solo cuando el negocio activa «Soporte por 24 h».
- **PC-22** Pruebas en Windows 10 y 11 limpios. Documento «Listo para vender» con lo probado.

### Después (fase 5, no empezar aún)
- Sin internet completo en la laptop con sincronización.
- Apps de celular.

---

## Carril ChatGPT NUBE: la IA y el soporte (`nexora-chatgpt-nube-ia`)

- **N-00** Entregar la auditoría pedida: 20 mejoras y qué falta para el instalador vendible. Va en `docs/coordinacion/PROPUESTA_PRODUCTO_CHATGPT_NUBE.md`, rama `nexora-chatgpt-nube`. Sin código.

### Fase 2: «Pregúntele a Nexora» y soporte (mejora 6). Detalle en `ORDEN_FASE2_IA_SOPORTE_CHATGPT_NUBE.md`
- **N-01** Bloque A, `POST /api/assistant/ask`, con estas reglas:
  - **10 herramientas** cerradas que llaman a rutas GET que ya existen con el token del usuario;
  - **defensas** contra instrucciones escondidas en los datos;
  - **límites:** 500 caracteres, 31 días y 5 por minuto;
  - sin clave, responde 503.
- **N-02** Bloque B: cuota mensual por plan y bitácora sin guardar el texto.
- **N-03** Bloque C: pantalla con botón flotante, contador y ejemplos; accesible y a 320 px.
- **N-04** Bloque D: pedir una anulación solo con el «Sí» del usuario.
- **N-05** Bloque E, acceso de soporte de solo lectura:
  - rol `support`;
  - interruptor de 24 h o 7 días;
  - bitácora visible para el negocio;
  - guardia que solo deja pasar GET y `SET TRANSACTION READ ONLY`.
- **N-06** Puerta:
  - matriz de aislamiento en 0 fugas;
  - recorrido en que `support` recibe 403 en toda escritura;
  - **costo medido con 20 preguntas** y anotado en el informe.

### Más IA que vende (mejora 10 y propuestas de Gemini). La IA propone y una persona aprueba.
- **N-07** Resumen diario con IA por correo para el dueño (mejora 10). Queda listo y apagado hasta que exista `RESEND_API_KEY`.
- **N-08** Revisar transferencias desde la foto del comprobante:
  - lee banco, fecha, referencia y monto;
  - **avisa si la referencia ya se usó** o es falsa (p. ej. «1111»);
  - propone verificar o rechazar.
- **N-09** Ayudante antes del cierre: explica en 3 líneas por qué no cuadra la caja y propone la nota.
- **N-10** Recordatorios de cobro de crédito y contraentrega, con el mensaje y el estado de cuenta listos para enviar.
- **N-11** Borrador de orden de compra a partir de lo que se va a agotar, la venta de 30 días y lo que hay en otros almacenes.
- **N-12** Oferta para lotes por vencer: una promoción que **nunca deja el margen bajo el 15 %** y no cambia el precio base.

### Ayuda y canales
- **N-13** Centro de ayuda con guías cortas dentro del sistema y una página de estado del servicio.
- **N-14** WhatsApp, fase 0: documento con los requisitos de Meta (política de IA, proveedor tecnológico, verificación, número y coexistencia). **Sin código hasta que la dueña apruebe.**
- **N-15** Conector MCP con inicio de sesión OAuth para la IA del cliente y bandeja de «cambios propuestos» (mejora 7). **Empieza en solo lectura.** La IA propondrá conteos o entradas solo si la dueña cambia su regla del 19-oct.

---

## Carril Claude: la tienda y la arquitectura (`nexora-cloud`)

- **C-01** Auditar cada hora lo que suban PC y NUBE, mezclar lo aprobado y desplegar con los 3 CI en verde.
- **C-02** Cierre de caja de la tienda: A1, A2 y A3 de `ORDEN_AJUSTES_GEMINI_CHATGPT_PC.md`. **Pasa de ChatGPT PC a Claude** porque es dinero de la tienda en producción:
  - A1: la cajera cobra «efectivo ya de la dueña» con el PIN de gerente;
  - A2: ticket con esperado, contado y diferencia;
  - A3: aviso cuando se usa el PIN.
- **C-03** Número de lote del verifón al cerrar caja con ventas en tarjeta, con foto opcional.
- **C-04** Mejora 8: lectura de facturas con un modelo más barato, probada con 10 facturas reales.
- **C-05** Mejora 4: borradores legales (hechos, `docs/legal/producto/`) y avisos de licencias de terceros dentro de la app.
- **C-06** Las 10 primeras de las 40 mejoras de ChatGPT PC, para la tienda:
  1. QR de reseña;
  2. «No pude venderlo»;
  3. venta complementaria;
  4. precios por volumen con piso de margen;
  5. reposición y orden de compra en 1 clic (se une con N-11);
  6. conteo cíclico;
  7. vencimientos por lote (se une con N-12);
  8. panel diario de dinero en riesgo;
  9. recompra con consentimiento;
  10. rentabilidad de promociones.
- **C-07** Seguridad pendiente: puntos 1, 3, 4, 11, 16 y 17, y verificación en dos pasos para administradores (cuando la dueña decida).
- **C-08** Control de testers de maquillaje (cuando la dueña decida lo de la foto).
- **C-09** Terminales de tarjeta en el sistema (con la información de los verifones).
- **C-10** Medir cuánto ocupan las fotos dentro de la base de la tienda y decidir si se mueven.
- **C-11** Arreglar la prueba inestable del PDF largo («Página 2 de», `tests/credito-api.test.ts:359`).
- **C-12** Crear el sistema aparte en Render para el producto, con el permiso y el monto confirmados por la dueña.
- **C-13** Mantener al día la tabla de estado del `PLAN-10-MEJORAS-PRODUCTO.md`.

## Lo que le toca a la dueña

1. Hacer **privado** el repositorio en GitHub.
2. Autorizar el sistema aparte en Render. Son unos US$40–55 al mes; Claude confirma el monto antes.
3. Pedir a Azul o Cardnet la cuenta de comercio para cobros mensuales.
4. Pedir cotización a un abogado para los términos y la privacidad.
5. Mandar 10 facturas de suplidores distintos (foto o PDF).
6. Crear la cuenta en resend.com y pegar ella misma la clave en Render.
7. Decidir:
   - cuántas consultas de IA trae cada plan;
   - el nombre «Nexora» y su marca en ONAPI;
   - si la IA puede proponer cambios de inventario (N-15);
   - la foto de los testers (C-08);
   - la verificación en dos pasos (C-07).
8. Más adelante:
   - certificado de firma de código para el instalador (PC-17);
   - número nuevo de prueba y verificación en Meta (N-14);
   - con su contadora, la e-CF (pausada).
