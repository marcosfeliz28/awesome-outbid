# Cola completa para ChatGPT PC y ChatGPT nube (27-oct-2026)

Orden de la dueña: usar al máximo a ChatGPT PC y ChatGPT nube. Reglas de siempre: **no despliegan, no tocan Render, la base de la tienda ni credenciales**; una rama por tarea, un commit por pantalla o arreglo, prueba que falle antes y pase después, CI en verde (`verify`, `windows-installer`, `render-images`) y capturas. Solo Claude nube («Nexora 1 · Software») revisa y despliega. Estilo: `docs/coordinacion/ORDEN_DISENO_INTERNO_26OCT.md` (rama `claude/orden-diseno-interno`).

## ChatGPT nube (rama `chatgpt-nube/lumina-adentro-b`, sigue ahí)
1. **Arreglar la CI roja (13 pruebas e2e de `verify`):**
   - `App.tsx` ~1308-1327: cada botón del selector Claro/Oscuro con `aria-label` fijo («Activar modo claro» / «Activar modo oscuro»); en celular el icono no puede quedar sin nombre accesible. Estrecha el selector para que la barra superior no recorte la ruta a 320 y 390 px.
   - `Management.tsx` ~905-908: restaura `<label htmlFor="warehouse-view">Almacén</label>` fuera del `<select>` (o `aria-label="Almacén"`), para que `getByLabel("Almacén",{exact:true})` funcione.
   - `tests/e2e/lumina-adentro-b.spec.ts` ~165: abre `test-failed-1.png` y `error-context.md` del run `40352022737` y corrige el mock o el selector.
   - No cambies pruebas viejas para ocultar fallas salvo cambio intencional del diseño. Corre `pnpm test` y el e2e completo.
2. **Hallazgos del recorrido de QA** (`docs/qa/INFORME_RECORRIDO_26OCT.md`, rama `claude/qa-recorrido-26oct`), en una rama nueva `chatgpt-nube/qa-medios`, solo los medios:
   - Ruta prohibida: que NO monte la pantalla ni dispare peticiones antes de redirigir (`App.tsx:1192` y `:733`), con prueba.
   - Tooltip «Ventas del año» ilegible en oscuro (contraste 1,03:1): falta definir `--ink` (`styles.css:6343`).
   - «Ventas» a 390 px: Total, Pagos y «Solicitar anulación» quedan fuera de la vista (`.table-wrap`, `styles.css:1330`).
3. **B-01 sin aplicar:** prepara, en la rama `chatgpt-nube/ventas-ciego` y **sin mezclar**, ocultar a la cajera con caja abierta el total y la forma de pago en «Ventas» (reglas de `reports.ts:1433` frente a `sales.ts:1622`), con prueba. La dueña decide si se aplica.
4. Después de 1: sigue con las pantallas que falten de `ORDEN_DISENO_INTERNO_26OCT.md` (Reportes, Configuración, Mercancía/Equipos, Asistente) usando los componentes comunes; un commit por pantalla.
5. **Documentos:** revisa `docs/seguridad/PLUGINS.md` y propone mejoras de claridad (solo texto, sin instalar nada).

## ChatGPT PC (ramas `chatgpt-pc/lumina-adentro-a` y `chatgpt-pc/cola3-26oct`)
1. **Instalador (cola 3, `ba5c3c2e`):** la dueña está en la laptop y dará el «sí». Con datos de prueba (nombre «Prueba Instalador», correo `prueba@nexora.local`, contraseña inventada de 4 a 20 caracteres, PIN de 6 dígitos): reinstalar, verificar **cada pantalla sin letras raras (tildes y ñ)**, entrar, tomar capturas y anotar el resultado en `docs/coordinacion/PRUEBA_INSTALADOR_27OCT.md`. Ella acepta el aviso de Windows y escribe la contraseña en privado. Antes de instalar, ver si queda algo de la instalación vieja y avisar. No instales nada más.
2. **Diseño interior, lote A (`lumina-adentro-a`, `f8601e40`):** su CI falló. Arréglala (revisa si el marco con selector claro/oscuro duplica el de `chatgpt-nube/lumina-adentro-b`; **el marco común vive en la rama de nube**, no lo repitas). Tu parte: **caja/POS clara** (mismos flujos, botones y teclas F2/F4/F8/F12; clases `.product-card`, `.cart-items`, `.connection`, `.main-content`) y **tablero «Hoy»**, con capturas a 1366×768 y 390×844.
3. **PC-16 (parche Rust):** compila con `cargo` y reporta el resultado en `docs/coordinacion/PC16_RUST_COMPILACION_27OCT.md`. Si falla, el error completo, no lo arregles a ciegas.
4. **Cola 3 restante** (si no está hecha): guía de inicio de 5 minutos, prueba local de «Preguntas», plantilla de Excel de inventario y PDF de impresión (Q2–Q5 de `docs/coordinacion/ORDEN_COLA2_26OCT.md`).
5. La laptop es compartida con Claude PC: anota en `TABLERO_26OCT.md` cuándo la usas y cuándo la sueltas.

## Entrega
Cada tarea: rama, resumen corto, pruebas, capturas, riesgos y qué dejaste fuera, en `docs/diseno/OBSIDIAN_LUMINA_PROGRESO.md` o en el documento indicado. Claude nube revisa en la revisión horaria.
