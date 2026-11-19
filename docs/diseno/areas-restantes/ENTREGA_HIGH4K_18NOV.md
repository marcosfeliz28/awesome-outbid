# Presentación operativa 08 y 10–14 · 18 noviembre

Base e1a2e935. Referencias high4K 08,10,11,12,13,14 inspeccionadas como imágenes; no se insertan PNG de pantalla. Implementación nativa CSS/React, sin gastos ni generación Max.

## Alcance
- Promociones: candidatos reales, fotos existentes, métricas y ofertas con bordes metálicos, tarjetas profundas y pestañas activas doradas.
- Alertas: tarjetas jerarquizadas, iconos de relieve y distribución móvil. Se conservan estados, navegación y acciones especiales de anulaciones.
- Incentivos: tabla real, reglas y tarifas por unidad intactas. No se introduce una comisión porcentual ni se ejecutan cierres/pagos.
- GV: cursos existentes con tarjetas elevadas y pestañas reales. Sin planes ni cifras inventadas, sin cambios de gv.ts/API.
- Preguntar a Norexos: formulario y respuesta con paneles, foco y estado anunciado. Conserva envío explícito, bloqueo de doble envío, errores y límite del servicio. Esta entrega no llamó al modelo.
- Configuración: reglas como tarjetas, pestañas y superficie consistente. No altera permisos, credenciales ni valores.

Usa PremiumWorkspace.tsx/premiumWorkspace.css del agente de Reportes. Integrar ambos commits antes de ejecutar; esos dos archivos NO forman parte de este commit para evitar duplicación.

## Verificación
- TypeScript web: pasa, sin diagnósticos.
- ESLint de los cuatro TSX: pasa.
- Vite producción: pasa (advertencia existente de chunks >500 kB).
- node --test tests/premium-operations.test.mjs: 4/4; sobre base: fallan las dos regresiones de presentación, pasan las dos de guardas existentes.
- git diff --check: pasa.
- No cambios API, datos, dinero, permisos, producción, Render ni pruebas anteriores.

## Pendiente de integración
Esto es un candidato funcional de presentación, no una afirmación de equivalencia pixel-perfect. Faltan capturas reales por pantalla en 1440/390 claro/oscuro, prueba interacción móvil y los tres CI del SHA integrado. Mantiene los idiomas existentes; no añade traducciones de pantallas que aún estaban solo en español. No implementa funcionalidades ficticias del concepto ni imágenes fotorealistas de iconos. La capa común aporta foco y movimiento reducido; esta capa aporta profundidad de tarjetas y efectos sin animaciones permanentes.

## Segunda revisión
- Corregido grid móvil Alertas (display:grid explícito y badge sin margen heredado).
- CTA primario dorado en lugar de púrpura; títulos nuevos con preferencia ES/EN.
- Alertas: selección/deselección por identificador, panel lateral de fecha/categoría/prioridad del registro existente. Si el filtro excluye la selección, muestra estado vacío; no cambia ni resuelve automáticamente registros.
- GV: listado y detalle simultáneos en escritorio, apilados móvil. Detalle con key de curso para no conservar formularios de otro curso. Los endpoints y permisos son los existentes.
- Configuración: navegación lateral y contenido, pasa a pestañas móviles. Modales quedan fuera de la rejilla, guardas intactas.
- Asistente: tarjetas de fuentes a partir de reply.used, no fuentes ni métricas inventadas. Nuevo título y etiquetas traducidos, contenido generado permanece textual del servicio.
- 5/5 contratos pasan, tsc/eslint/build repetidos; cotejo visual e interacciones E2E aún pendientes.

## Tercera revisión
- CTA limitado explícitamente a las seis áreas: no afecta Reportes/Informe.
- Fondo de pestaña activa dorado vence el !important heredado mediante excepción igualmente scoped.
- Traducción reactiva de etiquetas UI en roots Promociones/Configuración/Incentivos/GV con `operationsLanguage.ts`; mantiene claves, payloads y valores de registros intactos. Asistente y controles principales de Alertas también cambian con ES/EN.
- Alcance pendiente: ayudas largas restantes, mensajes recibidos del servidor y subcomponentes heredados (formularios/inscripciones de GV, Equipos/Drive/AiUsage dentro de Configuración). No se considera localización total aún.

## Cuarta revisión
Se traducen explicaciones completas del cálculo/cierre de incentivos, notas visibles de Configuración y contexto de Promociones/GV. Las raíces Promociones/Alertas/Configuración ahora pasan `english` a QueryState/DataTable/FormModal; Incentivos a QueryState y etiqueta de cierre Modal. Carga/reintento/guardado/cancelación/vacío de esos componentes siguen el idioma seleccionado. Subcomponentes heredados indicados antes siguen fuera de este corte; no se traducen datos de negocio del servidor ni se alteran cálculos.
