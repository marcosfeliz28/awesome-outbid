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
