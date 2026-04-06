(function initTaskMdaProjectsUiModule(global) {
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
      setProjectsFilters({ query: '', theme: '', status: 'all', sharing: 'all', ownership: 'all', sort: 'recent' });
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

    document.getElementById('global-task-theme')?.addEventListener('input', () => {
      opts.syncThemePickerSelectionFromInput?.('global-task-theme-known', 'global-task-theme');
      setGlobalTasksPage(1);
      opts.renderGlobalTasks?.();
    });

    document.getElementById('global-task-theme-known')?.addEventListener('change', () => {
      const value = String(document.getElementById('global-task-theme-known')?.value || '');
      const input = document.getElementById('global-task-theme');
      if (input) input.value = value;
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

