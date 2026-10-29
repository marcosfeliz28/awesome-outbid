Borrador sin verificar. Fuente: inventario de textos del POS (POS.tsx, origin/producto-nexora, vía docs/i18n/INVENTARIO_POS.md) y nombres de pruebas e2e de caja (origin/producto-nexora). PARCIAL: no se ejecutó ninguna prueba; las líneas son las del inventario.

# Checklist de revisión manual de la caja (antes de una entrega)

- [ ] 1. **Elegir cliente · F4** (POS.tsx:1048) — Con F4 se abre la elección de cliente. *Prueba que probablemente cubre (suposición por nombre, sin verificar):* tests/e2e/caja-web.spec.ts
- [ ] 2. **Subtotal** (POS.tsx:1183) — El subtotal de la venta se muestra y cambia al agregar artículos. *Prueba que probablemente cubre (suposición por nombre, sin verificar):* tests/e2e/caja-detalles.spec.ts
- [ ] 3. **Descuento global** (POS.tsx:1187) — Se puede aplicar un descuento global a la venta. *Prueba que probablemente cubre (suposición por nombre, sin verificar):* tests/e2e/caja-detalles.spec.ts
- [ ] 4. **Total a cobrar** (POS.tsx:1215) — El total a cobrar coincide con el subtotal menos el descuento. *Prueba que probablemente cubre (suposición por nombre, sin verificar):* tests/e2e/caja-web.spec.ts
- [ ] 5. **Cobrar** (POS.tsx:1232) — El botón Cobrar abre el cobro de la venta. *Prueba que probablemente cubre (suposición por nombre, sin verificar):* tests/e2e/caja-web.spec.ts
- [ ] 6. **F12** (POS.tsx:1233) — F12 cobra la venta igual que el botón Cobrar. *Prueba que probablemente cubre (suposición por nombre, sin verificar):* tests/e2e/caja-web.spec.ts
- [ ] 7. **Venta registrada** (POS.tsx:2360) — Al confirmar, aparece el aviso de venta registrada. *Prueba que probablemente cubre (suposición por nombre, sin verificar):* tests/e2e/caja-web.spec.ts
- [ ] 8. **Solicitud de NCF** (POS.tsx:2583) — Se puede pedir un NCF para la venta. *Prueba que probablemente cubre (suposición por nombre, sin verificar):* tests/e2e/caja-web.spec.ts
- [ ] 9. **B01 · Crédito fiscal** (POS.tsx:2589) — Se puede elegir B01 · Crédito fiscal. *Prueba que probablemente cubre (suposición por nombre, sin verificar):* tests/e2e/caja-web.spec.ts
- [ ] 10. **B02 · Consumidor final** (POS.tsx:2590) — Se puede elegir B02 · Consumidor final. *Prueba que probablemente cubre (suposición por nombre, sin verificar):* tests/e2e/caja-web.spec.ts
- [ ] 11. **Nota de crédito disponible** (POS.tsx:2636) — El aviso de nota de crédito disponible aparece cuando corresponde. *Prueba que probablemente cubre (suposición por nombre, sin verificar):* tests/e2e/caja-detalles.spec.ts

Total: 11 casillas. Casillas no incluidas por no tener texto en el inventario: ver las pruebas de caja (cuatro-cajas, caja-por-usuario, caja-cierre-movil, caja-fondo-sugerido, caja-borrador) para revisar a mano.

Qué hiciste: casillas generadas desde el inventario, con línea y nombre de prueba. Qué NO comprobaste: que cada casilla se cumpla en la aplicación; no se abrió el contenido de las pruebas.
