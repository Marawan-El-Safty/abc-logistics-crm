const ExcelJS = require('exceljs');

const NAVY = 'FF071428';
const GOLD = 'FFC9A84C';

exports.exportToExcel = async (sheetName, rows) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ABC Logistics CRM';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);

  if (!rows.length) {
    sheet.addRow(['No data available']);
    return workbook.xlsx.writeBuffer();
  }

  const headers = Object.keys(rows[0]);

  // Header row styling
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: GOLD } },
    };
  });
  headerRow.height = 25;

  // Data rows
  rows.forEach((row, idx) => {
    const dataRow = sheet.addRow(Object.values(row));
    if (idx % 2 === 0) {
      dataRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
      });
    }
    dataRow.eachCell((cell) => {
      cell.alignment = { vertical: 'middle' };
      cell.font = { size: 10 };
    });
    dataRow.height = 20;
  });

  // Auto-fit columns
  sheet.columns.forEach((col, i) => {
    const maxLen = Math.max(
      headers[i]?.length || 10,
      ...rows.map(r => String(Object.values(r)[i] || '').length)
    );
    col.width = Math.min(Math.max(maxLen + 4, 12), 40);
  });

  // SAFTYGROUP branding row at top
  sheet.spliceRows(1, 0, ['ABC Logistics CRM — ' + sheetName]);
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).font = { bold: true, color: { argb: NAVY }, size: 13 };
  titleRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  titleRow.height = 30;
  sheet.mergeCells(1, 1, 1, headers.length);

  return workbook.xlsx.writeBuffer();
};
