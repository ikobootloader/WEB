(function initTaskMdaGlobalMessagesModule(global) {
  'use strict';

  function createModule(options) {
    const opts = options || {};
    const actions = opts.actions || {};

    function bindDom() {
      // Intentionally minimal for phase 1; main bindings remain in orchestrator/comms-ui.
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

