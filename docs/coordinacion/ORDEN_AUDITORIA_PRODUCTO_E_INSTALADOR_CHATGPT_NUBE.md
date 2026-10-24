# Orden para ChatGPT nube (Codex): 20 mejoras y camino al instalador para vender (24-oct-2026)

**Pedido de la dueña:** auditar el software, proponer 20 mejoras y decir qué falta para tener un instalador completo y poder vender Nexora POS. Claude revisa la propuesta, la ajusta y luego reparte el trabajo: tú construyes y Claude es el arquitecto y quien aprueba.

## Tu acceso (solo lectura en esta fase)

- **Repositorio:** `marcosfeliz28/awesome-outbid`, ramas `nexora-cloud` (la tienda en uso), `producto-nexora` (el producto para varias empresas, fase 0 y 1) y `claude/*`.
- **Puedes:** leer todo el código y los documentos, correr pruebas y la app en tu entorno con datos de prueba (`pnpm db:seed`), y abrir tu propia rama `nexora-chatgpt-nube`.
- **No puedes:**
  - entrar a Render ni a la base o las cuentas de la tienda, ni pedir contraseñas o claves;
  - cambiar `nexora-cloud`, `producto-nexora` ni `claude/*`;
  - desplegar.

## Lee primero

`AGENTS.md`, `docs/producto/ARQUITECTURA_NEXORA_PRODUCTO.md`, `docs/INSTALADOR.md`, `docs/INSTALADOR_B8.md`, la carpeta `instalador/`, `docs/coordinacion/ORDEN_FASE1_CHATGPT_PC.md` y `docs/coordinacion/RESULTADOS_CHATGPT.md` (lo que ya hizo ChatGPT PC en `producto-nexora`).

## Entrega 1: 20 mejoras

Escríbelas en una tabla con: n.º, área (seguridad, ventas, inventario, caja, reportes, clientes, rendimiento, experiencia de uso, IA), problema concreto con archivo y línea, propuesta, beneficio para el negocio, esfuerzo (S/M/L) y riesgo.

- Ordénalas por valor/esfuerzo.
- No repitas lo que ya está hecho o pendiente en `TASKS.md` y `docs/coordinacion/INSTRUCCIONES_ACTUALES.md`.
- Usa datos de prueba, nunca de la tienda.

## Entrega 2: qué falta para un instalador 100 % vendible

Compara el estado actual (instalador Windows de `instalador/` y producto multiempresa de `producto-nexora`) con lo que necesita un cliente que compra y lo instala sin nosotros. Cubre como mínimo:

1. Instalación de un clic en Windows: requisitos, PostgreSQL incluido o en la nube, firma del instalador, desinstalación y actualización automática.
2. Primer arranque: asistente para crear la empresa, el usuario administrador, la sucursal, los impuestos/NCF y los productos (importar Excel).
3. Licencias y cobro: prueba gratuita, activación, bloqueo al vencer y modo sin internet.
4. Respaldos y restauración por cliente, y soporte remoto seguro.
5. Seguridad de un producto vendido: secretos por instalación, actualizaciones de seguridad y datos separados por empresa.
6. Legal y fiscal en R. D.: comprobantes fiscales, términos de uso, privacidad, y lo que sea solo de MacGen (marca, categorías, reglas) que hay que convertir en configuración.
7. Documentación y soporte: manual, videos, canal de ayuda y la IA de soporte.
8. Pruebas en máquinas limpias (Windows 10 y 11) y el criterio de «listo para vender».

Para cada punto indica: qué ya existe (con archivo), qué falta, esfuerzo, riesgo y un orden por fases con un criterio de terminado medible.

## Cómo entregar

- Archivo `docs/coordinacion/PROPUESTA_PRODUCTO_CHATGPT_NUBE.md` en tu rama `nexora-chatgpt-nube`, súbela a GitHub.
- Añade una sección «Propuesta producto 24-oct» en `RESULTADOS_CHATGPT.md` con un resumen de 10 líneas.
- No cambies código en esta fase. Claude revisa, corrige la propuesta y escribe las órdenes de construcción.
