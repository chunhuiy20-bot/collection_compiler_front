import React, { useEffect, useMemo, useState } from 'react';
import FileDropZone from '../components/upload/FileDropZone';
import { listAbnormalCasesByHash, patchCaseDetail, uploadExcelFile, uploadPackageInChunks } from '../services/excelUploadService';

function EditableFieldCard({ label, value, isMissingField, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const displayValue = value ?? '';
  const isLongText = String(displayValue).length > 40;

  return (
    <div
      className={`rounded-xl border p-3 ${isMissingField ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
      onClick={() => setIsEditing(true)}
    >
      <div className="text-xs text-gray-500">{label}</div>
      {isEditing ? (
        isLongText ? (
          <textarea
            autoFocus
            value={displayValue}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => setIsEditing(false)}
            rows={3}
            className={`mt-1 w-full resize-y rounded border bg-white px-2 py-1 text-sm outline-none ${isMissingField ? 'border-red-300 text-red-700' : 'border-gray-300 text-gray-800'}`}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={displayValue}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => setIsEditing(false)}
            className={`mt-1 w-full rounded border bg-white px-2 py-1 text-sm outline-none ${isMissingField ? 'border-red-300 text-red-700' : 'border-gray-300 text-gray-800'}`}
            onClick={(event) => event.stopPropagation()}
          />
        )
      ) : (
        <div className={`mt-1 break-all text-sm ${isMissingField ? 'text-red-700' : 'text-gray-800'}`}>
          {displayValue || '—'}
        </div>
      )}
    </div>
  );
}

function buildValidationSummaryFromIssues(issues) {
  const perField = new Map();

  for (const issue of issues ?? []) {
    const fieldLabel = issue?.field_label;
    if (!fieldLabel) {
      continue;
    }

    const stats = perField.get(fieldLabel) ?? {
      field: issue?.field ?? fieldLabel,
      field_label: fieldLabel,
      critical_count: 0,
      warning_count: 0,
    };

    if (issue?.severity === 'critical') {
      stats.critical_count += 1;
    } else {
      stats.warning_count += 1;
    }

    perField.set(fieldLabel, stats);
  }

  const fields = Array.from(perField.values());
  const criticalCount = (issues ?? []).filter((item) => item?.severity === 'critical').length;
  const warningCount = (issues ?? []).filter((item) => item?.severity === 'warning').length;

  return {
    critical_count: criticalCount,
    warning_count: warningCount,
    has_critical: criticalCount > 0,
    fields,
  };
}

function buildPatchPayload(currentIssue, currentRowDetail) {
  const INT_LIKE_FIELDS = new Set(['id', 'case_id']);
  const STRING_FIELDS = [
    'debtor_name',
    'uid',
    'household_address',
    'application_code',
    'transfer_notice_url',
    'transfer_notice_no',
    'transfer_agreement_no',
    'project_name',
    'province',
    'city',
    'entrust_batch_no',
    'entrust_org',
    'entrusted_principal_balance',
    'entrusted_total_claim',
    'disposal_type',
  ];
  const DATE_FIELDS = new Set(['entrust_date']);

  function normalizeIntegerLike(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        return null;
      }
      return BigInt(value).toString();
    }

    const text = String(value).trim();
    if (!text) {
      return null;
    }
    if (/^-?\d+$/.test(text)) {
      return text;
    }
    if (/^-?\d+\.0+$/.test(text)) {
      return text.slice(0, text.indexOf('.'));
    }

    const asNumber = Number(text);
    if (!Number.isFinite(asNumber) || !Number.isInteger(asNumber)) {
      return null;
    }
    return BigInt(asNumber).toString();
  }

  function normalizeString(value) {
    if (value === null || value === undefined) {
      return null;
    }
    const text = String(value).trim();
    return text || null;
  }

  function formatDate(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function normalizeDate(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const text = String(value).trim();
    if (!text) {
      return null;
    }

    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(text)) {
      const [yRaw, mRaw, dRaw] = text.replace(/\./g, '-').replace(/\//g, '-').split('-');
      const y = Number(yRaw);
      const m = Number(mRaw);
      const d = Number(dRaw);
      if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
        return null;
      }
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (Number.isNaN(dt.getTime())) {
        return null;
      }
      return formatDate(dt);
    }

    if (/^-?\d+(\.\d+)?$/.test(text)) {
      const serial = Number(text);
      if (!Number.isFinite(serial)) {
        return null;
      }
      const baseMs = Date.UTC(1899, 11, 30);
      const dayMs = 24 * 60 * 60 * 1000;
      const dt = new Date(baseMs + Math.trunc(serial) * dayMs);
      if (Number.isNaN(dt.getTime())) {
        return null;
      }
      return formatDate(dt);
    }

    const dt = new Date(text);
    if (Number.isNaN(dt.getTime())) {
      return null;
    }
    return formatDate(dt);
  }

  const idRaw = currentIssue?.record_id ?? currentIssue?.id ?? currentRowDetail?.id;
  const normalizedId = normalizeIntegerLike(idRaw);
  if (!normalizedId) {
    throw new Error('Missing record_id for patch request');
  }

  const payload = { id: normalizedId };
  const source = currentRowDetail ?? {};

  payload.case_id = normalizeIntegerLike(source.case_id);

  for (const key of STRING_FIELDS) {
    payload[key] = normalizeString(source[key]);
  }

  for (const key of DATE_FIELDS) {
    payload[key] = normalizeDate(source[key]);
  }

  for (const key of Object.keys(payload)) {
    if (!INT_LIKE_FIELDS.has(key) && !STRING_FIELDS.includes(key) && !DATE_FIELDS.has(key)) {
      delete payload[key];
    }
  }

  return payload;
}

function buildRowIssuesFromPatchResult(currentIssue, currentRowDetail, patchResult) {
  const rowNum = currentIssue?.row_num;
  const recordId = currentIssue?.record_id;

  const labelToFieldKey = {};
  for (const [key, value] of Object.entries(currentRowDetail ?? {})) {
    if (key.endsWith('_label') && typeof value === 'string') {
      const fieldKey = key.slice(0, -6);
      labelToFieldKey[value] = fieldKey;
    }
  }

  const nextIssues = [];
  for (const fieldLabel of patchResult?.missing_critical ?? []) {
    const fieldKey = labelToFieldKey[fieldLabel] ?? fieldLabel;
    nextIssues.push({
      row_num: rowNum,
      record_id: recordId,
      field: fieldKey,
      field_label: fieldLabel,
      severity: 'critical',
      message: `第 ${rowNum} 行缺少${fieldLabel}`,
      row_detail: currentRowDetail,
    });
  }

  for (const fieldLabel of patchResult?.missing_warning ?? []) {
    const fieldKey = labelToFieldKey[fieldLabel] ?? fieldLabel;
    nextIssues.push({
      row_num: rowNum,
      record_id: recordId,
      field: fieldKey,
      field_label: fieldLabel,
      severity: 'warning',
      message: `第 ${rowNum} 行缺少${fieldLabel}`,
      row_detail: currentRowDetail,
    });
  }

  return nextIssues;
}

function buildRowDetailFromCase(caseItem) {
  return {
    row_num: null,
    case_id: caseItem?.case_id ?? null,
    case_id_label: '案件ID',
    debtor_name: caseItem?.debtor_name ?? null,
    debtor_name_label: '姓名',
    uid: caseItem?.uid ?? null,
    uid_label: 'UID',
    household_address: caseItem?.household_address ?? null,
    household_address_label: '户籍地',
    application_code: caseItem?.application_code ?? null,
    application_code_label: '进件编码',
    transfer_notice_url: caseItem?.transfer_notice_url ?? null,
    transfer_notice_url_label: '债转公告链接',
    transfer_notice_no: caseItem?.transfer_notice_no ?? null,
    transfer_notice_no_label: '债转公告序号',
    transfer_agreement_no: caseItem?.transfer_agreement_no ?? null,
    transfer_agreement_no_label: '债转协议序号',
    project_name: caseItem?.project_name ?? null,
    project_name_label: '项目名称',
    province: caseItem?.province ?? null,
    province_label: '省',
    city: caseItem?.city ?? null,
    city_label: '市',
    entrust_date: caseItem?.entrust_date ?? null,
    entrust_date_label: '委案日期',
    entrust_batch_no: caseItem?.entrust_batch_no ?? null,
    entrust_batch_no_label: '委案批次号',
    entrust_org: caseItem?.entrust_org ?? null,
    entrust_org_label: '委案机构',
    entrusted_principal_balance: caseItem?.entrusted_principal_balance ?? null,
    entrusted_principal_balance_label: '委案剩本金额',
    entrusted_total_claim: caseItem?.entrusted_total_claim ?? null,
    entrusted_total_claim_label: '委案债权总额',
    disposal_type: caseItem?.disposal_type ?? null,
    disposal_type_label: '处置方式',
  };
}

function buildIssuesFromAbnormalCases(items = []) {
  const checks = [
    { field: 'uid', label: 'UID', severity: 'critical' },
    { field: 'application_code', label: '进件编码', severity: 'critical' },
    { field: 'case_id', label: '案件ID', severity: 'warning' },
    { field: 'transfer_notice_url', label: '债转公告链接', severity: 'warning' },
    { field: 'transfer_notice_no', label: '债转公告序号', severity: 'warning' },
    { field: 'transfer_agreement_no', label: '债转协议序号', severity: 'warning' },
    { field: 'project_name', label: '项目名称', severity: 'warning' },
    { field: 'entrust_date', label: '委案日期', severity: 'warning' },
    { field: 'entrust_batch_no', label: '委案批次号', severity: 'warning' },
    { field: 'entrust_org', label: '委案机构', severity: 'warning' },
    { field: 'entrusted_principal_balance', label: '委案剩本金额', severity: 'warning' },
    { field: 'entrusted_total_claim', label: '委案债权总额', severity: 'warning' },
    { field: 'disposal_type', label: '处置方式', severity: 'warning' },
  ];

  const issues = [];
  items.forEach((item, index) => {
    const rowDetail = buildRowDetailFromCase(item);
    const missing = checks.filter((check) => {
      const value = item?.[check.field];
      return value === null || value === undefined || String(value).trim() === '';
    });

    if (missing.length === 0) {
      const severity = Number(item?.case_status) === -2 ? 'critical' : 'warning';
      issues.push({
        row_num: index + 1,
        record_id: item?.id,
        field: severity === 'critical' ? 'uid' : 'project_name',
        field_label: severity === 'critical' ? 'UID' : '项目名称',
        severity,
        message: `案件ID ${item?.case_id ?? '-'} 存在异常（状态 ${item?.case_status}）`,
        row_detail: rowDetail,
      });
      return;
    }

    missing.forEach((miss) => {
      issues.push({
        row_num: index + 1,
        record_id: item?.id,
        field: miss.field,
        field_label: miss.label,
        severity: miss.severity,
        message: `案件ID ${item?.case_id ?? '-'} 缺少${miss.label}`,
        row_detail: rowDetail,
      });
    });
  });
  return issues;
}

function ValidationModal({
  open,
  onClose,
  validationSummary,
  validationIssues,
  editedRows,
  onRowDetailChange,
  onSubmitEdits,
  submitButtonText,
  submitButtonDisabled,
}) {
  const [activeIssueIndex, setActiveIssueIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setActiveIssueIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const total = validationIssues?.length ?? 0;
    if (total === 0) {
      setActiveIssueIndex(0);
      return;
    }

    setActiveIssueIndex((prev) => Math.min(prev, total - 1));
  }, [open, validationIssues]);

  if (!open) {
    return null;
  }

  const currentIssue = validationIssues?.[activeIssueIndex] ?? null;
  const rowNum = currentIssue?.row_num;
  const currentRowDetail = rowNum ? editedRows[rowNum] ?? currentIssue?.row_detail : null;
  const rowDetailEntries = currentRowDetail
    ? Object.entries(currentRowDetail).filter(([key]) => key !== 'row_num' && !key.endsWith('_label'))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800">字段缺失详情</h3>
            <p className="mt-1 text-sm text-gray-500">
              严重缺失 {validationSummary?.critical_count ?? 0} 项，警告缺失 {validationSummary?.warning_count ?? 0} 项
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            关闭
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[360px_1fr]">
          <div className="flex min-h-0 flex-col border-r border-gray-200 bg-gray-50">
            <div className="shrink-0 border-b border-gray-200 px-4 py-3">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="py-2 pr-4">字段</th>
                      <th className="py-2 pr-4">严重缺失</th>
                      <th className="py-2 pr-4">警告缺失</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(validationSummary?.fields ?? []).map((field) => (
                      <tr key={field.field_label} className="border-t border-gray-200 text-gray-700">
                        <td className="py-2 pr-4">{field.field_label}</td>
                        <td className="py-2 pr-4">{field.critical_count}</td>
                        <td className="py-2 pr-4">{field.warning_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="min-h-0 overflow-y-scroll">
              {(validationIssues ?? []).map((issue, index) => (
                <button
                  key={`${issue.row_num}-${issue.field}-${index}`}
                  type="button"
                  onClick={() => setActiveIssueIndex(index)}
                  className={`w-full border-b border-gray-200 px-4 py-3 text-left hover:bg-white ${index === activeIssueIndex ? 'bg-white' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-gray-800">{issue.message}</div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${issue.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {issue.severity === 'critical' ? '严重缺失' : '警告缺失'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 overflow-y-scroll px-6 py-5">
            {currentIssue && currentRowDetail ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h4 className="text-base font-semibold text-gray-800">第 {currentIssue.row_num} 行完整信息</h4>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${currentIssue.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {currentIssue.severity === 'critical' ? '严重缺失' : '警告缺失'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSubmitEdits(currentIssue, currentRowDetail)}
                    disabled={submitButtonDisabled || !currentIssue}
                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {submitButtonText}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {rowDetailEntries.map(([key, value]) => {
                    const label = currentRowDetail?.[`${key}_label`] ?? key;
                    const isMissingField = key === currentIssue.field;
                    return (
                      <EditableFieldCard
                        key={key}
                        label={label}
                        value={value}
                        isMissingField={isMissingField}
                        onChange={(nextValue) => onRowDetailChange(currentIssue.row_num, key, nextValue)}
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">暂无缺失明细</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadPage() {
  const [excelFile, setExcelFile] = useState(null);
  const [excelFileName, setExcelFileName] = useState('未选择文件');
  const [excelUploadState, setExcelUploadState] = useState('idle');
  const [excelUploadProgress, setExcelUploadProgress] = useState(0);
  const [packageFileName, setPackageFileName] = useState('未选择文件');
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [isUploadingPackage, setIsUploadingPackage] = useState(false);
  const [packageUploadProgress, setPackageUploadProgress] = useState(0);
  const [packageUploaded, setPackageUploaded] = useState(false);
  const [packageUploadState, setPackageUploadState] = useState('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [excelUploaded, setExcelUploaded] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [validationSummary, setValidationSummary] = useState(null);
  const [validationIssues, setValidationIssues] = useState([]);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [editedRows, setEditedRows] = useState({});
  const [excelSubmitLocked, setExcelSubmitLocked] = useState(false);
  const [isSubmittingEdits, setIsSubmittingEdits] = useState(false);
  const [ocrEnabled, setOcrEnabled] = useState(true);
  const [multimodalEnabled, setMultimodalEnabled] = useState(false);

  const hasValidationIssues = useMemo(() => (validationIssues?.length ?? 0) > 0, [validationIssues]);

  function formatExcelUploadErrorMessage(error) {
    const raw = String(error?.message || '').trim();
    if (!raw) {
      return '上传失败，请稍后重试';
    }

    // 兼容后端返回类似 "{'missing_columns': ['案件ID']}" 的 Python 字典字符串
    const missingColumnsMatch = raw.match(/missing_columns['"]?\s*[:：]\s*\[([^\]]*)\]/);
    if (missingColumnsMatch?.[1]) {
      const columns = missingColumnsMatch[1]
        .split(',')
        .map((item) => item.replace(/['"\s]/g, '').trim())
        .filter(Boolean);
      if (columns.length > 0) {
        return `Excel 缺少必需字段：${columns.join('、')}。请补齐列名后重新上传。`;
      }
    }

    if (raw.includes('missing_columns')) {
      return `Excel 缺少必需字段。请检查列名后重新上传。原始错误：${raw}`;
    }

    return raw;
  }

  function handleRowDetailChange(rowNum, fieldKey, nextValue) {
    setEditedRows((current) => ({
      ...current,
      [rowNum]: {
        ...(current[rowNum] ?? validationIssues.find((issue) => issue.row_num === rowNum)?.row_detail ?? {}),
        [fieldKey]: nextValue,
      },
    }));
  }

  function openPreviousValidationModal() {
    if (hasValidationIssues) {
      setValidationModalOpen(true);
      return;
    }

    setSuccessMessage('');
    setErrorMessage('Excel 已提交成功，当前没有需要修改的数据');
  }

  async function handleExcelSelect(file) {
    setExcelFile(file);
    setExcelFileName(`已选择: ${file.name}`);
    setExcelUploadState('hashing');
    setExcelUploadProgress(0);
    setIsUploadingExcel(true);
    setExcelUploaded(false);
    setSuccessMessage('');
    setErrorMessage('');
    setValidationSummary(null);
    setValidationIssues([]);
    setValidationModalOpen(false);
    setEditedRows({});

    try {
      const result = await uploadExcelFile(file, {
        onHashStart: () => {
          setExcelUploadState('hashing');
          setExcelUploadProgress(20);
          setExcelFileName(`Hashing: ${file.name}`);
        },
        onHashDone: ({ fingerprint }) => {
          setExcelUploadState('uploading');
          setExcelUploadProgress(60);
          setExcelFileName(`Uploading: ${file.name}`);
          console.info('Excel full-file fingerprint:', fingerprint);
        },
      });

      const isInstant = result?.instant === true;
      const total = result?.total ?? 0;
      const summary = result?.validation_summary ?? null;
      const issues = result?.validation_issues ?? [];

      setExcelUploaded(true);
      setExcelSubmitLocked(true);

      if (isInstant) {
        const fileHash = result?.file_hash;
        let abnormalItems = [];
        if (fileHash) {
          const abnormalResult = await listAbnormalCasesByHash({
            fileHash,
            page: 1,
            pageSize: 200,
          });
          abnormalItems = abnormalResult?.items ?? [];
        }

        const abnormalIssues = buildIssuesFromAbnormalCases(abnormalItems);
        if (abnormalIssues.length > 0) {
          setValidationSummary(buildValidationSummaryFromIssues(abnormalIssues));
          setValidationIssues(abnormalIssues);
          setValidationModalOpen(true);
          setSuccessMessage(`Excel 秒传命中，检测到 ${abnormalIssues.length} 项异常，请先修正后再执行任务`);
        } else {
          setValidationSummary(null);
          setValidationIssues([]);
          setValidationModalOpen(false);
          setSuccessMessage(`Excel 秒传命中，未发现异常：${result?.filename || file.name}`);
        }

        setExcelFileName(`Uploaded: ${result?.filename || file.name}`);
        setExcelUploadProgress(100);
        setExcelUploadState('success');
      } else {
        setValidationSummary(summary);
        setValidationIssues(issues);

        if ((issues?.length ?? 0) > 0) {
          setSuccessMessage(`Excel 上传完成，共 ${total} 条记录；严重缺失 ${summary?.critical_count ?? 0} 项，警告缺失 ${summary?.warning_count ?? 0} 项`);
          setValidationModalOpen(true);
        } else {
          setSuccessMessage(`Excel 上传并校验成功，共 ${total} 条记录，未发现缺失字段`);
        }

        setExcelFileName(`Uploaded: ${result?.filename || file.name}`);
        setExcelUploadProgress(100);
        setExcelUploadState('success');
      }

      console.info('Excel upload result:', result);
    } catch (error) {
      setExcelFile(null);
      setExcelFileName('未选择文件');
      setExcelUploaded(false);
      setExcelSubmitLocked(false);
      setValidationSummary(null);
      setValidationIssues([]);
      setValidationModalOpen(false);
      setEditedRows({});
      setExcelUploadState('error');
      setExcelUploadProgress(0);
      setErrorMessage(formatExcelUploadErrorMessage(error));
    } finally {
      setIsUploadingExcel(false);
    }
  }

  async function handlePackageSelect(file) {
    setPackageFileName(`Selected: ${file.name}`);
    setPackageUploaded(false);
    setPackageUploadProgress(0);
    setIsUploadingPackage(true);
    setPackageUploadState('hashing');
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const result = await uploadPackageInChunks(file, {
        onHashStart: () => {
          setPackageUploadState('hashing');
          setPackageFileName(`Hashing: ${file.name}`);
        },
        onHashDone: ({ fingerprint }) => {
          setPackageUploadState('uploading');
          setPackageUploadProgress(0);
          setPackageFileName(`Uploading: ${file.name} (0%)`);
          console.info('Package sampled fingerprint:', fingerprint);
        },
        onProgress: ({ percent }) => {
          setPackageUploadProgress(percent);
          setPackageFileName(`Uploading: ${file.name} (${percent}%)`);
          if (percent >= 100) {
            setPackageUploadState('processing');
            setPackageFileName(`Processing: ${file.name}`);
          }
        },
      });

      setPackageUploaded(true);
      setPackageUploadProgress(100);
      setPackageFileName(`Uploaded: ${result.filename}`);
      setPackageUploadState('success');
      setSuccessMessage(`Package uploaded: ${result.filename}`);
      console.info('Package upload result:', result);
    } catch (error) {
      setPackageUploaded(false);
      setPackageUploadProgress(0);
      setPackageFileName(`Upload failed: ${file.name}`);
      setPackageUploadState('error');
      setErrorMessage(error?.message || 'Package upload failed, please retry');
    } finally {
      setIsUploadingPackage(false);
    }
  }

  async function handleSubmitEdits(currentIssue, currentRowDetail) {
    if (!currentIssue || !currentRowDetail) {
      setErrorMessage('\u5f53\u524d\u672a\u9009\u4e2d\u53ef\u63d0\u4ea4\u7684\u7f3a\u5931\u6570\u636e\u884c');
      return;
    }

    setIsSubmittingEdits(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const payload = buildPatchPayload(currentIssue, currentRowDetail);
      const patchResult = await patchCaseDetail(payload);
      const backendMessage = patchResult?.message || '\u63d0\u4ea4\u4fee\u6539\u5b8c\u6210';
      console.info('[patch_case] message:', backendMessage, patchResult);

      const nextRowIssues = buildRowIssuesFromPatchResult(currentIssue, currentRowDetail, patchResult);

      setEditedRows((current) => ({
        ...current,
        [currentIssue.row_num]: currentRowDetail,
      }));

      setValidationIssues((current) => {
        const firstRowIssueIndex = current.findIndex((issue) => issue.row_num === currentIssue.row_num);
        const withoutCurrentRow = current.filter((issue) => issue.row_num !== currentIssue.row_num);

        let nextIssues;
        if (firstRowIssueIndex < 0) {
          nextIssues = [...withoutCurrentRow, ...nextRowIssues];
        } else {
          const insertIndex = Math.min(firstRowIssueIndex, withoutCurrentRow.length);
          nextIssues = [
            ...withoutCurrentRow.slice(0, insertIndex),
            ...nextRowIssues,
            ...withoutCurrentRow.slice(insertIndex),
          ];
        }

        setValidationSummary(buildValidationSummaryFromIssues(nextIssues));

        if (nextIssues.length === 0) {
          setValidationModalOpen(false);
          setSuccessMessage(backendMessage);
        } else if (nextRowIssues.length === 0) {
          setSuccessMessage(`${backendMessage} (row ${currentIssue.row_num} validated)`);
        } else {
          setSuccessMessage(`${backendMessage} (row ${currentIssue.row_num} still has ${nextRowIssues.length} missing fields)`);
        }

        return nextIssues;
      });
    } catch (error) {
      const failureMessage = error?.message || '\u63d0\u4ea4\u4fee\u6539\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5';
      console.error('[patch_case] message:', failureMessage, error);
      setErrorMessage(failureMessage);
    } finally {
      setIsSubmittingEdits(false);
    }
  }

  async function handleStartCompile() {
    if (!excelFile || !excelUploaded) {
      setSuccessMessage('');
      setErrorMessage('请先完成 Excel 底表上传');
      return;
    }
    
    if (!packageUploaded) {
      setSuccessMessage('');
      setErrorMessage('Please upload package zip before starting compile');
      return;
    }


    setIsSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      console.info('Start local compile task with uploaded excel:', excelFile.name, editedRows);
      setSuccessMessage('Excel 底表已上传，可以继续执行本地编译任务');
    } catch (error) {
      setErrorMessage(error?.message || '本地编译任务启动失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOcrChange(event) {
    const nextChecked = event.target.checked;
    if (!nextChecked) {
      return;
    }

    setOcrEnabled(true);
    setMultimodalEnabled(false);
  }

  function handleMultimodalChange(event) {
    const nextChecked = event.target.checked;
    if (!nextChecked) {
      return;
    }

    const confirmed = window.confirm('多模态识别会将案件人相关资料上传到服务商中，请谨慎选择。是否确认开启？');
    if (confirmed) {
      setMultimodalEnabled(true);
      setOcrEnabled(false);
      return;
    }

    setMultimodalEnabled(false);
    setOcrEnabled(true);
  }

  const missingRequiredMaterials = [];
  if (!excelUploaded) {
    missingRequiredMaterials.push('Excel底表');
  }
  if (!packageUploaded) {
    missingRequiredMaterials.push('催收资料压缩包');
  }

  const isBusy = isSubmitting || isUploadingExcel || isUploadingPackage;
  const canStartCompile = !isBusy && missingRequiredMaterials.length === 0;
  const startButtonHint =
    missingRequiredMaterials.length > 0 ? `请先上传必要资料：${missingRequiredMaterials.join('、')}` : '';

  return (
    <>
      <div>
        <header className="mb-10">
          <h2 className="text-3xl font-extrabold text-gray-800">新建催收资料识别分流任务</h2>
          <p className="text-gray-500 mt-2">支持本地 Excel 表格与图像/PDF 资料包的批量关联与 OCR 识别</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FileDropZone
            title="1. 初始 Excel 底表"
            requiredLabel="必须"
            icon="Excel"
            tip={
              excelSubmitLocked
                ? 'Excel 已提交成功，点击可查看之前返回的修改数据'
                : excelUploadState === 'hashing'
                  ? '计算 Excel 整文件 Hash 中...'
                  : excelUploadState === 'uploading'
                    ? 'Excel 上传中...'
                    : excelUploadState === 'success'
                      ? 'Excel 上传成功'
                      : excelUploadState === 'error'
                        ? 'Excel 上传失败，请重试'
                        : <>
                    拖拽文件到这里或 <span className="text-blue-600 font-semibold">点击选择</span>
                  </>
            }
            supportText="支持 .xlsx, .xls 格式"
            accept=".xlsx,.xls"
            fileName={excelFileName}
            onFileSelect={handleExcelSelect}
            accent="blue"
            disabled={excelSubmitLocked}
            onDisabledClick={openPreviousValidationModal}
            uploadState={excelUploadState}
            progress={excelUploadProgress}
          />

          <FileDropZone
            title="2.上传催收资料压缩包"
            requiredLabel="必须"
            icon="ZIP"
            tip={
              packageUploadState === 'hashing'
                ? '抽样 Hash 计算中（头/中/尾 chunk + 文件大小）...'
                : packageUploadState === 'uploading'
                ? `分片上传中 (${packageUploadProgress}%)`
                : packageUploadState === 'processing'
                  ? '压缩包上传完成，处理中...'
                : packageUploadState === 'success'
                  ? '上传成功，可执行编译任务'
                  : packageUploadState === 'error'
                    ? '上传失败，请重试或更换文件'
                    : '上传包含多层嵌套文件夹的 ZIP'
            }
            supportText="Supports .zip, .rar"
            accept=".zip,.rar"
            fileName={packageFileName}
            onFileSelect={handlePackageSelect}
            accent="indigo"
            disabled={isUploadingPackage}
            uploadState={packageUploadState}
            progress={packageUploadProgress}
          />
        </div>

        <div className="mt-10 bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-700 mb-6">编译选项配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" name="recognition_mode" checked={ocrEnabled} onChange={handleOcrChange} className="w-4 h-4 text-blue-600" />
              <span className="ml-3 text-sm font-medium">OCR识别</span>
            </label>
            <div className="relative group">
              <label className="flex items-center p-4 border rounded-lg cursor-not-allowed bg-gray-50/60 border-gray-200 opacity-75">
                <input type="radio" name="recognition_mode" checked={multimodalEnabled} onChange={handleMultimodalChange} disabled className="w-4 h-4 text-blue-600 cursor-not-allowed" />
                <span className="ml-3 text-sm font-medium text-gray-500">多模态识别</span>
              </label>
              <div className="pointer-events-none absolute left-1/2 top-[-34px] -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                暂不支持
              </div>
            </div>
          </div>

          <div className="relative group mt-10">
            <button
              type="button"
              onClick={handleStartCompile}
              disabled={!canStartCompile}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUploadingExcel ? 'Uploading Excel...' : isUploadingPackage ? 'Uploading package...' : isSubmitting ? 'Processing...' : '开始执行任务'}
            </button>

            {!canStartCompile && startButtonHint && (
              <div className="pointer-events-none absolute left-1/2 top-[-40px] z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {startButtonHint}
              </div>
            )}
          </div>

          {successMessage && (
            <div className="mt-4 p-3 text-sm rounded-lg border border-green-200 bg-green-50 text-green-700">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="mt-4 p-3 text-sm rounded-lg border border-red-200 bg-red-50 text-red-700">
              {errorMessage}
            </div>
          )}
        </div>
      </div>

      <ValidationModal
        open={validationModalOpen && hasValidationIssues}
        onClose={() => setValidationModalOpen(false)}
        validationSummary={validationSummary}
        validationIssues={validationIssues}
        editedRows={editedRows}
        onRowDetailChange={handleRowDetailChange}
        onSubmitEdits={handleSubmitEdits}
        submitButtonText={isSubmittingEdits ? '提交中...' : '提交修改'}
        submitButtonDisabled={isSubmittingEdits}
      />
    </>
  );
}

export default UploadPage;
