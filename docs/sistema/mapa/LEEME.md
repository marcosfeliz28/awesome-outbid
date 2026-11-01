# Mapa del sistema Norexos (graphify) — 1-nov-2026

Mapa de conocimiento del repositorio: 8.992 nodos, 19.433 conexiones, 568 grupos. Código (AST, exacto) + 551 documentos leídos completos (conceptos y razones, **inferidos por IA**: verifica la fuente antes de decidir sobre dinero).
Construido sobre el commit indicado en `GRAPH_REPORT.md` («Built from commit»).

## Usarlo (cualquier sesión o IA con el repositorio)
```bash
pip install graphifyy                       # una vez (paquete oficial Graphify-Labs, Apache-2.0)
mkdir -p graphify-out && gunzip -c docs/sistema/mapa/graph.json.gz > graphify-out/graph.json
graphify query "¿dónde se calcula el margen y qué documentos lo mencionan?" --budget 1500
graphify path "Actor" "cashExpected"        # camino más corto entre dos conceptos
graphify explain "receivableShiftLimit"     # qué es y con qué se conecta
```
`graphify-out/` está en `.gitignore` (no se sube). Regla común: **antes de leer archivos a ciegas, consulta el mapa**; cita siempre archivo y línea de la fuente.

## Mantenerlo al día
- Código: `graphify update .` (gratis, sin tokens) tras cada despliegue. Solo Norexos 1 vuelve a subir `graph.json.gz`.
- Documentos nuevos: lectura con agentes baratos (solo los cambiados), ver `.claude/skills/graphify/`.
- Límites: las 61 migraciones `.sql` no entran (falta `graphifyy[sql]`); las 138 imágenes no se leyeron.
