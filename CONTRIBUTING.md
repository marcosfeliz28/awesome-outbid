# Cómo contribuir a Nexora POS

## Antes de empezar
- Trabaja siempre en una rama propia. Nunca directo en `nexora-cloud` ni `producto-nexora`.
- Lee `AGENTS.md` y `docs/DESARROLLO.md`.

## Ramas
- Base: `nexora-cloud`.
- Nombres: `claude-pc/<tarea>`, `deepseek/<id>`, `chatgpt-pc/<tarea>`, o el prefijo que indique la coordinación.

## Cambios
- Un commit por arreglo, con una prueba que falle antes del cambio y pase después.
- Sin `--force` sobre ramas compartidas. Sin commits vacíos.
- Si tocas código compartido (`packages/shared`), pide revisión antes de mezclar.

## Antes de abrir un PR
Ejecuta en la raíz:

```bash
pnpm check
```

`pnpm check` corre typecheck, lint, test y build. Para la verificación completa usa `pnpm verify`, y para pruebas de base de datos `pnpm test:integration`.

## Lo que no se toca sin autorización
- Despliegue, producción y servicios en la nube.
- Credenciales, claves y variables de entorno reales.
- Reglas de dinero, NCF y reportes fiscales.
- Migraciones de base de datos, `.github/` y el instalador.

## Revisión
- Un PR por tarea, con descripción de qué cambia y cómo se verificó.
- La mezcla la decide la coordinación, no el autor del cambio.
