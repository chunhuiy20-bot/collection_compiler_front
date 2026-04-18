async function computeSampledFileHashOnMainThread(file, { chunkSize = 2 * 1024 * 1024 } = {}) {
  const fileSize = Number(file.size ?? 0);
  const totalChunks = Math.max(1, Math.ceil(fileSize / chunkSize));
  const sampledChunkIndexes = Array.from(new Set([0, Math.floor((totalChunks - 1) / 2), totalChunks - 1]));

  const chunkBytes = [];
  for (const chunkIndex of sampledChunkIndexes) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(fileSize, start + chunkSize);
    const buffer = await file.slice(start, end).arrayBuffer();
    chunkBytes.push(new Uint8Array(buffer));
  }

  const totalLength = chunkBytes.reduce((sum, item) => sum + item.length, 0);
  const sampledBytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const item of chunkBytes) {
    sampledBytes.set(item, offset);
    offset += item.length;
  }

  const digest = await crypto.subtle.digest('SHA-256', sampledBytes.buffer);
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    hash,
    fileSize,
    fingerprint: `${hash}_${fileSize}`,
    sampledChunkIndexes,
  };
}

async function computeWholeFileHashOnMainThread(file) {
  const fileSize = Number(file.size ?? 0);
  const fullBuffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', fullBuffer);
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    hash,
    fileSize,
    fingerprint: `${hash}_${fileSize}`,
  };
}

function runWorkerHash(file, { chunkSize = 2 * 1024 * 1024, mode = 'sampled' } = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/fileHashWorker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (event) => {
      const data = event.data ?? {};
      worker.terminate();

      if (data.ok) {
        resolve({
          hash: data.hash,
          fileSize: Number(data.fileSize ?? file.size),
          fingerprint: data.fingerprint,
          sampledChunkIndexes: data.sampledChunkIndexes ?? [],
        });
        return;
      }

      reject(new Error(data.error || '哈希计算失败'));
    };

    worker.onerror = () => {
      worker.terminate();
      reject(new Error('哈希计算失败'));
    };

    worker.postMessage({ file, chunkSize, mode });
  });
}

export async function computeSampledFileHash(file, { chunkSize = 2 * 1024 * 1024, useWorker = true } = {}) {
  if (!file) {
    throw new Error('缺少文件，无法计算哈希');
  }

  if (useWorker && typeof Worker !== 'undefined') {
    return runWorkerHash(file, { chunkSize, mode: 'sampled' });
  }

  return computeSampledFileHashOnMainThread(file, { chunkSize });
}

export async function computeWholeFileHash(file, { useWorker = true } = {}) {
  if (!file) {
    throw new Error('缺少文件，无法计算哈希');
  }

  if (useWorker && typeof Worker !== 'undefined') {
    return runWorkerHash(file, { mode: 'full' });
  }

  return computeWholeFileHashOnMainThread(file);
}
