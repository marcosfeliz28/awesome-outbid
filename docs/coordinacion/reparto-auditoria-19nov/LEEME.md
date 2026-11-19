# Reparto de la auditoría (19-nov-2026, orden de Marcos)

Fuente: 346 hallazgos de la auditoría de 11 agentes de Norexos 2 (rama `claude/bitacora-n2`, commit `d4c733b`, `docs/auditoria-ui/*.csv`).

| Quién | Archivo | Qué le toca |
|---|---|---|
| **Claude nube (Norexos 1)** | `CLAUDE.csv` | Lógica, cálculos de dinero, datos incorrectos, funciones que no hacen lo que dicen, validación de entradas, seguridad (tipos `dato`, `funcion`, `entrada`). |
| **ChatGPT / Dot** | `CHATGPT.csv` | Diseño y presentación: textos, ortografía, traducción ES/EN, formato de montos y fechas, contraste, color, tamaños, móvil (tipos `texto`, `ortografia`, `traduccion`, `formato`, `diseno`, `contraste`, `color`, `tamano`). |

Cada lista va ordenada por severidad (alta → mínima).

## Reglas para no pisarse
- Claude no toca diseño; Dot no toca API, base de datos, permisos ni dinero (`CLAUDE.md` punto 4).
- Si un arreglo de texto o formato cae en un archivo de la API (por ejemplo, una clave técnica que sale del servidor), lo hace Claude.
- Cada uno trabaja en su rama (`claude/*` o `dot/*`), con los 3 CI en verde. Un solo publicador por vez: avisar antes de desplegar y comprobar el commit en vivo antes y después.

## Prioridad de Claude (empieza ya)
1. Descuento global en caja mal calculado (10 % sobre 4,700 descuenta 170, no 470).
2. Cada inicio de sesión registra y aprueba un equipo solo (136 en un día).
3. Tres cifras distintas de «ganancia»: unificar nombre y definición.
4. «Infinity en stock» en servicios y cursos de GV.
5. Resto de `CLAUDE.csv` por severidad.

## Prioridad de Dot
1. Métodos de pago y claves técnicas en inglés en pantalla.
2. Formato de montos y fechas unificado.
3. Contraste y tamaños de botón (mínimo 44 px).
4. Selector de idioma visible y pantallas sin traducir.
5. Resto de `CHATGPT.csv` por severidad.
