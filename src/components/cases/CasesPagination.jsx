import React, { useEffect, useState } from 'react';
import { PAGE_SIZE_OPTIONS } from '../../constants/caseConfig';

function CasesPagination({
  pageSize,
  currentPage,
  totalPages,
  totalItems,
  onPageSizeChange,
  onPrevPage,
  onNextPage,
  onJumpPage,
  isLoading,
}) {
  const [jumpPageInput, setJumpPageInput] = useState(String(currentPage));

  useEffect(() => {
    setJumpPageInput(String(currentPage));
  }, [currentPage]);

  function handleJump() {
    const page = Number(jumpPageInput);
    if (!Number.isInteger(page)) {
      setJumpPageInput(String(currentPage));
      return;
    }
    onJumpPage?.(page);
  }

  return (
    <div className="px-4 py-3 border-t border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>每页</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          disabled={isLoading}
          className="px-2 py-1 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span>条</span>
        <span className="ml-2 text-gray-500">
          第 {currentPage} / {totalPages} 页，共 {totalItems} 条
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 mr-3">
          <span className="text-sm text-gray-600">跳转到</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpPageInput}
            onChange={(event) => setJumpPageInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleJump();
              }
            }}
            disabled={isLoading}
            className="w-20 px-2 py-1.5 text-sm border rounded-md outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          />
          <span className="text-sm text-gray-600">页</span>
          <button
            type="button"
            onClick={handleJump}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm border rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            跳转
          </button>
        </div>

        <button
          type="button"
          onClick={onPrevPage}
          disabled={isLoading || currentPage <= 1}
          className="px-3 py-1.5 text-sm border rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          上一页
        </button>
        <button
          type="button"
          onClick={onNextPage}
          disabled={isLoading || currentPage >= totalPages}
          className="px-3 py-1.5 text-sm border rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一页
        </button>
      </div>
    </div>
  );
}

export default CasesPagination;
