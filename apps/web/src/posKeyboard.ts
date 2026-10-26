export const MODAL_BLOCKED_POS_KEYS = ["F4", "F8", "F12"] as const;

// Un modal de cliente, cobro o confirmación es dueño del teclado mientras está
// abierto. Evita que los atajos globales modifiquen el carrito que queda detrás.
export function blockPosShortcutWithModal(
  event: Pick<KeyboardEvent, "key" | "preventDefault">,
  root: Pick<Document, "querySelector">,
) {
  if (
    !MODAL_BLOCKED_POS_KEYS.includes(
      event.key as (typeof MODAL_BLOCKED_POS_KEYS)[number],
    ) ||
    !root.querySelector('[role="dialog"]')
  )
    return false;
  event.preventDefault();
  return true;
}

// La pistola lectora termina el código con Enter: en SKU y código de barras,
// Enter pasa al campo siguiente en vez de guardar el formulario a medias.
export function nextFieldOnEnter(e: {
  key: string;
  preventDefault: () => void;
  currentTarget: HTMLInputElement;
}) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const fields = Array.from(e.currentTarget.form?.elements ?? []).filter(
    (el): el is HTMLElement =>
      el.matches("input:not([type=hidden]), select, textarea") &&
      !(el as HTMLInputElement).disabled,
  );
  fields[fields.indexOf(e.currentTarget) + 1]?.focus();
}
