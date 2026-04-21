import React from 'react';
import { CASE_STATUS_LABEL, CASE_TABLE_COLUMNS } from '../../constants/caseConfig';
import { formatCurrency } from '../../utils/formatters';

function disposalBadgeClass(type) {
  if (type === '散诉') {
    return 'bg-orange-50 text-orange-600 border-orange-100';
  }
  if (type === '保全') {
    return 'bg-blue-50 text-blue-600 border-blue-100';
  }
  return 'bg-gray-50 text-gray-600 border-gray-100';
}

function statusTextClass(status) {
  if (status === 2) return 'text-green-600';
  if (status === 1) return 'text-yellow-600';
  if (status === 4) return 'text-amber-600';
  if (status === 3) return 'text-red-600';
  if (status === -2) return 'text-red-600';
  if (status === -1) return 'text-orange-600';
  return 'text-blue-600';
}

function statusDotClass(status) {
  if (status === 2) return 'bg-green-500';
  if (status === 1) return 'bg-yellow-500 animate-pulse';
  if (status === 4) return 'bg-amber-500';
  if (status === 3) return 'bg-red-500';
  if (status === -2) return 'bg-red-500';
  if (status === -1) return 'bg-orange-500';
  return 'bg-blue-500';
}

function CasesTable({ cases, isLoading, onViewDetail, onEdit }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[1400px] text-left">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {CASE_TABLE_COLUMNS.map((col) => (
              <th key={col.key} className="sticky top-0 z-10 px-6 py-4 text-xs font-bold text-gray-500 uppercase bg-gray-50">
                {col.label}
              </th>
            ))}
            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center sticky top-0 right-0 z-20 bg-gray-50 border-l border-gray-100">
              操作
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {isLoading && (
            <tr>
              <td className="px-6 py-6 text-sm text-gray-500" colSpan={11}>
                加载中...
              </td>
            </tr>
          )}

          {!isLoading && cases.length === 0 && (
            <tr>
              <td className="px-6 py-6 text-sm text-gray-500" colSpan={11}>
                暂无匹配数据
              </td>
            </tr>
          )}

          {!isLoading &&
            cases.map((item) => (
              <tr key={String(item.id ?? `${item.case_id}-${item.uid}`)} className="group hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm font-semibold text-gray-800">{item.case_id ?? '-'}</td>
                <td className="px-6 py-4 text-xs text-gray-600 font-mono">{item.uid ?? '-'}</td>
                <td className="px-6 py-4 text-xs text-gray-600 font-mono">{item.application_code ?? '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{item.debtor_name ?? '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{item.household_address ?? '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{item.province ?? '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{item.city ?? '-'}</td>
                <td className="px-6 py-4 text-sm font-semibold text-gray-800">{formatCurrency(item.entrusted_principal_balance)}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-md font-bold border ${disposalBadgeClass(item.disposal_type)}`}>
                    {item.disposal_type ?? '-'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`flex items-center text-sm ${statusTextClass(item.case_status)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-2 ${statusDotClass(item.case_status)}`} />
                    {CASE_STATUS_LABEL[item.case_status] ?? '未知'}
                  </span>
                </td>
                <td className="px-6 py-4 sticky right-0 bg-white group-hover:bg-gray-50 border-l border-gray-100">
                  <div className="flex items-center justify-center gap-4 whitespace-nowrap">
                    <button type="button" onClick={() => onViewDetail?.(item)} className="text-blue-600 hover:underline font-medium text-sm">
                      详情
                    </button>
                    <button type="button" onClick={() => onEdit?.(item)} className="text-indigo-600 hover:underline font-medium text-sm">
                      编辑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export default CasesTable;
