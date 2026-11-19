// Sucursales (orden de la dueña, 19-nov): pantalla mínima y funcional en
// Configuración. Crear, renombrar, desactivar, asignar personas y cambiarse de
// sucursal. El diseño final lo hace el equipo de diseño; aquí sólo clases existentes.
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post, useStore } from "./api";
import { businessErrorMessage } from "./managementMessages";

export type BranchRow = {
  id: string;
  name: string;
  active: boolean;
  current: boolean;
  users: { id: string; name: string; role: string }[];
};

const patch = (path: string, data: unknown) =>
  api(path, { method: "PATCH", body: JSON.stringify(data) });

export function BranchSettings() {
  const client = useQueryClient();
  const me = useStore((state) => state.user?.id);
  // Sólo la administración («*») maneja sucursales; la API también lo exige.
  const admin = useStore((state) => !!state.user?.permissions?.includes("*"));
  const branches = useQuery<BranchRow[]>({
    queryKey: ["branches", me],
    queryFn: () => api("/branches"),
    enabled: admin,
  });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<unknown>, reload = false) => {
    setBusy(true);
    setError("");
    try {
      await action();
      // Al cambiarse de sucursal, todo lo que está en pantalla es de la otra.
      if (reload) window.location.reload();
      else await client.invalidateQueries({ queryKey: ["branches"] });
    } catch (cause) {
      setError(businessErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  const create = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await post("/branches", { name });
      setName("");
    });
  };
  if (!admin) return null;
  const rows = branches.data ?? [];
  const active = rows.filter((b) => b.active);
  return (
    <section aria-labelledby="branch-settings-title">
      <div className="panel-heading">
        <h3 id="branch-settings-title">Sucursales</h3>
      </div>
      <p className="cod-hint">
        Cada sucursal tiene su caja, inventario, clientes y numeración de
        facturas. La sucursal nueva copia los ajustes de la principal (nombre
        comercial, impuestos, moneda), no su inventario.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {branches.isError && (
        <p role="alert">No se pudieron cargar las sucursales.</p>
      )}
      <ul>
        {rows.map((branch) => (
          <li key={branch.id}>
            <strong>{branch.name}</strong>
            {branch.current && " · estás aquí"}
            {!branch.active && " · desactivada"}
            {branch.users.length > 0 && (
              <span> · {branch.users.map((u) => u.name).join(", ")}</span>
            )}
            <div>
              {branch.active && !branch.current && (
                <button
                  type="button"
                  className="text-link"
                  disabled={busy || !me}
                  onClick={() =>
                    void run(
                      () =>
                        post(`/branches/${branch.id}/users`, { userId: me }),
                      true,
                    )
                  }
                >
                  Cambiarme a esta sucursal
                </button>
              )}
              <button
                type="button"
                className="text-link"
                disabled={busy}
                onClick={() => {
                  const next = window.prompt(
                    "Nuevo nombre de la sucursal",
                    branch.name,
                  );
                  if (next && next.trim() !== branch.name)
                    void run(() =>
                      patch(`/branches/${branch.id}`, { name: next.trim() }),
                    );
                }}
              >
                Renombrar
              </button>
              {branch.id !== "main" && (
                <button
                  type="button"
                  className="text-link"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      patch(`/branches/${branch.id}`, {
                        active: !branch.active,
                      }),
                    )
                  }
                >
                  {branch.active ? "Desactivar" : "Activar"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <h4>Mover a una persona</h4>
      <ul>
        {rows.flatMap((branch) =>
          branch.users
            .filter((u) => u.id !== me)
            .map((user) => (
              <li key={user.id}>
                <label className="field">
                  <span>
                    {user.name} ({user.role})
                  </span>
                  <select
                    value={branch.id}
                    disabled={busy}
                    onChange={(e) =>
                      void run(() =>
                        post(`/branches/${e.target.value}/users`, {
                          userId: user.id,
                        }),
                      )
                    }
                  >
                    {active.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            )),
        )}
      </ul>
      <form onSubmit={create} className="form-grid">
        <label className="field">
          <span>Nombre de la sucursal nueva</span>
          <input
            required
            minLength={2}
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="button primary" disabled={busy}>
          Crear sucursal
        </button>
      </form>
    </section>
  );
}
