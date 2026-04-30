(function initTaskMdaProjectsToolbarHeightModule(global) {
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
