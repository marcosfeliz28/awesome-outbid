import { readFileSync } from "node:fs";

type Edit = { before: string; after: string };
const edits = JSON.parse(
  readFileSync("docs/auditoria-ui/DD-05_REVERSIBLE.json", "utf8"),
) as Edit[];

export function reverseDd05(source: string) {
  for (const edit of [...edits].reverse()) {
    const occurrences = source.split(edit.after).length - 1;
    if (occurrences !== 1)
      throw new Error(
        `DD-05: se esperaba una coincidencia reversible y hubo ${occurrences}`,
      );
    source = source.replace(edit.after, edit.before);
  }
  return source;
}
