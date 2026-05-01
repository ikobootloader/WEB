/* TaskMDA Shell Domain Bundle (manual, no-build) */
/* Consolidates shell/header/chrome UI modules */

/* --- taskmda-shell-ui.js --- */
(function initTaskMdaShellUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaShellUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    const SIDEBAR_COMPACT_STORAGE_KEY = 'taskmda_sidebar_compact';
    let sidebarTransitionTimer = null;
    let shellBound = false;

    function normalizeWorkflowSidebarGroup(rawGroup) {
      const group = String(rawGroup || '').trim().toLowerCase();
      if (group === 'structure' || group === 'processes' || group === 'pilotage' || group === 'referentiels' || group === 'supervision') {
        return group;
      }
      return 'structure';
    }

    function setWorkflowSidebarSubnavOpen(nextOpen) {
      const isOpen = !!nextOpen;
      const panel = document.getElementById('workflow-sidebar-subnav');
      const btn = document.getElementById('nav-workflow-subnav-toggle');
      const icon = document.getElementById('nav-workflow-subnav-toggle-icon');
      if (panel) panel.classList.toggle('hidden', !isOpen);
      if (btn) {
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        btn.setAttribute('aria-label', isOpen ? 'Masquer les sous-rubriques Workflow' : 'Afficher les sous-rubriques Workflow');
        btn.setAttribute('title', isOpen ? 'Masquer les sous-rubriques Workflow' : 'Afficher les sous-rubriques Workflow');
      }
      if (icon) icon.textContent = isOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
      localStorage.setItem('taskmda_workflow_sidebar_subnav_open', isOpen ? '1' : '0');
      return isOpen;
    }

    function setActiveWorkflowSidebarGroup(rawGroup) {
      const group = normalizeWorkflowSidebarGroup(rawGroup);
      const links = {
        structure: document.getElementById('nav-workflow-group-structure'),
        processes: document.getElementById('nav-workflow-group-processes'),
        pilotage: document.getElementById('nav-workflow-group-pilotage'),
        referentiels: document.getElementById('nav-workflow-group-referentiels'),
        supervision: document.getElementById('nav-workflow-group-supervision')
      };
      Object.entries(links).forEach(([key, link]) => {
        if (!link) return;
        link.classList.toggle('active', key === group);
      });
      localStorage.setItem('taskmda_sidebar_workflow_group', group);
      return group;
    }

    function setActiveSidebarNav(navKey) {
      const links = {
        dashboard: document.getElementById('nav-dashboard'),
        projects: document.getElementById('nav-projects'),
        tasks: document.getElementById('nav-tasks'),
        calendar: document.getElementById('nav-calendar'),
        docs: document.getElementById('nav-docs'),
        notes: document.getElementById('nav-notes'),
        messages: document.getElementById('nav-messages'),
        feed: document.getElementById('nav-feed'),
        rgpd: document.getElementById('nav-rgpd'),
        workflow: document.getElementById('nav-workflow'),
        settings: document.getElementById('nav-settings')
      };
      Object.entries(links).forEach(([key, link]) => {
        if (!link) return;
        link.classList.toggle('active', key === navKey);
      });
      if (navKey !== 'workflow') {
        setWorkflowSidebarSubnavOpen(false);
      }
      opts.applyWorkspaceWidthMode?.();
    }

    function openMobileSidebar() {
      document.getElementById('sidebar')?.classList.add('open');
      document.getElementById('mobile-overlay')?.classList.remove('hidden');
    }

    function closeMobileSidebar() {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('mobile-overlay')?.classList.add('hidden');
    }

    function updateSidebarCollapseButton() {
      const main = document.getElementById('main-content');
      const btn = document.getElementById('btn-sidebar-collapse');
      const icon = document.getElementById('sidebar-collapse-icon');
      const label = document.getElementById('sidebar-collapse-label');
      if (!main || !btn || !icon || !label) return;
      const collapsed = main.classList.contains('sidebar-collapsed');
      icon.textContent = collapsed ? 'left_panel_open' : 'left_panel_close';
      label.textContent = collapsed ? 'Deplier' : 'Reduire';
      const action = collapsed ? 'Deplier' : 'Reduire';
      btn.setAttribute('aria-label', `${action} la barre laterale`);
      btn.setAttribute('title', `${action} la barre laterale`);

      document.querySelectorAll('.nav-link').forEach((link) => {
        const text = String(link.querySelector('.nav-link-label')?.textContent || '').trim();
        if (!text) return;
        if (collapsed) {
          link.setAttribute('title', text);
          link.setAttribute('aria-label', text);
        } else {
          link.removeAttribute('title');
          link.removeAttribute('aria-label');
        }
      });

      ['sidebar-create-project', 'sidebar-link-folder'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        if (collapsed) {
          el.setAttribute('title', text);
          el.setAttribute('aria-label', text);
        } else {
          el.removeAttribute('title');
          el.removeAttribute('aria-label');
        }
      });
    }

    function applySidebarCollapsedState(collapsed, persist = true) {
      const main = document.getElementById('main-content');
      if (!main) return;
      const isMobile = global.matchMedia('(max-width: 1023px)').matches;
      const shouldCollapse = !isMobile && !!collapsed;
      main.classList.toggle('sidebar-collapsed', shouldCollapse);
      updateSidebarCollapseButton();
      if (persist) {
        if (shouldCollapse) {
          localStorage.setItem(SIDEBAR_COMPACT_STORAGE_KEY, '1');
        } else {
          localStorage.removeItem(SIDEBAR_COMPACT_STORAGE_KEY);
        }
      }
    }

    function initSidebarCollapsedState() {
      const saved = localStorage.getItem(SIDEBAR_COMPACT_STORAGE_KEY) === '1';
      applySidebarCollapsedState(saved, false);
    }

    function toggleSidebarCollapsed() {
      const main = document.getElementById('main-content');
      if (!main) return;
      const nextCollapsed = !main.classList.contains('sidebar-collapsed');
      main.classList.remove('sidebar-transitioning-collapse', 'sidebar-transitioning-expand');
      main.classList.add('sidebar-transitioning', nextCollapsed ? 'sidebar-transitioning-collapse' : 'sidebar-transitioning-expand');
      if (sidebarTransitionTimer) {
        clearTimeout(sidebarTransitionTimer);
      }
      sidebarTransitionTimer = setTimeout(() => {
        main.classList.remove('sidebar-transitioning', 'sidebar-transitioning-collapse', 'sidebar-transitioning-expand');
        sidebarTransitionTimer = null;
      }, 260);
      applySidebarCollapsedState(nextCollapsed, true);
    }

    function bindShellNavigation() {
      if (shellBound) return;
      shellBound = true;

      document.getElementById('mobile-menu-btn')?.addEventListener('click', openMobileSidebar);
      document.getElementById('mobile-overlay')?.addEventListener('click', closeMobileSidebar);

      opts.updateTopbarHeightVar?.();
      global.requestAnimationFrame(() => opts.updateTopbarHeightVar?.());
      global.addEventListener('resize', () => {
        opts.updateTopbarHeightVar?.();
        const collapsed = localStorage.getItem(SIDEBAR_COMPACT_STORAGE_KEY) === '1';
        applySidebarCollapsedState(collapsed, false);
        opts.syncProjectWorkFocusButton?.();
      });
      opts.applyProjectOverviewCollapsedState?.();
      opts.applyProjectSubnavLayout?.();
      opts.syncProjectWorkFocusButton?.();
      opts.setGlobalDocsUploadCollapsed?.(opts.getGlobalDocsUploadCollapsed?.());
      opts.setProjectDocsUploadCollapsed?.(opts.getProjectDocsUploadCollapsed?.());

      document.getElementById('sidebar-create-project')?.addEventListener('click', () => {
        opts.onCreateProjectFromSidebar?.();
        closeMobileSidebar();
      });
      document.getElementById('nav-dashboard')?.addEventListener('click', (e) => {
        e.preventDefault();
        opts.showDashboard?.();
        closeMobileSidebar();
      });
      document.getElementById('btn-open-feed-from-dashboard-news')?.addEventListener('click', async () => {
        await opts.showGlobalWorkspace?.('feed');
        closeMobileSidebar();
      });
      document.getElementById('dashboard-news-list')?.addEventListener('click', async (e) => {
        const refBtn = e.target?.closest?.('[data-dashboard-news-ref-type][data-dashboard-news-ref-id]');
        if (refBtn) {
          e.preventDefault();
          e.stopPropagation();
          const type = String(refBtn.getAttribute('data-dashboard-news-ref-type') || '').trim();
          const id = String(refBtn.getAttribute('data-dashboard-news-ref-id') || '').trim();
          if (type && id) {
            await opts.openGlobalFeedReference?.(type, encodeURIComponent(id));
            closeMobileSidebar();
          }
          return;
        }
        const item = e.target?.closest?.('[data-dashboard-news-post-id]');
        if (!item) return;
        const postId = String(item.getAttribute('data-dashboard-news-post-id') || '').trim();
        if (!postId) return;
        await opts.openGlobalFeedPost?.(postId);
        closeMobileSidebar();
      });
      document.getElementById('dashboard-news-list')?.addEventListener('keydown', async (e) => {
        const refBtn = e.target?.closest?.('[data-dashboard-news-ref-type][data-dashboard-news-ref-id]');
        if (refBtn) return;
        const isActivationKey = e.key === 'Enter' || e.key === ' ';
        if (!isActivationKey) return;
        const item = e.target?.closest?.('[data-dashboard-news-post-id]');
        if (!item) return;
        e.preventDefault();
        const postId = String(item.getAttribute('data-dashboard-news-post-id') || '').trim();
        if (!postId) return;
        await opts.openGlobalFeedPost?.(postId);
        closeMobileSidebar();
      });
      document.getElementById('nav-calendar')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await opts.showGlobalWorkspace?.('calendar');
        closeMobileSidebar();
      });
      document.getElementById('nav-workflow')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const preferredGroup = localStorage.getItem('taskmda_sidebar_workflow_group') || 'structure';
        await opts.openWorkflowSidebarGroup?.(preferredGroup);
      });
      document.getElementById('nav-workflow-group-structure')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await opts.openWorkflowSidebarGroup?.('structure');
      });
      document.getElementById('nav-workflow-group-processes')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await opts.openWorkflowSidebarGroup?.('processes');
      });
      document.getElementById('nav-workflow-group-pilotage')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await opts.openWorkflowSidebarGroup?.('pilotage');
      });
      document.getElementById('nav-workflow-group-referentiels')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await opts.openWorkflowSidebarGroup?.('referentiels');
      });
      document.getElementById('nav-workflow-group-supervision')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await opts.openWorkflowSidebarGroup?.('supervision');
      });
      setActiveWorkflowSidebarGroup(localStorage.getItem('taskmda_sidebar_workflow_group') || 'structure');
      setWorkflowSidebarSubnavOpen(localStorage.getItem('taskmda_workflow_sidebar_subnav_open') === '1');
      document.getElementById('nav-workflow-subnav-toggle')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const current = document.getElementById('nav-workflow-subnav-toggle')?.getAttribute('aria-expanded') === 'true';
        setWorkflowSidebarSubnavOpen(!current);
      });
    }

    return {
      openMobileSidebar,
      closeMobileSidebar,
      updateSidebarCollapseButton,
      applySidebarCollapsedState,
      initSidebarCollapsedState,
      toggleSidebarCollapsed,
      setActiveSidebarNav,
      normalizeWorkflowSidebarGroup,
      setWorkflowSidebarSubnavOpen,
      setActiveWorkflowSidebarGroup,
      bindShellNavigation
    };
  }

  global.TaskMDAShellUI = {
    createModule
  };
}(window));

/* --- taskmda-shell-notifications.js --- */
(function initTaskMdaShellNotificationsModule(global) {
  // Module role: UI/domain boundary for TaskMdaShellNotificationsModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('btn-notifications')?.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.toggleNotificationsPanel?.();
      });
      document.getElementById('btn-notif-mark-read')?.addEventListener('click', () => {
        opts.markAllNotificationsRead?.();
      });
      document.getElementById('btn-notif-clear')?.addEventListener('click', () => {
        opts.clearNotifications?.();
      });
      document.addEventListener('click', (e) => {
        const panel = document.getElementById('notifications-panel');
        const btn = document.getElementById('btn-notifications');
        if (!panel || panel.classList.contains('hidden')) return;
        if (panel.contains(e.target) || btn?.contains(e.target)) return;
        opts.toggleNotificationsPanel?.(false);
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAShellNotifications = {
    createModule
  };
}(window));

/* --- taskmda-header-search.js --- */
(function initTaskMdaHeaderSearchModule(global) {
  // Module role: UI/domain boundary for TaskMdaHeaderSearchModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;
    let debounceTimer = null;
    let requestToken = 0;

    function clearDebounce() {
      if (!debounceTimer) return;
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      const searchInput = document.getElementById('search-input');
      const resultsPanel = document.getElementById('header-search-results');
      if (!searchInput || !resultsPanel) return;

      searchInput.addEventListener('input', async (e) => {
        const query = String(e?.target?.value || '').trim();
        opts.setGlobalSearchQuery?.(query);
        await opts.onSearchContextChanged?.(query);

        clearDebounce();
        const token = ++requestToken;
        if (!query || query.length < 2) {
          opts.setResults?.([]);
          opts.hideResults?.();
          return;
        }
        debounceTimer = setTimeout(async () => {
          const results = await opts.buildResults?.(query);
          if (token !== requestToken) return;
          const safeResults = Array.isArray(results) ? results : [];
          opts.setResults?.(safeResults);
          opts.setActiveIndex?.(safeResults.length > 0 ? 0 : -1);
          opts.renderResults?.();
        }, 170);
      });

      searchInput.addEventListener('focus', () => {
        const query = String(searchInput.value || '').trim();
        if (query.length >= 2 && (opts.getResults?.().length || 0) > 0) {
          opts.renderResults?.();
        }
      });

      searchInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape') {
          opts.hideResults?.();
          return;
        }
        const results = opts.getResults?.() || [];
        if (!results.length) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const current = Number(opts.getActiveIndex?.() || 0);
          opts.setActiveIndex?.(Math.min(results.length - 1, current + 1));
          opts.renderResults?.();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const current = Number(opts.getActiveIndex?.() || 0);
          opts.setActiveIndex?.(Math.max(0, current - 1));
          opts.renderResults?.();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const current = Number(opts.getActiveIndex?.() || 0);
          const idx = current >= 0 ? current : 0;
          const item = results[idx];
          if (item) await opts.executeResult?.(item);
        }
      });

      resultsPanel.addEventListener('click', async (e) => {
        const row = e.target?.closest?.('[data-search-result-index]');
        if (!row) return;
        const idx = Number(row.dataset.searchResultIndex);
        const results = opts.getResults?.() || [];
        if (!Number.isFinite(idx) || idx < 0 || idx >= results.length) return;
        await opts.executeResult?.(results[idx]);
      });

      document.addEventListener('click', (e) => {
        const wrap = document.getElementById('header-search-wrap');
        if (!wrap) return;
        if (wrap.contains(e.target)) return;
        opts.hideResults?.();
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAHeaderSearch = {
    createModule
  };
}(window));

/* --- taskmda-doc-editor-ui.js --- */
(function initTaskMdaDocEditorUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaDocEditorUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('btn-close-doc-editor')?.addEventListener('click', () => {
        opts.closeDocumentEditorModal?.();
      });
      document.getElementById('btn-save-doc-editor')?.addEventListener('click', async () => {
        await opts.saveDocumentEditorChanges?.();
      });
      document.getElementById('doc-editor-file-input')?.addEventListener('change', () => {
        opts.updateDocumentEditorFileSummary?.();
      });
      document.getElementById('doc-editor-markdown-tools')?.addEventListener('click', (e) => {
        const button = e.target instanceof Element ? e.target.closest('[data-md-action]') : null;
        if (!button) return;
        const action = button.getAttribute('data-md-action') || '';
        opts.applyMarkdownEditorAction?.(action);
      });
      document.getElementById('doc-editor-tab-xlsx')?.addEventListener('click', () => {
        if (!opts.isSpreadsheetMode?.()) return;
        opts.setSpreadsheetEditorTab?.('xlsx');
      });
      document.getElementById('doc-editor-tab-css')?.addEventListener('click', () => {
        if (!opts.isSpreadsheetMode?.()) return;
        opts.setSpreadsheetEditorTab?.('css');
      });
      document.getElementById('doc-editor-xlsx-sheet-select')?.addEventListener('change', (e) => {
        const nextSheet = String(e?.target?.value || '').trim();
        if (!nextSheet) return;
        opts.persistCurrentSpreadsheetXlsxSheet?.();
        opts.setSpreadsheetSheetName?.(nextSheet);
        if (opts.isSpreadsheetXlsxTab?.()) {
          opts.setSpreadsheetEditorTab?.('xlsx');
        }
      });
      document.getElementById('btn-doc-editor-sheet-add-row')?.addEventListener('click', () => {
        const table = opts.getSpreadsheetTable?.();
        if (!table) return;
        if (opts.isSpreadsheetCssTab?.()) {
          table.addData([{ selector: '', property: '', value: '' }], false);
          return;
        }
        const row = { __row: table.getDataCount() + 1 };
        const cols = Math.max(1, Number(opts.getSpreadsheetColumns?.() || 1));
        for (let c = 0; c < cols; c += 1) row[`c${c}`] = '';
        table.addData([row], false);
        const all = table.getData();
        all.forEach((item, idx) => { item.__row = idx + 1; });
        table.replaceData(all);
      });
      document.getElementById('btn-doc-editor-sheet-add-col')?.addEventListener('click', () => {
        if (!opts.isSpreadsheetXlsxTab?.()) return;
        const table = opts.getSpreadsheetTable?.();
        if (!table) return;
        const nextCol = Math.max(1, Number(opts.getSpreadsheetColumns?.() || 1));
        table.addColumn({
          title: opts.getA1ColumnLabel?.(nextCol) || `C${nextCol + 1}`,
          field: `c${nextCol}`,
          headerSort: false,
          editor: 'input'
        }, false);
        opts.setSpreadsheetColumns?.(nextCol + 1);
        const data = table.getData();
        data.forEach((row) => { row[`c${nextCol}`] = row[`c${nextCol}`] ?? ''; });
        table.replaceData(data);
      });
      document.getElementById('doc-editor-textarea')?.addEventListener('keydown', (e) => {
        if (!opts.isMarkdownMode?.()) return;
        if (e.ctrlKey || e.metaKey) {
          const key = String(e.key || '').toLowerCase();
          if (key === 'b') {
            e.preventDefault();
            opts.applyMarkdownEditorAction?.('bold');
          } else if (key === 'i') {
            e.preventDefault();
            opts.applyMarkdownEditorAction?.('italic');
          } else if (key === 'k') {
            e.preventDefault();
            opts.applyMarkdownEditorAction?.('link');
          }
        }
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDADocEditorUI = {
    createModule
  };
}(window));

/* --- taskmda-branding-ui.js --- */
(function initTaskMdaBrandingUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaBrandingUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('app-chrome-bg-light-color')?.addEventListener('input', (e) => {
        const input = document.getElementById('app-chrome-bg-light-input');
        const value = String(e?.target?.value || '').trim();
        if (!input || !value) return;
        input.value = opts.hexToRgbString?.(value) || value;
      });

      document.getElementById('app-chrome-bg-light-input')?.addEventListener('change', (e) => {
        const colorInput = document.getElementById('app-chrome-bg-light-color');
        const value = String(e?.target?.value || '').trim();
        if (!colorInput || !value) return;
        const normalized = opts.normalizeChromeBackgroundColor?.(value, opts.defaultChromeBgLight) || value;
        colorInput.value = opts.colorToHex?.(normalized, '#eceff8') || '#eceff8';
      });

      document.getElementById('app-chrome-bg-dark-color')?.addEventListener('input', (e) => {
        const input = document.getElementById('app-chrome-bg-dark-input');
        const value = String(e?.target?.value || '').trim();
        if (!input || !value) return;
        input.value = opts.hexToRgbString?.(value) || value;
      });

      document.getElementById('app-chrome-bg-dark-input')?.addEventListener('change', (e) => {
        const colorInput = document.getElementById('app-chrome-bg-dark-color');
        const value = String(e?.target?.value || '').trim();
        if (!colorInput || !value) return;
        const normalized = opts.normalizeChromeBackgroundColor?.(value, opts.defaultChromeBgDark) || value;
        colorInput.value = opts.colorToHex?.(normalized, '#0f1525') || '#0f1525';
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDABrandingUI = {
    createModule
  };
}(window));

/* --- taskmda-view-options-ui.js --- */
(function initTaskMdaViewOptionsUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaViewOptionsUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};

    async function handleViewOptionsChange(e) {
      const target = e?.target;
      if (!target) return;
      if (!opts.isAppAdmin?.()) {
        opts.showToast?.('Action reservee a l admin application');
        await opts.renderGlobalSettings?.();
        return;
      }
      if (target.classList.contains('view-option-checkbox')) {
        const sectionKey = String(target.getAttribute('data-view-section') || '').trim();
        const tabKey = String(target.getAttribute('data-view-tab') || '').trim();
        if (!sectionKey || !tabKey || !opts.viewSectionMeta?.[sectionKey]) return;
        const next = opts.deepClone?.(opts.getViewOptions?.() || opts.defaultViewOptions) || {};
        if (!next.sections || !next.sections[sectionKey] || !next.sections[sectionKey].tabs) return;
        next.sections[sectionKey].tabs[tabKey] = !!target.checked;
        await opts.saveViewOptions?.(next);
        opts.renderViewOptionsMatrix?.(true);
        return;
      }
      if (target.classList.contains('view-option-lock-overrides')) {
        const next = opts.deepClone?.(opts.getViewOptions?.() || opts.defaultViewOptions) || {};
        next.policy = next.policy || {};
        next.policy.lockUserOverrides = !!target.checked;
        await opts.saveViewOptions?.(next);
        opts.renderViewOptionsMatrix?.(true);
        return;
      }
      if (target.classList.contains('view-option-icon-tooltips')) {
        const next = opts.deepClone?.(opts.getViewOptions?.() || opts.defaultViewOptions) || {};
        next.ui = next.ui || {};
        next.ui.iconTooltips = !!target.checked;
        await opts.saveViewOptions?.(next);
        opts.renderViewOptionsMatrix?.(true);
        return;
      }
      if (target.classList.contains('view-option-tab-icons')) {
        const next = opts.deepClone?.(opts.getViewOptions?.() || opts.defaultViewOptions) || {};
        next.ui = next.ui || {};
        next.ui.tabIcons = !!target.checked;
        await opts.saveViewOptions?.(next);
        opts.applyTabIconsToUI?.();
        opts.renderViewOptionsMatrix?.(true);
        return;
      }
      if (target.classList.contains('view-option-workspace-wide')) {
        const sectionKey = String(target.getAttribute('data-view-workspace-width') || '').trim();
        if (!sectionKey || !opts.workspaceWidthSectionMeta?.[sectionKey]) return;
        const next = opts.deepClone?.(opts.getViewOptions?.() || opts.defaultViewOptions) || {};
        next.ui = next.ui || {};
        next.ui.workspaceWideSections = opts.normalizeWorkspaceWideSections?.(next.ui.workspaceWideSections || {}) || {};
        next.ui.workspaceWideSections[sectionKey] = !!target.checked;
        await opts.saveViewOptions?.(next);
        opts.renderViewOptionsMatrix?.(true);
        return;
      }
      if (target.classList.contains('view-option-default')) {
        const sectionKey = String(target.getAttribute('data-view-section') || '').trim();
        const defaultTab = String(target.value || '').trim();
        if (!sectionKey || !defaultTab || !opts.viewSectionMeta?.[sectionKey]) return;
        const next = opts.deepClone?.(opts.getViewOptions?.() || opts.defaultViewOptions) || {};
        if (!next.sections || !next.sections[sectionKey]) return;
        next.sections[sectionKey].defaultTab = defaultTab;
        await opts.saveViewOptions?.(next);
        opts.renderViewOptionsMatrix?.(true);
        return;
      }
      if (target.classList.contains('view-option-workflow-actions-mode')) {
        const next = opts.deepClone?.(opts.getViewOptions?.() || opts.defaultViewOptions) || {};
        next.ui = next.ui || {};
        next.ui.workflowActionButtons = opts.normalizeWorkflowActionButtonsMode?.(target.value);
        await opts.saveViewOptions?.(next);
        if (opts.isWorkflowWorkspaceActive?.()) {
          await opts.renderWorkflowIfAny?.();
        }
        return;
      }
      if (target.classList.contains('view-option-workflow-group-tabs-visible')) {
        const next = opts.deepClone?.(opts.getViewOptions?.() || opts.defaultViewOptions) || {};
        next.ui = next.ui || {};
        next.ui.workflowGroupTabsVisible = !!target.checked;
        await opts.saveViewOptions?.(next);
        opts.applyWorkflowGroupTabsVisibility?.();
        if (opts.isWorkflowWorkspaceActive?.()) {
          await opts.renderWorkflowIfAny?.();
          opts.applyWorkflowGroupTabsVisibility?.();
        }
        return;
      }
      if (target.classList.contains('view-option-workflow-actions-shape')) {
        const next = opts.deepClone?.(opts.getViewOptions?.() || opts.defaultViewOptions) || {};
        next.ui = next.ui || {};
        next.ui.workflowActionButtonsShape = opts.normalizeWorkflowActionButtonsShape?.(target.value);
        await opts.saveViewOptions?.(next);
        if (opts.isWorkflowWorkspaceActive?.()) {
          await opts.renderWorkflowIfAny?.();
        }
      }
    }

    async function handleViewOptionsClick(e) {
      const pinBtn = e?.target?.closest?.('.view-option-pin-btn');
      if (pinBtn) {
        if (!opts.isAppAdmin?.()) {
          opts.showToast?.('Action reservee a l admin application');
          await opts.renderGlobalSettings?.();
          return;
        }
        const sectionInfo = String(pinBtn.getAttribute('data-view-section') || '').trim();
        const tabInfo = String(pinBtn.getAttribute('data-view-tab') || '').trim();
        if (sectionInfo && tabInfo) {
          const next = opts.normalizeViewOptions?.(opts.getViewOptions?.()) || {};
          const currentPinned = Boolean(next.sections?.[sectionInfo]?.pinned?.[tabInfo]);
          next.sections[sectionInfo].pinned[tabInfo] = !currentPinned;
          await opts.saveViewOptions?.(next);
          opts.renderViewOptionsMatrix?.(true);
          if (typeof opts.updateAppChrome === 'function') {
            opts.updateAppChrome();
          } else if (typeof opts.applyAppBrandingToHeader === 'function') {
            opts.applyAppBrandingToHeader();
          }
        }
        return;
      }
      const resetBtn = e?.target?.closest?.('[data-view-kpi-reset]');
      if (resetBtn) {
        if (!opts.isAppAdmin?.()) {
          opts.showToast?.('Action reservee a l admin application');
          await opts.renderGlobalSettings?.();
          return;
        }
        opts.setUxMetrics?.(opts.deepClone?.(opts.uxMetricsDefault || {}));
        opts.scheduleSaveUxMetrics?.();
        opts.renderViewOptionsMatrix?.(true);
        opts.showToast?.('KPI UX reinitialises');
        return;
      }
      const presetBtn = e?.target?.closest?.('[data-view-preset]');
      if (!presetBtn) return;
      if (!opts.isAppAdmin?.()) {
        opts.showToast?.('Action reservee a l admin application');
        await opts.renderGlobalSettings?.();
        return;
      }
      const presetKey = String(presetBtn.getAttribute('data-view-preset') || '').trim();
      if (!presetKey || !opts.viewRolePresets?.[presetKey]) return;
      const next = opts.buildViewOptionsFromPreset?.(presetKey);
      await opts.saveViewOptions?.(next);
      opts.renderViewOptionsMatrix?.(true);
      opts.showToast?.(`Preset applique: ${opts.viewRolePresets[presetKey].label}`);
    }

    return {
      handleViewOptionsChange,
      handleViewOptionsClick
    };
  }

  global.TaskMDAViewOptionsUI = {
    createModule
  };
}(window));

/* --- taskmda-quick-links-ui.js --- */
(function initTaskMdaQuickLinksUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaQuickLinksUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('btn-quick-link-save')?.addEventListener('click', () => {
        opts.saveQuickAccessLinkFromForm?.().catch((error) => {
          console.error('quick link save failed', error);
          opts.showToast?.('Erreur lors de l enregistrement du raccourci');
        });
      });

      document.getElementById('btn-quick-link-reset')?.addEventListener('click', () => {
        opts.resetQuickAccessLinkForm?.();
      });

      document.getElementById('quick-link-category-filter')?.addEventListener('change', async (e) => {
        const value = String(e?.target?.value || 'all').trim() || 'all';
        opts.setQuickLinkCategoryFilterValue?.(value);
        await opts.renderGlobalSettings?.();
      });

      document.getElementById('quick-link-category-input')?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          await opts.saveQuickAccessLinkFromForm?.();
        }
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDAQuickLinksUI = {
    createModule
  };
}(window));

/* --- taskmda-tab-overflow-ui.js --- */
(function initTaskMdaTabOverflowUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaTabOverflowUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('global-tasks-view-tabs')?.addEventListener('click', (e) => {
        if (e?.target?.closest?.('.tab-overflow-wrap')) return;
        setTimeout(() => opts.refreshManagedTabOverflow?.(), 0);
      });

      document.getElementById('project-view-tabs-wrap')?.addEventListener('click', (e) => {
        if (e?.target?.closest?.('.tab-overflow-wrap')) return;
        setTimeout(() => opts.refreshManagedTabOverflow?.(), 0);
      });

      document.getElementById('workflow-view-tabs-list')?.addEventListener('click', (e) => {
        if (e?.target?.closest?.('.tab-overflow-wrap')) return;
        setTimeout(() => opts.refreshManagedTabOverflow?.(), 0);
        setTimeout(() => {
          opts.setActiveWorkflowSidebarGroup?.(opts.getActiveWorkflowGroupFromDom?.());
        }, 0);
      });

      document.getElementById('global-settings-tabs-list')?.addEventListener('click', (e) => {
        const tabBtn = e?.target?.closest?.('button[id^="global-settings-tab-"]');
        if (tabBtn?.id) {
          const tabKey = tabBtn.id.replace('global-settings-tab-', '');
          if (tabKey) opts.setGlobalSettingsTab?.(tabKey);
        }
        if (e?.target?.closest?.('.tab-overflow-wrap')) return;
        setTimeout(() => opts.refreshManagedTabOverflow?.(), 0);
      });

      global.addEventListener('resize', () => {
        opts.refreshManagedTabOverflow?.();
      });

      document.addEventListener('click', (e) => {
        if (e.target?.closest?.('.tab-overflow-wrap')) return;
        opts.closeAllTabOverflowMenus?.();
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDATabOverflowUI = {
    createModule
  };
}(window));

/* --- taskmda-doc-theme-pickers-ui.js --- */
(function initTaskMdaDocThemePickersUiModule(global) {
  // Module role: UI/domain boundary for TaskMdaDocThemePickersUiModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    let bound = false;

    function bindDom() {
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
      if (bound) return;
      bound = true;

      document.getElementById('project-doc-theme')?.addEventListener('input', () => {
        opts.syncThemePickerSelectionFromInput?.('project-doc-theme-known', 'project-doc-theme');
      });
      document.getElementById('project-doc-theme-known')?.addEventListener('change', () => {
        opts.syncThemePickerInputFromSelection?.('project-doc-theme-known', 'project-doc-theme');
      });
      document.getElementById('global-doc-upload-theme')?.addEventListener('input', () => {
        opts.syncThemePickerSelectionFromInput?.('global-doc-upload-theme-known', 'global-doc-upload-theme');
      });
      document.getElementById('global-doc-upload-theme-known')?.addEventListener('change', () => {
        opts.syncThemePickerInputFromSelection?.('global-doc-upload-theme-known', 'global-doc-upload-theme');
      });
    }

    return {
      bindDom
    };
  }

  global.TaskMDADocThemePickersUI = {
    createModule
  };
}(window));
