(function initTaskMdaGlobalFeedModule(global) {
  'use strict';

  function createModule(options) {
    const opts = options || {};
    const actions = opts.actions || {};

    function bindDom() {
      document.getElementById('global-feed-filter-tabs')?.addEventListener('click', (event) => {
        if (event?.target?.closest?.('.tab-overflow-wrap')) return;
        setTimeout(() => actions.refreshManagedTabOverflow?.(), 0);
      });
    }

    return {
      bindDom,
      renderGlobalFeed: (...args) => actions.renderGlobalFeed?.(...args),
      publishGlobalFeedPost: (...args) => actions.publishGlobalFeedPost?.(...args),
      publishGlobalFeedDigestFromFiles: (...args) => actions.publishGlobalFeedDigestFromFiles?.(...args),
      pickGlobalFeedDigestImportMode: (...args) => actions.pickGlobalFeedDigestImportMode?.(...args),
      insertMentionTokenInGlobalFeed: (...args) => actions.insertMentionTokenInGlobalFeed?.(...args),
      setGlobalFeedComposerCollapsed: (...args) => actions.setGlobalFeedComposerCollapsed?.(...args),
      openGlobalFeedComposerForNewPost: (...args) => actions.openGlobalFeedComposerForNewPost?.(...args),
      updateGlobalFeedMentionCounter: (...args) => actions.updateGlobalFeedMentionCounter?.(...args),
      openGlobalFeedPost: (...args) => actions.openGlobalFeedPost?.(...args)
    };
  }

  global.TaskMDAGlobalFeed = {
    createModule
  };
}(window));
