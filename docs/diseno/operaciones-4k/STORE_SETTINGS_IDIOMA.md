# StoreSettings ES/EN

Base `8ec7f99b7`. Solo StoreSettings y sus dos imports nuevos en Tienda.tsx.

Traduce etiquetas del logo, aviso de tamaño, confirmación de guardado, cajas y cajeros, títulos/campos y acciones de ambos FormModal. Los nombres proporcionados por usuarios no se traducen. API, payloads, query keys, límites/tipos de archivo, filtros y handlers se conservan. No toca cierre de caja ni otros componentes.

Validado: 3/3 pruebas focales, ESLint, tipos web, diff-check. Contra Tienda de base: 2/3 pruebas nuevas fallan; final restaurado: 3/3 pasan. Ledger revierte función/imports y comprueba hash SHA256 original. AST compara llamadas y handlers.

No ejecutados: navegador, backend real, aggregate pnpm check ni CI remoto. Errores de servidor conservan texto original. No push ni despliegue.
