import React from 'react';
import { CASE_STATUS_OPTIONS, DISPOSAL_TYPE_OPTIONS } from '../../constants/caseConfig';

function CasesToolbar({
  disposalType,
  caseStatus,
  onDisposalTypeChange,
  onCaseStatusChange,
  onRefresh,
  onOpenExcelRecords,
  isLoading,
}) {
  return (
    <header className="sticky top-0 z-30 mb-6 flex flex-col gap-4 border-b border-gray-200 bg-gray-50/95 pb-4 pt-1 backdrop-blur">
      <div>
        <h2 className="text-3xl font-extrabold text-gray-800">案件明细管理</h2>
        <p className="text-gray-500 mt-2">对应数据库：case_assignment_detail</p>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={disposalType}
            onChange={(event) => onDisposalTypeChange(event.target.value)}
            className="px-4 py-2 border rounded-lg text-sm w-full sm:w-52 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {DISPOSAL_TYPE_OPTIONS.map((option) => (
              <option key={option.value || 'all-disposal'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={caseStatus}
            onChange={(event) => onCaseStatusChange(event.target.value)}
            className="px-4 py-2 border rounded-lg text-sm w-full sm:w-52 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {CASE_STATUS_OPTIONS.map((option) => (
              <option key={String(option.value || 'all-status')} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 xl:ml-auto">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? '刷新中...' : '刷新'}
          </button>
          <button
            type="button"
            onClick={onOpenExcelRecords}
            disabled={isLoading}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Excel记录
          </button>
        </div>
      </div>
    </header>
  );
}

export default CasesToolbar;
