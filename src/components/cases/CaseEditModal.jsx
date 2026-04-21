import React, { useEffect, useMemo, useState } from 'react';

const FIELD_META = [
  { key: 'case_id', label: '案件ID', type: 'text', disabled: true },
  { key: 'uid', label: 'UID', type: 'text' },
  { key: 'application_code', label: '进件编码', type: 'text' },
  { key: 'debtor_name', label: '姓名', type: 'text' },
  { key: 'household_address', label: '户籍地址', type: 'textarea' },
  { key: 'province', label: '省', type: 'text' },
  { key: 'city', label: '市', type: 'text' },
  { key: 'entrusted_principal_balance', label: '委案剩本', type: 'text' },
  { key: 'disposal_type', label: '处置方式', type: 'select', options: ['保全', '散诉'] },
  {
    key: 'case_status',
    label: '案件状态',
    type: 'select',
    options: [
      { value: -2, label: '严重缺失' },
      { value: -1, label: '警告缺失' },
      { value: 0, label: '待处理' },
      { value: 1, label: '处理中' },
      { value: 2, label: '处理已完成' },
      { value: 3, label: '处理失败' },
      { value: 4, label: '缺少处理数据' },
    ],
  },
];

function createFormState(caseItem) {
  if (!caseItem) {
    return {};
  }

  return {
    id: caseItem.id ?? '',
    case_id: caseItem.case_id ?? '',
    uid: caseItem.uid ?? '',
    application_code: caseItem.application_code ?? '',
    debtor_name: caseItem.debtor_name ?? '',
    household_address: caseItem.household_address ?? '',
    province: caseItem.province ?? '',
    city: caseItem.city ?? '',
    entrusted_principal_balance: caseItem.entrusted_principal_balance ?? '',
    disposal_type: caseItem.disposal_type ?? '保全',
    case_status: caseItem.case_status ?? 0,
  };
}

function CaseEditModal({ open, caseItem, onClose, onSubmit, submitting = false }) {
  const [form, setForm] = useState(createFormState(caseItem));

  useEffect(() => {
    if (!open) {
      return;
    }
    setForm(createFormState(caseItem));
  }, [open, caseItem]);

  const title = useMemo(() => {
    const caseId = form.case_id || caseItem?.case_id || '-';
    const name = form.debtor_name || caseItem?.debtor_name || '-';
    return `编辑案件 | 案件ID: ${caseId} | 姓名: ${name}`;
  }, [form.case_id, form.debtor_name, caseItem?.case_id, caseItem?.debtor_name]);

  function handleChange(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit?.(form);
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            关闭
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {FIELD_META.map((field) => {
              const value = form[field.key] ?? '';

              if (field.type === 'textarea') {
                return (
                  <label key={field.key} className="md:col-span-2">
                    <div className="mb-1 text-sm font-medium text-gray-700">{field.label}</div>
                    <textarea
                      rows={3}
                      value={value}
                      onChange={(event) => handleChange(field.key, event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                );
              }

              if (field.type === 'select') {
                return (
                  <label key={field.key}>
                    <div className="mb-1 text-sm font-medium text-gray-700">{field.label}</div>
                    <select
                      value={String(value)}
                      onChange={(event) => {
                        const nextValue =
                          field.key === 'case_status' ? Number(event.target.value) : event.target.value;
                        handleChange(field.key, nextValue);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      {(field.options ?? []).map((option) => {
                        if (typeof option === 'string') {
                          return (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          );
                        }
                        return (
                          <option key={String(option.value)} value={String(option.value)}>
                            {option.label}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                );
              }

              return (
                <label key={field.key}>
                  <div className="mb-1 text-sm font-medium text-gray-700">{field.label}</div>
                  <input
                    type="text"
                    value={value}
                    onChange={(event) => handleChange(field.key, event.target.value)}
                    disabled={field.disabled}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                      field.disabled
                        ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                </label>
              );
            })}
          </div>

          <div className="sticky bottom-0 mt-6 border-t border-gray-100 bg-white/95 pt-4 backdrop-blur">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {submitting ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CaseEditModal;
