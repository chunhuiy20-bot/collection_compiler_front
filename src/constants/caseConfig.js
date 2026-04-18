export const CASE_STATUS_LABEL = {
  '-2': '严重缺失',
  '-1': '警告缺失',
  0: '待处理',
  1: '处理中',
  2: '已完成',
  3: '已关闭',
};

export const CASE_STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: '-2', label: '严重缺失' },
  { value: '-1', label: '警告缺失' },
  { value: '0', label: '待处理' },
  { value: '1', label: '处理中' },
  { value: '2', label: '已完成' },
  { value: '3', label: '已关闭' },
];

export const DISPOSAL_TYPE_OPTIONS = [
  { value: '', label: '全部处置方式' },
  { value: '保全', label: '保全' },
  { value: '散诉', label: '散诉' },
];

export const CASE_TABLE_COLUMNS = [
  { key: 'case_id', label: '案件ID' },
  { key: 'uid', label: 'UID' },
  { key: 'application_code', label: '进件编码' },
  { key: 'debtor_name', label: '姓名' },
  { key: 'household_address', label: '户籍地址' },
  { key: 'province', label: '省' },
  { key: 'city', label: '市' },
  { key: 'entrusted_principal_balance', label: '委案剩本' },
  { key: 'disposal_type', label: '处置方式' },
  { key: 'case_status', label: '案件状态' },
];

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 150, 200];
