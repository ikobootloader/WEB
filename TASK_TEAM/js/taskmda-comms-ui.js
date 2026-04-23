(function initTaskMdaCommsUiModule(global) {
  'use strict';

  function bind(options) {
    const opts = options || {};
    if (global.__taskMdaCommsUiBound) return;
    global.__taskMdaCommsUiBound = true;

    const setFeedSortMode = (value) => {
      if (typeof opts.setFeedSortMode === 'function') opts.setFeedSortMode(value);
    };
    const setFeedFilterMode = (value) => {
      if (typeof opts.setFeedFilterMode === 'function') opts.setFeedFilterMode(value);
    };
    const setGlobalFeedComposerCollapsed = (collapsed, options) => {
      if (typeof opts.setGlobalFeedComposerCollapsed === 'function') {
        opts.setGlobalFeedComposerCollapsed(collapsed, options || {});
      }
    };
    const openGlobalFeedComposerForNewPost = (options) => {
      if (typeof opts.openGlobalFeedComposerForNewPost === 'function') {
        opts.openGlobalFeedComposerForNewPost(options || {});
      } else {
        setGlobalFeedComposerCollapsed(false, options || {});
      }
    };
    const setGlobalMessageDiscoveryCollapsed = (collapsed) => {
      const section = document.getElementById('global-messages-section');
      const toggleBtn = document.getElementById('btn-toggle-global-message-sidebar');
      const icon = document.getElementById('global-message-sidebar-toggle-icon');
      const isCollapsed = Boolean(collapsed);
      section?.classList.toggle('is-discovery-collapsed', isCollapsed);
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
        toggleBtn.setAttribute('title', isCollapsed ? 'Afficher la découverte des groupes' : 'Réduire la découverte des groupes');
      }
      if (icon) {
        icon.textContent = isCollapsed ? 'chevron_left' : 'chevron_right';
      }
    };

    function bindGlobalNav(buttonId, view) {
      document.getElementById(buttonId)?.addEventListener('click', async (e) => {
        e.preventDefault();
        await opts.showGlobalWorkspace?.(view);
        opts.closeMobileSidebar?.();
      });
    }

    bindGlobalNav('nav-docs', 'docs');
    bindGlobalNav('nav-messages', 'messages');
    bindGlobalNav('nav-feed', 'feed');

    document.getElementById('btn-global-feed-post')?.addEventListener('click', async () => {
      await opts.publishGlobalFeedPost?.();
    });

    document.getElementById('btn-toggle-global-feed-composer')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-toggle-global-feed-composer');
      const expanded = String(btn?.getAttribute('aria-expanded') || 'false') === 'true';
      setGlobalFeedComposerCollapsed(expanded, { focusEditor: expanded });
    });

    document.getElementById('global-feed-composer-head-trigger')?.addEventListener('click', (event) => {
      if (event?.target?.closest?.('#btn-toggle-global-feed-composer')) return;
      const btn = document.getElementById('btn-toggle-global-feed-composer');
      const expanded = String(btn?.getAttribute('aria-expanded') || 'false') === 'true';
      setGlobalFeedComposerCollapsed(expanded, { focusEditor: expanded });
    });

    document.getElementById('global-feed-composer-head-trigger')?.addEventListener('keydown', (event) => {
      const key = String(event?.key || '');
      if (key !== 'Enter' && key !== ' ') return;
      event.preventDefault();
      const btn = document.getElementById('btn-toggle-global-feed-composer');
      const expanded = String(btn?.getAttribute('aria-expanded') || 'false') === 'true';
      setGlobalFeedComposerCollapsed(expanded, { focusEditor: expanded });
    });

    document.getElementById('btn-global-feed-digest')?.addEventListener('click', () => {
      openGlobalFeedComposerForNewPost({ focusEditor: false });
      const input = document.getElementById('global-feed-digest-files');
      const chosenMode = typeof opts.pickGlobalFeedDigestImportMode === 'function'
        ? opts.pickGlobalFeedDigestImportMode()
        : 'compact';
      if (chosenMode !== 'compact' && chosenMode !== 'full') return;
      if (input) input.dataset.importDigestView = chosenMode;
      input?.click();
    });

    document.getElementById('global-feed-digest-files')?.addEventListener('change', async (event) => {
      const files = event?.target?.files;
      const digestView = String(event?.target?.dataset?.importDigestView || '').toLowerCase();
      await opts.publishGlobalFeedDigestFromFiles?.(files, { digestView });
      if (event?.target) {
        event.target.value = '';
        delete event.target.dataset.importDigestView;
      }
    });

    document.getElementById('btn-global-feed-insert-mention')?.addEventListener('click', () => {
      openGlobalFeedComposerForNewPost({ focusEditor: true });
      opts.insertMentionTokenInGlobalFeed?.();
    });

    document.getElementById('global-feed-search')?.addEventListener('input', () => {
      opts.renderGlobalFeed?.();
    });

    document.getElementById('global-feed-sort')?.addEventListener('change', (e) => {
      const next = String(e?.target?.value || 'desc') === 'asc' ? 'asc' : 'desc';
      setFeedSortMode(next);
      opts.renderGlobalFeed?.();
    });

    function bindFeedFilter(buttonId, filterMode) {
      document.getElementById(buttonId)?.addEventListener('click', () => {
        const next = opts.resolveViewWithLock?.('globalFeed', filterMode, 'all') || filterMode;
        setFeedFilterMode(next);
        opts.renderGlobalFeed?.();
      });
    }

    bindFeedFilter('global-feed-filter-all', 'all');
    bindFeedFilter('global-feed-filter-auto', 'auto');
    bindFeedFilter('global-feed-filter-manual', 'manual');
    bindFeedFilter('global-feed-filter-mentions', 'mentions');
    bindFeedFilter('global-feed-filter-project-refs', 'project-refs');
    bindFeedFilter('global-feed-filter-task-refs', 'task-refs');

    document.getElementById('global-feed-input')?.addEventListener('input', () => {
      opts.updateGlobalFeedMentionCounter?.();
    });

    document.getElementById('global-feed-input')?.addEventListener('keydown', async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        await opts.publishGlobalFeedPost?.();
      }
    });

    document.getElementById('global-doc-search')?.addEventListener('input', () => opts.renderGlobalDocs?.());
    document.getElementById('global-doc-theme-filter')?.addEventListener('input', () => opts.renderGlobalDocs?.());
    document.getElementById('global-doc-reset')?.addEventListener('click', () => {
      const search = document.getElementById('global-doc-search');
      const themeFilter = document.getElementById('global-doc-theme-filter');
      const uploadTheme = document.getElementById('global-doc-upload-theme');
      const files = document.getElementById('global-doc-files');
      const mode = document.getElementById('global-doc-mode');
      if (search) search.value = '';
      if (themeFilter) themeFilter.value = '';
      if (uploadTheme) uploadTheme.value = '';
      if (files) files.value = '';
      if (mode) mode.value = 'private';
      opts.renderGlobalDocs?.();
    });
    document.getElementById('btn-global-doc-add')?.addEventListener('click', () => {
      opts.trackUxMetric?.('openNewDocGlobal');
      opts.addStandaloneDocuments?.();
    });

    document.getElementById('global-doc-files')?.addEventListener('change', (e) => {
      const files = e.target?.files || [];
      const label = document.getElementById('global-doc-files-label');
      if (label) {
        if (files.length === 0) {
          label.textContent = 'Aucun fichier choisi';
        } else if (files.length === 1) {
          label.textContent = files[0].name;
        } else {
          label.textContent = `${files.length} fichiers sélectionnés`;
        }
      }
    });

    document.getElementById('btn-toggle-docs-upload')?.addEventListener('click', () => {
      const body = document.getElementById('docs-upload-body');
      const btn = document.getElementById('btn-toggle-docs-upload');
      const icon = document.getElementById('docs-upload-toggle-icon');
      if (!body || !btn) return;
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
      btn.setAttribute('title', isExpanded ? 'Développer' : 'Réduire');
      body.classList.toggle('hidden', isExpanded);
      if (icon) {
        icon.textContent = isExpanded ? 'expand_more' : 'expand_less';
      }
    });

    document.getElementById('global-message-contact-search')?.addEventListener('input', async () => {
      if (typeof opts.setGlobalMessageContactsRenderLimit === 'function') {
        opts.setGlobalMessageContactsRenderLimit(opts.initialGlobalMessageContactsRenderLimit || 0);
      }
      await opts.renderGlobalMessages?.();
    });
    document.getElementById('global-message-contacts-list')?.addEventListener('scroll', async (event) => {
      await opts.handleGlobalMessageContactsScroll?.(event);
    });
    document.getElementById('global-message-thread')?.addEventListener('scroll', async (event) => {
      await opts.handleGlobalMessageThreadScroll?.(event);
    });
    document.getElementById('btn-global-message-select-all')?.addEventListener('click', async () => {
      await opts.selectAllGlobalMessageRecipients?.();
    });
    document.getElementById('btn-global-message-clear-selection')?.addEventListener('click', async () => {
      await opts.clearGlobalMessageRecipients?.();
    });
    document.getElementById('btn-global-message-open-group-channel')?.addEventListener('click', async () => {
      const select = document.getElementById('global-message-group-channel-select');
      const groupKey = String(select?.value || '').trim();
      if (!groupKey) return;
      await opts.openGlobalMessageGroupChannelFromCatalog?.(groupKey);
    });
    const globalMessageSidebarStorageKey = 'taskmda_global_message_sidebar_collapsed';
    const initialGlobalMessageSidebarCollapsed = String(localStorage.getItem(globalMessageSidebarStorageKey) || '') === '1';
    setGlobalMessageDiscoveryCollapsed(initialGlobalMessageSidebarCollapsed);
    document.getElementById('btn-toggle-global-message-sidebar')?.addEventListener('click', () => {
      const section = document.getElementById('global-messages-section');
      const nextCollapsed = !section?.classList.contains('is-discovery-collapsed');
      setGlobalMessageDiscoveryCollapsed(nextCollapsed);
      localStorage.setItem(globalMessageSidebarStorageKey, nextCollapsed ? '1' : '0');
    });
    document.getElementById('btn-global-send-message')?.addEventListener('click', async () => {
      await opts.sendGlobalMessage?.();
    });
    document.getElementById('btn-global-delete-conversation')?.addEventListener('click', async () => {
      await opts.deleteGlobalConversation?.();
    });
    document.getElementById('global-message-input')?.addEventListener('keydown', async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        await opts.sendGlobalMessage?.();
      }
    });
  }

  global.TaskMDACommsUI = {
    bind
  };
}(window));
