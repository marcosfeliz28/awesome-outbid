export function EmptyIllustration({ kind }: { kind: "carrito" | "inventario" | "reportes" }) {
  return <img src={`/ilustraciones/vacio-${kind}.svg`} alt="" aria-hidden="true" width={144} height={96} style={{ display: "block", maxWidth: "100%", height: "auto", marginInline: "auto" }} />;
}
