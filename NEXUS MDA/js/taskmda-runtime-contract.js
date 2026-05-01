(function initTaskMdaRuntimeContractModule(global) {
  'use strict';

  function getGlobalFactory(moduleName, expectedMethodName) {
    const candidate = global[moduleName];
    if (!candidate) {
      return null;
    }
    const methodName = String(expectedMethodName || 'createModule').trim() || 'createModule';
    if (typeof candidate[methodName] !== 'function') {
      return null;
    }
    return candidate[methodName].bind(candidate);
  }

  function validateRequiredModules(requiredModules) {
    const required = Array.isArray(requiredModules) ? requiredModules : [];
    const missing = required
      .map((entry) => {
        if (typeof entry === 'string') {
          return { moduleName: entry, methodName: 'createModule' };
        }
        return {
          moduleName: String(entry?.moduleName || '').trim(),
          methodName: String(entry?.methodName || 'createModule').trim() || 'createModule'
        };
      })
      .filter((entry) => entry.moduleName)
      .filter((entry) => !getGlobalFactory(entry.moduleName, entry.methodName))
      .map((entry) => `${entry.moduleName}.${entry.methodName}`);
    if (missing.length > 0) {
      console.error('[TaskMDA RuntimeContract] Missing required modules:', missing);
    }
    return {
      ok: missing.length === 0,
      missing
    };
  }

  function buildDomainRegistry(definitions) {
    const list = Array.isArray(definitions) ? definitions : [];
    return list.map((entry) => {
      const domain = String(entry?.domain || '').trim();
      const moduleName = String(entry?.moduleName || '').trim();
      const required = entry?.required !== false;
      const methodName = String(entry?.methodName || 'createModule').trim() || 'createModule';
      const available = !!getGlobalFactory(moduleName, methodName);
      return { domain, moduleName, methodName, required, available };
    });
  }

  global.TaskMDARuntimeContract = {
    getGlobalFactory,
    validateRequiredModules,
    buildDomainRegistry
  };
}(window));
