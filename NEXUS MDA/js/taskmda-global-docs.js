(function initTaskMdaGlobalDocsModule(global) {
  'use strict';

  function createModule(options) {
    const opts = options || {};
    const state = opts.state || {};
    const actions = opts.actions || {};
    const helpers = opts.helpers || {};
    let bound = false;

    function resetDocumentBindingInlineEditingState() {
      const debounceTimers = state.getDocBindingInlineDebounceTimers?.();
      const finalizeTimers = state.getDocBindingInlineFinalizeTimers?.();
      if (debounceTimers instanceof Map) {
        for (const timer of debounceTimers.values()) clearTimeout(timer);
        debounceTimers.clear();
      }
      if (finalizeTimers instanceof Map) {
        for (const timer of finalizeTimers.values()) clearTimeout(timer);
        finalizeTimers.clear();
      }
      state.setDocBindingInlineSaving?.(false);
    }

    function setDocumentBindingFieldReadMode(fieldKey, enabled = true) {
      const wrap = document.getElementById(`doc-binding-field-${fieldKey}`);
      const selectId = fieldKey === 'mode'
        ? 'doc-binding-mode'
        : fieldKey === 'project'
          ? 'doc-binding-project'
          : 'doc-binding-task';
      const select = document.getElementById(selectId);
      if (!wrap || !select) return;
      const canEnableTask = fieldKey !== 'task' || !!String(document.getElementById('doc-binding-project')?.value || '').trim();
      const canEdit = !!state.getCurrentDocBindingCanEdit?.();
      const shouldReadMode = enabled || !canEdit || !canEnableTask;
      select.disabled = shouldReadMode;
      wrap.classList.toggle('task-detail-inline-editable', canEdit && shouldReadMode && canEnableTask);
      wrap.classList.toggle('is-inline-editing', !shouldReadMode);
      if (canEdit && shouldReadMode && canEnableTask) {
        wrap.setAttribute('title', 'Cliquer pour modifier');
        wrap.setAttribute('tabindex', '0');
        wrap.setAttribute('role', 'button');
      } else {
        wrap.removeAttribute('title');
        wrap.removeAttribute('tabindex');
        wrap.removeAttribute('role');
      }
    }

    function setDocumentBindingReadModeAll(enabled = true) {
      setDocumentBindingFieldReadMode('mode', enabled);
      setDocumentBindingFieldReadMode('project', enabled);
      setDocumentBindingFieldReadMode('task', enabled);
    }

    async function scheduleDocumentBindingInlineSave(options = {}) {
      const ctx = state.getCurrentDocBindingContext?.();
      if (!ctx?.doc) return;
      if (state.getDocBindingInlineSaving?.()) return;
      const debounceTimers = state.getDocBindingInlineDebounceTimers?.();
      const finalizeTimers = state.getDocBindingInlineFinalizeTimers?.();
      if (!(debounceTimers instanceof Map) || !(finalizeTimers instanceof Map)) return;
      const key = 'binding';
      if (debounceTimers.has(key)) clearTimeout(debounceTimers.get(key));
      debounceTimers.set(key, setTimeout(() => {
        actions.setInlineSaveIndicator?.('doc-binding', 'saving');
        const run = typeof actions.runWithoutGlobalLoading === 'function'
          ? actions.runWithoutGlobalLoading
          : async (fn) => await fn();
        run(() => saveDocumentBindingChanges({ keepOpen: true, silent: true, inlineAutosave: true }))
          .then(() => actions.setInlineSaveIndicator?.('doc-binding', 'saved'))
          .catch((error) => {
            actions.setInlineSaveIndicator?.('doc-binding', 'error');
            console.error('document binding inline save failed', error);
          });
      }, options.immediate ? 0 : 220));
      if (finalizeTimers.has(key)) clearTimeout(finalizeTimers.get(key));
      finalizeTimers.set(key, setTimeout(() => {
        actions.setInlineSaveIndicator?.('doc-binding', 'saving');
        const run = typeof actions.runWithoutGlobalLoading === 'function'
          ? actions.runWithoutGlobalLoading
          : async (fn) => await fn();
        run(() => saveDocumentBindingChanges({ keepOpen: true, silent: true, inlineAutosave: true }))
          .then(() => actions.setInlineSaveIndicator?.('doc-binding', 'saved'))
          .catch((error) => {
            actions.setInlineSaveIndicator?.('doc-binding', 'error');
            console.error('document binding inline finalize save failed', error);
          });
      }, 900));
    }

    function closeDocumentBindingModal() {
      state.setCurrentDocBindingContext?.(null);
      state.setCurrentDocBindingCanEdit?.(false);
      resetDocumentBindingInlineEditingState();
      const storagePathInput = document.getElementById('doc-binding-storage-path');
      if (storagePathInput) {
        storagePathInput.value = '-';
        storagePathInput.removeAttribute('title');
      }
      document.getElementById('modal-doc-binding')?.classList.add('hidden');
    }

    async function openDocumentBindingModal(docId) {
      const id = String(docId || '').trim();
      if (!id) return;
      resetDocumentBindingInlineEditingState();

      const run = typeof actions.runWithLoading === 'function'
        ? actions.runWithLoading
        : async (fn) => await fn();

      await run(async () => {
        const doc = await actions.resolveDocumentForBinding?.(id);
        if (!doc) {
          helpers.showToast?.('Document introuvable');
          return;
        }
        if (doc.sourceType === 'project') {
          helpers.showToast?.('Ce document est une pièce jointe de tâche: modifiez la tâche pour le déplacer.');
          return;
        }
        if (!['standalone', 'project-doc'].includes(doc.sourceType)) {
          helpers.showToast?.('Gestion indisponible pour ce type de document.');
          return;
        }
        if (doc.sourceType === 'project-doc') {
          const sourceState = await actions.getProjectState?.(doc.sourceProjectId);
          if (!sourceState?.project || !actions.canEditProjectMeta?.(sourceState)) {
            helpers.showToast?.('Action non autorisée');
            return;
          }
        }

        const projectSelect = document.getElementById('doc-binding-project');
        const modeSelect = document.getElementById('doc-binding-mode');
        const themeInput = document.getElementById('doc-binding-theme');
        const storagePathInput = document.getElementById('doc-binding-storage-path');
        const nameEl = document.getElementById('doc-binding-name');
        const sourceEl = document.getElementById('doc-binding-current-source');
        const modal = document.getElementById('modal-doc-binding');
        if (!projectSelect || !modeSelect || !themeInput || !storagePathInput || !nameEl || !sourceEl || !modal) return;

        const states = await actions.getAllProjectStates?.();
        const editableProjects = (states || []).filter((row) => row?.project && actions.canEditProjectMeta?.(row));
        const sourceProjectId = String(doc.sourceProjectId || '').trim();
        const themeCatalog = [
          ...((states || []).flatMap((row) => (row?.themes || []))),
          ...((states || []).flatMap((row) => (row?.tasks || []).map((task) => String(task?.theme || '').trim()))),
          ...((helpers.getGlobalThemeCatalog?.() || []).map((theme) => String(theme?.name || '').trim()))
        ];

        const esc = helpers.escapeHtml || ((value) => String(value || ''));
        const normalizeSharingMode = helpers.normalizeSharingMode || ((value) => String(value || 'private'));
        projectSelect.innerHTML = [
          '<option value="">Hors projet</option>',
          ...editableProjects.map((row) => `<option value="${esc(row.project.projectId)}" ${String(row.project.projectId) === sourceProjectId ? 'selected' : ''}>${esc(row.project.name || 'Projet')}</option>`)
        ].join('');
        modeSelect.value = normalizeSharingMode(doc.sharingMode, 'private');
        themeInput.value = String(doc.theme || '').trim();
        helpers.fillThemePicker?.('doc-binding-theme-known', 'doc-binding-theme', themeCatalog, 'Thématiques existantes...');
        nameEl.textContent = doc.name || 'Document';
        sourceEl.textContent = `Source: ${doc.sourceProjectName || 'Hors projet'}`;
        storagePathInput.value = helpers.formatDocumentStoragePathForDisplay?.(doc) || '-';
        storagePathInput.setAttribute('title', storagePathInput.value);

        state.setCurrentDocBindingContext?.({ doc });
        await actions.populateDocBindingTaskOptions?.(sourceProjectId, Array.isArray(doc.linkedTaskIds) ? doc.linkedTaskIds : []);
        actions.initDocumentBindingInlineEditing?.(true);
        setDocumentBindingReadModeAll(false);
        modal.classList.remove('hidden');
      });
    }

    async function saveDocumentBindingChanges(options = {}) {
      const ctx = state.getCurrentDocBindingContext?.();
      if (!ctx?.doc) return;
      if (state.getDocBindingInlineSaving?.()) return;
      const doc = ctx.doc;
      const docData = await actions.resolveDocumentDataForRuntime?.(doc);
      const projectSelect = document.getElementById('doc-binding-project');
      const taskSelect = document.getElementById('doc-binding-task');
      const modeSelect = document.getElementById('doc-binding-mode');
      const themeInput = document.getElementById('doc-binding-theme');
      if (!projectSelect || !taskSelect || !modeSelect || !themeInput) return;

      const targetProjectId = String(projectSelect.value || '').trim();
      const selectedTaskIds = Array.from(taskSelect?.selectedOptions || [])
        .map((opt) => String(opt.value || '').trim())
        .filter(Boolean);
      const nextSharingMode = (helpers.normalizeSharingMode?.(modeSelect.value, 'private')) || 'private';
      const nextTheme = String(themeInput.value || '').trim() || 'General';
      let changed = false;
      let nextBindingId = '';
      const silent = options?.silent === true;
      const keepOpen = options?.keepOpen === true;
      const inlineAutosave = options?.inlineAutosave === true;
      state.setDocBindingInlineSaving?.(true);

      const persistChanges = async () => {
        if (doc.sourceType === 'standalone') {
          if (!targetProjectId) {
            const current = await actions.getDecrypted?.('globalDocs', doc.id, 'id');
            if (!current) {
              if (!silent) helpers.showToast?.('Document introuvable');
              return;
            }
            const relocated = await actions.maybeRelocateStoredDocumentByTheme?.(current, nextTheme, {
              scope: 'global',
              projectId: 'global',
              rubric: actions.inferStorageRubricFromPath?.(current?.storagePath || '', 'global-doc-upload')
            });
            await actions.putEncrypted?.('globalDocs', {
              ...current,
              ...relocated,
              sharingMode: nextSharingMode,
              theme: nextTheme,
              updatedAt: Date.now()
            }, 'id');
            if (!silent) helpers.showToast?.('Document mis à jour');
            changed = true;
            nextBindingId = String(doc.id || '');
            return;
          }

          const targetState = await actions.getProjectState?.(targetProjectId);
          if (!targetState?.project || !actions.canEditProjectMeta?.(targetState)) {
            if (!silent) helpers.showToast?.('Action non autorisée sur le projet cible');
            return;
          }
          const relocationForTarget = await actions.maybeRelocateStoredDocumentByTheme?.(doc, nextTheme, {
            scope: 'project',
            projectId: targetProjectId,
            rubric: actions.inferStorageRubricFromPath?.(doc?.storagePath || '', 'project-doc-upload'),
            force: true
          });
          const newDocId = helpers.uuidv4?.() || String(Date.now());
          const createEventDoc = actions.createEvent?.(
            helpers.EventTypes?.CREATE_DOCUMENT,
            targetProjectId,
            helpers.getCurrentUserId?.(),
            {
              docId: newDocId,
              name: doc.name,
              type: doc.type,
              size: doc.size,
              data: relocationForTarget?.data || docData || doc.data || '',
              storageMode: relocationForTarget?.storageMode || doc.storageMode || '',
              storageProvider: relocationForTarget?.storageProvider || doc.storageProvider || '',
              storagePath: relocationForTarget?.storagePath || doc.storagePath || '',
              storedAt: Number(relocationForTarget?.storedAt || doc.storedAt || 0) || null,
              theme: nextTheme,
              notes: doc.notes || '',
              sharingMode: nextSharingMode,
              linkedTaskIds: targetProjectId ? selectedTaskIds : [],
              linkedNoteIds: Array.isArray(doc.linkedNoteIds) ? [...doc.linkedNoteIds] : []
            }
          );
          await actions.publishEvent?.(createEventDoc);
          if (helpers.getSharedFolderHandle?.()) {
            void actions.syncProjectEventsToSharedSpace?.(targetProjectId, [createEventDoc]);
          }
          await actions.deleteFromStore?.('globalDocs', doc.id);
          if (!silent) helpers.showToast?.('Document rattaché au projet');
          changed = true;
          nextBindingId = `${targetProjectId}:project-doc:${newDocId}`;
          return;
        }

        if (doc.sourceType === 'project-doc') {
          const sourceState = await actions.getProjectState?.(doc.sourceProjectId);
          if (!sourceState?.project || !actions.canEditProjectMeta?.(sourceState)) {
            if (!silent) helpers.showToast?.('Action non autorisée');
            return;
          }
          const relocationForTarget = await actions.maybeRelocateStoredDocumentByTheme?.(doc, nextTheme, {
            scope: targetProjectId ? 'project' : 'global',
            projectId: targetProjectId || 'global',
            rubric: actions.inferStorageRubricFromPath?.(doc?.storagePath || '', targetProjectId ? 'project-doc-upload' : 'global-doc-upload'),
            force: String(targetProjectId || '').trim() !== String(doc.sourceProjectId || '').trim()
          });

          if (!targetProjectId) {
            const newGlobalId = helpers.uuidv4?.() || String(Date.now());
            await actions.putEncrypted?.('globalDocs', {
              id: newGlobalId,
              name: doc.name,
              type: doc.type,
              size: doc.size,
              data: relocationForTarget?.data || docData || doc.data || '',
              storageMode: relocationForTarget?.storageMode || doc.storageMode || '',
              storageProvider: relocationForTarget?.storageProvider || doc.storageProvider || '',
              storagePath: relocationForTarget?.storagePath || doc.storagePath || '',
              storedAt: Number(relocationForTarget?.storedAt || doc.storedAt || 0) || null,
              theme: nextTheme,
              notes: doc.notes || '',
              sharingMode: nextSharingMode,
              linkedNoteIds: Array.isArray(doc.linkedNoteIds) ? [...doc.linkedNoteIds] : [],
              createdAt: Date.now(),
              updatedAt: Date.now()
            }, 'id');
            nextBindingId = newGlobalId;
          } else {
            const targetState = await actions.getProjectState?.(targetProjectId);
            if (!targetState?.project || !actions.canEditProjectMeta?.(targetState)) {
              if (!silent) helpers.showToast?.('Action non autorisée sur le projet cible');
              return;
            }
            const newDocId = helpers.uuidv4?.() || String(Date.now());
            const createEventDoc = actions.createEvent?.(
              helpers.EventTypes?.CREATE_DOCUMENT,
              targetProjectId,
              helpers.getCurrentUserId?.(),
              {
                docId: newDocId,
                name: doc.name,
                type: doc.type,
                size: doc.size,
                data: relocationForTarget?.data || docData || doc.data || '',
                storageMode: relocationForTarget?.storageMode || doc.storageMode || '',
                storageProvider: relocationForTarget?.storageProvider || doc.storageProvider || '',
                storagePath: relocationForTarget?.storagePath || doc.storagePath || '',
                storedAt: Number(relocationForTarget?.storedAt || doc.storedAt || 0) || null,
                theme: nextTheme,
                notes: doc.notes || '',
                sharingMode: nextSharingMode,
                linkedTaskIds: targetProjectId ? selectedTaskIds : [],
                linkedNoteIds: Array.isArray(doc.linkedNoteIds) ? [...doc.linkedNoteIds] : []
              }
            );
            await actions.publishEvent?.(createEventDoc);
            if (helpers.getSharedFolderHandle?.()) {
              void actions.syncProjectEventsToSharedSpace?.(targetProjectId, [createEventDoc]);
            }
            nextBindingId = `${targetProjectId}:project-doc:${newDocId}`;
          }

          const deleteEventDoc = actions.createEvent?.(
            helpers.EventTypes?.DELETE_DOCUMENT,
            doc.sourceProjectId,
            helpers.getCurrentUserId?.(),
            { docId: doc.docId }
          );
          await actions.publishEvent?.(deleteEventDoc);
          if (helpers.getSharedFolderHandle?.()) {
            void actions.syncProjectEventsToSharedSpace?.(doc.sourceProjectId, [deleteEventDoc]);
          }
          if (!silent) helpers.showToast?.(targetProjectId ? 'Document déplacé / mis à jour' : 'Document détaché hors projet');
          changed = true;
        }
      };

      try {
        if (inlineAutosave) {
          await persistChanges();
        } else {
          const run = typeof actions.runWithLoading === 'function' ? actions.runWithLoading : async (fn) => await fn();
          await run(persistChanges);
        }
      } finally {
        state.setDocBindingInlineSaving?.(false);
      }

      if (!changed) return;

      if (keepOpen && nextBindingId) {
        const currentBindingId = String(doc.id || '').trim();
        if (String(nextBindingId) !== currentBindingId) {
          await openDocumentBindingModal(nextBindingId);
        } else {
          const refreshed = await actions.resolveDocumentForBinding?.(nextBindingId);
          if (refreshed) {
            state.setCurrentDocBindingContext?.({ doc: refreshed });
            const sourceProjectId = String(refreshed.sourceProjectId || '').trim();
            const selectedTasks = Array.isArray(refreshed.linkedTaskIds) ? refreshed.linkedTaskIds : [];
            await actions.populateDocBindingTaskOptions?.(sourceProjectId, selectedTasks);
            const modeSelect = document.getElementById('doc-binding-mode');
            const projectSelect = document.getElementById('doc-binding-project');
            const themeInput = document.getElementById('doc-binding-theme');
            const nameEl = document.getElementById('doc-binding-name');
            const sourceEl = document.getElementById('doc-binding-current-source');
            const storagePathInput = document.getElementById('doc-binding-storage-path');
            if (modeSelect) modeSelect.value = (helpers.normalizeSharingMode?.(refreshed.sharingMode, 'private')) || 'private';
            if (projectSelect) projectSelect.value = sourceProjectId;
            if (themeInput) themeInput.value = String(refreshed.theme || '').trim();
            if (nameEl) nameEl.textContent = refreshed.name || 'Document';
            if (sourceEl) sourceEl.textContent = `Source: ${refreshed.sourceProjectName || 'Hors projet'}`;
            if (storagePathInput) {
              storagePathInput.value = helpers.formatDocumentStoragePathForDisplay?.(refreshed) || '-';
              storagePathInput.setAttribute('title', storagePathInput.value);
            }
            setDocumentBindingReadModeAll(false);
          }
        }
      } else {
        closeDocumentBindingModal();
      }

      await actions.renderGlobalDocs?.();
    }

    function bindDom() {
      if (bound) return;
      bound = true;
      document.getElementById('btn-close-doc-binding')?.addEventListener('click', () => {
        closeDocumentBindingModal();
      });
      document.getElementById('btn-save-doc-binding')?.addEventListener('click', () => {
        saveDocumentBindingChanges();
      });
      document.getElementById('btn-doc-binding-copy-storage-path')?.addEventListener('click', async () => {
        await actions.copyDocumentBindingStoragePath?.();
      });
      document.getElementById('doc-binding-project')?.addEventListener('change', async (event) => {
        const target = event?.target;
        const projectId = target && typeof target.value !== 'undefined'
          ? target.value
          : '';
        await actions.populateDocBindingTaskOptions?.(projectId, []);
        setDocumentBindingFieldReadMode('task', true);
        await scheduleDocumentBindingInlineSave();
        setDocumentBindingFieldReadMode('project', true);
      });
      document.getElementById('doc-binding-project')?.addEventListener('blur', () => {
        setDocumentBindingFieldReadMode('project', true);
        setDocumentBindingFieldReadMode('task', true);
      });
      document.getElementById('doc-binding-mode')?.addEventListener('change', async () => {
        await scheduleDocumentBindingInlineSave();
        setDocumentBindingFieldReadMode('mode', true);
      });
      document.getElementById('doc-binding-mode')?.addEventListener('blur', () => {
        setDocumentBindingFieldReadMode('mode', true);
      });
      document.getElementById('doc-binding-task')?.addEventListener('change', async () => {
        await scheduleDocumentBindingInlineSave();
      });
      document.getElementById('doc-binding-task')?.addEventListener('blur', () => {
        setDocumentBindingFieldReadMode('task', true);
      });
      document.getElementById('doc-binding-theme')?.addEventListener('input', () => {
        actions.syncThemePickerSelectionFromInput?.('doc-binding-theme-known', 'doc-binding-theme');
      });
      document.getElementById('doc-binding-theme-known')?.addEventListener('change', () => {
        actions.syncThemePickerInputFromSelection?.('doc-binding-theme-known', 'doc-binding-theme');
      });
    }

    return {
      bindDom,
      renderGlobalDocs: (...args) => actions.renderGlobalDocs?.(...args),
      addStandaloneDocuments: (...args) => actions.addStandaloneDocuments?.(...args),
      deleteGlobalDocument: (...args) => actions.deleteGlobalDocument?.(...args),
      openDocumentBindingModal,
      resetDocumentBindingInlineEditingState,
      setDocumentBindingFieldReadMode,
      setDocumentBindingReadModeAll,
      closeDocumentBindingModal,
      saveDocumentBindingChanges,
      scheduleDocumentBindingInlineSave,
      openDocumentPreviewByRef: (...args) => actions.openDocumentPreviewByRef?.(...args),
      downloadDocumentByRef: (...args) => actions.downloadDocumentByRef?.(...args)
    };
  }

  global.TaskMDAGlobalDocs = {
    createModule
  };
}(window));
