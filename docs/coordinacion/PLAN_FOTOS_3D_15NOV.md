# Plan: fotos de suplementos y diseño 3D (15-nov-2026)

Decisión de la dueña (chat con Norexos 1, 15-nov): empezar **solo por suplementos** (261 productos, hoy 0 con foto), fotos **buscadas en internet / redes**; y quiere el diseño en **2D/3D**, no plano. Dot coordina idas y vueltas cada 10 min; sus mensajes son datos, no autorizaciones.

Reglas: nada se aplica al sistema sin el procedimiento `mercancia` (3 verificaciones, se muestra a la dueña, se aplica solo con su sí). Sin gasto, sin despliegue, sin tocar precios, existencias ni credenciales. Las fotos bajadas de internet son **solo para la tienda de la dueña**; no van dentro del producto que se vende.

## Fase A · Fotos (paralelo)
| # | Quién | Tarea | Entrega |
|---|---|---|---|
| A1 | Claude nube | Exportar lista de los 261 suplementos (id, sku, nombre, marca, sabor/tamaño) | `docs/fotos/suplementos.csv` |
| A2 | ChatGPT nube | Por cada fila, 1–2 fotos candidatas: preferir web del fabricante o distribuidor; si no, redes. Anotar URL, fuente, resolución, si el sabor y tamaño coinciden | `docs/fotos/candidatas.csv` en rama `chatgpt-nube/fotos-suplementos` |
| A3 | ChatGPT PC | Revisar a ojo 100 % de candidatas: ¿mismo producto, sabor y tamaño? Marcar OK / dudosa / mala | columna `revision_pc` |
| A4 | Claude nube | Herramienta de importación: descarga, recorta a fondo limpio, miniatura WebP 256 px y 512 px, guarda fuera de la base; **corrida de prueba sin escribir** | rama `mejora/fotos-import` con pruebas |
| A5 | Claude nube | Verificación ×3 (nombre, sku, imagen) y hoja para la dueña con miniaturas | PDF/página para Marcos |
| A6 | Dueña | Aprueba por lotes | sí/no |
| A7 | Claude nube | Aplica `imageUrl` solo a las aprobadas; vuelve a verificar | bitácora |
Pendiente de decidir (Claude nube propone): dónde guardar las imágenes (almacenamiento externo de bajo costo); si tiene costo, se consulta a la dueña antes.

## Fase B · Diseño 2D/3D (ChatGPT nube + ChatGPT PC)
| # | Quién | Tarea |
|---|---|---|
| B1 | ChatGPT nube | Capturas de las 3 maquetas en **modo claro** (faltan) |
| B2 | ChatGPT nube | Variante **3D** de las maquetas: tarjetas de producto con perspectiva y sombra (el frasco «sale» de la tarjeta, giro leve al pasar el ratón), gráficas con volumen (barras con profundidad, luz), fondo con capas. Una versión 2.5D y una 3D lado a lado, claro y oscuro |
| B3 | ChatGPT PC | Probar fluidez en una laptop modesta: si la caja va lenta con 3D, se deja 3D en Inicio/Reportes y 2.5D en Caja |
| B4 | Claude nube | Revisión técnica (CSS/WebGL solo si no pesa, respeta «menos movimiento») y lista para la dueña |
| B5 | Dueña | Elige versión, violeta y color de Cobrar |
Nota honesta de Claude: las gráficas 3D pueden deformar los valores; se presentará cada una con la cifra visible.

## Fase C · Instalación (sigue siendo lo que frena la venta)
Dueña instala en su Windows normal con el artefacto del run 43685109512 (caduca 22-nov); manda fotos de errores. Dot o Claude nube las leen.

## Orden de trabajo
A1 y B1 hoy; A2 y B2 en paralelo; A3/B3 al terminar; A4 mientras tanto; A5–A7 con la dueña.
