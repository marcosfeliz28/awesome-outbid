import { Fragment, type ReactNode } from "react";

// Markdown mínimo de las respuestas del asistente: negritas, listas, tablas
// simples y saltos de línea. Solo crea elementos React (nunca HTML crudo), así
// un texto como «<img onerror>» se muestra tal cual.
function inline(text: string, key: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
        <strong key={key + i}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={key + i}>{part}</Fragment>
      ),
    );
}
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
const isTable = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isSeparator = (line: string) =>
  /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const bullet = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function renderMarkdown(text: string): ReactNode[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const key = "b" + i;
    if (isTable(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && isTable(lines[i]); i++)
        rows.push(cells(lines[i]));
      out.push(
        <div key={key} className="assistant-table">
          <table>
            <thead>
              <tr>
                {head.map((cell, c) => (
                  <th key={c} scope="col">
                    {inline(cell, key + "h" + c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{inline(cell, key + r + "c" + c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (bullet.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      for (; i < lines.length && bullet.test(lines[i]); i++)
        items.push(lines[i].replace(bullet, ""));
      const List = ordered ? "ol" : "ul";
      out.push(
        <List key={key}>
          {items.map((item, n) => (
            <li key={n}>{inline(item, key + "l" + n)}</li>
          ))}
        </List>,
      );
      continue;
    }
    // La primera línea siempre se consume: una fila «|…|» sin separador es texto.
    const block: string[] = [];
    do block.push(lines[i++].replace(/^\s*#{1,6}\s+(.*)$/, "**$1**"));
    while (
      i < lines.length &&
      lines[i].trim() &&
      !bullet.test(lines[i]) &&
      !isTable(lines[i])
    );
    out.push(
      <p key={key}>
        {block.flatMap((part, n) => [
          ...(n ? [<br key={key + "br" + n} />] : []),
          ...inline(part, key + "p" + n),
        ])}
      </p>,
    );
  }
  return out;
}
