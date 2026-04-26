(function initTaskMdaGlobalNotesModule(global) {
  'use strict';

  function createModule(options) {
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
        helpers.showToast?.('Aucune note sélectionnée');
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
