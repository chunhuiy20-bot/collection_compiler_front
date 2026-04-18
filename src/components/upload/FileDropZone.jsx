import React, { useRef, useState } from 'react';

function FileDropZone({
  title,
  requiredLabel,
  icon,
  tip,
  supportText,
  accept,
  fileName,
  onFileSelect,
  accent = 'blue',
  disabled = false,
  onDisabledClick,
  uploadState = 'idle',
  progress = 0
}) {
  const inputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const dragClass =
    accent === 'indigo'
      ? isDragActive
        ? 'border-indigo-500 bg-indigo-50'
        : 'border-gray-300 hover:border-indigo-500'
      : isDragActive
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-300 hover:border-blue-500';

  function openFilePicker() {
    if (disabled) {
      onDisabledClick?.();
      return;
    }
    inputRef.current?.click();
  }

  function handleInputChange(event) {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    event.target.value = '';
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) {
      return;
    }
    setIsDragActive(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);

    if (disabled) {
      onDisabledClick?.();
      return;
    }

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }

  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  const isHashing = uploadState === 'hashing';
  const isUploading = uploadState === 'uploading';
  const isProcessing = uploadState === 'processing';
  const isSuccess = uploadState === 'success';
  const isError = uploadState === 'error';

  const progressBarColor = isSuccess ? 'bg-green-500' : isError ? 'bg-red-500' : accent === 'indigo' ? 'bg-indigo-500' : 'bg-blue-500';
  const progressTrackColor = isError ? 'bg-red-100' : isSuccess ? 'bg-green-100' : 'bg-gray-200';

  function renderStatusIcon() {
    if (isUploading) {
      return (
        <div className="mb-4 flex items-center justify-center">
          <span className={`h-10 w-10 rounded-full border-2 border-t-transparent animate-spin ${accent === 'indigo' ? 'border-indigo-400' : 'border-blue-400'}`} />
        </div>
      );
    }

    if (isHashing) {
      return (
        <div className="mb-4 flex items-center justify-center">
          <span className={`h-10 w-10 rounded-full border-2 border-t-transparent animate-spin ${accent === 'indigo' ? 'border-indigo-400' : 'border-blue-400'}`} />
        </div>
      );
    }

    if (isProcessing) {
      return (
        <div className="mb-4 flex items-center justify-center">
          <span className={`h-10 w-10 rounded-full border-2 border-t-transparent animate-spin ${accent === 'indigo' ? 'border-indigo-500' : 'border-blue-500'}`} />
        </div>
      );
    }

    if (isSuccess) {
      return (
        <div className="relative mb-4 flex items-center justify-center">
          <span className="absolute inline-flex h-10 w-10 rounded-full bg-green-300 opacity-60 animate-ping" />
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white font-bold shadow-sm">✓</span>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="mb-4 flex items-center justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white font-bold animate-pulse shadow-sm">!</span>
        </div>
      );
    }

    return <div className="text-4xl mb-4">{icon}</div>;
  }

  const statusText = isUploading
    ? '上传中'
    : isHashing
      ? '计算指纹中'
      : isProcessing
        ? '处理中'
        : isSuccess
          ? '上传成功'
          : isError
            ? '上传失败'
            : '待上传';

  const progressText = isError ? '0%' : isHashing ? '--' : `${Math.round(safeProgress)}%`;

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-700">{title}</h3>
        <span className={`text-xs px-2 py-1 rounded ${accent === 'indigo' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
          {requiredLabel}
        </span>
      </div>

      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleInputChange} />

      <div
        onClick={openFilePicker}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${dragClass}`}
      >
        {renderStatusIcon()}
        <p className="text-sm text-gray-600">{tip}</p>
        <p className="text-xs text-gray-400 mt-2">{supportText}</p>
      </div>

      {uploadState !== 'idle' && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className={`${isSuccess ? 'text-green-700' : isError ? 'text-red-700' : 'text-gray-600'} font-medium`}>{statusText}</span>
            <span className="text-gray-500">{progressText}</span>
          </div>
          <div className={`mt-2 h-2 w-full overflow-hidden rounded-full ${progressTrackColor}`}>
            <div
              className={`h-full rounded-full transition-all duration-300 ${progressBarColor} ${isHashing || isUploading || isProcessing ? 'animate-pulse' : ''}`}
              style={{ width: `${isError ? 100 : isHashing ? 30 : Math.max(safeProgress, isUploading || isProcessing ? 2 : 0)}%` }}
            />
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-500">{fileName}</p>
    </div>
  );
}

export default FileDropZone;
