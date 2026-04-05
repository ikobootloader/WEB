(function initTaskMdaWorkflowStore(global) {
  'use strict';

  function deepClone(value) {
    if (value === null || value === undefined) return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  function buildHistoryEntry(options) {
    const now = Number(options?.now || Date.now());
    const uid = String(options?.uid || `${now}-${Math.random().toString(16).slice(2, 8)}`);
    return {
      id: `wf-history-${uid}`,
      action: String(options?.action || 'update'),
      entityType: String(options?.entityType || ''),
      entityId: String(options?.entityId || ''),
      reason: String(options?.reason || ''),
      changedKeys: Array.isArray(options?.changedKeys) ? options.changedKeys.map((key) => String(key || '').trim()).filter(Boolean) : [],
      byUserId: String(options?.byUserId || 'system'),
      createdAt: now,
      beforeEntity: deepClone(options?.beforeEntity || null),
      afterEntity: deepClone(options?.afterEntity || null)
    };
  }

  function computeChangedKeys(beforeEntity, afterEntity) {
    const before = beforeEntity && typeof beforeEntity === 'object' ? beforeEntity : {};
    const after = afterEntity && typeof afterEntity === 'object' ? afterEntity : {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return Array.from(keys).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  }

  function sanitizeMapOptions(mapOptions) {
    const src = mapOptions && typeof mapOptions === 'object' ? mapOptions : {};
    const safe = {
      zoom: Number(src.zoom || 1),
      panX: Number(src.panX || 0),
      panY: Number(src.panY || 0),
      showStructure: src.showStructure !== false,
      showTransverse: src.showTransverse !== false,
      showApplicative: src.showApplicative !== false,
      showMinimap: src.showMinimap !== false,
      showAllStructure: src.showAllStructure === true,
      showAllTransverse: src.showAllTransverse === true,
      showAllApplicative: src.showAllApplicative === true,
      structureVisible: Number(src.structureVisible || 120),
      transverseVisible: Number(src.transverseVisible || 120),
      applicativeVisible: Number(src.applicativeVisible || 120),
      linkQuery: String(src.linkQuery || ''),
      linkSort: String(src.linkSort || 'source')
    };
    if (!Number.isFinite(safe.zoom) || safe.zoom < 0.6 || safe.zoom > 2.4) safe.zoom = 1;
    if (!Number.isFinite(safe.panX)) safe.panX = 0;
    if (!Number.isFinite(safe.panY)) safe.panY = 0;
    if (!Number.isFinite(safe.structureVisible) || safe.structureVisible < 40) safe.structureVisible = 120;
    if (!Number.isFinite(safe.transverseVisible) || safe.transverseVisible < 40) safe.transverseVisible = 120;
    if (!Number.isFinite(safe.applicativeVisible) || safe.applicativeVisible < 40) safe.applicativeVisible = 120;
    if (!['source', 'target', 'label'].includes(safe.linkSort)) safe.linkSort = 'source';
    return safe;
  }

  global.TaskMDAWorkflowStore = {
    buildHistoryEntry,
    sanitizeMapOptions,
    computeChangedKeys
  };
}(window));
