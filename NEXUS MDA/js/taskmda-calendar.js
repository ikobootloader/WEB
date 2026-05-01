/* TaskMDA Global Calendar Domain (manual, no-build) */
/* Extracted from taskmda-global.js during refactor */

/* --- taskmda-global-calendar.js --- */
(function initTaskMdaGlobalCalendarModule(global) {
  // Module role: UI/domain boundary for TaskMdaGlobalCalendarModule.
  'use strict';

  function createModule(options) {
    // Injected dependencies: callbacks/state accessors provided by taskmda-team orchestrator.
    const opts = options || {};
    const state = opts.state || {};
    const actions = opts.actions || {};
    const helpers = opts.helpers || {};
    let bound = false;
    let pinnedThemesInitialized = false;
    const GLOBAL_CALENDAR_PINNED_THEMES_KEY = 'taskmda_global_calendar_pinned_themes';
    const GLOBAL_CALENDAR_PINNED_THEME_CHECKS_KEY = 'taskmda_global_calendar_pinned_theme_checks';
    const GLOBAL_CALENDAR_CONTROLS_EXPANDED_KEY = 'taskmda_global_calendar_controls_expanded';
    const escapeHtml = typeof helpers.escapeHtml === 'function'
      ? helpers.escapeHtml
      : (value) => String(value || '');

    function readLocalArray(key) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((value) => String(value || '').trim()).filter(Boolean);
      } catch {
        return [];
      }
    }

    function writeLocalArray(key, values) {
      try {
        localStorage.setItem(
          key,
          JSON.stringify(Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))))
        );
      } catch {
        // Ignore storage write failures
      }
    }

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

    function syncPinnedCalendarThemeState() {
      const pinnedThemes = getPinnedThemes();
      const pinnedChecks = getPinnedThemeChecks();
      const pinnedKeys = new Set(pinnedThemes.map((theme) => themeKey(theme)).filter(Boolean));
      const dedupedPinned = pinnedThemes.filter((theme, index, arr) => {
        const key = themeKey(theme);
        return key && arr.findIndex((other) => themeKey(other) === key) === index;
      });
      const filteredChecks = pinnedChecks.filter((theme) => pinnedKeys.has(themeKey(theme)));
      setPinnedThemes(dedupedPinned);
      setPinnedThemeChecks(filteredChecks);
      writeLocalArray(GLOBAL_CALENDAR_PINNED_THEMES_KEY, dedupedPinned);
      writeLocalArray(GLOBAL_CALENDAR_PINNED_THEME_CHECKS_KEY, filteredChecks);
    }

    function initGlobalCalendarPinnedThemesState() {
      if (pinnedThemesInitialized) return;
      const normalizeName = (value) => String(helpers.normalizeCalendarThemeName?.(value) || '').trim();
      setPinnedThemes(readLocalArray(GLOBAL_CALENDAR_PINNED_THEMES_KEY).map(normalizeName).filter(Boolean));
      setPinnedThemeChecks(readLocalArray(GLOBAL_CALENDAR_PINNED_THEME_CHECKS_KEY).map(normalizeName).filter(Boolean));
      const expandedFromStorage = localStorage.getItem(GLOBAL_CALENDAR_CONTROLS_EXPANDED_KEY) !== '0';
      setGlobalCalendarControlsExpanded(expandedFromStorage, { skipPersist: true });
      syncPinnedCalendarThemeState();
      pinnedThemesInitialized = true;
    }

    function setGlobalCalendarControlsExpanded(expanded, options = {}) {
      const next = !!expanded;
      state.setControlsExpanded?.(next);
      const panel = document.getElementById('global-calendar-controls-panel');
      const top = document.querySelector('#global-calendar-section .calendar-toolbar-top');
      const toggleBtn = document.getElementById('global-calendar-toggle-controls');
      const toggleIcon = document.getElementById('global-calendar-toggle-controls-icon');
      const toggleLabel = document.getElementById('global-calendar-toggle-controls-label');
      if (panel) panel.classList.toggle('is-collapsed', !next);
      if (top) top.classList.toggle('mb-3', next);
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
        toggleBtn.setAttribute('title', next ? 'Masquer les filtres et outils' : 'Afficher les filtres et outils');
      }
      if (toggleIcon) toggleIcon.textContent = next ? 'expand_less' : 'expand_more';
      if (toggleLabel) toggleLabel.textContent = next ? 'Masquer les filtres' : 'Afficher les filtres';
      if (!options.skipPersist) {
        try {
          localStorage.setItem(GLOBAL_CALENDAR_CONTROLS_EXPANDED_KEY, next ? '1' : '0');
        } catch {
          // Ignore storage failures
        }
      }
    }

    function toggleGlobalCalendarThemeActionsMenu(forceOpen = null) {
      const menu = document.getElementById('global-calendar-theme-actions-menu');
      if (!menu) return;
      const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : menu.classList.contains('hidden');
      menu.classList.toggle('hidden', !shouldOpen);
    }

    function isPinnedCalendarThemeChecked(themeName) {
      const key = themeKey(themeName);
      return getPinnedThemeChecks().some((theme) => themeKey(theme) === key);
    }

    function renderGlobalCalendarThemePins(availableThemes = []) {
      const pinsWrap = document.getElementById('global-calendar-theme-pins');
      const select = document.getElementById('global-calendar-theme-pin-select');
      const counter = document.getElementById('global-calendar-theme-pin-counter');
      if (!pinsWrap || !select) return;

      const pinnedThemes = getPinnedThemes();
      const pinnedChecks = getPinnedThemeChecks();
      const normalizedAvailable = Array.from(new Set((availableThemes || []).map((theme) => String(helpers.normalizeCalendarThemeName?.(theme) || '').trim()).filter(Boolean)));
      const allKnown = Array.from(new Set([...normalizedAvailable, ...pinnedThemes.map((theme) => String(helpers.normalizeCalendarThemeName?.(theme) || '').trim()).filter(Boolean)]))
        .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

      select.innerHTML = `
        <option value="">Choisir une thematique a epingler...</option>
        ${allKnown
          .filter((theme) => !pinnedThemes.some((pinned) => themeKey(pinned) === themeKey(theme)))
          .map((theme) => `<option value="${escapeHtml(theme)}">${escapeHtml(theme)}</option>`)
          .join('')}
      `;

      if (pinnedThemes.length === 0) {
        pinsWrap.innerHTML = '<p class="text-xs text-slate-500">Aucune thematique epinglee.</p>';
        if (counter) counter.textContent = '(0/0 actives)';
        return;
      }
      if (counter) {
        counter.textContent = `(${pinnedChecks.length}/${pinnedThemes.length} actives)`;
      }

      pinsWrap.innerHTML = pinnedThemes.map((theme) => `
        <label class="calendar-theme-pin-chip">
          <input type="checkbox" data-calendar-theme-check="${escapeHtml(theme)}" ${isPinnedCalendarThemeChecked(theme) ? 'checked' : ''}>
          <span>${escapeHtml(theme)}</span>
          <button type="button" class="calendar-theme-pin-unpin" data-calendar-theme-unpin="${escapeHtml(theme)}" aria-label="Desepingler ${escapeHtml(theme)}">x</button>
        </label>
      `).join('');
    }

    function pinThemeFromSelect() {
      initGlobalCalendarPinnedThemesState();
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
      syncPinnedCalendarThemeState();
      actions.renderGlobalCalendar?.();
    }

    function applyThemeMenuAction(action) {
      initGlobalCalendarPinnedThemesState();
      const currentPinned = getPinnedThemes();
      if (action === 'check-all') {
        setPinnedThemeChecks(currentPinned);
      } else if (action === 'uncheck-all') {
        setPinnedThemeChecks([]);
      } else if (action === 'unpin-all') {
        setPinnedThemes([]);
        setPinnedThemeChecks([]);
      }
      syncPinnedCalendarThemeState();
      toggleGlobalCalendarThemeActionsMenu(false);
      actions.renderGlobalCalendar?.();
    }

    function handleThemePinsChange(event) {
      initGlobalCalendarPinnedThemesState();
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
      syncPinnedCalendarThemeState();
      actions.renderGlobalCalendar?.();
    }

    function handleThemePinsClick(event) {
      initGlobalCalendarPinnedThemesState();
      const btn = event?.target?.closest?.('[data-calendar-theme-unpin]');
      if (!btn) return;
      event.preventDefault();
      const themeName = String(helpers.normalizeCalendarThemeName?.(btn.getAttribute('data-calendar-theme-unpin') || '') || '').trim();
      if (!themeName) return;
      const key = themeKey(themeName);
      setPinnedThemes(getPinnedThemes().filter((theme) => themeKey(theme) !== key));
      setPinnedThemeChecks(getPinnedThemeChecks().filter((theme) => themeKey(theme) !== key));
      syncPinnedCalendarThemeState();
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
      // DOM bindings are attached once; module remains idempotent across repeated init calls.
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
        initGlobalCalendarPinnedThemesState();
        const nextExpanded = !state.getControlsExpanded?.();
        setGlobalCalendarControlsExpanded(nextExpanded);
      });
      document.getElementById('btn-global-calendar-pin-theme')?.addEventListener('click', () => {
        pinThemeFromSelect();
      });
      document.getElementById('btn-global-calendar-theme-actions-toggle')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleGlobalCalendarThemeActionsMenu();
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
        toggleGlobalCalendarThemeActionsMenu(false);
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
      initGlobalCalendarPinnedThemesState,
      syncPinnedCalendarThemeState,
      setGlobalCalendarControlsExpanded,
      toggleGlobalCalendarThemeActionsMenu,
      renderGlobalCalendar: (...args) => actions.renderGlobalCalendar?.(...args),
      renderGlobalCalendarThemePins,
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

/* --- taskmda-global-docs.js --- */
