/** Publicado con cada versión web; no se precachea para que el JS anterior lea las notas nuevas. */
export type PwaReleaseNotes = { version: string; notes: string[] };
type NotesResponse = { ok: boolean; json(): Promise<unknown> };
type NotesFetcher = (
  url: string,
  options: { cache: "no-store" },
) => Promise<NotesResponse>;

export async function loadPwaReleaseNotes(
  fetcher: NotesFetcher = fetch,
): Promise<PwaReleaseNotes | null> {
  try {
    const response = await fetcher(`/release-notes.json?at=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || typeof data !== "object") return null;
    const { version, notes } = data as Record<string, unknown>;
    if (typeof version !== "string" || !/^[\w.-]{1,60}$/.test(version))
      return null;
    if (
      !Array.isArray(notes) ||
      notes.length < 1 ||
      notes.length > 3 ||
      notes.some(
        (note) =>
          typeof note !== "string" || note.length < 1 || note.length > 120,
      )
    )
      return null;
    return { version, notes: notes as string[] };
  } catch {
    // Sin conexión, el aviso de actualización sigue funcionando sin inventar cambios.
    return null;
  }
}
