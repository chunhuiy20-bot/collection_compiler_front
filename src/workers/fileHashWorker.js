self.onmessage = async (event) => {
  try {
    const { file, chunkSize = 2 * 1024 * 1024, mode = 'sampled' } = event.data ?? {};
    if (!file) {
      throw new Error('缺少文件，无法计算哈希');
    }

    const fileSize = Number(file.size ?? 0);
    if (mode === 'full') {
      const fullBuffer = await file.arrayBuffer();
      const fullDigest = await crypto.subtle.digest('SHA-256', fullBuffer);
      const fullHash = Array.from(new Uint8Array(fullDigest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      self.postMessage({
        ok: true,
        mode: 'full',
        hash: fullHash,
        fileSize,
        fingerprint: `${fullHash}_${fileSize}`,
      });
      return;
    }

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

    self.postMessage({
      ok: true,
      mode: 'sampled',
      hash,
      fileSize,
      fingerprint: `${hash}_${fileSize}`,
      sampledChunkIndexes,
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error?.message || '哈希计算失败',
    });
  }
};
