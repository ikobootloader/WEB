/* TaskMDA Global Domain Bundle (manual, no-build) */
/* Consolidates taskmda-global-* modules */

/* --- taskmda-global-notes-filters-ui.js --- */
(function initTaskMdaGlobalNotesFiltersUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaGlobalNotesFiltersUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;
    const normalizeCatalogKey = typeof opts.normalizeCatalogKey === 'function'
      ? opts.normalizeCatalogKey
      : (value) => String(value || '').trim().toLowerCase();
    const escapeHtml = typeof opts.escapeHtml === 'function'
      ? opts.escapeHtml
      : (value) => String(value || '');

    async function resolveDocumentForBinding(docId) {
      const id = String(docId || '').trim();
      if (!id) return null;
      const all = await actions.getGlobalDocumentsList?.();
      const fromGlobal = (all || []).find((item) => String(item.id || '') === id);
      if (fromGlobal) return fromGlobal;

      const marker = ':project-doc:';
      const markerIndex = id.indexOf(marker);
      if (markerIndex <= 0) return null;
      const sourceProjectId = id.slice(0, markerIndex);
      const sourceDocId = id.slice(markerIndex + marker.length);
      if (!sourceProjectId || !sourceDocId) return null;

      const sourceState = await actions.getProjectState?.(sourceProjectId);
      if (!sourceState?.project) return null;
      const sourceDoc = (sourceState.documents || []).find((item) => String(item.docId || '') === sourceDocId);
      if (!sourceDoc) return null;

      return {
        id,
        name: sourceDoc.name,
        type: sourceDoc.type,
        size: sourceDoc.size,
        data: sourceDoc.data,
        theme: sourceDoc.theme || sourceState.project.name || 'Projet',
        sourceProjectName: sourceState.project.name,
        sourceProjectId,
        docId: sourceDoc.docId,
        linkedTaskIds: Array.isArray(sourceDoc.linkedTaskIds) ? [...sourceDoc.linkedTaskIds] : [],
        sourceType: 'project-doc',
        sharingMode: helpers.normalizeSharingMode?.(
          sourceDoc.sharingMode,
          helpers.normalizeSharingMode?.(sourceState.project.sharingMode, 'shared') || 'shared'
        ) || 'shared',
        notes: sourceDoc.notes || '',
        createdAt: sourceDoc.uploadedAt || sourceDoc.createdAt || sourceState.project.createdAt || 0
      };
    }

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('global-notes-theme-tabs')?.addEventListener('click', (event) => {
        const btn = event?.target?.closest?.('[data-global-note-theme-tab]');
        if (!btn) return;
        const key = String(btn.getAttribute('data-global-note-theme-tab') || 'all').trim() || 'all';
        opts.setGlobalNotesThemeFilter?.(key);
        opts.setGlobalNotesPage?.(1);
        opts.renderGlobalNotes?.().catch(() => null);
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAGlobalNotesFiltersUI = {
    createModule
  };
}(window));

/* --- taskmda-global-read-actions-ui.js --- */
(function initTaskMdaGlobalReadActionsUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaGlobalReadActionsUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('btn-close-global-read-modal')?.addEventListener('click', () => {
        opts.closeGlobalReadModal?.();
      });

      document.getElementById('btn-global-read-edit')?.addEventListener('click', () => {
        const noteId = String(document.getElementById('btn-global-read-edit')?.getAttribute('data-note-id') || '').trim();
        if (!noteId) return;
        opts.closeGlobalReadModal?.();
        opts.openGlobalNoteEditor?.(noteId)?.catch?.(() => null);
      });

      document.getElementById('btn-global-read-delete')?.addEventListener('click', async () => {
        const noteId = String(document.getElementById('btn-global-read-delete')?.getAttribute('data-note-id') || '').trim();
        if (!noteId) return;
        await opts.deleteGlobalNote?.(noteId);
        opts.closeGlobalReadModal?.();
      });

      document.getElementById('btn-global-read-export-menu')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const menu = document.getElementById('global-read-export-dropdown');
        const btn = document.getElementById('btn-global-read-export-menu');
        if (!menu || !btn) return;
        const willOpen = menu.classList.contains('hidden');
        menu.classList.toggle('hidden', !willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });

      document.getElementById('btn-global-read-export-html')?.addEventListener('click', async () => {
        const noteId = String(document.getElementById('btn-global-read-export-html')?.getAttribute('data-note-id') || '').trim();
        if (!noteId) return;
        await opts.exportGlobalNote?.(noteId, 'html');
      });

      document.getElementById('btn-global-read-export-pdf')?.addEventListener('click', async () => {
        const noteId = String(document.getElementById('btn-global-read-export-pdf')?.getAttribute('data-note-id') || '').trim();
        if (!noteId) return;
        await opts.exportGlobalNoteAsPdf?.(noteId);
      });

      document.getElementById('btn-global-read-export-docx')?.addEventListener('click', async () => {
        const noteId = String(document.getElementById('btn-global-read-export-docx')?.getAttribute('data-note-id') || '').trim();
        if (!noteId) return;
        await opts.exportGlobalNoteAsDocx?.(noteId);
      });

      document.getElementById('btn-global-read-export-txt')?.addEventListener('click', async () => {
        const noteId = String(document.getElementById('btn-global-read-export-txt')?.getAttribute('data-note-id') || '').trim();
        if (!noteId) return;
        await opts.exportGlobalNote?.(noteId, 'txt');
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAGlobalReadActionsUI = {
    createModule
  };
}(window));

/* --- taskmda-global-read-inline-ui.js --- */
(function initTaskMdaGlobalReadInlineUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaGlobalReadInlineUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      const globalReadModal = document.getElementById('modal-global-read');
      if (globalReadModal && globalReadModal.dataset.inlineShortcutsBound !== '1') {
        globalReadModal.dataset.inlineShortcutsBound = '1';
        globalReadModal.addEventListener('keydown', async (event) => {
          if (globalReadModal.classList.contains('hidden')) return;
          const key = String(event.key || '').toLowerCase();
          if ((event.ctrlKey || event.metaKey) && key === 's') {
            event.preventDefault();
            await opts.saveGlobalReadInlineEdit?.();
            return;
          }
          if (opts.isGlobalReadInlineEditActive?.() && key === 'enter' && event.target?.id === 'global-read-title') {
            event.preventDefault();
            await opts.saveGlobalReadInlineEdit?.();
            return;
          }
          if (key === 'escape') {
            event.preventDefault();
            event.stopPropagation();
            if (opts.isGlobalReadInlineEditActive?.()) {
              opts.cancelGlobalReadInlineEdit?.();
              return;
            }
            opts.closeGlobalReadModal?.();
          }
        });
      }

      document.getElementById('global-read-title')?.addEventListener('click', () => {
        opts.beginGlobalReadInlineEdit?.('title');
      });
      document.getElementById('global-read-content')?.addEventListener('click', () => {
        opts.beginGlobalReadInlineEdit?.('content');
      });
      document.getElementById('global-read-title')?.addEventListener('blur', async () => {
        if (!opts.isGlobalReadInlineEditActive?.()) return;
        setTimeout(async () => {
          const active = document.activeElement;
          if (opts.isElementInsideGlobalReadInlineEdit?.(active)) return;
          await opts.saveGlobalReadInlineEdit?.({ silent: true });
        }, 0);
      });
      document.addEventListener('focusout', (event) => {
        if (!opts.isGlobalReadInlineEditActive?.()) return;
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.closest('#global-read-inline-editor-wrap')) return;
        setTimeout(async () => {
          const active = document.activeElement;
          if (opts.isElementInsideGlobalReadInlineEdit?.(active)) return;
          await opts.saveGlobalReadInlineEdit?.({ silent: true });
        }, 0);
      }, true);
    }

    return {
      bindDom
    };
  }

  global.TaskMDAGlobalReadInlineUI = {
    createModule
  };
}(window));

/* --- taskmda-global-notes.js --- */
(function initTaskMdaGlobalNotesModule(global) {
  // Module role: UI/domain boundary for TaskMdaGlobalNotesModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    const state = opts.state || {};
    const actions = opts.actions || {};
    const helpers = opts.helpers || {};
    let bound = false;

    async function setGlobalNotesPage(page) {
      state.setPage?.(Math.max(1, Number(page) || 1));
      await actions.renderGlobalNotes?.();
    }

    function openGlobalNotesBulkExportModal() {
      const selectedCount = Number(state.getSelectedCount?.() || 0);
      const bulkEnabled = !!state.getBulkSelectionMode?.();
      if (!bulkEnabled || selectedCount <= 0) {
        helpers.showToast?.('Aucune note sÃ©lectionnÃ©e');
        return;
      }
      const modal = document.getElementById('modal-global-notes-export');
      if (!modal) return;
      const htmlRadio = document.getElementById('global-notes-export-format-html');
      const txtRadio = document.getElementById('global-notes-export-format-txt');
      if (htmlRadio) htmlRadio.checked = true;
      if (txtRadio) txtRadio.checked = false;
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }

    function closeGlobalNotesBulkExportModal() {
      const modal = document.getElementById('modal-global-notes-export');
      if (!modal) return;
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }

    async function confirmGlobalNotesBulkExportFromModal() {
      const checked = document.querySelector('input[name="global-notes-export-format"]:checked');
      const format = String(checked?.value || 'html').trim().toLowerCase() === 'txt' ? 'txt' : 'html';
      closeGlobalNotesBulkExportModal();
      await actions.exportSelectedGlobalNotesAsZip?.(format);
    }

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('global-notes-search')?.addEventListener('input', async () => {
        state.setSearchQuery?.(String(document.getElementById('global-notes-search')?.value || '').trim());
        state.setPage?.(1);
        await actions.renderGlobalNotes?.();
      });

      document.getElementById('global-notes-scope-filter')?.addEventListener('change', async () => {
        state.setScopeFilter?.(String(document.getElementById('global-notes-scope-filter')?.value || 'all').trim() || 'all');
        state.setPage?.(1);
        await actions.renderGlobalNotes?.();
      });

      document.getElementById('global-notes-sort')?.addEventListener('change', async () => {
        state.setSortMode?.(String(document.getElementById('global-notes-sort')?.value || 'recent').trim() || 'recent');
        state.setPage?.(1);
        await actions.renderGlobalNotes?.();
      });

      const globalNotesTabs = [
        ['global-notes-tab-all', 'all'],
        ['global-notes-tab-mine', 'mine'],
        ['global-notes-tab-favorites', 'favorites'],
        ['global-notes-tab-private', 'private'],
        ['global-notes-tab-transverse', 'transverse'],
        ['global-notes-tab-published', 'published']
      ];
      globalNotesTabs.forEach(([id, mode]) => {
        document.getElementById(id)?.addEventListener('click', async () => {
          state.setTabMode?.(mode);
          state.setPage?.(1);
          await actions.renderGlobalNotes?.();
        });
      });

      document.getElementById('btn-global-notes-bulk-toggle')?.addEventListener('click', async () => {
        const nextEnabled = !state.getBulkSelectionMode?.();
        actions.setGlobalNotesBulkSelectionMode?.(nextEnabled, { clearSelection: !nextEnabled });
        if (!nextEnabled) actions.clearSelectedGlobalNotesBulk?.();
        await actions.renderGlobalNotes?.();
      });

      document.getElementById('btn-global-notes-bulk-select-all')?.addEventListener('click', () => {
        actions.selectAllVisibleGlobalNotesForBulkDelete?.();
      });
      document.getElementById('btn-global-notes-bulk-delete')?.addEventListener('click', async () => {
        await actions.deleteSelectedGlobalNotes?.();
      });
      document.getElementById('btn-global-notes-bulk-export')?.addEventListener('click', () => {
        openGlobalNotesBulkExportModal();
      });
      document.getElementById('btn-close-global-notes-export-modal')?.addEventListener('click', () => {
        closeGlobalNotesBulkExportModal();
      });
      document.getElementById('btn-cancel-global-notes-export')?.addEventListener('click', () => {
        closeGlobalNotesBulkExportModal();
      });
      document.getElementById('btn-confirm-global-notes-export')?.addEventListener('click', async () => {
        await confirmGlobalNotesBulkExportFromModal();
      });

      document.getElementById('btn-global-note-new')?.addEventListener('click', async () => {
        await actions.openGlobalNoteEditor?.('');
      });
      document.getElementById('btn-global-note-save')?.addEventListener('click', async () => {
        await actions.saveGlobalNoteFromEditor?.();
      });
      document.getElementById('btn-global-note-delete')?.addEventListener('click', async () => {
        await actions.deleteGlobalNote?.();
      });
      document.getElementById('btn-global-note-cancel')?.addEventListener('click', () => {
        actions.closeGlobalNoteEditor?.();
      });
      document.getElementById('btn-close-global-note-modal')?.addEventListener('click', () => {
        actions.closeGlobalNoteEditor?.();
      });
      document.getElementById('btn-global-note-digest')?.addEventListener('click', async () => {
        const chosenMode = actions.pickGlobalFeedDigestImportMode?.();
        if (chosenMode !== 'compact' && chosenMode !== 'full') return;
        await actions.requestDigestImportForEditor?.('global-note-content-editor', 'global-note-content', { digestView: chosenMode });
      });
      document.getElementById('btn-global-note-attach-doc')?.addEventListener('click', () => {
        document.getElementById('global-note-attach-doc-files')?.click();
      });

      const globalNoteModal = document.getElementById('modal-global-note');
      if (globalNoteModal && globalNoteModal.dataset.globalNoteShortcutsBound !== '1') {
        globalNoteModal.dataset.globalNoteShortcutsBound = '1';
        globalNoteModal.addEventListener('keydown', (event) => {
          if (globalNoteModal.classList.contains('hidden')) return;
          const key = String(event.key || '').toLowerCase();
          if ((event.ctrlKey || event.metaKey) && key === 's') {
            event.preventDefault();
            void actions.saveGlobalNoteFromEditor?.();
            return;
          }
          if (key === 'escape') {
            event.preventDefault();
            event.stopPropagation();
            actions.closeGlobalNoteEditor?.();
          }
        });
      }
    }

    return {
      bindDom,
      renderGlobalNotes: (...args) => actions.renderGlobalNotes?.(...args),
      openGlobalNoteEditor: (...args) => actions.openGlobalNoteEditor?.(...args),
      saveGlobalNoteFromEditor: (...args) => actions.saveGlobalNoteFromEditor?.(...args),
      deleteGlobalNote: (...args) => actions.deleteGlobalNote?.(...args),
      toggleGlobalNoteFeedPublish: (...args) => actions.toggleGlobalNoteFeedPublish?.(...args),
      toggleGlobalNoteFavorite: (...args) => actions.toggleGlobalNoteFavorite?.(...args),
      exportGlobalNote: (...args) => actions.exportGlobalNote?.(...args),
      setGlobalNotesPage,
      openGlobalNotesBulkExportModal,
      closeGlobalNotesBulkExportModal,
      confirmGlobalNotesBulkExportFromModal,
      toggleGlobalNoteBulkSelection: (...args) => actions.toggleGlobalNoteBulkSelection?.(...args)
    };
  }

  global.TaskMDAGlobalNotes = {
    createModule
  };
}(window));

(function initTaskMdaGlobalDocsModule(global) {
  // Module role: UI/domain boundary for TaskMdaGlobalDocsModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
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

    function initDocumentBindingInlineEditing(canEdit = false) {
      state.setCurrentDocBindingCanEdit?.(!!canEdit);
      setDocumentBindingReadModeAll(true);
      const modal = document.getElementById('modal-doc-binding');
      if (!modal || modal.dataset.inlineDocBindingBound === '1') return;
      modal.dataset.inlineDocBindingBound = '1';
      modal.addEventListener('click', (event) => {
        const clickTarget = event.target instanceof Element ? event.target : null;
        if (clickTarget?.closest('button, a[href]')) return;
        const fieldWrap = clickTarget?.closest('[data-inline-doc-binding-field]');
        if (!(fieldWrap instanceof HTMLElement)) return;
        if (!state.getCurrentDocBindingCanEdit?.()) return;
        const fieldKey = String(fieldWrap.getAttribute('data-inline-doc-binding-field') || '').trim();
        if (!fieldKey) return;
        setDocumentBindingFieldReadMode(fieldKey, false);
        const selectId = fieldKey === 'mode'
          ? 'doc-binding-mode'
          : fieldKey === 'project'
            ? 'doc-binding-project'
            : 'doc-binding-task';
        const select = document.getElementById(selectId);
        if (select && !select.disabled) requestAnimationFrame(() => select.focus());
      });
      modal.addEventListener('keydown', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const fieldWrap = target?.closest('[data-inline-doc-binding-field]');
        if (!(fieldWrap instanceof HTMLElement)) return;
        if (!state.getCurrentDocBindingCanEdit?.()) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (helpers.shouldIgnoreInlineActivationKeydown?.(target, fieldWrap)) return;
        event.preventDefault();
        const fieldKey = String(fieldWrap.getAttribute('data-inline-doc-binding-field') || '').trim();
        if (!fieldKey) return;
        setDocumentBindingFieldReadMode(fieldKey, false);
        const selectId = fieldKey === 'mode'
          ? 'doc-binding-mode'
          : fieldKey === 'project'
            ? 'doc-binding-project'
            : 'doc-binding-task';
        const select = document.getElementById(selectId);
        if (select && !select.disabled) requestAnimationFrame(() => select.focus());
      });
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
        const doc = await resolveDocumentForBinding(id);
        if (!doc) {
          helpers.showToast?.('Document introuvable');
          return;
        }
        if (doc.sourceType === 'project') {
          helpers.showToast?.('Ce document est une piÃ¨ce jointe de tÃ¢che: modifiez la tÃ¢che pour le dÃ©placer.');
          return;
        }
        if (!['standalone', 'project-doc'].includes(doc.sourceType)) {
          helpers.showToast?.('Gestion indisponible pour ce type de document.');
          return;
        }
        if (doc.sourceType === 'project-doc') {
          const sourceState = await actions.getProjectState?.(doc.sourceProjectId);
          if (!sourceState?.project || !actions.canEditProjectMeta?.(sourceState)) {
            helpers.showToast?.('Action non autorisÃ©e');
            return;
          }
        }

        const projectSelect = document.getElementById('doc-binding-project');
        const modeSelect = document.getElementById('doc-binding-mode');
        const themeInput = document.getElementById('doc-binding-theme');
        const storagePathInput = document.getElementById('doc-binding-storage-path');
        const nameInput = document.getElementById('doc-binding-name');
        const sourceEl = document.getElementById('doc-binding-current-source');
        const modal = document.getElementById('modal-doc-binding');
        if (!projectSelect || !modeSelect || !themeInput || !storagePathInput || !nameInput || !sourceEl || !modal) return;

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
        helpers.fillThemePicker?.('doc-binding-theme-known', 'doc-binding-theme', themeCatalog, 'ThÃ©matiques existantes...');
        nameInput.value = String(doc.name || 'Document').trim();
        sourceEl.textContent = `Source: ${doc.sourceProjectName || 'Hors projet'}`;
        storagePathInput.value = helpers.formatDocumentStoragePathForDisplay?.(doc) || '-';
        storagePathInput.setAttribute('title', storagePathInput.value);

        state.setCurrentDocBindingContext?.({ doc });
        await actions.populateDocBindingTaskOptions?.(sourceProjectId, Array.isArray(doc.linkedTaskIds) ? doc.linkedTaskIds : []);
        initDocumentBindingInlineEditing(true);
        setDocumentBindingReadModeAll(false);
        modal.classList.remove('hidden');
      });
    }

    async function copyDocumentBindingStoragePath() {
      const input = document.getElementById('doc-binding-storage-path');
      if (!input) return;
      const value = String(input.value || '').trim();
      if (!value || value === '-') {
        helpers.showToast?.('Aucun chemin à copier');
        return;
      }
      const copied = await helpers.copyTextToClipboard?.(value);
      helpers.showToast?.(copied ? 'Chemin copié' : 'Copie impossible');
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
      const nameInput = document.getElementById('doc-binding-name');
      if (!projectSelect || !taskSelect || !modeSelect || !themeInput || !nameInput) return;

      const targetProjectId = String(projectSelect.value || '').trim();
      const selectedTaskIds = Array.from(taskSelect?.selectedOptions || [])
        .map((opt) => String(opt.value || '').trim())
        .filter(Boolean);
      const nextSharingMode = (helpers.normalizeSharingMode?.(modeSelect.value, 'private')) || 'private';
      const nextTheme = String(themeInput.value || '').trim() || 'General';
      const nextName = String(nameInput.value || '').trim() || String(doc.name || 'Document').trim() || 'Document';
      const normalizeNameForCompare = (value) => String(value || '').trim();
      const nameChangedFromDoc = normalizeNameForCompare(nextName) !== normalizeNameForCompare(doc?.name || '');
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
            const nameChangedFromCurrent = normalizeNameForCompare(nextName) !== normalizeNameForCompare(current?.name || '');
            const currentWithNextName = {
              ...(current || {}),
              name: nextName
            };
            const relocated = await actions.maybeRelocateStoredDocumentByTheme?.(currentWithNextName, nextTheme, {
              scope: 'global',
              projectId: 'global',
              rubric: actions.inferStorageRubricFromPath?.(current?.storagePath || '', 'global-doc-upload'),
              force: nameChangedFromCurrent
            });
            await actions.putEncrypted?.('globalDocs', {
              ...current,
              ...relocated,
              name: nextName,
              sharingMode: nextSharingMode,
              theme: nextTheme,
              updatedAt: Date.now()
            }, 'id');
            if (!silent) helpers.showToast?.('Document mis Ã  jour');
            changed = true;
            nextBindingId = String(doc.id || '');
            return;
          }

          const targetState = await actions.getProjectState?.(targetProjectId);
          if (!targetState?.project || !actions.canEditProjectMeta?.(targetState)) {
            if (!silent) helpers.showToast?.('Action non autorisÃ©e sur le projet cible');
            return;
          }
          const relocationForTarget = await actions.maybeRelocateStoredDocumentByTheme?.({
            ...(doc || {}),
            name: nextName
          }, nextTheme, {
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
              name: nextName,
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
          if (!silent) helpers.showToast?.('Document rattachÃ© au projet');
          changed = true;
          nextBindingId = `${targetProjectId}:project-doc:${newDocId}`;
          return;
        }

        if (doc.sourceType === 'project-doc') {
          const sourceState = await actions.getProjectState?.(doc.sourceProjectId);
          if (!sourceState?.project || !actions.canEditProjectMeta?.(sourceState)) {
            if (!silent) helpers.showToast?.('Action non autorisÃ©e');
            return;
          }
          const relocationForTarget = await actions.maybeRelocateStoredDocumentByTheme?.({
            ...(doc || {}),
            name: nextName
          }, nextTheme, {
            scope: targetProjectId ? 'project' : 'global',
            projectId: targetProjectId || 'global',
            rubric: actions.inferStorageRubricFromPath?.(doc?.storagePath || '', targetProjectId ? 'project-doc-upload' : 'global-doc-upload'),
            force: String(targetProjectId || '').trim() !== String(doc.sourceProjectId || '').trim() || nameChangedFromDoc
          });

          if (!targetProjectId) {
            const newGlobalId = helpers.uuidv4?.() || String(Date.now());
            await actions.putEncrypted?.('globalDocs', {
              id: newGlobalId,
              name: nextName,
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
              if (!silent) helpers.showToast?.('Action non autorisÃ©e sur le projet cible');
              return;
            }
            const newDocId = helpers.uuidv4?.() || String(Date.now());
            const createEventDoc = actions.createEvent?.(
              helpers.EventTypes?.CREATE_DOCUMENT,
              targetProjectId,
              helpers.getCurrentUserId?.(),
              {
                docId: newDocId,
                name: nextName,
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
          if (!silent) helpers.showToast?.(targetProjectId ? 'Document dÃ©placÃ© / mis Ã  jour' : 'Document dÃ©tachÃ© hors projet');
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
          const refreshed = await resolveDocumentForBinding(nextBindingId);
          if (refreshed) {
            state.setCurrentDocBindingContext?.({ doc: refreshed });
            const sourceProjectId = String(refreshed.sourceProjectId || '').trim();
            const selectedTasks = Array.isArray(refreshed.linkedTaskIds) ? refreshed.linkedTaskIds : [];
            await actions.populateDocBindingTaskOptions?.(sourceProjectId, selectedTasks);
            const modeSelect = document.getElementById('doc-binding-mode');
            const projectSelect = document.getElementById('doc-binding-project');
            const themeInput = document.getElementById('doc-binding-theme');
            const nameInput = document.getElementById('doc-binding-name');
            const sourceEl = document.getElementById('doc-binding-current-source');
            const storagePathInput = document.getElementById('doc-binding-storage-path');
            if (modeSelect) modeSelect.value = (helpers.normalizeSharingMode?.(refreshed.sharingMode, 'private')) || 'private';
            if (projectSelect) projectSelect.value = sourceProjectId;
            if (themeInput) themeInput.value = String(refreshed.theme || '').trim();
            if (nameInput) nameInput.value = String(refreshed.name || 'Document').trim();
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

    async function deleteGlobalDocument(docId) {
      const id = String(docId || '').trim();
      if (!id) return;
      const docs = await actions.getGlobalDocumentsList?.();
      const doc = (docs || []).find((d) => String(d.id || '') === id);
      if (!doc) {
        helpers.showToast?.('Document introuvable');
        return;
      }

      if (doc.sourceType === 'standalone') {
        if (!confirm('Supprimer ce document hors projet ?')) return;
        await actions.deleteFromStore?.('globalDocs', doc.id);
        helpers.showToast?.('Document supprimé');
        actions.addNotification?.('Documents', 'Document hors projet supprimé', null);
        await actions.renderGlobalDocs?.();
        return;
      }

      if (doc.sourceType === 'project-doc') {
        const stateSnapshot = await actions.getProjectState?.(doc.sourceProjectId);
        if (!stateSnapshot?.project) {
          helpers.showToast?.('Projet source introuvable');
          return;
        }
        if (!actions.canEditProjectMeta?.(stateSnapshot)) {
          helpers.showToast?.('Action non autorisee');
          return;
        }
        if (!confirm('Supprimer ce document du projet ?')) return;
        const event = actions.createEvent?.(
          helpers.EventTypes?.DELETE_DOCUMENT,
          doc.sourceProjectId,
          helpers.getCurrentUserId?.(),
          { docId: doc.docId }
        );
        await actions.publishEvent?.(event);
        if (helpers.getSharedFolderHandle?.()) void actions.syncProjectEventsToSharedSpace?.(doc.sourceProjectId, [event]);
        helpers.showToast?.('Document projet supprimé');
        actions.addNotification?.('Documents', 'Document de projet supprimé', doc.sourceProjectId);
        await actions.renderGlobalDocs?.();
        return;
      }

      const stateSnapshot = await actions.getProjectState?.(doc.sourceProjectId);
      const task = (stateSnapshot?.tasks || []).find((t) => t.taskId === doc.taskId);
      if (!stateSnapshot || !task) {
        helpers.showToast?.('Tâche source introuvable');
        return;
      }
      if (!actions.canChangeTaskStatus?.(task, stateSnapshot)) {
        helpers.showToast?.('Action non autorisee');
        return;
      }
      if (!confirm('Supprimer cette pièce jointe du projet ?')) return;

      const attachments = (task.attachments || []).filter((_, idx) => idx !== Number(doc.attachmentIndex));
      const event = actions.createEvent?.(
        helpers.EventTypes?.UPDATE_TASK,
        doc.sourceProjectId,
        helpers.getCurrentUserId?.(),
        { taskId: doc.taskId, changes: { attachments } }
      );
      await actions.publishEvent?.(event);
      if (helpers.getSharedFolderHandle?.()) void actions.syncProjectEventsToSharedSpace?.(doc.sourceProjectId, [event]);
      helpers.showToast?.('Pièce jointe supprimée');
      actions.addNotification?.('Documents', 'Pièce jointe de projet supprimée', doc.sourceProjectId);
      await actions.renderGlobalDocs?.();
    }

    async function addStandaloneDocuments() {
      const filesInput = document.getElementById('global-doc-files');
      const themeInput = document.getElementById('global-doc-upload-theme');
      const modeInput = document.getElementById('global-doc-mode');
      const files = Array.from(filesInput?.files || []);
      const theme = themeInput?.value?.trim() || 'General';
      const sharingMode = modeInput?.value || 'private';
      if (files.length === 0) {
        helpers.showToast?.('Sélectionnez au moins un document');
        return;
      }

      const maxFileSize = 8 * 1024 * 1024;
      await actions.runWithLoading?.(async () => {
        for (const rawFile of files) {
          if (rawFile.size > maxFileSize) {
            helpers.showToast?.(`Le fichier ${rawFile.name} dépasse 8 Mo`);
            return;
          }
        }

        const docs = await actions.readDocumentFilesFromInput?.('global-doc-files', {
          projectId: 'global',
          scope: 'global',
          rubric: 'global-doc-upload',
          theme
        });
        for (const file of (docs || [])) {
          await actions.putEncrypted?.('globalDocs', {
            id: helpers.uuidv4?.(),
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            data: file.data || '',
            storageMode: file.storageMode || '',
            storageProvider: file.storageProvider || '',
            storagePath: file.storagePath || '',
            storedAt: Number(file.storedAt || 0) || null,
            theme,
            sharingMode: helpers.normalizeSharingMode?.(sharingMode, 'private') || 'private',
            createdAt: Date.now()
          }, 'id');
        }

        if (filesInput) filesInput.value = '';
        if (themeInput) themeInput.value = '';
        if (modeInput) modeInput.value = 'private';
        const label = document.getElementById('global-doc-files-label');
        if (label) label.textContent = 'Aucun fichier choisi';
      });
      helpers.showToast?.('Documents hors projet ajoutés');
      actions.addNotification?.('Documents', `${files.length} document(s) hors projet ajouté(s)`, null);
      closeGlobalDocUploadModal();
      await actions.renderGlobalDocs?.();
    }

    function openGlobalDocUploadModal() {
      const notesShared = global.TaskMDANotesShared;
      const modal = document.getElementById('modal-global-doc-upload');
      if (!modal) return;
      notesShared?.openModal?.('modal-global-doc-upload');
      if (!notesShared) {
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
      }
    }

    function closeGlobalDocUploadModal() {
      const modal = document.getElementById('modal-global-doc-upload');
      if (!modal) return;
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }

    async function openDocumentPreviewByRef(refEncoded = '') {
      const ref = actions.parseDocumentPreviewRef?.(refEncoded);
      if (!ref) {
        helpers.showToast?.('Référence document invalide');
        return;
      }
      await actions.runWithLoading?.(async () => {
        const resolved = await actions.resolveDocumentPreviewContext?.(ref);
        if (!resolved?.doc) {
          helpers.showToast?.('Document introuvable');
          return;
        }
        await actions.openDocumentPreview?.(
          encodeURIComponent(String(resolved.doc.data || '')),
          encodeURIComponent(String(resolved.doc.name || 'document')),
          encodeURIComponent(String(resolved.doc.type || '')),
          refEncoded
        );
      });
    }

    async function downloadDocumentByRef(refEncoded = '') {
      const ref = actions.parseDocumentPreviewRef?.(refEncoded);
      if (!ref) {
        helpers.showToast?.('Référence document invalide');
        return;
      }
      await actions.runWithLoading?.(async () => {
        const resolved = await actions.resolveDocumentPreviewContext?.(ref);
        if (!resolved?.doc) {
          helpers.showToast?.('Document introuvable');
          return;
        }
        const safeHref = actions.sanitizeDownloadHref?.(resolved.doc.data || '', String(resolved.doc.type || ''));
        if (!safeHref) {
          helpers.showToast?.('Téléchargement indisponible');
          return;
        }
        const link = document.createElement('a');
        link.href = safeHref;
        link.download = String(resolved.doc.name || 'document');
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }

    async function renderGlobalDocs() {
      const container = document.getElementById('global-docs-container');
      if (!container) return;
      const all = await actions.getGlobalDocumentsList?.();
      const states = await actions.getAllProjectStates?.();
      const safeAll = Array.isArray(all) ? all : [];
      const safeStates = Array.isArray(states) ? states : [];
      const stateByProjectId = new Map(safeStates.map((s) => [s?.project?.projectId, s]));
      actions.refreshGlobalDocumentThemePicker?.(safeAll, safeStates);

      const searchInputValue = String(document.getElementById('global-doc-search')?.value || '').trim();
      const q = `${helpers.getGlobalSearchQuery?.() || ''} ${searchInputValue}`.trim();
      const themeFilter = String(document.getElementById('global-doc-theme-filter')?.value || '');
      const filtered = safeAll
        .filter((doc) => helpers.matchesQuery?.([doc.name, doc.sourceProjectName, doc.theme, doc.type, helpers.sharingModeLabel?.(doc.sharingMode)], q))
        .filter((doc) => !themeFilter.trim() || helpers.matchesQuery?.([doc.theme], themeFilter));

      if (filtered.length === 0) {
        container.classList.remove('has-results');
        container.innerHTML = helpers.buildWorkspaceEmptyState?.({
          icon: 'description',
          title: 'Aucun document trouvé',
          text: 'Importez un document transverse ou modifiez vos filtres.',
          ctaLabel: 'Ajouter un document',
          ctaOnclick: "(function(){document.getElementById('btn-open-global-doc-upload-modal')?.click();})()"
        }) || '';
        return;
      }

      container.classList.add('has-results');
      const esc = helpers.escapeHtml || ((value) => String(value || ''));

      container.innerHTML = filtered.map((doc) => `
          <div class="doc-card workspace-card-shell bg-surface-container-low rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="material-symbols-outlined text-primary">description</span>
            <div class="flex items-center gap-1">
              ${helpers.sharingModeBadge?.(doc.sharingMode) || ''}
              <span class="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-white">${esc(helpers.getDocumentCategory?.(doc) || '')}</span>
            </div>
          </div>
          <h4 class="workspace-card-title font-semibold text-sm truncate">${esc(doc.name || 'document')}</h4>
          <p class="workspace-card-subtitle text-xs mt-1">${esc(doc.sourceProjectName || 'Hors projet')} • ${esc(doc.theme || 'Général')}</p>
          <div class="mt-3 flex items-center justify-between text-xs">
            <span class="text-slate-500">${helpers.formatFileSize?.(doc.size || 0) || ''}</span>
            <div class="doc-hover-actions flex items-center gap-2 flex-wrap">
              ${helpers.isDocumentPreviewable?.(doc) ? `<button onclick="openDocumentPreviewByRef('${actions.encodeDocumentPreviewRef?.(doc) || ''}')" class="workspace-action-inline" data-action-kind="preview" data-action-label="Aperçu">Aperçu</button>` : ''}
              <button onclick="downloadDocumentByRef('${actions.encodeDocumentPreviewRef?.(doc) || ''}')" class="workspace-action-inline" data-action-kind="export" data-action-label="Télécharger">Télécharger</button>
              ${(() => {
                const canManageDocBinding = doc.sourceType === 'standalone'
                  || (doc.sourceType === 'project-doc' && (() => {
                    const stateSnapshot = stateByProjectId.get(doc.sourceProjectId);
                    return !!(stateSnapshot && actions.canEditProjectMeta?.(stateSnapshot));
                  })());
                if (doc.sourceType === 'standalone') {
                  return `
                    ${helpers.isDocumentEditable?.(doc) ? `<button onclick="openGlobalDocumentEditor('${esc(doc.id)}')" class="workspace-action-inline" data-action-kind="edit" data-action-label="Modifier">Modifier</button>` : ''}
                    ${canManageDocBinding ? `<button onclick="openDocumentBindingModal('${esc(doc.id)}')" class="workspace-action-inline" data-action-kind="manage" data-action-label="Gérer">Gérer</button>` : ''}
                    <button onclick="deleteGlobalDocument('${esc(doc.id)}')" class="workspace-action-inline" data-action-kind="danger" data-action-label="Supprimer">Supprimer</button>
                  `;
                }
                if (doc.sourceType === 'project-doc') {
                  const stateSnapshot = stateByProjectId.get(doc.sourceProjectId);
                  if (stateSnapshot && actions.canEditProjectMeta?.(stateSnapshot)) {
                    return `
                      ${helpers.isDocumentEditable?.(doc) ? `<button onclick="openGlobalDocumentEditor('${esc(doc.id)}')" class="workspace-action-inline" data-action-kind="edit" data-action-label="Modifier">Modifier</button>` : ''}
                      ${canManageDocBinding ? `<button onclick="openDocumentBindingModal('${esc(doc.id)}')" class="workspace-action-inline" data-action-kind="manage" data-action-label="Gérer">Gérer</button>` : ''}
                      <button onclick="deleteGlobalDocument('${esc(doc.id)}')" class="workspace-action-inline" data-action-kind="danger" data-action-label="Supprimer">Supprimer</button>
                    `;
                  }
                  return '';
                }
                const stateSnapshot = stateByProjectId.get(doc.sourceProjectId);
                const task = (stateSnapshot?.tasks || []).find((t) => t.taskId === doc.taskId);
                if (stateSnapshot && task && actions.canEditTaskInProject?.(task, stateSnapshot)) {
                  return `
                    ${helpers.isDocumentEditable?.(doc) ? `<button onclick="openGlobalDocumentEditor('${esc(doc.id)}')" class="workspace-action-inline" data-action-kind="edit" data-action-label="Modifier">Modifier</button>` : ''}
                    <button onclick="deleteGlobalDocument('${esc(doc.id)}')" class="workspace-action-inline" data-action-kind="danger" data-action-label="Supprimer">Supprimer</button>
                  `;
                }
                return '';
              })()}
            </div>
          </div>
        </div>
      `).join('');
    }

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;
      document.getElementById('btn-close-doc-binding')?.addEventListener('click', () => {
        closeDocumentBindingModal();
      });
      document.getElementById('btn-save-doc-binding')?.addEventListener('click', () => {
        saveDocumentBindingChanges();
      });
      document.getElementById('btn-doc-binding-copy-storage-path')?.addEventListener('click', async () => {
        await copyDocumentBindingStoragePath();
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
      renderGlobalDocs,
      addStandaloneDocuments,
      deleteGlobalDocument,
      resolveDocumentForBinding,
      openGlobalDocUploadModal,
      closeGlobalDocUploadModal,
      openDocumentBindingModal,
      resetDocumentBindingInlineEditingState,
      setDocumentBindingFieldReadMode,
      setDocumentBindingReadModeAll,
      closeDocumentBindingModal,
      saveDocumentBindingChanges,
      scheduleDocumentBindingInlineSave,
      initDocumentBindingInlineEditing,
      copyDocumentBindingStoragePath,
      openDocumentPreviewByRef,
      downloadDocumentByRef
    };
  }

  global.TaskMDAGlobalDocs = {
    createModule
  };
}(window));

/* --- taskmda-global-feed.js --- */
(function initTaskMdaGlobalFeedModule(global) {
  // Module role: UI/domain boundary for TaskMdaGlobalFeedModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    const state = opts.state || {};
    const actions = opts.actions || {};
    const helpers = opts.helpers || {};
    let bound = false;
    const escapeHtml = typeof helpers.escapeHtml === 'function'
      ? helpers.escapeHtml
      : (value) => String(value || '');

    async function publishGlobalFeedDigestFromFiles(fileList, options = {}) {
      const files = Array.from(fileList || []).filter(Boolean);
      if (files.length === 0) return;
      const currentDigestViewMode = state.getGlobalFeedDigestViewMode?.() || 'compact';
      const digestViewMode = actions.normalizeGlobalFeedDigestView?.(
        options?.digestView || currentDigestViewMode,
        currentDigestViewMode
      ) || currentDigestViewMode;
      const digestBlocks = [];
      for (const file of files) {
        try {
          const digest = await actions.extractFeedDigestFromFile?.(file);
          const contentHtml = actions.buildDigestContentHtml?.(digest, file, digestViewMode);
          if (contentHtml) digestBlocks.push(contentHtml);
        } catch (error) {
          console.warn('Digest feed import failed:', error);
          helpers.showToast?.(`Digest impossible pour ${file?.name || 'fichier'}`);
        }
      }
      if (!digestBlocks.length) return;

      if (state.getEditingGlobalFeedPostId?.()) {
        actions.cancelEditGlobalFeedPost?.();
      }
      actions.openGlobalFeedComposerForNewPost?.({ focusEditor: false });
      actions.appendDigestBlocksToRichEditor?.('global-feed-editor', 'global-feed-input', digestBlocks);
      await actions.updateGlobalFeedMentionCounter?.();
      helpers.showToast?.(`${digestBlocks.length} digest importe(s) dans l editeur (publication manuelle).`);
    }

    async function publishGlobalFeedPost() {
      const input = document.getElementById('global-feed-input');
      const titleInput = document.getElementById('global-feed-title');
      const projectSelect = document.getElementById('global-feed-project-ref');
      const taskSelect = document.getElementById('global-feed-task-ref');
      const calendarSelect = document.getElementById('global-feed-calendar-ref');
      if (!input || !projectSelect || !taskSelect || !calendarSelect) return;

      const title = String(titleInput?.value || '').trim();
      const quill = actions.getGlobalFeedQuillEditor?.();
      let content = '';
      if (quill) {
        content = String(quill.root.innerHTML || '').trim();
        if (content === '<p><br></p>') content = '';
      } else {
        content = String(input.value || '').trim();
      }
      content = actions.applyProfanityFilterToHtml?.(content) || content;
      if (!content) {
        helpers.showToast?.('Le post est vide');
        return;
      }

      const mentionCatalog = await actions.buildGlobalMentionCatalog?.();
      const textToScan = quill ? (quill.getText() || '') : content;
      const mentions = Array.from(actions.extractMentionedUserIdsFromText?.(textToScan, mentionCatalog) || []);
      const refs = [];
      if (projectSelect.value) {
        const opt = projectSelect.options[projectSelect.selectedIndex];
        refs.push({ type: 'project', id: projectSelect.value, label: opt?.textContent || 'Projet' });
      }
      if (taskSelect.value) {
        const opt = taskSelect.options[taskSelect.selectedIndex];
        refs.push({ type: 'task', id: taskSelect.value, label: opt?.textContent || 'Tache' });
      }
      if (calendarSelect.value) {
        const opt = calendarSelect.options[calendarSelect.selectedIndex];
        refs.push({ type: 'calendar-info', id: calendarSelect.value, label: opt?.textContent || 'Info calendrier' });
      }

      const editingId = String(state.getEditingGlobalFeedPostId?.() || '').trim();
      if (editingId) {
        const existing = await actions.getGlobalPostById?.(editingId);
        if (existing) {
          existing.title = title;
          existing.content = actions.applyProfanityFilterToHtml?.(content) || content;
          existing.mentions = mentions;
          existing.refs = refs;
          existing.summaryWordCount = actions.getFeedSummaryWordCount?.();
          existing.summary = actions.computeGlobalFeedPostAutoSummary?.(existing, existing.summaryWordCount) || '';
          existing.updatedAt = Date.now();
          await actions.putGlobalPost?.(existing);
          actions.addKnownGlobalPostId?.(existing.postId);

          if (quill) quill.root.innerHTML = '';
          input.value = '';
          const attachInput = document.getElementById('global-feed-attach-doc-files');
          if (attachInput) attachInput.value = '';
          if (titleInput) titleInput.value = '';
          projectSelect.value = '';
          taskSelect.value = '';
          calendarSelect.value = '';
          await actions.updateGlobalFeedMentionCounter?.();
          await actions.renderGlobalFeed?.();
          if (state.getSharedFolderHandle?.()) {
            actions.writeGlobalFeedPostToSharedFolder?.(existing);
          }
          helpers.showToast?.('Post mis à jour');
          actions.cancelEditGlobalFeedPost?.();
          return;
        }
      }

      const currentUser = state.getCurrentUser?.() || {};
      const post = {
        postId: helpers.uuidv4?.(),
        authorUserId: String(currentUser?.userId || ''),
        authorName: String(currentUser?.name || actions.fallbackDirectoryName?.(currentUser?.userId || '')),
        title,
        content,
        mentions,
        refs,
        summaryWordCount: actions.getFeedSummaryWordCount?.(),
        summary: '',
        createdAt: Date.now(),
        source: state.getSharedFolderHandle?.() ? 'shared' : 'local'
      };
      post.summary = actions.computeGlobalFeedPostAutoSummary?.(post, post.summaryWordCount) || '';
      await actions.putGlobalPost?.(post);
      actions.addKnownGlobalPostId?.(post.postId);
      input.value = '';
      const attachInput = document.getElementById('global-feed-attach-doc-files');
      if (attachInput) attachInput.value = '';
      if (titleInput) titleInput.value = '';
      if (quill) quill.root.innerHTML = '';
      projectSelect.value = '';
      taskSelect.value = '';
      calendarSelect.value = '';
      await actions.updateGlobalFeedMentionCounter?.();
      await actions.renderGlobalFeed?.();
      if (state.getSharedFolderHandle?.()) {
        actions.writeGlobalFeedPostToSharedFolder?.(post);
      }
      helpers.showToast?.('Post publie');
      actions.setGlobalFeedComposerCollapsed?.(true);
    }

    async function openGlobalFeedReference(type, refId) {
      const t = String(type || '').trim();
      const id = decodeURIComponent(String(refId || '').trim());
      if (!t || !id) return;
      if (t === 'project') {
        await actions.showProjectDetail?.(id, { resetScroll: true });
        return;
      }
      if (t === 'task') {
        await actions.showGlobalWorkspace?.('tasks');
        await actions.openGlobalTaskDetails?.(id);
        return;
      }
      if (t === 'project-note') {
        const parts = String(id || '').split(':');
        const projectId = String(parts[0] || '').trim();
        const noteId = String(parts[1] || '').trim();
        if (!projectId || !noteId) return;
        actions.setProjectNotesFocusNoteId?.(noteId);
        await actions.showProjectDetail?.(projectId, { resetScroll: true });
        actions.setProjectView?.('notes');
        actions.openProjectNoteReadModal?.(noteId);
        return;
      }
      if (t === 'global-note') {
        actions.setGlobalNotesFocusNoteId?.(id);
        await actions.showGlobalWorkspace?.('notes');
        await actions.renderGlobalNotes?.();
        actions.openGlobalNoteReadModal?.(id);
        return;
      }
      if (t === 'calendar-info') {
        await actions.showGlobalWorkspace?.('calendar');
        await actions.openStandaloneCalendarDetails?.(id);
      }
    }

    async function openGlobalFeedPost(postId) {
      const nextPostId = String(postId || '').trim();
      state.setGlobalFeedFocusPostId?.(nextPostId);
      state.setGlobalFeedFilterMode?.('all');
      const searchInput = document.getElementById('global-feed-search');
      if (searchInput) searchInput.value = '';
      await actions.showGlobalWorkspace?.('feed');
      await actions.renderGlobalFeed?.();
      actions.expandGlobalFeedPostCard?.(nextPostId);
    }

    function refreshGlobalFeedFilterButtons() {
      const map = {
        all: document.getElementById('global-feed-filter-all'),
        auto: document.getElementById('global-feed-filter-auto'),
        manual: document.getElementById('global-feed-filter-manual'),
        mentions: document.getElementById('global-feed-filter-mentions'),
        'project-refs': document.getElementById('global-feed-filter-project-refs'),
        'task-refs': document.getElementById('global-feed-filter-task-refs')
      };
      let mode = String(state.getGlobalFeedFilterMode?.() || 'all');
      if (!actions.isTabEnabled?.('globalFeed', mode)) {
        mode = actions.getDefaultTab?.('globalFeed') || 'all';
        state.setGlobalFeedFilterMode?.(mode);
      }
      Object.entries(map).forEach(([key, btn]) => {
        if (!btn) return;
        btn.classList.toggle('hidden', !actions.isTabEnabled?.('globalFeed', key));
        const active = key === mode;
        btn.classList.toggle('view-tab-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      const sortSelect = document.getElementById('global-feed-sort');
      if (sortSelect) sortSelect.value = String(state.getGlobalFeedSortMode?.() || 'desc');
      actions.refreshManagedTabOverflow?.();
    }

    function renderGlobalFeedSummary(posts, mentionCatalog) {
      const summary = document.getElementById('global-feed-summary');
      if (!summary) return;
      const me = String(state.getCurrentUserId?.() || '');
      const total = posts.length;
      const autoCount = posts.filter((p) => Boolean(p.isAuto || p.sourceEventId)).length;
      const manualCount = total - autoCount;
      const mentionCount = posts.filter((p) => Array.isArray(p.mentions) && p.mentions.map((id) => String(id || '')).includes(me)).length;
      const projectRefsCount = posts.filter((p) => Array.isArray(p.refs) && p.refs.some((r) => String(r?.type || '') === 'project')).length;
      const taskRefsCount = posts.filter((p) => Array.isArray(p.refs) && p.refs.some((r) => String(r?.type || '') === 'task')).length;
      const knownMentions = (mentionCatalog?.users || []).length;
      summary.innerHTML = `
        <span class="feed-summary-chip"><span class="material-symbols-outlined text-[14px]">feed</span>${total} éléments</span>
        <span class="feed-summary-chip"><span class="material-symbols-outlined text-[14px]">bolt</span>${autoCount} activités auto</span>
        <span class="feed-summary-chip"><span class="material-symbols-outlined text-[14px]">edit_square</span>${manualCount} posts manuels</span>
        <span class="feed-summary-chip"><span class="material-symbols-outlined text-[14px]">alternate_email</span>${mentionCount} mentions</span>
        <span class="feed-summary-chip"><span class="material-symbols-outlined text-[14px]">folder</span>${projectRefsCount} refs projet</span>
        <span class="feed-summary-chip"><span class="material-symbols-outlined text-[14px]">assignment</span>${taskRefsCount} refs tache</span>
        <span class="feed-summary-chip"><span class="material-symbols-outlined text-[14px]">group</span>${knownMentions} agents connus</span>
      `;
    }

    async function prepareGlobalFeedRenderScope() {
      const searchInput = document.getElementById('global-feed-search');
      const mentionCatalog = await actions.populateGlobalFeedComposerContext?.();
      const nextCatalog = mentionCatalog || state.getGlobalFeedMentionCatalogCache?.() || null;
      if (mentionCatalog) {
        state.setGlobalFeedMentionCatalogCache?.(mentionCatalog);
      }
      const query = String(searchInput?.value || '').trim();
      const postsAll = (await actions.getAllGlobalPosts?.() || [])
        .filter((p) => !p.deletedAt)
        .filter((p) => helpers.matchesQuery?.([
          p.title,
          p.content,
          p.authorName,
          ...(Array.isArray(p.refs) ? p.refs.map((r) => r?.label) : []),
          ...(Array.isArray(p.mentions) ? p.mentions.map((id) => nextCatalog?.byUserId?.get(id)?.name || '') : [])
        ], query));
      const me = String(state.getCurrentUserId?.() || '');
      renderGlobalFeedSummary(postsAll, nextCatalog);
      refreshGlobalFeedFilterButtons();

      const postsFilteredByType = postsAll.filter((post) => {
        const isAuto = Boolean(post.isAuto || post.sourceEventId);
        const isMention = Array.isArray(post.mentions) && post.mentions.map((id) => String(id || '')).includes(me);
        const refs = Array.isArray(post.refs) ? post.refs : [];
        const hasProjectRef = refs.some((ref) => String(ref?.type || '') === 'project');
        const hasTaskRef = refs.some((ref) => String(ref?.type || '') === 'task');
        const filterMode = String(state.getGlobalFeedFilterMode?.() || 'all');
        if (filterMode === 'auto') return isAuto;
        if (filterMode === 'manual') return !isAuto;
        if (filterMode === 'mentions') return isMention;
        if (filterMode === 'project-refs') return hasProjectRef;
        if (filterMode === 'task-refs') return hasTaskRef;
        return true;
      });
      const sortMode = String(state.getGlobalFeedSortMode?.() || 'desc');
      const posts = postsFilteredByType.sort((a, b) => (
        sortMode === 'asc'
          ? Number(a.createdAt || 0) - Number(b.createdAt || 0)
          : Number(b.createdAt || 0) - Number(a.createdAt || 0)
      ));
      const allDocs = await actions.getAllGlobalDocs?.();
      return { posts, allDocs, mentionCatalog: nextCatalog };
    }

    async function resolveLinkedDocsForFeedPost(post = {}, allGlobalDocs = []) {
      const refs = Array.isArray(post?.refs) ? post.refs : [];
      const linkedGlobalNoteIds = new Set();
      const linkedProjectNotes = [];
      refs.forEach((ref) => {
        const type = String(ref?.type || '').trim();
        const rawId = String(ref?.id || '').trim();
        if (!rawId) return;
        if (type === 'global-note') {
          linkedGlobalNoteIds.add(rawId);
          return;
        }
        if (type === 'project-note') {
          const parts = rawId.split(':');
          const projectId = String(parts[0] || '').trim();
          const noteId = String(parts[1] || '').trim();
          if (projectId && noteId) linkedProjectNotes.push({ projectId, noteId });
        }
      });
      const linkedDocIdsFromContent = new Set(
        actions.extractLinkedGlobalDocIdsFromHtml?.(String(post?.content || '')) || []
      );
      const standaloneDocs = (Array.isArray(allGlobalDocs) ? allGlobalDocs : [])
        .filter((doc) => {
          const docId = String(doc?.id || '').trim();
          if (!docId) return false;
          if (linkedDocIdsFromContent.has(docId)) return true;
          const noteIds = Array.isArray(doc?.linkedNoteIds) ? doc.linkedNoteIds : [];
          return noteIds.some((noteId) => linkedGlobalNoteIds.has(String(noteId || '').trim()));
        })
        .map((doc) => ({
          id: String(doc?.id || '').trim(),
          name: String(doc?.name || 'Document').trim() || 'Document',
          ref: actions.encodeDocumentPreviewRef?.({
            sourceType: 'standalone',
            id: String(doc?.id || '').trim(),
            sourceProjectName: 'Hors projet'
          })
        }))
        .filter((doc) => doc.id && doc.ref);

      const projectDocs = [];
      for (const link of linkedProjectNotes) {
        const stateForProject = await actions.getProjectState?.(link.projectId, { ignoreAccessCheck: true });
        if (!stateForProject?.project) continue;
        (Array.isArray(stateForProject.documents) ? stateForProject.documents : []).forEach((doc) => {
          const linkedNoteIds = Array.isArray(doc?.linkedNoteIds) ? doc.linkedNoteIds : [];
          const isLinked = linkedNoteIds.some((noteId) => String(noteId || '').trim() === link.noteId);
          if (!isLinked) return;
          const docId = String(doc?.docId || '').trim();
          if (!docId) return;
          projectDocs.push({
            id: `${link.projectId}:project-doc:${docId}`,
            name: String(doc?.name || 'Document').trim() || 'Document',
            ref: actions.encodeDocumentPreviewRef?.({
              sourceType: 'project-doc',
              projectId: link.projectId,
              docId,
              sourceProjectName: stateForProject.project.name
            })
          });
        });
      }

      const unique = new Map();
      [...standaloneDocs, ...projectDocs].forEach((doc) => {
        const key = String(doc?.id || '').trim();
        if (!key || unique.has(key)) return;
        unique.set(key, doc);
      });
      return Array.from(unique.values()).filter((doc) => doc.id && doc.ref);
    }

    function renderFeedNoteCardHtml(post, refs, linkedDocs, isFocused, typeLabel, typeClass) {
      const unifiedNotesRenderer = global.TaskMDAProjectNotes?.renderUnifiedNotesList;
      if (typeof unifiedNotesRenderer !== 'function') return '';
      const postId = String(post?.postId || '').trim();
      if (!postId) return '';
      let noteRef = refs.find((ref) => {
        const type = String(ref?.type || '').trim();
        return type === 'global-note' || type === 'project-note';
      });
      if (!noteRef) {
        const sourceEventId = String(post?.sourceEventId || '').trim();
        if (sourceEventId.startsWith('global-note:')) {
          const globalNoteId = sourceEventId.slice('global-note:'.length).trim();
          if (globalNoteId) {
            noteRef = { type: 'global-note', id: globalNoteId, label: String(post?.title || '').trim() || 'Note transverse' };
          }
        } else if (sourceEventId.startsWith('project-note:')) {
          const projectNoteRef = sourceEventId.slice('project-note:'.length).trim();
          if (projectNoteRef) {
            noteRef = { type: 'project-note', id: projectNoteRef, label: String(post?.title || '').trim() || 'Note projet' };
          }
        }
      }
      if (!noteRef) return '';
      const refType = String(noteRef?.type || '').trim();
      const refId = String(noteRef?.id || '').trim();
      const refLabel = String(noteRef?.label || '').trim();
      const pseudoNoteId = `feed-note-${postId}`;
      const pseudoNote = {
        noteId: pseudoNoteId,
        title: refLabel || String(post?.title || '').trim() || 'Note sans titre',
        content: String(post?.content || ''),
        createdBy: String(post?.authorUserId || ''),
        createdAt: Number(post?.createdAt || Date.now()) || Date.now(),
        updatedAt: Number(post?.updatedAt || post?.createdAt || Date.now()) || Date.now(),
        shareToGlobalFeed: true,
        tags: []
      };
      const authorById = new Map([[pseudoNoteId, String(post?.authorName || actions.fallbackDirectoryName?.(post?.authorUserId || ''))]]);
      const canManageById = new Map([[pseudoNoteId, false]]);
      const noteDocsCountById = new Map([[pseudoNoteId, Number(Array.isArray(linkedDocs) ? linkedDocs.length : 0)]]);
      const tempHost = document.createElement('div');
      unifiedNotesRenderer(tempHost, {
        notes: [pseudoNote],
        mode: 'all',
        query: '',
        currentUserId: String(state.getCurrentUserId?.() || ''),
        taskTitleById: new Map(),
        authorById,
        canManageById,
        noteDocsCountById,
        cardIdPrefix: 'global-feed-note',
        openFn: refType === 'global-note' ? 'openGlobalNoteReadModal' : 'openGlobalFeedReference',
        showTaskLinks: false,
        actionsRenderer: () => ''
      });
      let noteCardHtml = String(tempHost.innerHTML || '').trim();
      if (!noteCardHtml) return '';
      if (refType === 'project-note') {
        const encoded = encodeURIComponent(refId);
        noteCardHtml = noteCardHtml
          .replace(`openGlobalFeedReference('${helpers.escapeHtml?.(pseudoNoteId)}')`, `openGlobalFeedReference('project-note','${encoded}')`)
          .replace(`id="global-feed-note-${helpers.escapeHtml?.(pseudoNoteId)}"`, `id="global-feed-note-${helpers.escapeHtml?.(postId)}"`);
      } else {
        noteCardHtml = noteCardHtml
          .replace(`openGlobalNoteReadModal('${helpers.escapeHtml?.(pseudoNoteId)}')`, `openGlobalNoteReadModal('${helpers.escapeHtml?.(refId)}')`)
          .replace(`id="global-feed-note-${helpers.escapeHtml?.(pseudoNoteId)}"`, `id="global-feed-note-${helpers.escapeHtml?.(postId)}"`);
      }
      return `
        <article id="global-feed-post-${postId}" class="feed-item ${isFocused ? 'border-blue-400 shadow-[0_0_0_2px_rgba(59,130,246,0.15)]' : ''}">
          <div class="feed-item-head">
            <div class="feed-item-meta">
              <span class="material-symbols-outlined text-slate-400">sticky_note_2</span>
              <div>
                <p class="text-sm font-semibold text-slate-800">Note partagée</p>
                <p class="text-xs text-slate-500">${new Date(Number(post.createdAt || Date.now())).toLocaleString('fr-FR')}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              ${refType === 'global-note'
                ? `<button onclick="event.stopPropagation(); openGlobalNoteReadModal('${helpers.escapeHtml?.(refId)}')" class="workspace-action-inline" data-action-kind="open" title="Lire">Lire</button>`
                : `<button onclick="event.stopPropagation(); openGlobalFeedReference('project-note','${encodeURIComponent(refId)}')" class="workspace-action-inline" data-action-kind="open" title="Lire">Lire</button>`}
              <div class="relative inline-block">
                <button type="button" class="workspace-action-inline" data-action-kind="export" data-action-label="Menu d'export" onclick="toggleGlobalFeedExportMenu('${helpers.escapeHtml?.(postId)}', event)" aria-haspopup="true" aria-expanded="false" id="feed-export-menu-btn-${helpers.escapeHtml?.(postId)}">
                  Exporter
                </button>
                <div id="feed-export-menu-${helpers.escapeHtml?.(postId)}" class="hidden absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden" role="menu" onclick="event.stopPropagation();">
                  <button type="button" class="export-menu-item w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onclick="exportGlobalFeedPost('${helpers.escapeHtml?.(postId)}', 'html'); closeGlobalFeedExportMenu('${helpers.escapeHtml?.(postId)}');" role="menuitem"><span class="material-symbols-outlined text-[16px]">code</span><span>Exporter HTML</span></button>
                  <button type="button" class="export-menu-item w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onclick="exportGlobalFeedPostAsPdf('${helpers.escapeHtml?.(postId)}'); closeGlobalFeedExportMenu('${helpers.escapeHtml?.(postId)}');" role="menuitem"><span class="material-symbols-outlined text-[16px]">picture_as_pdf</span><span>Exporter PDF</span></button>
                  <button type="button" class="export-menu-item w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onclick="exportGlobalFeedPostAsDocx('${helpers.escapeHtml?.(postId)}'); closeGlobalFeedExportMenu('${helpers.escapeHtml?.(postId)}');" role="menuitem"><span class="material-symbols-outlined text-[16px]">description</span><span>Exporter DOCX</span></button>
                  <button type="button" class="export-menu-item w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onclick="exportGlobalFeedPost('${helpers.escapeHtml?.(postId)}', 'txt'); closeGlobalFeedExportMenu('${helpers.escapeHtml?.(postId)}');" role="menuitem"><span class="material-symbols-outlined text-[16px]">notes</span><span>Exporter TXT</span></button>
                </div>
              </div>
              <span class="text-slate-300">|</span>
              <span class="feed-item-type ${typeClass}">${typeLabel}</span>
            </div>
          </div>
          <div class="feed-item-body">${noteCardHtml}</div>
        </article>
      `;
    }

    async function buildGlobalFeedCardsHtml(posts, allDocs, mentionCatalog) {
      const cardsHtml = [];
      for (const post of (Array.isArray(posts) ? posts : [])) {
        const postId = String(post?.postId || '').trim();
        if (!postId) continue;
        const mentions = (post.mentions || [])
          .map((id) => mentionCatalog?.byUserId?.get(String(id || '')))
          .filter(Boolean);
        const refs = Array.isArray(post.refs) ? post.refs : [];
        const linkedDocs = await resolveLinkedDocsForFeedPost(post, allDocs);
        const isFocused = String(state.getGlobalFeedFocusPostId?.() || '') === postId;
        const isAuto = Boolean(post.isAuto || post.sourceEventId);
        const typeLabel = isAuto ? 'Activité auto' : 'Post manuel';
        const typeClass = isAuto ? 'feed-item-type-auto' : 'feed-item-type-manual';
        const noteCardHtml = renderFeedNoteCardHtml(post, refs, linkedDocs, isFocused, typeLabel, typeClass);
        if (noteCardHtml) {
          cardsHtml.push(noteCardHtml);
          continue;
        }
        const identity = actions.resolveKnownUserIdentity?.(post.authorUserId || '', post.authorName || actions.fallbackDirectoryName?.(post.authorUserId || '')) || {};
        const avatarStyle = actions.safeAvatarInlineStyle?.(identity.avatarDataUrl, actions.stringToColor?.(post.authorUserId || post.authorName || '')) || '';
        cardsHtml.push(`
          <article id="global-feed-post-${postId}" class="feed-item ${isFocused ? 'border-blue-400 shadow-[0_0_0_2px_rgba(59,130,246,0.15)]' : ''} cursor-pointer" onclick="toggleCollapsibleContent(this.querySelector('.collapsible-toggle'))">
            <div class="feed-item-head">
              <div class="feed-item-meta">
                <span class="discussion-avatar" style="${avatarStyle}">${helpers.escapeHtml?.(actions.getInitials?.(post.authorName || 'U'))}</span>
                <div>
                  <p class="text-sm font-semibold text-slate-800">${helpers.escapeHtml?.(post.authorName || actions.fallbackDirectoryName?.(post.authorUserId || ''))}</p>
                  <p class="text-xs text-slate-500">${new Date(Number(post.createdAt || Date.now())).toLocaleString('fr-FR')}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                ${!isAuto && String(post.authorUserId || '') === String(state.getCurrentUserId?.() || '') ? `
                  <button onclick="event.stopPropagation(); openGlobalFeedPostReadModal('${postId}')" class="workspace-action-inline" data-action-kind="open" title="Lire">Lire</button>
                  <button onclick="event.stopPropagation(); startEditGlobalFeedPost('${postId}')" class="workspace-action-inline" data-action-kind="edit" title="Éditer">Éditer</button>
                  <button onclick="event.stopPropagation(); deleteGlobalFeedPost('${postId}')" class="workspace-action-inline" data-action-kind="danger" title="Supprimer">Supprimer</button>
                ` : ''}
                ${String(post.authorUserId || '') !== String(state.getCurrentUserId?.() || '') ? `<button onclick="event.stopPropagation(); openGlobalFeedPostReadModal('${postId}')" class="workspace-action-inline" data-action-kind="open" title="Lire">Lire</button>` : ''}
                <div class="relative inline-block">
                  <button type="button" class="workspace-action-inline" data-action-kind="export" data-action-label="Menu d'export" onclick="toggleGlobalFeedExportMenu('${helpers.escapeHtml?.(postId)}', event)" aria-haspopup="true" aria-expanded="false" id="feed-export-menu-btn-${helpers.escapeHtml?.(postId)}">
                    Exporter
                  </button>
                  <div id="feed-export-menu-${helpers.escapeHtml?.(postId)}" class="hidden absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden" role="menu" onclick="event.stopPropagation();">
                    <button type="button" class="export-menu-item w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onclick="exportGlobalFeedPost('${helpers.escapeHtml?.(postId)}', 'html'); closeGlobalFeedExportMenu('${helpers.escapeHtml?.(postId)}');" role="menuitem"><span class="material-symbols-outlined text-[16px]">code</span><span>Exporter HTML</span></button>
                    <button type="button" class="export-menu-item w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onclick="exportGlobalFeedPostAsPdf('${helpers.escapeHtml?.(postId)}'); closeGlobalFeedExportMenu('${helpers.escapeHtml?.(postId)}');" role="menuitem"><span class="material-symbols-outlined text-[16px]">picture_as_pdf</span><span>Exporter PDF</span></button>
                    <button type="button" class="export-menu-item w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onclick="exportGlobalFeedPostAsDocx('${helpers.escapeHtml?.(postId)}'); closeGlobalFeedExportMenu('${helpers.escapeHtml?.(postId)}');" role="menuitem"><span class="material-symbols-outlined text-[16px]">description</span><span>Exporter DOCX</span></button>
                    <button type="button" class="export-menu-item w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onclick="exportGlobalFeedPost('${helpers.escapeHtml?.(postId)}', 'txt'); closeGlobalFeedExportMenu('${helpers.escapeHtml?.(postId)}');" role="menuitem"><span class="material-symbols-outlined text-[16px]">notes</span><span>Exporter TXT</span></button>
                  </div>
                </div>
                <span class="text-slate-300">|</span>
                <span class="feed-item-type ${typeClass}">${typeLabel}</span>
              </div>
            </div>
            <div class="feed-item-body">
              ${String(post.title || '').trim() ? `<h4 class="text-base font-semibold text-slate-800 mb-2">${helpers.escapeHtml?.(String(post.title || '').trim())}</h4>` : ''}
              <div class="collapsible-wrapper">
                <div class="collapsible-content is-collapsed">
                  <div class="ql-snow"><div class="ql-editor p-0 text-sm text-slate-600 markdown-content" style="min-height: auto; overflow-y: hidden; cursor: inherit;">
                    ${actions.renderGlobalFeedContentHtml?.(post.content || '', mentionCatalog) || ''}
                  </div></div>
                </div>
                <button type="button" class="collapsible-toggle hidden" onclick="event.stopPropagation(); toggleCollapsibleContent(this)"><span class="label">Afficher le contenu</span></button>
              </div>
            </div>
            ${mentions.length > 0 ? `<div class="feed-item-mentions">${mentions.map((u) => `<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">@${helpers.escapeHtml?.(u.name)}</span>`).join('')}</div>` : ''}
            ${refs.length > 0 ? `<div class="feed-item-refs">${refs.map((ref) => `<button onclick="event.stopPropagation(); openGlobalFeedReference('${helpers.escapeHtml?.(ref.type || '')}','${encodeURIComponent(String(ref.id || ''))}')" class="feed-ref-btn">${helpers.escapeHtml?.(ref.label || 'Référence')}</button>`).join('')}
              ${refs.map((ref) => {
                const type = String(ref?.type || '').trim();
                const rid = String(ref?.id || '').trim();
                if (type === 'global-note' && rid) {
                  return `<button onclick="event.stopPropagation(); openGlobalNoteReadModal('${helpers.escapeHtml?.(rid)}')" class="workspace-action-inline" data-action-kind="open" data-action-label="Lire la note">Lire note</button>`;
                }
                if (type === 'project-note' && rid) {
                  const encoded = encodeURIComponent(rid);
                  return `<button onclick="event.stopPropagation(); openGlobalFeedReference('project-note','${encoded}')" class="workspace-action-inline" data-action-kind="open" data-action-label="Ouvrir la note projet">Ouvrir note projet</button>`;
                }
                return '';
              }).join('')}
            </div>` : ''}
            ${linkedDocs.length > 0 ? `<div class="feed-item-refs mt-2">${linkedDocs.map((doc) => {
              const ref = String(doc?.ref || '').trim();
              if (!ref) return '';
              return `<span class="inline-flex items-center gap-1 mr-2 mb-1" onclick="event.stopPropagation();"><span class="feed-ref-btn" style="cursor: default;">📎 ${helpers.escapeHtml?.(doc.name)}</span><button type="button" class="workspace-action-inline" data-action-kind="preview" data-action-label="Aperçu" onclick="event.stopPropagation(); openDocumentPreviewByRef('${helpers.escapeHtml?.(ref)}')">Aperçu</button><button type="button" class="workspace-action-inline" data-action-kind="export" data-action-label="Télécharger" onclick="event.stopPropagation(); downloadDocumentByRef('${helpers.escapeHtml?.(ref)}')">Télécharger</button></span>`;
            }).join('')}</div>` : ''}
          </article>
        `);
      }
      return cardsHtml.join('');
    }

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;
      document.getElementById('global-feed-filter-tabs')?.addEventListener('click', (event) => {
        if (event?.target?.closest?.('.tab-overflow-wrap')) return;
        setTimeout(() => actions.refreshManagedTabOverflow?.(), 0);
      });
      document.getElementById('btn-global-feed-attach-doc')?.addEventListener('click', () => {
        document.getElementById('global-feed-attach-doc-files')?.click();
      });
      document.getElementById('global-feed-attach-doc-files')?.addEventListener('change', async (event) => {
        const files = Array.from(event?.target?.files || []);
        if (!files.length) return;
        await actions.importDocumentsIntoGlobalFeedEditor?.();
      });
    }

    return {
      bindDom,
      renderGlobalFeed: (...args) => actions.renderGlobalFeed?.(...args),
      publishGlobalFeedPost,
      publishGlobalFeedDigestFromFiles,
      pickGlobalFeedDigestImportMode: (...args) => actions.pickGlobalFeedDigestImportMode?.(...args),
      insertMentionTokenInGlobalFeed: (...args) => actions.insertMentionTokenInGlobalFeed?.(...args),
      setGlobalFeedComposerCollapsed: (...args) => actions.setGlobalFeedComposerCollapsed?.(...args),
      openGlobalFeedComposerForNewPost: (...args) => actions.openGlobalFeedComposerForNewPost?.(...args),
      updateGlobalFeedMentionCounter: (...args) => actions.updateGlobalFeedMentionCounter?.(...args),
      prepareGlobalFeedRenderScope,
      resolveLinkedDocsForFeedPost,
      buildGlobalFeedCardsHtml,
      openGlobalFeedReference,
      openGlobalFeedPost,
      refreshGlobalFeedFilterButtons,
      renderGlobalFeedSummary
    };
  }

  global.TaskMDAGlobalFeed = {
    createModule
  };
}(window));

/* --- taskmda-global-messages.js --- */
(function initTaskMdaGlobalMessagesModule(global) {
  // Module role: UI/domain boundary for TaskMdaGlobalMessagesModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    // Global messaging bindings live here (composer + thread UI).
    // Business operations are injected from the main orchestrator.
    const opts = options || {};
    const actions = opts.actions || {};

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      document.getElementById('btn-global-toggle-emoji-picker')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        actions.toggleGlobalEmojiPicker?.();
      });
      document.getElementById('btn-global-toggle-message-files')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        actions.toggleGlobalMessageFilesPanel?.();
      });
      document.getElementById('global-emoji-picker-panel')?.addEventListener('click', (event) => {
        const button = event.target?.closest?.('[data-emoji]');
        if (!button) return;
        const input = document.getElementById('global-message-input');
        actions.insertTextAtCursor?.(input, button.dataset.emoji || '');
      });
      document.getElementById('global-message-input')?.addEventListener('paste', async (event) => {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.length) return;
        const input = event.currentTarget;
        const inserted = await actions.insertImageFilesIntoDiscussionInput?.(input, files);
        if ((Number(inserted) || 0) > 0) {
          event.preventDefault();
          actions.showToast?.(String(inserted) + ' image(s) inseree(s) dans le message');
        }
      });
      document.getElementById('global-message-input')?.addEventListener('drop', async (event) => {
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.length) return;
        event.preventDefault();
        event.stopPropagation();
        const input = event.currentTarget;
        const inserted = await actions.insertImageFilesIntoDiscussionInput?.(input, files);
        if ((Number(inserted) || 0) > 0) {
          actions.showToast?.(String(inserted) + ' image(s) inseree(s) dans le message');
        }
      });

      document.getElementById('global-message-thread')?.addEventListener('click', (event) => {
        const img = event.target?.closest?.('.markdown-content img');
        if (!img) return;
        const src = String(img.getAttribute('src') || '').trim();
        if (!src) return;
        event.preventDefault();
        actions.openMessageImagePreview?.(src, img.getAttribute('alt') || 'Image message');
      });

      document.getElementById('btn-clear-global-message-reply')?.addEventListener('click', () => {
        actions.clearGlobalMessageReply?.();
      });

      document.addEventListener('click', (event) => {
        if (!actions.isGlobalEmojiPickerOpen?.()) return;
        const target = event.target;
        const panel = document.getElementById('global-emoji-picker-panel');
        const trigger = document.getElementById('btn-global-toggle-emoji-picker');
        if (panel?.contains(target) || trigger?.contains(target)) return;
        actions.toggleGlobalEmojiPicker?.(false);
      });

      document.addEventListener('click', (event) => {
        if (!actions.isGlobalMessageFilesPanelOpen?.()) return;
        const target = event.target;
        const panel = document.getElementById('global-message-files-panel');
        const trigger = document.getElementById('btn-global-toggle-message-files');
        const composer = document.querySelector('#global-messages-section .discussion-composer');
        if (panel?.contains(target) || trigger?.contains(target) || composer?.contains(target)) return;
        actions.toggleGlobalMessageFilesPanel?.(false);
      });
    }

    return {
      bindDom,
      renderGlobalMessages: (...args) => actions.renderGlobalMessages?.(...args),
      sendGlobalMessage: (...args) => actions.sendGlobalMessage?.(...args),
      deleteGlobalConversation: (...args) => actions.deleteGlobalConversation?.(...args),
      selectAllGlobalMessageRecipients: (...args) => actions.selectAllGlobalMessageRecipients?.(...args),
      clearGlobalMessageRecipients: (...args) => actions.clearGlobalMessageRecipients?.(...args),
      openGlobalMessageGroupChannelFromCatalog: (...args) => actions.openGlobalMessageGroupChannelFromCatalog?.(...args),
      handleGlobalMessageContactsScroll: (...args) => actions.handleGlobalMessageContactsScroll?.(...args),
      handleGlobalMessageThreadScroll: (...args) => actions.handleGlobalMessageThreadScroll?.(...args)
    };
  }

  global.TaskMDAGlobalMessages = {
    createModule
  };
}(window));

/* --- taskmda-message-reactions-outside-ui.js --- */
(function initTaskMdaMessageReactionsOutsideUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaMessageReactionsOutsideUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    // Cross-scope behavior:
    // close reaction pickers for project + global threads on outside click.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.addEventListener('click', (event) => {
        const target = event.target;
        const clickedReactionUi = !!target?.closest?.('.discussion-reaction-picker, .discussion-react-trigger-btn');
        if (clickedReactionUi) return;
        let changed = false;

        if (opts.getProjectReactionPickerMessageId?.()) {
          opts.setProjectReactionPickerMessageId?.('');
          const state = opts.getCurrentProjectState?.();
          if (state) {
            opts.renderMessages?.(state.messages || []);
          }
          changed = true;
        }

        if (opts.getGlobalReactionPickerMessageId?.()) {
          opts.setGlobalReactionPickerMessageId?.('');
          opts.renderGlobalMessages?.({ keepThreadAnchor: true });
          changed = true;
        }

        if (changed) {
          // UI refresh already handled by render calls
        }
      });
    }

    function renderGlobalNotesThemeTabs(notes = []) {
      const host = document.getElementById('global-notes-theme-tabs');
      if (!host) return;
      const selectedThemeFilter = String(opts.getGlobalNotesThemeFilter?.() || 'all').trim() || 'all';
      const total = Array.isArray(notes) ? notes.length : 0;
      const buckets = new Map();
      (Array.isArray(notes) ? notes : []).forEach((note) => {
        const label = String(note?.theme || '').trim() || 'Sans thematique';
        const key = normalizeCatalogKey(label);
        if (!key) return;
        const prev = buckets.get(key);
        if (prev) {
          prev.count += 1;
        } else {
          buckets.set(key, { key, label, count: 1 });
        }
      });
      const sorted = Array.from(buckets.values()).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
      host.innerHTML = [
        `<button type="button" class="project-notes-theme-tab ${selectedThemeFilter === 'all' ? 'is-active' : ''}" data-global-note-theme-tab="all">Toutes <span>${total}</span></button>`,
        ...sorted.map((item) =>
          `<button type="button" class="project-notes-theme-tab ${selectedThemeFilter === item.key ? 'is-active' : ''}" data-global-note-theme-tab="${escapeHtml(item.key)}">${escapeHtml(item.label)} <span>${item.count}</span></button>`
        )
      ].join('');

      const toggle = document.getElementById('global-notes-themes-toggle');
      if (!toggle) return;
      const activeCount = selectedThemeFilter === 'all'
        ? sorted.length
        : (sorted.some((item) => item?.key === selectedThemeFilter) ? 1 : 0);
      let badge = toggle.querySelector('.notes-themes-toggle-count');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notes-themes-toggle-count';
        toggle.appendChild(badge);
      }
      badge.textContent = String(activeCount);
      badge.title = activeCount > 1 ? `${activeCount} thématiques actives` : `${activeCount} thématique active`;
    }

    return {
      bindDom,
      renderGlobalNotesThemeTabs
    };
  }

  global.TaskMDAMessageReactionsOutsideUI = {
    createModule
  };
}(window));

/* --- taskmda-global-group-channel-ui.js --- */
(function initTaskMdaGlobalGroupChannelUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaGlobalGroupChannelUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    // Builds the "group channel" select from:
    // - current user membership
    // - referential groups
    // - groups attached to public projects
    const opts = options || {};

    async function populateGlobalMessageGroupChannelSelect() {
      const select = document.getElementById('global-message-group-channel-select');
      if (!select) return;

      const me = String(opts.getCurrentUserId?.() || '').trim();
      if (!me) {
        select.innerHTML = '<option value="">-- Selectionner un groupe --</option>';
        return;
      }

      const allProjects = await opts.getAllProjects?.() || [];
      const publicProjectIds = new Set(
        allProjects
          .filter((project) => opts.normalizeProjectReadAccess?.(project?.readAccess) === 'public')
          .map((project) => project.projectId)
      );

      const visibleGroups = (opts.getGlobalGroupCatalog?.() || [])
        .filter((group) => {
          const memberIds = Array.isArray(group?.memberUserIds) ? group.memberUserIds : [];
          const isMember = memberIds.includes(me);
          const isFromReferentials = !group?.projectId;
          const isFromPublicProject = !!group?.projectId && publicProjectIds.has(group.projectId);
          return isMember || isFromReferentials || isFromPublicProject;
        })
        .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'fr'));

      const projectMap = new Map(allProjects.map((project) => [project.projectId, project.name]));
      const htmlOptions = visibleGroups.map((group) => {
        let label = opts.escapeHtml?.(group?.name || '') || '';
        if (group?.projectId && projectMap.has(group.projectId)) {
          label += ' (projet: ' + (opts.escapeHtml?.(projectMap.get(group.projectId)) || '') + ')';
        } else if (!group?.projectId) {
          label += ' (global)';
        }
        return '<option value="' + (opts.escapeHtml?.(group?.groupKey || '') || '') + '">' + label + '</option>';
      });

      select.innerHTML = [
        '<option value="">-- Selectionner un groupe --</option>',
        ...htmlOptions
      ].join('\n');
    }

    return {
      populateGlobalMessageGroupChannelSelect
    };
  }

  global.TaskMDAGlobalGroupChannelUI = {
    createModule
  };
}(window));

/* --- taskmda-doc-ref-actions-ui.js --- */
(function initTaskMdaDocRefActionsUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaDocRefActionsUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    // Delegated document reference actions:
    // handles [data-open-doc-ref] and [data-download-doc-ref] clicks.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.addEventListener('click', (event) => {
        const target = event?.target instanceof Element ? event.target.closest('[data-open-doc-ref]') : null;
        if (!(target instanceof HTMLElement)) return;
        event.preventDefault();
        event.stopPropagation();
        const ref = String(target.getAttribute('data-open-doc-ref') || '').trim();
        if (!ref) return;
        opts.openDocumentPreviewByRef?.(ref);
      });

      document.addEventListener('click', (event) => {
        const target = event?.target instanceof Element ? event.target.closest('[data-download-doc-ref]') : null;
        if (!(target instanceof HTMLElement)) return;
        event.preventDefault();
        event.stopPropagation();
        const ref = String(target.getAttribute('data-download-doc-ref') || '').trim();
        if (!ref) return;
        opts.downloadDocumentByRef?.(ref);
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDADocRefActionsUI = {
    createModule
  };
}(window));

