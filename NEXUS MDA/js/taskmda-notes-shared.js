(function initTaskMdaNotesSharedModule(global) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = String(value == null ? '' : value);
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(value == null ? '' : value);
  }

  function setChecked(id, checked) {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = !!checked;
  }

  function setDisabled(id, disabled) {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = !!disabled;
  }

  function setHidden(id, hidden) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('hidden', !!hidden);
  }

  function setHtml(id, html) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = String(html == null ? '' : html);
  }

  function setDataNoteId(id, noteId) {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('data-note-id', String(noteId || '').trim());
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  function applyReadModalContent(config = {}) {
    setText(config.titleId, config.titleText || '');
    setText(config.metaId, config.metaText || '');
    setHtml(config.badgesId, config.badgesHtml || '');
    setHtml(config.contentId, config.contentHtml || '');
    setHtml(config.tagsId, config.tagsHtml || '');
    setHtml(config.linksId, config.linksHtml || '');
  }

  function applyEditorForm(config = {}) {
    setText(config.modalTitleId, config.modalTitle || '');
    setValue(config.titleInputId, config.title || '');
    setValue(config.themeInputId, config.theme || '');
    setValue(config.tagsInputId, config.tags || '');
    setChecked(config.visibilityInputId, config.isVisible === true);
    setChecked(config.shareInputId, config.share === true);
    setHidden(config.deleteBtnId, config.showDelete !== true);
    setHidden(config.saveBtnId, config.showSave !== true);
    setHidden(config.digestBtnId, config.showDigest !== true);
    setHidden(config.attachBtnId, config.showAttach !== true);
    setDisabled(config.titleInputId, config.disabled === true);
    setDisabled(config.themeInputId, config.disabled === true);
    setDisabled(config.tagsInputId, config.disabled === true);
    setDisabled(config.visibilityInputId, config.disabled === true);
    setDisabled(config.shareInputId, config.disabled === true);
    setDisabled(config.attachBtnId, config.disabled === true);
  }

  function renderBadgeChips(items = []) {
    return (Array.isArray(items) ? items : [])
      .map((item) => {
        const label = String(item?.label || '').trim();
        if (!label) return '';
        const className = String(item?.className || 'bg-slate-100 text-slate-700').trim();
        return `<span class="inline-flex text-[10px] px-2 py-1 rounded-full ${className} font-semibold">${escapeHtml(label)}</span>`;
      })
      .filter(Boolean)
      .join('');
  }

  function renderTagChips(tags = [], emptyLabel = 'Aucun tag') {
    const safeTags = (Array.isArray(tags) ? tags : [])
      .map((tag) => String(tag || '').trim())
      .filter(Boolean);
    if (!safeTags.length) return `<span class="text-xs text-slate-500">${escapeHtml(emptyLabel)}</span>`;
    return safeTags
      .map((tag) => `<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">#${escapeHtml(tag)}</span>`)
      .join('');
  }

  function renderInlineDocLinks(docs = [], options = {}) {
    const previewLabel = String(options.previewLabel || 'Aperçu');
    const downloadLabel = String(options.downloadLabel || 'Télécharger');
    return (Array.isArray(docs) ? docs : [])
      .map((doc) => {
        const name = String(doc?.name || 'Document').trim() || 'Document';
        const previewAction = String(doc?.previewAction || '').trim();
        const downloadAction = String(doc?.downloadAction || '').trim();
        const deleteAction = String(doc?.deleteAction || '').trim();
        return `
          <div class="inline-flex items-center gap-1 mr-2 mb-1">
            <span class="inline-flex items-center text-xs text-slate-700">📎 ${escapeHtml(name)}</span>
            ${previewAction ? `<button type="button" class="workspace-action-inline" data-action-kind="preview" data-action-label="${escapeHtml(previewLabel)}" onclick="${previewAction}">${escapeHtml(previewLabel)}</button>` : ''}
            ${downloadAction ? `<button type="button" class="workspace-action-inline" data-action-kind="export" data-action-label="${escapeHtml(downloadLabel)}" onclick="${downloadAction}">${escapeHtml(downloadLabel)}</button>` : ''}
            ${deleteAction ? `<button type="button" class="workspace-action-inline" data-action-kind="danger" data-action-label="Supprimer le document" onclick="${deleteAction}">Supprimer</button>` : ''}
          </div>
        `;
      })
      .join('');
  }

  global.TaskMDANotesShared = {
    setText,
    setValue,
    setChecked,
    setDisabled,
    setHidden,
    setHtml,
    setDataNoteId,
    openModal,
    closeModal,
    applyReadModalContent,
    applyEditorForm,
    renderBadgeChips,
    renderTagChips,
    renderInlineDocLinks
  };
}(window));
