/* TaskMDA Project Domain Bundle (manual, no-build) */
/* Consolidates taskmda-project-* UI modules + layout toggles */

/* --- taskmda-project-create-ui.js --- */
(function initTaskMdaProjectCreateUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectCreateUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('btn-create-project')?.addEventListener('click', async () => {
        await opts.openNewProjectModal?.();
      });

      document.getElementById('btn-cancel-project')?.addEventListener('click', () => {
        opts.closeNewProjectModal?.();
      });
      document.getElementById('btn-close-new-project')?.addEventListener('click', () => {
        opts.closeNewProjectModal?.();
      });

      document.getElementById('btn-add-project-group-preset')?.addEventListener('click', async () => {
        await opts.createGlobalGroupFromProjectCreateModal?.();
      });
      document.getElementById('project-group-preset-name-input')?.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        await opts.createGlobalGroupFromProjectCreateModal?.();
      });

      document.getElementById('project-sharing-mode-select')?.addEventListener('change', (e) => {
        const nextMode = String(e?.target?.value || '').trim() === 'shared' ? 'shared' : 'private';
        document.querySelectorAll('input[name="sharing-mode"]').forEach((radio) => {
          radio.checked = radio.value === nextMode;
        });
        opts.updateProjectCreateModeBadge?.(nextMode);
        const passphraseSection = document.getElementById('passphrase-section');
        if (passphraseSection) passphraseSection.classList.toggle('hidden', nextMode !== 'shared');
      });

      document.querySelectorAll('input[name="sharing-mode"]').forEach((radio) => {
        radio.addEventListener('change', (e) => {
          const sharingModeSelect = document.getElementById('project-sharing-mode-select');
          const passphraseSection = document.getElementById('passphrase-section');
          opts.updateProjectCreateModeBadge?.(e.target.value);
          if (sharingModeSelect) sharingModeSelect.value = e.target.value === 'shared' ? 'shared' : 'private';
          if (e.target.value === 'shared') {
            passphraseSection?.classList.remove('hidden');
          } else {
            passphraseSection?.classList.add('hidden');
          }
        });
      });

      document.getElementById('project-deadline-mode')?.addEventListener('change', (e) => {
        opts.setProjectDeadlineModeUi?.('project', e?.target?.value || 'date');
      });
      document.getElementById('edit-project-deadline-mode')?.addEventListener('change', (e) => {
        opts.setProjectDeadlineModeUi?.('edit-project', e?.target?.value || 'date');
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectCreateUI = {
    createModule
  };
}(window));

/* --- taskmda-project-edit-ui.js --- */
(function initTaskMdaProjectEditUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectEditUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('btn-cancel-edit-project')?.addEventListener('click', async () => {
        await opts.closeEditProjectModal?.();
      });

      document.getElementById('btn-save-edit-project')?.addEventListener('click', async () => {
        await opts.saveProjectEdits?.();
      });

      document.getElementById('edit-project-sharing-mode-select')?.addEventListener('change', (e) => {
        const nextMode = String(e?.target?.value || '').trim() === 'shared' ? 'shared' : 'private';
        opts.updateProjectEditSharingUi?.(nextMode);
        if (nextMode !== 'shared') {
          const editPassphraseInput = document.getElementById('edit-project-passphrase');
          if (editPassphraseInput) editPassphraseInput.value = '';
        }
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectEditUI = {
    createModule
  };
}(window));

/* --- taskmda-project-views-ui.js --- */
(function initTaskMdaProjectViewsUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectViewsUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('view-overview')?.addEventListener('click', () => opts.setProjectView?.('overview'));
      document.getElementById('view-cards')?.addEventListener('click', () => opts.setProjectTaskPresentationMode?.('cards'));
      document.getElementById('view-list')?.addEventListener('click', () => opts.setProjectTaskPresentationMode?.('list'));
      document.getElementById('view-kanban')?.addEventListener('click', () => opts.setProjectView?.('kanban'));
      document.getElementById('view-gantt')?.addEventListener('click', () => opts.setProjectView?.('gantt'));
      document.getElementById('view-timeline')?.addEventListener('click', () => opts.setProjectView?.('timeline'));
      document.getElementById('view-docs')?.addEventListener('click', () => opts.setProjectView?.('docs'));
      document.getElementById('view-notes')?.addEventListener('click', () => opts.setProjectView?.('notes'));
      document.getElementById('view-chat')?.addEventListener('click', () => opts.setProjectView?.('chat'));
      document.getElementById('view-archives')?.addEventListener('click', () => opts.setProjectView?.('archives'));

      document.getElementById('project-task-view-1')?.addEventListener('click', () => opts.setProjectTaskCardsColumns?.(1));
      document.getElementById('project-task-view-2')?.addEventListener('click', () => opts.setProjectTaskCardsColumns?.(2));
      document.getElementById('project-task-view-3')?.addEventListener('click', () => opts.setProjectTaskCardsColumns?.(3));
      document.getElementById('project-task-view-4')?.addEventListener('click', () => opts.setProjectTaskCardsColumns?.(4));
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectViewsUI = {
    createModule
  };
}(window));

/* --- taskmda-project-filters-ui.js --- */
(function initTaskMdaProjectFiltersUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectFiltersUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('project-task-search')?.addEventListener('input', () => {
        opts.rerenderProjectFilters?.();
      });

      document.getElementById('project-task-theme-filter')?.addEventListener('input', () => {
        opts.syncThemePickerSelectionFromInput?.('project-task-theme-known', 'project-task-theme-filter');
        opts.rerenderProjectFilters?.();
      });

      document.getElementById('project-task-status')?.addEventListener('change', () => {
        opts.rerenderProjectFilters?.();
      });

      document.getElementById('project-task-filter-feature')?.addEventListener('change', () => {
        opts.rerenderProjectFilters?.();
      });

      document.getElementById('project-task-theme-known')?.addEventListener('change', () => {
        opts.syncThemePickerInputFromSelection?.('project-task-theme-known', 'project-task-theme-filter');
        opts.rerenderProjectFilters?.();
      });

      document.getElementById('project-task-filter-epic')?.addEventListener('change', () => {
        opts.refreshProjectHierarchyTaskFilters?.(opts.getCurrentProjectState?.());
        opts.rerenderProjectFilters?.();
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectFiltersUI = {
    createModule
  };
}(window));

/* --- taskmda-project-notes-filters-ui.js --- */
(function initTaskMdaProjectNotesFiltersUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectNotesFiltersUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('project-notes-search')?.addEventListener('input', () => {
        const value = String(document.getElementById('project-notes-search')?.value || '').trim();
        opts.setProjectNotesSearchQuery?.(value);
        opts.renderProjectNotes?.(opts.getCurrentProjectState?.());
      });

      document.getElementById('project-notes-filter')?.addEventListener('change', () => {
        const value = String(document.getElementById('project-notes-filter')?.value || 'all').trim() || 'all';
        opts.setProjectNotesFilterMode?.(value);
        opts.renderProjectNotes?.(opts.getCurrentProjectState?.());
      });

      document.getElementById('project-notes-theme-tabs')?.addEventListener('click', (event) => {
        const btn = event?.target?.closest?.('[data-note-theme-tab]');
        if (!btn) return;
        const key = String(btn.getAttribute('data-note-theme-tab') || 'all').trim() || 'all';
        opts.setProjectNotesThemeFilter?.(key);
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectNotesFiltersUI = {
    createModule
  };
}(window));

/* --- taskmda-project-notes-actions-ui.js --- */
(function initTaskMdaProjectNotesActionsUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectNotesActionsUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('btn-project-note-new')?.addEventListener('click', () => {
        opts.openProjectNoteEditor?.('');
      });
      document.getElementById('btn-project-note-cancel')?.addEventListener('click', () => {
        opts.closeProjectNoteEditor?.();
      });
      document.getElementById('btn-close-project-note-modal')?.addEventListener('click', () => {
        opts.closeProjectNoteEditor?.();
      });
      document.getElementById('btn-close-project-note-read-modal')?.addEventListener('click', () => {
        opts.closeProjectNoteReadModal?.();
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectNotesActionsUI = {
    createModule
  };
}(window));

/* --- taskmda-project-read-actions-ui.js --- */
(function initTaskMdaProjectReadActionsUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectReadActionsUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function getCurrentNoteId() {
      return String(opts.getProjectNoteReadModalNoteId?.() || '').trim();
    }

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('btn-project-note-read-export-menu')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const menu = document.getElementById('project-note-read-export-dropdown');
        const btn = document.getElementById('btn-project-note-read-export-menu');
        if (!menu || !btn) return;
        const willOpen = menu.classList.contains('hidden');
        menu.classList.toggle('hidden', !willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });

      ['html', 'pdf', 'docx', 'txt'].forEach((format) => {
        document.getElementById('btn-project-note-export-' + format)?.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const noteId = getCurrentNoteId();
          if (!noteId) return;
          await opts.exportProjectNote?.(noteId, format);
        });
      });

      document.getElementById('btn-project-note-read-edit')?.addEventListener('click', () => {
        const noteId = String(document.getElementById('btn-project-note-read-edit')?.getAttribute('data-note-id') || '').trim();
        opts.openProjectNoteEditorFromReadModal?.(noteId);
      });

      document.getElementById('btn-project-note-read-delete')?.addEventListener('click', () => {
        const noteId = String(document.getElementById('btn-project-note-read-delete')?.getAttribute('data-note-id') || '').trim();
        if (!noteId) return;
        opts.deleteProjectNote?.(noteId);
      });

      document.getElementById('btn-note-selection-to-project')?.addEventListener('click', async () => {
        opts.hideProjectNoteSelectionMenu?.();
        const snippet = opts.normalizeProjectNoteSelectionSnippet?.(opts.getProjectNoteSelectionMenuPayload?.());
        if (!snippet?.text && !snippet?.html) {
          opts.showToast?.('Aucun texte selectionne');
          return;
        }
        await opts.appendProjectNoteSelectionToProjectDescription?.(snippet);
      });

      document.getElementById('btn-note-selection-copy')?.addEventListener('click', async () => {
        opts.hideProjectNoteSelectionMenu?.();
        const snippet = opts.normalizeProjectNoteSelectionSnippet?.(opts.getProjectNoteSelectionMenuPayload?.());
        if (!snippet?.text) {
          opts.showToast?.('Aucun texte selectionne');
          return;
        }
        const copied = await opts.copyTextToClipboard?.(snippet.text);
        opts.showToast?.(copied ? 'Texte copie' : 'Copie impossible');
      });

      document.getElementById('btn-note-selection-to-task')?.addEventListener('click', () => {
        opts.hideProjectNoteSelectionMenu?.();
        const payload = opts.getProjectNoteSelectionMenuPayload?.() || {};
        const snippet = opts.normalizeProjectNoteSelectionSnippet?.(payload);
        if (!snippet?.text && !snippet?.html) {
          opts.showToast?.('Aucun texte selectionne');
          return;
        }
        opts.openNoteSelectionTaskTargetModal?.(
          snippet,
          payload.noteId || getCurrentNoteId(),
          { copyMode: 'task' }
        );
      });

      document.getElementById('btn-note-selection-to-project-and-task')?.addEventListener('click', () => {
        opts.hideProjectNoteSelectionMenu?.();
        const payload = opts.getProjectNoteSelectionMenuPayload?.() || {};
        const snippet = opts.normalizeProjectNoteSelectionSnippet?.(payload);
        if (!snippet?.text && !snippet?.html) {
          opts.showToast?.('Aucun texte selectionne');
          return;
        }
        opts.openNoteSelectionTaskTargetModal?.(
          snippet,
          payload.noteId || getCurrentNoteId(),
          { copyMode: 'both' }
        );
      });

      document.getElementById('btn-close-note-selection-task-target')?.addEventListener('click', () => {
        opts.closeNoteSelectionTaskTargetModal?.();
      });
      document.getElementById('btn-cancel-note-selection-task-target')?.addEventListener('click', () => {
        opts.closeNoteSelectionTaskTargetModal?.();
      });
      document.getElementById('btn-confirm-note-selection-task-target')?.addEventListener('click', async () => {
        await opts.handleProjectNoteSelectionCopyToTask?.();
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectReadActionsUI = {
    createModule
  };
}(window));

/* --- taskmda-project-note-editor-actions-ui.js --- */
(function initTaskMdaProjectNoteEditorActionsUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectNoteEditorActionsUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('btn-project-note-fullscreen')?.addEventListener('click', () => {
        const current = !!opts.isProjectNoteModalFullscreen?.();
        opts.applyProjectNoteModalFullscreen?.(!current);
      });

      document.getElementById('btn-project-note-save')?.addEventListener('click', async () => {
        await opts.saveProjectNoteFromEditor?.();
      });

      document.getElementById('btn-project-note-digest')?.addEventListener('click', () => {
        const input = document.getElementById('project-note-digest-files');
        const chosenMode = opts.pickGlobalFeedDigestImportMode?.();
        if (chosenMode !== 'compact' && chosenMode !== 'full') return;
        if (input) input.dataset.importDigestView = chosenMode;
        input?.click();
      });

      document.getElementById('project-note-digest-files')?.addEventListener('change', async (event) => {
        const files = event?.target?.files;
        const digestView = String(event?.target?.dataset?.importDigestView || '').toLowerCase();
        await opts.importProjectNoteDigestFromFiles?.(files, { digestView });
        if (event?.target) {
          event.target.value = '';
          delete event.target.dataset.importDigestView;
        }
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectNoteEditorActionsUI = {
    createModule
  };
}(window));

/* --- taskmda-project-read-inline-ui.js --- */
(function initTaskMdaProjectReadInlineUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectReadInlineUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      const projectNoteReadModal = document.getElementById('modal-project-note-read');
      if (projectNoteReadModal && projectNoteReadModal.dataset.readShortcutsBound !== '1') {
        projectNoteReadModal.dataset.readShortcutsBound = '1';
        projectNoteReadModal.addEventListener('keydown', async (event) => {
          if (projectNoteReadModal.classList.contains('hidden')) return;
          const key = String(event.key || '').toLowerCase();
          if ((event.ctrlKey || event.metaKey) && key === 's') {
            event.preventDefault();
            await opts.saveProjectNoteReadInlineEdit?.();
            return;
          }
          if (opts.isProjectNoteReadInlineEditActive?.() && key === 'enter' && event.target?.id === 'project-note-read-title') {
            event.preventDefault();
            await opts.saveProjectNoteReadInlineEdit?.();
            return;
          }
          if (key === 'escape') {
            event.preventDefault();
            event.stopPropagation();
            if (opts.isProjectNoteReadInlineEditActive?.()) {
              opts.cancelProjectNoteReadInlineEdit?.();
              return;
            }
            opts.hideProjectNoteSelectionMenu?.();
            opts.closeNoteSelectionTaskTargetModal?.();
            opts.closeProjectNoteReadModal?.();
          }
        });
      }

      document.getElementById('project-note-read-title')?.addEventListener('click', () => {
        opts.beginProjectNoteReadInlineEdit?.('title');
      });
      document.getElementById('project-note-read-content')?.addEventListener('click', () => {
        opts.beginProjectNoteReadInlineEdit?.('content');
      });
      document.getElementById('project-note-read-title')?.addEventListener('blur', async () => {
        if (!opts.isProjectNoteReadInlineEditActive?.()) return;
        setTimeout(async () => {
          const activeId = String(document.activeElement?.id || '');
          if (activeId === 'project-note-read-title' || activeId === 'project-note-read-content') return;
          await opts.saveProjectNoteReadInlineEdit?.({ silent: true });
        }, 0);
      });
      document.getElementById('project-note-read-content')?.addEventListener('blur', async () => {
        if (!opts.isProjectNoteReadInlineEditActive?.()) return;
        setTimeout(async () => {
          const activeId = String(document.activeElement?.id || '');
          if (activeId === 'project-note-read-title' || activeId === 'project-note-read-content') return;
          await opts.saveProjectNoteReadInlineEdit?.({ silent: true });
        }, 0);
      });

      document.getElementById('project-note-read-content')?.addEventListener('contextmenu', (event) => {
        if (opts.isProjectNoteReadInlineEditActive?.()) return;
        const snippet = opts.getProjectNoteReadSelectedSnippet?.();
        if (!snippet?.text && !snippet?.html) {
          opts.hideProjectNoteSelectionMenu?.();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        opts.showProjectNoteSelectionMenu?.(event.clientX, event.clientY, {
          text: snippet.text,
          html: snippet.html,
          noteId: opts.getProjectNoteReadModalNoteId?.()
        });
      });

      document.addEventListener('pointerdown', (event) => {
        const menu = document.getElementById('project-note-selection-menu');
        if (!menu || menu.classList.contains('hidden')) return;
        const target = event.target;
        if (target instanceof Node && menu.contains(target)) return;
        opts.hideProjectNoteSelectionMenu?.();
      });

      document.addEventListener('scroll', () => {
        opts.hideProjectNoteSelectionMenu?.();
      }, true);
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectReadInlineUI = {
    createModule
  };
}(window));

/* --- taskmda-project-note-modal-shortcuts-ui.js --- */
(function initTaskMdaProjectNoteModalShortcutsUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectNoteModalShortcutsUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      const projectNoteModal = document.getElementById('modal-project-note');
      if (projectNoteModal && projectNoteModal.dataset.noteShortcutsBound !== '1') {
        projectNoteModal.dataset.noteShortcutsBound = '1';
        projectNoteModal.addEventListener('keydown', (event) => {
          if (projectNoteModal.classList.contains('hidden')) return;
          const key = String(event.key || '').toLowerCase();
          if ((event.ctrlKey || event.metaKey) && key === 's') {
            event.preventDefault();
            opts.saveProjectNoteFromEditor?.();
            return;
          }
          if (key === 'escape') {
            event.preventDefault();
            event.stopPropagation();
            opts.closeProjectNoteEditor?.();
            return;
          }
          opts.trapProjectNoteModalFocus?.(event);
        });
      }
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectNoteModalShortcutsUI = {
    createModule
  };
}(window));

/* --- taskmda-layout-toggles-ui.js --- */
(function initTaskMdaLayoutTogglesUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaLayoutTogglesUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('btn-project-subnav-horizontal')?.addEventListener('click', () => {
        opts.setProjectSubnavLayout?.('horizontal');
      });
      document.getElementById('btn-project-subnav-vertical')?.addEventListener('click', () => {
        opts.setProjectSubnavLayout?.('vertical');
      });
      document.getElementById('btn-project-settings-subnav-horizontal')?.addEventListener('click', () => {
        opts.setProjectSubnavLayout?.('horizontal');
      });
      document.getElementById('btn-project-settings-subnav-vertical')?.addEventListener('click', () => {
        opts.setProjectSubnavLayout?.('vertical');
      });

      document.getElementById('btn-project-work-focus')?.addEventListener('click', () => {
        opts.toggleProjectWorkFocus?.();
      });
      document.getElementById('btn-project-settings-work-focus')?.addEventListener('click', () => {
        opts.toggleProjectSettingsFocus?.();
      });

      [1, 2, 3, 4].forEach((columns) => {
        document.getElementById('global-task-view-' + columns)?.addEventListener('click', () => {
          opts.setGlobalTaskCardsColumns?.(columns);
        });
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDALayoutTogglesUI = {
    createModule
  };
}(window));

/* --- taskmda-project-nav-ui.js --- */
(function initTaskMdaProjectNavUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectNavUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('view-activity')?.addEventListener('click', async () => {
        if (!opts.canReadProjectActivity?.(opts.getCurrentProjectState?.())) {
          opts.showToast?.('Action non autorisee');
          opts.setProjectView?.('list');
          return;
        }
        opts.setProjectView?.('activity');
        const projectId = String(opts.getCurrentProjectId?.() || '').trim();
        if (!projectId) return;
        opts.setActivityPage?.(1);
        const events = await opts.getProjectEvents?.(projectId);
        opts.setCurrentProjectEvents?.(events);
        await opts.renderActivity?.(events);
      });

      const orderedViews = ['overview', 'kanban', 'cards', 'list', 'gantt', 'timeline', 'notes', 'chat', 'docs', 'activity', 'archives'];
      orderedViews.forEach((viewKey, idx) => {
        const btn = document.getElementById('view-' + viewKey);
        if (!btn) return;
        btn.addEventListener('keydown', (event) => {
          const isVertical = opts.getProjectSubnavLayout?.() === 'vertical';
          const prevKeyPressed = event.key === 'ArrowLeft' || (isVertical && event.key === 'ArrowUp');
          const nextKeyPressed = event.key === 'ArrowRight' || (isVertical && event.key === 'ArrowDown');
          if (!prevKeyPressed && !nextKeyPressed) return;
          event.preventDefault();
          const nextIdx = nextKeyPressed
            ? (idx + 1) % orderedViews.length
            : (idx - 1 + orderedViews.length) % orderedViews.length;
          let nextKey = orderedViews[nextIdx];
          if (nextKey === 'activity' && !opts.canReadProjectActivity?.(opts.getCurrentProjectState?.())) {
            nextKey = 'cards';
          }
          const nextBtn = document.getElementById('view-' + nextKey);
          if (!nextBtn) return;
          nextBtn.focus();
          if (nextKey === 'cards' || nextKey === 'list') {
            opts.setProjectTaskPresentationMode?.(nextKey);
            return;
          }
          opts.setProjectView?.(nextKey);
        });
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectNavUI = {
    createModule
  };
}(window));

/* --- taskmda-project-calendar-timeline-ui.js --- */
(function initTaskMdaProjectCalendarTimelineUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectCalendarTimelineUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function rerender() {
      const tasks = opts.getCurrentProjectTasks?.() || [];
      opts.renderCalendar?.(tasks);
      opts.renderTimeline?.(tasks);
    }

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('timeline-filter-all')?.addEventListener('click', () => {
        opts.setTimelineFilter?.('all');
        opts.renderTimeline?.(opts.getCurrentProjectTasks?.() || []);
      });
      document.getElementById('timeline-filter-milestone')?.addEventListener('click', () => {
        opts.setTimelineFilter?.('milestone');
        opts.renderTimeline?.(opts.getCurrentProjectTasks?.() || []);
      });
      document.getElementById('timeline-filter-urgent')?.addEventListener('click', () => {
        opts.setTimelineFilter?.('urgent');
        opts.renderTimeline?.(opts.getCurrentProjectTasks?.() || []);
      });
      document.getElementById('timeline-filter-overdue')?.addEventListener('click', () => {
        opts.setTimelineFilter?.('overdue');
        opts.renderTimeline?.(opts.getCurrentProjectTasks?.() || []);
      });

      document.getElementById('calendar-view-month')?.addEventListener('click', () => {
        opts.setProjectCalendarViewMode?.('month');
        opts.setCalendarDayFilterEnabled?.(false);
        rerender();
      });
      document.getElementById('calendar-view-year')?.addEventListener('click', () => {
        opts.setProjectCalendarViewMode?.('year');
        opts.setCalendarDayFilterEnabled?.(false);
        rerender();
      });

      document.getElementById('calendar-prev-month')?.addEventListener('click', () => {
        const currentCursor = opts.getCalendarCursor?.() || new Date();
        const mode = opts.getProjectCalendarViewMode?.() || 'month';
        const nextCursor = mode === 'year'
          ? new Date(currentCursor.getFullYear() - 1, currentCursor.getMonth(), 1)
          : new Date(currentCursor.getFullYear(), currentCursor.getMonth() - 1, 1);
        opts.setCalendarCursor?.(nextCursor);
        opts.setCalendarDayFilterEnabled?.(false);
        rerender();
      });
      document.getElementById('calendar-next-month')?.addEventListener('click', () => {
        const currentCursor = opts.getCalendarCursor?.() || new Date();
        const mode = opts.getProjectCalendarViewMode?.() || 'month';
        const nextCursor = mode === 'year'
          ? new Date(currentCursor.getFullYear() + 1, currentCursor.getMonth(), 1)
          : new Date(currentCursor.getFullYear(), currentCursor.getMonth() + 1, 1);
        opts.setCalendarCursor?.(nextCursor);
        opts.setCalendarDayFilterEnabled?.(false);
        rerender();
      });
      document.getElementById('calendar-today')?.addEventListener('click', () => {
        const now = new Date();
        opts.setCalendarCursor?.(now);
        opts.setSelectedCalendarDayKey?.(opts.toYmd?.(now));
        opts.setCalendarDayFilterEnabled?.(false);
        rerender();
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectCalendarTimelineUI = {
    createModule
  };
}(window));

/* --- taskmda-project-notes.js --- */

(function initTaskMDAProjectNotesModule(global) {
  // Module role: UI/domain boundary for TaskMDAProjectNotesModule.
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeSearch(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function formatDateTime(ts) {
    const safeTs = Number(ts || 0);
    if (!safeTs) return '-';
    return new Date(safeTs).toLocaleString('fr-FR');
  }

  function parseTagsInput(raw) {
    return Array.from(new Set(
      String(raw || '')
        .split(/[,;\n]/g)
        .map((tag) => tag.trim())
        .filter(Boolean)
    ));
  }

  function stringifyTags(tags) {
    return (Array.isArray(tags) ? tags : [])
      .map((tag) => String(tag || '').trim())
      .filter(Boolean)
      .join(', ');
  }

  function matchByMode(note, mode, currentUserId) {
    const key = String(mode || 'all').trim();
    if (key === 'archived') return Number(note?.archivedAt || 0) > 0;
    if (Number(note?.archivedAt || 0) > 0) return false;
    if (key === 'pinned') return Number(note?.pinnedAt || 0) > 0;
    if (key === 'mine') return String(note?.createdBy || '') === String(currentUserId || '');
    if (key === 'linked') return Array.isArray(note?.linkedTaskIds) && note.linkedTaskIds.length > 0;
    if (key === 'published') return !!note?.shareToGlobalFeed;
    return true;
  }

  function buildUnifiedCardHtml(note, ctx) {
    const tags = Array.isArray(note.tags) ? note.tags : [];
    const linkedTaskIds = Array.isArray(note.linkedTaskIds) ? note.linkedTaskIds : [];
    const linkedDocsCount = Number((ctx.noteDocsCountById instanceof Map ? ctx.noteDocsCountById.get(String(note.noteId || '')) : 0) || 0);
    const taskLabels = linkedTaskIds
      .map((taskId) => ctx.taskTitleById.get(String(taskId || '').trim()))
      .filter(Boolean);
    const canManage = !!ctx.canManageById.get(String(note.noteId || ''));
    const isFocused = String(ctx.focusNoteId || '') === String(note.noteId || '');
    const isArchived = Number(note.archivedAt || 0) > 0;
    const noteId = String(note.noteId || '');
    const cardIdPrefix = String(ctx.cardIdPrefix || 'project-note');
    const openFn = String(ctx.openFn || 'openProjectNoteReadModal');
    const actionsHtml = canManage
      ? (typeof ctx.actionsRenderer === 'function'
          ? String(ctx.actionsRenderer(note, { canManage, isArchived, linkedDocsCount, linkedTaskIdsCount: linkedTaskIds.length }) || '')
          : '')
      : '';

    return `
      <article
        id="${escapeHtml(`${cardIdPrefix}-${noteId}`)}"
        class="rounded-xl border ${isFocused ? 'border-blue-400 shadow-[0_0_0_2px_rgba(59,130,246,0.14)]' : 'border-slate-200'} bg-white p-4 cursor-pointer"
        onclick="${escapeHtml(openFn)}('${escapeHtml(noteId)}')"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              ${isArchived ? '<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-slate-200 text-slate-700 font-semibold">Archivee</span>' : ''}
              ${Number(note.pinnedAt || 0) > 0 ? '<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">Epinglee</span>' : ''}
              ${note.shareToGlobalFeed ? '<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">Fil transverse</span>' : ''}
              ${Number(note.favoriteAt || 0) > 0 ? '<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">Favori</span>' : ''}
              ${linkedTaskIds.length > 0 ? `<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">${linkedTaskIds.length} tache(s) liee(s)</span>` : ''}
              ${linkedDocsCount > 0 ? `<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-semibold">${linkedDocsCount} document(s) lie(s)</span>` : ''}
            </div>
            <h4 class="mt-2 text-base font-bold text-slate-800">${escapeHtml(note.title || 'Note sans titre')}</h4>
            <p class="mt-1 text-xs text-slate-500">${escapeHtml(String(ctx.authorById.get(String(note.createdBy || '')) || note.createdByName || 'Auteur'))} • ${escapeHtml(formatDateTime(note.createdAt))}</p>
          </div>
          ${actionsHtml ? `<div class="flex items-center gap-1" onclick="event.stopPropagation();">${actionsHtml}</div>` : ''}
        </div>
        ${tags.length ? `<div class="mt-3 flex flex-wrap gap-1">${tags.map((tag) => `<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">#${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        ${(ctx.showTaskLinks !== false && taskLabels.length) ? `<p class="mt-2 text-xs text-slate-500">Liens taches: ${escapeHtml(taskLabels.join(' • '))}</p>` : ''}
      </article>
    `;
  }

  function defaultProjectActionsRenderer(note, ctx = {}) {
    const noteId = escapeHtml(String(note.noteId || ''));
    if (ctx.isArchived) {
      return `<button type="button" class="workspace-action-inline" onclick="restoreProjectNote('${noteId}')" data-action-kind="unarchive">Restaurer</button>`;
    }
    return `
      <button type="button" class="workspace-action-inline" onclick="openProjectNoteEditor('${noteId}')" data-action-kind="edit">Editer</button>
      <button type="button" class="workspace-action-inline" onclick="toggleProjectNotePinned('${noteId}')" data-action-kind="manage">${Number(note.pinnedAt || 0) > 0 ? 'Desepingler' : 'Epingler'}</button>
      <button type="button" class="workspace-action-inline" onclick="toggleProjectNoteFeedPublish('${noteId}')" data-action-kind="notify">${note.shareToGlobalFeed ? 'Retirer fil' : 'Publier fil'}</button>
      <div class="relative inline-block">
        <button type="button" class="workspace-action-inline" onclick="toggleProjectNoteExportMenu('${noteId}', event)" data-action-kind="export" aria-haspopup="true" aria-expanded="false" id="project-note-export-menu-btn-${noteId}">
          Exporter
        </button>
        <div id="project-note-export-menu-${noteId}" class="hidden absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden" role="menu" onclick="event.stopPropagation();">
          <button type="button" class="export-menu-item w-full text-left px-3 py-2 text-sm hover:bg-slate-50" onclick="exportProjectNote('${noteId}', 'html'); closeProjectNoteExportMenu('${noteId}');" role="menuitem">Exporter HTML</button>
          <button type="button" class="export-menu-item w-full text-left px-3 py-2 text-sm hover:bg-slate-50" onclick="exportProjectNote('${noteId}', 'pdf'); closeProjectNoteExportMenu('${noteId}');" role="menuitem">Exporter PDF</button>
          <button type="button" class="export-menu-item w-full text-left px-3 py-2 text-sm hover:bg-slate-50" onclick="exportProjectNote('${noteId}', 'docx'); closeProjectNoteExportMenu('${noteId}');" role="menuitem">Exporter DOCX</button>
          <button type="button" class="export-menu-item w-full text-left px-3 py-2 text-sm hover:bg-slate-50" onclick="exportProjectNote('${noteId}', 'txt'); closeProjectNoteExportMenu('${noteId}');" role="menuitem">Exporter TXT</button>
        </div>
      </div>
      <button type="button" class="workspace-action-inline" onclick="convertProjectNoteToTask('${noteId}')" data-action-kind="convert">En tache</button>
      <button type="button" class="workspace-action-inline" onclick="archiveProjectNote('${noteId}')" data-action-kind="archive">Archiver</button>
      <button type="button" class="workspace-action-inline" onclick="deleteProjectNote('${noteId}')" data-action-kind="danger">Supprimer</button>
    `;
  }

  function renderUnifiedNotesList(container, options = {}) {
    if (!container) return { total: 0, visible: 0 };
    const notes = Array.isArray(options.notes) ? options.notes : [];
    const mode = String(options.mode || 'all').trim();
    const query = normalizeSearch(options.query || '');
    const currentUserId = String(options.currentUserId || '');
    const taskTitleById = options.taskTitleById instanceof Map ? options.taskTitleById : new Map();
    const authorById = options.authorById instanceof Map ? options.authorById : new Map();
    const canManageById = options.canManageById instanceof Map ? options.canManageById : new Map();
    const noteDocsCountById = options.noteDocsCountById instanceof Map ? options.noteDocsCountById : new Map();
    const focusNoteId = String(options.focusNoteId || '');

    const visible = notes
      .filter((note) => matchByMode(note, mode, currentUserId))
      .filter((note) => {
        if (!query) return true;
        const blob = normalizeSearch([
          note.title,
          note.content,
          ...(Array.isArray(note.tags) ? note.tags : []),
          ...(Array.isArray(note.linkedTaskIds) ? note.linkedTaskIds : []).map((id) => taskTitleById.get(String(id || '').trim()) || '')
        ].join(' '));
        return blob.includes(query);
      })
      .sort((a, b) => {
        if (mode === 'archived') {
          return Number(b.archivedAt || b.updatedAt || b.createdAt || 0) - Number(a.archivedAt || a.updatedAt || a.createdAt || 0);
        }
        const pinDiff = Number(b.pinnedAt || 0) - Number(a.pinnedAt || 0);
        if (pinDiff !== 0) return pinDiff;
        return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0);
      });

    if (!visible.length) {
      container.innerHTML = `
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
          ${escapeHtml(String(options.emptyText || 'Aucune note pour ces criteres.'))}
        </div>
      `;
      return { total: notes.length, visible: 0 };
    }

    container.innerHTML = visible.map((note) => buildUnifiedCardHtml(note, {
      taskTitleById,
      authorById,
      canManageById,
      noteDocsCountById,
      focusNoteId,
      cardIdPrefix: options.cardIdPrefix || 'project-note',
      openFn: options.openFn || 'openProjectNoteReadModal',
      actionsRenderer: options.actionsRenderer,
      showTaskLinks: options.showTaskLinks
    })).join('');
    return { total: notes.length, visible: visible.length };
  }

  function renderProjectNotesList(container, options = {}) {
    return renderUnifiedNotesList(container, {
      ...options,
      cardIdPrefix: 'project-note',
      openFn: 'openProjectNoteReadModal',
      actionsRenderer: typeof options.actionsRenderer === 'function' ? options.actionsRenderer : defaultProjectActionsRenderer,
      showTaskLinks: options.showTaskLinks !== false
    });
  }

  global.TaskMDAProjectNotes = {
    parseTagsInput,
    stringifyTags,
    renderProjectNotesList,
    renderUnifiedNotesList
  };
}(window));

/* --- taskmda-projects-ui.js --- */

(function initTaskMdaProjectsUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectsUiModule.
  'use strict';

  function bind(options) {
    const opts = options || {};
    if (global.__taskMdaProjectsUiBound) return;
    global.__taskMdaProjectsUiBound = true;

    const getProjectsFilters = () => (typeof opts.getProjectsFilters === 'function' ? opts.getProjectsFilters() : {});
    const setProjectsFilters = (next) => {
      if (typeof opts.setProjectsFilters === 'function') opts.setProjectsFilters(next);
    };

    const setProjectsPage = (value) => {
      if (typeof opts.setProjectsPage === 'function') opts.setProjectsPage(value);
    };

    const setGlobalTasksPage = (value) => {
      if (typeof opts.setGlobalTasksPage === 'function') opts.setGlobalTasksPage(value);
    };

    const setGlobalTasksViewMode = (value) => {
      if (typeof opts.setGlobalTasksViewMode === 'function') opts.setGlobalTasksViewMode(value);
    };

    const setTasksPage = (value) => {
      if (typeof opts.setTasksPage === 'function') opts.setTasksPage(value);
    };

    const rerenderDashboardProjectsFromFilters = async () => {
      setProjectsPage(1);
      await opts.renderProjects?.();
    };

    document.getElementById('btn-back-to-dashboard')?.addEventListener('click', async () => {
      await opts.showProjectsWorkspace?.();
    });

    document.getElementById('nav-projects')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await opts.showProjectsWorkspace?.();
      opts.closeMobileSidebar?.();
    });

    document.getElementById('projects-view-grid')?.addEventListener('click', async () => {
      await opts.setProjectsViewMode?.('grid');
    });

    document.getElementById('projects-view-list')?.addEventListener('click', async () => {
      await opts.setProjectsViewMode?.('list');
    });

    document.getElementById('projects-filter-query')?.addEventListener('input', async () => {
      const next = { ...getProjectsFilters(), query: String(document.getElementById('projects-filter-query')?.value || '') };
      setProjectsFilters(next);
      await rerenderDashboardProjectsFromFilters();
    });

    document.getElementById('projects-filter-theme-known')?.addEventListener('change', async () => {
      const value = String(document.getElementById('projects-filter-theme-known')?.value || '').trim();
      const next = { ...getProjectsFilters(), theme: value };
      setProjectsFilters(next);
      await rerenderDashboardProjectsFromFilters();
    });

    document.getElementById('projects-filter-priority')?.addEventListener('change', async () => {
      const next = { ...getProjectsFilters(), priority: String(document.getElementById('projects-filter-priority')?.value || 'all') };
      setProjectsFilters(next);
      await rerenderDashboardProjectsFromFilters();
    });

    document.getElementById('projects-filter-status')?.addEventListener('change', async () => {
      const next = { ...getProjectsFilters(), status: String(document.getElementById('projects-filter-status')?.value || 'all') };
      setProjectsFilters(next);
      await rerenderDashboardProjectsFromFilters();
    });

    document.getElementById('projects-filter-sharing')?.addEventListener('change', async () => {
      const next = { ...getProjectsFilters(), sharing: String(document.getElementById('projects-filter-sharing')?.value || 'all') };
      setProjectsFilters(next);
      await rerenderDashboardProjectsFromFilters();
    });

    document.getElementById('projects-filter-ownership')?.addEventListener('change', async () => {
      const next = { ...getProjectsFilters(), ownership: String(document.getElementById('projects-filter-ownership')?.value || 'all') };
      setProjectsFilters(next);
      await rerenderDashboardProjectsFromFilters();
    });

    document.getElementById('projects-filter-sort')?.addEventListener('change', async () => {
      const next = { ...getProjectsFilters(), sort: String(document.getElementById('projects-filter-sort')?.value || 'recent') };
      setProjectsFilters(next);
      await rerenderDashboardProjectsFromFilters();
    });

    document.getElementById('projects-filter-reset')?.addEventListener('click', async () => {
      setProjectsFilters({ query: '', theme: '', priority: 'all', status: 'all', sharing: 'all', ownership: 'all', sort: 'recent' });
      opts.syncProjectsFilterControls?.();
      await rerenderDashboardProjectsFromFilters();
    });

    document.getElementById('nav-tasks')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await opts.showGlobalWorkspace?.('tasks');
      opts.closeMobileSidebar?.();
    });

    document.getElementById('global-task-search')?.addEventListener('input', () => {
      setGlobalTasksPage(1);
      opts.renderGlobalTasks?.();
    });

    document.getElementById('global-task-status')?.addEventListener('change', () => {
      setGlobalTasksPage(1);
      opts.renderGlobalTasks?.();
    });

    document.getElementById('global-task-assignee-kind')?.addEventListener('change', () => {
      setGlobalTasksPage(1);
      opts.renderGlobalTasks?.();
    });

    document.getElementById('global-task-theme-known')?.addEventListener('change', () => {
      setGlobalTasksPage(1);
      opts.renderGlobalTasks?.();
    });

    const updateGlobalTaskUrgencyToggleState = () => {
      const toggle = document.getElementById('global-task-urgency-toggle');
      if (!toggle) return;
      const checks = Array.from(document.querySelectorAll('input[data-global-task-urgency]'));
      const checkedCount = checks.filter((input) => input instanceof HTMLInputElement && input.checked).length;
      const totalCount = checks.length || 3;
      const label = checkedCount === totalCount
        ? 'Filtrer par urgence'
        : `Filtrer par urgence (${checkedCount}/${totalCount})`;
      toggle.setAttribute('data-ui-tooltip', label);
      toggle.setAttribute('aria-label', label);
    };

    const setGlobalTaskUrgencyPanelOpen = (open) => {
      const panel = document.getElementById('global-task-urgency-panel');
      const toggle = document.getElementById('global-task-urgency-toggle');
      if (!panel || !toggle) return;
      panel.classList.toggle('hidden', !open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    document.getElementById('global-task-urgency-toggle')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const panel = document.getElementById('global-task-urgency-panel');
      const isOpen = panel ? !panel.classList.contains('hidden') : false;
      setGlobalTaskUrgencyPanelOpen(!isOpen);
    });

    document.getElementById('global-task-urgency-panel')?.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    Array.from(document.querySelectorAll('input[data-global-task-urgency]')).forEach((input) => {
      input.addEventListener('change', () => {
        const checks = Array.from(document.querySelectorAll('input[data-global-task-urgency]'));
        const checked = checks.filter((item) => item instanceof HTMLInputElement && item.checked);
        if (checked.length === 0 && input instanceof HTMLInputElement) {
          input.checked = true;
        }
        updateGlobalTaskUrgencyToggleState();
        setGlobalTasksPage(1);
        opts.renderGlobalTasks?.();
      });
    });

    document.addEventListener('click', () => {
      setGlobalTaskUrgencyPanelOpen(false);
    });

    updateGlobalTaskUrgencyToggleState();

    document.getElementById('global-task-filter-reset')?.addEventListener('click', () => {
      const searchInput = document.getElementById('global-task-search');
      const statusInput = document.getElementById('global-task-status');
      const assigneeKindInput = document.getElementById('global-task-assignee-kind');
      const knownThemeInput = document.getElementById('global-task-theme-known');
      const urgencyChecks = Array.from(document.querySelectorAll('input[data-global-task-urgency]'));
      if (searchInput) searchInput.value = '';
      if (statusInput) statusInput.value = 'all';
      if (assigneeKindInput) assigneeKindInput.value = 'all';
      if (knownThemeInput) knownThemeInput.value = '';
      urgencyChecks.forEach((input) => {
        if (input instanceof HTMLInputElement) input.checked = true;
      });
      setGlobalTaskUrgencyPanelOpen(false);
      updateGlobalTaskUrgencyToggleState();
      setGlobalTasksPage(1);
      opts.renderGlobalTasks?.();
    });

    const rerenderProjectTasksFromFilters = () => {
      if (!opts.isProjectWorkspace?.()) return;
      const currentProjectState = opts.getCurrentProjectState?.();
      if (!currentProjectState) return;
      setTasksPage(1);
      const visibleTasks = (currentProjectState.tasks || []).filter((t) => !t.archivedAt);
      opts.renderTasks?.(visibleTasks);
      opts.renderKanban?.(visibleTasks);
      opts.renderGantt?.(visibleTasks);
      opts.renderTimeline?.(visibleTasks);
    };

    document.getElementById('project-task-search')?.addEventListener('input', rerenderProjectTasksFromFilters);
    document.getElementById('project-task-status')?.addEventListener('change', rerenderProjectTasksFromFilters);
    document.getElementById('project-task-assignee-kind')?.addEventListener('change', rerenderProjectTasksFromFilters);
    document.getElementById('project-task-theme-filter')?.addEventListener('input', () => {
      opts.syncThemePickerSelectionFromInput?.('project-task-theme-known', 'project-task-theme-filter');
      rerenderProjectTasksFromFilters();
    });

    document.getElementById('project-task-theme-known')?.addEventListener('change', () => {
      const value = String(document.getElementById('project-task-theme-known')?.value || '');
      const input = document.getElementById('project-task-theme-filter');
      if (input) input.value = value;
      rerenderProjectTasksFromFilters();
    });

    function bindGlobalTaskViewButton(buttonId, mode, inlineCalendar) {
      document.getElementById(buttonId)?.addEventListener('click', async () => {
        const nextMode = opts.resolveViewWithLock?.('globalTasks', mode, 'cards') || mode;
        setGlobalTasksViewMode(nextMode);
        localStorage.setItem('taskmda_global_tasks_view', nextMode);
        opts.toggleGlobalTasksInlineCalendar?.(inlineCalendar);
        if (!inlineCalendar) setGlobalTasksPage(1);
        opts.trackUxMetric?.('switchGlobalTasksView');
        await opts.renderGlobalTasks?.();
        if (inlineCalendar || mode === 'archives') {
          opts.updateGlobalTasksViewButtons?.();
        }
      });
    }

    bindGlobalTaskViewButton('global-tasks-view-cards', 'cards', false);
    bindGlobalTaskViewButton('global-tasks-view-list', 'list', false);
    bindGlobalTaskViewButton('global-tasks-view-kanban', 'kanban', false);
    bindGlobalTaskViewButton('global-tasks-view-timeline', 'timeline', false);
    bindGlobalTaskViewButton('global-tasks-view-calendar', 'calendar', true);
    bindGlobalTaskViewButton('global-tasks-view-archives', 'archives', false);
  }

  global.TaskMDAProjectsUI = {
    bind
  };
}(window));

/* --- taskmda-projects-toolbar-height.js --- */

(function initTaskMdaProjectsToolbarHeightModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectsToolbarHeightModule.
  'use strict';

  const TARGET_SELECTORS = [
    '#projects-toolbar-actions > button',
    '#projects-view-controls > button',
    '.projects-filter-search-wrap',
    '.projects-filter-controls-row select',
    '.projects-filter-reset-btn'
  ];

  let resizeObserver = null;
  let mutationObserver = null;
  let rafId = 0;
  let bound = false;

  function getProjectsRoot() {
    return document.getElementById('projects-list');
  }

  function getAddButton() {
    return document.getElementById('btn-projects-add');
  }

  function resolveReferenceHeight(addBtn) {
    if (!addBtn) return 44;
    const rectHeight = Math.round(addBtn.getBoundingClientRect().height || 0);
    if (rectHeight > 0) return rectHeight;
    const cssHeight = parseFloat(global.getComputedStyle(addBtn).height || '0');
    if (Number.isFinite(cssHeight) && cssHeight > 0) return Math.round(cssHeight);
    return 44;
  }

  function applyHeight(heightPx) {
    const root = getProjectsRoot();
    if (!root) return;

    root.style.setProperty('--projects-controls-height', `${heightPx}px`);
    root.dataset.projectsControlsHeight = String(heightPx);

    for (let i = 0; i < TARGET_SELECTORS.length; i += 1) {
      const nodes = root.querySelectorAll(TARGET_SELECTORS[i]);
      for (let j = 0; j < nodes.length; j += 1) {
        const node = nodes[j];
        node.style.setProperty('height', `${heightPx}px`, 'important');
        node.style.setProperty('min-height', `${heightPx}px`, 'important');
      }
    }
  }

  function syncNow() {
    const addBtn = getAddButton();
    if (!addBtn) return;
    const height = resolveReferenceHeight(addBtn);
    applyHeight(height);
  }

  function scheduleSync() {
    if (rafId) return;
    rafId = global.requestAnimationFrame(() => {
      rafId = 0;
      syncNow();
    });
  }

  function bind() {
    if (bound) return;
    bound = true;

    syncNow();
    global.setTimeout(syncNow, 0);
    global.setTimeout(syncNow, 120);

    global.addEventListener('resize', scheduleSync, { passive: true });
    document.getElementById('nav-projects')?.addEventListener('click', scheduleSync);
    document.getElementById('sidebar-create-project')?.addEventListener('click', scheduleSync);

    const addBtn = getAddButton();
    if (addBtn && global.ResizeObserver) {
      resizeObserver = new global.ResizeObserver(scheduleSync);
      resizeObserver.observe(addBtn);
    }

    if (global.MutationObserver) {
      mutationObserver = new global.MutationObserver(scheduleSync);
      mutationObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-wf-action-buttons', 'data-wf-action-shape']
      });
      const root = getProjectsRoot();
      if (root) {
        mutationObserver.observe(root, {
          attributes: true,
          attributeFilter: ['class', 'style']
        });
      }
    }
  }

  global.TaskMDAProjectsToolbarHeight = {
    bind,
    syncNow
  };
}(window));

/* --- taskmda-project-composer-ui.js --- */
(function initTaskMdaProjectComposerUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectComposerUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('message-input')?.addEventListener('input', () => {
        const currentTimer = opts.getMessageMarkdownDebounceTimer?.();
        if (currentTimer) clearTimeout(currentTimer);
        const nextTimer = setTimeout(() => {
          const current = opts.getDiscussionInputPlainText?.(document.getElementById('message-input'));
          const rendered = opts.renderSafeMarkdown?.(current);
          opts.setMessageRenderedDraftHtml?.(rendered);
        }, 280);
        opts.setMessageMarkdownDebounceTimer?.(nextTimer);
      });

      document.getElementById('message-input')?.addEventListener('paste', async (event) => {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.length) return;
        const input = event.currentTarget;
        const inserted = await opts.insertImageFilesIntoDiscussionInput?.(input, files);
        if ((Number(inserted) || 0) > 0) {
          event.preventDefault();
          opts.showToast?.(String(inserted) + ' image(s) inseree(s) dans le message');
        }
      });

      document.getElementById('message-input')?.addEventListener('drop', async (event) => {
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.length) return;
        event.preventDefault();
        event.stopPropagation();
        const input = event.currentTarget;
        const inserted = await opts.insertImageFilesIntoDiscussionInput?.(input, files);
        if ((Number(inserted) || 0) > 0) {
          opts.showToast?.(String(inserted) + ' image(s) inseree(s) dans le message');
        }
      });

      document.getElementById('btn-toggle-emoji-picker')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        opts.toggleEmojiPicker?.();
      });

      document.getElementById('btn-toggle-message-files')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        opts.toggleProjectMessageFilesPanel?.();
      });

      document.getElementById('emoji-picker-panel')?.addEventListener('click', (event) => {
        const button = event.target?.closest?.('[data-emoji]');
        if (!button) return;
        const input = document.getElementById('message-input');
        opts.insertTextAtCursor?.(input, button.dataset.emoji || '');
      });

      document.getElementById('messages-container')?.addEventListener('click', (event) => {
        const img = event.target?.closest?.('.markdown-content img');
        if (!img) return;
        const src = String(img.getAttribute('src') || '').trim();
        if (!src) return;
        event.preventDefault();
        opts.openMessageImagePreview?.(src, img.getAttribute('alt') || 'Image message');
      });

      document.getElementById('btn-close-message-image-preview')?.addEventListener('click', () => {
        opts.closeMessageImagePreview?.();
      });

      document.getElementById('btn-clear-project-message-reply')?.addEventListener('click', () => {
        opts.clearProjectMessageReply?.();
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectComposerUI = {
    createModule
  };
}(window));

/* --- taskmda-project-outside-click-ui.js --- */
(function initTaskMdaProjectOutsideClickUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectOutsideClickUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.addEventListener('click', (event) => {
        const target = event.target;
        const exportDropdown = document.getElementById('project-note-read-export-dropdown');
        const exportBtn = document.getElementById('btn-project-note-read-export-menu');
        if (exportDropdown && exportBtn && !exportDropdown.contains(target) && !exportBtn.contains(target)) {
          exportDropdown.classList.add('hidden');
          exportBtn.setAttribute('aria-expanded', 'false');
        }
        if (opts.isProjectEditorEmojiPickerOpen?.()) {
          const projectPanel = document.getElementById('project-editor-emoji-panel');
          const anchorId = String(opts.getProjectEditorEmojiAnchorId?.() || '');
          const anchor = anchorId ? document.getElementById(anchorId) : null;
          if (!projectPanel?.contains(target) && !anchor?.contains(target)) {
            opts.toggleProjectEditorEmojiPicker?.(null, null, false);
          }
        }
        if (!opts.isEmojiPickerOpen?.()) return;
        const panel = document.getElementById('emoji-picker-panel');
        const trigger = document.getElementById('btn-toggle-emoji-picker');
        if (panel?.contains(target) || trigger?.contains(target)) return;
        opts.toggleEmojiPicker?.(false);
      });

      document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const insideProjectNoteExport = target.closest('[id^="project-note-export-menu-"], [id^="project-note-export-menu-btn-"]');
        if (insideProjectNoteExport) return;
        document.querySelectorAll('[id^="project-note-export-menu-"]').forEach((menu) => {
          if (menu.id.startsWith('project-note-export-menu-btn-')) return;
          menu.classList.add('hidden');
          const noteId = menu.id.replace('project-note-export-menu-', '');
          const btn = document.getElementById('project-note-export-menu-btn-' + noteId);
          if (btn) btn.setAttribute('aria-expanded', 'false');
        });
      });

      document.addEventListener('click', (event) => {
        if (!opts.isProjectMessageFilesPanelOpen?.()) return;
        const target = event.target;
        const panel = document.getElementById('message-files-panel');
        const trigger = document.getElementById('btn-toggle-message-files');
        const composer = document.getElementById('project-discussion-composer');
        if (panel?.contains(target) || trigger?.contains(target) || composer?.contains(target)) return;
        opts.toggleProjectMessageFilesPanel?.(false);
      });

      document.addEventListener('click', (event) => {
        const button = event.target?.closest?.('#project-editor-emoji-panel [data-emoji]');
        const targetId = String(opts.getProjectEditorEmojiTarget?.() || '');
        if (!button || !targetId) return;
        const editor = document.getElementById(targetId);
        if (!editor) return;
        editor.focus();
        document.execCommand('insertText', false, button.dataset.emoji || '');
        opts.toggleProjectEditorEmojiPicker?.(null, null, false);
      });

      document.addEventListener('click', (event) => {
        const target = event.target;
        const activeImage = opts.getActiveProjectEditorImage?.();
        const activeEditorId = String(opts.getActiveProjectEditorId?.() || '');
        if (!activeImage || !activeEditorId) return;
        const editor = document.getElementById(activeEditorId);
        if (!editor) {
          opts.clearProjectEditorImageSelection?.();
          return;
        }
        const overlay = editor.querySelector('.project-editor-image-overlay');
        if (editor.contains(target) || overlay?.contains(target)) return;
        opts.clearProjectEditorImageSelection?.();
      });

      window.addEventListener('resize', () => {
        const activeImage = opts.getActiveProjectEditorImage?.();
        const activeEditorId = String(opts.getActiveProjectEditorId?.() || '');
        if (!activeImage || !activeEditorId) return;
        const editor = document.getElementById(activeEditorId);
        if (!editor || !editor.contains(activeImage)) {
          opts.clearProjectEditorImageSelection?.();
          return;
        }
        opts.updateProjectEditorImageOverlayPosition?.(editor);
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectOutsideClickUI = {
    createModule
  };
}(window));

/* --- taskmda-project-chat-filters-ui.js --- */
(function initTaskMdaProjectChatFiltersUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectChatFiltersUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function renderCurrentMessages() {
      opts.renderMessages?.(opts.getCurrentProjectMessages?.() || []);
    }

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('chat-search-input')?.addEventListener('input', () => {
        const value = String(document.getElementById('chat-search-input')?.value || '');
        opts.setMessageFilters?.({
          query: value
        });
        renderCurrentMessages();
      });

      document.getElementById('chat-filter-mine')?.addEventListener('change', () => {
        const onlyMine = !!document.getElementById('chat-filter-mine')?.checked;
        opts.setMessageFilters?.({
          onlyMine
        });
        renderCurrentMessages();
      });

      document.getElementById('chat-filter-reset')?.addEventListener('click', () => {
        opts.resetMessageFilters?.();
        const search = document.getElementById('chat-search-input');
        const mine = document.getElementById('chat-filter-mine');
        if (search) search.value = '';
        if (mine) mine.checked = false;
        renderCurrentMessages();
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectChatFiltersUI = {
    createModule
  };
}(window));

/* --- taskmda-file-inputs-ui.js --- */
(function initTaskMdaFileInputsUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaFileInputsUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function assignFilesToInput(input, files) {
      if (!input || !files) return;
      const dt = new DataTransfer();
      Array.from(files || []).forEach((file) => {
        if (file) dt.items.add(file);
      });
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function formatFilesSummary(files, emptyLabel) {
      if (!Array.isArray(files) || files.length === 0) return emptyLabel;
      return files.map((file) => String(file.name || '') + ' (' + opts.formatFileSize?.(file.size) + ')').join(' • ');
    }

    function updateProjectDocFilesSummary() {
      const input = document.getElementById('project-doc-files');
      const summary = document.getElementById('project-doc-selected-files');
      if (!summary) return;
      const files = Array.from(input?.files || []);
      summary.textContent = formatFilesSummary(files, 'Aucun fichier selectionne');
    }

    function updateProjectNoteAttachmentFilesSummary() {
      const input = document.getElementById('project-note-attachments');
      const summary = document.getElementById('project-note-attachments-summary');
      if (!summary) return;
      const files = Array.from(input?.files || []);
      summary.textContent = formatFilesSummary(files, 'Aucun fichier sélectionné');
    }

    function updateGlobalNoteAttachmentFilesSummary() {
      const input = document.getElementById('global-note-attach-doc-files');
      const summary = document.getElementById('global-note-attachments-summary');
      if (!summary) return;
      const files = Array.from(input?.files || []);
      summary.textContent = formatFilesSummary(files, 'Aucun fichier sélectionné');
    }

    function updateCreateProjectDocFilesSummary() {
      const input = document.getElementById('project-create-doc-files');
      const summary = document.getElementById('project-create-doc-files-summary');
      if (!summary) return;
      const files = Array.from(input?.files || []);
      summary.textContent = formatFilesSummary(files, 'Aucun fichier sélectionné');
    }

    function updateEditProjectDocFilesSummary() {
      const input = document.getElementById('edit-project-doc-files');
      const summary = document.getElementById('edit-project-doc-files-summary');
      if (!summary) return;
      const files = Array.from(input?.files || []);
      summary.textContent = formatFilesSummary(files, 'Aucun fichier sélectionné');
    }

    function initFileDropInputs() {
      const inputs = Array.from(document.querySelectorAll('.js-file-drop-input'));
      inputs.forEach((input) => {
        if (input.dataset.dropBound) return;
        const decorateDropHost = input.dataset.dropDecor !== 'false';
        const customHostSelector = String(input.dataset.dropHost || '').trim();
        const host = (customHostSelector && input.closest(customHostSelector))
          || input.closest('.space-y-1')
          || input.parentElement;
        if (!host) return;
        if (decorateDropHost) {
          host.classList.add('file-drop-host');
          const title = document.createElement('div');
          title.className = 'file-drop-title';
          title.innerHTML = '<span class="material-symbols-outlined">upload_file</span><span>Zone de depot</span>';
          host.insertBefore(title, input);
          const hint = document.createElement('p');
          hint.className = 'file-drop-hint';
          hint.textContent = input.dataset.dropLabel || 'Glissez-deposez des fichiers ici ou cliquez pour selectionner.';
          host.appendChild(hint);
        }

        const toggleHover = (on) => host.classList.toggle('is-drag-over', !!on);
        ['dragenter', 'dragover'].forEach((evtName) => {
          host.addEventListener(evtName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleHover(true);
          });
        });
        ['dragleave', 'dragend', 'drop'].forEach((evtName) => {
          host.addEventListener(evtName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleHover(false);
          });
        });
        host.addEventListener('drop', (event) => {
          const files = Array.from(event.dataTransfer?.files || []);
          if (!files.length) return;
          assignFilesToInput(input, files);
          opts.showToast?.(String(files.length) + ' fichier(s) ajoute(s)');
        });
        input.dataset.dropBound = '1';
      });
    }

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('message-files')?.addEventListener('change', () => {
        const input = document.getElementById('message-files');
        const list = document.getElementById('message-files-list');
        if (!input || !list) return;
        const files = Array.from(input.files || []);
        if (files.length === 0) {
          list.textContent = 'Aucun fichier sélectionné';
          return;
        }
        list.textContent = files.map((file) => String(file.name || '') + ' (' + opts.formatFileSize?.(file.size) + ')').join(' • ');
      });

      document.getElementById('global-message-files')?.addEventListener('change', () => {
        const input = document.getElementById('global-message-files');
        const list = document.getElementById('global-message-files-list');
        if (!input || !list) return;
        const files = Array.from(input.files || []);
        if (files.length === 0) {
          list.textContent = 'Aucun fichier sélectionné';
          return;
        }
        list.textContent = files.map((file) => String(file.name || '') + ' (' + opts.formatFileSize?.(file.size) + ')').join(' • ');
      });

      document.getElementById('project-doc-files')?.addEventListener('change', updateProjectDocFilesSummary);
      document.getElementById('project-note-attachments')?.addEventListener('change', updateProjectNoteAttachmentFilesSummary);
      document.getElementById('global-note-attach-doc-files')?.addEventListener('change', updateGlobalNoteAttachmentFilesSummary);
      document.getElementById('project-create-doc-files')?.addEventListener('change', updateCreateProjectDocFilesSummary);
      document.getElementById('edit-project-doc-files')?.addEventListener('change', updateEditProjectDocFilesSummary);

      initFileDropInputs();
    }

    return {
      bindDom,
      updateProjectDocFilesSummary,
      updateProjectNoteAttachmentFilesSummary,
      updateGlobalNoteAttachmentFilesSummary,
      updateCreateProjectDocFilesSummary,
      updateEditProjectDocFilesSummary
    };
  }

  global.TaskMDAFileInputsUI = {
    createModule
  };
}(window));

/* --- taskmda-project-docs-controls-ui.js --- */
(function initTaskMdaProjectDocsControlsUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectDocsControlsUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies from orchestrator:
    // - docs filters state setters/reset
    // - render callback
    // - project document actions
    const opts = options || {};
    let bound = false;

    function rerender() {
      opts.renderDocuments?.(opts.getCurrentProjectState?.());
    }

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('docs-search-input')?.addEventListener('input', () => {
        const query = String(document.getElementById('docs-search-input')?.value || '');
        opts.setDocsFilters?.({ query });
        rerender();
      });

      document.getElementById('docs-type-filter')?.addEventListener('change', () => {
        const type = String(document.getElementById('docs-type-filter')?.value || 'all') || 'all';
        opts.setDocsFilters?.({ type });
        rerender();
      });

      document.getElementById('docs-sort')?.addEventListener('change', () => {
        const sort = String(document.getElementById('docs-sort')?.value || 'recent') || 'recent';
        opts.setDocsFilters?.({ sort });
        rerender();
      });

      document.getElementById('docs-filter-reset')?.addEventListener('click', () => {
        opts.resetDocsFilters?.();
        const search = document.getElementById('docs-search-input');
        const type = document.getElementById('docs-type-filter');
        const sort = document.getElementById('docs-sort');
        if (search) search.value = '';
        if (type) type.value = 'all';
        if (sort) sort.value = 'recent';
        rerender();
      });

      document.getElementById('btn-add-project-documents')?.addEventListener('click', () => {
        opts.addProjectDocuments?.();
      });

      document.getElementById('btn-close-doc-preview')?.addEventListener('click', () => {
        opts.closeDocumentPreview?.();
      });

      opts.registerSafeBackdropClose?.('modal-doc-preview', async () => {
        await opts.closeDocumentPreview?.();
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectDocsControlsUI = {
    createModule
  };
}(window));

/* --- taskmda-project-activity-filters-ui.js --- */
(function initTaskMdaProjectActivityFiltersUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectActivityFiltersUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    // This module owns only DOM bindings for activity filters.
    // State and rendering remain orchestrated via injected callbacks.
    const opts = options || {};
    let bound = false;

    async function rerender() {
      opts.setActivityPage?.(1);
      await opts.renderActivity?.(opts.getCurrentProjectEvents?.() || []);
    }

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('activity-filter-type')?.addEventListener('change', async (event) => {
        opts.setActivityFilters?.({ type: event?.target?.value || 'all' });
        await rerender();
      });
      document.getElementById('activity-filter-author')?.addEventListener('input', async (event) => {
        opts.setActivityFilters?.({ author: event?.target?.value || '' });
        await rerender();
      });
      document.getElementById('activity-filter-period')?.addEventListener('change', async (event) => {
        opts.setActivityFilters?.({ period: event?.target?.value || 'all' });
        await rerender();
      });
      document.getElementById('activity-filter-reset')?.addEventListener('click', async () => {
        opts.resetActivityFilters?.();
        const type = document.getElementById('activity-filter-type');
        const author = document.getElementById('activity-filter-author');
        const period = document.getElementById('activity-filter-period');
        if (type) type.value = 'all';
        if (author) author.value = '';
        if (period) period.value = 'all';
        await rerender();
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectActivityFiltersUI = {
    createModule
  };
}(window));

/* --- taskmda-project-theme-bindings-ui.js --- */
(function initTaskMdaProjectThemeBindingsUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaProjectThemeBindingsUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    // Keeps the free-text task theme input and known-themes select in sync.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('task-theme')?.addEventListener('input', () => {
        opts.syncThemePickerSelectionFromInput?.('task-theme-known', 'task-theme');
      });

      document.getElementById('task-theme-known')?.addEventListener('change', () => {
        opts.syncThemePickerInputFromSelection?.('task-theme-known', 'task-theme');
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAProjectThemeBindingsUI = {
    createModule
  };
}(window));

/* --- taskmda-attachments-ui.js --- */
(function initTaskMdaAttachmentsUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaAttachmentsUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    // Attachment pipeline extracted from taskmda-team:
    // - task/doc attachments
    // - message attachments with image optimization
    // The module is stateless and relies on injected helpers.
    const opts = options || {};

    function renameFileExtension(name, extensionWithDot) {
      const safeName = String(name || 'image').trim();
      const ext = String(extensionWithDot || '.jpg').trim() || '.jpg';
      const dot = safeName.lastIndexOf('.');
      if (dot <= 0) return safeName + ext;
      return safeName.slice(0, dot) + ext;
    }

    async function optimizeMessageAttachment(file, rawDataUrl) {
      const fallback = {
        name: String(file?.name || 'piece-jointe'),
        size: Number(file?.size || 0),
        type: String(file?.type || 'application/octet-stream') || 'application/octet-stream',
        data: rawDataUrl
      };
      const isImage = /^image\//i.test(String(file?.type || ''));
      if (!isImage) return fallback;

      const optimized = await opts.resizeImageDataUrl?.(rawDataUrl, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.82,
        outputType: 'image/jpeg'
      });
      if (!optimized) return fallback;

      return {
        name: renameFileExtension(fallback.name, '.jpg'),
        size: opts.estimateDataUrlBytes?.(optimized) || fallback.size,
        type: 'image/jpeg',
        data: optimized
      };
    }

    async function readTaskFiles() {
      const input = document.getElementById('task-files');
      const shareToDocs = !!document.getElementById('task-share-docs')?.checked;
      const files = Array.from(input?.files || []);
      const maxFileSize = 5 * 1024 * 1024;

      const attachments = [];
      for (const file of files) {
        if (file.size > maxFileSize) {
          throw new Error('Le fichier "' + file.name + '" dépasse 5 Mo');
        }
        const data = await opts.fileToDataUrl?.(file);
        attachments.push({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          shareToDocs,
          data
        });
      }
      return attachments;
    }

    async function readMessageFiles(inputId) {
      const targetInputId = String(inputId || 'message-files') || 'message-files';
      const input = document.getElementById(targetInputId);
      const files = Array.from(input?.files || []);
      const maxFileSize = 10 * 1024 * 1024;

      const attachments = [];
      const rejected = [];
      for (const file of files) {
        if (file.size > maxFileSize) {
          rejected.push('"' + file.name + '" depasse 10 Mo');
          continue;
        }
        try {
          const rawData = await opts.fileToDataUrl?.(file);
          const optimized = await optimizeMessageAttachment(file, rawData);
          attachments.push({
            name: optimized.name,
            size: optimized.size,
            type: optimized.type,
            data: optimized.data
          });
        } catch (error) {
          rejected.push('"' + file.name + '" est illisible');
        }
      }
      if (rejected.length > 0) {
        // Keep legacy UX: first error + optional count suffix.
        const suffix = rejected.length > 1 ? ' (+' + (rejected.length - 1) + ')' : '';
        opts.showToast?.('⚠ Piece jointe ignoree: ' + rejected[0] + suffix);
      }
      return attachments;
    }

    function buildInlineMessageImageHtml(dataUrl, altText) {
      const safeSrc = String(dataUrl || '').trim();
      if (!safeSrc) return '';
      const safeAlt = opts.escapeHtml?.(String(altText || 'image').slice(0, 120)) || 'image';
      return '<p><img src="' + safeSrc + '" alt="' + safeAlt + '" class="desc-img-align-center discussion-inline-image" data-desc-image-width="58" style="width:58%;max-width:100%;height:auto"></p>';
    }

    async function insertImageFilesIntoDiscussionInput(input, files) {
      if (!input || !input.isContentEditable) return 0;
      const list = Array.from(files || []).filter((file) => /^image\//i.test(String(file?.type || '')));
      if (!list.length) return 0;
      let inserted = 0;
      for (const file of list) {
        try {
          const rawData = await opts.fileToDataUrl?.(file);
          const optimized = await optimizeMessageAttachment(file, rawData);
          const imageHtml = buildInlineMessageImageHtml(optimized?.data || rawData, file.name || 'image');
          if (!imageHtml) continue;
          opts.insertHtmlAtCursor?.(input, imageHtml);
          inserted += 1;
        } catch (error) {
          // ignore one file failure to keep others
        }
      }
      return inserted;
    }

    return {
      readTaskFiles,
      readMessageFiles,
      optimizeMessageAttachment,
      renameFileExtension,
      buildInlineMessageImageHtml,
      insertImageFilesIntoDiscussionInput
    };
  }

  global.TaskMDAAttachmentsUI = {
    createModule
  };
}(window));

/* --- taskmda-discussion-input-ui.js --- */
(function initTaskMdaDiscussionInputUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaDiscussionInputUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    // Shared discussion input helpers (contenteditable + textarea):
    // extracted to reduce orchestrator size and centralize cursor logic.
    const opts = options || {};

    function insertTextAtCursor(input, text) {
      if (!input) return;
      if (input.isContentEditable) {
        input.focus();
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const node = document.createTextNode(String(text || ''));
          range.insertNode(node);
          range.setStartAfter(node);
          range.setEndAfter(node);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          input.appendChild(document.createTextNode(String(text || '')));
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
      const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;
      const before = input.value.slice(0, start);
      const after = input.value.slice(end);
      input.value = before + text + after;
      const nextPos = start + String(text || '').length;
      input.selectionStart = nextPos;
      input.selectionEnd = nextPos;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }

    function setDiscussionInputPlaceholder(input, text) {
      if (!input) return;
      const value = String(text || '').trim();
      if (input.isContentEditable) {
        input.setAttribute('data-placeholder', value || 'Taper un message...');
      } else {
        input.placeholder = value || 'Taper un message...';
      }
    }

    function getDiscussionInputPlainText(input) {
      if (!input) return '';
      if (input.isContentEditable) {
        return String(input.textContent || '').replace(/\u00a0/g, ' ').trim();
      }
      return String(input.value || '').trim();
    }

    function getDiscussionInputHtml(input) {
      if (!input) return '';
      const raw = input.isContentEditable
        ? String(input.innerHTML || '')
        : opts.plainTextToRichHtml?.(String(input.value || ''));
      return opts.sanitizeProjectDescriptionHtml?.(raw || '') || '';
    }

    function clearDiscussionInput(input) {
      if (!input) return;
      if (input.isContentEditable) {
        input.innerHTML = '';
      } else {
        input.value = '';
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    return {
      insertTextAtCursor,
      setDiscussionInputPlaceholder,
      getDiscussionInputPlainText,
      getDiscussionInputHtml,
      clearDiscussionInput
    };
  }

  global.TaskMDADiscussionInputUI = {
    createModule
  };
}(window));
