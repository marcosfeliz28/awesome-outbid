# Patrones riesgosos en el código (S5, tanda 3)

Borrador sin verificar. Fuente: `origin/producto-nexora` (`d6adc554`), rama `claude-pc/lote-local-tanda3`.

**Resultado: 0 apariciones.** Comando: `git grep -nE "dangerouslySetInnerHTML|innerHTML|eval\(|new Function|document\.write" -- apps packages` (sin pruebas: `:!*.test.*`, `:!*.spec.*`). Con y sin el filtro de pruebas da 0.

Es solo lectura: que no haya apariciones no prueba que el código sea seguro en otros aspectos.
