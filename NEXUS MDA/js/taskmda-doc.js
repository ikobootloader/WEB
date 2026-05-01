/* TaskMDA Doc Bundle (manual, no-build) */
/* Consolidates taskmda-doc-* modules */

/* --- taskmda-doc-storage-binding.js --- */
(function initTaskMdaDocStorageBindingModule(global) {
  'use strict';

  function createModule(options) {
    const opts = options || {};
    const state = opts.state || {};
    const docPreviewInlineLastSavedValues = new Map();
    const docPreviewInlineDebounceTimers = new Map();
    const docPreviewInlineFinalizeTimers = new Map();

    function getSharedFolderHandle() {
      return typeof state.getSharedFolderHandle === 'function' ? state.getSharedFolderHandle() : null;
    }

    function getCurrentProjectId() {
      return typeof state.getCurrentProjectId === 'function' ? state.getCurrentProjectId() : null;
    }

    function canUseSharedFilesystemDocumentStorage() {
      return Boolean(getSharedFolderHandle() && global.TaskMDADocumentStorage?.isAvailable?.());
    }

    async function resolveDocumentDataForRuntime(doc) {
      if (String(doc?.data || '').trim()) return String(doc.data || '');
      if (!canUseSharedFilesystemDocumentStorage()) return '';
      if (String(doc?.storageMode || '').trim() !== 'fs') return '';
      const storagePath = String(doc?.storagePath || '').trim();
      if (!storagePath) return '';
      try {
        const dataUrl = await global.TaskMDADocumentStorage.readDataUrl(
          getSharedFolderHandle(),
          storagePath,
          String(doc?.type || 'application/octet-stream')
        );
        return String(dataUrl || '');
      } catch (error) {
        console.warn('Unable to load document from shared filesystem:', error);
        return '';
      }
    }

    async function hydrateDocumentDataForRuntime(doc) {
      if (!doc || typeof doc !== 'object') return doc;
      if (String(doc.data || '').trim()) return doc;
      const resolvedData = await resolveDocumentDataForRuntime(doc);
      if (!resolvedData) return doc;
      return { ...doc, data: resolvedData };
    }

    function inferStorageRubricFromPath(storagePath, fallback) {
      const normalized = String(storagePath || '').replace(/\\/g, '/');
      const parts = normalized.split('/').filter(Boolean);
      const idx = parts.findIndex((part) => part === 'documents');
      const rubric = idx >= 0 ? String(parts[idx + 1] || '').trim() : '';
      return rubric || String(fallback || 'document-upload');
    }

    function inferStorageScopeFromPath(storagePath, fallback) {
      const normalized = String(storagePath || '').replace(/\\/g, '/');
      const parts = normalized.split('/').filter(Boolean);
      const idx = parts.findIndex((part) => part === 'documents');
      const scope = idx >= 0 ? String(parts[idx + 2] || '').trim() : '';
      return scope || String(fallback || 'project');
    }

    function inferStorageProjectFromPath(storagePath, fallback) {
      const normalized = String(storagePath || '').replace(/\\/g, '/');
      const parts = normalized.split('/').filter(Boolean);
      const idx = parts.findIndex((part) => part === 'documents');
      const projectId = idx >= 0 ? String(parts[idx + 3] || '').trim() : '';
      return projectId || String(fallback || 'global');
    }

    async function maybeRelocateStoredDocumentByTheme(doc, nextTheme, context) {
      const safeContext = context && typeof context === 'object' ? context : {};
      const currentTheme = String(doc?.theme || '').trim() || 'General';
      const targetTheme = String(nextTheme || '').trim() || 'General';
      if (!canUseSharedFilesystemDocumentStorage()) return {};
      if (String(doc?.storageMode || '').trim() !== 'fs') return {};
      const oldStoragePath = String(doc?.storagePath || '').trim();
      if (!oldStoragePath) return {};
      const currentScope = inferStorageScopeFromPath(oldStoragePath, 'project');
      const currentProjectId = inferStorageProjectFromPath(oldStoragePath, 'global');
      const targetScope = String(safeContext.scope || '').trim() || currentScope || 'project';
      const targetProjectId = String(safeContext.projectId || '').trim() || currentProjectId || 'global';
      const normalizeSearch = opts.normalizeSearch || ((value) => String(value || '').toLowerCase());
      const keepSameTheme = normalizeSearch(currentTheme) === normalizeSearch(targetTheme);
      const keepSameScope = normalizeSearch(currentScope) === normalizeSearch(targetScope);
      const keepSameProject = normalizeSearch(currentProjectId) === normalizeSearch(targetProjectId);
      const force = safeContext.force === true;
      if (keepSameTheme && keepSameScope && keepSameProject && !force) return {};
      const dataUrl = await resolveDocumentDataForRuntime(doc);
      if (!String(dataUrl || '').trim()) return {};
      const rubric = String(safeContext.rubric || '').trim() || inferStorageRubricFromPath(oldStoragePath, 'document-upload');
      try {
        const fsMeta = await global.TaskMDADocumentStorage.writeDataUrl(getSharedFolderHandle(), dataUrl, {
          rubric,
          scope: targetScope,
          projectId: targetProjectId,
          theme: targetTheme,
          fileName: String(doc?.name || 'document.bin')
        });
        try {
          await global.TaskMDADocumentStorage.removeFile(getSharedFolderHandle(), oldStoragePath);
        } catch (_) {}
        return {
          storageMode: fsMeta.storageMode || 'fs',
          storageProvider: fsMeta.storageProvider || 'shared-folder',
          storagePath: fsMeta.storagePath || oldStoragePath,
          storedAt: Number(fsMeta.storedAt || Date.now()) || Date.now(),
          data: ''
        };
      } catch (error) {
        console.warn('Unable to relocate stored document for theme change:', error);
        return {};
      }
    }

    async function readDocumentFilesFromInput(inputId, options) {
      const input = document.getElementById(String(inputId || ''));
      const files = Array.from(input?.files || []);
      if (!files.length) return [];
      const safeOptions = options && typeof options === 'object' ? options : {};
      const useFsStorage = canUseSharedFilesystemDocumentStorage();
      const fileScope = String(safeOptions.scope || 'project').trim() || 'project';
      const fileProjectId = String(safeOptions.projectId || getCurrentProjectId() || 'global').trim() || 'global';
      const fileTheme = String(safeOptions.theme || 'General').trim() || 'General';
      const fileRubric = String(safeOptions.rubric || 'document-upload').trim() || 'document-upload';
      return Promise.all(files.map(async (file) => {
        const baseDoc = {
          docId: opts.uuidv4?.() || String(Date.now()),
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          uploadedAt: Date.now()
        };
        if (useFsStorage) {
          try {
            const fsMeta = await global.TaskMDADocumentStorage.writeFile(getSharedFolderHandle(), file, {
              rubric: fileRubric,
              scope: fileScope,
              projectId: fileProjectId,
              theme: fileTheme
            });
            return {
              ...baseDoc,
              data: '',
              storageMode: fsMeta.storageMode,
              storageProvider: fsMeta.storageProvider,
              storagePath: fsMeta.storagePath,
              storedAt: fsMeta.storedAt
            };
          } catch (error) {
            console.warn('Falling back to IndexedDB payload storage for document:', error);
          }
        }
        const data = global.TaskMDADocumentStorage?.readFileAsDataUrl
          ? await global.TaskMDADocumentStorage.readFileAsDataUrl(file)
          : await opts.fileToDataUrl?.(file);
        return { ...baseDoc, data };
      }));
    }

    async function readProjectDocumentFiles(options) {
      return readDocumentFilesFromInput('project-doc-files', options || {});
    }

    async function readCreateProjectDocumentFiles(options) {
      return readDocumentFilesFromInput('project-create-doc-files', options || {});
    }

    async function readEditProjectDocumentFiles(options) {
      return readDocumentFilesFromInput('edit-project-doc-files', options || {});
    }

    async function resolveDocumentPreviewContext(ref) {
      const safeRef = ref && typeof ref === 'object' ? ref : {};
      const sourceType = String(safeRef.sourceType || '').trim();
      if (sourceType === 'standalone' && safeRef.id) {
        const row = await opts.getDecrypted?.('globalDocs', safeRef.id, 'id');
        if (!row) return null;
        const hydrated = await hydrateDocumentDataForRuntime(row);
        return {
          ...safeRef,
          sourceType: 'standalone',
          docRef: String(safeRef.id || ''),
          doc: hydrated,
          canEdit: true
        };
      }
      if (sourceType === 'project-doc' && safeRef.projectId && safeRef.docId) {
        const stateSnapshot = await opts.getProjectState?.(safeRef.projectId, { ignoreAccessCheck: true });
        const doc = (stateSnapshot?.documents || []).find((item) => String(item.docId || '') === String(safeRef.docId || ''));
        if (!stateSnapshot?.project || !doc) return null;
        const currentUserId = String(opts.getCurrentUserId?.() || '').trim();
        const canEdit = !!(
          opts.canEditProjectMeta?.(stateSnapshot)
          || (doc.createdBy && String(doc.createdBy || '').trim() === currentUserId)
        );
        const hydrated = await hydrateDocumentDataForRuntime({
          ...doc,
          sourceProjectName: stateSnapshot.project.name
        });
        return {
          ...safeRef,
          sourceType: 'project-doc',
          docRef: `${safeRef.projectId}:project-doc:${doc.docId}`,
          doc: hydrated,
          canEdit
        };
      }
      if ((sourceType === 'project' || sourceType === 'task-attachment') && safeRef.projectId && safeRef.taskId && Number.isFinite(Number(safeRef.attachmentIndex))) {
        const stateSnapshot = await opts.getProjectState?.(safeRef.projectId, { ignoreAccessCheck: true });
        const task = (stateSnapshot?.tasks || []).find((item) => String(item.taskId || '') === String(safeRef.taskId || ''));
        const idx = Number(safeRef.attachmentIndex);
        const attachment = task?.attachments?.[idx];
        if (!stateSnapshot?.project || !task || !attachment) return null;
        const hydrated = await hydrateDocumentDataForRuntime({
          ...attachment,
          sourceProjectName: stateSnapshot.project.name,
          sharingMode: opts.normalizeSharingMode?.(stateSnapshot.project.sharingMode, 'shared') || 'shared'
        });
        return {
          ...safeRef,
          sourceType: 'task-attachment',
          docRef: `${safeRef.projectId}:${task.taskId}:${idx}`,
          doc: hydrated,
          canEdit: !!opts.canEditTaskInProject?.(task, stateSnapshot)
        };
      }
      return null;
    }

    function normalizeDocumentPreviewInlineFieldValue(field, rawValue) {
      if (typeof opts.normalizeDocumentPreviewInlineFieldValue === 'function') {
        return opts.normalizeDocumentPreviewInlineFieldValue(field, rawValue);
      }
      const value = rawValue == null ? '' : String(rawValue);
      if (field === 'name') return value.trim();
      if (field === 'theme') return value.trim() || 'General';
      if (field === 'notes') return value.replace(/\r\n/g, '\n').trim();
      if (field === 'sharingMode') return opts.normalizeSharingMode?.(value, 'private') || 'private';
      return value.trim();
    }

    async function persistDocumentPreviewInlineField(params) {
      const field = String(params?.field || '').trim();
      const rawValue = params?.rawValue;
      const force = params?.force === true;
      const context = params?.context && typeof params.context === 'object' ? params.context : null;
      if (!field || !context?.doc) return { applied: false };
      const normalizedValue = normalizeDocumentPreviewInlineFieldValue(field, rawValue);
      const saveKey = `${context.docRef || context.id || ''}::${field}`;
      const signature = `${field}::${normalizedValue}`;
      if (!force && docPreviewInlineLastSavedValues.get(saveKey) === signature) {
        return { applied: false, skipped: 'same-value', normalizedValue };
      }

      const sourceType = String(context.sourceType || '').trim();
      let contextPatch = null;

      if (sourceType === 'standalone') {
        const row = await opts.getDecrypted?.('globalDocs', context.id, 'id');
        if (!row) return { applied: false };
        const next = { ...row, updatedAt: Date.now() };
        if (field === 'name' && normalizedValue) next.name = normalizedValue;
        if (field === 'theme') {
          const themeTarget = normalizedValue || 'General';
          const relocated = await maybeRelocateStoredDocumentByTheme(row, themeTarget, {
            scope: 'global',
            projectId: 'global',
            rubric: inferStorageRubricFromPath(row?.storagePath || '', 'global-doc-upload')
          });
          Object.assign(next, relocated);
          next.theme = themeTarget;
        }
        if (field === 'notes') next.notes = normalizedValue;
        if (field === 'sharingMode') {
          next.sharingMode = opts.normalizeSharingMode?.(
            normalizedValue,
            opts.normalizeSharingMode?.(row.sharingMode, 'private') || 'private'
          ) || 'private';
        }
        await opts.putEncrypted?.('globalDocs', next, 'id');
        contextPatch = next;
      } else if (sourceType === 'project-doc') {
        const stateSnapshot = await opts.getProjectState?.(context.projectId, { ignoreAccessCheck: true });
        if (!stateSnapshot?.project) return { applied: false };
        const doc = (stateSnapshot.documents || []).find((item) => String(item.docId || '') === String(context.docId || ''));
        if (!doc) return { applied: false };
        const currentUserId = String(opts.getCurrentUserId?.() || '').trim();
        const canEdit = !!(
          opts.canEditProjectMeta?.(stateSnapshot)
          || (doc.createdBy && String(doc.createdBy || '').trim() === currentUserId)
        );
        if (!canEdit) return { applied: false, skipped: 'forbidden' };
        const changes = {};
        if (field === 'name' && normalizedValue) changes.name = normalizedValue;
        if (field === 'theme') {
          const themeTarget = normalizedValue || 'General';
          const relocated = await maybeRelocateStoredDocumentByTheme(doc, themeTarget, {
            scope: 'project',
            projectId: context.projectId,
            rubric: inferStorageRubricFromPath(doc?.storagePath || '', 'project-doc-upload')
          });
          Object.assign(changes, relocated);
          changes.theme = themeTarget;
        }
        if (field === 'notes') changes.notes = normalizedValue;
        if (field === 'sharingMode') {
          changes.sharingMode = opts.normalizeSharingMode?.(
            normalizedValue,
            opts.normalizeSharingMode?.(
              doc.sharingMode,
              opts.normalizeSharingMode?.(stateSnapshot.project.sharingMode, 'shared') || 'shared'
            ) || 'shared'
          ) || 'shared';
        }
        if (!Object.keys(changes).length) return { applied: false };
        const event = opts.createEvent?.(
          opts.EventTypes?.UPDATE_DOCUMENT,
          context.projectId,
          currentUserId,
          { docId: doc.docId, changes }
        );
        await opts.publishEvent?.(event);
        if (opts.hasSharedFolderHandle?.()) {
          void opts.syncProjectEventsToSharedSpace?.(context.projectId, [event]);
        }
        contextPatch = changes;
      } else if ((sourceType === 'project' || sourceType === 'task-attachment') && field === 'name') {
        const stateSnapshot = await opts.getProjectState?.(context.projectId, { ignoreAccessCheck: true });
        const task = (stateSnapshot?.tasks || []).find((item) => String(item.taskId || '') === String(context.taskId || ''));
        const idx = Number(context.attachmentIndex);
        if (!stateSnapshot?.project || !task || !task.attachments?.[idx] || !opts.canEditTaskInProject?.(task, stateSnapshot)) {
          return { applied: false, skipped: 'forbidden' };
        }
        const attachments = [...(task.attachments || [])];
        attachments[idx] = { ...attachments[idx], name: normalizedValue || attachments[idx].name };
        const currentUserId = String(opts.getCurrentUserId?.() || '').trim();
        const event = opts.createEvent?.(
          opts.EventTypes?.UPDATE_TASK,
          context.projectId,
          currentUserId,
          { taskId: task.taskId, changes: { attachments } }
        );
        await opts.publishEvent?.(event);
        if (opts.hasSharedFolderHandle?.()) {
          void opts.syncProjectEventsToSharedSpace?.(context.projectId, [event]);
        }
        contextPatch = { name: attachments[idx].name };
      } else {
        return { applied: false };
      }

      docPreviewInlineLastSavedValues.set(saveKey, signature);
      return { applied: true, normalizedValue, signature, contextPatch };
    }

    async function scheduleDocumentPreviewInlineSave(params) {
      const field = String(params?.field || '').trim();
      const rawValue = params?.rawValue;
      const context = params?.context && typeof params.context === 'object' ? params.context : null;
      const immediate = params?.immediate === true;
      if (!field || !context?.doc) return;
      const normalizedValue = normalizeDocumentPreviewInlineFieldValue(field, rawValue);
      if (docPreviewInlineDebounceTimers.has(field)) {
        clearTimeout(docPreviewInlineDebounceTimers.get(field));
      }
      docPreviewInlineDebounceTimers.set(field, setTimeout(() => {
        opts.setInlineSaveIndicator?.('doc-preview', 'saving');
        opts.runWithoutGlobalLoading?.(() => persistDocumentPreviewInlineField({
          field,
          rawValue: normalizedValue,
          context
        }))
          ?.then((result) => {
            if (result?.contextPatch) opts.onDocumentPreviewContextPatch?.(result.contextPatch, context);
            opts.setInlineSaveIndicator?.('doc-preview', 'saved');
          })
          ?.catch((error) => {
            opts.setInlineSaveIndicator?.('doc-preview', 'error');
            console.error('document preview inline save failed', error);
          });
      }, immediate ? 0 : 220));

      if (docPreviewInlineFinalizeTimers.has(field)) {
        clearTimeout(docPreviewInlineFinalizeTimers.get(field));
      }
      docPreviewInlineFinalizeTimers.set(field, setTimeout(() => {
        opts.setInlineSaveIndicator?.('doc-preview', 'saving');
        opts.runWithoutGlobalLoading?.(() => persistDocumentPreviewInlineField({
          field,
          rawValue: normalizedValue,
          context,
          force: true
        }))
          ?.then((result) => {
            if (result?.contextPatch) opts.onDocumentPreviewContextPatch?.(result.contextPatch, context);
            opts.setInlineSaveIndicator?.('doc-preview', 'saved');
          })
          ?.catch((error) => {
            opts.setInlineSaveIndicator?.('doc-preview', 'error');
            console.error('document preview inline finalize save failed', error);
          });
      }, 900));
    }

    function resetDocumentPreviewInlineEditingState() {
      for (const timer of docPreviewInlineDebounceTimers.values()) clearTimeout(timer);
      for (const timer of docPreviewInlineFinalizeTimers.values()) clearTimeout(timer);
      docPreviewInlineDebounceTimers.clear();
      docPreviewInlineFinalizeTimers.clear();
    }

    return {
      canUseSharedFilesystemDocumentStorage,
      resolveDocumentDataForRuntime,
      hydrateDocumentDataForRuntime,
      inferStorageRubricFromPath,
      inferStorageScopeFromPath,
      inferStorageProjectFromPath,
      maybeRelocateStoredDocumentByTheme,
      readDocumentFilesFromInput,
      readProjectDocumentFiles,
      readCreateProjectDocumentFiles,
      readEditProjectDocumentFiles,
      resolveDocumentPreviewContext,
      persistDocumentPreviewInlineField,
      scheduleDocumentPreviewInlineSave,
      resetDocumentPreviewInlineEditingState
    };
  }

  global.TaskMDADocStorageBinding = { createModule };
})(window);


/* --- taskmda-doc-preview-inline-ui.js --- */
(function initTaskMdaDocPreviewInlineUiModule(global) {
  'use strict';

  function createModule(options) {
    const opts = options || {};

    function normalizeFieldValue(field, rawValue) {
      const value = rawValue == null ? '' : String(rawValue);
      if (field === 'name') return value.trim();
      if (field === 'theme') return value.trim() || 'General';
      if (field === 'notes') return value.replace(/\r\n/g, '\n').trim();
      if (field === 'sharingMode') return opts.normalizeSharingMode?.(value, 'private') || 'private';
      return value.trim();
    }

    function getFieldValue(doc, field) {
      if (field === 'name') return String(doc?.name || '');
      if (field === 'theme') return String(doc?.theme || 'General');
      if (field === 'notes') return String(doc?.notes || '');
      if (field === 'sharingMode') return opts.normalizeSharingMode?.(doc?.sharingMode, 'private') || 'private';
      return '';
    }

    function canMutateContext(expectedContext) {
      const context = opts.getCurrentContext?.();
      if (!context?.doc) return false;
      if (expectedContext && context !== expectedContext) return false;
      return true;
    }

    function mergeContextDoc(patch, expectedContext) {
      if (!canMutateContext(expectedContext)) return false;
      const context = opts.getCurrentContext?.();
      context.doc = { ...(context.doc || {}), ...(patch || {}) };
      return true;
    }

    function decorateEditableElement(el, field) {
      if (!el) return;
      el.dataset.inlineDocPreviewField = field;
      const canEdit = !!opts.getCanEdit?.();
      el.classList.toggle('task-detail-inline-editable', canEdit);
      if (canEdit) {
        el.setAttribute('title', 'Cliquer pour modifier');
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
      } else {
        el.removeAttribute('title');
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
      }
    }

    function refreshInlineDisplay(field, value) {
      const normalized = normalizeFieldValue(field, value);
      const contextDoc = opts.getCurrentContext?.()?.doc || {};
      if (field === 'name') {
        const el = document.getElementById('doc-preview-meta-name');
        const title = document.getElementById('doc-preview-title');
        const display = normalized || 'document';
        if (el) {
          el.textContent = display;
          decorateEditableElement(el, 'name');
        }
        if (title) title.textContent = `AperÃ§u: ${display}`;
        return;
      }
      if (field === 'theme') {
        const el = document.getElementById('doc-preview-meta-theme');
        if (el) {
          el.textContent = normalized || 'GÃ©nÃ©ral';
          decorateEditableElement(el, 'theme');
        }
        return;
      }
      if (field === 'notes') {
        const el = document.getElementById('doc-preview-meta-notes');
        if (el) {
          el.textContent = normalized || 'Aucune note.';
          decorateEditableElement(el, 'notes');
        }
        return;
      }
      if (field === 'sharingMode') {
        const el = document.getElementById('doc-preview-meta-sharing');
        if (el) {
          const mode = opts.normalizeSharingMode?.(
            normalized,
            opts.normalizeSharingMode?.(contextDoc?.sharingMode, 'private') || 'private'
          ) || 'private';
          el.textContent = opts.sharingModeLabel?.(mode) || mode;
          decorateEditableElement(el, 'sharingMode');
        }
      }
    }

    function buildInlineEditor(field, value) {
      if (field === 'notes') {
        const textarea = document.createElement('textarea');
        textarea.rows = 4;
        textarea.className = 'task-detail-inline-input task-detail-inline-textarea';
        textarea.value = String(value || '');
        textarea.placeholder = 'Ajouter une note';
        return textarea;
      }
      if (field === 'sharingMode') {
        const select = document.createElement('select');
        select.className = 'task-detail-inline-input task-detail-inline-select';
        [
          ['private', 'PrivÃ©e'],
          ['shared', 'Collaborative']
        ].forEach(([v, l]) => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = l;
          if (v === value) opt.selected = true;
          select.appendChild(opt);
        });
        return select;
      }
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'task-detail-inline-input';
      input.value = String(value || '');
      return input;
    }

    function startInlineEdit(triggerEl) {
      const currentContext = opts.getCurrentContext?.();
      const canEdit = !!opts.getCanEdit?.();
      if (!canEdit || !triggerEl || triggerEl.dataset.inlineEditing === '1') return;
      const field = String(triggerEl.dataset.inlineDocPreviewField || '').trim();
      if (!field) return;
      if ((currentContext?.sourceType === 'project' || currentContext?.sourceType === 'task-attachment') && field !== 'name') return;
      const startValue = getFieldValue(currentContext?.doc || {}, field);
      triggerEl.dataset.inlineEditing = '1';
      triggerEl.classList.add('is-inline-editing');
      triggerEl.innerHTML = '';

      const wrap = document.createElement('span');
      wrap.className = 'task-detail-inline-editor-wrap';
      const editor = buildInlineEditor(field, startValue);
      wrap.appendChild(editor);
      triggerEl.appendChild(wrap);

      let done = false;
      const finish = async (nextValue, commit) => {
        if (done) return;
        done = true;
        triggerEl.dataset.inlineEditing = '0';
        triggerEl.classList.remove('is-inline-editing');
        if (commit) {
          const normalized = normalizeFieldValue(field, nextValue);
          mergeContextDoc({ [field]: normalized }, currentContext);
          await opts.scheduleSave?.(field, normalized, { immediate: true, expectedContext: currentContext });
          refreshInlineDisplay(field, normalized);
        } else {
          refreshInlineDisplay(field, startValue);
        }
      };

      editor.addEventListener('input', async () => {
        const val = editor.value;
        mergeContextDoc({ [field]: val }, currentContext);
        await opts.scheduleSave?.(field, val, { expectedContext: currentContext });
      });
      editor.addEventListener('blur', async () => {
        await finish(editor.value, true);
      });
      editor.addEventListener('keydown', async (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          await finish(startValue, false);
          return;
        }
        if (event.key === 'Enter' && field !== 'notes') {
          event.preventDefault();
          editor.blur();
        }
      });

      requestAnimationFrame(() => {
        editor.focus();
        if (typeof editor.select === 'function' && field !== 'sharingMode') editor.select();
      });
    }

    function initInlineEditing(canEdit) {
      opts.setCanEdit?.(!!canEdit);
      const context = opts.getCurrentContext?.();
      const editableFields = ['name', 'sharingMode', 'theme', 'notes'];
      editableFields.forEach((field) => {
        const el = document.getElementById(`doc-preview-meta-${field === 'sharingMode' ? 'sharing' : field}`);
        if (!el) return;
        if ((context?.sourceType === 'project' || context?.sourceType === 'task-attachment') && field !== 'name') {
          el.classList.remove('task-detail-inline-editable');
          el.removeAttribute('title');
          el.removeAttribute('data-inline-doc-preview-field');
          el.removeAttribute('tabindex');
          el.removeAttribute('role');
          return;
        }
        decorateEditableElement(el, field);
      });

      const modal = document.getElementById('modal-doc-preview');
      if (!modal || modal.dataset.inlineDocPreviewBound === '1') return;
      modal.dataset.inlineDocPreviewBound = '1';
      modal.addEventListener('click', (event) => {
        const clickTarget = event.target instanceof Element ? event.target : null;
        if (clickTarget?.closest('a[data-inline-ignore], a[href], button')) return;
        const trigger = clickTarget?.closest('[data-inline-doc-preview-field]');
        if (!trigger) return;
        if (trigger.querySelector('.task-detail-inline-editor-wrap')) return;
        startInlineEdit(trigger);
      });
      modal.addEventListener('keydown', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const trigger = target?.closest('[data-inline-doc-preview-field]');
        if (!trigger) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (opts.shouldIgnoreInlineActivationKeydown?.(target, trigger)) return;
        event.preventDefault();
        startInlineEdit(trigger);
      });
    }

    return {
      normalizeFieldValue,
      getFieldValue,
      mergeContextDoc,
      refreshInlineDisplay,
      startInlineEdit,
      initInlineEditing
    };
  }

  global.TaskMDADocPreviewInlineUI = { createModule };
})(window);


/* --- taskmda-doc-preview-modal-ui.js --- */
(function initTaskMdaDocPreviewModalUiModule(global) {
  'use strict';

  function createModule(options) {
    const opts = options || {};

    function parseDocumentPreviewRef(refEncoded) {
      try {
        if (!refEncoded) return null;
        return JSON.parse(decodeURIComponent(refEncoded));
      } catch {
        return null;
      }
    }

    function getDocumentPreviewSourceLabel(ctx) {
      const safeCtx = ctx && typeof ctx === 'object' ? ctx : {};
      if (safeCtx.sourceType === 'standalone') return 'Hors projet';
      if (safeCtx.sourceType === 'project-doc') return String(safeCtx.sourceProjectName || 'Document projet');
      if (safeCtx.sourceType === 'project') return String(safeCtx.sourceProjectName || 'PiÃ¨ce jointe de tÃ¢che');
      if (safeCtx.sourceType === 'task-attachment') return String(safeCtx.sourceProjectName || 'PiÃ¨ce jointe de tÃ¢che');
      return 'Document';
    }

    function formatDocumentStoragePathForDisplay(doc) {
      const safeDoc = doc && typeof doc === 'object' ? doc : {};
      const path = String(safeDoc.storagePath || '').trim();
      if (path) return path;
      if (String(safeDoc.storageMode || '').trim() === 'fs') return 'Stockage disque (chemin non disponible)';
      return 'Stockage local (IndexedDB)';
    }

    function applyPreviewMetadata(context, fallbackName) {
      const ctx = context && typeof context === 'object' ? context : {};
      const doc = ctx.doc && typeof ctx.doc === 'object' ? ctx.doc : {};
      const safeName = String(doc.name || fallbackName || 'document');
      const metaName = document.getElementById('doc-preview-meta-name');
      const metaTheme = document.getElementById('doc-preview-meta-theme');
      const metaNotes = document.getElementById('doc-preview-meta-notes');
      const metaSharing = document.getElementById('doc-preview-meta-sharing');
      const metaSource = document.getElementById('doc-preview-meta-source');
      if (metaName) metaName.textContent = safeName;
      if (metaTheme) metaTheme.textContent = String(doc.theme || 'GÃ©nÃ©ral');
      if (metaNotes) metaNotes.textContent = String(doc.notes || 'Aucune note.');
      if (metaSharing) {
        const mode = opts.normalizeSharingMode?.(doc.sharingMode, 'private') || 'private';
        metaSharing.textContent = opts.sharingModeLabel?.(mode) || mode;
      }
      if (metaSource) metaSource.textContent = getDocumentPreviewSourceLabel(ctx);
    }

    async function renderPreviewContent(contentEl, payload) {
      if (!contentEl) return;
      const safePayload = payload && typeof payload === 'object' ? payload : {};
      const data = String(safePayload.data || '');
      const type = String(safePayload.type || '');
      const name = String(safePayload.name || 'document');
      contentEl.innerHTML = '';

      if (!data) {
        const p = document.createElement('p');
        p.className = 'text-sm text-slate-500';
        p.textContent = 'Aucun contenu disponible pour ce document.';
        contentEl.appendChild(p);
        return;
      }

      if (type.startsWith('image/')) {
        const safeSrc = opts.sanitizeUrlForDom?.(data, {
          allowHttp: true,
          allowBlob: true,
          allowData: true,
          allowDataMimePrefixes: ['image/']
        }) || '';
        if (!safeSrc) {
          const p = document.createElement('p');
          p.className = 'text-sm text-slate-500';
          p.textContent = 'Previsualisation bloquee (source non sure).';
          contentEl.appendChild(p);
          return;
        }
        const img = document.createElement('img');
        img.src = safeSrc;
        img.alt = name || 'image';
        img.className = 'max-w-full h-auto rounded-lg mx-auto';
        contentEl.appendChild(img);
        return;
      }

      if (type.includes('pdf') || name.toLowerCase().endsWith('.pdf')) {
        const rendered = await opts.renderPdfPreviewInModal?.(contentEl, data, name);
        if (rendered) return;
        const safeSrc = opts.sanitizeUrlForDom?.(data, {
          allowHttp: true,
          allowBlob: true,
          allowData: true,
          allowDataMimePrefixes: ['application/pdf']
        }) || '';
        if (!safeSrc) {
          const p = document.createElement('p');
          p.className = 'text-sm text-slate-500';
          p.textContent = 'Previsualisation PDF indisponible pour ce document.';
          contentEl.appendChild(p);
          return;
        }
        const frame = document.createElement('iframe');
        frame.src = safeSrc;
        frame.className = 'w-full h-[70vh] rounded-lg border border-slate-200';
        frame.title = name || 'PDF';
        contentEl.appendChild(frame);
        return;
      }

      if (type.startsWith('text/')) {
        const safeSrc = opts.sanitizeUrlForDom?.(data, {
          allowHttp: false,
          allowBlob: true,
          allowData: true,
          allowDataMimePrefixes: ['text/']
        }) || '';
        if (!safeSrc) {
          const p = document.createElement('p');
          p.className = 'text-sm text-slate-500';
          p.textContent = 'Previsualisation bloquee (source non sure).';
          contentEl.appendChild(p);
          return;
        }
        const frame = document.createElement('iframe');
        frame.src = safeSrc;
        frame.className = 'w-full h-[70vh] rounded-lg border border-slate-200 bg-white';
        frame.title = name || 'Texte';
        contentEl.appendChild(frame);
        return;
      }

      const p = document.createElement('p');
      p.className = 'text-sm text-slate-500';
      p.textContent = 'Previsualisation non disponible. Utilisez Telecharger.';
      contentEl.appendChild(p);
    }

    async function closePreviewModal() {
      const modal = document.getElementById('modal-doc-preview');
      if (!modal || modal.classList.contains('hidden')) return;
      const content = document.getElementById('doc-preview-content');
      if (content) content.innerHTML = '';
      const previousContext = opts.getCurrentContext?.() || null;
      opts.setCurrentContext?.(null);
      opts.setCanEdit?.(false);
      opts.resetInlineEditingState?.();
      modal.classList.add('hidden');
      await opts.onAfterClose?.(previousContext);
    }

    return {
      parseDocumentPreviewRef,
      getDocumentPreviewSourceLabel,
      formatDocumentStoragePathForDisplay,
      applyPreviewMetadata,
      renderPreviewContent,
      closePreviewModal
    };
  }

  global.TaskMDADocPreviewModalUI = { createModule };
})(window);

