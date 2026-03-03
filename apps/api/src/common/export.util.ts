import { buildSimplePdf } from "./pdf.util";

type ExportBuildInput = {
  title: string;
  generatedAtIso: string;
  headers: string[];
  rows: Array<Array<string | number | boolean | null | undefined>>;
};

const sanitize = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toCell = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "YES" : "NO";
  return String(value);
};

export function buildTablePdf(input: ExportBuildInput): Buffer {
  const lines: string[] = [input.title, `Generated At: ${input.generatedAtIso}`, ""];
  lines.push(input.headers.join(" | "));
  lines.push("-".repeat(Math.max(16, input.headers.join(" | ").length)));
  for (const row of input.rows) {
    lines.push(row.map((value) => toCell(value)).join(" | "));
  }
  return buildSimplePdf(lines);
}

export function buildExcelXml(input: ExportBuildInput): Buffer {
  const rowsXml: string[] = [];

  rowsXml.push(
    "<Row>",
    ...input.headers.map(
      (header) =>
        `<Cell ss:StyleID="header"><Data ss:Type="String">${sanitize(header)}</Data></Cell>`
    ),
    "</Row>"
  );

  for (const row of input.rows) {
    rowsXml.push(
      "<Row>",
      ...row.map((value) => {
        const raw = toCell(value);
        const asNumber = Number(raw);
        const isNumber = raw.length > 0 && Number.isFinite(asNumber) && `${asNumber}` === raw;
        return `<Cell><Data ss:Type="${isNumber ? "Number" : "String"}">${sanitize(raw)}</Data></Cell>`;
      }),
      "</Row>"
    );
  }

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#EAF5F2" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Export">
  <Table>
   ${rowsXml.join("")}
  </Table>
 </Worksheet>
</Workbook>`;

  return Buffer.from(workbook, "utf8");
}

export function toDataUrl(mimeType: string, payload: Buffer): string {
  return `data:${mimeType};base64,${payload.toString("base64")}`;
}
