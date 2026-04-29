(function initTaskMdaAdminUiModule(global) {
  'use strict';

  function bind(options) {
    const opts = options || {};
    if (global.__taskMdaAdminUiBound) return;
    global.__taskMdaAdminUiBound = true;

    const setRgpdViewMode = (value) => {
      if (typeof opts.setRgpdViewMode === 'function') opts.setRgpdViewMode(value);
    };
    const getRgpdFilters = () => (typeof opts.getRgpdFilters === 'function' ? opts.getRgpdFilters() : { query: '', status: 'all', risk: 'all' });
    const setRgpdFilters = (next) => {
      if (typeof opts.setRgpdFilters === 'function') opts.setRgpdFilters(next);
    };
    const setRgpdSelectedActivityId = (value) => {
      if (typeof opts.setRgpdSelectedActivityId === 'function') opts.setRgpdSelectedActivityId(value);
    };

    function bindGlobalNav(buttonId, view) {
      document.getElementById(buttonId)?.addEventListener('click', async (e) => {
        e.preventDefault();
        await opts.showGlobalWorkspace?.(view);
        opts.closeMobileSidebar?.();
      });
    }

    bindGlobalNav('nav-workflow', 'workflow');
    bindGlobalNav('nav-rgpd', 'rgpd');
    bindGlobalNav('nav-settings', 'settings');

    function bindRgpdTab(buttonId, mode) {
      document.getElementById(buttonId)?.addEventListener('click', async () => {
        setRgpdViewMode(mode);
        await opts.renderRgpdWorkspace?.();
      });
    }

    bindRgpdTab('rgpd-tab-records', 'records');
    bindRgpdTab('rgpd-tab-activities', 'activities');
    bindRgpdTab('rgpd-tab-drafts', 'drafts');
    bindRgpdTab('rgpd-tab-controls', 'controls');
    bindRgpdTab('rgpd-tab-journal', 'journal');

    document.getElementById('rgpd-search-input')?.addEventListener('input', async () => {
      const next = { ...getRgpdFilters(), query: String(document.getElementById('rgpd-search-input')?.value || '') };
      setRgpdFilters(next);
      await opts.renderRgpdWorkspace?.();
    });

    document.getElementById('rgpd-status-filter')?.addEventListener('change', async () => {
      const next = { ...getRgpdFilters(), status: String(document.getElementById('rgpd-status-filter')?.value || 'all') };
      setRgpdFilters(next);
      await opts.renderRgpdWorkspace?.();
    });

    document.getElementById('rgpd-risk-filter')?.addEventListener('change', async () => {
      const next = { ...getRgpdFilters(), risk: String(document.getElementById('rgpd-risk-filter')?.value || 'all') };
      setRgpdFilters(next);
      await opts.renderRgpdWorkspace?.();
    });

    document.getElementById('rgpd-filters-reset')?.addEventListener('click', async () => {
      setRgpdFilters({ query: '', status: 'all', risk: 'all' });
      const q = document.getElementById('rgpd-search-input');
      const s = document.getElementById('rgpd-status-filter');
      const r = document.getElementById('rgpd-risk-filter');
      if (q) q.value = '';
      if (s) s.value = 'all';
      if (r) r.value = 'all';
      await opts.renderRgpdWorkspace?.();
    });

    document.getElementById('rgpd-new-btn')?.addEventListener('click', async () => {
      await opts.createManualRgpdActivity?.();
      opts.showToast?.('Nouvelle activité RGPD créée');
    });

    document.getElementById('rgpd-detect-btn')?.addEventListener('click', async () => {
      const summary = await opts.runRgpdDetectionAndDrafts?.();
      opts.showToast?.(`Détection RGPD terminée: ${summary?.created || 0} activité(s) créée(s), ${summary?.assessed || 0} évaluation(s).`);
      await opts.renderRgpdWorkspace?.();
    });

    document.getElementById('rgpd-export-json-btn')?.addEventListener('click', async () => {
      await opts.exportRgpdJson?.();
      opts.showToast?.('Export RGPD JSON généré');
    });

    document.getElementById('rgpd-export-csv-btn')?.addEventListener('click', async () => {
      await opts.exportRgpdCsv?.();
      opts.showToast?.('Export RGPD CSV généré');
    });

    document.getElementById('rgpd-list')?.addEventListener('click', async (event) => {
      const target = event?.target instanceof HTMLElement ? event.target.closest('[data-rgpd-open]') : null;
      if (!(target instanceof HTMLElement)) return;
      const id = String(target.getAttribute('data-rgpd-open') || '').trim();
      if (!id) return;
      setRgpdSelectedActivityId(id);
      await opts.renderRgpdWorkspace?.();
    });

    document.getElementById('rgpd-detail-save-btn')?.addEventListener('click', async () => {
      await opts.saveSelectedRgpdActivity?.();
      opts.showToast?.('Fiche RGPD enregistrée');
    });

    document.getElementById('rgpd-detail-validate-btn')?.addEventListener('click', async () => {
      await opts.saveSelectedRgpdActivity?.({ statusOverride: 'validated' });
      opts.showToast?.('Fiche RGPD validée');
    });

    document.getElementById('rgpd-detail-archive-btn')?.addEventListener('click', async () => {
      await opts.saveSelectedRgpdActivity?.({ statusOverride: 'archived' });
      opts.showToast?.('Fiche RGPD archivée');
    });

    document.getElementById('rgpd-detail-delete-btn')?.addEventListener('click', async () => {
      await opts.deleteSelectedRgpdActivity?.();
      opts.showToast?.('Fiche RGPD supprimée');
    });

    opts.setupWorkflowRgpdBridgeObserver?.();
    document.addEventListener('click', async (event) => {
      const actionBtn = event?.target instanceof HTMLElement
        ? event.target.closest('[data-rgpd-context-action]')
        : null;
      if (!(actionBtn instanceof HTMLElement)) return;
      const action = String(actionBtn.getAttribute('data-rgpd-context-action') || '').trim();
      if (action === 'open') {
        const id = String(actionBtn.getAttribute('data-rgpd-activity-id') || '').trim();
        if (!id) return;
        setRgpdSelectedActivityId(id);
        await opts.showGlobalWorkspace?.('rgpd');
        await opts.renderRgpdWorkspace?.();
        return;
      }
      const sourceRef = {
        entityType: String(actionBtn.getAttribute('data-rgpd-source-type') || '').trim(),
        entityId: String(actionBtn.getAttribute('data-rgpd-source-id') || '').trim(),
        label: String(actionBtn.getAttribute('data-rgpd-source-label') || '').trim()
      };
      if (!sourceRef.entityType || !sourceRef.entityId) return;
      if (action === 'generate') {
        const activity = await opts.ensureRgpdActivityForSourceRef?.(sourceRef, { title: sourceRef.label || 'Source contextuelle' });
        if (activity?.id) {
          setRgpdSelectedActivityId(activity.id);
          opts.showToast?.('Fiche RGPD générée ou déjà liée');
        } else {
          opts.showToast?.('Impossible de générer la fiche RGPD');
        }
        await opts.refreshContextualRgpdCards?.();
        if (opts.isRgpdWorkspaceActive?.()) await opts.renderRgpdWorkspace?.();
        return;
      }
      if (action === 'link') {
        const activity = await opts.promptAndLinkRgpdActivity?.(sourceRef);
        if (activity?.id) {
          setRgpdSelectedActivityId(activity.id);
          opts.showToast?.('Fiche RGPD liée');
          await opts.refreshContextualRgpdCards?.();
          if (opts.isRgpdWorkspaceActive?.()) await opts.renderRgpdWorkspace?.();
        } else {
          opts.showToast?.('Aucune fiche RGPD sélectionnée');
        }
      }
    });

    document.getElementById('btn-save-app-branding')?.addEventListener('click', async () => {
      await opts.saveAppBrandingFromSettings?.(false);
    });
    document.getElementById('btn-reset-app-branding')?.addEventListener('click', async () => {
      await opts.saveAppBrandingFromSettings?.(true);
    });
    document.getElementById('btn-reset-test-data')?.addEventListener('click', async () => {
      await opts.resetAllLocalTestData?.();
    });
    document.getElementById('btn-assign-app-admin')?.addEventListener('click', () => {
      opts.assignAppAdminFromSettings?.();
    });

    document.getElementById('global-settings-tab-branding')?.addEventListener('click', () => opts.setGlobalSettingsTab?.('branding'));
    document.getElementById('global-settings-tab-themes')?.addEventListener('click', () => opts.setGlobalSettingsTab?.('themes'));
    document.getElementById('global-settings-tab-groups')?.addEventListener('click', () => opts.setGlobalSettingsTab?.('groups'));
    document.getElementById('global-settings-tab-roles')?.addEventListener('click', () => opts.setGlobalSettingsTab?.('roles'));
    document.getElementById('global-settings-tab-annuaire')?.addEventListener('click', () => opts.setGlobalSettingsTab?.('annuaire'));
    document.getElementById('global-settings-tab-file-watcher')?.addEventListener('click', () => opts.setGlobalSettingsTab?.('file-watcher'));
    document.getElementById('global-settings-tab-email')?.addEventListener('click', () => opts.setGlobalSettingsTab?.('email'));
    document.getElementById('global-settings-tab-views')?.addEventListener('click', () => opts.setGlobalSettingsTab?.('views'));

    document.getElementById('btn-global-settings-help')?.addEventListener('click', () => {
      opts.toggleGlobalSettingsHelp?.();
    });

    document.getElementById('view-options-matrix')?.addEventListener('change', async (e) => {
      await opts.handleViewOptionsChange?.(e);
    });
    document.getElementById('view-options-summary')?.addEventListener('change', async (e) => {
      await opts.handleViewOptionsChange?.(e);
    });
    document.getElementById('view-option-workflow-actions-mode')?.addEventListener('change', async (e) => {
      await opts.handleViewOptionsChange?.(e);
    });
    document.getElementById('view-options-matrix')?.addEventListener('click', async (e) => {
      await opts.handleViewOptionsClick?.(e);
    });
    document.getElementById('view-options-summary')?.addEventListener('click', async (e) => {
      await opts.handleViewOptionsClick?.(e);
    });

    document.getElementById('profanity-filter-mode-select')?.addEventListener('change', (e) => {
      const nextMode = String(e?.target?.value || '').trim();
      if (!nextMode) return;
      opts.setProfanityFilterMode?.(nextMode);
    });

    document.getElementById('btn-global-theme-add')?.addEventListener('click', async () => {
      await opts.createGlobalThemeFromSettings?.();
    });
    document.getElementById('btn-global-group-add')?.addEventListener('click', async () => {
      await opts.createGlobalGroupFromSettings?.();
    });
    document.getElementById('btn-global-role-add')?.addEventListener('click', async () => {
      await opts.createProjectRoleFromSettings?.();
    });
    document.getElementById('btn-software-add')?.addEventListener('click', async () => {
      await opts.createSoftwareVersionEntry?.();
    });

    document.getElementById('global-theme-name-input')?.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      await opts.createGlobalThemeFromSettings?.();
    });
    document.getElementById('global-group-name-input')?.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      await opts.createGlobalGroupFromSettings?.();
    });
    document.getElementById('global-role-name-input')?.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      await opts.createProjectRoleFromSettings?.();
    });
    document.getElementById('software-name-input')?.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      await opts.createSoftwareVersionEntry?.();
    });
    document.getElementById('software-version-input')?.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      await opts.createSoftwareVersionEntry?.();
    });
  }

  global.TaskMDAAdminUI = {
    bind
  };
}(window));
