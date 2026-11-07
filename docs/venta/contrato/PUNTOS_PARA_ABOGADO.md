Borrador generado por IA. Revisión por un abogado dominicano colegiado antes de firmar.

# Puntos que conviene que un abogado confirme

Lista corta para que la revisión sea rápida y barata. Cada punto remite a los documentos `01` a `05` de esta carpeta. El respaldo de cada ley está en `FUENTES_LEGALES.md`.

## Antes de nada: datos y decisiones de la dueña (no son de abogado)

1. Nombre legal de la proveedora, RNC, domicilio y si contrata como persona física o como sociedad (L479 art. 5: la sociedad tiene plena personalidad desde su matriculación en el Registro Mercantil).
2. Plan, precios, moneda y tipo de cambio, descuentos, instalación, módulos, piloto gratis: todo es propuesta pendiente (`docs/venta/PROPUESTA_PRECIOS.md`).
3. Que el correo `soporte@norexos.ai` y el dominio estén registrados antes de ponerlos en el contrato.

## Lo que más importa (revisar primero)

4. **Facturación fiscal.** El sistema no emite NCF ni e-CF y el contrato lo dice (cláusula 13). La Ley 32-23 hace obligatoria la factura electrónica y, según el aviso DGII 14-25, el último plazo para micro, pequeños y no clasificados venció el 15-may-2026. Confirmar: (a) que la dueña, como emisora de sus propias facturas a clientes, esté autorizada por la DGII; (b) que el contrato proteja bien a la proveedora cuando un cliente use Norexos como si fuera su facturador. Texto de los arts. 27 a 29 y 37 de la L32 y del Decreto 587-24: NO VERIFICADO.
5. **Tope de responsabilidad** (contrato cl. 17, acuerdo de encargado cl. 12): ¿es válido y oponible frente a dolo o falta grave? No se halló artículo leído que lo regule. El CC solo da los arts. 1147 a 1152.
6. **Resolución de pleno derecho y suspensión por falta de pago** (cl. 20 y 21): CC art. 1184 dice que la rescisión debe pedirse al juez. ¿Vale la cláusula resolutoria expresa y la suspensión del servicio sin acudir al tribunal?
7. **Recargo por mora** (cobro cl. 6): CC art. 1152 y 1153 y la «regla particular del comercio». ¿Qué tasa mensual es válida y exigible? Norma de intereses (Código Monetario y Financiero): NO VERIFICADO.
8. **¿Es consumidor el cliente?** La Ley 358-05 art. 3 d excluye a quien contrata para su actividad comercial, pero un cliente persona física muy pequeño podría alegarlo. Si se le aplicara, las cláusulas de límite de responsabilidad, cambio de precios y renovación automática serían atacables (arts. 82 y 83). ¿Hay que registrar el contrato en Pro Consumidor (art. 81)? Redactado en español, claro y con aceptación expresa por prudencia.

## Datos personales

9. **Roles** responsable (cliente) y encargada (proveedora), Ley 172-13 art. 6. ¿Basta el acuerdo `03` o se espera un contrato tipo? La ley no lo pide expresamente.
10. **Transferencias internacionales** (art. 80): Render en Virginia, Anthropic, Google Drive, Telegram. ¿Basta el consentimiento general del cliente o hay que informar a cada titular? Región y retención de cada subencargado: NO VERIFICADO.
11. **Obligaciones sin texto verificado:** aviso de brechas, inscripción ante un órgano de control, reglamento de la Ley 172-13. No se encontraron en la ley leída; ¿existen en otra norma?
12. **Plazos** que se fijan en el contrato (5 y 10 días hábiles de la ley; 2 días hábiles y 72 horas de brecha son compromisos de la proveedora) y los de salida (30 días de exportación, 60 de supresión).
13. **Ley 53-07 art. 56:** conservar 90 días datos de tráfico si se es «proveedor de servicios». ¿Aplica a un proveedor de software? Además hay proyectos de ley para sustituir la Ley 53-07; su vigencia al 31-oct-2026 no se pudo confirmar más allá de las fuentes leídas.

## IA

14. **IA de ventas «no guarda consultas».** Se afirma con base en el código de la rama `claude/ia-ventas-linea` (62720b17), no mezclada en `nexora-cloud` el 31-oct-2026. Confirmar con la dueña que lo desplegado coincide. Qué hace el proveedor de IA con la pregunta (retención, entrenamiento): NO VERIFICADO. ¿Hay que decirlo así al cliente?
15. Cláusulas de que la IA no sustituye al contador y de «tal como está»: ¿suficientes frente a un cliente que decida compras o impuestos con una respuesta errónea?

## Forma y prueba

16. Firma electrónica o aceptación en pantalla (Ley 126-02 arts. 4, 5, 6, 9, 10 y 13; el texto leído es de repositorio y está marcado «PROYECTO»; hay que confirmar con la Gaceta). ¿Alcanza para este contrato? ¿Conviene firma ante notario?
17. Jurisdicción (cl. 26): tribunal competente y si el contrato se trata como mercantil (CCom arts. 1 y 632). Código de Procedimiento Civil y reglas de competencia: NO VERIFICADO.
18. Licencia y propiedad intelectual: se cita la Ley 65-00 de derecho de autor solo como pendiente, no se leyó. Confirmar que protege el código y la marca «Norexos» (¿registrada ante ONAPI? NO VERIFICADO).

## Impuestos de la proveedora

19. Tasa del ITBIS: el texto publicado del CT art. 345 prevé 16 % desde 2015 sujeto a condición; el sistema usa 18 %. Que el contador lo confirme antes de poner precios con impuesto.
20. Retenciones de ITBIS e ISR cuando el cliente es agente de retención (norma general 02-05 y modificaciones): NO VERIFICADO.

## Contrato 06 (licencia de software instalado, 7-nov-2026)

21. **Licencia perpetua por equipo/sucursal y cuota anual opcional** (`06` cl. 2, 3 y 5): ¿se ajusta a la ley dominicana como licencia de uso y no como venta? Protección del programa, prohibición de ingeniería inversa y reventa: Ley 65-00, NO VERIFICADO. ¿Es válido limitar la copia de seguridad y la ingeniería inversa más allá de lo que la ley permita (cl. 8.3 y 8.4)?
22. **Dejar de pagar la cuota no bloquea el uso** (`06` cl. 3.5 y 17.3). ¿Puede la proveedora bloquear técnicamente una licencia perpetua ya pagada si hubiera clave de activación (cl. 9.2)? Hoy el instalador no la exige.
23. **Respaldos a cargo del cliente** (`06` cl. 7 y 18.2): ¿basta la cláusula para excluir la responsabilidad por pérdida de datos cuando no hay copia externa, y que el cliente firme haber leído la cl. 7 (Anexo A)?
24. **Acceso remoto de soporte** (`06` cl. 12): ¿la proveedora actúa como encargada solo durante la sesión? ¿Basta la autorización por sesión y el registro, o se necesita firmar `03` como anexo? El anexo de subencargados de `03` fue escrito para la nube. Plazo de conservación del registro de accesos: PENDIENTE.
25. **Transferencia a un proveedor de IA en el extranjero desde un equipo del cliente** (`06` cl. 13; L172 art. 80 y 28): ¿quién debe informar y obtener autorización de los titulares, el cliente o la proveedora? Retención y entrenamiento del proveedor: NO VERIFICADO. La IA de ventas aún no está integrada en `nexora-cloud` (auditoría 7-nov).
26. **Garantía de funcionamiento de 90 días y devolución del pago único** (`06` cl. 4.4 y 15.2): ¿es suficiente remedio exclusivo? ¿Rige el plazo si el cliente no instala en un equipo que cumpla los requisitos?
27. **Sin garantía de disponibilidad** (`06` cl. 15.1): ¿es válido frente a un cliente que pagó una licencia y dependa del software para cobrar? Revisar también el tope de 12 meses (cl. 18.1), que se calcula sobre lo pagado por licencia y cuota.
28. **Precios, cuota anual, soporte, horario y jurisdicción**: todos PENDIENTES. La «Propuesta de introducción 7-nov» que mencionó la orden no está todavía en `PROPUESTA_PRECIOS.md`. Los precios los decide la dueña.
29. **Venta o traspaso del negocio del cliente** (`06` cl. 3.4): la licencia es intransferible sin permiso. ¿Es válida y oponible esa restricción?
30. **Desinstalación y datos del cliente** (`06` cl. 17.4 y 7.6): al terminar, los datos quedan en el equipo del cliente. ¿La proveedora tiene algún deber de supresión o conservación? Aviso de brechas: NO VERIFICADO (ver punto 11).
