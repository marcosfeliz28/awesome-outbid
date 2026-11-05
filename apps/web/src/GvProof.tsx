// GV · foto del voucher/comprobante y aviso «abre tu caja» (orden de la dueña, 5-nov).
// La foto se lee en el navegador y se manda solo a nuestro servidor.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { can } from "@fitstore/shared";
import { api, useStore } from "./api";

const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX = 2 * 1024 * 1024;

/** Lee la foto como data URL; el servidor vuelve a validar el tipo real. */
export function readGvProof(file: File): Promise<string> {
  if (!TYPES.includes(file.type))
    return Promise.reject(
      new Error("Sube una foto (JPG, PNG o WebP) o un PDF."),
    );
  if (file.size > MAX)
    return Promise.reject(
      new Error("La foto pesa más de 2 MB. Toma otra más liviana."),
    );
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("No se pudo leer la foto. Intenta de nuevo."));
    reader.readAsDataURL(file);
  });
}

/** Campo de foto: muestra qué falta y confirma cuando ya está. */
export function GvProofField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const [error, setError] = useState("");
  return (
    <label className="field full">
      <span>{label}</span>
      <input
        type="file"
        accept={TYPES.join(",")}
        onChange={async (e) => {
          setError("");
          const file = e.target.files?.[0];
          if (!file) return onChange("");
          try {
            onChange(await readGvProof(file));
          } catch (cause: any) {
            onChange("");
            e.target.value = "";
            setError(cause.message);
          }
        }}
      />
      {error ? (
        <small role="alert">{error}</small>
      ) : (
        <small>
          {value ? "✓ Foto lista." : "Falta la foto: sin ella no se guarda."}
        </small>
      )}
    </label>
  );
}

/** ¿Hay caja GV abierta? Sin ella no se cobra (la dueña, solo con motivo). */
export function useGvCajaGuard() {
  const user = useStore((s) => s.user);
  const cash = useQuery<{ id: string } | null>({
    queryKey: ["gv-cash"],
    queryFn: async () => (await api("/gv/cash/current")) || null,
  });
  const owner = can(user?.permissions ?? [], "*");
  const [reason, setReason] = useState("");
  const noCash = cash.isSuccess && !cash.data;
  return {
    noCash,
    owner,
    reason,
    setReason,
    // Clary no puede guardar sin caja; la dueña, solo con el motivo escrito.
    blocked: noCash && (!owner || reason.trim().length < 3),
  };
}

export function GvCajaGuardNotice({
  guard,
}: {
  guard: ReturnType<typeof useGvCajaGuard>;
}) {
  if (!guard.noCash) return null;
  return guard.owner ? (
    <label className="field full">
      <span>Cobras sin caja abierta: escribe el motivo</span>
      <input
        value={guard.reason}
        onChange={(e) => guard.setReason(e.target.value)}
      />
    </label>
  ) : (
    <p className="form-error full" role="alert">
      Abre tu caja de GV antes de cobrar (pestaña «Caja GV»).
    </p>
  );
}
