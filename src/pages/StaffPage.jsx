import React from 'react';

function StaffPage() {
  return (
    <div>
      <header className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-800">案件跟进人 (Followers)</h2>
          <p className="text-gray-500 mt-2">管理有权参与案件审核与处置的操作人员</p>
        </div>
        <button type="button" className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-shadow">
          + 邀请新成员
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative group">
          <div className="absolute top-4 right-4 text-gray-300 group-hover:text-blue-500 cursor-pointer">⚙️</div>
          <div className="flex items-center mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-full flex items-center justify-center text-xl font-bold shadow-inner">
              陈
            </div>
            <div className="ml-4">
              <div className="text-lg font-bold">陈律师</div>
              <div className="text-xs text-gray-400">ID: STF-001</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">负责领域</span>
              <span className="font-medium text-gray-700">散诉/债转协议</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">本月处理</span>
              <span className="font-medium text-gray-700">142 案</span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-50 flex justify-between items-center">
            <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase tracking-wider">活跃中</span>
            <span className="text-xs text-gray-400 italic">最后登录: 10分钟前</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative opacity-80">
          <div className="flex items-center mb-4">
            <div className="w-14 h-14 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-xl font-bold">
              AI
            </div>
            <div className="ml-4">
              <div className="text-lg font-bold text-gray-800">Auto Compiler (系统)</div>
              <div className="text-xs text-gray-400">Service Account</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">主要任务</span>
              <span className="font-medium text-gray-700">OCR & 归档分流</span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-50 text-xs text-center text-blue-500 font-bold">
            系统内置核心引擎，无法删除
          </div>
        </div>
      </div>
    </div>
  );
}

export default StaffPage;
