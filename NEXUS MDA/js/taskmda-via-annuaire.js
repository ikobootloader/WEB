(function initTaskMdaViaAnnuaireUiModule(global) {
  'use strict';

  function createModule(options) {
    const opts = options || {};
    const initialState = opts.initialState || {};
    const internalState = {
      liveSearchState: initialState.liveSearchState && typeof initialState.liveSearchState === 'object'
        ? initialState.liveSearchState
        : {},
      runtimeCache: initialState.runtimeCache && typeof initialState.runtimeCache === 'object'
        ? initialState.runtimeCache
        : {},
      rorUnavailable: !!initialState.rorUnavailable,
      rorUnavailableReason: String(initialState.rorUnavailableReason || ''),
      rorProbeDone: !!initialState.rorProbeDone,
      rorSettingsLoaded: !!initialState.rorSettingsLoaded,
      rorSettingsCache: initialState.rorSettingsCache && typeof initialState.rorSettingsCache === 'object'
        ? initialState.rorSettingsCache
        : {},
      rorEmailCache: initialState.rorEmailCache instanceof Map ? initialState.rorEmailCache : new Map(),
      rorOrganizationCache: initialState.rorOrganizationCache instanceof Map ? initialState.rorOrganizationCache : new Map(),
      viaAnnuaireConfigExpanded: typeof initialState.viaAnnuaireConfigExpanded === 'boolean'
        ? initialState.viaAnnuaireConfigExpanded
        : true
    };
    const state = {
      getLiveSearchState: opts.state?.getLiveSearchState || (() => internalState.liveSearchState),
      setLiveSearchState: opts.state?.setLiveSearchState || ((value) => {
        if (value && typeof value === 'object') internalState.liveSearchState = value;
      }),
      getRuntimeCache: opts.state?.getRuntimeCache || (() => internalState.runtimeCache),
      setRuntimeCache: opts.state?.setRuntimeCache || ((value) => {
        if (value && typeof value === 'object') internalState.runtimeCache = value;
      }),
      getRorUnavailable: opts.state?.getRorUnavailable || (() => internalState.rorUnavailable),
      setRorUnavailable: opts.state?.setRorUnavailable || ((value) => {
        internalState.rorUnavailable = !!value;
      }),
      getRorUnavailableReason: opts.state?.getRorUnavailableReason || (() => internalState.rorUnavailableReason),
      setRorUnavailableReason: opts.state?.setRorUnavailableReason || ((value) => {
        internalState.rorUnavailableReason = String(value || '');
      }),
      getRorProbeDone: opts.state?.getRorProbeDone || (() => internalState.rorProbeDone),
      setRorProbeDone: opts.state?.setRorProbeDone || ((value) => {
        internalState.rorProbeDone = !!value;
      }),
      getRorSettingsLoaded: opts.state?.getRorSettingsLoaded || (() => internalState.rorSettingsLoaded),
      setRorSettingsLoaded: opts.state?.setRorSettingsLoaded || ((value) => {
        internalState.rorSettingsLoaded = !!value;
      }),
      getRorSettingsCache: opts.state?.getRorSettingsCache || (() => internalState.rorSettingsCache),
      setRorSettingsCache: opts.state?.setRorSettingsCache || ((value) => {
        internalState.rorSettingsCache = value && typeof value === 'object' ? value : {};
      }),
      getRorEmailCache: opts.state?.getRorEmailCache || (() => internalState.rorEmailCache),
      clearRorEmailCache: opts.state?.clearRorEmailCache || (() => {
        internalState.rorEmailCache.clear();
      }),
      getRorOrganizationCache: opts.state?.getRorOrganizationCache || (() => internalState.rorOrganizationCache),
      clearRorOrganizationCache: opts.state?.clearRorOrganizationCache || (() => {
        internalState.rorOrganizationCache.clear();
      }),
      getViaAnnuaireConfigExpanded: opts.state?.getViaAnnuaireConfigExpanded || (() => internalState.viaAnnuaireConfigExpanded)
    };
    const actions = opts.actions || {};
    const helpers = opts.helpers || {};

    function getViaAnnuaireLiveDepartments() {
      const runtimeCache = state.getRuntimeCache?.() || {};
      const runtime = Array.isArray(runtimeCache?.departements)
        ? runtimeCache.departements.filter((item) => actions.normalizeViaAnnuaireDepartmentCode?.(item?.id))
        : [];
      if (runtime.length > 0) return runtime;
      return actions.getViaAnnuaireFallbackDepartments?.() || [];
    }

    function readViaAnnuaireLiveSearchInputs() {
      const domainInput = document.getElementById('via-annuaire-live-domain');
      const departmentInput = document.getElementById('via-annuaire-live-departement');
      const keywordInput = document.getElementById('via-annuaire-live-keyword');
      const sortInput = document.getElementById('via-annuaire-live-sort');
      return {
        domain: actions.normalizeViaAnnuaireLiveDomain?.(domainInput?.value),
        departmentCode: actions.normalizeViaAnnuaireDepartmentCode?.(departmentInput?.value),
        keyword: String(keywordInput?.value || '').trim(),
        sortKey: actions.normalizeViaAnnuaireLiveSortKey?.(sortInput?.value)
      };
    }

    async function renderViaAnnuaireSettingsPanel(options = {}) {
      const canManageBranding = options.canManageBranding !== false;
      const viaAnnuaireStatus = document.getElementById('via-annuaire-status');
      const viaAnnuaireRorEndpointInput = document.getElementById('via-annuaire-ror-endpoint-input');
      const viaAnnuaireRorApiKeyInput = document.getElementById('via-annuaire-ror-apikey-input');
      const viaAnnuaireRorSaveBtn = document.getElementById('btn-via-annuaire-ror-save');
      const viaAnnuaireRorTestBtn = document.getElementById('btn-via-annuaire-ror-test');
      const viaAnnuaireRorHint = document.getElementById('via-annuaire-ror-hint');
      const viaAnnuaireLastSync = document.getElementById('via-annuaire-last-sync');
      const viaAnnuaireSummary = document.getElementById('via-annuaire-summary');
      const viaAnnuaireConfigToggleBtn = document.getElementById('btn-via-annuaire-config-toggle');
      const viaAnnuaireLiveDomain = document.getElementById('via-annuaire-live-domain');
      const viaAnnuaireLiveDepartment = document.getElementById('via-annuaire-live-departement');
      const viaAnnuaireLiveKeyword = document.getElementById('via-annuaire-live-keyword');
      const viaAnnuaireLiveSort = document.getElementById('via-annuaire-live-sort');
      const viaAnnuaireLiveSearchBtn = document.getElementById('btn-via-annuaire-live-search');
      const viaAnnuaireLivePrevBtn = document.getElementById('btn-via-annuaire-live-prev');
      const viaAnnuaireLiveNextBtn = document.getElementById('btn-via-annuaire-live-next');

      await ensureViaAnnuaireRorSettingsLoaded();
      await syncViaAnnuaireDepartmentsFromApi({ silent: true });
      const rorEndpoint = getViaAnnuaireRorFhirEndpoint();
      const rorHasApiKey = hasViaAnnuaireRorApiKey();
      let endpointInputValue = rorEndpoint;
      const prefillOnceKey = String(actions.getViaAnnuaireRorPrefillOnceKey?.() || '');
      if (!endpointInputValue && prefillOnceKey && !localStorage.getItem(prefillOnceKey)) {
        endpointInputValue = String(actions.getDefaultViaAnnuaireRorEndpoint?.() || '');
        if (endpointInputValue) {
          localStorage.setItem(prefillOnceKey, '1');
        }
      }
      if (viaAnnuaireRorEndpointInput) {
        viaAnnuaireRorEndpointInput.value = endpointInputValue;
        viaAnnuaireRorEndpointInput.disabled = !canManageBranding;
      }
      if (viaAnnuaireRorApiKeyInput) {
        viaAnnuaireRorApiKeyInput.value = String((state.getRorSettingsCache?.() || {})?.apiKey || '');
        viaAnnuaireRorApiKeyInput.disabled = !canManageBranding;
      }
      if (viaAnnuaireRorSaveBtn) viaAnnuaireRorSaveBtn.disabled = !canManageBranding;
      if (viaAnnuaireRorTestBtn) viaAnnuaireRorTestBtn.disabled = !canManageBranding;
      if (viaAnnuaireConfigToggleBtn) viaAnnuaireConfigToggleBtn.disabled = false;
      actions.setViaAnnuaireConfigExpanded?.(!!state.getViaAnnuaireConfigExpanded?.(), { skipPersist: true });

      if (viaAnnuaireRorHint) {
        const endpointConfiguredOrPrefilled = !!String(rorEndpoint || endpointInputValue || '').trim();
        const prefillPendingSave = !rorEndpoint && !!endpointInputValue;
        viaAnnuaireRorHint.textContent = hasViaAnnuaireRorCredentials()
          ? (rorHasApiKey
            ? 'Endpoint Annuaire Santé configuré (avec clé API).'
            : 'Endpoint Annuaire Santé configuré (mode sans clé API, si autorisé par le plan).')
          : (prefillPendingSave
            ? 'Endpoint pré-rempli. Cliquez sur Enregistrer (clé API optionnelle selon le plan).'
            : `Configuration incomplète: endpoint ${endpointConfiguredOrPrefilled ? 'OK' : 'manquant'}.`);
      }

      if (viaAnnuaireLiveDomain) viaAnnuaireLiveDomain.disabled = false;
      if (viaAnnuaireLiveDepartment) viaAnnuaireLiveDepartment.disabled = false;
      if (viaAnnuaireLiveKeyword) viaAnnuaireLiveKeyword.disabled = false;
      if (viaAnnuaireLiveSort) viaAnnuaireLiveSort.disabled = false;
      const liveState = state.getLiveSearchState?.() || {};
      if (viaAnnuaireLiveSearchBtn) viaAnnuaireLiveSearchBtn.disabled = !!liveState.loading;
      if (viaAnnuaireLivePrevBtn) viaAnnuaireLivePrevBtn.disabled = true;
      if (viaAnnuaireLiveNextBtn) viaAnnuaireLiveNextBtn.disabled = true;

      if (viaAnnuaireStatus) {
        const hasRorConfig = hasViaAnnuaireRorCredentials();
        const isRorUnavailable = !!state.getRorUnavailable?.();
        const rorUnavailableReason = String(state.getRorUnavailableReason?.() || '');
        viaAnnuaireStatus.textContent = !hasRorConfig
          ? 'Source: FINESS public (Annuaire Santé non configuré)'
          : (isRorUnavailable
            ? `Source: FINESS public (Annuaire Santé indisponible${rorUnavailableReason ? `: ${rorUnavailableReason}` : ''})`
            : (rorHasApiKey
              ? 'Source: FINESS public + Annuaire Santé (best effort, avec clé API)'
              : 'Source: FINESS public + Annuaire Santé (best effort, mode sans clé API)'));
        viaAnnuaireStatus.className = !hasRorConfig
          ? 'text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700'
          : (isRorUnavailable
            ? 'text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800'
            : 'text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700');
      }

      const runtimeCache = state.getRuntimeCache?.() || {};
      if (viaAnnuaireLastSync) {
        viaAnnuaireLastSync.textContent = Number(runtimeCache.lastDepartmentsSyncAt || 0) > 0
          ? `Dernière mise à jour des départements: ${new Date(runtimeCache.lastDepartmentsSyncAt).toLocaleString('fr-FR')}`
          : 'Dernière mise à jour des départements: jamais';
      }
      if (viaAnnuaireSummary) {
        viaAnnuaireSummary.textContent = liveState.lastQueryLabel
          ? `Dernière recherche: ${liveState.lastQueryLabel}`
          : 'Aucune recherche annuaire lancée.';
      }
      renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
    }

    async function syncViaAnnuaireDepartmentsFromApi(options = {}) {
      const force = !!options.force;
      const silent = !!options.silent;
      const runtimeCache = state.getRuntimeCache?.() || {};
      const hasCache = Array.isArray(runtimeCache?.departements) && runtimeCache.departements.length > 0;
      if (hasCache && !force) {
        return runtimeCache.departements;
      }
      try {
        const payload = await actions.fetchViaAnnuairePublicApiRecords?.({
          limit: 120,
          offset: 0,
          orderBy: 'dep_code',
          select: 'dep_code,dep_name',
          where: 'dep_code is not null',
          groupBy: 'dep_code,dep_name'
        }, 20000);
        const deps = Array.isArray(payload?.results)
          ? payload.results.map((row) => ({
              id: actions.normalizeViaAnnuaireDepartmentCode?.(row?.dep_code),
              nom: String(row?.dep_name || row?.dep_code || '').trim(),
              region: ''
            })).filter((row) => row.id && row.nom)
          : [];
        if (deps.length > 0) {
          const uniqueById = new Map();
          deps.forEach((dep) => {
            if (!uniqueById.has(dep.id)) uniqueById.set(dep.id, dep);
          });
          state.setRuntimeCache?.({
            ...runtimeCache,
            departements: [...uniqueById.values()],
            lastDepartmentsSyncAt: Date.now()
          });
          return (state.getRuntimeCache?.() || {}).departements || [];
        }
        throw new Error('Aucun département retourné');
      } catch (error) {
        if (!silent) {
          helpers.showToast?.(`Lecture départements impossible: ${String(error?.message || 'erreur')}`);
        }
        const fallback = actions.getViaAnnuaireFallbackDepartments?.() || [];
        state.setRuntimeCache?.({
          ...runtimeCache,
          departements: fallback
        });
        return (state.getRuntimeCache?.() || {}).departements || [];
      }
    }

    function renderViaAnnuaireLiveSearchPanel(options = {}) {
      const domainInput = document.getElementById('via-annuaire-live-domain');
      const departmentInput = document.getElementById('via-annuaire-live-departement');
      const keywordInput = document.getElementById('via-annuaire-live-keyword');
      const sortInput = document.getElementById('via-annuaire-live-sort');
      const summary = document.getElementById('via-annuaire-summary');
      const lastSync = document.getElementById('via-annuaire-last-sync');
      const searchBtn = document.getElementById('btn-via-annuaire-live-search');
      const prevBtn = document.getElementById('btn-via-annuaire-live-prev');
      const nextBtn = document.getElementById('btn-via-annuaire-live-next');
      const auditToggleBtn = document.getElementById('btn-via-annuaire-live-audit-toggle');
      const meta = document.getElementById('via-annuaire-live-meta');
      const results = document.getElementById('via-annuaire-live-results');
      if (!domainInput || !departmentInput || !keywordInput || !sortInput || !searchBtn || !prevBtn || !nextBtn || !meta || !results) return;

      const currentState = state.getLiveSearchState?.() || {};
      const runtimeCache = state.getRuntimeCache?.() || {};
      const isRorUnavailable = !!state.getRorUnavailable?.();
      const rorUnavailableReason = String(state.getRorUnavailableReason?.() || '');
      const status = document.getElementById('via-annuaire-status');
      if (summary) {
        summary.textContent = currentState.lastQueryLabel
          ? `Dernière recherche: ${currentState.lastQueryLabel}`
          : 'Aucune recherche annuaire lancée.';
      }
      if (status) {
        const hasRorConfig = hasViaAnnuaireRorCredentials();
        const rorHasApiKey = hasViaAnnuaireRorApiKey();
        status.textContent = !hasRorConfig
          ? 'Source: FINESS public (Annuaire Santé non configuré)'
          : (isRorUnavailable
            ? `Source: FINESS public (Annuaire Santé indisponible${rorUnavailableReason ? `: ${rorUnavailableReason}` : ''})`
            : (rorHasApiKey
              ? 'Source: FINESS public + Annuaire Santé (best effort, avec clé API)'
              : 'Source: FINESS public + Annuaire Santé (best effort, mode sans clé API)'));
        status.className = !hasRorConfig
          ? 'text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700'
          : (isRorUnavailable
            ? 'text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800'
            : 'text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700');
      }
      if (lastSync) {
        const ts = Number(runtimeCache.lastDepartmentsSyncAt || 0);
        lastSync.textContent = ts > 0
          ? `Dernière mise à jour des départements: ${new Date(ts).toLocaleString('fr-FR')}`
          : 'Dernière mise à jour des départements: jamais';
      }
      const departments = getViaAnnuaireLiveDepartments();
      const previousDepartment = actions.normalizeViaAnnuaireDepartmentCode?.(options.keepSelection
        ? currentState.departmentCode
        : (departmentInput.value || currentState.departmentCode));
      const departmentOptions = departments
        .slice()
        .sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || ''), 'fr'))
        .map((dep) => {
          const id = actions.normalizeViaAnnuaireDepartmentCode?.(dep?.id);
          const label = String(dep?.nom || dep?.id || '').trim() || id;
          return `<option value="${helpers.escapeHtml?.(id)}">${helpers.escapeHtml?.(label)}</option>`;
        });
      departmentInput.innerHTML = `<option value="">Département...</option>${departmentOptions.join('')}`;
      if (previousDepartment && departments.some((dep) => actions.normalizeViaAnnuaireDepartmentCode?.(dep?.id) === previousDepartment)) {
        departmentInput.value = previousDepartment;
      } else if (departments.some((dep) => actions.normalizeViaAnnuaireDepartmentCode?.(dep?.id) === '61')) {
        departmentInput.value = '61';
      }

      domainInput.value = actions.normalizeViaAnnuaireLiveDomain?.(currentState.domain);
      keywordInput.value = String(currentState.keyword || '');
      sortInput.value = actions.normalizeViaAnnuaireLiveSortKey?.(currentState.sortKey);

      const sortedRows = actions.sortViaAnnuaireLiveResults?.(currentState.results, currentState.sortKey) || [];
      const auditCounts = { ok: 0, close: 0, incomplete: 0, different: 0, pending: 0 };
      if (currentState.auditMode) {
        sortedRows.forEach((row) => {
          const statusKey = String(currentState.auditByRef?.[row?.ref]?.status || '').trim();
          if (statusKey === 'ok') auditCounts.ok += 1;
          else if (statusKey === 'close') auditCounts.close += 1;
          else if (statusKey === 'incomplete') auditCounts.incomplete += 1;
          else if (statusKey === 'different') auditCounts.different += 1;
          else auditCounts.pending += 1;
        });
      }
      const hasResults = sortedRows.length > 0;
      const total = Math.max(0, Number(currentState.total || 0));
      const pageSize = Math.max(1, Number(currentState.pageSize || 12));
      const pageIndex = Math.max(0, Number(currentState.pageIndex || 0));
      const start = total === 0 ? 0 : (pageIndex * pageSize) + 1;
      const end = total === 0 ? 0 : Math.min(total, (pageIndex + 1) * pageSize);
      const canPrev = pageIndex > 0 && !currentState.loading;
      const canNext = end < total && !currentState.loading;
      prevBtn.disabled = !canPrev;
      nextBtn.disabled = !canNext;
      searchBtn.disabled = !!currentState.loading;
      const searchBtnLabelText = currentState.loading ? 'Recherche...' : 'Rechercher';
      const searchBtnIcon = searchBtn.querySelector('.taskmda-action-icon, .material-symbols-outlined');
      if (searchBtnIcon) {
        searchBtnIcon.textContent = currentState.loading ? 'progress_activity' : 'search';
      }
      searchBtn.setAttribute('data-action-kind', 'open');
      searchBtn.setAttribute('data-action-label', searchBtnLabelText);
      searchBtn.setAttribute('aria-label', searchBtnLabelText);
      searchBtn.setAttribute('data-ui-tooltip', searchBtnLabelText);
      let searchBtnLabel = searchBtn.querySelector('.taskmda-action-label');
      if (!searchBtnLabel) {
        searchBtnLabel = document.createElement('span');
        searchBtnLabel.className = 'taskmda-action-label';
        searchBtn.appendChild(searchBtnLabel);
      }
      searchBtnLabel.textContent = searchBtnLabelText;
      Array.from(searchBtn.childNodes).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && String(node.textContent || '').trim()) {
          searchBtn.removeChild(node);
        }
      });
      if (auditToggleBtn) {
        const modeOn = !!currentState.auditMode;
        auditToggleBtn.textContent = modeOn ? 'Audit: ON' : 'Audit: OFF';
        auditToggleBtn.className = modeOn
          ? 'px-2 py-1 rounded border border-blue-300 bg-blue-50 text-blue-800 text-[11px] font-semibold'
          : 'px-2 py-1 rounded border border-slate-300 text-slate-700 text-[11px] font-semibold';
      }

      if (currentState.loading) {
        meta.textContent = 'Recherche en cours...';
      } else if (currentState.lastError) {
        meta.textContent = `Erreur: ${currentState.lastError}`;
      } else if (total > 0) {
        const audited = currentState.auditMode
          ? Object.keys(currentState.auditByRef || {}).length
          : 0;
        meta.textContent = currentState.auditMode
          ? `${currentState.lastQueryLabel || 'Résultats'} • ${start}-${end} / ${total} • audit ${audited} ligne(s) • OK ${auditCounts.ok} • Proche ${auditCounts.close} • Incomplet ${auditCounts.incomplete}${auditCounts.pending ? ` • En attente ${auditCounts.pending}` : ''}`
          : `${currentState.lastQueryLabel || 'Résultats'} • ${start}-${end} / ${total}`;
      } else {
        meta.textContent = 'Aucune recherche effectuée.';
      }

      if (currentState.loading) {
        results.innerHTML = '<p class="text-xs text-slate-500 p-3">Interrogation de l\'annuaire en cours...</p>';
        return;
      }
      if (currentState.lastError) {
        results.innerHTML = `<p class="text-xs text-red-600 p-3">${helpers.escapeHtml?.(currentState.lastError)}</p>`;
        return;
      }
      if (!hasResults) {
        results.innerHTML = '<p class="text-xs text-slate-500 p-3">Aucun établissement trouvé pour cette recherche.</p>';
        return;
      }

      results.innerHTML = sortedRows.map((item) => {
        const audit = currentState.auditMode ? currentState.auditByRef?.[item.ref] : null;
        const auditMeta = actions.getViaAnnuaireAuditBadgeMeta?.(audit?.status) || { label: '', className: '' };
        const auditBreakdown = actions.computeViaAnnuaireAuditBreakdown?.(audit) || { ok: 0, close: 0, incomplete: 0, different: 0 };
        const isAuditOpen = currentState.auditMode && String(currentState.openAuditRef || '') === String(item.ref || '');
        const encodedRef = encodeURIComponent(String(item.ref || ''));
        const name = String(item?.name || '').trim() || 'Établissement sans nom';
        const subtitleParts = [item?.city, item?.department].filter(Boolean).join(' • ');
        const address = String(item?.address || '').trim();
        const tags = [item?.mode, item?.category].filter(Boolean).join(' • ');
        const details = [item?.finess ? `FINESS ${item.finess}` : '', item?.idStructure ? `ID ${item.idStructure}` : ''].filter(Boolean).join(' • ');
        const ficheUrl = actions.buildViaAnnuairePublicFicheUrl?.(item, currentState.domain) || '';
        const ficheActionHtml = ficheUrl
          ? `<a class="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-blue-700 hover:underline" href="${helpers.escapeHtml?.(ficheUrl)}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-outlined text-[12px]">open_in_new</span>Fiche ViaTrajectoire</a>`
          : '';
        return `
          <div class="p-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
            <div class="w-full text-left">
              <p class="text-sm font-semibold text-slate-800">${helpers.escapeHtml?.(name)}</p>
              ${subtitleParts ? `<p class="text-xs text-slate-600 mt-0.5">${helpers.escapeHtml?.(subtitleParts)}</p>` : ''}
              ${address ? `<p class="text-xs text-slate-500 mt-0.5">${helpers.escapeHtml?.(address)}</p>` : ''}
              ${item?.phone ? `<p class="text-xs text-slate-500 mt-0.5"><span class="font-semibold text-slate-600">Téléphone:</span> ${helpers.escapeHtml?.(item.phone)}</p>` : ''}
              ${item?.email ? `<p class="text-xs text-slate-500 mt-0.5"><span class="font-semibold text-slate-600">Email:</span> ${helpers.escapeHtml?.(item.email)}</p>` : ''}
              ${currentState.auditMode ? `
                <div class="mt-1.5 flex items-center gap-2 flex-wrap">
                  <button type="button" class="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold via-annuaire-audit-toggle-btn ${auditMeta.className}" data-audit-ref="${helpers.escapeHtml?.(encodedRef)}">
                    <span class="material-symbols-outlined text-[13px]">rule</span>
                    ${audit ? `
                      <span class="inline-flex items-center gap-1">
                        <span>OK ${auditBreakdown.ok}</span>
                        <span>•</span>
                        <span>Proche ${auditBreakdown.close}</span>
                        <span>•</span>
                        <span>Incomplet ${auditBreakdown.incomplete}</span>
                        ${auditBreakdown.different ? `<span>• Différent ${auditBreakdown.different}</span>` : ''}
                      </span>
                    ` : helpers.escapeHtml?.(auditMeta.label)}
                  </button>
                  ${audit?.summary ? `<span class="text-[11px] text-slate-500">${helpers.escapeHtml?.(audit.summary)}</span>` : ''}
                </div>
              ` : ''}
              ${tags ? `<p class="text-[11px] text-slate-500 mt-1">${helpers.escapeHtml?.(tags)}</p>` : ''}
              ${details ? `<p class="text-[11px] text-slate-400 mt-1">${helpers.escapeHtml?.(details)}</p>` : ''}
            </div>
            ${ficheActionHtml}
            ${isAuditOpen ? `
              <div class="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p class="text-[11px] font-semibold text-slate-700 mb-1">Détail audit FINESS vs API FHIR</p>
                ${audit?.recommendedAddress ? `
                  <div class="mb-2 p-2 rounded border border-cyan-200 bg-cyan-50 text-[11px] text-cyan-900">
                    <p class="font-semibold mb-1">Adresse enrichie recommandée</p>
                    <p>${helpers.escapeHtml?.(audit.recommendedAddress)}</p>
                    <button type="button" class="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded border border-cyan-300 bg-white text-cyan-800 font-semibold via-annuaire-audit-apply-address-btn" data-audit-ref="${helpers.escapeHtml?.(encodedRef)}">
                      <span class="material-symbols-outlined text-[13px]">auto_fix_high</span>
                      Utiliser l'adresse enrichie
                    </button>
                  </div>
                ` : ''}
                ${Array.isArray(audit?.fields) && audit.fields.length > 0
                  ? `<div class="space-y-1.5">${audit.fields.map((field) => {
                      const fieldMeta = actions.getViaAnnuaireAuditBadgeMeta?.(field?.status) || { label: '', className: '' };
                      return `
                        <div class="text-[11px] text-slate-700 border border-slate-200 rounded p-1.5 bg-white">
                          <div class="flex items-center justify-between gap-2">
                            <span class="font-semibold">${helpers.escapeHtml?.(field?.label || 'Champ')}</span>
                            <span class="px-1.5 py-0.5 rounded border ${fieldMeta.className}">${helpers.escapeHtml?.(fieldMeta.label)}</span>
                          </div>
                          <div class="mt-1 text-slate-500">FINESS: ${helpers.escapeHtml?.(field?.local || '—')}</div>
                          <div class="text-slate-500">FHIR: ${helpers.escapeHtml?.(field?.remote || '—')}</div>
                          ${field?.note ? `<div class="text-slate-400">${helpers.escapeHtml?.(field.note)}</div>` : ''}
                        </div>
                      `;
                    }).join('')}</div>`
                  : '<p class="text-[11px] text-slate-500">Aucun détail disponible.</p>'}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
      results.querySelectorAll('.via-annuaire-audit-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const refEncoded = String(btn.getAttribute('data-audit-ref') || '');
          toggleViaAnnuaireAuditDetails(refEncoded);
        });
      });
      results.querySelectorAll('.via-annuaire-audit-apply-address-btn').forEach((btn) => {
        btn.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const refEncoded = String(btn.getAttribute('data-audit-ref') || '');
          await applyViaAnnuaireAuditRecommendedAddress(refEncoded);
        });
      });
    }

    function mapViaAnnuaireLiveResultItem(item) {
      const obj = item && typeof item === 'object' ? item : {};
      const name = String(
        obj.rs
        || obj.rslongue
        || obj.nom
        || ''
      ).trim();
      const city = String(
        obj.com_name
        || obj.commune
        || obj.ville
        || ''
      ).trim();
      const department = String(
        obj.dep_name
        || obj.dep_code
        || ''
      ).trim();
      const address = String(
        obj.adresse
        || obj.address
        || ''
      ).trim();
      const mode = String(obj.libmft || '').trim();
      const category = String(obj.libcategetab || '').trim();
      const speciality = String(obj.libsph || '').trim();
      const finess = String(obj.nofinesset || obj.nofinessej || '').trim();
      const idStructure = String(obj.siret || '').trim();
      const phone = String(obj.telephone || '').trim();
      return {
        name,
        city,
        department,
        departmentCode: actions.normalizeViaAnnuaireDepartmentCode?.(obj.dep_code),
        address,
        mode,
        category,
        speciality,
        finess,
        idStructure,
        phone,
        email: '',
        ref: actions.buildViaAnnuaireLiveResultRef?.({ name, city, finess, idStructure })
      };
    }

    function filterViaAnnuaireRecordsBySearchInput(items, input) {
      const domain = actions.normalizeViaAnnuaireLiveDomain?.(input.domain);
      const keyword = actions.normalizeViaAnnuaireTextForMatch?.(input.keyword);
      return (Array.isArray(items) ? items : []).filter((item) => {
        if (!actions.isViaAnnuaireDomainMatch?.(item, domain)) return false;
        if (!keyword) return true;
        const haystack = actions.normalizeViaAnnuaireTextForMatch?.([
          item?.name,
          item?.city,
          item?.address,
          item?.category,
          item?.mode,
          item?.speciality,
          item?.finess
        ].filter(Boolean).join(' '));
        return String(haystack || '').includes(keyword);
      });
    }

    function escapeOdsWhereValue(value) {
      return String(value || '').replace(/"/g, '\\"');
    }

    async function runViaAnnuaireLiveSearch(options = {}) {
      const currentState = state.getLiveSearchState?.() || {};
      const fromUi = options.fromUi !== false;
      const requestedPageIndex = Number.isFinite(Number(options.pageIndex))
        ? Math.max(0, Number(options.pageIndex))
        : Math.max(0, Number(currentState.pageIndex || 0));
      const input = fromUi ? readViaAnnuaireLiveSearchInputs() : {
        domain: actions.normalizeViaAnnuaireLiveDomain?.(currentState.domain),
        departmentCode: actions.normalizeViaAnnuaireDepartmentCode?.(currentState.departmentCode),
        keyword: String(currentState.keyword || '').trim(),
        sortKey: actions.normalizeViaAnnuaireLiveSortKey?.(currentState.sortKey)
      };
      if (!input.departmentCode) {
        helpers.showToast?.('Sélectionnez un département');
        return null;
      }
      if (!fromUi && Array.isArray(currentState.allResults) && currentState.allResults.length > 0) {
        const sortedAll = actions.sortViaAnnuaireLiveResults?.(currentState.allResults, input.sortKey) || [];
        const pageSize = Math.max(1, Number(currentState.pageSize || 12));
        const total = sortedAll.length;
        const maxPageIndex = total > 0 ? Math.max(0, Math.ceil(total / pageSize) - 1) : 0;
        const safePageIndex = Math.min(requestedPageIndex, maxPageIndex);
        const startIndex = safePageIndex * pageSize;
        const paged = sortedAll.slice(startIndex, startIndex + pageSize);
        state.setLiveSearchState?.({
          ...currentState,
          sortKey: input.sortKey,
          pageIndex: safePageIndex,
          allResults: sortedAll,
          results: paged,
          total,
          selectedResultRef: String(paged[0]?.ref || '')
        });
        renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
        void enrichViaAnnuaireRowsWithRorEmail(paged);
        void runViaAnnuaireAuditForRows(paged);
        return paged;
      }

      const runtimeCache = state.getRuntimeCache?.() || {};
      if (!Array.isArray(runtimeCache?.departements) || runtimeCache.departements.length === 0) {
        await syncViaAnnuaireDepartmentsFromApi({ silent: true });
      }

      const nextState = {
        ...currentState,
        domain: input.domain,
        departmentCode: input.departmentCode,
        keyword: input.keyword,
        sortKey: input.sortKey,
        pageIndex: requestedPageIndex,
        allResults: [],
        results: [],
        auditByRef: {},
        openAuditRef: '',
        total: 0,
        loading: true,
        lastError: '',
        selectedResultRef: fromUi ? '' : String(currentState.selectedResultRef || '')
      };
      state.setLiveSearchState?.(nextState);
      renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
      try {
        const pageSizeFetch = Number(state.getPublicPageSize?.() || 100);
        const maxScan = Number(state.getPublicMaxScan?.() || 400);
        const scanTarget = Math.max(pageSizeFetch, maxScan);
        let offset = 0;
        let scannedCount = 0;
        const rawRows = [];
        while (offset < scanTarget) {
          const payload = await actions.fetchViaAnnuairePublicApiRecords?.({
            limit: pageSizeFetch,
            offset,
            orderBy: 'rs',
            select: 'nofinesset,nofinessej,rs,rslongue,address,telephone,dep_code,dep_name,com_name,libmft,libcategetab,categetab,libsph,siret',
            where: `dep_code = "${escapeOdsWhereValue(input.departmentCode)}"`
          }, 25000);
          const batch = Array.isArray(payload?.results) ? payload.results : [];
          rawRows.push(...batch);
          scannedCount += batch.length;
          if (batch.length < pageSizeFetch) break;
          if (scannedCount >= scanTarget) break;
          offset += pageSizeFetch;
        }
        const mappedAll = rawRows.map(mapViaAnnuaireLiveResultItem).filter((item) => item.name);
        const filtered = filterViaAnnuaireRecordsBySearchInput(mappedAll, input);
        const sortedAll = actions.sortViaAnnuaireLiveResults?.(filtered, input.sortKey) || [];
        const pageSize = Math.max(1, Number(nextState.pageSize || 12));
        const total = sortedAll.length;
        const maxPageIndex = total > 0 ? Math.max(0, Math.ceil(total / pageSize) - 1) : 0;
        const safePageIndex = Math.min(requestedPageIndex, maxPageIndex);
        const startIndex = safePageIndex * pageSize;
        const paged = sortedAll.slice(startIndex, startIndex + pageSize);
        const selectedRef = paged.some((item) => String(item?.ref || '') === String(nextState.selectedResultRef || ''))
          ? String(nextState.selectedResultRef || '')
          : String(paged[0]?.ref || '');
        const departmentLabel = getViaAnnuaireLiveDepartments().find((dep) => (
          actions.normalizeViaAnnuaireDepartmentCode?.(dep?.id) === input.departmentCode
        ))?.nom || input.departmentCode;
        const scanNotice = scannedCount >= scanTarget ? ` (échantillon ${scanTarget})` : '';
        const finalState = {
          ...nextState,
          loading: false,
          pageIndex: safePageIndex,
          results: paged,
          allResults: sortedAll,
          total,
          selectedResultRef: selectedRef,
          lastQueryLabel: `${input.domain} • ${departmentLabel}${input.keyword ? ` • ${input.keyword}` : ''}${scanNotice}`
        };
        state.setLiveSearchState?.(finalState);
        renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
        void enrichViaAnnuaireRowsWithRorEmail(paged);
        void runViaAnnuaireAuditForRows(paged);
        return paged;
      } catch (error) {
        const errorMessage = String(error?.message || 'Erreur de recherche');
        state.setLiveSearchState?.({
          ...nextState,
          loading: false,
          allResults: [],
          results: [],
          total: 0,
          lastError: errorMessage
        });
        renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
        helpers.showToast?.(`Recherche annuaire impossible: ${errorMessage}`);
        return null;
      }
    }

    function buildViaAnnuaireRorLookupUrls(finess) {
      const endpoint = getViaAnnuaireRorFhirEndpoint();
      return actions.buildViaAnnuaireRorLookupUrlsFromEndpoint?.(finess, endpoint) || [];
    }

    async function ensureViaAnnuaireRorSettingsLoaded() {
      if (state.getRorSettingsLoaded?.()) return state.getRorSettingsCache?.() || {};
      try {
        const row = await actions.loadViaAnnuaireRorSettingsRow?.();
        const normalized = actions.normalizeViaAnnuaireRorSettings?.(row?.value);
        state.setRorSettingsCache?.(normalized);
      } catch (_) {
        const fallbackEndpoint = String(actions.getDefaultViaAnnuaireRorEndpoint?.() || '');
        state.setRorSettingsCache?.(actions.normalizeViaAnnuaireRorSettings?.({
          endpoint: fallbackEndpoint,
          apiKey: ''
        }));
      }
      state.setRorSettingsLoaded?.(true);
      return state.getRorSettingsCache?.() || {};
    }

    async function saveViaAnnuaireRorSettings(nextValue) {
      const normalized = actions.normalizeViaAnnuaireRorSettings?.(nextValue);
      await actions.saveViaAnnuaireRorSettingsRow?.({
        key: actions.getViaAnnuaireRorSettingsKey?.(),
        value: normalized,
        updatedAt: Date.now()
      });
      state.setRorSettingsCache?.(normalized);
      state.setRorSettingsLoaded?.(true);
      state.setRorUnavailable?.(false);
      state.setRorUnavailableReason?.('');
      state.setRorProbeDone?.(false);
      state.clearRorEmailCache?.();
      state.clearRorOrganizationCache?.();
      return normalized;
    }

    function getViaAnnuaireRorFhirEndpoint() {
      const cache = state.getRorSettingsCache?.() || {};
      return actions.normalizeViaAnnuaireRorEndpoint?.(cache?.endpoint);
    }

    function hasViaAnnuaireRorCredentials() {
      const endpoint = getViaAnnuaireRorFhirEndpoint();
      return !!endpoint;
    }

    function hasViaAnnuaireRorApiKey() {
      const cache = state.getRorSettingsCache?.() || {};
      return !!String(cache?.apiKey || '').trim();
    }

    async function testViaAnnuaireRorEndpointReachability(endpoint, apiKey = '') {
      const target = actions.normalizeViaAnnuaireRorEndpoint?.(endpoint);
      if (!target) throw new Error('Endpoint Annuaire Santé vide');
      const token = String(apiKey || '').trim();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`${target}/metadata`, {
          method: 'GET',
          headers: {
            Accept: 'application/fhir+json, application/json;q=0.9',
            ...(token ? { 'ESANTE-API-KEY': token } : {})
          },
          signal: controller.signal
        });
        if (response.ok) return { ok: true, authRequired: false, status: response.status };
        if (response.status === 401 || response.status === 403) {
          return { ok: true, authRequired: true, status: response.status };
        }
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        const message = String(error?.message || 'erreur');
        if (/failed to fetch|network|cors|load failed|name_not_resolved|dns/i.test(message)) {
          throw new Error(`Accès réseau/CORS/DNS refusé (${message})`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    async function fetchViaAnnuaireRorEmailByFiness(finess) {
      const normalizedFiness = String(finess || '').trim();
      if (!normalizedFiness) return '';
      await ensureViaAnnuaireRorSettingsLoaded();
      const emailCache = state.getRorEmailCache?.();
      if (emailCache?.has(normalizedFiness)) {
        return String(emailCache.get(normalizedFiness) || '');
      }
      const orgCache = state.getRorOrganizationCache?.();
      const orgFromCache = orgCache?.get(normalizedFiness);
      if (orgFromCache && typeof orgFromCache === 'object') {
        const cachedEmail = actions.extractViaAnnuaireRorTelecomValue?.(orgFromCache, 'email') || '';
        emailCache?.set(normalizedFiness, cachedEmail);
        return cachedEmail;
      }
      if (state.getRorUnavailable?.() || !hasViaAnnuaireRorCredentials()) return '';
      const urls = buildViaAnnuaireRorLookupUrls(normalizedFiness);
      if (!urls.length) return '';
      const apiKey = String((state.getRorSettingsCache?.() || {})?.apiKey || '').trim();
      const errors = [];
      for (const url of urls) {
        try {
          const payload = await actions.fetchJsonWithTimeout?.(url, {
            method: 'GET',
            headers: {
              Accept: 'application/fhir+json, application/json;q=0.9',
              ...(apiKey ? { 'ESANTE-API-KEY': apiKey } : {})
            }
          }, 12000);
          const org = actions.extractViaAnnuaireRorOrganizationFromPayload?.(payload);
          if (org) orgCache?.set(normalizedFiness, org);
          const email = org
            ? (actions.extractViaAnnuaireRorTelecomValue?.(org, 'email') || '')
            : (actions.extractViaAnnuaireRorEmailFromPayload?.(payload) || '');
          if (email) {
            emailCache?.set(normalizedFiness, email);
            return email;
          }
        } catch (error) {
          const message = String(error?.message || 'erreur');
          errors.push(message);
          if (/HTTP\s*400/i.test(message)) {
            state.setRorUnavailable?.(true);
            state.setRorUnavailableReason?.('Requête FHIR refusée (400). Vérifiez endpoint/format attendu.');
            break;
          }
          if (/HTTP\s*(401|403)/i.test(message)) {
            state.setRorUnavailable?.(true);
            state.setRorUnavailableReason?.('Accès refusé (401/403) par l’endpoint Annuaire Santé');
            break;
          }
        }
      }
      const hasFetchError = errors.some((message) => /failed to fetch|network|cors|load failed/i.test(message));
      if (hasFetchError) {
        state.setRorUnavailable?.(true);
        if (!state.getRorUnavailableReason?.()) {
          state.setRorUnavailableReason?.('Accès réseau/CORS impossible');
        }
      }
      emailCache?.set(normalizedFiness, '');
      return '';
    }

    async function fetchViaAnnuaireRorOrganizationByFiness(finess) {
      const normalizedFiness = String(finess || '').trim();
      if (!normalizedFiness) return null;
      await ensureViaAnnuaireRorSettingsLoaded();
      const orgCache = state.getRorOrganizationCache?.();
      if (orgCache?.has(normalizedFiness)) {
        return orgCache.get(normalizedFiness) || null;
      }
      if (state.getRorUnavailable?.() || !hasViaAnnuaireRorCredentials()) return null;
      const urls = buildViaAnnuaireRorLookupUrls(normalizedFiness);
      if (!urls.length) return null;
      const apiKey = String((state.getRorSettingsCache?.() || {})?.apiKey || '').trim();
      const emailCache = state.getRorEmailCache?.();
      for (const url of urls) {
        try {
          const payload = await actions.fetchJsonWithTimeout?.(url, {
            method: 'GET',
            headers: {
              Accept: 'application/fhir+json, application/json;q=0.9',
              ...(apiKey ? { 'ESANTE-API-KEY': apiKey } : {})
            }
          }, 12000);
          const org = actions.extractViaAnnuaireRorOrganizationFromPayload?.(payload);
          if (org) {
            orgCache?.set(normalizedFiness, org);
            emailCache?.set(normalizedFiness, actions.extractViaAnnuaireRorTelecomValue?.(org, 'email') || '');
            return org;
          }
        } catch (error) {
          const message = String(error?.message || 'erreur');
          if (/HTTP\s*400/i.test(message)) {
            state.setRorUnavailable?.(true);
            state.setRorUnavailableReason?.('Requête FHIR refusée (400). Vérifiez endpoint/format attendu.');
            break;
          }
          if (/HTTP\s*(401|403)/i.test(message)) {
            state.setRorUnavailable?.(true);
            state.setRorUnavailableReason?.('Accès refusé (401/403) par l’endpoint Annuaire Santé');
            break;
          }
        }
      }
      orgCache?.set(normalizedFiness, null);
      return null;
    }

    async function ensureViaAnnuaireRorEnrichmentReady() {
      await ensureViaAnnuaireRorSettingsLoaded();
      if (!hasViaAnnuaireRorCredentials()) return false;
      if (state.getRorUnavailable?.()) return false;
      if (state.getRorProbeDone?.()) return true;
      state.setRorProbeDone?.(true);
      const endpoint = getViaAnnuaireRorFhirEndpoint();
      const apiKey = String((state.getRorSettingsCache?.() || {})?.apiKey || '').trim();
      try {
        const probe = await testViaAnnuaireRorEndpointReachability(endpoint, apiKey);
        if (probe?.authRequired && !apiKey) {
          state.setRorUnavailable?.(true);
          state.setRorUnavailableReason?.('Authentification requise (clé API manquante)');
          return false;
        }
        state.setRorUnavailable?.(false);
        state.setRorUnavailableReason?.('');
        return true;
      } catch (error) {
        const message = String(error?.message || 'erreur');
        state.setRorUnavailable?.(true);
        state.setRorUnavailableReason?.(
          /HTTP\s*(401|403)/i.test(message)
            ? 'Accès refusé (401/403) par l’endpoint Annuaire Santé'
            : `Probe endpoint échoué (${message})`
        );
        return false;
      }
    }

    function buildViaAnnuaireAuditField(label, localValue, remoteValue, normalizer = actions.normalizeViaAnnuaireComparableText, options = {}) {
      const left = String(localValue || '').trim();
      const right = String(remoteValue || '').trim();
      const leftNorm = normalizer(left);
      const rightNorm = normalizer(right);
      const leftMissing = !leftNorm;
      const rightMissing = !rightNorm;
      if (leftMissing && rightMissing) {
        return { label, status: 'incomplete', local: left, remote: right, note: 'Absent des deux côtés' };
      }
      if (leftMissing || rightMissing) {
        return { label, status: 'incomplete', local: left, remote: right, note: leftMissing ? 'Manquant FINESS' : 'Manquant API FHIR' };
      }
      if (leftNorm === rightNorm) {
        return { label, status: 'ok', local: left, remote: right, note: 'Conforme' };
      }
      const leftTokens = actions.tokenizeViaAnnuaireComparableText?.(left) || [];
      const rightTokens = actions.tokenizeViaAnnuaireComparableText?.(right) || [];
      const tokenOverlap = actions.computeViaAnnuaireTokenOverlap?.(leftTokens, rightTokens) || 0;
      const dice = actions.computeViaAnnuaireDiceSimilarity?.(left, right) || 0;
      const contains = leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm);
      const closeThreshold = Number(options.closeThreshold || 0);
      const tokenThreshold = Number(options.tokenThreshold || 0);
      const allowContains = options.allowContains !== false;
      const isClose = (allowContains && contains)
        || (closeThreshold > 0 && dice >= closeThreshold)
        || (tokenThreshold > 0 && tokenOverlap >= tokenThreshold);
      if (isClose) {
        return {
          label,
          status: 'close',
          local: left,
          remote: right,
          note: `Proximité détectée (similarité ${(dice * 100).toFixed(0)}%, overlap ${(tokenOverlap * 100).toFixed(0)}%)`
        };
      }
      return { label, status: 'different', local: left, remote: right, note: 'Valeur différente' };
    }

    function computeViaAnnuaireAuditFromRows(localRow, organization) {
      const org = organization && typeof organization === 'object' ? organization : null;
      if (!localRow || !org) {
        return {
          status: 'incomplete',
          summary: 'Données API FHIR indisponibles pour cet établissement.',
          fields: []
        };
      }
      const remoteName = String(org.name || '').trim();
      const remoteCity = String((Array.isArray(org.address) ? org.address.find(Boolean)?.city : '') || '').trim();
      const remoteAddress = actions.extractViaAnnuaireRorOrganizationAddress?.(org) || '';
      const remotePhone = actions.extractViaAnnuaireRorTelecomValue?.(org, 'phone') || '';
      const remoteEmail = actions.extractViaAnnuaireRorTelecomValue?.(org, 'email') || '';
      const fields = [
        buildViaAnnuaireAuditField('Nom', localRow.name, remoteName, actions.normalizeViaAnnuaireComparableText, { closeThreshold: 0.9, tokenThreshold: 0.8, allowContains: true }),
        buildViaAnnuaireAuditField('Ville', localRow.city, remoteCity, actions.normalizeViaAnnuaireComparableText, { closeThreshold: 0.84, tokenThreshold: 0.75, allowContains: true }),
        buildViaAnnuaireAuditField('Adresse', localRow.address, remoteAddress, actions.normalizeViaAnnuaireComparableText, { closeThreshold: 0.72, tokenThreshold: 0.58, allowContains: true }),
        buildViaAnnuaireAuditField('Téléphone', localRow.phone, remotePhone, actions.normalizeViaAnnuaireComparablePhone),
        buildViaAnnuaireAuditField('Email', localRow.email, remoteEmail, actions.normalizeViaAnnuaireComparableEmail)
      ];
      const recommendedAddress = actions.buildViaAnnuaireRecommendedAddress?.(localRow.address, remoteAddress) || '';
      const hasDiff = fields.some((f) => f.status === 'different');
      const hasIncomplete = fields.some((f) => f.status === 'incomplete');
      const hasClose = fields.some((f) => f.status === 'close');
      const status = hasDiff ? 'different' : (hasIncomplete ? 'incomplete' : (hasClose ? 'close' : 'ok'));
      return {
        status,
        summary: status === 'ok'
          ? 'FINESS et API FHIR cohérents sur les champs comparés.'
          : (status === 'close'
            ? 'Écarts mineurs détectés (proximité sémantique), pas de divergence forte.'
            : (status === 'different'
              ? 'Divergences détectées entre FINESS et API FHIR.'
              : 'Comparaison partielle (données manquantes sur au moins un champ).')),
        fields,
        recommendedAddress
      };
    }

    async function runViaAnnuaireAuditForRows(rows = []) {
      const items = Array.isArray(rows) ? rows : [];
      if (!items.length) return;
      const currentState = state.getLiveSearchState?.() || {};
      if (!currentState.auditMode) return;
      if (!hasViaAnnuaireRorCredentials() || state.getRorUnavailable?.()) return;
      if (currentState.auditLoading) return;
      state.setLiveSearchState?.({
        ...currentState,
        auditLoading: true
      });
      renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
      try {
        const ready = await ensureViaAnnuaireRorEnrichmentReady();
        if (!ready) return;
        const latestState = state.getLiveSearchState?.() || {};
        const auditByRef = { ...(latestState.auditByRef || {}) };
        let changed = false;
        for (const row of items) {
          if (!row || !row.ref) continue;
          if (auditByRef[row.ref]?.status) continue;
          const finess = String(row.finess || '').trim();
          if (!finess) {
            auditByRef[row.ref] = {
              status: 'incomplete',
              summary: 'FINESS absent: audit impossible.',
              fields: []
            };
            changed = true;
            continue;
          }
          const org = await fetchViaAnnuaireRorOrganizationByFiness(finess);
          auditByRef[row.ref] = computeViaAnnuaireAuditFromRows(row, org);
          changed = true;
        }
        if (changed) {
          const current = state.getLiveSearchState?.() || {};
          state.setLiveSearchState?.({
            ...current,
            auditByRef
          });
        }
      } finally {
        const current = state.getLiveSearchState?.() || {};
        state.setLiveSearchState?.({
          ...current,
          auditLoading: false
        });
        renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
      }
    }

    function toggleViaAnnuaireAuditDetails(refEncoded) {
      const ref = decodeURIComponent(String(refEncoded || ''));
      if (!ref) return;
      const currentState = state.getLiveSearchState?.() || {};
      const current = String(currentState.openAuditRef || '');
      state.setLiveSearchState?.({
        ...currentState,
        openAuditRef: current === ref ? '' : ref
      });
      renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
    }

    async function applyViaAnnuaireAuditRecommendedAddress(refEncoded) {
      const ref = decodeURIComponent(String(refEncoded || ''));
      if (!ref) return;
      const currentState = state.getLiveSearchState?.() || {};
      const audit = currentState?.auditByRef?.[ref];
      const recommendedAddress = String(audit?.recommendedAddress || '').trim();
      if (!recommendedAddress) return;
      const updateRowAddress = (row) => {
        if (!row || String(row.ref || '') !== ref) return row;
        return {
          ...row,
          address: recommendedAddress
        };
      };
      const nextAll = Array.isArray(currentState.allResults)
        ? currentState.allResults.map(updateRowAddress)
        : [];
      const nextResults = Array.isArray(currentState.results)
        ? currentState.results.map(updateRowAddress)
        : [];
      const nextAudit = { ...(currentState.auditByRef || {}) };
      const row = nextResults.find((item) => String(item?.ref || '') === ref)
        || nextAll.find((item) => String(item?.ref || '') === ref);
      if (row) {
        const finess = String(row.finess || '').trim();
        const org = finess ? await fetchViaAnnuaireRorOrganizationByFiness(finess) : null;
        nextAudit[ref] = computeViaAnnuaireAuditFromRows(row, org);
      }
      state.setLiveSearchState?.({
        ...currentState,
        allResults: nextAll,
        results: nextResults,
        auditByRef: nextAudit
      });
      renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
      helpers.showToast?.('Adresse enrichie appliquée pour cette ligne');
    }

    async function enrichViaAnnuaireRowsWithRorEmail(rows = []) {
      const items = Array.isArray(rows) ? rows : [];
      if (!items.length || state.getRorUnavailable?.()) return;
      const ready = await ensureViaAnnuaireRorEnrichmentReady();
      if (!ready) {
        renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
        return;
      }
      let changed = false;
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        if (String(item.email || '').trim()) continue;
        const finess = String(item.finess || '').trim();
        if (!finess) continue;
        const email = await fetchViaAnnuaireRorEmailByFiness(finess);
        if (email && String(item.email || '').trim() !== email) {
          item.email = email;
          changed = true;
        }
      }
      if (changed) {
        renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
      }
    }

    function bindViaAnnuaireEventHandlers() {
      document.getElementById('btn-via-annuaire-ror-save')?.addEventListener('click', async () => {
        if (!actions.isAppAdmin?.()) {
          helpers.showToast?.('Action reservee a l admin application');
          await actions.renderGlobalSettings?.();
          return;
        }
        const endpointInput = document.getElementById('via-annuaire-ror-endpoint-input');
        const apiKeyInput = document.getElementById('via-annuaire-ror-apikey-input');
        const endpoint = actions.normalizeViaAnnuaireRorEndpoint?.(endpointInput?.value || '');
        const apiKey = String(apiKeyInput?.value || '').trim();
        await saveViaAnnuaireRorSettings({ endpoint, apiKey });
        helpers.showToast?.(endpoint
          ? (apiKey
            ? 'Configuration Annuaire Santé enregistrée (avec clé API)'
            : 'Configuration Annuaire Santé enregistrée (mode sans clé API)')
          : 'Configuration Annuaire Santé incomplète (endpoint manquant)');
        await actions.renderGlobalSettings?.();
      });

      document.getElementById('btn-via-annuaire-ror-test')?.addEventListener('click', async () => {
        const endpointInput = document.getElementById('via-annuaire-ror-endpoint-input');
        const apiKeyInput = document.getElementById('via-annuaire-ror-apikey-input');
        const endpoint = actions.normalizeViaAnnuaireRorEndpoint?.(endpointInput?.value || '');
        const apiKey = String(apiKeyInput?.value || '').trim();
        if (!endpoint) {
          helpers.showToast?.('Renseignez un endpoint Annuaire Santé FHIR');
          return;
        }
        try {
          actions.showLoading?.(true);
          const result = await testViaAnnuaireRorEndpointReachability(endpoint, apiKey);
          if (result.authRequired) {
            helpers.showToast?.(`Endpoint Annuaire Santé joignable (HTTP ${result.status}, authentification requise)`);
          } else {
            helpers.showToast?.(`Endpoint Annuaire Santé joignable (HTTP ${result.status})`);
          }
        } catch (error) {
          helpers.showToast?.(`Test endpoint Annuaire Santé impossible: ${String(error?.message || 'erreur')}`);
        } finally {
          actions.showLoading?.(false);
        }
      });

      document.getElementById('via-annuaire-ror-endpoint-input')?.addEventListener('keydown', async (event) => {
        if (event?.key !== 'Enter') return;
        event.preventDefault();
        document.getElementById('btn-via-annuaire-ror-save')?.click();
      });

      document.getElementById('via-annuaire-ror-apikey-input')?.addEventListener('keydown', async (event) => {
        if (event?.key !== 'Enter') return;
        event.preventDefault();
        document.getElementById('btn-via-annuaire-ror-save')?.click();
      });

      document.getElementById('btn-via-annuaire-live-search')?.addEventListener('click', async () => {
        await runViaAnnuaireLiveSearch({ fromUi: true, pageIndex: 0 });
      });

      document.getElementById('btn-via-annuaire-live-prev')?.addEventListener('click', async () => {
        const currentState = state.getLiveSearchState?.() || {};
        const nextPage = Math.max(0, Number(currentState.pageIndex || 0) - 1);
        await runViaAnnuaireLiveSearch({ fromUi: false, pageIndex: nextPage });
      });

      document.getElementById('btn-via-annuaire-live-next')?.addEventListener('click', async () => {
        const currentState = state.getLiveSearchState?.() || {};
        const nextPage = Math.max(0, Number(currentState.pageIndex || 0) + 1);
        await runViaAnnuaireLiveSearch({ fromUi: false, pageIndex: nextPage });
      });

      document.getElementById('btn-via-annuaire-config-toggle')?.addEventListener('click', () => {
        const currentExpanded = !!state.getViaAnnuaireConfigExpanded?.();
        actions.setViaAnnuaireConfigExpanded?.(!currentExpanded);
      });

      document.getElementById('btn-via-annuaire-live-audit-toggle')?.addEventListener('click', async () => {
        const currentState = state.getLiveSearchState?.() || {};
        const nextMode = !Boolean(currentState.auditMode);
        state.setLiveSearchState?.({
          ...currentState,
          auditMode: nextMode,
          openAuditRef: '',
          auditByRef: nextMode ? (currentState.auditByRef || {}) : {}
        });
        renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
        if (nextMode) {
          const refreshed = state.getLiveSearchState?.() || {};
          void runViaAnnuaireAuditForRows(refreshed.results || []);
        }
      });

      document.getElementById('via-annuaire-live-domain')?.addEventListener('change', () => {
        const input = readViaAnnuaireLiveSearchInputs();
        const currentState = state.getLiveSearchState?.() || {};
        state.setLiveSearchState?.({
          ...currentState,
          domain: input.domain,
          pageIndex: 0,
          total: 0,
          allResults: [],
          results: [],
          auditByRef: {},
          openAuditRef: '',
          selectedResultRef: '',
          lastQueryLabel: ''
        });
        renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
      });

      document.getElementById('via-annuaire-live-departement')?.addEventListener('change', () => {
        const input = readViaAnnuaireLiveSearchInputs();
        const currentState = state.getLiveSearchState?.() || {};
        state.setLiveSearchState?.({
          ...currentState,
          departmentCode: input.departmentCode,
          pageIndex: 0,
          total: 0,
          allResults: [],
          results: [],
          auditByRef: {},
          openAuditRef: '',
          selectedResultRef: '',
          lastQueryLabel: ''
        });
        renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
      });

      document.getElementById('via-annuaire-live-sort')?.addEventListener('change', () => {
        const input = readViaAnnuaireLiveSearchInputs();
        const currentState = state.getLiveSearchState?.() || {};
        const sortedAll = actions.sortViaAnnuaireLiveResults?.(currentState.allResults, input.sortKey) || [];
        const pageSize = Math.max(1, Number(currentState.pageSize || 12));
        const total = sortedAll.length;
        const paged = sortedAll.slice(0, pageSize);
        state.setLiveSearchState?.({
          ...currentState,
          sortKey: input.sortKey,
          allResults: sortedAll,
          pageIndex: 0,
          total,
          results: paged,
          selectedResultRef: String(paged[0]?.ref || '')
        });
        renderViaAnnuaireLiveSearchPanel({ keepSelection: true });
        void enrichViaAnnuaireRowsWithRorEmail(paged);
        void runViaAnnuaireAuditForRows(paged);
      });

      document.getElementById('via-annuaire-live-keyword')?.addEventListener('keydown', async (event) => {
        if (event?.key !== 'Enter') return;
        event.preventDefault();
        await runViaAnnuaireLiveSearch({ fromUi: true, pageIndex: 0 });
      });
    }

    return {
      readViaAnnuaireLiveSearchInputs,
      renderViaAnnuaireSettingsPanel,
      syncViaAnnuaireDepartmentsFromApi,
      renderViaAnnuaireLiveSearchPanel,
      mapViaAnnuaireLiveResultItem,
      filterViaAnnuaireRecordsBySearchInput,
      runViaAnnuaireLiveSearch,
      buildViaAnnuaireRorLookupUrls,
      ensureViaAnnuaireRorSettingsLoaded,
      saveViaAnnuaireRorSettings,
      getViaAnnuaireRorFhirEndpoint,
      hasViaAnnuaireRorCredentials,
      hasViaAnnuaireRorApiKey,
      testViaAnnuaireRorEndpointReachability,
      fetchViaAnnuaireRorEmailByFiness,
      fetchViaAnnuaireRorOrganizationByFiness,
      ensureViaAnnuaireRorEnrichmentReady,
      buildViaAnnuaireAuditField,
      computeViaAnnuaireAuditFromRows,
      runViaAnnuaireAuditForRows,
      toggleViaAnnuaireAuditDetails,
      applyViaAnnuaireAuditRecommendedAddress,
      enrichViaAnnuaireRowsWithRorEmail,
      bindViaAnnuaireEventHandlers
    };
  }

  global.TaskMDAViaAnnuaireUI = {
    createModule
  };
}(window));
