---
name: auditoria-usuario
description: Auditoría fuerte de la web de Norexos como si fuera un usuario real (cajera, vendedora, gerente, dueña), con navegador automatizado (Playwright). Úsala después de cada despliegue de web, antes de entregar un rediseño y cuando la dueña pida «revisa la web como usuario». Solo lee: nunca cobra, cierra caja ni modifica datos del negocio.
---

# Auditoría como usuario (Norexos)

Orden de la dueña, 31-oct-2026. Herramienta: Playwright (ya instalado en el entorno, `require('playwright')`; no reinstalar) y, en la laptop, Chrome DevTools MCP (ver `herramientas-evaluadas`). Los tests de `tests/e2e/` son la base; esta auditoría añade el recorrido humano.

## Reglas duras
- **Solo lectura.** No cobrar, no abrir/cerrar caja, no crear/editar/anular facturas, mercancía, clientes ni pagos en producción. Para probar flujos de escritura usa la base de pruebas local (`pnpm test:e2e`), nunca producción.
- Credenciales solo desde `NEXORA_CLAUDE_USER` / `NEXORA_CLAUDE_PASSWORD` del entorno (`docs/coordinacion/claude-nube/entrar.py`). Nunca imprimirlas ni guardarlas en capturas (recortar el campo de contraseña).
- Sin credenciales: audita solo lo público (login, `/healthz`, título, carga, consola) y dilo.

## Recorrido (por cada rol que se pueda: vendedora, gerente, dueña)
1. **Entrada:** carga <3 s, título «Norexos · Punto de venta e inventario», sin errores en consola ni peticiones 4xx/5xx inesperadas, login con clave mala da mensaje claro.
2. **Cada pantalla del menú** (lista en `docs/sistema/PANTALLAS.md`): abre, espera estable, captura, y anota: texto cortado, desbordes horizontales, botones fuera de vista, textos en inglés, «undefined/NaN/null/[object]», cifras «RD$ 0.00» sin razón, restos del nombre viejo (Nexora/POS).
3. **Tamaños:** 1280×720, 1366×768, 1536×864 y 390×844 (celular). Letra base ≥16 px y nada <14 px fuera de impresión (`getComputedStyle`).
4. **Permisos:** con la vendedora no deben verse costo, utilidad ni margen; con permiso faltante la pantalla explica, no queda vacía.
5. **Teclado y foco:** Tab recorre en orden lógico; foco visible; F2/F4/F8/F12 del POS responden (sin ejecutar cobro). Contraste y etiquetas con axe (`@axe-core/playwright` si está; si no, reglas manuales de `tests/e2e/accesibilidad.spec.ts`).
6. **Red mala:** simular offline/lento (`context.setOffline`) en el POS: debe avisar y conservar el carrito (cola offline), sin perder datos.
7. **Impresión/recibo:** vista previa legible, leyenda no fiscal presente.
8. **Rendimiento:** LCP/peso de JS por pantalla; marca las >2.5 s o >1 MB.

## Salida
Un solo archivo `docs/auditoria/AUDITORIA_USUARIO_<fecha>.md`: tabla `pantalla | rol | tamaño | hallazgo | gravedad (alta/media/baja) | captura`, más lo NO COMPROBADO y por qué. Capturas en `docs/auditoria/capturas-<fecha>/` (sin datos personales de clientes ni claves). Hallazgo alto = se avisa a Norexos 1 el mismo ciclo; los demás van a PENDIENTES.

## Quién la corre
Agente en la nube con el modelo más barato, una sola vez por despliegue, en rama `claude/auditoria-usuario-<fecha>`; Claude PC la repite en la laptop con DevTools si hay duda visual. Dueño único: el agente que la recibió; nadie más audita la misma pantalla.
