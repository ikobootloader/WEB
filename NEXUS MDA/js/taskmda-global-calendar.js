(function initTaskMdaGlobalCalendarModule(global) {
  'use strict';

  function createModule(options) {
    const opts = options || {};
    const state = opts.state || {};
    const actions = opts.actions || {};
    const helpers = opts.helpers || {};
    let bound = false;

    function getPinnedThemes() {
      const value = state.getPinnedThemes?.();
      return Array.isArray(value) ? [...value] : [];
    }

    function setPinnedThemes(next) {
      state.setPinnedThemes?.(Array.isArray(next) ? next : []);
    }

    function getPinnedThemeChecks() {
      const value = state.getPinnedThemeChecks?.();
      return Array.isArray(value) ? [...value] : [];
    }

    function setPinnedThemeChecks(next) {
      state.setPinnedThemeChecks?.(Array.isArray(next) ? next : []);
    }

    function themeKey(value) {
      return String(helpers.normalizeCalendarThemeKey?.(value) || '').trim();
    }

    function pinThemeFromSelect() {
      actions.initGlobalCalendarPinnedThemesState?.();
      const select = document.getElementById('global-calendar-theme-pin-select');
      if (!select) return;
      const picked = String(helpers.normalizeCalendarThemeName?.(select.value) || '').trim();
      if (!picked) return;

      const pinnedThemes = getPinnedThemes();
      const checks = getPinnedThemeChecks();
      const pickedKey = themeKey(picked);

      if (!pinnedThemes.some((theme) => themeKey(theme) === pickedKey)) {
        pinnedThemes.push(picked);
      }
      if (!checks.some((theme) => themeKey(theme) === pickedKey)) {
        checks.push(picked);
      }
      setPinnedThemes(pinnedThemes);
      setPinnedThemeChecks(checks);
      helpers.syncPinnedCalendarThemeState?.();
      actions.renderGlobalCalendar?.();
    }

    function applyThemeMenuAction(action) {
      actions.initGlobalCalendarPinnedThemesState?.();
      const currentPinned = getPinnedThemes();
      if (action === 'check-all') {
        setPinnedThemeChecks(currentPinned);
      } else if (action === 'uncheck-all') {
        setPinnedThemeChecks([]);
      } else if (action === 'unpin-all') {
        setPinnedThemes([]);
        setPinnedThemeChecks([]);
      }
      helpers.syncPinnedCalendarThemeState?.();
      actions.toggleGlobalCalendarThemeActionsMenu?.(false);
      actions.renderGlobalCalendar?.();
    }

    function handleThemePinsChange(event) {
      actions.initGlobalCalendarPinnedThemesState?.();
      const target = event?.target;
      if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;
      const themeName = String(helpers.normalizeCalendarThemeName?.(target.getAttribute('data-calendar-theme-check') || '') || '').trim();
      if (!themeName) return;
      const key = themeKey(themeName);
      let checks = getPinnedThemeChecks();
      if (target.checked) {
        if (!checks.some((theme) => themeKey(theme) === key)) checks.push(themeName);
      } else {
        checks = checks.filter((theme) => themeKey(theme) !== key);
      }
      setPinnedThemeChecks(checks);
      helpers.syncPinnedCalendarThemeState?.();
      actions.renderGlobalCalendar?.();
    }

    function handleThemePinsClick(event) {
      actions.initGlobalCalendarPinnedThemesState?.();
      const btn = event?.target?.closest?.('[data-calendar-theme-unpin]');
      if (!btn) return;
      event.preventDefault();
      const themeName = String(helpers.normalizeCalendarThemeName?.(btn.getAttribute('data-calendar-theme-unpin') || '') || '').trim();
      if (!themeName) return;
      const key = themeKey(themeName);
      setPinnedThemes(getPinnedThemes().filter((theme) => themeKey(theme) !== key));
      setPinnedThemeChecks(getPinnedThemeChecks().filter((theme) => themeKey(theme) !== key));
      helpers.syncPinnedCalendarThemeState?.();
      actions.renderGlobalCalendar?.();
    }

    function jumpGlobalCalendarToToday() {
      const monthInput = document.getElementById('global-calendar-month');
      if (!monthInput) return;
      const now = new Date();
      actions.ensureGlobalCalendarMonthOption?.(monthInput, now.getFullYear(), now.getMonth());
      state.setSelectedDay?.(actions.toYmd?.(now));
      state.setSelectedMonth?.(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      actions.renderGlobalCalendar?.();
    }

    function resetGlobalCalendarFilters() {
      const searchInput = document.getElementById('global-calendar-search');
      const monthInput = document.getElementById('global-calendar-month');
      if (searchInput) searchInput.value = '';
      if (monthInput) {
        const base = new Date();
        monthInput.value = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
      }
      actions.resetStandaloneCalendarForm?.();
      state.setSelectedDay?.(null);
      state.setSelectedMonth?.(null);
      actions.renderGlobalCalendar?.();
    }

    function setGlobalCalendarItemFormEditing(isEditing) {
      const form = document.getElementById('global-calendar-item-form');
      if (!form) return;
      form.classList.toggle('is-editing', !!isEditing);
      const title = document.getElementById('calendar-item-form-title');
      if (title) title.textContent = isEditing ? 'Modifier info hors projet' : 'Ajouter info hors projet';
    }

    function openGlobalCalendarItemModal(prefillDate = '') {
      const modal = document.getElementById('modal-calendar-item-form');
      if (!modal) return;
      modal.classList.remove('hidden');
      if (prefillDate && /^\d{4}-\d{2}-\d{2}$/.test(String(prefillDate))) {
        const startDateInput = document.getElementById('global-calendar-item-date');
        const endDateInput = document.getElementById('global-calendar-item-end-date');
        const editingId = state.getEditingItemId?.();
        if (startDateInput && (!editingId || !startDateInput.value)) startDateInput.value = String(prefillDate);
        if (endDateInput && (!editingId || !endDateInput.value)) endDateInput.value = String(prefillDate);
      }
      document.getElementById('global-calendar-item-title')?.focus();
    }

    function closeGlobalCalendarItemModal() {
      document.getElementById('modal-calendar-item-form')?.classList.add('hidden');
    }

    function resetStandaloneCalendarForm(options = {}) {
      const keepDate = !!options.keepDate;
      actions.releaseActiveCalendarEditLock?.();
      const titleInput = document.getElementById('global-calendar-item-title');
      const startDateInput = document.getElementById('global-calendar-item-date');
      const endDateInput = document.getElementById('global-calendar-item-end-date');
      const startTimeInput = document.getElementById('global-calendar-item-start-time');
      const endTimeInput = document.getElementById('global-calendar-item-end-time');
      const themeInput = document.getElementById('global-calendar-item-theme');
      const notesInput = document.getElementById('global-calendar-item-notes');
      const modeInput = document.getElementById('global-calendar-item-mode');
      const submitBtn = document.getElementById('btn-global-calendar-add');
      if (titleInput) titleInput.value = '';
      if (startDateInput && !keepDate) startDateInput.value = '';
      if (endDateInput && !keepDate) endDateInput.value = '';
      if (startTimeInput) startTimeInput.value = '';
      if (endTimeInput) endTimeInput.value = '';
      if (themeInput) themeInput.value = '';
      if (notesInput) notesInput.value = '';
      if (modeInput) modeInput.value = 'private';
      state.setEditingItemId?.(null);
      if (submitBtn) submitBtn.textContent = 'Ajouter info hors projet';
      setGlobalCalendarItemFormEditing(false);
    }

    function bindDom() {
      if (bound) return;
      bound = true;

      document.getElementById('global-calendar-search')?.addEventListener('input', () => actions.renderGlobalCalendar?.());
      document.getElementById('global-calendar-month')?.addEventListener('change', () => {
        state.setSelectedDay?.(null);
        state.setSelectedMonth?.(null);
        actions.renderGlobalCalendar?.();
      });
      document.getElementById('global-calendar-view-list')?.addEventListener('click', () => {
        state.setViewMode?.(actions.resolveViewWithLock?.('globalCalendar', 'list', 'grid') || 'list');
        actions.renderGlobalCalendar?.();
      });
      document.getElementById('global-calendar-view-grid')?.addEventListener('click', () => {
        state.setViewMode?.(actions.resolveViewWithLock?.('globalCalendar', 'grid', 'grid') || 'grid');
        actions.renderGlobalCalendar?.();
      });
      document.getElementById('global-calendar-view-year')?.addEventListener('click', () => {
        state.setViewMode?.(actions.resolveViewWithLock?.('globalCalendar', 'year', 'grid') || 'year');
        state.setSelectedMonth?.(null);
        actions.renderGlobalCalendar?.();
      });
      document.getElementById('global-calendar-toggle-controls')?.addEventListener('click', () => {
        actions.initGlobalCalendarPinnedThemesState?.();
        const nextExpanded = !state.getControlsExpanded?.();
        actions.setGlobalCalendarControlsExpanded?.(nextExpanded);
      });
      document.getElementById('btn-global-calendar-pin-theme')?.addEventListener('click', () => {
        pinThemeFromSelect();
      });
      document.getElementById('btn-global-calendar-theme-actions-toggle')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        actions.toggleGlobalCalendarThemeActionsMenu?.();
      });
      document.getElementById('global-calendar-theme-actions-menu')?.addEventListener('click', (event) => {
        const btn = event.target?.closest?.('[data-calendar-theme-action]');
        if (!btn) return;
        event.preventDefault();
        applyThemeMenuAction(String(btn.getAttribute('data-calendar-theme-action') || '').trim());
      });
      document.addEventListener('click', (event) => {
        const wrap = event.target?.closest?.('.calendar-theme-actions-menu-wrap');
        if (wrap) return;
        actions.toggleGlobalCalendarThemeActionsMenu?.(false);
      });
      document.getElementById('global-calendar-theme-pins')?.addEventListener('change', (event) => {
        handleThemePinsChange(event);
      });
      document.getElementById('global-calendar-theme-pins')?.addEventListener('click', (event) => {
        handleThemePinsClick(event);
      });
      document.getElementById('global-calendar-prev-month')?.addEventListener('click', () => actions.shiftGlobalCalendarMonth?.(-1));
      document.getElementById('global-calendar-next-month')?.addEventListener('click', () => actions.shiftGlobalCalendarMonth?.(1));
      document.getElementById('global-calendar-today')?.addEventListener('click', () => jumpGlobalCalendarToToday());
      document.getElementById('btn-open-global-calendar-item-modal')?.addEventListener('click', () => {
        resetStandaloneCalendarForm();
        openGlobalCalendarItemModal(state.getSelectedDay?.() || actions.toYmd?.(new Date()));
      });
      document.getElementById('btn-close-calendar-item-form')?.addEventListener('click', () => {
        resetStandaloneCalendarForm();
        closeGlobalCalendarItemModal();
      });
      document.getElementById('btn-cancel-calendar-item-form')?.addEventListener('click', () => {
        resetStandaloneCalendarForm();
        closeGlobalCalendarItemModal();
      });
      document.getElementById('btn-global-calendar-add')?.addEventListener('click', () => actions.addStandaloneCalendarItem?.());
      document.getElementById('global-calendar-reset')?.addEventListener('click', () => {
        resetGlobalCalendarFilters();
      });
    }

    return {
      bindDom,
      renderGlobalCalendar: (...args) => actions.renderGlobalCalendar?.(...args),
      setGlobalCalendarItemFormEditing,
      openGlobalCalendarItemModal,
      closeGlobalCalendarItemModal,
      resetStandaloneCalendarForm,
      addStandaloneCalendarItem: (...args) => actions.addStandaloneCalendarItem?.(...args),
      editStandaloneCalendarItem: (...args) => actions.editStandaloneCalendarItem?.(...args),
      archiveStandaloneCalendarItem: (...args) => actions.archiveStandaloneCalendarItem?.(...args),
      deleteStandaloneCalendarItem: (...args) => actions.deleteStandaloneCalendarItem?.(...args),
      openStandaloneCalendarDetails: (...args) => actions.openStandaloneCalendarDetails?.(...args),
      closeStandaloneCalendarDetails: (...args) => actions.closeStandaloneCalendarDetails?.(...args)
    };
  }

  global.TaskMDAGlobalCalendar = {
    createModule
  };
}(window));
