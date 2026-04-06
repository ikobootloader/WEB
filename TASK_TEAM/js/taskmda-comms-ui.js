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

    document.getElementById('btn-global-feed-digest')?.addEventListener('click', () => {
      const input = document.getElementById('global-feed-digest-files');
      input?.click();
    });

    document.getElementById('global-feed-digest-files')?.addEventListener('change', async (event) => {
      const files = event?.target?.files;
      await opts.publishGlobalFeedDigestFromFiles?.(files);
      if (event?.target) event.target.value = '';
    });

    document.getElementById('btn-global-feed-insert-mention')?.addEventListener('click', () => {
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
    document.getElementById('global-doc-theme')?.addEventListener('input', () => opts.renderGlobalDocs?.());
    document.getElementById('global-doc-reset')?.addEventListener('click', () => {
      const search = document.getElementById('global-doc-search');
      const theme = document.getElementById('global-doc-theme');
      const files = document.getElementById('global-doc-files');
      const mode = document.getElementById('global-doc-mode');
      if (search) search.value = '';
      if (theme) theme.value = '';
      if (files) files.value = '';
      if (mode) mode.value = 'private';
      opts.renderGlobalDocs?.();
    });
    document.getElementById('btn-global-doc-add')?.addEventListener('click', () => {
      opts.trackUxMetric?.('openNewDocGlobal');
      opts.addStandaloneDocuments?.();
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
