import { useEffect, useState } from "react";
import { Button, Modal } from "@fitstore/ui";
import { toast } from "./helpers";
import { isNativeDesktop, nativeOpenDrawer, nativePrintCurrentSheet, nativePrintTest,
  nativePrinters, selectPrinter, selectedPrinter } from "./desktopPrinter";

export function DesktopPrinterControls() {
  const [open, setOpen] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selected, setSelected] = useState(selectedPrinter);
  const native = isNativeDesktop();

  useEffect(() => {
    if (!native) return;
    const browserPrint = window.print.bind(window);
    window.print = () => {
      if (!document.querySelector(".thermal-print")) { browserPrint(); return; }
      void nativePrintCurrentSheet().catch((error) => toast(String(error?.message ?? error), true));
    };
    return () => { window.print = browserPrint; };
  }, [native]);

  if (!native) return null;
  const show = async () => {
    setOpen(true);
    try { setPrinters(await nativePrinters()); }
    catch (error: any) { toast(String(error?.message ?? error), true); }
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
      <div className="form-actions">
        <Button type="button" onClick={() => void nativePrintTest().then(() => toast("Ticket de prueba enviado.")).catch((e) => toast(String(e?.message ?? e), true))}>Imprimir prueba</Button>
        <Button type="button" variant="secondary" onClick={() => void nativeOpenDrawer().then(() => toast("Orden de apertura enviada.")).catch((e) => toast(String(e?.message ?? e), true))}>Abrir gaveta</Button>
      </div>
    </Modal>
  </>;
}
