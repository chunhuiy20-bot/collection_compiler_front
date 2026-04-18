import React from 'react';
import NavButton from './NavButton';

function Sidebar({ activePage, onPageChange, navItems, isServiceHealthy }) {
  return (
    <div className="w-full md:w-64 bg-slate-900 text-white flex flex-col shadow-xl md:fixed md:inset-y-0 md:left-0">
      <div className="p-4 md:p-6">
        <h1 className="text-xl font-bold tracking-wider text-blue-400">
          COMPILER <span className="text-xs text-gray-400 font-normal">v1.0</span>
        </h1>
      </div>

      <nav className="flex-1 px-4 pb-4 md:pb-0 flex md:block gap-2 md:space-y-2 overflow-x-auto">
        {navItems.map((item) => (
          <NavButton key={item.id} id={item.id} activePage={activePage} label={item.label} icon={item.icon} onClick={onPageChange} />
        ))}
      </nav>

      <div className="hidden md:block p-6 border-t border-slate-800">
        <div className="text-xs text-gray-500 mb-2">系统状态</div>
        <div className={`flex items-center text-xs ${isServiceHealthy ? 'text-green-400' : 'text-red-400'}`}>
          <span className={`w-2 h-2 rounded-full mr-2 ${isServiceHealthy ? 'bg-green-400' : 'bg-red-400'}`} />
          {isServiceHealthy ? '本地服务运行中' : '本地服务未连接'}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
