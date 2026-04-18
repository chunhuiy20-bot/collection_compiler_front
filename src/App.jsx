import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import AppRoutes from './router/AppRoutes';
import { APP_NAV_ITEMS, DEFAULT_ROUTE_PATH, PAGE_PATH_MAP, resolveActivePageId } from './router/routes';
import { checkServiceHealth } from './services/excelUploadService';

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const activePage = resolveActivePageId(location.pathname);
  const [isServiceHealthy, setIsServiceHealthy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function pollHealth() {
      const healthy = await checkServiceHealth();
      if (!cancelled) {
        setIsServiceHealthy(healthy);
      }
    }

    pollHealth();
    const timer = window.setInterval(pollHealth, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  function handlePageChange(pageId) {
    navigate(PAGE_PATH_MAP[pageId] ?? DEFAULT_ROUTE_PATH);
  }

  return (
    <div className="bg-gray-50 font-sans min-h-screen">
      <Sidebar
        activePage={activePage}
        onPageChange={handlePageChange}
        navItems={APP_NAV_ITEMS}
        isServiceHealthy={isServiceHealthy}
      />

      <main className="ml-0 md:ml-64 p-4 md:p-8">
        <AppRoutes />
      </main>
    </div>
  );
}

function App() {
  return <AppLayout />;
}

export default App;
