import { computeSampledFileHash, computeWholeFileHash } from '../utils/fileHash';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';
const UPLOAD_ENDPOINT = '/api/v1/excel/upload';
const PATCH_CASE_ENDPOINT = '/api/v1/excel/case';
const CASES_ENDPOINT = '/api/v1/excel/cases';
const CASES_BY_HASH_ENDPOINT = '/api/v1/excel/cases/by-hash';
const CASES_ABNORMAL_ENDPOINT = '/api/v1/excel/cases/abnormal';
const CASES_EXPORT_ENDPOINT = '/api/v1/excel/cases/export';
const FILE_RECORD_PAGE_ENDPOINT = '/api/v1/file-record/page';
const FILE_SEARCH_ENDPOINT = '/api/v1/files/search';
const FILE_PREVIEW_ENDPOINT = '/api/v1/files/preview';
const CHUNK_INIT_ENDPOINT = '/api/v1/upload/init';
const CHUNK_PART_ENDPOINT = '/api/v1/upload/chunk';
const CHUNK_MERGE_ENDPOINT = '/api/v1/upload/merge';
const HEALTH_ENDPOINT = '/health';

async function parseResponse(response) {
  const rawText = await response.text();
  let payload = null;

  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch (_err) {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload?.detail || payload?.message || rawText || `请求失败(${response.status})`;
    const detailText = typeof detail === 'string' ? detail : JSON.stringify(detail);
    throw new Error(detailText);
  }

  return payload ?? {};
}

function unwrapCommonResult(payload, fallbackMessage) {
  if (payload?.code !== undefined && payload.code !== 200) {
    throw new Error(payload?.message || fallbackMessage);
  }
  return payload?.data ?? payload;
}

export async function checkServiceHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}${HEALTH_ENDPOINT}`, { method: 'GET' });
    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data?.status === 'ok';
  } catch (_err) {
    return false;
  }
}

async function uploadWithMultipart(file, { fileHash } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  if (fileHash) {
    formData.append('file_hash', String(fileHash));
  }

  const response = await fetch(`${API_BASE_URL}${UPLOAD_ENDPOINT}`, {
    method: 'POST',
    body: formData,
  });

  return parseResponse(response);
}

export async function uploadExcelFile(file, { onHashStart, onHashDone } = {}) {
  if (!file) {
    throw new Error('请选择 Excel 文件');
  }

  if (typeof onHashStart === 'function') {
    onHashStart();
  }

  const hashInfo = await computeWholeFileHash(file, { useWorker: true });
  if (typeof onHashDone === 'function') {
    onHashDone(hashInfo);
  }

  const payload = await uploadWithMultipart(file, {
    fileHash: hashInfo?.hash,
  });
  const data = unwrapCommonResult(payload, '上传Excel失败');

  // 兼容后端“Result.success(inner_result)”包装：
  // 外层 code=200 但内层 data.code 可能为业务错误（如 422 缺字段）。
  if (data?.code !== undefined && Number(data.code) !== 200) {
    throw new Error(data?.message || '上传Excel失败');
  }

  const normalized = data?.code !== undefined && data?.data !== undefined ? data.data : data;
  return {
    ...(normalized ?? {}),
    api_code: payload?.code,
    api_message: payload?.message,
    file_hash: normalized?.file_hash ?? hashInfo?.hash,
    client_file_hash: hashInfo?.hash,
    file_fingerprint: hashInfo?.fingerprint,
  };
}

export async function patchCaseDetail(payload) {
  if (!payload?.id) {
    throw new Error('缺少 id，无法提交修改');
  }

  const response = await fetch(`${API_BASE_URL}${PATCH_CASE_ENDPOINT}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function listCasesPage({ page = 1, pageSize = 20, disposalType, caseStatus } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  if (disposalType) {
    params.set('disposal_type', disposalType);
  }

  if (caseStatus !== undefined && caseStatus !== null && caseStatus !== '') {
    params.set('case_status', String(caseStatus));
  }

  const response = await fetch(`${API_BASE_URL}${CASES_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
  });

  const payload = await parseResponse(response);
  const pageData = unwrapCommonResult(payload, '分页查询失败');

  return {
    items: pageData?.items ?? [],
    total: Number(pageData?.total ?? 0),
    page: Number(pageData?.page ?? page),
    pageSize: Number(pageData?.page_size ?? pageSize),
    message: payload?.message || 'success',
  };
}

export async function listExcelFileRecords({ page = 1, pageSize = 20, fileType = 'excel' } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    file_type: String(fileType),
  });

  const response = await fetch(`${API_BASE_URL}${FILE_RECORD_PAGE_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
  });

  const payload = await parseResponse(response);
  const data = unwrapCommonResult(payload, '查询Excel记录失败');
  return {
    items: data?.items ?? [],
    total: Number(data?.total ?? 0),
    page: Number(data?.page ?? page),
    pageSize: Number(data?.page_size ?? pageSize),
  };
}

export async function listCasesByHash({ fileHash, page = 1, pageSize = 20, disposalType, caseStatus } = {}) {
  if (!fileHash) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize,
    };
  }

  const params = new URLSearchParams({
    file_hash: String(fileHash),
    page: String(page),
    page_size: String(pageSize),
  });

  if (disposalType) {
    params.set('disposal_type', String(disposalType));
  }

  if (caseStatus !== undefined && caseStatus !== null && caseStatus !== '') {
    params.set('case_status', String(caseStatus));
  }

  const response = await fetch(`${API_BASE_URL}${CASES_BY_HASH_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
  });

  const payload = await parseResponse(response);
  const data = unwrapCommonResult(payload, '按文件哈希查询案件失败');
  return {
    items: data?.items ?? [],
    total: Number(data?.total ?? 0),
    page: Number(data?.page ?? page),
    pageSize: Number(data?.page_size ?? pageSize),
  };
}

export async function listAbnormalCasesByHash({ fileHash, page = 1, pageSize = 20 } = {}) {
  if (!fileHash) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize,
    };
  }

  const params = new URLSearchParams({
    file_hash: String(fileHash),
    page: String(page),
    page_size: String(pageSize),
  });

  const response = await fetch(`${API_BASE_URL}${CASES_ABNORMAL_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
  });

  const payload = await parseResponse(response);
  const data = unwrapCommonResult(payload, '查询异常数据失败');
  return {
    items: data?.items ?? [],
    total: Number(data?.total ?? 0),
    page: Number(data?.page ?? page),
    pageSize: Number(data?.page_size ?? pageSize),
  };
}

function parseFilenameFromContentDisposition(contentDisposition, fallback = 'cases_export.xlsx') {
  if (!contentDisposition) {
    return fallback;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch (_err) {
      return utf8Match[1];
    }
  }

  const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (basicMatch?.[1]) {
    return basicMatch[1];
  }

  return fallback;
}

export async function exportCasesByHash({ fileHash, excludeIds = [], order = 'asc', sortBy = 'case_status' } = {}) {
  if (!fileHash) {
    throw new Error('缺少 file_hash，无法导出');
  }

  const response = await fetch(`${API_BASE_URL}${CASES_EXPORT_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      file_hash: fileHash,
      exclude_ids: excludeIds,
      order,
      sort_by: sortBy,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `导出失败(${response.status})`);
  }

  const blob = await response.blob();
  const filename = parseFilenameFromContentDisposition(
    response.headers.get('Content-Disposition'),
    `${fileHash.slice(0, 8)}_cases_export.xlsx`,
  );

  return {
    blob,
    filename,
  };
}

export async function searchCaseFiles({ applicationCode, uid } = {}) {
  const params = new URLSearchParams();
  if (applicationCode) {
    params.set('application_code', String(applicationCode));
  }
  if (uid) {
    params.set('uid', String(uid));
  }
  if (!params.toString()) {
    return { application_code: [], uid: [] };
  }

  const response = await fetch(`${API_BASE_URL}${FILE_SEARCH_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
  });

  const payload = await parseResponse(response);
  const data = unwrapCommonResult(payload, '查询案件文件失败');
  return {
    application_code: data?.application_code ?? [],
    uid: data?.uid ?? [],
  };
}

export function buildFilePreviewUrl(path) {
  const params = new URLSearchParams({ path: String(path ?? '') });
  return `${API_BASE_URL}${FILE_PREVIEW_ENDPOINT}?${params.toString()}`;
}

export async function initChunkUpload({ uploadId, filename, totalChunks, fileHash }) {
  if (!fileHash) {
    throw new Error('缺少 file_hash，无法初始化分片上传');
  }

  const formData = new FormData();
  formData.append('upload_id', uploadId);
  formData.append('filename', filename);
  formData.append('total_chunks', String(totalChunks));
  formData.append('file_hash', String(fileHash));

  const response = await fetch(`${API_BASE_URL}${CHUNK_INIT_ENDPOINT}`, {
    method: 'POST',
    body: formData,
  });

  const payload = await parseResponse(response);
  return unwrapCommonResult(payload, '初始化分片上传失败');
}

export async function uploadChunkPart({ uploadId, chunkIndex, chunkBlob }) {
  const formData = new FormData();
  formData.append('upload_id', uploadId);
  formData.append('chunk_index', String(chunkIndex));
  formData.append('chunk', chunkBlob, `${chunkIndex}.part`);

  const response = await fetch(`${API_BASE_URL}${CHUNK_PART_ENDPOINT}`, {
    method: 'POST',
    body: formData,
  });

  const payload = await parseResponse(response);
  return unwrapCommonResult(payload, '上传分片失败');
}

export async function mergeChunkUpload(uploadId) {
  const formData = new FormData();
  formData.append('upload_id', uploadId);

  const response = await fetch(`${API_BASE_URL}${CHUNK_MERGE_ENDPOINT}`, {
    method: 'POST',
    body: formData,
  });

  const payload = await parseResponse(response);
  return unwrapCommonResult(payload, '合并分片失败');
}

export async function uploadPackageInChunks(file, { chunkSize = 2 * 1024 * 1024, onProgress, onHashStart, onHashDone } = {}) {
  if (!file) {
    throw new Error('请选择资料压缩包文件');
  }

  if (typeof onHashStart === 'function') {
    onHashStart();
  }

  const hashInfo = await computeSampledFileHash(file, { chunkSize, useWorker: true });
  if (typeof onHashDone === 'function') {
    onHashDone(hashInfo);
  }

  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
  const uploadId = hashInfo?.fingerprint || `${hashInfo?.hash || 'hash'}_${file.size}`;

  const initResult = await initChunkUpload({
    uploadId,
    filename: file.name,
    totalChunks,
    fileHash: hashInfo?.hash,
  });

  if (initResult?.instant === true) {
    if (typeof onProgress === 'function') {
      onProgress({
        uploadedChunks: totalChunks,
        totalChunks,
        percent: 100,
      });
    }

    return {
      uploadId: initResult?.upload_id || uploadId,
      sampledHash: hashInfo?.hash,
      sampledFingerprint: hashInfo?.fingerprint,
      totalChunks,
      filename: initResult?.filename || file.name,
      filePath: initResult?.file_path,
      fileSize: Number(initResult?.file_size ?? file.size),
      instant: true,
    };
  }

  const uploadedSet = new Set(initResult?.uploaded_chunks ?? []);
  let completed = uploadedSet.size;

  if (typeof onProgress === 'function') {
    onProgress({
      uploadedChunks: completed,
      totalChunks,
      percent: Math.floor((completed / totalChunks) * 100),
    });
  }

  for (let index = 0; index < totalChunks; index += 1) {
    if (uploadedSet.has(index)) {
      continue;
    }

    const start = index * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const chunkBlob = file.slice(start, end);

    await uploadChunkPart({
      uploadId,
      chunkIndex: index,
      chunkBlob,
    });

    completed += 1;
    if (typeof onProgress === 'function') {
      onProgress({
        uploadedChunks: completed,
        totalChunks,
        percent: Math.floor((completed / totalChunks) * 100),
      });
    }
  }

  const mergeResult = await mergeChunkUpload(uploadId);

  return {
    uploadId,
    sampledHash: hashInfo?.hash,
    sampledFingerprint: hashInfo?.fingerprint,
    totalChunks,
    filename: mergeResult?.filename || file.name,
    filePath: mergeResult?.file_path,
    fileSize: Number(mergeResult?.file_size ?? file.size),
    instant: false,
  };
}
