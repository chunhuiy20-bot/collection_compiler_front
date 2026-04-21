import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CASE_STATUS_LABEL } from '../../constants/caseConfig';
import { CASE_STATUS_OPTIONS, DISPOSAL_TYPE_OPTIONS } from '../../constants/caseConfig';
import { exportCasesByHash, listCasesByHash, listExcelFileRecords } from '../../services/excelUploadService';
import { formatCurrency } from '../../utils/formatters';

const EXCEL_RECORD_MODAL_STATE_KEY = 'excel_record_modal_state_v1';

function formatFileSize(bytes) {
  const size = Number(bytes ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function readPersistedModalState() {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(EXCEL_RECORD_MODAL_STATE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function getInitialModalState() {
  const persisted = readPersistedModalState();
  const recordPage = Number(persisted?.recordPage);
  const casesPage = Number(persisted?.casesPage);

  return {
    recordPage: Number.isInteger(recordPage) && recordPage > 0 ? recordPage : 1,
    casesPage: Number.isInteger(casesPage) && casesPage > 0 ? casesPage : 1,
    filterDisposalType: typeof persisted?.filterDisposalType === 'string' ? persisted.filterDisposalType : '',
    filterCaseStatus: typeof persisted?.filterCaseStatus === 'string' ? persisted.filterCaseStatus : '',
    selectedRecordHash: typeof persisted?.selectedRecordHash === 'string' ? persisted.selectedRecordHash : '',
  };
}

function ExcelRecordDataModal({ open, onClose }) {
  const initialState = useMemo(() => getInitialModalState(), []);
  const [recordItems, setRecordItems] = useState([]);
  const [recordPage, setRecordPage] = useState(initialState.recordPage);
  const [recordPageSize] = useState(20);
  const [recordTotal, setRecordTotal] = useState(0);
  const [recordLoading, setRecordLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedRecordHash, setSelectedRecordHash] = useState(initialState.selectedRecordHash);

  const [casesItems, setCasesItems] = useState([]);
  const [casesPage, setCasesPage] = useState(initialState.casesPage);
  const [casesPageSize] = useState(20);
  const [casesTotal, setCasesTotal] = useState(0);
  const [casesLoading, setCasesLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [excludedCaseIds, setExcludedCaseIds] = useState([]);
  const [filterDisposalType, setFilterDisposalType] = useState(initialState.filterDisposalType);
  const [filterCaseStatus, setFilterCaseStatus] = useState(initialState.filterCaseStatus);
  const [casesJumpInput, setCasesJumpInput] = useState(String(initialState.casesPage));
  const [exporting, setExporting] = useState(false);
  const hasInitializedSelectedHash = useRef(false);

  const recordTotalPages = useMemo(() => Math.max(1, Math.ceil(recordTotal / recordPageSize)), [recordTotal, recordPageSize]);
  const casesTotalPages = useMemo(() => Math.max(1, Math.ceil(casesTotal / casesPageSize)), [casesTotal, casesPageSize]);

  useEffect(() => {
    if (!open) {
      hasInitializedSelectedHash.current = false;
      return;
    }
    setCasesItems([]);
    setErrorMessage('');
    setExcludedCaseIds([]);
  }, [open]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const payload = {
      recordPage,
      casesPage,
      filterDisposalType,
      filterCaseStatus,
      selectedRecordHash,
    };
    window.localStorage.setItem(EXCEL_RECORD_MODAL_STATE_KEY, JSON.stringify(payload));
  }, [recordPage, casesPage, filterDisposalType, filterCaseStatus, selectedRecordHash]);

  useEffect(() => {
    let cancelled = false;
    async function fetchExcelRecords() {
      if (!open) {
        return;
      }

      setRecordLoading(true);
      try {
        const result = await listExcelFileRecords({
          page: recordPage,
          pageSize: recordPageSize,
          fileType: 'excel',
        });
        if (cancelled) {
          return;
        }
        setRecordItems(result.items);
        setRecordTotal(result.total);
        if (result.page && result.page !== recordPage) {
          setRecordPage(result.page);
        }
      } catch (error) {
        if (!cancelled) {
          setRecordItems([]);
          setRecordTotal(0);
          setErrorMessage(error?.message || '查询Excel记录失败');
        }
      } finally {
        if (!cancelled) {
          setRecordLoading(false);
        }
      }
    }

    fetchExcelRecords();
    return () => {
      cancelled = true;
    };
  }, [open, recordPage, recordPageSize]);

  useEffect(() => {
    if (!open || recordLoading) {
      return;
    }
    if (recordItems.length === 0) {
      setSelectedRecord(null);
      setSelectedRecordHash('');
      return;
    }
    const targetByHash = selectedRecordHash
      ? recordItems.find((item) => String(item.file_hash) === String(selectedRecordHash))
      : null;
    const hasSelected = selectedRecord && recordItems.some((item) => String(item.id) === String(selectedRecord.id));
    if (targetByHash) {
      setSelectedRecord(targetByHash);
      return;
    }
    if (!hasSelected) {
      setSelectedRecord(recordItems[0]);
      setSelectedRecordHash(String(recordItems[0].file_hash ?? ''));
    }
  }, [open, recordLoading, recordItems, selectedRecord, selectedRecordHash]);

  useEffect(() => {
    if (!selectedRecord?.file_hash) {
      return;
    }
    setSelectedRecordHash(String(selectedRecord.file_hash));
  }, [selectedRecord?.file_hash]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!selectedRecord?.file_hash) {
      return;
    }
    if (!hasInitializedSelectedHash.current) {
      hasInitializedSelectedHash.current = true;
      return;
    }
    setCasesPage(1);
    setExcludedCaseIds([]);
    setFilterDisposalType('');
    setFilterCaseStatus('');
    setCasesJumpInput('1');
  }, [open, selectedRecord?.file_hash]);

  useEffect(() => {
    setCasesJumpInput(String(casesPage));
  }, [casesPage]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setCasesPage(1);
  }, [open, filterDisposalType, filterCaseStatus]);

  const filteredCases = useMemo(() => casesItems, [casesItems]);

  const filteredCaseIds = useMemo(() => filteredCases.map((item) => String(item.id)), [filteredCases]);
  const checkedCountInFiltered = useMemo(
    () => filteredCaseIds.filter((id) => excludedCaseIds.includes(id)).length,
    [filteredCaseIds, excludedCaseIds],
  );
  const allFilteredChecked = filteredCaseIds.length > 0 && checkedCountInFiltered === filteredCaseIds.length;
  const partialFilteredChecked = checkedCountInFiltered > 0 && checkedCountInFiltered < filteredCaseIds.length;

  function handleToggleExclude(caseId) {
    setExcludedCaseIds((current) => {
      const key = String(caseId);
      if (current.includes(key)) {
        return current.filter((id) => id !== key);
      }
      return [...current, key];
    });
  }

  function handleToggleExcludeAll() {
    setExcludedCaseIds((current) => {
      if (allFilteredChecked) {
        return current.filter((id) => !filteredCaseIds.includes(id));
      }

      const next = new Set(current);
      filteredCaseIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }

  async function handleExportExcel() {
    const fileHash = selectedRecord?.file_hash ?? null;
    if (!fileHash) {
      window.alert('缺少 file_hash，无法导出');
      return;
    }

    setExporting(true);
    try {
      const { blob, filename } = await exportCasesByHash({
        fileHash,
        excludeIds: excludedCaseIds,
        order: 'asc',
        sortBy: 'case_status',
      });

      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename || 'cases_export.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      window.alert(error?.message || '导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  }

  function handleCasesJumpPage() {
    const target = Number(casesJumpInput);
    if (!Number.isInteger(target)) {
      setCasesJumpInput(String(casesPage));
      return;
    }
    const safePage = Math.min(Math.max(target, 1), casesTotalPages);
    setCasesPage(safePage);
  }

  useEffect(() => {
    let cancelled = false;
    async function fetchCasesByHash() {
      if (!open || !selectedRecord?.file_hash) {
        setCasesItems([]);
        setCasesTotal(0);
        return;
      }

      setCasesLoading(true);
      try {
        const result = await listCasesByHash({
          fileHash: selectedRecord.file_hash,
          page: casesPage,
          pageSize: casesPageSize,
          disposalType: filterDisposalType,
          caseStatus: filterCaseStatus,
        });

        if (cancelled) {
          return;
        }
        setCasesItems(result.items);
        setCasesTotal(result.total);
        if (result.page && result.page !== casesPage) {
          setCasesPage(result.page);
        }
      } catch (error) {
        if (!cancelled) {
          setCasesItems([]);
          setCasesTotal(0);
          setErrorMessage(error?.message || '按hash查询案件失败');
        }
      } finally {
        if (!cancelled) {
          setCasesLoading(false);
        }
      }
    }

    fetchCasesByHash();
    return () => {
      cancelled = true;
    };
  }, [open, selectedRecord?.file_hash, casesPage, casesPageSize, filterDisposalType, filterCaseStatus]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Excel记录与数据查看</h3>
            <p className="mt-1 text-sm text-gray-500">左侧选择Excel记录，右侧展示对应案件数据</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-800">
            关闭
          </button>
        </div>

        {errorMessage && <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</div>}

        <div className="min-h-0 flex-1 overflow-hidden p-6">
          <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
            <div className="min-h-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 flex flex-col">
              <div className="border-b border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800">Excel记录</div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {recordLoading && <div className="text-sm text-gray-500">加载记录中...</div>}
                {!recordLoading && recordItems.length === 0 && <div className="text-sm text-gray-500">暂无Excel记录</div>}
                {!recordLoading &&
                  recordItems.map((item) => (
                    <button
                      key={String(item.id)}
                      type="button"
                      onClick={() => setSelectedRecord(item)}
                      className={`mb-2 w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        selectedRecord?.id === item.id ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200'
                      }`}
                    >
                      <div className="truncate text-sm font-semibold text-gray-800">{item.filename}</div>
                      <div className="mt-1 truncate text-xs text-gray-500">{item.file_hash}</div>
                      <div className="mt-1 text-xs text-gray-500">{formatFileSize(item.file_size)}</div>
                    </button>
                  ))}
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                <span>
                  第 {recordPage}/{recordTotalPages} 页 · 共 {recordTotal} 条
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRecordPage((prev) => Math.max(1, prev - 1))}
                    disabled={recordLoading || recordPage <= 1}
                    className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordPage((prev) => Math.min(recordTotalPages, prev + 1))}
                    disabled={recordLoading || recordPage >= recordTotalPages}
                    className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 overflow-hidden rounded-xl border border-gray-200 bg-white flex flex-col">
              <div className="border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Excel数据</div>
                    <div className="mt-1 truncate text-xs text-gray-500">当前文件: {selectedRecord?.filename || '-'}</div>
                    <div className="mt-1 text-xs text-gray-500">已排除: {excludedCaseIds.length} 条</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={!selectedRecord || exporting}
                    className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {exporting ? '导出中...' : '导出Excel'}
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <select
                    value={filterDisposalType}
                    onChange={(event) => setFilterDisposalType(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-52"
                  >
                    {DISPOSAL_TYPE_OPTIONS.map((option) => (
                      <option key={option.value || 'all-disposal'} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterCaseStatus}
                    onChange={(event) => setFilterCaseStatus(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-52"
                  >
                    {CASE_STATUS_OPTIONS.map((option) => (
                      <option key={String(option.value || 'all-status')} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[1200px] text-left">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">
                        <label className="inline-flex items-center gap-2 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={allFilteredChecked}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate = partialFilteredChecked;
                              }
                            }}
                            onChange={handleToggleExcludeAll}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          全选排除
                        </label>
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">案件ID</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">UID</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">进件编码</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">姓名</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">户籍地址</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">省</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">市</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">委案剩本</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">处置方式</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">案件状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {casesLoading && (
                      <tr>
                        <td colSpan={11} className="px-4 py-5 text-sm text-gray-500">
                          加载数据中...
                        </td>
                      </tr>
                    )}
                    {!casesLoading && casesItems.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-5 text-sm text-gray-500">
                          暂无数据
                        </td>
                      </tr>
                    )}
                    {!casesLoading &&
                      filteredCases.map((item) => (
                        <tr key={String(item.id)} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={excludedCaseIds.includes(String(item.id))}
                              onChange={() => handleToggleExclude(item.id)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-800">{item.case_id ?? '-'}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 font-mono">{item.uid ?? '-'}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 font-mono">{item.application_code ?? '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.debtor_name ?? '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.household_address ?? '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.province ?? '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.city ?? '-'}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-800">{formatCurrency(item.entrusted_principal_balance)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.disposal_type ?? '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{CASE_STATUS_LABEL[item.case_status] ?? '未知'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 px-3 py-2 text-xs text-gray-600">
                <span>
                  第 {casesPage}/{casesTotalPages} 页 · 共 {casesTotal} 条
                </span>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2">
                    <span>跳转到</span>
                    <input
                      type="number"
                      min={1}
                      max={casesTotalPages}
                      value={casesJumpInput}
                      onChange={(event) => setCasesJumpInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          handleCasesJumpPage();
                        }
                      }}
                      disabled={casesLoading}
                      className="w-16 rounded border border-gray-300 px-1.5 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span>页</span>
                    <button
                      type="button"
                      onClick={handleCasesJumpPage}
                      disabled={casesLoading}
                      className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
                    >
                      跳转
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCasesPage((prev) => Math.max(1, prev - 1))}
                    disabled={casesLoading || casesPage <= 1}
                    className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    onClick={() => setCasesPage((prev) => Math.min(casesTotalPages, prev + 1))}
                    disabled={casesLoading || casesPage >= casesTotalPages}
                    className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExcelRecordDataModal;
