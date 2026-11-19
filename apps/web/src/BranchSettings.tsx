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

export function isBranchPlanLimitMessage(message: string): boolean {
  return /^El plan .+ permite \d+ sucursal(?:es)?\./i.test(message.trim());
}

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
    <section
      className="branch-settings"
      aria-labelledby="branch-settings-title"
      aria-busy={branches.isLoading || busy}
    >
      <div className="branch-settings__heading">
        <div>
          <span className="branch-settings__eyebrow">Organización</span>
          <h3 id="branch-settings-title">Sucursales</h3>
        </div>
        <span className="branch-settings__count">
          {active.length} {active.length === 1 ? "activa" : "activas"}
        </span>
      </div>
      <p className="branch-settings__intro">
        Cada sucursal tiene su caja, inventario, clientes y numeración de
        facturas. La sucursal nueva copia los ajustes de la principal (nombre
        comercial, impuestos, moneda), no su inventario.
      </p>
      {error && (
        <p
          className={
            isBranchPlanLimitMessage(error)
              ? "form-error branch-plan-message"
              : "form-error"
          }
          role="alert"
        >
          {error}
        </p>
      )}
      {branches.isError && (
        <p className="form-error" role="alert">
          No se pudieron cargar las sucursales.
        </p>
      )}
      {branches.isLoading && (
        <p className="branch-settings__state" role="status">
          Cargando sucursales…
        </p>
      )}
      {!branches.isLoading && !branches.isError && rows.length === 0 && (
        <p className="branch-settings__state" role="status">
          Todavía no hay sucursales para mostrar.
        </p>
      )}
      <ul className="branch-grid" aria-label="Sucursales registradas">
        {rows.map((branch) => (
          <li
            key={branch.id}
            className={`branch-card${branch.current ? " branch-card--current" : ""}${!branch.active ? " branch-card--inactive" : ""}`}
          >
            <div className="branch-card__heading">
              <div>
                <strong>{branch.name}</strong>
                {branch.current && " · estás aquí"}
                {!branch.active && " · desactivada"}
              </div>
              <span
                className={`branch-status${branch.active ? " branch-status--active" : " branch-status--inactive"}`}
              >
                {branch.current
                  ? "Sucursal actual"
                  : branch.active
                    ? "Activa"
                    : "Desactivada"}
              </span>
            </div>
            <div className="branch-card__people">
              <span className="branch-card__label">Personas asignadas</span>
              {branch.users.length > 0 ? (
                <ul>
                  {branch.users.map((user) => (
                    <li key={user.id}>
                      <span className="branch-person-avatar" aria-hidden="true">
                        {user.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <span>
                        <strong>{user.name}</strong>
                        <small>{user.role}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="branch-card__empty">
                  Sin personas asignadas
                </span>
              )}
            </div>
            <div className="branch-card__actions">
              {branch.active && !branch.current && (
                <button
                  type="button"
                  className="button secondary"
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
                className="button secondary"
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
                  className="button secondary"
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
      <div className="branch-settings__tools">
        <section
          className="branch-tool-card"
          aria-labelledby="move-person-title"
        >
          <div className="branch-tool-card__heading">
            <h4 id="move-person-title">Asignar personas</h4>
            <p>Mueve cada persona a la sucursal donde trabaja.</p>
          </div>
          <ul className="branch-people-list">
            {rows.flatMap((branch) =>
              branch.users
                .filter((u) => u.id !== me)
                .map((user) => (
                  <li key={user.id}>
                    <label className="branch-person-assignment field">
                      <span>
                        {user.name} ({user.role})
                      </span>
                      <select
                        value={branch.id}
                        disabled={busy}
                        aria-label={`Sucursal de ${user.name}`}
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
        </section>
        <section
          className="branch-tool-card"
          aria-labelledby="new-branch-title"
        >
          <div className="branch-tool-card__heading">
            <h4 id="new-branch-title">Nueva sucursal</h4>
            <p>Comienza con los ajustes de la sucursal principal.</p>
          </div>
          <form onSubmit={create} className="branch-create-form">
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
      </div>
    </section>
  );
}
