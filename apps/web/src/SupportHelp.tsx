// Botón «Ayuda» del producto: contacto de soporte (del servidor) y guías
// cortas en public/ayuda/*.md. El mensaje de WhatsApp lleva empresa, usuario y
// pantalla; nunca montos, clientes ni claves.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleHelp } from "lucide-react";
import { Modal } from "@fitstore/ui";
import { api, download } from "./api";
import { toast } from "./helpers";

export type SupportInfo = {
  whatsapp: string | null;
  email: string | null;
  hours: string | null;
  company: { name: string; slug: string } | null;
};

export const HELP_ARTICLES = [
  ["primera-venta", "Tu primera venta"],
  ["abrir-cerrar-caja", "Abrir y cerrar la caja"],
  ["cuadre-verifon", "Cuadre y lote del verifón"],
  ["productos-inventario", "Agregar productos e inventario"],
  ["clientes-credito", "Clientes y crédito"],
  ["anular-devolver", "Anular y devolver una venta"],
  ["usuarios-pin", "Usuarios y PIN"],
  ["respaldo-exportar", "Respaldo y exportar datos"],
] as const;

export function supportMessage(
  info: SupportInfo,
  userName: string,
  screen: string,
) {
  const company = info.company
    ? `${info.company.name} (código ${info.company.slug})`
    : "mi empresa";
  return `Hola, soy ${userName} de ${company}. Estoy en la pantalla «${screen}» de Nexora POS y necesito ayuda con: `;
}

export function SupportContent({
  info,
  userName,
  screen,
  onArticle,
  onExport,
}: {
  info: SupportInfo;
  userName: string;
  screen: string;
  onArticle: (slug: string) => void;
  onExport?: () => void;
}) {
  const text = encodeURIComponent(supportMessage(info, userName, screen));
  return (
    <div className="support-sheet">
      {info.whatsapp && (
        <a
          className="button primary"
          href={`https://wa.me/${info.whatsapp}?text=${text}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Escribir por WhatsApp
        </a>
      )}
      {info.email && (
        <p>
          Correo:{" "}
          <a
            href={`mailto:${info.email}?subject=${encodeURIComponent("Ayuda con Nexora POS")}&body=${text}`}
          >
            {info.email}
          </a>
        </p>
      )}
      {info.hours && <p>Horario de soporte: {info.hours}</p>}
      <h3>Cómo se hace…</h3>
      <ul>
        {HELP_ARTICLES.map(([slug, title]) => (
          <li key={slug}>
            <a
              href={`/ayuda/${slug}.md`}
              onClick={(e) => {
                e.preventDefault();
                onArticle(slug);
              }}
            >
              {title}
            </a>
          </li>
        ))}
      </ul>
      {onExport && (
        <button className="button secondary" onClick={onExport}>
          Descargar todos mis datos (Excel)
        </button>
      )}
    </div>
  );
}

export function SupportHelp({
  userName,
  screen,
  admin,
}: {
  userName: string;
  screen: string;
  admin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [article, setArticle] = useState<{
    title: string;
    text: string;
  } | null>(null);
  const info = useQuery({
    queryKey: ["support-info"],
    queryFn: () => api<SupportInfo>("/support-info"),
    enabled: open,
  });
  const showArticle = async (slug: string) => {
    const title = HELP_ARTICLES.find(([s]) => s === slug)?.[1] ?? "Ayuda";
    const response = await fetch(`/ayuda/${slug}.md`).catch(() => null);
    setArticle({
      title,
      text: response?.ok
        ? await response.text()
        : "No se pudo abrir la guía. Revisa tu conexión.",
    });
  };
  const close = () => {
    setOpen(false);
    setArticle(null);
  };
  return (
    <>
      <button
        className="icon-button"
        onClick={() => setOpen(true)}
        aria-label="Ayuda"
        title="Ayuda"
      >
        <CircleHelp size={19} />
      </button>
      <Modal open={open} onClose={close} title={article?.title ?? "Ayuda"}>
        {article ? (
          <>
            <div style={{ whiteSpace: "pre-wrap" }}>{article.text}</div>
            <button className="text-link" onClick={() => setArticle(null)}>
              ← Volver a Ayuda
            </button>
          </>
        ) : info.data ? (
          <SupportContent
            info={info.data}
            userName={userName}
            screen={screen}
            onArticle={showArticle}
            onExport={
              admin
                ? () =>
                    download(
                      "/tenant/export?format=xlsx",
                      "mis-datos-nexora.xlsx",
                    ).catch((e) => toast(e.message, true))
                : undefined
            }
          />
        ) : (
          <p>
            {info.isError
              ? "No se pudo cargar el contacto de soporte."
              : "Cargando…"}
          </p>
        )}
      </Modal>
    </>
  );
}
