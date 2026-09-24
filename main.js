const state = {
  files: [],
  downloadUrl: null,
  isZipping: false
};

const els = {
  dropZone: document.querySelector('#dropZone'),
  browseButton: document.querySelector('#browseButton'),
  browseFolderButton: document.querySelector('#browseFolderButton'),
  fileInput: document.querySelector('#fileInput'),
  folderInput: document.querySelector('#folderInput'),
  fileList: document.querySelector('#fileList'),
  emptyState: document.querySelector('#emptyState'),
  fileCount: document.querySelector('#fileCount'),
  totalSize: document.querySelector('#totalSize'),
  clearButton: document.querySelector('#clearButton'),
  createButton: document.querySelector('#createButton'),
  downloadButton: document.querySelector('#downloadButton'),
  errorMessage: document.querySelector('#errorMessage'),
  zipName: document.querySelector('#zipName'),
  progressWrap: document.querySelector('#progressWrap'),
  progressBar: document.querySelector('#progressBar'),
  progressLabel: document.querySelector('#progressLabel'),
  progressValue: document.querySelector('#progressValue')
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const showError = (message = '') => { els.errorMessage.textContent = message; };

const getRelativePath = (file) => file.webkitRelativePath || file.relativePath || file.name;

const addFiles = (incoming) => {
  showError();
  const incomingFiles = Array.from(incoming || []).filter((file) => file && typeof file.size === 'number');
  if (!incomingFiles.length) return;

  const existingKeys = new Set(state.files.map((file) => `${getRelativePath(file)}-${file.size}-${file.lastModified}`));
  const freshFiles = incomingFiles.filter((file) => {
    const key = `${getRelativePath(file)}-${file.size}-${file.lastModified}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });

  state.files.push(...freshFiles);
  renderFiles();
};

const renderFiles = () => {
  els.fileList.innerHTML = '';
  if (!state.files.length) {
    els.fileList.appendChild(els.emptyState);
  } else {
    state.files.forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'file-item';
      row.innerHTML = `
        <div class="file-name" title="${escapeHtml(getRelativePath(file))}">
          <i data-lucide="file"></i><span>${escapeHtml(getRelativePath(file))}</span>
        </div>
        <span class="file-size">${formatBytes(file.size)}</span>
        <button class="remove-button" type="button" aria-label="Remove ${escapeHtml(file.name)}" data-index="${index}"><i data-lucide="x"></i></button>`;
      els.fileList.appendChild(row);
    });
  }

  const total = state.files.reduce((sum, file) => sum + file.size, 0);
  els.fileCount.textContent = state.files.length ? `${state.files.length} file${state.files.length === 1 ? '' : 's'} ready` : 'No files added';
  els.totalSize.textContent = formatBytes(total);
  els.clearButton.disabled = !state.files.length || state.isZipping;
  els.createButton.disabled = !state.files.length || state.isZipping;
  if (window.lucide) window.lucide.createIcons();
};

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));

const removeFile = (index) => {
  if (state.isZipping) return;
  state.files.splice(index, 1);
  showError();
  renderFiles();
};

const clearAll = () => {
  if (state.isZipping) return;
  state.files = [];
  els.fileInput.value = '';
  els.folderInput.value = '';
  els.downloadButton.hidden = true;
  showError();
  renderFiles();
};

const getCompression = () => Number(document.querySelector('input[name="compression"]:checked').value);

const createZip = async () => {
  if (state.isZipping) return;
  if (!state.files.length) {
    showError('Add at least one file before creating a zip.');
    return;
  }
  if (!window.JSZip) {
    showError('JSZip could not load. Check your internet connection and reload the page.');
    return;
  }

  const cleanName = els.zipName.value.trim().replace(/\.zip$/i, '') || 'my-files';
  state.isZipping = true;
  els.downloadButton.hidden = true;
  els.progressWrap.hidden = false;
  els.progressLabel.textContent = 'Preparing archive…';
  els.progressBar.style.width = '0%';
  els.progressValue.textContent = '0%';
  renderFiles();

  try {
    const zip = new JSZip();
    state.files.forEach((file) => zip.file(getRelativePath(file), file));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: getCompression() } }, (metadata) => {
      const percent = Math.round(metadata.percent);
      els.progressLabel.textContent = percent >= 100 ? 'Finishing archive…' : 'Compressing files…';
      els.progressBar.style.width = `${percent}%`;
      els.progressValue.textContent = `${percent}%`;
    });

    if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
    state.downloadUrl = URL.createObjectURL(blob);
    els.downloadButton.href = state.downloadUrl;
    els.downloadButton.download = `${cleanName}.zip`;
    els.downloadButton.hidden = false;
    els.progressLabel.textContent = 'Zip ready to download';
    els.progressBar.style.width = '100%';
    els.progressValue.textContent = '100%';
  } catch (error) {
    showError('The zip could not be created. Please try again.');
    console.error(error);
  } finally {
    state.isZipping = false;
    renderFiles();
  }
};

const onDrop = async (event) => {
  event.preventDefault();
  els.dropZone.classList.remove('is-over');
  const items = Array.from(event.dataTransfer?.items || []);
  const entries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.some((entry) => entry.isDirectory)) {
    const collected = [];
    await Promise.all(entries.map((entry) => readEntry(entry, '', collected)));
    addFiles(collected);
    return;
  }
  addFiles(event.dataTransfer?.files);
};

const readEntry = (entry, parentPath, output) => new Promise((resolve) => {
  if (entry.isFile) {
    entry.file((file) => {
      file.relativePath = `${parentPath}${file.name}`;
      output.push(file);
      resolve();
    }, resolve);
    return;
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const readBatch = () => reader.readEntries(async (entries) => {
      if (!entries.length) return resolve();
      await Promise.all(entries.map((child) => readEntry(child, `${parentPath}${entry.name}/`, output)));
      readBatch();
    }, resolve);
    readBatch();
    return;
  }
  resolve();
});

els.browseButton.addEventListener('click', () => els.fileInput.click());
els.browseFolderButton.addEventListener('click', () => els.folderInput.click());
els.fileInput.addEventListener('change', (event) => addFiles(event.target.files));
els.folderInput.addEventListener('change', (event) => addFiles(event.target.files));
els.clearButton.addEventListener('click', clearAll);
els.createButton.addEventListener('click', createZip);
els.fileList.addEventListener('click', (event) => {
  const button = event.target.closest('.remove-button');
  if (button) removeFile(Number(button.dataset.index));
});

['dragenter', 'dragover'].forEach((eventName) => els.dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  els.dropZone.classList.add('is-over');
}));
['dragleave', 'drop'].forEach((eventName) => els.dropZone.addEventListener(eventName, (event) => {
  if (eventName === 'drop') return;
  event.preventDefault();
  els.dropZone.classList.remove('is-over');
}));
els.dropZone.addEventListener('drop', onDrop);
els.dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    els.fileInput.click();
  }
});

renderFiles();
if (window.lucide) window.lucide.createIcons();
