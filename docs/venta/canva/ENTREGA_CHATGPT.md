# Entrega de mejora de materiales de venta

**Fecha:** 9 de noviembre de 2026

## Archivos

- Presentación editable: `docs/venta/canva/PRESENTACION_VENTAS.html`
- Presentación para enviar: `docs/venta/canva/PRESENTACION_VENTAS.pdf`
- Hoja A4 editable: `docs/venta/canva/HOJA_PRECIOS_A4.html`
- Hoja A4 para imprimir: `docs/venta/canva/HOJA_PRECIOS_A4.pdf`

No se editaron los diseños de Canva porque este entorno no tiene acceso autorizado a la cuenta de la dueña. Las maquetas HTML/PDF son la alternativa prevista por la orden y no se publicaron ni compartieron fuera del repositorio.

## Qué mejoré

1. Reduje cada lámina a una sola idea, con titular, explicación breve y una ilustración separada del texto.
2. Aumenté jerarquía, aire y tamaño tipográfico para lectura en celular.
3. Reorganicé todos los precios aprobados sin cambiar ninguna cifra.
4. Preparé la hoja A4 con 20 mm de margen inferior, filas alternas y contraste apto para impresión en blanco y negro.
5. Definí un kit de marca propio: azul profundo `#102A43`, azul funcional `#1F6FEB`, naranja `#F26B38`, verde `#13A88A`, fondo `#F7F9FC`; tipografía `Inter`, con `Segoe UI` y Arial como alternativas del sistema.
6. Sustituí fotos y logos por ilustraciones propias en CSS, para evitar licencias, datos reales y marcas de terceros.
7. Mantuve en forma visible: IA opcional y apagada hasta activación; Norexos no emite NCF/e-CF; contactos, razón social y tasa quedan por confirmar.

## Guion de las 6 láminas

1. **Tu negocio, en movimiento:** presenta el problema como falta de orden entre caja, inventario y reportes.
2. **Lo esencial para vender:** venta, inventario, créditos/abonos y operación en la laptop.
3. **Caja y cierre:** muestra el flujo de cierre ciego en tres pasos.
4. **Reportes e IA opcional:** separa reportes PDF de los servicios de IA que requieren contratación y activación.
5. **Precios de introducción:** presenta instalado, nube, IA y carga de inventario con todas las cifras aprobadas.
6. **Piloto de 60 días:** explica instalación, acompañamiento y decisión; deja los contactos como `[COMPLETAR]`.

## Autoauditoría

- Comparé cada precio con `CONTENIDO_VENTAS.json` y con «Propuesta de introducción 7-nov» de `PROPUESTA_PRECIOS.md`.
- No añadí disponibilidad inmediata, soporte en inglés, facturación fiscal, clientes, testimonios ni resultados prometidos.
- No utilicé fotos, logos, fuentes web ni otros materiales de terceros.
- El HTML usa texto real, estructura semántica y contraste de al menos 4.5:1 para el contenido normal. No requiere animación ni JavaScript.
- Revisé que la hoja A4 conserve margen inferior y que su modo monocromo no dependa del color para distinguir filas o conceptos.
- Pendiente de la dueña: WhatsApp, correo, razón social y tasa de conversión definitiva.

## Entrega técnica

- **Rama:** `chatgpt-nube/ventas-calidad`
- **SHA de la entrega gráfica:** `3836f41fe96919d13ee96542d6296576c052aa4d`
- **Pruebas locales:** PDF de presentación con 6 páginas de 960 × 540 pt; hoja de precios con 1 página A4; extracción de texto confirmó todos los precios, los 60 días y la advertencia NCF/e-CF; ambos HTML sin recursos HTTP externos; `git diff --check` pasó.
- **CI:** se comprobará en el último commit después del push (`verify`, `windows-installer`, `render-images`).
- **Límites:** falta una prueba física de impresión y una revisión en un teléfono real. No se desplegó, no se tocó Render, producción, credenciales ni la base de la tienda.
