# Inicio ES/EN: alcance de la revisión local

La selección de idioma actúa en los componentes reales de Inicio, no mediante sustitución del DOM ni capturas simuladas. La demo usa API y PostgreSQL locales con datos ficticios, separados del sistema de la tienda.

## Incluido

- Navegación principal, controles de idioma/acento, estado de conexión, tema y rótulos visibles del shell.
- Dashboard, KpiStrip, YearPie, indicadores diarios, meses, títulos y nombres accesibles de los puntos de gráfica.
- Formatos de fecha y moneda según idioma. La moneda sigue siendo DOP: no se convierten importes.
- Preferencias locales no sensibles de idioma y acento Esmeralda/Zafiro.

## No se presenta como traducción integral

Los demás módulos, formularios de autenticación, ayuda legal y mensajes del servidor conservan su idioma original. Nombres de productos, categorías, nombres de personas y datos de negocio no se traducen. El alcance se comunica mediante texto visible al lado de los selectores.

## Conservación y comprobaciones

`I18N_REVERSIBLE.json` registra cada cambio de presentación del Dashboard. La regresión revierte esos cambios y los de pintura anteriores y compara el hash del Dashboard base completo: no se cambia la referencia para aceptar nuevas consultas, cálculos, permisos o callbacks. El modelo de KpiStrip tampoco se modifica; sólo se traducen etiquetas en el componente.

Comprobación manual en navegador local: cambio ES → EN → ES, clic Zafiro, meses en inglés, importes DOP, 17 nombres de gráfica sin NaN. A 390 px: menú abre/cierra, nombres de navegación accesibles y ancho del documento menor que el viewport. No se ha publicado ni cambiado producción.

Pendiente antes de entrega a producción: revisión visual comparativa con la propuesta aprobada, integración API completa en base desechable, revisión de Claude y CI del SHA final. No se atribuyen al código nuevo los resultados de pruebas ejecutadas antes de modificarlo.
