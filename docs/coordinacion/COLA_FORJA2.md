# Forja 2 — 10 funciones puras nuevas (29-oct, Norexos 1)
Las 14 de Forja 1 están hechas. Mismo método: función pura en `packages/ui/src/nx-<nombre>.ts` + prueba `tests/f2-01-nx-<nombre>.test.ts` (rojo antes, verde después, entra en `vitest.config.ts`), un commit por función, 3–4 por rama `claude-pc/forja2-grupo-N` desde `origin/producto-nexora`. **Probar siempre 0, 1, negativos, vacío, NaN, Unicode** (lecciones de `EDUCACION_MODELO_LOCAL.md`). Prohibido: cálculos de dinero del negocio (margen, ITBIS, descuentos, totales) y todo lo de caja/inventario; aquí solo FORMATO y utilidades. Máx. 5 archivos por rama de función.
| # | Función | Qué hace | Casos que NO pueden faltar |
|---|---|---|---|
| F2-01 | `formatearMonedaRD(n)` | «RD$ 1,234.50»: 2 decimales, separador de miles, negativos con signo, NaN → «—» | 0, -0, negativos, 1e9, NaN, Infinity |
| F2-02 | `enmascararTelefono(t)` | «809-***-4567» (solo últimos 4 visibles); inválido → «—» | vacío, con +1, con espacios, <10 dígitos |
| F2-03 | `diasHasta(fecha, ahora)` | días enteros hasta una fecha, zona America/Santo_Domingo; hoy = 0 | medianoche RD vs UTC, pasado (negativo), fecha inválida |
| F2-04 | `agruparPorDia(items, campoFecha)` | agrupa por día calendario RD, orden descendente | zona horaria en el cambio de día, vacío, fecha inválida (se omite y se cuenta) |
| F2-05 | `paginar(lista, pagina, tamano)` | {items, pagina, totalPaginas}; página fuera de rango se ajusta | tamano 0 o negativo, lista vacía, pagina NaN |
| F2-06 | `slugify(texto)` | minúsculas, sin acentos (la ñ → n), guiones; vacío → «» | emojis, solo símbolos, espacios múltiples, ñ |
| F2-07 | `formatearCedulaRNC(s)` | solo FORMATO: cédula 000-0000000-0 / RNC 9 dígitos; no valida dígito verificador | 11 y 9 dígitos, con guiones previos, letras |
| F2-08 | `resaltarCoincidencia(texto, busqueda)` | devuelve partes [{texto, coincide}] sin acentos ni mayúsculas | búsqueda vacía, acentos, ñ, caracteres regex (`.*+?`) |
| F2-09 | `limitarFrecuencia(fn, ms)` (debounce) | retrasa la llamada; cancelar() | 0 ms, llamadas repetidas (usar temporizadores falsos de Vitest) |
| F2-10 | `ordenarPorFecha(lista, campo, dir)` | estable; fechas inválidas al final | empates, dir inválido, vacío |
Reglas de auditoría de Norexos 1: diff completo + bordes + 3 CI del SHA del grupo. Después de la 10, repongo otra lista.
