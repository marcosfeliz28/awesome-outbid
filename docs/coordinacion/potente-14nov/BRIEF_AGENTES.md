# Brief común para agentes de búsqueda (fase 1)

Contexto: comparamos el POS Norexos/Nexora (tienda de suplementos, maquillaje y fajas en República Dominicana) con empresas de punto de venta/administración. Solo lectura + internet público. NO enviar datos de la tienda a ningún sitio, NO registrarte en nada, NO pagar, NO tocar apps/** ni tests/**.

Por cada empresa asignada (si una no existe o ya no vende POS, sustitúyela por otra del mismo tipo y dilo):
- País/sede; a quién vende; precio público (solo si está publicado; si no, «no publicado»);
- IA que ofrece (qué hace exactamente); comodidad de caja (pasos para cobrar, atajos, modo sin conexión, hardware, escáner, voz);
- privacidad y acceso (roles, PIN, permisos, 2FA, auditoría, qué ve una cajera);
- idiomas (¿español? ¿inglés? ¿ambos?); fiscal RD/LatAm (NCF/e-CF/ITBIS o equivalente) si aplica;
- DISEÑO VISUAL (prioridad de la dueña): describe con detalle paleta, tipografía, densidad, tema claro/oscuro, botones grandes, iconos, cómo se ve la pantalla de caja y el panel, qué lo hace fácil de leer;
- URL(s) y fecha de consulta (14-nov-2026) en CADA dato. Sin fuente = escribe «sin fuente». No inventes.
- Capturas: si Playwright puede abrir la página pública de producto, guarda UNA captura (viewport 1366x800, deviceScaleFactor 1, png) en docs/coordinacion/potente-14nov/capturas/<empresa>.png y mírala para describir el diseño; si no abre, escribe «no visto». Nada de datos personales ni cuentas.
Herramientas: WebSearch (mode standard; solo EE. UU.), curl/WebFetch, Playwright (require('playwright'); chromium.launch() sin opciones). Cierra el navegador al terminar.
Formato: una sección por empresa, cortas (≤ 25 líneas c/u), con tabla de campos. Al final: «No pude comprobar» y lista de URLs. Guarda el resultado en el archivo indicado y responde solo con 5 líneas (ruta, empresas confirmadas, sustituciones, qué falló). No hagas git commit.
