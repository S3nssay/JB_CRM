import XLSX from 'xlsx';

export function generateExcel(
  data: Record<string, any>[],
  options?: {
    title?: string;
    sheetName?: string;
    dateRange?: { from: string; to: string };
  }
): Buffer {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [];

  if (options?.title) {
    rows.push([options.title]);
    if (options.dateRange) {
      rows.push([`Period: ${options.dateRange.from} to ${options.dateRange.to}`]);
    }
    rows.push([]);
  }

  const ws = XLSX.utils.json_to_sheet(data.length > 0 ? data : [{}], {
    origin: rows.length > 0 ? rows.length : 0,
  } as any);

  if (rows.length > 0) {
    for (let i = 0; i < rows.length; i++) {
      XLSX.utils.sheet_add_aoa(ws, [rows[i]], { origin: { r: i, c: 0 } });
    }
  }

  const sheetName = (options?.sheetName || 'Report').substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
