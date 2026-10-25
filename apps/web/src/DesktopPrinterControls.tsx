import { useEffect, useState } from "react";
import { Button, Modal } from "@fitstore/ui";
import { can } from "@fitstore/shared";
import { useStore } from "./api";
import { toast } from "./helpers";
import { isNativeDesktop, nativeOpenDrawer, nativePrintCurrentSheet, nativePrintTest,
  nativePrinters, printNotice, selectPrinter, selectedPrinter } from "./desktopPrinter";

export function DesktopPrinterControls() {
  const [open, setOpen] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selected, setSelected] = useState(selectedPrinter);
  const [referenceType, setReferenceType] = useState<"saleId" | "movementId">("saleId");
  const [referenceId, setReferenceId] = useState("");
  const [reason, setReason] = useState("");
  const { user, token } = useStore();
  const native = isNativeDesktop();
  const canOpenDrawer = can(user?.permissions ?? [], "cash:drawer");

  useEffect(() => {
    if (!native) return;
    const browserPrint = window.print.bind(window);
    window.print = () => {
      if (!document.querySelector(".thermal-print")) { browserPrint(); return; }
      void nativePrintCurrentSheet().catch((error) => { const n = printNotice(error); toast(n.message, n.error); });
    };
    return () => { window.print = browserPrint; };
  }, [native]);

  if (!native) return null;
  const show = async () => {
    setOpen(true);
    try { setPrinters(await nativePrinters()); }
    catch (error: any) { toast(String(error?.message ?? error), true); }
  };
  const openDrawer = async () => {
    if (!token) throw new Error("La sesión no permite autorizar la gaveta.");
    await nativeOpenDrawer({ accessToken: token, [referenceType]: referenceId.trim(), reason: reason.trim() });
    setReferenceId("");
    setReason("");
    toast("Apertura registrada y enviada.");
  };
  return <>
    <button className="nav-item" onClick={() => void show()}>Impresora térmica</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Impresora térmica · este equipo">
      <p>Selecciona la impresora de tickets de 80 mm instalada en Windows. Los tickets se enviarán directamente.</p>
      <label className="field"><span>Impresora</span>
        <select value={selected} onChange={(event) => { const name = event.target.value; selectPrinter(name); setSelected(name); }}>
          <option value="">Seleccionar…</option>
          {printers.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      {!printers.length && <p role="status">Windows no encontró impresoras. Conecta e instala la térmica y abre este menú de nuevo.</p>}
      {canOpenDrawer && <>
        <label className="field">
          <span>Tipo de referencia para abrir la gaveta</span>
          <select value={referenceType} onChange={(event) => setReferenceType(event.target.value as "saleId" | "movementId")}>
            <option value="saleId">Venta en efectivo</option>
            <option value="movementId">Movimiento de caja</option>
          </select>
        </label>
        <label className="field">
          <span>ID obligatorio de la venta o movimiento</span>
          <input value={referenceId} onChange={(event) => setReferenceId(event.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
        </label>
        <label className="field">
          <span>Motivo de la apertura (obligatorio, mínimo 5 caracteres)</span>
          <input value={reason} required minLength={5} maxLength={200} aria-required="true"
            onChange={(event) => setReason(event.target.value)} placeholder="Ej.: cliente pidió cambio" />
        </label>
      </>}
      <div className="form-actions">
        <Button type="button" onClick={() => void nativePrintTest().then(() => toast("Ticket de prueba enviado.")).catch((e) => toast(String(e?.message ?? e), true))}>Imprimir prueba</Button>
        {canOpenDrawer && <Button type="button" variant="secondary" disabled={!referenceId.trim() || reason.trim().length < 5} onClick={() => void openDrawer().catch((e) => toast(String(e?.message ?? e), true))}>Abrir gaveta</Button>}
      </div>
    </Modal>
  </>;
}
