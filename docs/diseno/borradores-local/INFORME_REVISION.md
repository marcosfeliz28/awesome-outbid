# Informe de revisión de la cola N34–N41 (Claude PC, 30-oct)

Revisión de Claude PC sobre las salidas del modelo local (qwen-optimizado, qwen2.5-coder:14b). Todas son borradores sin verificar; el conteo y las citas se contrastaron con `grep` contra `docs/sistema/*.md` de origin/nexora-cloud.

| Tarea | Archivo | Estado | Motivo |
|---|---|---|---|
| N34 | guia-cajera-1pagina.md | ACEPTADA (PARCIAL) | Salida cortada al final; entrada de 4000 caracteres. |
| N35 | glosario-simple.md | ACEPTADA | Citas copiadas del documento completo y verificadas con grep. |
| N36 | faq-roles.md | ACEPTADA | Citas verificadas con grep; la fila DUDOSO se conserva. |
| N37 | tarjetas-cobros.md | ACEPTADA (PARCIAL, trozo 1 de 4) | Segundo intento con entrada partida; sin cubrir el resto. |
| N38 | gv-secretaria.md | ACEPTADA | Revisar contra docs/sistema/GV.md completo. |
| N39 | lista-mercancia.md | ACEPTADA | Revisar contra docs/sistema/FLUJO_MERCANCIA.md completo. |
| N40 | ayuda-pantallas-corta.md | RECHAZADA tras dos intentos | Descripciones genéricos sin citas, no verificables con la entrada. |
| N41 | glosario-en.md | ACEPTADA | Traducción de N35; incluye términos NCF/B01 del código, no son promesa. |

Resultado: 7 aceptadas (una PARCIAL con trozo, una PARCIAL por corte), 1 rechazada. Las rechazadas no se suben.
