// Cursos a los que se puede mover una inscripción. Ofrece los activos y deja el actual
// aunque esté inactivo. Marca los llenos; el servidor no bloquea por cupo (decisión de la dueña pendiente).
export function cursosDestino<
  C extends { id: string; active: boolean; enrolled: number; capacity: number },
>(cursos: C[], actualId: string) {
  return cursos
    .filter((c) => c.active || c.id === actualId)
    .map((c) => ({ ...c, lleno: c.enrolled >= c.capacity }));
}
