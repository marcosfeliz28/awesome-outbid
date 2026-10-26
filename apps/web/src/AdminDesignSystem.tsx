import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Loading,
  Modal,
  TableFrame,
} from "@fitstore/ui";

// Catálogo interno de desarrollo. No es una ruta pública ni un flujo de negocio.
export function AdminDesignSystem() {
  const [dialog, setDialog] = useState(false);
  return (
    <div className="lumina-specimens">
      <header className="page-heading">
        <div>
          <div className="eyebrow">SISTEMA DE DISEÑO · FASE 1</div>
          <h1>Obsidian Lumina</h1>
          <p>Jerarquía tranquila. Controles claros. Espacio para decidir.</p>
        </div>
      </header>
      <Card title="Superficies y acciones">
        <p>
          Ejemplos visuales de desarrollo. No guardan datos ni ejecutan
          operaciones.
        </p>
        <div className="swatch-grid">
          {[
            ["Base", "#05050A"],
            ["Superficie", "#0E1320"],
            ["Esmeralda", "#43E3B1"],
            ["Violeta", "#8B5CF6"],
          ].map(([label, color]) => (
            <div key={label}>
              <div style={{ background: color }} />
              <strong>{label}</strong>
              <small>{color}</small>
            </div>
          ))}
        </div>
        <div className="style-row">
          <Button onClick={() => setDialog(true)}>
            Abrir ejemplo de diálogo
          </Button>
          <Button variant="secondary" disabled>
            Acción no disponible
          </Button>
          <Badge tone="success">Disponible</Badge>
          <Badge tone="warning">Requiere revisión</Badge>
          <Badge tone="danger">Error</Badge>
        </div>
      </Card>
      <Card title="Formularios con contexto">
        <Field
          label="Nombre de referencia"
          defaultValue="Sucursal de ejemplo"
          hint="Etiqueta explícita y ayuda asociada al campo."
        />
        <Field
          label="Código de referencia"
          defaultValue=""
          error="Escribe un código para continuar."
        />
        <Alert title="Aviso de ejemplo" tone="warning">
          Los estados siempre incluyen texto además del color.
        </Alert>
      </Card>
      <Card title="Tablas legibles">
        <TableFrame label="Ejemplo de estados">
          <table>
            <caption>Datos ficticios para revisión visual</caption>
            <thead>
              <tr>
                <th scope="col">Concepto</th>
                <th scope="col">Estado</th>
                <th scope="col" className="right">
                  Cantidad
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Referencia A</th>
                <td>
                  <Badge tone="success">Disponible</Badge>
                </td>
                <td className="right amount">24</td>
              </tr>
              <tr>
                <th scope="row">Referencia B</th>
                <td>
                  <Badge tone="warning">Revisar</Badge>
                </td>
                <td className="right amount">3</td>
              </tr>
            </tbody>
          </table>
        </TableFrame>
      </Card>
      <Card title="Estados de la interfaz">
        <Empty
          title="Todavía no hay registros"
          description="Al registrar el primer elemento, aparecerá aquí."
        />
        <Loading />
      </Card>
      <Modal
        open={dialog}
        onClose={() => setDialog(false)}
        title="Diálogo de ejemplo"
      >
        <p>
          Tab recorre los controles. Escape cierra y devuelve el foco al botón
          de origen.
        </p>
        <Field label="Nota de ejemplo" hint="Este campo no envía datos." />
        <Button onClick={() => setDialog(false)}>Cerrar ejemplo</Button>
      </Modal>
    </div>
  );
}
