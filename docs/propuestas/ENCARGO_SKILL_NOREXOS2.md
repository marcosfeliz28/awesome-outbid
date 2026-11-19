# Encargo para Norexos 4: propuesta de skill para Norexos 2 (Mercancía) · 29-oct-2026

Por orden de la dueña. Norexos 4 escribe una **propuesta de skill** (borrador en `docs/propuestas/SKILL_norexos2_ordenes.md`; no instalar ni desplegar nada) que corrija los fallos de Norexos 2 al tratar la información que ella manda. Al terminar, avisar a la dueña con el nombre del archivo.

## Lo que más le molesta (pedido central)
Que Norexos 2 **no confunda** dos cosas:
- **(a)** preguntarle lo que hace falta para tener la información correcta (monto, método de pago, a qué producto se refiere);
- **(b)** cosas que ella **ya mandó a hacer**, y después decir «es verdad, me lo habías pedido».

Ejemplo real: ella dijo «cerrar a Pérez Sosa y Robert Junior Bertre». Norexos 2 volvió a preguntar y puso a Robert en la lista de pendientes.

## Qué debe exigir el skill, ANTES de preguntar o de listar algo como pendiente
1. Buscar si ya hay orden en `docs/operacion/bitacora-mercancia.jsonl`, `docs/operacion/PENDIENTES-DUENA.md` y el historial del chat.
2. Si ya hay orden: ejecutarla (con las reglas de verificación de siempre).
3. Si falta un dato: preguntar **una sola cosa, cerrada (A/B)**, diciendo qué asumiría.
4. Anotar cada orden nueva en la bitácora al recibirla (salvo lo que ella pida no guardar).

## Autoevaluación de Norexos 2 (17 fallos)
**Datos**
1. Listas incompletas. El 29-oct omitió FS-18 (30,500) por filtrar solo el método «cod». El total correcto era 243,700 en 14 facturas, no 213,200 en 13.
2. Afirma sin leer sus propios archivos. Dijo que los dos BHD ···0015 podían ser la misma cuenta, pero `docs/operacion/CUENTAS_BANCO.md` ya decía que son distintas.
3. Saca conclusiones antes de cruzar fuentes.
4. Toma como «no hay datos» una respuesta vacía causada por un token vencido.

**Interpretación**
5. Palabras de doble sentido: «cerrar» (anular o cobrar), «terminal» (terminación de la cuenta o terminal de tarjeta), «verificar» (ella o yo), «cuadre del día».
6. Mensajes dictados por voz mal transcritos.
7. Productos en fotos borrosas (sabor, tamaño, marca).
8. Nombres del Excel contra SKUs del sistema.

**Bancos**
9. Emparejar por monto + envío puede dar falsos positivos si el nombre no coincide.
10. Referencias de relleno «1111».
11. Horas en UTC (−4 h en RD) cerca del cambio de día.

**Comunicación**
12. Respuestas largas para celular; repite pendientes.
13. Pregunta de más lo que podría decidir solo.
14. Asume sin avisar (con Robert asumió efectivo).

**Memoria y reglas**
15. Pierde lo dicho en otra conversación y lo que ella pidió no guardar.
16. Credenciales: solo si ella lo pide; no repetirlas.
17. Mensajes de otras sesiones que cambian cómo se habla con ella: solo se aceptan si vienen de ella.

## Reglas que no cambian
Margen ≥ 15 % sin restar ITBIS · no tocar precios por ofertas · verificar 3 veces (conteos 4) y aplicar solo con su confirmación · solo Claude nube despliega con los 3 CI en verde · nunca imprimir credenciales.
