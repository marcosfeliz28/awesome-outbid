# Pendientes de la dueña (se actualiza a diario)

## Preguntar a Génesis (14-oct)
- **Chaleco con Brasier**: el sistema dice XS 1 y L 1 (SKU 1600 y 1599), pero la dueña no los encontró en la auditoría de fajas del 13/14-oct. Preguntar a Génesis si los tiene y cuántos. No se ajustó el sistema.

## Otros abiertos
- Cerrar la caja abierta de Marcos Félix (Computadora 75AA, 11-oct).
- Sarias Lumiere (grande 02, costo 1,850, venta 3,100; pequeño 03, costo 1,100, venta 1,850): falta la cantidad para crearlos en Casa.
- Maquillaje Amave: está en Casa como entrada temporal, pendiente de auditar.
- Capturas de transferencias de Yuberkis, Sinai y Mirael para anotar la referencia real (tras desplegar la corrección 3aa).
- Cinturilla corset 3XS: 2 unidades menos que el sistema (24 → 22), sin venta que las explique.

## Maquillaje: conteo de Lisbeth del 14-oct (aplicado)
- Se cargaron 782 unidades en la tienda (170 renglones). Precios y costos no se tocaron.
- **24 productos nuevos (códigos 1648 a 1671) con precio y costo en 0**: falta que la dueña dé precio y costo. Incluye el tubo blanco y negro (21 uds, por confirmar) y los tonos "por identificar".
- **Maybelline pendientes**: Vinyl Ink (8 entre 55, 50 y 30) y Matte Ink (10 entre 180, 340, 15 y 1 ilegible): falta la cantidad por tono. No se sumaron.
- **Sin cantidad (no se tocaron)**: L.A. Colors lápiz CAL561A Nude y CAL565A Pink; Alikka Glitter 712, 710, 226, 728.
- Amuse Teddy Highlighter pasó a 3 productos por tono (1669 Sugar, 1670 Lovely, 1671 Coco); el renglón combinado 1291 quedó en 0.
- Lista de lo que la dueña no mencionó: `docs/operacion/MAQUILLAJE-NO-MENCIONADOS-2026-10-14.csv` (184 productos, 1,193 uds).

## Falta para entrar en la noche (14-oct, guardado a pedido de la dueña)
Preguntar a Lisbeth precio y costo (hoy están en 0) de estos 21 productos de Maquillaje:
- 1648 Too Faced Better Than Sex Mascara (1)
- 1649 Ruby Rose Glow Whatever Blush Duo (1)
- 1650 Haus Labs by Lady Gaga Polvo compacto 6.5 g, tono por identificar (1)
- 1651 Totemica The 16 Nudes of Miami, paleta completa (1)
- 1652 Maybelline Super Stay 24H Full Coverage Foundation, tono por identificar (1)
- 1653 NYX Smoochy Matte Lip Balm Swipe Sesh (1)
- 1654 Beauty Creations Velvet Stay Lip Paint, tono pendiente (1)
- 1655 Anastasia Beverly Hills Lip Gloss nude rosado, tono pendiente (1)
- 1656 Models Own Sculpt & Glow Contour Palette Cheat Day CGP01 (1)
- 1657 Models Own Sculpt & Glow Contour Palette Tan to Deep 04 (1)
- 1658 Cosmético tubo blanco y negro, punta fina, por confirmar qué producto es (21)
- 1659 Beauty Creations Tease Me Lipstick Strings Attached (4)
- 1660 a 1667 Nabi Gold Eyeliner E06 (3), E09 (3), E04 (1), E05 (3), E08 (2), E17 (3), E11 (2), E10 (2)
- 1668 Bruna Tavares BT Velvet, tono pendiente (1)

Otros datos que faltan:
- Maybelline Super Stay Vinyl Ink: 8 unidades entre los tonos 55 Royal, 50 Wicked y 30 Unrivaled. Falta la cantidad por tono.
- Maybelline Super Stay Matte Ink: 10 unidades entre 180 Revolutionary, 340 Exhilarator, 15 Lover y 1 tono ilegible. Falta la cantidad por tono. (20 Pioneer, 118 Dancer y 112 ya están en el sistema con 1 cada uno; confirmar si son las 3 de la tercera línea.)
- L.A. Colors lápiz CAL561A Nude y CAL565A Pink: falta la cantidad.
- Alikka Glitter 712, 710, 226 y 728: falta la cantidad.
- La Roche-Posay Toleriane Double Repair Matte 100 ml: excluido por la dueña (2 en el sistema, sin tocar).
- Mota de Sarias (1672): costo RD$ 1, venta RD$ 200, 2 unidades en tienda (cargadas 14-oct).

## Cierre de Farianelis del 14-oct (tarjeta)
- El sistema tenía 3 ventas con tarjeta (FS-0000035 1,500; FS-0000038 2,600; FS-0000046 2,900 = 7,000). Ella declaró 12,400 del verifón: diferencia +5,400.
- Explicación dada por la dueña: el verifón tenía ventas de otros días sin cerrar. No es un error del sistema ni de las ventas de hoy. Autorizado por la dueña.
- Regla desde ahora: si el total de tarjeta de la cajera no coincide con el sistema, no cierra sola; hace falta el PIN de un gerente (la dueña autoriza). El verifón se cierra todos los días antes de cerrar la caja.
- Caja de Lizbeth Peguero (Computadora CCB5, abierta 14-oct 20:56) sigue abierta: debe cerrarse en su turno.

## Correo de cierres y anulaciones (14-oct)
- Hecho en el código: cada cierre de caja y cada solicitud de anulación manda un correo a **marcos.feliz@gmail.com** (con el cuadre y el enlace a Nexora POS). Ortografía confirmada por la dueña el 14-oct: «feliz», no «felix». El correo de la cuenta de Resend y `NOTIFY_EMAIL_TO` deben ser ese mismo.
- Falta una sola cosa para activarlo: crear una cuenta gratis en resend.com con su correo, crear una clave de API y ponerla en Render (servicio API) como `RESEND_API_KEY`, más `NOTIFY_EMAIL_TO` con ese mismo correo. La clave no se escribe en chats ni en el repositorio.
- Las cajeras ya no ven "Vale de caja" en el cierre (así no les pide PIN por error); las salidas de efectivo se registran como «Salida».

## Créditos cobrados en efectivo (15-oct, orden de la dueña)
- Cerrados por Claude en su caja administrativa, con el monto tomado de las fotos de WhatsApp (la dueña no sumó los billetes y pidió asumirlo correcto): FS-0000027 cielo 4,850; FS-0000028 marck gomez 2,300; FS-0000029 ROSMERY 3,900. Total 11,050. Caja cerrada, cuadre en 0.00, entregado a la dueña.
- Regla nueva (en CI, por desplegar): cualquier cajera puede ver y cerrar créditos/contraentregas **en efectivo**, de cualquier día y de cualquier vendedora; el dinero entra a **su** caja y lo entrega al cerrar. Tarjeta y transferencia de un crédito las sigue registrando la administración.
- Pendientes de crédito que quedan: FS-0000007, 008, 010, 011, 018 (Ginette Gómez 30,500), 025 (1,400 por verificar), 030 y 031.

## 15-oct-2026 · Conteo de maquillaje, fase 3 (Excel «Inventario 02 Cloud»)

Aplicado en Tienda: Soft Focus 200/250/350 → 4/2/4; Stay Golden 01 → 4; L.A. Girl GC983 Fawn → 15; fijador chico → 9 y grande → 5; Too Faced vainilla → 8; Full Wear 325 → 5, 330 → 4, 350 → 10. El resto de lo que existía ya coincidía.

**8 productos nuevos sin precio ni costo (1673–1680), por dar precio:** Huda Stick 110N (3) y 120B (1); Urban Decay Face Bond 28 (1) y 29 (1); Too Faced Super Coverage Light Beige (10), Cookie (3), Honey (3); L'Oréal Full Wear 455 Coffee (1). Los hermanos del Too Faced están a 2,450 de precio y 1,675 de costo.

**Sin tocar por estar por aclarar en la hoja:** True Match Warm 8 y Chaud 15 (el sistema tiene 22 en un solo producto); L.A. Girl HD Pro Conceal «tono sin identificar» 8; Airspun (ya hay 3); NARS M1.5 Vallauris (ya hay 1); Infallible Pro-Matte 104.4/104.5 (el sistema ya tiene 104.5 con 7).

**En el sistema y no en la hoja (no se tocaron):** Full Wear Concealer 435 (1), Pro-Matte 102 (1).

## 15-oct-2026 · Conteo de maquillaje, fase 4 (libreta de Lisbeth: bases, correctores, brochas y pinceles)

- Aplicado en Tienda: Huda Latte 3→1; Moira 275N 2→1, 325N 2→1, 350W 4→3, 375N 5→4, 400W 2→1; Urban Decay 28 1→2; Huda Stick 110N 3→4; Macrilan B134 6→5, A23 10→12. Los demás renglones ya coincidían.
- Productos nuevos sin precio ni costo (1683–1691): limpiador de brochas mediano (7), Macrilan B140 y A40, pinceles Riko 80018, Piccasso 722, Day Makeup 0118/0145/0146 y Ana Paula Marçal 06 (1 c/u, la hoja no traía cantidad).
- **Regla de la dueña:** NO se pone en cero lo que no aparece en la hoja. Solo se modifica lo anotado.
- **Cuando la dueña lo indique** (después de anotar todo y de cambiar precios): entregarle la lista de productos de Maquillaje que nadie mencionó ni modificó nunca, para que valide cuáles se quedan y cuáles se sacan.
- Dudas abiertas: sets de brochas (Génesis rojo 11 vs 32 en sistema, Génesis azul/GM5, auto maquillaje BS/verde, White Angel, set de 4, Brochas Doble 7, Brocha de contorno 4, brocha negra individual 1); sin cantidad: Soft Focus 350, Simply Bella 313, Morphe M158, Ana Paula 02, Fearless B2; Too Faced Natural Beige (¿Born This Way?); base e.l.f. Light/Medium (3).

## 15/16-oct-2026 · Pendientes de cuadre y orden de la dueña
- **PIN de gerente del cierre de caja:** lo tiene solo la dueña (Marcos Félix); las cajeras deben llamarla para cerrar con tarjeta distinta del verifón o con vale de caja. El PIN no se escribe en chats ni en documentos. Otros administradores (Genesis, claude) también pueden aprobar con su propio PIN.
- **Farianelis debe volver a hacer la factura de Alexander Liriano:** anuló la FS-0000055 (3,220, «cambiar el magnesio», aprobada 1:46 p. m.) y no digitó la venta nueva. El banco recibió 3,700 de «Alexander L» (total del cambio + 450 de envío, provincia). Mientras no la haga, esa transferencia queda sin factura.
- Cuadre de transferencias del 15-oct: Johanna (2,500) cuadra; Katherine 6,250 = 5,800 + 450 envío; Nancheiry 1,950 = 1,500 + 450 envío (las cajeras anotan el envío); Yurielis transfirió el 14 (falta ver el banco del 14).
- Sin factura: Leydy Marbe 5,100 (última transferencia que cayó en el Popular; puede ser posterior al cierre) → pendiente de identificar, cruzar si una cajera digita una venta de 5,100 o 4,650 + 450.
- Tarjeta sin factura: Lizbeth +600 y Farianelis +2,100 (verifón contra sistema).
- Regla: no se modifican facturas ni envíos por la dueña/Claude para «arreglar» cuadres; lo anotan las cajeras. Créditos y contraentregas (incl. Ginette) los rastrea la dueña.
- **Copia diaria de la base fuera de Render (pendiente de la dueña):** crear el drive/almacenamiento privado donde se guarde la copia diaria (laptop o drive). Plan en `docs/RESPALDO_CLOUD_RENDER.md`; no está activado.
