(function attachTaskMDADocumentStorage(globalScope) {
  const ROOT_DIR = 'documents';

  function safeString(value) {
    return String(value == null ? '' : value).trim();
  }

  function slugifySegment(value, fallback = 'general') {
    const raw = safeString(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const cleaned = raw
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return cleaned || fallback;
  }

  function sanitizeFileName(fileName = '') {
    const trimmed = safeString(fileName);
    if (!trimmed) return `document-${Date.now()}.bin`;
    const noControl = trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-');
    return noControl.slice(0, 180) || `document-${Date.now()}.bin`;
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function splitRelativePath(relativePath = '') {
    return safeString(relativePath)
      .replace(/\\/g, '/')
      .split('/')
      .map((part) => safeString(part))
      .filter(Boolean);
  }

  function isValidRelativePath(relativePath = '') {
    const parts = splitRelativePath(relativePath);
    if (!parts.length) return false;
    return parts.every((part) => part !== '.' && part !== '..' && !part.includes(':'));
  }

  async function ensureDirectory(rootHandle, relativeDirPath = '') {
    const segments = splitRelativePath(relativeDirPath);
    let current = rootHandle;
    for (const segment of segments) {
      current = await current.getDirectoryHandle(segment, { create: true });
    }
    return current;
  }

  async function resolveFileHandle(rootHandle, relativePath, options = {}) {
    if (!rootHandle || !isValidRelativePath(relativePath)) return null;
    const parts = splitRelativePath(relativePath);
    if (!parts.length) return null;
    const fileName = parts.pop();
    const dir = await ensureDirectory(rootHandle, parts.join('/'));
    return dir.getFileHandle(fileName, { create: options.create === true });
  }

  function splitFileName(fileName = '') {
    const safe = sanitizeFileName(fileName);
    const idx = safe.lastIndexOf('.');
    if (idx <= 0 || idx === safe.length - 1) return { base: safe, ext: '' };
    return { base: safe.slice(0, idx), ext: safe.slice(idx) };
  }

  async function ensureUniqueFileName(rootHandle, relativeDirPath, fileName) {
    const dir = await ensureDirectory(rootHandle, relativeDirPath);
    const { base, ext } = splitFileName(fileName);
    let candidate = `${base}${ext}`;
    let attempt = 1;
    while (attempt < 5000) {
      try {
        await dir.getFileHandle(candidate, { create: false });
        attempt += 1;
        candidate = `${base} (${attempt})${ext}`;
      } catch (_) {
        return candidate;
      }
    }
    return `${base}-${Date.now()}${ext}`;
  }

  function buildStoragePath(meta = {}) {
    const now = new Date(Number(meta.timestamp || Date.now()) || Date.now());
    const year = String(now.getFullYear());
    const month = pad2(now.getMonth() + 1);
    const day = pad2(now.getDate());
    const rubric = slugifySegment(meta.rubric || 'misc', 'misc');
    const scope = slugifySegment(meta.scope || 'global', 'global');
    const project = slugifySegment(meta.projectId || 'none', 'none');
    const theme = slugifySegment(meta.theme || 'general', 'general');
    const fileName = sanitizeFileName(meta.fileName || 'document.bin');
    return `${ROOT_DIR}/${rubric}/${scope}/${project}/${theme}/${year}/${month}/${day}/${fileName}`;
  }

  async function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function writeFile(rootHandle, file, meta = {}) {
    if (!rootHandle || !file) throw new Error('invalid-storage-input');
    const desiredPath = buildStoragePath({
      rubric: meta.rubric,
      scope: meta.scope,
      projectId: meta.projectId,
      theme: meta.theme,
      fileName: file.name,
      timestamp: meta.timestamp
    });
    const parts = splitRelativePath(desiredPath);
    const desiredFileName = parts.pop();
    const relativeDirPath = parts.join('/');
    const uniqueFileName = await ensureUniqueFileName(rootHandle, relativeDirPath, desiredFileName);
    const storagePath = `${relativeDirPath}/${uniqueFileName}`;
    const fileHandle = await resolveFileHandle(rootHandle, storagePath, { create: true });
    if (!fileHandle) throw new Error('invalid-storage-path');
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(file);
    } finally {
      await writable.close();
    }
    return {
      storageMode: 'fs',
      storageProvider: 'shared-folder',
      storagePath,
      storedAt: Date.now()
    };
  }

  function dataUrlToBlob(dataUrl = '') {
    const value = safeString(dataUrl);
    const commaIdx = value.indexOf(',');
    if (commaIdx < 0) return null;
    const meta = value.slice(0, commaIdx).toLowerCase();
    const payload = value.slice(commaIdx + 1);
    try {
      if (meta.includes(';base64')) {
        const mime = (meta.match(/^data:([^;]+)/i)?.[1] || 'application/octet-stream').trim();
        const binary = atob(payload);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime || 'application/octet-stream' });
      }
      const decoded = decodeURIComponent(payload);
      const mime = (meta.match(/^data:([^;]+)/i)?.[1] || 'text/plain;charset=utf-8').trim();
      return new Blob([decoded], { type: mime || 'text/plain;charset=utf-8' });
    } catch {
      return null;
    }
  }

  async function writeDataUrl(rootHandle, dataUrl = '', meta = {}) {
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) throw new Error('invalid-data-url');
    const fileName = sanitizeFileName(meta.fileName || `document-${Date.now()}.bin`);
    const fileLike = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
    return writeFile(rootHandle, fileLike, meta);
  }

  async function readDataUrl(rootHandle, storagePath, mimeType = 'application/octet-stream') {
    const fileHandle = await resolveFileHandle(rootHandle, storagePath, { create: false });
    if (!fileHandle) return '';
    const file = await fileHandle.getFile();
    if (!file) return '';
    const detectedType = safeString(file.type || mimeType) || 'application/octet-stream';
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    if (!base64) return '';
    return `data:${detectedType};base64,${base64}`;
  }

  async function removeFile(rootHandle, storagePath) {
    if (!rootHandle || !isValidRelativePath(storagePath)) return false;
    const parts = splitRelativePath(storagePath);
    const fileName = parts.pop();
    if (!fileName) return false;
    let dir = rootHandle;
    for (const segment of parts) {
      dir = await dir.getDirectoryHandle(segment, { create: false });
    }
    await dir.removeEntry(fileName);
    return true;
  }

  globalScope.TaskMDADocumentStorage = {
    isAvailable() {
      return typeof FileReader !== 'undefined';
    },
    buildStoragePath,
    readFileAsDataUrl,
    writeFile,
    writeDataUrl,
    readDataUrl,
    removeFile
  };
})(window);
