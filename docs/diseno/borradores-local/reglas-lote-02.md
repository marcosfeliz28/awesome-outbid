1. Si tarjeta, efectivo o dólares no cuadran y quien cierra es cajera, entonces no cierra sin el PIN de otra persona con permiso y una justificación del descuadre (mín. 10 letras) [docs/sistema/FLUJO_CAJA_POS.md:155]
2. Si se intenta cobrar más que el saldo, entonces se muestra el mensaje «El cobro supera el saldo pendiente.» [docs/sistema/FLUJO_COBROS_Y_TRANSFERENCIAS.md:42]
3. Si el envío del mensajero explica la diferencia, entonces se usa RD$ X como envío o se edita el envío [docs/sistema/FLUJO_COBROS_Y_TRANSFERENCIAS.md:73]
4. Si era un abono, entonces se baja el saldo, se cierra el crédito si llega a cero y se acreditan incentivos [docs/sistema/FLUJO_COBROS_Y_TRANSFERENCIAS.md:80]
5. Si la caja ya cerró, entonces se recalcula el cuadre y se deja auditoría `verified_after_close` [docs/sistema/FLUJO_COBROS_Y_TRANSFERENCIAS.md:81]

Qué hice: Reescribí las reglas como frases «Si … entonces …» de máximo 25 palabras, conservando las citas al final.
Qué NO comprobé: No revisé ningún código ni verificué la implementación de las reglas en los archivos mencionados.