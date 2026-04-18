import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { APP_ROUTE_COMPONENTS, DEFAULT_ROUTE_PATH } from './routes';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={DEFAULT_ROUTE_PATH} replace />} />

      {APP_ROUTE_COMPONENTS.map((route) => {
        const Component = route.element;
        return <Route key={route.path} path={route.path} element={<Component />} />;
      })}

      <Route path="*" element={<Navigate to={DEFAULT_ROUTE_PATH} replace />} />
    </Routes>
  );
}

export default AppRoutes;
