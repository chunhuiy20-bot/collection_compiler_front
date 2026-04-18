import UploadPage from '../pages/UploadPage';
import CasesPage from '../pages/CasesPage';
import StaffPage from '../pages/StaffPage';
import LitigationPage from '../pages/LitigationPage';

export const DEFAULT_ROUTE_PATH = '/upload';

export const APP_NAV_ITEMS = [
  { id: 'upload', path: '/upload', label: '资料上传', icon: '📂' },
  { id: 'cases', path: '/cases', label: '案件展示', icon: '⚖️' },
  { id: 'litigation', path: '/litigation', label: '案件诉讼', icon: '🏛️' },
  { id: 'staff', path: '/staff', label: '员工管理', icon: '👥' }
];

export const APP_ROUTE_COMPONENTS = [
  { path: '/upload', element: UploadPage },
  { path: '/cases', element: CasesPage },
  { path: '/staff', element: StaffPage },
  { path: '/litigation', element: LitigationPage }
];

export const PAGE_PATH_MAP = APP_NAV_ITEMS.reduce((acc, item) => {
  acc[item.id] = item.path;
  return acc;
}, {});

export function resolveActivePageId(pathname) {
  const match = APP_NAV_ITEMS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
  return match?.id ?? 'upload';
}
