import { formatCurrency } from './formatters';

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function buildExportRows(cases, statusLabelMap) {
  return cases.map((item) => [
    item.case_id,
    item.uid,
    item.application_code,
    item.debtor_name,
    item.household_address,
    item.province,
    item.city,
    formatCurrency(item.entrusted_principal_balance),
    item.disposal_type,
    statusLabelMap[item.case_status] ?? '未知',
  ]);
}

function buildFileName() {
  const now = new Date();
  const pad = (num) => String(num).padStart(2, '0');

  return `case_assignment_detail_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;
}

export function exportCasesToCsv({ cases, columns, statusLabelMap }) {
  if (!cases.length) {
    window.alert('暂无可导出的数据');
    return;
  }

  const headers = columns.map((col) => col.label);
  const rows = buildExportRows(cases, statusLabelMap);
  const csvText = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');

  const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildFileName();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
