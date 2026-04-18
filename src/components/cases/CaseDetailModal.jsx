import React, { useEffect, useMemo, useState } from 'react';
import { buildFilePreviewUrl, searchCaseFiles } from '../../services/excelUploadService';

const BASIC_TAB = 'basic';
const LITIGATION_TAB = 'litigation';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']);
const PDF_EXTENSIONS = new Set(['.pdf']);
const WORD_EXTENSIONS = new Set(['.doc', '.docx']);

function getFileName(path) {
  if (!path) {
    return '-';
  }
  const normalized = String(path).replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '-';
}

function getFileKind(path) {
  const fileName = getFileName(path);
  const index = fileName.lastIndexOf('.');
  const ext = index >= 0 ? fileName.slice(index).toLowerCase() : '';

  if (IMAGE_EXTENSIONS.has(ext)) {
    return 'image';
  }
  if (PDF_EXTENSIONS.has(ext)) {
    return 'pdf';
  }
  if (WORD_EXTENSIONS.has(ext)) {
    return 'word';
  }
  return 'file';
}

function normalizeFiles(paths = []) {
  return (paths ?? []).map((path) => {
    const kind = getFileKind(path);
    const canPreview = kind === 'image';
    return {
      path,
      name: getFileName(path),
      kind,
      url: canPreview ? buildFilePreviewUrl(path) : null,
    };
  });
}

function KindTag({ kind }) {
  const styles = {
    image: 'bg-blue-100 text-blue-700',
    pdf: 'bg-red-100 text-red-700',
    word: 'bg-indigo-100 text-indigo-700',
    file: 'bg-gray-100 text-gray-700',
  };

  const label = {
    image: '图片',
    pdf: 'PDF',
    word: 'Word',
    file: '文件',
  };

  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[kind] ?? 'bg-gray-100 text-gray-700'}`}>{label[kind] ?? kind}</span>;
}

function FileRow({ file, onDownload, downloading }) {
  return (
    <button
      type="button"
      onClick={() => onDownload?.(file)}
      disabled={downloading}
      className="w-full text-left"
    >
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 transition-colors hover:border-blue-300 hover:bg-blue-50/30 disabled:cursor-not-allowed disabled:opacity-60">
      <div className="min-w-0 pr-3">
        <div className="truncate text-sm font-medium text-gray-800">{file.name}</div>
        <div className="mt-1 truncate text-xs text-gray-500">{file.path}</div>
        <div className="mt-1 text-xs text-gray-500">{downloading ? '下载中...' : '点击下载文件'}</div>
      </div>
      <KindTag kind={file.kind} />
      </div>
    </button>
  );
}

function ImageCard({ file }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <img src={file.url} alt={file.name} className="h-52 w-full object-cover" loading="lazy" />
      <div className="flex items-center justify-between px-3 py-2">
        <div className="min-w-0 pr-2">
          <div className="truncate text-sm font-medium text-gray-800">{file.name}</div>
          <div className="truncate text-xs text-gray-500">{file.path}</div>
        </div>
        <KindTag kind={file.kind} />
      </div>
    </div>
  );
}

function CaseDetailModal({ open, onClose, caseItem }) {
  const [activeTab, setActiveTab] = useState(BASIC_TAB);
  const [docs, setDocs] = useState({ basic: [], litigation: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [downloadingPath, setDownloadingPath] = useState('');

  useEffect(() => {
    if (open) {
      setActiveTab(BASIC_TAB);
      setPreviewFile(null);
    }
  }, [open, caseItem?.id, caseItem?.case_id]);

  useEffect(() => {
    let cancelled = false;

    async function fetchFiles() {
      if (!open || !caseItem) {
        return;
      }

      const applicationCode = caseItem?.application_code;
      const uid = caseItem?.uid;
      if (!applicationCode && !uid) {
        setDocs({ basic: [], litigation: [] });
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      try {
        const result = await searchCaseFiles({ applicationCode, uid });
        if (cancelled) {
          return;
        }

        setDocs({
          basic: normalizeFiles(result.application_code),
          litigation: normalizeFiles(result.uid),
        });
      } catch (error) {
        if (!cancelled) {
          setDocs({ basic: [], litigation: [] });
          setErrorMessage(error?.message || '文件查询失败，请稍后重试');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchFiles();
    return () => {
      cancelled = true;
    };
  }, [open, caseItem]);

  const currentFiles = useMemo(() => (activeTab === BASIC_TAB ? docs.basic : docs.litigation), [activeTab, docs.basic, docs.litigation]);
  const imageFiles = currentFiles.filter((item) => item.kind === 'image');
  const otherFiles = currentFiles.filter((item) => item.kind !== 'image');

  function handleSubmitLitigation() {
    const payload = {
      case_id: caseItem?.case_id,
      uid: caseItem?.uid,
      debtor_name: caseItem?.debtor_name,
    };
    console.log('[提交诉讼] 待提交案件信息:', payload);
    window.alert('该功能为二期开发');
  }

  function handleOpenPreview(file) {
    setPreviewFile(file);
  }

  function handleClosePreview() {
    setPreviewFile(null);
  }

  async function handleDownloadFile(file) {
    if (!file?.path) {
      return;
    }

    const downloadUrl = buildFilePreviewUrl(file.path);
    setDownloadingPath(file.path);
    try {
      const response = await fetch(downloadUrl, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`下载失败(${response.status})`);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = file.name || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setErrorMessage(error?.message || '文件下载失败，请稍后重试');
    } finally {
      setDownloadingPath('');
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">案件资料详情</h3>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <p className="text-sm text-gray-500">案件ID: {caseItem?.case_id ?? '-'} | 姓名: {caseItem?.debtor_name ?? '-'}</p>
              <button
                type="button"
                onClick={handleSubmitLitigation}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                一键诉讼
              </button>
            </div>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            >
              关闭
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200 px-6 pt-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setActiveTab(BASIC_TAB)}
              className={`rounded-t-lg border px-4 py-2 text-sm font-medium ${
                activeTab === BASIC_TAB ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              案件人基础资料
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(LITIGATION_TAB)}
              className={`rounded-t-lg border px-4 py-2 text-sm font-medium ${
                activeTab === LITIGATION_TAB ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              案件人诉讼资料
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {isLoading && <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">文件检索中，请稍候...</div>}
          {errorMessage && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>}

          {!isLoading && imageFiles.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {imageFiles.map((file) => (
                <button key={file.path} type="button" onClick={() => handleOpenPreview(file)} className="text-left">
                  <ImageCard file={file} />
                </button>
              ))}
            </div>
          ) : null}

          {!isLoading && imageFiles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">当前标签没有可视化图片</div>
          ) : null}

          <div className="mt-6 space-y-3">
            {otherFiles.map((file) => (
              <FileRow key={file.path} file={file} onDownload={handleDownloadFile} downloading={downloadingPath === file.path} />
            ))}
          </div>
        </div>
      </div>

      {previewFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4 py-6" onClick={handleClosePreview}>
          <div className="relative w-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={handleClosePreview}
              className="absolute right-2 top-2 z-10 rounded-md bg-black/60 px-3 py-1 text-sm text-white hover:bg-black/75"
            >
              关闭
            </button>
            <img src={previewFile.url} alt={previewFile.name} className="max-h-[82vh] w-full rounded-lg object-contain bg-black" />
            <div className="mt-2 rounded-md bg-black/60 px-3 py-2 text-xs text-white">
              <div className="truncate font-medium">{previewFile.name}</div>
              <div className="truncate text-gray-200">{previewFile.path}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CaseDetailModal;
