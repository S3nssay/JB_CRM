import XLSX from "xlsx";
import path from "path";

const filePath = path.join("C:", "Users", "ziaa", "Dropbox", "ZA", "DOWNLOADS", "BUSINESS", "JOHN BARCLAY", "Documentation", "Managed_PropertyList_Data.xlsx");
console.log("Reading file:", filePath);

const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
const headers: string[] = [];
for (let col = range.s.c; col <= range.e.c; col++) {
  const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
  const cell = sheet[cellAddress];
  headers.push(cell ? String(cell.v) : "");
}

console.log("=== COLUMN HEADERS ===");
headers.forEach((h, i) => console.log(i + ": " + h));

const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log("\n=== FIRST 3 DATA ROWS ===");
for (let row = 1; row <= 3 && row < data.length; row++) {
  console.log("\nRow " + row + ":");
  const rowData = data[row] as any[];
  headers.forEach((h, i) => {
    if (rowData[i] !== undefined && rowData[i] !== null && rowData[i] !== "") {
      console.log("  [" + i + "] " + h + ": " + rowData[i]);
    }
  });
}

process.exit(0);

