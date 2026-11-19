# Manual de 1 página — Norexos

Para el dueño o la cajera. Todo lo de aquí sale de `docs/INSTALADOR.md` y de `MANUAL_CAJA_VERIFICADO.md`. Lo que no está verificado dice **COMPLETAR**.

## 1. Instalar (una sola vez, en la laptop de la tienda)

Necesitas: laptop con Windows 11, cuenta de Windows con permiso de administrador, el archivo `Nexora-POS-Setup-<versión>.exe`, un correo, una contraseña de al menos 12 caracteres y un PIN de 6 números. La red de la tienda debe estar marcada como **Privada**.

1. Clic derecho en el instalador › **Ejecutar como administrador**.
2. Escribe tu nombre y correo. Crea la contraseña y el PIN. Guárdalos en un lugar seguro.
3. Pulsa **Instalar**. El primer arranque puede tardar varios minutos. No apagues la laptop.
4. Abre el acceso directo **Nexora POS** del escritorio. _(El instalador todavía usa ese nombre: COMPLETAR si cambia a Norexos.)_
5. En **Configuración** llena los datos reales del negocio antes de vender.

Instala el programa en **una sola** laptop. Las demás cajas abren la dirección de esa laptop (o la web) desde el navegador.

## 2. Entrar

Enciende la laptop y espera uno o dos minutos. En la laptop abre `https://localhost:4173`. Escribe tu usuario o correo y tu contraseña y pulsa **Entrar a mi tienda**. En los celulares, la dirección está en el archivo **FitStore - acceso en celulares.txt** del escritorio (hay que instalar el certificado una vez por celular: pasos en `docs/INSTALADOR.md`).

Si el equipo dice «Este equipo necesita aprobación», un gerente lo aprueba con su PIN.

## 3. Vender

1. Menú **Caja** › **Abrir caja** › escribe el **Efectivo inicial**. Sin caja abierta no se puede cobrar.
2. Menú **Punto de venta**. Elige el cliente con **F4** (es obligatorio).
3. Agrega productos con un clic en su tarjeta, o con el buscador (F2) o el lector de código. Cantidad: botones **+** y **−**.
4. Pulsa **Cobrar** (o **F12**). Elige cómo paga: efectivo, tarjeta, transferencia, crédito u otro. Pulsa **Agregar pago** y luego **Finalizar venta**.
5. Transferencia: elige la cuenta y escribe la referencia. Tarjeta: últimos 4 dígitos y número de aprobación.
6. Recibo: **Imprimir recibo**, **Recibo PDF**, **WhatsApp** o **Correo**. El recibo **no es comprobante fiscal**.

## 4. Cerrar caja

1. Cierra el lote del verifón (datáfono).
2. Menú **Caja** › **Cerrar y arquear**.
3. Cuenta el efectivo por denominación y escribe el total de tarjeta y el número de lote. El conteo es ciego: el sistema no te dice cuánto debías tener hasta después de cerrar.
4. Marca la casilla de confirmación y pulsa **Cerrar caja e imprimir cuadre**.
5. Si no cuadra, el sistema pide una justificación y el PIN de otra persona con permiso. Vuelve a contar antes de justificar.

## 5. Respaldo

- La laptop hace sola una copia todos los días a las **2:00 a. m.** en `%ProgramData%\FitStore POS\Backups` (guarda los últimos 30 días).
- **Esa copia está en la misma laptop.** Si se daña o se la roban, se pierde también. Copia los archivos `FitStore_*.dump`, `.sha256` y `.json` a una **USB** o a OneDrive. El instalador **no** lo hace por ti.
- Revisa una vez por semana que haya archivos recientes en esa carpeta.
- Restaurar (reemplaza todos los datos actuales; sin ventas en curso): cierra todas las cajas › **Inicio › Nexora POS › Restaurar un respaldo** › elige el archivo `FitStore_*.dump` › escribe `RESTAURAR` › revisa una venta conocida, el inventario y el último cierre.

## 6. Ayuda

Soporte solo en español. WhatsApp: **[COMPLETAR]**. Correo: **[COMPLETAR]**. Horario de soporte: **COMPLETAR**.
