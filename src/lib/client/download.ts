/** Client-side file download helpers for dashboard exports. */

export function downloadTextFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown) {
  downloadTextFile(filename, `${JSON.stringify(data, null, 2)}\n`, "application/json");
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = rows
    .map((row) => row.map((cell) => escape(cell == null ? "" : String(cell))).join(","))
    .join("\n");
  downloadTextFile(filename, `${csv}\n`, "text/csv;charset=utf-8");
}
