import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const management = readFileSync(
  new URL("../apps/web/src/Management.tsx", import.meta.url),
  "utf8",
);

describe("presentación de reportes en Management", () => {
  it("traduce códigos, oculta columnas internas y muestra las filas preparadas", () => {
    expect(management).toContain("reportCellText");
    expect(management).toContain("reportColumnVisible");
    expect(management).toContain("reportDisplayRows");
    expect(management).toMatch(
      /\.filter\(\(k\) => k !== "class" && reportColumnVisible\(report, k\)\)/,
    );
    expect(management).toMatch(
      /reportCellText\(report, key, row\[key\]\)/,
    );
    expect(management).toContain("rows={displayRows}");
  });
});

it("revierte únicamente las cinco ediciones de Reportes y recupera la rama Tienda íntegra", () => {
  let restored = management;
  const edits = [
    {
      "before": "import { formatMoney, can } from \"@fitstore/shared\";\n",
      "after": "import {\n  formatMoney,\n  can,\n  reportCellText,\n  reportColumnVisible,\n  reportDisplayRows,\n} from \"@fitstore/shared\";\n"
    },
    {
      "before": "  const rows = query.data?.rows || [];\n",
      "after": "  const rows = query.data?.rows || [];\n  const displayRows = reportDisplayRows(report, rows);\n"
    },
    {
      "before": "    .filter((k) => k !== \"class\")\n",
      "after": "    .filter((k) => k !== \"class\" && reportColumnVisible(report, k))\n"
    },
    {
      "before": "      render: (row: any) =>\n        typeof row[key] === \"number\"\n          ? row[key].toLocaleString(en ? \"en-US\" : \"es-DO\", { maximumFractionDigits: 2 })\n          : String(row[key] ?? \"—\"),\n",
      "after": "      render: (row: any) => {\n        const value = reportCellText(report, key, row[key]);\n        return typeof value === \"number\"\n          ? value.toLocaleString(en ? \"en-US\" : \"es-DO\", {\n              maximumFractionDigits: 2,\n            })\n          : String(value ?? \"—\");\n      },\n"
    },
    {
      "before": "                rows={rows}\n                columns={columns}\n",
      "after": "                rows={displayRows}\n                columns={columns}\n"
    }
  ];
  for (const edit of [...edits].reverse()) {
    expect(restored.split(edit.after).length - 1).toBe(1);
    restored = restored.replace(edit.after, edit.before);
  }
  expect(createHash("sha256").update(restored).digest("hex")).toBe("0efc2e44a03fd2b38d88e266b4c62f15ffc2bd7bf092ba30690ddb584b5cedc5");
});
