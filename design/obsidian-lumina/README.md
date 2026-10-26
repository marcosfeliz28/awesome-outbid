# Nexora POS — Obsidian Lumina v2

Prototipo visual de referencia, no una implementación funcional de acceso,
recuperación, PIN ni facturación.

## Dirección aprobada

Un sistema visual ejecutivo, elegante y minimalista, con futurismo sutil:

- Fondo obsidiana `#05050A`, superficies oscuras de baja saturación y mucho
  espacio negativo.
- Esmeralda `#43E3B1` y violeta `#8B5CF6` únicamente para estados, foco y
  acción; nunca como decoración permanente.
- Tipografía clara y números tabulares; una acción primaria por vista.
- Microinteracciones limitadas y respeto estricto de `prefers-reduced-motion`.
- Contraste, foco visible, etiquetas y navegación de teclado como parte del
  sistema de diseño.

## Alcance de la evolución visual

1. Shell, tokens y componentes compartidos de administración.
2. Dashboard de administración.
3. Catálogo, inventario, clientes, reportes y configuración.
4. Panel de operadora.

No cambiar reglas fiscales, pagos, seguridad, permisos, APIs ni base de datos
al adoptar esta dirección. Los flujos demo del HTML no deben convertirse en
lógica real: la autenticación, el PIN de caja y la recuperación se validan en
servidor.

## Archivos

- `nexora-obsidian-lumina-v2.html`: recorrido visual interactivo.
- `assets/obsidian-lumina-hero-v2.png`: fondo original para la propuesta.
