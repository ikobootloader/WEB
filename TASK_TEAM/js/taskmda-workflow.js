
(function initTaskMdaWorkflowModule(global) {
  'use strict';

  const STORE_KEY_FIELDS = {
    workflowCommunities: 'id',
    workflowServices: 'id',
    workflowGroups: 'id',
    workflowAgents: 'id',
    workflowTasks: 'id',
    workflowProcedures: 'id',
    workflowSoftware: 'id',
    workflowLayout: 'id',
    workflowAudit: 'id',
    workflowHistory: 'id'
  };

  const ENTITY_META = {
    community: { store: 'workflowCommunities', label: 'Communaute' },
    service: { store: 'workflowServices', label: 'Service' },
    group: { store: 'workflowGroups', label: 'Groupe' },
    agent: { store: 'workflowAgents', label: 'Agent' },
    task: { store: 'workflowTasks', label: 'Tache workflow' },
    procedure: { store: 'workflowProcedures', label: 'Procedure' },
    software: { store: 'workflowSoftware', label: 'Logiciel metier' }
  };

  function normalize(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toCsv(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return items.map((item) => String(item || '').trim()).filter(Boolean).join(', ');
  }

  function parseCsv(value) {
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseMultiline(value) {
    return String(value || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function defaultLayout(now) {
    return {
      id: 'main',
      activeView: 'map',
      filters: {
        query: '',
        serviceId: 'all',
        groupId: 'all',
        agentId: 'all',
        status: 'all'
      },
      orgBranchState: {},
      mapOptions: {
        zoom: 1,
        panX: 0,
        panY: 0,
        showStructure: true,
        showTransverse: true,
        showApplicative: true,
        showAllStructure: false,
        showAllTransverse: false,
        showAllApplicative: false,
        structureVisible: 120,
        transverseVisible: 120,
        applicativeVisible: 120,
        linkQuery: '',
        linkSort: 'source'
      },
      organigramOptions: {
        zoom: 1,
        panX: 0,
        panY: 0
      },
      updatedAt: now
    };
  }

  function createModule(options) {
    const opts = options || {};
    const api = opts.api || {};

    if (typeof api.getAll !== 'function' || typeof api.put !== 'function' || typeof api.remove !== 'function') {
      throw new Error('TaskMDAWorkflow: API incomplete');
    }

    const state = {
      initialized: false,
      bound: false,
      draggingTaskId: null,
      draggingMap: null,
      draggingOrganigram: null,
      procedureQuill: null,
      activeView: 'map',
      query: '',
      serviceFilter: 'all',
      groupFilter: 'all',
      agentFilter: 'all',
      statusFilter: 'all',
      orgBranchState: {},
      mapOptions: {
        zoom: 1,
        panX: 0,
        panY: 0,
        showStructure: true,
        showTransverse: true,
        showApplicative: true,
        showAllStructure: false,
        showAllTransverse: false,
        showAllApplicative: false,
        structureVisible: 120,
        transverseVisible: 120,
        applicativeVisible: 120,
        linkQuery: '',
        linkSort: 'source'
      },
      organigramOptions: {
        zoom: 1,
        panX: 0,
        panY: 0
      },
      permissions: {
        isAdmin: false,
        isWorkflowManager: false
      },
      selectedType: null,
      selectedId: null,
      collections: {
        communities: [],
        services: [],
        groups: [],
        agents: [],
        users: [],
        directoryUsers: [],
        tasks: [],
        procedures: [],
        software: [],
        audit: [],
        history: [],
        globalTasks: [],
        globalDocs: [],
        globalThemes: [],
        globalGroups: []
      }
    };

    const refs = {
      section: document.getElementById('global-workflow-section'),
      content: document.getElementById('workflow-content'),
      detailModal: document.getElementById('workflow-detail-modal'),
      detail: document.getElementById('workflow-detail'),
      detailTitle: document.getElementById('workflow-detail-title'),
      detailBody: document.getElementById('workflow-detail-body'),
      serviceFilter: document.getElementById('workflow-service-filter'),
      groupFilter: document.getElementById('workflow-group-filter'),
      agentFilter: document.getElementById('workflow-agent-filter'),
      statusFilter: document.getElementById('workflow-status-filter'),
      breadcrumbs: document.getElementById('workflow-breadcrumbs'),
      search: document.getElementById('workflow-search'),
      filtersToggle: document.getElementById('workflow-filters-toggle'),
      filtersPanel: document.getElementById('workflow-filters-panel'),
      quickAddToggle: document.getElementById('workflow-quick-add-toggle'),
      quickAddMenu: document.getElementById('workflow-quick-add-menu'),
      modal: document.getElementById('modal-workflow-entity'),
      modalTitle: document.getElementById('workflow-modal-title'),
      modalBody: document.getElementById('workflow-modal-body'),
      modalSave: document.getElementById('btn-save-workflow-modal')
    };

    const viewIds = {
      map: 'workflow-view-map',
      organization: 'workflow-view-organization',
      organigram: 'workflow-view-organigram',
      agents: 'workflow-view-agents',
      tasks: 'workflow-view-tasks',
      kanban: 'workflow-view-kanban',
      timeline: 'workflow-view-timeline',
      procedures: 'workflow-view-procedures',
      software: 'workflow-view-software',
      journal: 'workflow-view-journal'
    };

    const TASK_STATUS_OPTIONS = ['todo', 'in_progress', 'blocked', 'ready_for_review', 'done', 'approved'];
    const TASK_APPROVAL_OPTIONS = ['pending', 'approved', 'rejected'];

    function now() {
      return typeof api.now === 'function' ? Number(api.now()) : Date.now();
    }

    function uid() {
      return typeof api.uuid === 'function' ? String(api.uuid()) : `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    }

    function currentUserId() {
      if (typeof api.currentUserId === 'function') {
        return String(api.currentUserId() || 'system');
      }
      return 'system';
    }

    function toast(message) {
      if (typeof api.showToast === 'function') {
        api.showToast(message);
      }
    }

    function notifyInternal(message) {
      toast(message);
      logAudit('notify', 'workflow', 'internal', { message }).catch(() => null);
    }

    async function moveTaskToStatus(taskId, nextStatus) {
      const targetStatus = String(nextStatus || '').trim();
      if (!TASK_STATUS_OPTIONS.includes(targetStatus)) return;
      if (!canEditWorkflow()) {
        toast('Lecture seule: edition reservee au role admin ou manager workflow');
        return;
      }
      const task = getItem('task', taskId);
      if (!task) return;
      const previousStatus = String(task.status || 'todo');
      if (previousStatus === targetStatus) return;

      const updated = {
        ...task,
        status: targetStatus,
        updatedAt: now()
      };

      if (targetStatus === 'approved') {
        updated.approvalStatus = 'approved';
        updated.approvedAt = now();
        updated.approvedByUserId = currentUserId();
      } else if (String(task.approvalStatus || 'pending') === 'approved') {
        updated.approvalStatus = 'pending';
        updated.approvedAt = null;
        updated.approvedByUserId = null;
      }

      await api.put('workflowTasks', updated, STORE_KEY_FIELDS.workflowTasks);
      await logAudit('task_status_move_kanban', 'task', updated.id, { from: previousStatus, to: targetStatus });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      if (state.selectedType === 'task' && String(state.selectedId || '') === String(updated.id)) {
        openDetail('task', updated.id);
      }
      notifyInternal(`Kanban: ${updated.title || updated.id} deplacee vers ${targetStatus}`);
    }

    async function quickCreateWorkflowTaskFromContext(contextType, contextId) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: creation reservee au role admin ou manager workflow');
        return;
      }
      const safeType = String(contextType || '').trim();
      const safeId = String(contextId || '').trim();
      if (!safeType || !safeId) return;
      if (safeType !== 'procedure' && safeType !== 'software') return;

      const source = getItem(safeType, safeId);
      if (!source) return;
      const sourceLabel = source.name || source.title || safeId;
      const title = String(global.prompt(`Titre de la tache liee a ${sourceLabel}`, `Suivi ${sourceLabel}`) || '').trim();
      if (!title) return;

      let serviceId = null;
      if (safeType === 'procedure') {
        const linkedTaskIds = Array.isArray(source.linkedTaskIds) ? source.linkedTaskIds : [];
        const linkedTask = state.collections.tasks.find((task) => linkedTaskIds.includes(task.id) || task.linkedProcedureId === safeId);
        serviceId = linkedTask?.serviceId || null;
      } else if (safeType === 'software') {
        const linkedTaskIds = Array.isArray(source.linkedTaskIds) ? source.linkedTaskIds : [];
        const linkedTask = state.collections.tasks.find((task) => linkedTaskIds.includes(task.id) || (Array.isArray(task.linkedSoftwareIds) && task.linkedSoftwareIds.includes(safeId)));
        serviceId = linkedTask?.serviceId || null;
      }
      if (!serviceId && state.serviceFilter && state.serviceFilter !== 'all') {
        serviceId = state.serviceFilter;
      }

      const row = {
        id: `wf-task-${uid()}`,
        title,
        description: '',
        ownerAgentId: null,
        serviceId: serviceId || null,
        groupId: null,
        taskType: 'workflow',
        frequency: 'ponctuelle',
        priority: 'medium',
        criticality: 'medium',
        estimatedDuration: null,
        prerequisiteTaskIds: [],
        dependentTaskIds: [],
        linkedProcedureId: safeType === 'procedure' ? safeId : null,
        linkedSoftwareIds: safeType === 'software' ? [safeId] : [],
        linkedDocumentIds: [],
        linkedGlobalTaskIds: [],
        linkedThemeKeys: [],
        linkedGroupKeys: [],
        checklist: [],
        status: 'todo',
        approvalStatus: 'pending',
        approvedAt: null,
        approvedByUserId: null,
        metadata: { quickCreate: true, sourceType: safeType, sourceId: safeId },
        createdAt: now(),
        updatedAt: now()
      };

      await api.put('workflowTasks', row, STORE_KEY_FIELDS.workflowTasks);
      await syncTaskDependencyGraph(row.id, [], []);
      await syncBidirectionalExternalLinks();
      await logAudit('create_task_quick', 'task', row.id, { title: row.title, sourceType: safeType, sourceId: safeId });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      openDetail('task', row.id);
      toast('Tache workflow ajoutee');
    }

    function canEditWorkflow() {
      const admin = typeof api.canEditWorkflow === 'function' ? !!api.canEditWorkflow() : state.permissions.isAdmin;
      return !!(admin || state.permissions.isWorkflowManager);
    }

    function resolveWorkflowPermissions() {
      const admin = typeof api.canEditWorkflow === 'function' ? !!api.canEditWorkflow() : true;
      const currentId = String(currentUserId() || '').trim();
      const currentName = normalize(typeof api.currentUserName === 'function' ? api.currentUserName() : '');
      const manager = (state.collections.agents || []).some((agent) => {
        const metadataUserId = String(agent?.metadata?.userId || '').trim();
        const handle = normalize(agent?.handle || '');
        const title = normalize(agent?.title || '');
        const hints = Array.isArray(agent?.rbacHints) ? agent.rbacHints.map((hint) => normalize(hint)) : [];
        const identityMatch = (metadataUserId && metadataUserId === currentId)
          || (currentName && handle === currentName)
          || (currentId && handle === normalize(currentId));
        const managerHint = hints.includes('manager')
          || hints.includes('workflow_manager')
          || hints.includes('admin')
          || hints.includes('workflow_admin')
          || title.includes('manager')
          || title.includes('responsable');
        return identityMatch && managerHint;
      });
      state.permissions = {
        isAdmin: admin,
        isWorkflowManager: manager
      };
    }

    function setView(nextView) {
      let safe = viewIds[nextView] ? nextView : 'map';
      const requestedBtn = document.getElementById(viewIds[safe] || '');
      if (requestedBtn && requestedBtn.classList.contains('hidden')) {
        const fallbackEntry = Object.entries(viewIds).find(([, id]) => {
          const btn = document.getElementById(id);
          return !!(btn && !btn.classList.contains('hidden'));
        });
        safe = fallbackEntry ? fallbackEntry[0] : safe;
      }
      state.activeView = safe;
      Object.entries(viewIds).forEach(([key, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('is-active', key === safe);
      });
      persistLayout().catch(() => null);
      render();
    }

    async function persistLayout() {
      const row = {
        id: 'main',
        activeView: state.activeView,
        filters: {
          query: state.query,
          serviceId: state.serviceFilter,
          groupId: state.groupFilter,
          agentId: state.agentFilter,
          status: state.statusFilter
        },
        orgBranchState: { ...(state.orgBranchState || {}) },
        mapOptions: { ...(state.mapOptions || {}) },
        organigramOptions: { ...(state.organigramOptions || {}) },
        updatedAt: now()
      };
      await api.put('workflowLayout', row, STORE_KEY_FIELDS.workflowLayout);
    }

    async function readLayout() {
      const rows = await api.getAll('workflowLayout', STORE_KEY_FIELDS.workflowLayout);
      const found = (rows || []).find((item) => item && item.id === 'main');
      if (!found) {
        await api.put('workflowLayout', defaultLayout(now()), STORE_KEY_FIELDS.workflowLayout);
        return;
      }
      state.activeView = viewIds[found.activeView] ? found.activeView : 'map';
      state.query = String(found?.filters?.query || '');
      state.serviceFilter = String(found?.filters?.serviceId || 'all') || 'all';
      state.groupFilter = String(found?.filters?.groupId || 'all') || 'all';
      state.agentFilter = String(found?.filters?.agentId || 'all') || 'all';
      state.statusFilter = String(found?.filters?.status || 'all') || 'all';
      state.orgBranchState = (found?.orgBranchState && typeof found.orgBranchState === 'object')
        ? { ...found.orgBranchState }
        : {};
      if (global.TaskMDAWorkflowStore?.sanitizeMapOptions) {
        state.mapOptions = global.TaskMDAWorkflowStore.sanitizeMapOptions(found?.mapOptions || {});
      } else if (found?.mapOptions && typeof found.mapOptions === 'object') {
        state.mapOptions = { ...state.mapOptions, ...found.mapOptions };
      }
      if (found?.organigramOptions && typeof found.organigramOptions === 'object') {
        const src = found.organigramOptions;
        const zoom = Number(src.zoom || 1);
        const panX = Number(src.panX || 0);
        const panY = Number(src.panY || 0);
        state.organigramOptions = {
          zoom: Number.isFinite(zoom) ? clampOrganigramZoom(zoom) : 1,
          panX: Number.isFinite(panX) ? panX : 0,
          panY: Number.isFinite(panY) ? panY : 0
        };
      }
      if (refs.search) refs.search.value = state.query;
      if (refs.serviceFilter) refs.serviceFilter.value = state.serviceFilter;
      if (refs.groupFilter) refs.groupFilter.value = state.groupFilter;
      if (refs.agentFilter) refs.agentFilter.value = state.agentFilter;
      if (refs.statusFilter) refs.statusFilter.value = state.statusFilter;
    }

    async function logAudit(action, entityType, entityId, payload) {
      const entry = {
        id: `wf-audit-${uid()}`,
        action,
        entityType,
        entityId,
        payload: payload || null,
        byUserId: currentUserId(),
        createdAt: now()
      };
      await api.put('workflowAudit', entry, STORE_KEY_FIELDS.workflowAudit);
    }

    async function logHistory(action, entityType, entityId, beforeEntity, afterEntity, reason, changedKeys) {
      const safeType = String(entityType || '').trim();
      const safeId = String(entityId || '').trim();
      if (!safeType || !safeId) return;
      const computedChangedKeys = Array.isArray(changedKeys) && changedKeys.length
        ? changedKeys
        : (global.TaskMDAWorkflowStore?.computeChangedKeys
          ? global.TaskMDAWorkflowStore.computeChangedKeys(beforeEntity, afterEntity)
          : []);
      const row = global.TaskMDAWorkflowStore?.buildHistoryEntry
        ? global.TaskMDAWorkflowStore.buildHistoryEntry({
          action,
          entityType: safeType,
          entityId: safeId,
          beforeEntity,
          afterEntity,
          reason,
          changedKeys: computedChangedKeys,
          byUserId: currentUserId(),
          now: now(),
          uid: uid()
        })
        : {
          id: `wf-history-${uid()}`,
          action,
          entityType: safeType,
          entityId: safeId,
          beforeEntity: beforeEntity || null,
          afterEntity: afterEntity || null,
          reason: String(reason || ''),
          changedKeys: computedChangedKeys,
          byUserId: currentUserId(),
          createdAt: now()
        };
      await api.put('workflowHistory', row, STORE_KEY_FIELDS.workflowHistory);
    }

    async function linkServiceToRoot(serviceId, rootServiceId) {
      const sourceId = String(serviceId || '').trim();
      const rootId = String(rootServiceId || '').trim();
      if (!sourceId || !rootId || sourceId === rootId) return;
      if (!canEditWorkflow()) {
        toast('Lecture seule: edition reservee au role admin ou manager workflow');
        return;
      }

      const source = getItem('service', sourceId);
      const root = getItem('service', rootId);
      if (!source || !root) {
        toast('Service introuvable pour la liaison');
        return;
      }

      const sourceLinks = Array.isArray(source.relatedServiceIds) ? source.relatedServiceIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
      const rootLinks = Array.isArray(root.relatedServiceIds) ? root.relatedServiceIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
      const nextSourceLinks = Array.from(new Set(sourceLinks.concat([rootId]))).filter((id) => id !== sourceId);
      const nextRootLinks = Array.from(new Set(rootLinks.concat([sourceId]))).filter((id) => id !== rootId);

      const sourceChanged = JSON.stringify(sourceLinks.slice().sort()) !== JSON.stringify(nextSourceLinks.slice().sort());
      const rootChanged = JSON.stringify(rootLinks.slice().sort()) !== JSON.stringify(nextRootLinks.slice().sort());
      if (!sourceChanged && !rootChanged) {
        toast('Lien deja etabli');
        return;
      }

      const updatedSource = {
        ...source,
        relatedServiceIds: nextSourceLinks,
        updatedAt: now()
      };
      const updatedRoot = {
        ...root,
        relatedServiceIds: nextRootLinks,
        updatedAt: now()
      };

      if (sourceChanged) {
        await api.put('workflowServices', updatedSource, STORE_KEY_FIELDS.workflowServices);
        await logHistory('update', 'service', sourceId, source, updatedSource, 'organigram_link_to_root', ['relatedServiceIds']);
      }
      if (rootChanged) {
        await api.put('workflowServices', updatedRoot, STORE_KEY_FIELDS.workflowServices);
        await logHistory('update', 'service', rootId, root, updatedRoot, 'organigram_link_to_root', ['relatedServiceIds']);
      }

      await logAudit('link_to_root', 'service', sourceId, { rootServiceId: rootId });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      toast('Service relie a la racine');
      notifyInternal(`Organigramme: liaison ${updatedSource.name || sourceId} -> ${updatedRoot.name || rootId}`);
    }

    function getEntityHistory(entityType, entityId, limit = 8) {
      const safeType = String(entityType || '').trim();
      const safeId = String(entityId || '').trim();
      if (!safeType || !safeId) return [];
      return (state.collections.history || [])
        .filter((row) => String(row?.entityType || '') === safeType && String(row?.entityId || '') === safeId)
        .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0))
        .slice(0, limit);
    }

    async function restoreFromHistory(historyId, forcedType) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: restauration reservee au role admin ou manager workflow');
        return;
      }
      const historyEntry = (state.collections.history || []).find((row) => String(row?.id || '') === String(historyId || ''));
      if (!historyEntry) {
        toast('Version historique introuvable');
        return;
      }
      const type = String(forcedType || historyEntry.entityType || '').trim();
      const meta = ENTITY_META[type];
      if (!meta) {
        toast('Type historique non pris en charge');
        return;
      }
      const entityId = String(historyEntry.entityId || '').trim();
      if (!entityId) return;
      const current = getItem(type, entityId);
      const snapshot = historyEntry.beforeEntity || historyEntry.afterEntity;
      if (!snapshot || typeof snapshot !== 'object') {
        toast('Snapshot historique indisponible');
        return;
      }
      const restored = {
        ...snapshot,
        id: entityId,
        updatedAt: now(),
        metadata: {
          ...(snapshot.metadata || {}),
          restoredFromHistoryId: String(historyEntry.id || '')
        }
      };
      await api.put(meta.store, restored, STORE_KEY_FIELDS[meta.store]);
      if (type === 'task') {
        await syncTaskDependencyGraph(restored.id, restored.prerequisiteTaskIds, restored.dependentTaskIds);
      }
      if (type === 'task' || type === 'procedure') {
        await syncBidirectionalExternalLinks();
      }
      await logHistory('restore', type, entityId, current || null, restored, 'history_restore', Object.keys(restored || {}));
      await logAudit('restore', type, entityId, { historyId: historyEntry.id });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      openDetail(type, entityId);
      toast('Version restauree');
      notifyInternal(`Restauration workflow: ${type} ${entityId}`);
    }

    async function restoreFieldsFromHistory(historyId, forcedType, rawKeys) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: restauration reservee au role admin ou manager workflow');
        return;
      }
      const historyEntry = (state.collections.history || []).find((row) => String(row?.id || '') === String(historyId || ''));
      if (!historyEntry) {
        toast('Version historique introuvable');
        return;
      }
      const type = String(forcedType || historyEntry.entityType || '').trim();
      const meta = ENTITY_META[type];
      if (!meta) {
        toast('Type historique non pris en charge');
        return;
      }
      const entityId = String(historyEntry.entityId || '').trim();
      const current = getItem(type, entityId);
      if (!current) {
        toast('Element courant introuvable');
        return;
      }
      const snapshot = historyEntry.beforeEntity || historyEntry.afterEntity;
      if (!snapshot || typeof snapshot !== 'object') {
        toast('Snapshot historique indisponible');
        return;
      }
      const defaultKeys = Array.isArray(historyEntry.changedKeys) && historyEntry.changedKeys.length
        ? historyEntry.changedKeys
        : (global.TaskMDAWorkflowStore?.computeChangedKeys
          ? global.TaskMDAWorkflowStore.computeChangedKeys(historyEntry.beforeEntity || {}, historyEntry.afterEntity || {})
          : []);
      const parsed = Array.isArray(rawKeys)
        ? rawKeys
        : parseCsv(String(rawKeys || ''));
      const fieldsToRestore = Array.from(new Set((parsed.length ? parsed : defaultKeys).map((key) => String(key || '').trim()).filter(Boolean)))
        .filter((key) => key !== 'id' && key !== 'createdAt');
      if (fieldsToRestore.length === 0) {
        toast('Aucun champ a restaurer');
        return;
      }

      const next = {
        ...current,
        updatedAt: now()
      };
      fieldsToRestore.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
          next[key] = snapshot[key];
        } else {
          delete next[key];
        }
      });
      next.metadata = {
        ...(next.metadata || {}),
        restoredFromHistoryId: String(historyEntry.id || ''),
        restoredFields: fieldsToRestore
      };

      await api.put(meta.store, next, STORE_KEY_FIELDS[meta.store]);
      if (type === 'task') {
        await syncTaskDependencyGraph(next.id, next.prerequisiteTaskIds, next.dependentTaskIds);
      }
      if (type === 'task' || type === 'procedure') {
        await syncBidirectionalExternalLinks();
      }
      await logHistory('restore_fields', type, entityId, current, next, 'history_restore_fields', fieldsToRestore);
      await logAudit('restore_fields', type, entityId, { historyId: historyEntry.id, fields: fieldsToRestore });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      openDetail(type, entityId);
      toast(`${fieldsToRestore.length} champ(s) restaures`);
      notifyInternal(`Restauration partielle workflow: ${type} ${entityId}`);
    }

    async function loadCollections() {
      const [communities, services, groups, agents, users, directoryUsers, tasks, procedures, software, audit, history, globalTasks, globalDocs, globalThemes, globalGroups] = await Promise.all([
        api.getAll('workflowCommunities', STORE_KEY_FIELDS.workflowCommunities),
        api.getAll('workflowServices', STORE_KEY_FIELDS.workflowServices),
        api.getAll('workflowGroups', STORE_KEY_FIELDS.workflowGroups),
        api.getAll('workflowAgents', STORE_KEY_FIELDS.workflowAgents),
        api.getAll('users', 'userId'),
        api.getAll('directoryUsers', 'userId'),
        api.getAll('workflowTasks', STORE_KEY_FIELDS.workflowTasks),
        api.getAll('workflowProcedures', STORE_KEY_FIELDS.workflowProcedures),
        api.getAll('workflowSoftware', STORE_KEY_FIELDS.workflowSoftware),
        api.getAll('workflowAudit', STORE_KEY_FIELDS.workflowAudit),
        api.getAll('workflowHistory', STORE_KEY_FIELDS.workflowHistory),
        api.getAll('globalTasks', 'id'),
        api.getAll('globalDocs', 'id'),
        api.getAll('globalThemes', 'themeKey'),
        api.getAll('globalGroups', 'groupKey')
      ]);

      state.collections.communities = Array.isArray(communities) ? communities : [];
      state.collections.services = Array.isArray(services) ? services : [];
      state.collections.groups = Array.isArray(groups) ? groups : [];
      state.collections.agents = Array.isArray(agents) ? agents : [];
      state.collections.users = Array.isArray(users) ? users : [];
      state.collections.directoryUsers = Array.isArray(directoryUsers) ? directoryUsers : [];
      state.collections.tasks = Array.isArray(tasks) ? tasks : [];
      state.collections.procedures = Array.isArray(procedures) ? procedures : [];
      state.collections.software = Array.isArray(software) ? software : [];
      state.collections.audit = Array.isArray(audit) ? audit : [];
      state.collections.history = Array.isArray(history) ? history : [];
      state.collections.globalTasks = Array.isArray(globalTasks) ? globalTasks : [];
      state.collections.globalDocs = Array.isArray(globalDocs) ? globalDocs : [];
      state.collections.globalThemes = Array.isArray(globalThemes) ? globalThemes : [];
      state.collections.globalGroups = Array.isArray(globalGroups) ? globalGroups : [];
      resolveWorkflowPermissions();
    }

    function normalizeChecklist(task) {
      const source = Array.isArray(task?.checklist) ? task.checklist : [];
      return source.map((entry, index) => {
        if (entry && typeof entry === 'object') {
          return {
            id: String(entry.id || `chk-${index + 1}`),
            label: String(entry.label || '').trim(),
            done: !!entry.done
          };
        }
        return {
          id: `chk-${index + 1}`,
          label: String(entry || '').trim(),
          done: false
        };
      }).filter((entry) => entry.label);
    }

    function checklistToText(checklist) {
      return normalizeChecklist({ checklist })
        .map((entry) => `${entry.done ? '[x]' : '[ ]'} ${entry.label}`)
        .join('\n');
    }

    function parseChecklistText(value) {
      return String(value || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const done = /^\[(x|X)\]\s+/.test(line);
          const label = line.replace(/^\[(x|X| )\]\s+/, '').trim();
          return {
            id: `chk-${Date.now()}-${index + 1}`,
            label,
            done
          };
        })
        .filter((entry) => entry.label);
    }

    function parseUniqueCsv(value) {
      return Array.from(new Set(parseCsv(value).map((id) => String(id || '').trim()).filter(Boolean)));
    }

    function forwardWorkflowLinks(entityType, item) {
      if (!item) {
        return {
          globalTaskIds: [],
          globalDocIds: [],
          themeKeys: [],
          groupKeys: []
        };
      }
      if (entityType === 'task') {
        return {
          globalTaskIds: parseUniqueCsv(toCsv(item.linkedGlobalTaskIds || [])),
          globalDocIds: parseUniqueCsv(toCsv(item.linkedDocumentIds || [])),
          themeKeys: parseUniqueCsv(toCsv(item.linkedThemeKeys || [])),
          groupKeys: parseUniqueCsv(toCsv(item.linkedGroupKeys || []))
        };
      }
      if (entityType === 'procedure') {
        return {
          globalTaskIds: parseUniqueCsv(toCsv(item.linkedGlobalTaskIds || [])),
          globalDocIds: parseUniqueCsv(toCsv(item.linkedGlobalDocIds || [])),
          themeKeys: parseUniqueCsv(toCsv(item.linkedThemeKeys || [])),
          groupKeys: parseUniqueCsv(toCsv(item.linkedGroupKeys || []))
        };
      }
      return {
        globalTaskIds: [],
        globalDocIds: [],
        themeKeys: [],
        groupKeys: []
      };
    }

    function reverseWorkflowLinks(entityType, item) {
      const taskRefs = [];
      const procedureRefs = [];
      const fwd = forwardWorkflowLinks(entityType, item);
      state.collections.tasks.forEach((task) => {
        const links = forwardWorkflowLinks('task', task);
        if (entityType === 'globalTask' && links.globalTaskIds.includes(String(item.id || ''))) taskRefs.push(task);
        if (entityType === 'globalDoc' && links.globalDocIds.includes(String(item.id || ''))) taskRefs.push(task);
        if (entityType === 'theme' && links.themeKeys.includes(String(item.themeKey || ''))) taskRefs.push(task);
        if (entityType === 'group' && links.groupKeys.includes(String(item.groupKey || ''))) taskRefs.push(task);
      });
      state.collections.procedures.forEach((procedure) => {
        const links = forwardWorkflowLinks('procedure', procedure);
        if (entityType === 'globalTask' && links.globalTaskIds.includes(String(item.id || ''))) procedureRefs.push(procedure);
        if (entityType === 'globalDoc' && links.globalDocIds.includes(String(item.id || ''))) procedureRefs.push(procedure);
        if (entityType === 'theme' && links.themeKeys.includes(String(item.themeKey || ''))) procedureRefs.push(procedure);
        if (entityType === 'group' && links.groupKeys.includes(String(item.groupKey || ''))) procedureRefs.push(procedure);
      });
      return {
        taskRefs,
        procedureRefs,
        currentForward: fwd
      };
    }

    async function syncBidirectionalExternalLinks() {
      const taskMap = new Map();
      const docMap = new Map();
      const themeMap = new Map();
      const groupMap = new Map();
      const pushRef = (targetMap, key, kind, id) => {
        const safeKey = String(key || '').trim();
        if (!safeKey) return;
        if (!targetMap.has(safeKey)) {
          targetMap.set(safeKey, { taskIds: new Set(), procedureIds: new Set() });
        }
        if (kind === 'task') targetMap.get(safeKey).taskIds.add(String(id || ''));
        if (kind === 'procedure') targetMap.get(safeKey).procedureIds.add(String(id || ''));
      };

      state.collections.tasks.forEach((task) => {
        const links = forwardWorkflowLinks('task', task);
        links.globalTaskIds.forEach((id) => pushRef(taskMap, id, 'task', task.id));
        links.globalDocIds.forEach((id) => pushRef(docMap, id, 'task', task.id));
        links.themeKeys.forEach((id) => pushRef(themeMap, id, 'task', task.id));
        links.groupKeys.forEach((id) => pushRef(groupMap, id, 'task', task.id));
      });
      state.collections.procedures.forEach((procedure) => {
        const links = forwardWorkflowLinks('procedure', procedure);
        links.globalTaskIds.forEach((id) => pushRef(taskMap, id, 'procedure', procedure.id));
        links.globalDocIds.forEach((id) => pushRef(docMap, id, 'procedure', procedure.id));
        links.themeKeys.forEach((id) => pushRef(themeMap, id, 'procedure', procedure.id));
        links.groupKeys.forEach((id) => pushRef(groupMap, id, 'procedure', procedure.id));
      });

      const upsertBacklinks = async (storeName, keyField, rows, refsMap) => {
        for (const row of rows) {
          const rowKey = String(row?.[keyField] || '').trim();
          if (!rowKey) continue;
          const refs = refsMap.get(rowKey) || { taskIds: new Set(), procedureIds: new Set() };
          const nextWorkflowRefs = {
            taskIds: Array.from(refs.taskIds).filter(Boolean),
            procedureIds: Array.from(refs.procedureIds).filter(Boolean)
          };
          const prevWorkflowRefs = row?.metadata?.workflowRefs || { taskIds: [], procedureIds: [] };
          const changed = JSON.stringify(prevWorkflowRefs.taskIds || []) !== JSON.stringify(nextWorkflowRefs.taskIds)
            || JSON.stringify(prevWorkflowRefs.procedureIds || []) !== JSON.stringify(nextWorkflowRefs.procedureIds);
          if (!changed) continue;
          await api.put(storeName, {
            ...row,
            metadata: {
              ...(row.metadata || {}),
              workflowRefs: nextWorkflowRefs
            },
            updatedAt: now()
          }, keyField);
        }
      };

      await upsertBacklinks('globalTasks', 'id', state.collections.globalTasks, taskMap);
      await upsertBacklinks('globalDocs', 'id', state.collections.globalDocs, docMap);
      await upsertBacklinks('globalThemes', 'themeKey', state.collections.globalThemes, themeMap);
      await upsertBacklinks('globalGroups', 'groupKey', state.collections.globalGroups, groupMap);
      await loadCollections();
    }

    async function migrateAgentUserIdsFromDirectory(options = {}) {
      const silent = !!options.silent;
      if (!canEditWorkflow()) {
        if (!silent) toast('Lecture seule: migration reservee au role admin ou manager workflow');
        return;
      }

      const users = []
        .concat(Array.isArray(state.collections.users) ? state.collections.users : [])
        .concat(Array.isArray(state.collections.directoryUsers) ? state.collections.directoryUsers : []);
      if (!users.length) {
        if (!silent) toast('Aucun annuaire local disponible pour la migration');
        return;
      }

      const candidatesByKey = new Map();
      const registerCandidate = (key, candidate) => {
        const safe = normalize(key);
        if (!safe) return;
        if (!candidatesByKey.has(safe)) candidatesByKey.set(safe, []);
        const existing = candidatesByKey.get(safe);
        if (!existing.some((row) => String(row.userId || '') === String(candidate.userId || ''))) {
          existing.push(candidate);
        }
      };
      users.forEach((user) => {
        const userId = String(user?.userId || '').trim();
        if (!userId) return;
        const userName = String(user?.name || '').trim();
        const email = String(user?.email || '').trim();
        registerCandidate(userId, user);
        registerCandidate(userName, user);
        if (email.includes('@')) registerCandidate(email.split('@')[0], user);
      });

      let updatedCount = 0;
      let skippedCount = 0;
      const updates = [];
      state.collections.agents.forEach((agent) => {
        const currentMetadataUserId = String(agent?.metadata?.userId || '').trim();
        if (currentMetadataUserId) return;
        const keys = [
          String(agent?.handle || ''),
          String(agent?.displayName || ''),
          String(agent?.title || '')
        ].filter(Boolean);
        let match = null;
        for (const key of keys) {
          const hits = candidatesByKey.get(normalize(key)) || [];
          if (hits.length === 1) {
            match = hits[0];
            break;
          }
        }
        if (!match) {
          skippedCount += 1;
          return;
        }
        updatedCount += 1;
        updates.push(api.put('workflowAgents', {
          ...agent,
          metadata: {
            ...(agent.metadata || {}),
            userId: String(match.userId || '').trim()
          },
          updatedAt: now()
        }, STORE_KEY_FIELDS.workflowAgents));
      });

      await Promise.all(updates);
      await loadCollections();
      refreshWorkflowActionPermissions();
      await logAudit('agent_userid_migration', 'agent', 'bulk', { updatedCount, skippedCount });
      if (!silent || updatedCount > 0) {
        toast(`Migration agents terminee: ${updatedCount} lies, ${skippedCount} ignores`);
      }
    }
    async function ensureSeedData() {
      const communities = await api.getAll('workflowCommunities', STORE_KEY_FIELDS.workflowCommunities);
      if (Array.isArray(communities) && communities.length > 0) return;

      const stamp = now();
      const communityId = `wf-community-${uid()}`;
      const serviceId = `wf-service-${uid()}`;
      const groupId = `wf-group-${uid()}`;
      const agentId = `wf-agent-${uid()}`;
      const softwareId = `wf-software-${uid()}`;
      const procedureId = `wf-procedure-${uid()}`;
      const taskId = `wf-task-${uid()}`;

      await api.put('workflowCommunities', {
        id: communityId,
        name: 'Maison de l autonomie',
        description: 'Perimetre institutionnel principal',
        color: '#1a428a',
        icon: 'account_balance',
        order: 1,
        metadata: {},
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowCommunities);

      await api.put('workflowServices', {
        id: serviceId,
        communityId,
        name: 'Service Evaluation',
        description: 'Evaluation des besoins et orientation',
        managerAgentId: agentId,
        tags: ['evaluation', 'orientation'],
        relatedServiceIds: [],
        metadata: {},
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowServices);

      await api.put('workflowGroups', {
        id: groupId,
        serviceId,
        name: 'Pole instruction',
        description: 'Traitement des dossiers entrants',
        type: 'metier',
        memberAgentIds: [agentId],
        metadata: {},
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowGroups);

      await api.put('workflowAgents', {
        id: agentId,
        displayName: 'Agent referent MDA',
        handle: 'agent.referent',
        title: 'Referent parcours',
        serviceId,
        groupIds: [groupId],
        managerAgentId: null,
        mission: 'Coordonner les evaluations et le suivi des dossiers sensibles.',
        responsibilities: ['Accueil', 'Orientation', 'Coordination'],
        skills: ['Ecoute', 'Analyse sociale', 'Coordination'],
        tools: ['Solis'],
        rbacHints: ['manager'],
        metadata: {},
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowAgents);

      await api.put('workflowSoftware', {
        id: softwareId,
        name: 'Solis',
        description: 'Logiciel metier de suivi des dossiers',
        category: 'Case management',
        linkedTaskIds: [taskId],
        linkedProcedureIds: [procedureId],
        documentationLinks: ['https://intranet/doc/solis-guide'],
        metadata: {},
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowSoftware);

      await api.put('workflowProcedures', {
        id: procedureId,
        title: 'Instruction dossier APA',
        summary: 'Procedure standard d instruction et validation',
        scope: 'Service Evaluation',
        trigger: 'Reception d un dossier complet',
        steps: ['Verifier pieces', 'Saisir dossier', 'Affecter referent', 'Planifier visite'],
        exceptions: ['Piece manquante', 'Dossier urgent'],
        risks: ['Retard instruction', 'Erreur de saisie'],
        linkedSoftwareIds: [softwareId],
        linkedTaskIds: [taskId],
        linkedGlobalTaskIds: [],
        linkedGlobalDocIds: [],
        linkedThemeKeys: [],
        linkedGroupKeys: [],
        attachments: [],
        wikiBodyHtml: '<h2>Objectif</h2><p>Decrire la procedure standard.</p>',
        version: 1,
        updatedAt: stamp,
        metadata: {}
      }, STORE_KEY_FIELDS.workflowProcedures);

      await api.put('workflowTasks', {
        id: taskId,
        title: 'Qualifier le dossier APA',
        description: 'Analyser les pieces et qualifier le niveau de priorite.',
        ownerAgentId: agentId,
        serviceId,
        groupId,
        taskType: 'instruction',
        frequency: 'quotidienne',
        priority: 'high',
        criticality: 'medium',
        estimatedDuration: 45,
        prerequisiteTaskIds: [],
        dependentTaskIds: [],
        linkedProcedureId: procedureId,
        linkedSoftwareIds: [softwareId],
        linkedDocumentIds: [],
        linkedGlobalTaskIds: [],
        linkedThemeKeys: [],
        linkedGroupKeys: [],
        checklist: [
          { id: 'chk-1', label: 'Pieces verifiees', done: true },
          { id: 'chk-2', label: 'Priorite definie', done: false },
          { id: 'chk-3', label: 'Notification envoyee', done: false }
        ],
        status: 'todo',
        approvalStatus: 'pending',
        approvedAt: null,
        approvedByUserId: null,
        metadata: {},
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowTasks);

      await api.put('workflowLayout', defaultLayout(stamp), STORE_KEY_FIELDS.workflowLayout);
      await logAudit('seed', 'workflow', 'main', { seededAt: stamp });
    }

    function getByType(type) {
      if (type === 'community') return state.collections.communities;
      if (type === 'service') return state.collections.services;
      if (type === 'group') return state.collections.groups;
      if (type === 'agent') return state.collections.agents;
      if (type === 'task') return state.collections.tasks;
      if (type === 'procedure') return state.collections.procedures;
      if (type === 'software') return state.collections.software;
      return [];
    }

    function getMaps() {
      const serviceById = new Map(state.collections.services.map((item) => [item.id, item]));
      const groupById = new Map(state.collections.groups.map((item) => [item.id, item]));
      const agentById = new Map(state.collections.agents.map((item) => [item.id, item]));
      const procedureById = new Map(state.collections.procedures.map((item) => [item.id, item]));
      const softwareById = new Map(state.collections.software.map((item) => [item.id, item]));
      const communityById = new Map(state.collections.communities.map((item) => [item.id, item]));
      return { serviceById, groupById, agentById, procedureById, softwareById, communityById };
    }

    function matchesFilterTriplet(serviceId, groupId, agentId) {
      if (state.serviceFilter !== 'all' && String(serviceId || '') !== state.serviceFilter) {
        return false;
      }
      if (state.groupFilter !== 'all' && String(groupId || '') !== state.groupFilter) {
        return false;
      }
      if (state.agentFilter !== 'all' && String(agentId || '') !== state.agentFilter) {
        return false;
      }
      return true;
    }

    function matchesTaskStatus(status) {
      if (state.statusFilter === 'all') return true;
      return String(status || 'todo') === state.statusFilter;
    }

    function filterTasksByStatus(tasks) {
      return (tasks || []).filter((task) => matchesTaskStatus(task?.status));
    }

    function taskStatusLabel(status) {
      const key = String(status || 'todo');
      if (key === 'todo') return 'A faire';
      if (key === 'in_progress') return 'En cours';
      if (key === 'blocked') return 'Bloquee';
      if (key === 'ready_for_review') return 'A valider';
      if (key === 'done') return 'Terminee';
      if (key === 'approved') return 'Approuvee';
      return key || 'todo';
    }

    function applyFilters(items, resolver) {
      const q = normalize(state.query);
      return (items || []).filter((item) => {
        const resolved = resolver ? resolver(item) : {
          serviceId: item?.serviceId || null,
          groupId: item?.groupId || null,
          agentId: item?.ownerAgentId || item?.managerAgentId || null
        };
        const normalizedResolved = typeof resolved === 'string'
          ? {
            serviceId: resolved,
            groupId: resolved === 'all' ? 'all' : null,
            agentId: resolved === 'all' ? 'all' : null
          }
          : {
            serviceId: resolved?.serviceId || null,
            groupId: resolved?.groupId || null,
            agentId: resolved?.agentId || null
          };
        if (normalizedResolved.serviceId !== 'all' && !matchesFilterTriplet(normalizedResolved.serviceId, normalizedResolved.groupId, normalizedResolved.agentId)) {
          return false;
        }
        if (!q) return true;
        const text = normalize(JSON.stringify(item));
        return text.includes(q);
      });
    }

    function renderServiceFilter() {
      if (!refs.serviceFilter) return;
      const previous = state.serviceFilter || 'all';
      const options = ['<option value="all">Tous services</option>']
        .concat(state.collections.services.map((service) => {
          return `<option value="${esc(service.id)}">${esc(service.name || 'Service')}</option>`;
        }));
      refs.serviceFilter.innerHTML = options.join('');
      refs.serviceFilter.value = state.collections.services.some((item) => String(item.id) === String(previous)) ? previous : 'all';
      state.serviceFilter = refs.serviceFilter.value;

      if (refs.groupFilter) {
        const groups = state.serviceFilter === 'all'
          ? state.collections.groups
          : state.collections.groups.filter((group) => String(group.serviceId || '') === state.serviceFilter);
        const previousGroup = state.groupFilter || 'all';
        refs.groupFilter.innerHTML = ['<option value="all">Tous groupes</option>']
          .concat(groups.map((group) => `<option value="${esc(group.id)}">${esc(group.name || 'Groupe')}</option>`))
          .join('');
        refs.groupFilter.value = groups.some((item) => String(item.id) === String(previousGroup)) ? previousGroup : 'all';
        state.groupFilter = refs.groupFilter.value;
      }

      if (refs.agentFilter) {
        let agents = state.serviceFilter === 'all'
          ? state.collections.agents
          : state.collections.agents.filter((agent) => String(agent.serviceId || '') === state.serviceFilter);
        if (state.groupFilter !== 'all') {
          agents = agents.filter((agent) => Array.isArray(agent.groupIds) && agent.groupIds.includes(state.groupFilter));
        }
        const previousAgent = state.agentFilter || 'all';
        refs.agentFilter.innerHTML = ['<option value="all">Tous agents</option>']
          .concat(agents.map((agent) => `<option value="${esc(agent.id)}">${esc(agent.displayName || 'Agent')}</option>`))
          .join('');
        refs.agentFilter.value = agents.some((item) => String(item.id) === String(previousAgent)) ? previousAgent : 'all';
        state.agentFilter = refs.agentFilter.value;
      }
    }

    function refreshWorkflowActionPermissions() {
      const editable = canEditWorkflow();
      [
        'btn-workflow-add-community',
        'btn-workflow-add-service',
        'btn-workflow-add-group',
        'btn-workflow-add-agent',
        'btn-workflow-add-task',
        'btn-workflow-add-procedure',
        'btn-workflow-add-software',
        'btn-workflow-migrate-agent-users'
      ].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !editable;
        if (!editable) {
          btn.title = 'Lecture seule: reserve admin ou manager workflow';
          btn.classList.add('opacity-60', 'cursor-not-allowed');
        } else {
          btn.removeAttribute('title');
          btn.classList.remove('opacity-60', 'cursor-not-allowed');
        }
      });
    }

    function openDetailModal() {
      refs.detailModal?.classList.remove('hidden');
      refs.detail?.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }

    function closeDetailModal() {
      state.selectedType = null;
      state.selectedId = null;
      refs.detail?.classList.add('hidden');
      if (refs.detailBody) refs.detailBody.innerHTML = '';
      refs.detailModal?.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
      renderContent();
    }

    function viewLabel(viewKey) {
      if (viewKey === 'map') return 'Carte';
      if (viewKey === 'organization') return 'Organisation';
      if (viewKey === 'organigram') return 'Organigramme';
      if (viewKey === 'agents') return 'Agents';
      if (viewKey === 'tasks') return 'Taches';
      if (viewKey === 'kanban') return 'Kanban';
      if (viewKey === 'timeline') return 'Timeline';
      if (viewKey === 'procedures') return 'Procedures';
      if (viewKey === 'software') return 'Logiciels metiers';
      if (viewKey === 'journal') return 'Journal';
      return 'Workflow';
    }

    function renderBreadcrumbs() {
      if (!refs.breadcrumbs) return;
      const crumbs = ['Workflow', viewLabel(state.activeView)];
      if (state.selectedType && state.selectedId) {
        const item = getItem(state.selectedType, state.selectedId);
        if (item) {
          crumbs.push(item.name || item.displayName || item.title || String(state.selectedId));
        }
      }
      if (global.TaskMDAWorkflowUI?.renderBreadcrumbHtml) {
        refs.breadcrumbs.innerHTML = global.TaskMDAWorkflowUI.renderBreadcrumbHtml(crumbs, esc);
      } else {
        refs.breadcrumbs.innerHTML = `
          <nav class="workflow-breadcrumb-nav" aria-label="Breadcrumb workflow">
            ${crumbs.map((crumb) => `<span class="workflow-breadcrumb-item">${esc(crumb)}</span>`).join('<span class="workflow-breadcrumb-sep">›</span>')}
          </nav>
        `;
      }
    }

    function buildQuickCardActions(type, id, options = {}) {
      const safeType = String(type || '').trim();
      const safeId = String(id || '').trim();
      if (!safeType || !safeId) return '';
      const editable = canEditWorkflow();
      const status = String(options.status || '').trim();
      const actionModeRaw = typeof api.getWorkflowActionButtonsMode === 'function'
        ? String(api.getWorkflowActionButtonsMode() || '').trim().toLowerCase()
        : 'icon_text';
      const actionMode = ['text', 'icon', 'icon_text'].includes(actionModeRaw) ? actionModeRaw : 'icon_text';
      const actions = [{
        action: 'open',
        label: 'Ouvrir',
        icon: 'open_in_new',
        tone: 'primary'
      }];

      if (safeType === 'task' && editable) {
        if (status !== 'in_progress') {
          actions.push({ action: 'task-status', label: 'En cours', icon: 'play_arrow', nextStatus: 'in_progress' });
        }
        if (!['done', 'approved'].includes(status)) {
          actions.push({ action: 'task-status', label: 'Terminee', icon: 'task_alt', nextStatus: 'done' });
        }
        if (status !== 'approved') {
          actions.push({ action: 'task-status', label: 'Valider', icon: 'verified', nextStatus: 'approved' });
        }
      }

      if ((safeType === 'procedure' || safeType === 'software') && editable) {
        actions.push({ action: 'create-task', label: 'Ajouter tache', icon: 'add_task' });
      }

      if ((safeType === 'task' || safeType === 'procedure' || safeType === 'software') && editable) {
        actions.push({ action: 'delete', label: 'Supprimer', icon: 'delete', tone: 'danger' });
      }

      return `
        <div class="workflow-card-actions">
          ${actions.map((entry) => `
            <button
              type="button"
              class="workflow-card-action-btn ${entry.tone === 'primary' ? 'is-primary' : ''} ${entry.tone === 'danger' ? 'is-danger' : ''} ${actionMode === 'icon' ? 'is-icon-only' : ''} ${actionMode === 'text' ? 'is-text-only' : ''}"
              data-wf-card-action="${esc(entry.action)}"
              data-wf-type="${esc(safeType)}"
              data-wf-id="${esc(safeId)}"
              title="${esc(entry.label)}"
              aria-label="${esc(entry.label)}"
              ${entry.nextStatus ? `data-wf-next-status="${esc(entry.nextStatus)}"` : ''}
            >
              ${actionMode === 'text' ? '' : `<span class="material-symbols-outlined" aria-hidden="true">${esc(entry.icon || 'bolt')}</span>`}
              ${actionMode === 'icon' ? '' : `<span>${esc(entry.label)}</span>`}
            </button>
          `).join('')}
        </div>
      `;
    }

    function cardHtml(type, id, title, sub, chips, actionsHtml = '') {
      const selected = state.selectedType === type && String(state.selectedId) === String(id);
      const chipHtml = (chips || []).map((chip) => `<span class="workflow-chip">${esc(chip)}</span>`).join('');
      return `
        <article class="workflow-card ${selected ? 'is-selected' : ''}" data-wf-type="${esc(type)}" data-wf-id="${esc(id)}">
          <p class="workflow-card-title">${esc(title)}</p>
          ${sub ? `<p class="workflow-card-sub">${esc(sub)}</p>` : ''}
          ${chipHtml ? `<div class="workflow-chip-row">${chipHtml}</div>` : ''}
          ${actionsHtml || ''}
        </article>
      `;
    }

    function clampMapZoom(value) {
      const next = Number(value || 1);
      if (!Number.isFinite(next)) return 1;
      return Math.min(2.4, Math.max(0.6, next));
    }

    function clampOrganigramZoom(value) {
      const next = Number(value || 1);
      if (!Number.isFinite(next)) return 1;
      return Math.min(2.2, Math.max(0.7, next));
    }

    function applyMapTransform() {
      const canvas = refs.content?.querySelector('[data-wf-map-canvas]');
      if (!canvas) return;
      const zoom = clampMapZoom(state.mapOptions?.zoom || 1);
      const panX = Number(state.mapOptions?.panX || 0);
      const panY = Number(state.mapOptions?.panY || 0);
      canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      const zoomLabel = refs.content?.querySelector('[data-wf-map-zoom-label]');
      if (zoomLabel) zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
      refs.content?.querySelectorAll('[data-wf-map-toggle]').forEach((toggle) => {
        const key = String(toggle.getAttribute('data-wf-map-toggle') || '').trim();
        if (!key || !(key in (state.mapOptions || {}))) return;
        toggle.checked = !!state.mapOptions[key];
      });
    }

    function applyOrganigramTransform() {
      const canvas = refs.content?.querySelector('[data-wf-organigram-canvas]');
      if (!canvas) return;
      const zoom = clampOrganigramZoom(state.organigramOptions?.zoom || 1);
      const panX = Number(state.organigramOptions?.panX || 0);
      const panY = Number(state.organigramOptions?.panY || 0);
      canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      const zoomLabel = refs.content?.querySelector('[data-wf-organigram-zoom-label]');
      if (zoomLabel) zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    }

    function buildMapRelations({ services, groups, agents, tasks, maps }) {
      if (global.TaskMDAWorkflowGraph?.buildMapRelations) {
        return global.TaskMDAWorkflowGraph.buildMapRelations({ services, groups, agents, tasks, maps });
      }
      const serviceIds = new Set((services || []).map((row) => String(row.id)));
      const groupIds = new Set((groups || []).map((row) => String(row.id)));
      const agentIds = new Set((agents || []).map((row) => String(row.id)));
      const taskIds = new Set((tasks || []).map((row) => String(row.id)));
      const structure = [];
      const transverse = [];
      const applicative = [];

      (services || []).forEach((service) => {
        if (service.communityId) {
          structure.push({
            label: 'Communaute -> Service',
            source: { type: 'community', id: service.communityId, name: maps.communityById.get(service.communityId)?.name || service.communityId },
            target: { type: 'service', id: service.id, name: service.name || service.id }
          });
        }
        (service.relatedServiceIds || []).forEach((relatedId) => {
          if (!serviceIds.has(String(relatedId))) return;
          if (String(relatedId) <= String(service.id)) return;
          transverse.push({
            label: 'Service <-> Service',
            source: { type: 'service', id: service.id, name: service.name || service.id },
            target: { type: 'service', id: relatedId, name: maps.serviceById.get(relatedId)?.name || relatedId }
          });
        });
      });

      (groups || []).forEach((group) => {
        structure.push({
          label: 'Service -> Groupe',
          source: { type: 'service', id: group.serviceId, name: maps.serviceById.get(group.serviceId)?.name || group.serviceId || 'Sans service' },
          target: { type: 'group', id: group.id, name: group.name || group.id }
        });
      });

      (agents || []).forEach((agent) => {
        if (Array.isArray(agent.groupIds) && agent.groupIds.some((id) => groupIds.has(String(id)))) {
          agent.groupIds.filter((id) => groupIds.has(String(id))).forEach((groupId) => {
            structure.push({
              label: 'Groupe -> Agent',
              source: { type: 'group', id: groupId, name: maps.groupById.get(groupId)?.name || groupId },
              target: { type: 'agent', id: agent.id, name: agent.displayName || agent.id }
            });
          });
          return;
        }
        structure.push({
          label: 'Service -> Agent',
          source: { type: 'service', id: agent.serviceId, name: maps.serviceById.get(agent.serviceId)?.name || agent.serviceId || 'Sans service' },
          target: { type: 'agent', id: agent.id, name: agent.displayName || agent.id }
        });
      });

      (tasks || []).forEach((task) => {
        if (!taskIds.has(String(task.id))) return;
        if (task.linkedProcedureId) {
          applicative.push({
            label: 'Tache -> Procedure',
            source: { type: 'task', id: task.id, name: task.title || task.id },
            target: { type: 'procedure', id: task.linkedProcedureId, name: maps.procedureById.get(task.linkedProcedureId)?.title || task.linkedProcedureId }
          });
        }
        (task.linkedSoftwareIds || []).forEach((softwareId) => {
          applicative.push({
            label: 'Tache -> Logiciel',
            source: { type: 'task', id: task.id, name: task.title || task.id },
            target: { type: 'software', id: softwareId, name: maps.softwareById.get(softwareId)?.name || softwareId }
          });
        });
      });

      return { structure, transverse, applicative };
    }

    function renderMapView() {
      const maps = getMaps();
      const communities = applyFilters(state.collections.communities, () => 'all');
      const services = applyFilters(state.collections.services, (item) => ({ serviceId: item.id }));
      const groups = applyFilters(state.collections.groups, (item) => ({ serviceId: item.serviceId, groupId: item.id }));
      const agents = applyFilters(state.collections.agents, (item) => ({
        serviceId: item.serviceId,
        groupId: Array.isArray(item.groupIds) && item.groupIds.length ? item.groupIds[0] : null,
        agentId: item.id
      }));
      const tasks = filterTasksByStatus(applyFilters(state.collections.tasks, (item) => ({
        serviceId: item.serviceId,
        groupId: item.groupId,
        agentId: item.ownerAgentId
      })));
      const relations = buildMapRelations({ services, groups, agents, tasks, maps });
      const linkQuery = normalize(state.mapOptions.linkQuery || '');
      const linkSort = String(state.mapOptions.linkSort || 'source');

      const prepareRelations = (list) => {
        if (global.TaskMDAWorkflowGraph?.filterAndSortRelations) {
          return global.TaskMDAWorkflowGraph.filterAndSortRelations(list, state.mapOptions.linkQuery, state.mapOptions.linkSort);
        }
        const filtered = (list || []).filter((link) => {
          if (!linkQuery) return true;
          const haystack = normalize(`${link.label || ''} ${link.source?.name || ''} ${link.target?.name || ''}`);
          return haystack.includes(linkQuery);
        });
        const sorted = filtered.slice().sort((a, b) => {
          const sourceCmp = String(a?.source?.name || '').localeCompare(String(b?.source?.name || ''), 'fr');
          const targetCmp = String(a?.target?.name || '').localeCompare(String(b?.target?.name || ''), 'fr');
          const labelCmp = String(a?.label || '').localeCompare(String(b?.label || ''), 'fr');
          if (linkSort === 'target') return targetCmp || sourceCmp || labelCmp;
          if (linkSort === 'label') return labelCmp || sourceCmp || targetCmp;
          return sourceCmp || targetCmp || labelCmp;
        });
        return sorted;
      };
      const preparedRelations = {
        structure: prepareRelations(relations.structure),
        transverse: prepareRelations(relations.transverse),
        applicative: prepareRelations(relations.applicative)
      };

      const col = (title, type, items, subtitleFn) => {
        if (!items.length) {
          return `
            <section class="workflow-map-col workflow-map-col--${esc(type)}" data-wf-col-type="${esc(type)}">
              <h6>${esc(title)}</h6>
              <div class="workflow-empty">Aucune donnee</div>
            </section>
          `;
        }
        return `
          <section class="workflow-map-col workflow-map-col--${esc(type)}" data-wf-col-type="${esc(type)}">
            <h6>${esc(title)}</h6>
            <ul class="workflow-map-list">
              ${items.map((item) => {
                const subtitle = subtitleFn ? subtitleFn(item) : '';
                return `<li class="workflow-map-item workflow-map-item--${esc(type)}" data-wf-type="${esc(type)}" data-wf-id="${esc(item.id)}"><strong>${esc(item.name || item.displayName || item.title || 'Element')}</strong>${subtitle ? ` <span class="text-slate-500">- ${esc(subtitle)}</span>` : ''}</li>`;
              }).join('')}
            </ul>
          </section>
        `;
      };

      const relationLimit = (() => {
        const total = preparedRelations.structure.length + preparedRelations.transverse.length + preparedRelations.applicative.length;
        if (total > 600) return 40;
        if (total > 300) return 70;
        return 120;
      })();

      const relationSectionHtml = (title, list, arrow, showAllKey, visibleKey, sectionKey, colorClass) => {
        const isExpanded = !!state.mapOptions[showAllKey];
        if (!isExpanded && Number(state.mapOptions[visibleKey] || 0) < relationLimit) {
          state.mapOptions[visibleKey] = relationLimit;
        }
        const progressiveLimit = Math.max(relationLimit, Number(state.mapOptions[visibleKey] || relationLimit));
        const visible = isExpanded ? list.slice(0, progressiveLimit) : list.slice(0, relationLimit);
        const remaining = Math.max(0, list.length - visible.length);
        return `
          <section class="workflow-map-links-col ${esc(colorClass)}">
            <h6>${esc(title)} (${list.length})</h6>
            <ul>${visible.map((link) => `<li><span>${esc(link.label)}:</span> <button type="button" class="workflow-map-link-btn" data-wf-type="${esc(link.source.type)}" data-wf-id="${esc(link.source.id)}">${esc(link.source.name)}</button> ${arrow} <button type="button" class="workflow-map-link-btn" data-wf-type="${esc(link.target.type)}" data-wf-id="${esc(link.target.id)}">${esc(link.target.name)}</button></li>`).join('') || '<li>Aucune liaison</li>'}</ul>
            ${!isExpanded && list.length > relationLimit ? `<button type="button" class="workflow-map-more-btn" data-wf-map-links-action="expand_${esc(sectionKey)}">Afficher plus (mode progressif)</button>` : ''}
            ${isExpanded && remaining > 0 ? `<button type="button" class="workflow-map-more-btn" data-wf-map-links-action="more_${esc(sectionKey)}">Charger +${Math.min(100, remaining)}</button>` : ''}
            ${isExpanded ? `<button type="button" class="workflow-map-more-btn" data-wf-map-links-action="collapse_${esc(sectionKey)}">Voir moins</button>` : ''}
          </section>
        `;
      };

      refs.content.innerHTML = `
        <div class="workflow-map-shell">
          <div class="workflow-map-toolbar">
            <div class="workflow-map-controls">
              <button type="button" class="workflow-org-action" data-wf-map-action="zoom_out">-</button>
              <button type="button" class="workflow-org-action" data-wf-map-action="zoom_in">+</button>
              <button type="button" class="workflow-org-action" data-wf-map-action="reset">Recentrer</button>
              <span class="workflow-map-zoom" data-wf-map-zoom-label>100%</span>
            </div>
            <div class="workflow-map-legend">
              <label><input type="checkbox" data-wf-map-toggle="showStructure" checked> Structure</label>
              <label><input type="checkbox" data-wf-map-toggle="showTransverse" checked> Transverses</label>
              <label><input type="checkbox" data-wf-map-toggle="showApplicative" checked> Applicatives</label>
            </div>
          </div>
          <div class="workflow-map-link-filters">
            <input type="text" class="workflow-form-input workflow-map-link-search" data-wf-map-input="linkQuery" placeholder="Rechercher une liaison..." value="${esc(state.mapOptions.linkQuery || '')}">
            <select class="workflow-form-select workflow-map-link-sort" data-wf-map-input="linkSort">
              <option value="source" ${linkSort === 'source' ? 'selected' : ''}>Tri: Source</option>
              <option value="target" ${linkSort === 'target' ? 'selected' : ''}>Tri: Cible</option>
              <option value="label" ${linkSort === 'label' ? 'selected' : ''}>Tri: Type de lien</option>
            </select>
          </div>
          <div class="workflow-map-viewport" data-wf-map-viewport>
            <div class="workflow-map-canvas" data-wf-map-canvas>
              <div class="workflow-map">
                ${col('Communautes', 'community', communities, null)}
                ${col('Services', 'service', services, (item) => {
                  const transverse = Array.isArray(item.relatedServiceIds) ? item.relatedServiceIds.length : 0;
                  return `${maps.communityById.get(item.communityId)?.name || 'Sans communaute'}${transverse > 0 ? ` - ${transverse} liens transverses` : ''}`;
                })}
                ${col('Groupes', 'group', groups, (item) => maps.serviceById.get(item.serviceId)?.name || 'Sans service')}
                ${col('Agents', 'agent', agents, (item) => {
                  const managerName = maps.agentById.get(item.managerAgentId)?.displayName || '';
                  const serviceName = maps.serviceById.get(item.serviceId)?.name || 'Sans service';
                  return managerName ? `${serviceName} - Manager: ${managerName}` : serviceName;
                })}
              </div>
            </div>
          </div>
          <div class="workflow-map-links">
            ${state.mapOptions.showStructure ? relationSectionHtml('Liaisons structurelles', preparedRelations.structure, '→', 'showAllStructure', 'structureVisible', 'structure', 'is-structure') : ''}
            ${state.mapOptions.showTransverse ? relationSectionHtml('Liaisons transverses', preparedRelations.transverse, '↔', 'showAllTransverse', 'transverseVisible', 'transverse', 'is-transverse') : ''}
            ${state.mapOptions.showApplicative ? relationSectionHtml('Liaisons applicatives', preparedRelations.applicative, '→', 'showAllApplicative', 'applicativeVisible', 'applicative', 'is-applicative') : ''}
          </div>
        </div>
      `;
      applyMapTransform();
    }

    function renderOrganizationView() {
      const maps = getMaps();
      const filteredCommunities = applyFilters(state.collections.communities, () => 'all');
      const filteredServices = applyFilters(state.collections.services, (item) => ({ serviceId: item.id }));
      const filteredGroups = applyFilters(state.collections.groups, (item) => ({ serviceId: item.serviceId, groupId: item.id }));
      const filteredAgents = applyFilters(state.collections.agents, (item) => ({
        serviceId: item.serviceId,
        groupId: Array.isArray(item.groupIds) && item.groupIds.length ? item.groupIds[0] : null,
        agentId: item.id
      }));

      const allGroupsById = new Map((state.collections.groups || []).map((group) => [String(group.id), group]));
      const groupsByService = new Map();
      const groupById = new Map();
      filteredGroups.forEach((group) => {
        groupById.set(String(group.id), group);
        const serviceId = String(group.serviceId || '__none__');
        if (!groupsByService.has(serviceId)) groupsByService.set(serviceId, []);
        groupsByService.get(serviceId).push(group);
      });

      const servicesByCommunity = new Map();
      filteredServices.forEach((service) => {
        const rawCommunityId = String(service.communityId || '').trim();
        const hasKnownCommunity = rawCommunityId && maps.communityById.has(rawCommunityId);
        const communityId = hasKnownCommunity ? rawCommunityId : '__none__';
        if (!servicesByCommunity.has(communityId)) servicesByCommunity.set(communityId, []);
        servicesByCommunity.get(communityId).push(service);
      });

      const filteredGroupIds = new Set(filteredGroups.map((group) => String(group.id)));
      const agentsByGroup = new Map();
      const directAgentsByService = new Map();
      filteredAgents.forEach((agent) => {
        const agentServiceId = String(agent.serviceId || '');
        const linkedGroups = Array.isArray(agent.groupIds)
          ? agent.groupIds
            .map((id) => String(id))
            .filter((id) => filteredGroupIds.has(id))
            .filter((id) => {
              const group = groupById.get(id);
              if (!group) return false;
              const groupServiceId = String(group.serviceId || '');
              if (!groupServiceId || !agentServiceId) return true;
              return groupServiceId === agentServiceId;
            })
          : [];
        if (linkedGroups.length > 0) {
          linkedGroups.forEach((groupId) => {
            if (!agentsByGroup.has(groupId)) agentsByGroup.set(groupId, []);
            agentsByGroup.get(groupId).push(agent);
          });
          return;
        }
        const serviceId = String(agent.serviceId || '__none__');
        if (!directAgentsByService.has(serviceId)) directAgentsByService.set(serviceId, []);
        directAgentsByService.get(serviceId).push(agent);
      });

      const defaultBranchOpen = (type) => type === 'community' || type === 'service';
      const nodeHtml = (type, id, title, subtitle, chips, childrenHtml) => {
        const hasChildren = !!String(childrenHtml || '').trim();
        const branchKey = `${type}:${id}`;
        const savedBranchState = String(state.orgBranchState?.[branchKey] || '').trim();
        const branchState = hasChildren
          ? ((savedBranchState === 'open' || savedBranchState === 'closed')
            ? savedBranchState
            : (defaultBranchOpen(type) ? 'open' : 'closed'))
          : 'leaf';
        return `
          <li class="workflow-org-node workflow-org-node--${esc(type)} ${hasChildren ? 'workflow-org-branch' : ''}" data-wf-branch-state="${esc(branchState)}" ${hasChildren ? `data-wf-branch-key="${esc(branchKey)}"` : ''}>
            <article class="workflow-org-card" data-wf-type="${esc(type)}" data-wf-id="${esc(id)}">
              <div class="workflow-org-head">
                <p class="workflow-org-title">${esc(title || 'Element')}</p>
                ${hasChildren ? `<button class="workflow-org-toggle" type="button" data-wf-branch-toggle aria-expanded="${branchState === 'open' ? 'true' : 'false'}" title="Replier ou deplier">▾</button>` : ''}
              </div>
              ${subtitle ? `<p class="workflow-org-sub">${esc(subtitle)}</p>` : ''}
              ${(chips || []).length ? `<div class="workflow-chip-row">${chips.map((chip) => {
                if (chip && typeof chip === 'object') {
                  const cls = String(chip.className || '').trim();
                  const titleAttr = chip.title ? ` title="${esc(chip.title)}"` : '';
                  return `<span class="workflow-chip ${esc(cls)}"${titleAttr}>${esc(chip.label || '')}</span>`;
                }
                return `<span class="workflow-chip">${esc(chip)}</span>`;
              }).join('')}</div>` : ''}
            </article>
            ${hasChildren ? `<ul class="workflow-org-children">${childrenHtml}</ul>` : ''}
          </li>
        `;
      };

      const buildAgentNode = (agent) => {
        const serviceName = maps.serviceById.get(agent.serviceId)?.name || 'Sans service';
        const managerName = maps.agentById.get(agent.managerAgentId)?.displayName || '';
        const inconsistentGroupIds = (Array.isArray(agent.groupIds) ? agent.groupIds : [])
          .map((id) => String(id))
          .filter((id) => {
            const group = allGroupsById.get(id);
            if (!group) return false;
            const groupServiceId = String(group.serviceId || '');
            const agentServiceId = String(agent.serviceId || '');
            return !!(groupServiceId && agentServiceId && groupServiceId !== agentServiceId);
          });
        const chips = [agent.title || 'Agent'];
        if (managerName) chips.push(`Manager: ${managerName}`);
        if (inconsistentGroupIds.length > 0) {
          chips.push({
            label: '⚠ incoherence service/groupe',
            className: 'workflow-chip-warning',
            title: `${inconsistentGroupIds.length} rattachement(s) groupe hors service`
          });
        }
        return nodeHtml('agent', agent.id, agent.displayName || 'Agent', serviceName, chips, '');
      };

      const buildGroupNode = (group) => {
        const members = (agentsByGroup.get(String(group.id)) || []).map(buildAgentNode).join('');
        const memberCount = (agentsByGroup.get(String(group.id)) || []).length || (Array.isArray(group.memberAgentIds) ? group.memberAgentIds.length : 0);
        const placeholder = members ? '' : '<li class="workflow-org-ghost">Aucun agent rattache</li>';
        return nodeHtml('group', group.id, group.name || 'Groupe', maps.serviceById.get(group.serviceId)?.name || 'Sans service', [`${memberCount} membres`], `${members}${placeholder}`);
      };

      const buildServiceNode = (service) => {
        const groups = (groupsByService.get(String(service.id)) || []).map(buildGroupNode).join('');
        const directAgents = (directAgentsByService.get(String(service.id)) || []).map(buildAgentNode).join('');
        const manager = maps.agentById.get(service.managerAgentId)?.displayName || 'Sans responsable';
        const transverse = Array.isArray(service.relatedServiceIds) ? service.relatedServiceIds.length : 0;
        const children = `${groups}${directAgents}`;
        const placeholder = children ? '' : '<li class="workflow-org-ghost">Aucun groupe ou agent direct</li>';
        return nodeHtml('service', service.id, service.name || 'Service', maps.communityById.get(service.communityId)?.name || 'Sans communaute', [manager, `${transverse} liens`], `${children}${placeholder}`);
      };

      const renderedCommunities = filteredCommunities.map((community) => {
        const services = (servicesByCommunity.get(String(community.id)) || []).map(buildServiceNode).join('');
        if (!services && state.serviceFilter !== 'all') return '';
        const serviceCount = (servicesByCommunity.get(String(community.id)) || []).length;
        const placeholder = services ? '' : '<li class="workflow-org-ghost">Aucun service visible</li>';
        return nodeHtml('community', community.id, community.name || 'Communaute', community.description || '', [`${serviceCount} services`], `${services}${placeholder}`);
      }).filter(Boolean);

      const orphanServices = (servicesByCommunity.get('__none__') || []).map(buildServiceNode).join('');
      if (orphanServices) {
        renderedCommunities.push(`
          <li class="workflow-org-node workflow-org-node--community">
            <article class="workflow-org-card workflow-org-card--ghost">
              <p class="workflow-org-title">Sans communaute</p>
              <p class="workflow-org-sub">Services non rattaches</p>
            </article>
            <ul class="workflow-org-children">${orphanServices}</ul>
          </li>
        `);
      }

      refs.content.innerHTML = `
        <section class="workflow-org">
          <p class="workflow-org-hint">Vue arbre de l'organisation avec liaisons communaute → service → groupe → agent.</p>
          <div class="workflow-org-actions">
            <button class="workflow-org-action" type="button" data-wf-org-action="expand_all">Tout deplier</button>
            <button class="workflow-org-action" type="button" data-wf-org-action="collapse_all">Tout replier</button>
            <button class="workflow-org-action" type="button" data-wf-org-action="export_pdf">Telecharger PDF</button>
          </div>
          <ul class="workflow-org-root">
            ${renderedCommunities.join('') || '<li class="workflow-empty">Aucune donnee organisationnelle visible</li>'}
          </ul>
        </section>
      `;
    }

    function renderOrganigramView() {
      const maps = getMaps();
      const filteredCommunities = applyFilters(state.collections.communities, () => 'all');
      const filteredServices = applyFilters(state.collections.services, (item) => ({ serviceId: item.id }));
      const filteredGroups = applyFilters(state.collections.groups, (item) => ({ serviceId: item.serviceId, groupId: item.id }));
      const filteredAgents = applyFilters(state.collections.agents, (item) => ({
        serviceId: item.serviceId,
        groupId: Array.isArray(item.groupIds) && item.groupIds.length ? item.groupIds[0] : null,
        agentId: item.id
      }));
      const visibleServiceIds = new Set(filteredServices.map((service) => String(service.id || '')));
      const serviceAgentsMap = new Map();
      filteredAgents.forEach((agent) => {
        const serviceId = String(agent?.serviceId || '').trim();
        if (!serviceId || !visibleServiceIds.has(serviceId)) return;
        if (!serviceAgentsMap.has(serviceId)) serviceAgentsMap.set(serviceId, []);
        serviceAgentsMap.get(serviceId).push(agent);
      });

      const tasksByService = new Map();
      filterTasksByStatus(applyFilters(state.collections.tasks, (item) => ({
        serviceId: item.serviceId,
        groupId: item.groupId,
        agentId: item.ownerAgentId
      }))).forEach((task) => {
        const serviceId = String(task?.serviceId || '').trim();
        if (!serviceId || !visibleServiceIds.has(serviceId)) return;
        if (!tasksByService.has(serviceId)) tasksByService.set(serviceId, []);
        tasksByService.get(serviceId).push(task);
      });
      const groupsByService = new Map();
      filteredGroups.forEach((group) => {
        const serviceId = String(group?.serviceId || '').trim();
        if (!serviceId || !visibleServiceIds.has(serviceId)) return;
        if (!groupsByService.has(serviceId)) groupsByService.set(serviceId, []);
        groupsByService.get(serviceId).push(group);
      });
      const servicesByCommunity = new Map();
      filteredServices.forEach((service) => {
        const rawCommunityId = String(service?.communityId || '').trim();
        const hasKnownCommunity = rawCommunityId && maps.communityById.has(rawCommunityId);
        const communityId = hasKnownCommunity ? rawCommunityId : '__none__';
        if (!servicesByCommunity.has(communityId)) servicesByCommunity.set(communityId, []);
        servicesByCommunity.get(communityId).push(service);
      });

      const linkMap = new Map(filteredServices.map((service) => [String(service.id || ''), new Set()]));
      filteredServices.forEach((service) => {
        const sourceId = String(service?.id || '').trim();
        if (!sourceId || !linkMap.has(sourceId)) return;
        const related = Array.isArray(service.relatedServiceIds) ? service.relatedServiceIds : [];
        related.forEach((targetRawId) => {
          const targetId = String(targetRawId || '').trim();
          if (!targetId || targetId === sourceId || !linkMap.has(targetId)) return;
          linkMap.get(sourceId).add(targetId);
          linkMap.get(targetId).add(sourceId);
        });
      });

      const rootService = filteredServices.find((service) => {
        const serviceId = String(service?.id || '');
        const agents = serviceAgentsMap.get(serviceId) || [];
        return agents.length > 0 || tasksByService.has(serviceId);
      }) || filteredServices[0] || null;

      const rootId = String(rootService?.id || '');

      const initials = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '?';
        const letters = raw.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('');
        return letters ? letters.toUpperCase() : raw.slice(0, 1).toUpperCase();
      };

      const statusMeta = (service) => {
        const linkedTasks = tasksByService.get(String(service?.id || '')) || [];
        const hasBlocked = linkedTasks.some((task) => String(task?.status || '') === 'blocked');
        const hasReview = linkedTasks.some((task) => String(task?.status || '') === 'ready_for_review');
        if (hasBlocked) return { label: 'TENSION', className: 'is-warning' };
        if (hasReview) return { label: 'A VALIDER', className: 'is-review' };
        return { label: 'ACTIF', className: 'is-active' };
      };

      const renderAgents = (serviceId) => {
        const list = (serviceAgentsMap.get(String(serviceId || '')) || []).slice(0, 3);
        if (!list.length) return '<span class="workflow-organigram-avatar is-empty">NA</span>';
        const extra = Math.max(0, (serviceAgentsMap.get(String(serviceId || '')) || []).length - list.length);
        return `
          <div class="workflow-organigram-avatars">
            ${list.map((agent) => `<span class="workflow-organigram-avatar" title="${esc(agent.displayName || 'Agent')}">${esc(initials(agent.displayName || agent.handle || 'A'))}</span>`).join('')}
            ${extra > 0 ? `<span class="workflow-organigram-avatar is-extra">+${extra}</span>` : ''}
          </div>
        `;
      };

      const renderServiceCard = (service, options = {}) => {
        const rootServiceId = String(options.rootServiceId || '').trim();
        const serviceId = String(service?.id || '');
        const isRoot = !!options.isRoot;
        const linkedToRoot = rootServiceId ? !!linkMap.get(rootServiceId)?.has(serviceId) : false;
        const showLinkToRootAction = rootServiceId && !isRoot && !linkedToRoot;
        const manager = maps.agentById.get(service.managerAgentId)?.displayName
          || (serviceAgentsMap.get(serviceId)?.[0]?.displayName)
          || 'Responsable non defini';
        const count = (serviceAgentsMap.get(serviceId) || []).length;
        const tag = statusMeta(service);
        const linkedCount = (linkMap.get(serviceId) && linkMap.get(serviceId).size) ? linkMap.get(serviceId).size : 0;
        const groups = groupsByService.get(serviceId) || [];
        const rootBadge = isRoot ? '<span class="workflow-organigram-service-root-badge">Racine</span>' : '';
        const rootLinkState = !isRoot && rootServiceId
          ? `<span class="workflow-organigram-service-linkstate ${linkedToRoot ? 'is-linked' : 'is-unlinked'}">${linkedToRoot ? 'Relie a la racine' : 'Non relie a la racine'}</span>`
          : '';
        const groupsHtml = groups.length
          ? `
            <div class="workflow-organigram-group-level">
              <div class="workflow-organigram-group-line"></div>
              <div class="workflow-organigram-group-grid">
                ${groups.map((group) => `<article class="workflow-organigram-group-card" data-wf-type="group" data-wf-id="${esc(group.id)}"><p class="workflow-organigram-group-title">${esc(group.name || 'Groupe')}</p><p class="workflow-organigram-group-sub">${esc(group.type || 'metier')}</p></article>`).join('')}
              </div>
            </div>
          `
          : '<div class="workflow-organigram-group-empty">Aucun groupe rattache</div>';
        return `
          <div class="workflow-organigram-service-column">
            <div class="workflow-organigram-service-stem" aria-hidden="true"></div>
            <article class="workflow-organigram-service-card ${isRoot ? 'is-root' : ''}" data-wf-type="service" data-wf-id="${esc(serviceId)}">
              <div class="workflow-organigram-service-head">
                <p class="workflow-organigram-service-title">${esc(service.name || 'Service')}</p>
                <span class="workflow-organigram-status ${esc(tag.className)}">${esc(tag.label)}</span>
              </div>
              <p class="workflow-organigram-service-sub">${esc(service.description || 'Service operationnel du workflow.')}</p>
              <div class="workflow-organigram-service-foot">
                ${renderAgents(serviceId)}
                <div class="workflow-organigram-manager">
                  <p>Responsable</p>
                  <strong>${esc(manager)}</strong>
                  <span>${esc(`${count} agent${count > 1 ? 's' : ''} - ${groups.length} groupe${groups.length > 1 ? 's' : ''} - ${linkedCount} lien${linkedCount > 1 ? 's' : ''}`)}</span>
                </div>
              </div>
              <div class="workflow-organigram-service-meta">
                ${rootBadge}
                ${rootLinkState}
              </div>
              ${showLinkToRootAction ? `
                <div class="workflow-detail-actions mt-2">
                  <button type="button" class="workflow-btn-link-root" data-wf-organigram-link-root="${esc(serviceId)}" data-wf-organigram-root-id="${esc(rootServiceId)}"><span class="material-symbols-outlined">link</span><span>Relier maintenant</span></button>
                </div>
              ` : ''}
            </article>
            ${groupsHtml}
          </div>
        `;
      };

      const renderCommunityBlock = (community) => {
        const communityId = String(community?.id || '__none__');
        const services = servicesByCommunity.get(communityId) || [];
        const totalAgents = services.reduce((sum, service) => {
          const sid = String(service?.id || '');
          return sum + (serviceAgentsMap.get(sid)?.length || 0);
        }, 0);
        const leadService = services[0] || null;
        const leadManager = leadService
          ? (maps.agentById.get(leadService.managerAgentId)?.displayName
            || (serviceAgentsMap.get(String(leadService.id || ''))?.[0]?.displayName)
            || 'Responsable non defini')
          : 'Responsable non defini';
        const serviceCols = services.map((service) => renderServiceCard(service, { isRoot: String(service.id || '') === rootId, rootServiceId: rootId })).join('');
        return `
          <section class="workflow-organigram-community-block">
            <article class="workflow-organigram-community-card" data-wf-type="community" data-wf-id="${esc(community.id)}">
              <div class="workflow-organigram-community-watermark material-symbols-outlined" aria-hidden="true">account_balance</div>
              <p class="workflow-organigram-community-kicker">Siege social</p>
              <h6>${esc(community.name || 'Communaute')}</h6>
              <div class="workflow-organigram-community-foot">
                <div>
                  <p class="workflow-organigram-community-meta-label">Responsable</p>
                  <strong>${esc(leadManager)}</strong>
                </div>
                <div class="workflow-organigram-community-count">
                  <p class="workflow-organigram-community-meta-label">Effectif</p>
                  <strong>${esc(`${totalAgents} agent${totalAgents > 1 ? 's' : ''}`)}</strong>
                </div>
              </div>
            </article>
            <div class="workflow-organigram-community-stem" aria-hidden="true"></div>
            <div class="workflow-organigram-service-level">
              ${services.length > 1 ? '<div class="workflow-organigram-service-line" aria-hidden="true"></div>' : ''}
              <div class="workflow-organigram-grid">
                ${serviceCols || '<div class="workflow-empty">Aucun service visible</div>'}
              </div>
            </div>
          </section>
        `;
      };
      const communityBlocks = filteredCommunities.map(renderCommunityBlock);
      const orphanServices = servicesByCommunity.get('__none__') || [];
      if (orphanServices.length) {
        communityBlocks.push(`
          <section class="workflow-organigram-community-block">
            <article class="workflow-organigram-community-card is-ghost">
              <p class="workflow-organigram-community-kicker">Communaute</p>
              <h6>Sans communaute</h6>
              <p>Services non rattaches</p>
              <span>${orphanServices.length} service${orphanServices.length > 1 ? 's' : ''}</span>
            </article>
            <div class="workflow-organigram-community-stem" aria-hidden="true"></div>
            <div class="workflow-organigram-service-level">
              ${orphanServices.length > 1 ? '<div class="workflow-organigram-service-line" aria-hidden="true"></div>' : ''}
              <div class="workflow-organigram-grid">
                ${orphanServices.map((service) => renderServiceCard(service, { isRoot: String(service.id || '') === rootId, rootServiceId: rootId })).join('')}
              </div>
            </div>
          </section>
        `);
      }

      refs.content.innerHTML = `
        <section class="workflow-organigram">
          <div class="workflow-organigram-head">
            <div>
              <p class="workflow-organigram-kicker">Vue structurelle</p>
              <h5 class="workflow-organigram-title">Organigramme institutionnel</h5>
            </div>
            <div class="workflow-organigram-controls">
              <button type="button" class="workflow-org-action" data-wf-organigram-action="zoom_out" title="Zoom -">-</button>
              <button type="button" class="workflow-org-action" data-wf-organigram-action="zoom_in" title="Zoom +">+</button>
              <button type="button" class="workflow-org-action" data-wf-organigram-action="reset" title="Recentrer">Recentrer</button>
              <button type="button" class="workflow-org-action" data-wf-organigram-action="export_pdf_portrait" title="Exporter en PDF portrait">PDF Portrait</button>
              <button type="button" class="workflow-org-action" data-wf-organigram-action="export_pdf_landscape" title="Exporter en PDF paysage">PDF Paysage</button>
              <button type="button" class="workflow-org-action" data-wf-organigram-action="export_pdf_auto" title="Exporter en PDF auto">PDF Auto</button>
              <span class="workflow-map-zoom" data-wf-organigram-zoom-label>100%</span>
            </div>
          </div>
          <div class="workflow-organigram-viewport" data-wf-organigram-viewport>
            <div class="workflow-organigram-canvas" data-wf-organigram-canvas>
              <div class="workflow-organigram-tree">
                ${communityBlocks.join('') || '<div class="workflow-empty">Aucune donnee organisationnelle visible</div>'}
              </div>
            </div>
          </div>
        </section>
      `;
      applyOrganigramTransform();
    }

    function exportOrganigramAsPdf(orientation) {
      const section = refs.content?.querySelector('.workflow-organigram');
      if (!section) {
        toast('Aucun organigramme a exporter');
        return;
      }
      const mode = String(orientation || 'landscape') === 'portrait' ? 'portrait' : 'landscape';
      const popup = window.open('', '_blank', `noopener,noreferrer,width=${mode === 'portrait' ? 1000 : 1320},height=920`);
      if (!popup) {
        toast('Pop-up bloquee: autorisez la fenetre pour exporter le PDF');
        return;
      }

      const clone = section.cloneNode(true);
      clone.querySelectorAll('.workflow-organigram-controls').forEach((node) => node.remove());
      clone.querySelectorAll('.workflow-btn-link-root').forEach((node) => node.remove());
      clone.querySelectorAll('[data-wf-organigram-canvas]').forEach((node) => {
        node.style.transform = 'none';
      });

      const stylesheetLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map((link) => link.outerHTML)
        .join('\n');
      const inlineStyles = Array.from(document.querySelectorAll('style'))
        .map((styleNode) => styleNode.outerHTML)
        .join('\n');
      const exportedAt = new Date().toLocaleString();
      const pageSize = mode === 'portrait' ? 'A4 portrait' : 'A4 landscape';
      const modeLabel = mode === 'portrait' ? 'portrait' : 'paysage';

      const html = `
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Organigramme workflow (${esc(modeLabel)})</title>
  ${stylesheetLinks}
  ${inlineStyles}
  <style>
    body { margin: 0; padding: 12px; background: #ffffff; color: #0f172a; font-family: "Inter", Arial, sans-serif; }
    .wf-print-head { margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 7px; }
    .wf-print-title { margin: 0; font-size: 18px; font-weight: 800; }
    .wf-print-meta { margin: 3px 0 0; font-size: 12px; color: #475569; }
    .workflow-organigram { gap: 8px; }
    .workflow-organigram-head { margin-bottom: 4px; }
    .workflow-organigram-viewport { overflow: visible !important; border: 0 !important; min-height: auto !important; background: #ffffff !important; cursor: default !important; }
    .workflow-organigram-canvas { transform: none !important; min-width: 0 !important; padding: 0 !important; }
    .workflow-organigram-tree { gap: 12px; }
    .workflow-organigram-community-block,
    .workflow-organigram-community-card,
    .workflow-organigram-service-column,
    .workflow-organigram-service-card,
    .workflow-organigram-group-card { break-inside: avoid; page-break-inside: avoid; }
    .workflow-organigram-service-level,
    .workflow-organigram-grid,
    .workflow-organigram-group-grid { overflow: visible !important; }
    .wf-print-portrait .workflow-organigram-service-column { width: min(100%, 280px); }
    .wf-print-portrait .workflow-organigram-community-card { width: 100%; }
    .wf-print-portrait .workflow-organigram-canvas { font-size: 0.95em; }
    @page { size: ${pageSize}; margin: 8mm; }
  </style>
</head>
<body class="wf-print-${esc(mode)}">
  <header class="wf-print-head">
    <h1 class="wf-print-title">Organigramme workflow</h1>
    <p class="wf-print-meta">Format ${esc(modeLabel)} - export du ${esc(exportedAt)}</p>
  </header>
  ${clone.outerHTML}
</body>
</html>
      `;

      const printWithPopup = () => {
        if (!popup) return false;
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        setTimeout(() => {
          try {
            popup.focus();
            popup.print();
          } catch (_) {
            // fallback iframe below
          }
        }, 320);
        return true;
      };

      const printWithIframe = () => {
        const frame = document.createElement('iframe');
        frame.style.position = 'fixed';
        frame.style.right = '0';
        frame.style.bottom = '0';
        frame.style.width = '0';
        frame.style.height = '0';
        frame.style.border = '0';
        frame.setAttribute('aria-hidden', 'true');
        document.body.appendChild(frame);

        const cleanup = () => setTimeout(() => frame.remove(), 1200);
        frame.onload = () => {
          setTimeout(() => {
            try {
              frame.contentWindow?.focus();
              frame.contentWindow?.print();
            } catch (error) {
              console.error('workflow organigram print iframe', error);
              toast('Erreur export PDF: impossible de lancer l impression');
            } finally {
              cleanup();
            }
          }, 260);
        };
        const doc = frame.contentDocument || frame.contentWindow?.document;
        if (!doc) {
          cleanup();
          toast('Erreur export PDF: document d impression indisponible');
          return;
        }
        doc.open();
        doc.write(html);
        doc.close();
      };

      const popupPrinted = printWithPopup();
      if (!popupPrinted) {
        printWithIframe();
      }
    }

    function detectOrganigramPdfOrientation() {
      const tree = refs.content?.querySelector('.workflow-organigram-tree');
      if (!tree) return 'landscape';
      const width = Number(tree.scrollWidth || tree.getBoundingClientRect?.().width || 0);
      const height = Number(tree.scrollHeight || tree.getBoundingClientRect?.().height || 0);
      if (!width || !height) return 'landscape';
      const ratio = width / height;
      return ratio > 0.9 ? 'landscape' : 'portrait';
    }

    function exportOrganizationAsPdf() {
      const section = refs.content?.querySelector('.workflow-org');
      if (!section) {
        toast('Aucun organigramme a exporter');
        return;
      }
      const popup = window.open('', '_blank', 'noopener,noreferrer,width=1320,height=920');
      if (!popup) {
        toast('Pop-up bloquee: autorisez la fenetre pour exporter le PDF');
        return;
      }

      const clone = section.cloneNode(true);
      clone.querySelectorAll('.workflow-org-actions').forEach((node) => node.remove());
      clone.querySelectorAll('.workflow-org-toggle').forEach((node) => node.remove());
      clone.querySelectorAll('.workflow-org-branch').forEach((node) => node.setAttribute('data-wf-branch-state', 'open'));

      const stylesheetLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map((link) => link.outerHTML)
        .join('\n');
      const inlineStyles = Array.from(document.querySelectorAll('style'))
        .map((styleNode) => styleNode.outerHTML)
        .join('\n');
      const exportedAt = new Date().toLocaleString();

      const html = `
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Organigramme workflow</title>
  ${stylesheetLinks}
  ${inlineStyles}
  <style>
    body { margin: 0; padding: 18px; background: #ffffff; color: #0f172a; font-family: "Inter", Arial, sans-serif; }
    .wf-print-head { margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; }
    .wf-print-title { margin: 0; font-size: 18px; font-weight: 800; }
    .wf-print-meta { margin: 3px 0 0; font-size: 12px; color: #475569; }
    .workflow-org-hint { margin-bottom: 10px; }
    .workflow-org-card { break-inside: avoid; }
    .workflow-chip { border: 1px solid rgba(30, 58, 138, 0.14); }
    @page { size: A4 landscape; margin: 10mm; }
  </style>
</head>
<body>
  <header class="wf-print-head">
    <h1 class="wf-print-title">Organigramme workflow</h1>
    <p class="wf-print-meta">Export du ${esc(exportedAt)}</p>
  </header>
  ${clone.outerHTML}
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.focus();
        window.print();
      }, 220);
    });
  </script>
</body>
</html>
      `;

      popup.document.open();
      popup.document.write(html);
      popup.document.close();
    }
    function renderAgentsView() {
      const maps = getMaps();
      const cards = applyFilters(state.collections.agents, (item) => ({
        serviceId: item.serviceId,
        groupId: Array.isArray(item.groupIds) && item.groupIds.length ? item.groupIds[0] : null,
        agentId: item.id
      })).map((item) => {
        const serviceName = maps.serviceById.get(item.serviceId)?.name || 'Sans service';
        const taskCount = state.collections.tasks.filter((task) => task.ownerAgentId === item.id).length;
        const managerName = maps.agentById.get(item.managerAgentId)?.displayName || 'Aucun manager';
        const reports = state.collections.agents.filter((agent) => agent.managerAgentId === item.id).length;
        return cardHtml('agent', item.id, item.displayName || 'Agent', `${item.title || 'Poste'} - ${serviceName}`, [`${taskCount} taches`, `Manager: ${managerName}`, `${reports} rattaches`]);
      });
      refs.content.innerHTML = `<div class="workflow-grid">${cards.join('') || '<div class="workflow-empty">Aucun agent</div>'}</div>`;
    }
    function renderTasksView() {
      const maps = getMaps();
      const cards = applyFilters(state.collections.tasks, (item) => ({
        serviceId: item.serviceId,
        groupId: item.groupId,
        agentId: item.ownerAgentId
      }));
      const statusFilteredCards = filterTasksByStatus(cards).map((item) => {
        const owner = maps.agentById.get(item.ownerAgentId)?.displayName || 'Non assigne';
        const procedure = maps.procedureById.get(item.linkedProcedureId)?.title || 'Sans procedure';
        const prereqCount = Array.isArray(item.prerequisiteTaskIds) ? item.prerequisiteTaskIds.length : 0;
        const dependentCount = Array.isArray(item.dependentTaskIds) ? item.dependentTaskIds.length : 0;
        const checklist = normalizeChecklist(item);
        const doneCount = checklist.filter((entry) => entry.done).length;
        const bridgeCount = (item.linkedGlobalTaskIds || []).length + (item.linkedDocumentIds || []).length + (item.linkedThemeKeys || []).length + (item.linkedGroupKeys || []).length;
        const chips = [owner, procedure, item.status || 'todo', item.approvalStatus || 'pending', `${doneCount}/${checklist.length} checklist`, `${prereqCount} prerequis`, `${dependentCount} dependants`, `${bridgeCount} ponts`];
        return cardHtml(
          'task',
          item.id,
          item.title || 'Tache',
          item.description || '',
          chips,
          buildQuickCardActions('task', item.id, { status: item.status || 'todo' })
        );
      });
      refs.content.innerHTML = `<div class="workflow-grid">${statusFilteredCards.join('') || '<div class="workflow-empty">Aucune tache workflow</div>'}</div>`;
    }
    function renderProceduresView() {
      const filtered = state.collections.procedures.filter((item) => {
        const relatedTaskIds = new Set(item.linkedTaskIds || []);
        const relatedTasks = state.collections.tasks.filter((task) => task.linkedProcedureId === item.id || relatedTaskIds.has(task.id));
        if (relatedTasks.length === 0) return applyFilters([item], () => 'all').length > 0;
        return relatedTasks.some((task) => matchesFilterTriplet(task.serviceId, task.groupId, task.ownerAgentId) && matchesTaskStatus(task.status));
      });
      const cards = applyFilters(filtered, () => 'all').map((item) => {
        const steps = Array.isArray(item.steps) ? item.steps.length : 0;
        const bridgeCount = (item.linkedGlobalTaskIds || []).length + (item.linkedGlobalDocIds || []).length + (item.linkedThemeKeys || []).length + (item.linkedGroupKeys || []).length;
        return cardHtml(
          'procedure',
          item.id,
          item.title || 'Procedure',
          item.summary || '',
          [`${steps} etapes`, `v${item.version || 1}`, `${bridgeCount} ponts`],
          buildQuickCardActions('procedure', item.id)
        );
      });
      refs.content.innerHTML = `<div class="workflow-grid">${cards.join('') || '<div class="workflow-empty">Aucune procedure</div>'}</div>`;
    }

    function renderSoftwareView() {
      const filtered = state.collections.software.filter((item) => {
        const taskIds = new Set(item.linkedTaskIds || []);
        const tasks = state.collections.tasks.filter((task) => taskIds.has(task.id) || (Array.isArray(task.linkedSoftwareIds) && task.linkedSoftwareIds.includes(item.id)));
        if (tasks.length === 0) return applyFilters([item], () => 'all').length > 0;
        return tasks.some((task) => matchesFilterTriplet(task.serviceId, task.groupId, task.ownerAgentId) && matchesTaskStatus(task.status));
      });
      const cards = applyFilters(filtered, () => 'all').map((item) => {
        const links = Array.isArray(item.linkedTaskIds) ? item.linkedTaskIds.length : 0;
        return cardHtml(
          'software',
          item.id,
          item.name || 'Logiciel',
          item.description || '',
          [`${item.category || 'Categorie'}`, `${links} taches`],
          buildQuickCardActions('software', item.id)
        );
      });
      refs.content.innerHTML = `<div class="workflow-grid">${cards.join('') || '<div class="workflow-empty">Aucun logiciel metier</div>'}</div>`;
    }

    function renderKanbanView() {
      const lanes = [
        { key: 'todo', label: 'A faire' },
        { key: 'in_progress', label: 'En cours' },
        { key: 'blocked', label: 'Bloquees' },
        { key: 'ready_for_review', label: 'A valider' },
        { key: 'done', label: 'Terminees' },
        { key: 'approved', label: 'Approuvees' }
      ];
      const taskCardsByLane = new Map(lanes.map((lane) => [lane.key, []]));
      const tasks = filterTasksByStatus(applyFilters(state.collections.tasks, (item) => ({
        serviceId: item.serviceId,
        groupId: item.groupId,
        agentId: item.ownerAgentId
      })));
      tasks.forEach((task) => {
        const status = TASK_STATUS_OPTIONS.includes(String(task.status || '')) ? String(task.status) : 'todo';
        const lane = taskCardsByLane.get(status) ? status : 'todo';
        const checklist = normalizeChecklist(task);
        const doneCount = checklist.filter((entry) => entry.done).length;
        const draggable = canEditWorkflow() ? 'true' : 'false';
        taskCardsByLane.get(lane).push(`
          <article class="workflow-card workflow-kanban-task" draggable="${draggable}" data-wf-task-card="1" data-wf-task-id="${esc(task.id)}" data-wf-type="task" data-wf-id="${esc(task.id)}">
            <p class="workflow-card-title">${esc(task.title || 'Tache')}</p>
            ${task.description ? `<p class="workflow-card-sub">${esc(task.description)}</p>` : ''}
            <div class="workflow-chip-row">
              <span class="workflow-chip">${esc(`${doneCount}/${checklist.length} checklist`)}</span>
              <span class="workflow-chip">${esc(task.priority || 'medium')}</span>
            </div>
            ${buildQuickCardActions('task', task.id, { status })}
          </article>
        `);
      });

      refs.content.innerHTML = `
        <div class="workflow-map workflow-kanban">
          ${lanes.map((lane) => `
            <section class="workflow-map-col workflow-kanban-lane" data-wf-kanban-lane="${esc(lane.key)}">
              <h6>${esc(lane.label)}</h6>
              <div class="workflow-grid">${taskCardsByLane.get(lane.key).join('') || '<div class="workflow-empty">Aucune tache</div>'}</div>
            </section>
          `).join('')}
        </div>
      `;
    }

    function renderTimelineView() {
      const maps = getMaps();
      const tasks = filterTasksByStatus(applyFilters(state.collections.tasks, (item) => ({
        serviceId: item.serviceId,
        groupId: item.groupId,
        agentId: item.ownerAgentId
      })))
        .slice()
        .sort((a, b) => Number(a?.updatedAt || a?.createdAt || 0) - Number(b?.updatedAt || b?.createdAt || 0));

      refs.content.innerHTML = `
        <div class="workflow-timeline">
          ${tasks.map((task) => {
            const owner = maps.agentById.get(task.ownerAgentId)?.displayName || 'Non assigne';
            const service = maps.serviceById.get(task.serviceId)?.name || 'Sans service';
            const date = Number(task.updatedAt || task.createdAt || 0);
            const dateLabel = date ? new Date(date).toLocaleDateString() : '-';
            const checklist = normalizeChecklist(task);
            const doneCount = checklist.filter((entry) => entry.done).length;
            return `
              <article class="workflow-timeline-item workflow-card" data-wf-type="task" data-wf-id="${esc(task.id)}">
                <div class="workflow-timeline-dot" aria-hidden="true"></div>
                <p class="workflow-card-title">${esc(task.title || 'Tache')}</p>
                <p class="workflow-card-sub">${esc(`${dateLabel} - ${service}`)}</p>
                <div class="workflow-chip-row">
                  <span class="workflow-chip">${esc(taskStatusLabel(task.status))}</span>
                  <span class="workflow-chip">${esc(owner)}</span>
                  <span class="workflow-chip">${esc(`${doneCount}/${checklist.length} checklist`)}</span>
                </div>
                ${buildQuickCardActions('task', task.id, { status: task.status || 'todo' })}
              </article>
            `;
          }).join('') || '<div class="workflow-empty">Aucune tache a afficher</div>'}
        </div>
      `;
    }

    function renderJournalView() {
      const auditRows = (state.collections.audit || [])
        .slice()
        .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
      const q = normalize(state.query);
      const filtered = auditRows.filter((row) => {
        if (!q) return true;
        return normalize(JSON.stringify(row)).includes(q);
      });
      const cards = filtered.map((row) => {
        const when = Number(row?.createdAt || 0);
        const date = when ? new Date(when).toLocaleString() : '-';
        const payload = row?.payload ? JSON.stringify(row.payload) : '';
        const chips = (payload ? [payload] : []).map((chip) => `<span class="workflow-chip">${esc(chip)}</span>`).join('');
        return `
          <article class="workflow-card">
            <p class="workflow-card-title">${esc(`${row.action || 'event'} - ${row.entityType || 'workflow'}`)}</p>
            <p class="workflow-card-sub">${esc(`${date} - by ${row.byUserId || 'system'}`)}</p>
            ${chips ? `<div class="workflow-chip-row">${chips}</div>` : ''}
          </article>
        `;
      });
      refs.content.innerHTML = `<div class="workflow-grid">${cards.join('') || '<div class="workflow-empty">Aucun evenement journalise</div>'}</div>`;
    }

    function renderContent() {
      if (!refs.content) return;
      if (state.activeView === 'map') renderMapView();
      else if (state.activeView === 'organization') renderOrganizationView();
      else if (state.activeView === 'organigram') renderOrganigramView();
      else if (state.activeView === 'agents') renderAgentsView();
      else if (state.activeView === 'tasks') renderTasksView();
      else if (state.activeView === 'kanban') renderKanbanView();
      else if (state.activeView === 'timeline') renderTimelineView();
      else if (state.activeView === 'procedures') renderProceduresView();
      else if (state.activeView === 'software') renderSoftwareView();
      else if (state.activeView === 'journal') renderJournalView();
      else renderMapView();
      renderBreadcrumbs();
    }
    function getItem(type, id) {
      const list = getByType(type);
      return list.find((item) => String(item.id) === String(id)) || null;
    }

    function buildSelectOptions(list, idField, labelField, selected) {
      const safeSelected = String(selected || '');
      return ['<option value="">-</option>']
        .concat((list || []).map((row) => {
          const id = String(row[idField] || '');
          const label = String(row[labelField] || id || 'Element');
          return `<option value="${esc(id)}" ${id === safeSelected ? 'selected' : ''}>${esc(label)}</option>`;
        }))
        .join('');
    }

    function fieldHtml(label, key, value, kind) {
      if (kind === 'readonly') {
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><input id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-input" type="text" value="${esc(value)}" readonly>`;
      }
      if (kind === 'textarea') {
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><textarea id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-textarea">${esc(value)}</textarea>`;
      }
      if (kind === 'select-agent') {
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><select id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-select">${buildSelectOptions(state.collections.agents, 'id', 'displayName', value)}</select>`;
      }
      if (kind === 'select-service') {
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><select id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-select">${buildSelectOptions(state.collections.services, 'id', 'name', value)}</select>`;
      }
      if (kind === 'select-group') {
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><select id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-select">${buildSelectOptions(state.collections.groups, 'id', 'name', value)}</select>`;
      }
      if (kind === 'select-community') {
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><select id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-select">${buildSelectOptions(state.collections.communities, 'id', 'name', value)}</select>`;
      }
      if (kind === 'select-procedure') {
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><select id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-select">${buildSelectOptions(state.collections.procedures, 'id', 'title', value)}</select>`;
      }
      if (kind === 'select-task-status') {
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><select id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-select">${TASK_STATUS_OPTIONS.map((option) => `<option value="${esc(option)}" ${String(value || 'todo') === option ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select>`;
      }
      if (kind === 'select-approval-status') {
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><select id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-select">${TASK_APPROVAL_OPTIONS.map((option) => `<option value="${esc(option)}" ${String(value || 'pending') === option ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select>`;
      }
      return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><input id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-input" type="text" value="${esc(value)}">`;
    }

    function openDetail(type, id) {
      const item = getItem(type, id);
      if (!item || !refs.detail || !refs.detailBody || !refs.detailTitle) return;

      state.selectedType = type;
      state.selectedId = id;
      renderBreadcrumbs();
      openDetailModal();
      refs.detailTitle.textContent = `${ENTITY_META[type]?.label || 'Element'} - ${item.name || item.displayName || item.title || id}`;

      const fields = [];

      if (type === 'community') {
        fields.push(fieldHtml('Nom', 'name', item.name || '', 'text'));
        fields.push(fieldHtml('Description', 'description', item.description || '', 'textarea'));
        fields.push(fieldHtml('Couleur', 'color', item.color || '#1a428a', 'text'));
        fields.push(fieldHtml('Ordre', 'order', String(item.order || 1), 'text'));
      }
      if (type === 'service') {
        fields.push(fieldHtml('Nom', 'name', item.name || '', 'text'));
        fields.push(fieldHtml('Description', 'description', item.description || '', 'textarea'));
        fields.push(fieldHtml('Communaute', 'communityId', item.communityId || '', 'select-community'));
        fields.push(fieldHtml('Responsable', 'managerAgentId', item.managerAgentId || '', 'select-agent'));
        fields.push(fieldHtml('Tags (csv)', 'tags', toCsv(item.tags), 'text'));
        fields.push(fieldHtml('Services lies (csv ids)', 'relatedServiceIds', toCsv(item.relatedServiceIds), 'text'));
      }
      if (type === 'group') {
        fields.push(fieldHtml('Nom', 'name', item.name || '', 'text'));
        fields.push(fieldHtml('Description', 'description', item.description || '', 'textarea'));
        fields.push(fieldHtml('Service', 'serviceId', item.serviceId || '', 'select-service'));
        fields.push(fieldHtml('Type', 'type', item.type || 'metier', 'text'));
        fields.push(fieldHtml('Membres agentIds (csv)', 'memberAgentIds', toCsv(item.memberAgentIds), 'text'));
      }
      if (type === 'agent') {
        fields.push(fieldHtml('Nom affiche', 'displayName', item.displayName || '', 'text'));
        fields.push(fieldHtml('Handle', 'handle', item.handle || '', 'text'));
        fields.push(fieldHtml('Titre poste', 'title', item.title || '', 'text'));
        fields.push(fieldHtml('Service', 'serviceId', item.serviceId || '', 'select-service'));
        fields.push(fieldHtml('Groupes (csv agentIds)', 'groupIds', toCsv(item.groupIds), 'text'));
        fields.push(fieldHtml('Manager', 'managerAgentId', item.managerAgentId || '', 'select-agent'));
        fields.push(fieldHtml('Compte local (userId)', 'metadataUserId', String(item?.metadata?.userId || ''), 'text'));
        fields.push(fieldHtml('RBAC hints (csv)', 'rbacHints', toCsv(item.rbacHints), 'text'));
        fields.push(fieldHtml('Mission', 'mission', item.mission || '', 'textarea'));
        fields.push(fieldHtml('Competences (csv)', 'skills', toCsv(item.skills), 'text'));
        fields.push(fieldHtml('Outils (csv)', 'tools', toCsv(item.tools), 'text'));
      }
      if (type === 'task') {
        const checklist = normalizeChecklist(item);
        fields.push(fieldHtml('Titre', 'title', item.title || '', 'text'));
        fields.push(fieldHtml('Description', 'description', item.description || '', 'textarea'));
        fields.push(fieldHtml('Service', 'serviceId', item.serviceId || '', 'select-service'));
        fields.push(fieldHtml('Groupe', 'groupId', item.groupId || '', 'select-group'));
        fields.push(fieldHtml('Agent responsable', 'ownerAgentId', item.ownerAgentId || '', 'select-agent'));
        fields.push(fieldHtml('Statut', 'status', item.status || 'todo', 'select-task-status'));
        fields.push(fieldHtml('Priorite', 'priority', item.priority || 'medium', 'text'));
        fields.push(fieldHtml('Validation', 'approvalStatus', item.approvalStatus || 'pending', 'select-approval-status'));
        fields.push(fieldHtml('Checklist execution', 'checklist', checklistToText(checklist), 'textarea'));
        fields.push(fieldHtml('Procedure liee', 'linkedProcedureId', item.linkedProcedureId || '', 'select-procedure'));
        fields.push(fieldHtml('Logiciels lies (csv ids)', 'linkedSoftwareIds', toCsv(item.linkedSoftwareIds), 'text'));
        fields.push(fieldHtml('Prerequis (csv task ids)', 'prerequisiteTaskIds', toCsv(item.prerequisiteTaskIds), 'text'));
        fields.push(fieldHtml('Dependants (csv task ids)', 'dependentTaskIds', toCsv(item.dependentTaskIds), 'text'));
        fields.push(fieldHtml('Taches globales liees (csv ids)', 'linkedGlobalTaskIds', toCsv(item.linkedGlobalTaskIds), 'text'));
        fields.push(fieldHtml('Documents globaux lies (csv ids)', 'linkedDocumentIds', toCsv(item.linkedDocumentIds), 'text'));
        fields.push(fieldHtml('Themes referentiel (csv keys)', 'linkedThemeKeys', toCsv(item.linkedThemeKeys), 'text'));
        fields.push(fieldHtml('Groupes referentiel (csv keys)', 'linkedGroupKeys', toCsv(item.linkedGroupKeys), 'text'));
      }
      if (type === 'procedure') {
        fields.push(fieldHtml('Titre', 'title', item.title || '', 'text'));
        fields.push(fieldHtml('Resume', 'summary', item.summary || '', 'textarea'));
        fields.push(fieldHtml('Scope', 'scope', item.scope || '', 'text'));
        fields.push(fieldHtml('Declencheur', 'trigger', item.trigger || '', 'text'));
        fields.push(fieldHtml('Etapes (1 ligne = 1 etape)', 'steps', (item.steps || []).join('\n'), 'textarea'));
        fields.push(fieldHtml('Exceptions (1 ligne = 1 exception)', 'exceptions', (item.exceptions || []).join('\n'), 'textarea'));
        fields.push(fieldHtml('Risques (1 ligne = 1 risque)', 'risks', (item.risks || []).join('\n'), 'textarea'));
        fields.push(fieldHtml('Taches workflow liees (csv ids)', 'linkedTaskIds', toCsv(item.linkedTaskIds), 'text'));
        fields.push(fieldHtml('Logiciels lies (csv ids)', 'linkedSoftwareIds', toCsv(item.linkedSoftwareIds), 'text'));
        fields.push(fieldHtml('Taches globales liees (csv ids)', 'linkedGlobalTaskIds', toCsv(item.linkedGlobalTaskIds), 'text'));
        fields.push(fieldHtml('Documents globaux lies (csv ids)', 'linkedGlobalDocIds', toCsv(item.linkedGlobalDocIds), 'text'));
        fields.push(fieldHtml('Themes referentiel (csv keys)', 'linkedThemeKeys', toCsv(item.linkedThemeKeys), 'text'));
        fields.push(fieldHtml('Groupes referentiel (csv keys)', 'linkedGroupKeys', toCsv(item.linkedGroupKeys), 'text'));
        fields.push(fieldHtml('Pieces jointes (1 ligne = 1 reference)', 'attachments', (item.attachments || []).join('\n'), 'textarea'));
        fields.push(fieldHtml('Version', 'version', String(item.version || 1), 'readonly'));
      }
      if (type === 'software') {
        fields.push(fieldHtml('Nom', 'name', item.name || '', 'text'));
        fields.push(fieldHtml('Description', 'description', item.description || '', 'textarea'));
        fields.push(fieldHtml('Categorie', 'category', item.category || '', 'text'));
        fields.push(fieldHtml('Documentation (1 ligne = 1 URL)', 'documentationLinks', (item.documentationLinks || []).join('\n'), 'textarea'));
      }

      const editable = canEditWorkflow();
      let crossLinksHtml = '';
      if (type === 'task' || type === 'procedure') {
        const links = forwardWorkflowLinks(type, item);
        const globalTaskNames = links.globalTaskIds.map((id) => state.collections.globalTasks.find((row) => String(row.id) === id)?.title || id);
        const globalDocNames = links.globalDocIds.map((id) => state.collections.globalDocs.find((row) => String(row.id) === id)?.name || id);
        const themeNames = links.themeKeys.map((key) => state.collections.globalThemes.find((row) => String(row.themeKey) === key)?.name || key);
        const groupNames = links.groupKeys.map((key) => state.collections.globalGroups.find((row) => String(row.groupKey) === key)?.name || key);
        crossLinksHtml = `
          <div class="workflow-map-col">
            <h6>Ponts transverses</h6>
            <p class="workflow-card-sub">Taches globales: ${esc(globalTaskNames.join(', ') || '-')}</p>
            <p class="workflow-card-sub">Documents globaux: ${esc(globalDocNames.join(', ') || '-')}</p>
            <p class="workflow-card-sub">Themes referentiel: ${esc(themeNames.join(', ') || '-')}</p>
            <p class="workflow-card-sub">Groupes referentiel: ${esc(groupNames.join(', ') || '-')}</p>
          </div>
        `;
      }

      const wikiEditorHtml = type === 'procedure'
        ? `
        <div class="workflow-map-col">
          <h6>PAGE WIKI MODE OPERATOIRE</h6>
          <div class="project-editor-wrap border border-slate-300 rounded-xl bg-white overflow-hidden">
            <div class="project-editor-toolbar project-editor-toolbar-fallback">
              <button type="button" class="project-editor-btn" data-editor-target="wf-procedure-editor" data-editor-action="bold" title="Gras"><span class="material-symbols-outlined">format_bold</span></button>
              <button type="button" class="project-editor-btn" data-editor-target="wf-procedure-editor" data-editor-action="italic" title="Italique"><span class="material-symbols-outlined">format_italic</span></button>
              <button type="button" class="project-editor-btn project-editor-btn-text" data-editor-target="wf-procedure-editor" data-editor-action="h2" title="Titre 2">H2</button>
              <button type="button" class="project-editor-btn" data-editor-target="wf-procedure-editor" data-editor-action="ul" title="Liste"><span class="material-symbols-outlined">format_list_bulleted</span></button>
              <button type="button" id="btn-wf-wiki-insert-section" class="project-editor-btn project-editor-btn-text" title="Nouvelle section">Section</button>
              <button type="button" id="btn-wf-wiki-insert-link" class="project-editor-btn" title="Lien interne wiki"><span class="material-symbols-outlined">link</span></button>
              <button type="button" id="btn-wf-wiki-toggle-preview" class="project-editor-btn project-editor-btn-text" title="Apercu wiki">Apercu</button>
            </div>
            <div id="wf-procedure-editor" class="project-description-editor" ${editable ? '' : 'contenteditable="false"'}></div>
          </div>
          <div id="wf-procedure-wiki-toc" class="workflow-map-col" style="margin-top:0.6rem;">
            <h6>Sommaire</h6>
            <div class="workflow-card-sub">Aucun titre detecte</div>
          </div>
          <div id="wf-procedure-wiki-preview" class="workflow-map-col hidden" style="margin-top:0.6rem;">
            <h6>Apercu wiki</h6>
            <div id="wf-procedure-wiki-preview-body" class="workflow-card-sub"></div>
          </div>
          <div class="workflow-map-col" style="margin-top:0.6rem;">
            <h6>Aide syntaxe wiki</h6>
            <p class="workflow-card-sub"><code>[[Nom procedure]]</code> ouvre une procedure interne.</p>
            <p class="workflow-card-sub"><code>[[Nom procedure|Libelle affiche]]</code> cree un lien avec libelle personnalise.</p>
            <p class="workflow-card-sub">Utilise des titres <code>H2/H3</code> pour alimenter automatiquement le sommaire.</p>
          </div>
        </div>
      `
        : '';

      const historyRows = getEntityHistory(type, id, 6);
      const historyPanelHtml = global.TaskMDAWorkflowUI?.renderHistoryPanelHtml
        ? global.TaskMDAWorkflowUI.renderHistoryPanelHtml(historyRows, esc, { type, editable })
        : '';

      refs.detailBody.innerHTML = `
        ${fields.map((field) => `<div>${field}</div>`).join('')}
        ${crossLinksHtml}
        ${wikiEditorHtml}
        ${historyPanelHtml}
        ${editable && type === 'task' ? `
        <div class="workflow-detail-actions">
          <button id="btn-workflow-task-start" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold" type="button">Passer en cours</button>
          <button id="btn-workflow-task-complete-checklist" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold" type="button">Cocher checklist</button>
          <button id="btn-workflow-task-approve" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold" type="button">Valider</button>
        </div>
        ` : ''}
        ${editable ? `
        <div class="workflow-detail-actions">
          <button id="btn-workflow-delete" class="workflow-btn-danger" type="button">Supprimer</button>
          <button id="btn-workflow-save" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold" type="button">Enregistrer</button>
        </div>
        ` : '<p class="text-xs text-slate-500">Lecture seule: edition reservee au role admin ou manager workflow.</p>'}
      `;

      if (editable) {
        document.getElementById('btn-workflow-save')?.addEventListener('click', async () => {
          await saveCurrentDetail();
        });
        document.getElementById('btn-workflow-delete')?.addEventListener('click', async () => {
          await deleteCurrentDetail();
        });
        if (type === 'task') {
          document.getElementById('btn-workflow-task-start')?.addEventListener('click', async () => {
            await quickUpdateTaskState(id, { status: 'in_progress' }, 'task_started', 'Tache passee en cours');
          });
          document.getElementById('btn-workflow-task-complete-checklist')?.addEventListener('click', async () => {
            const current = getItem('task', id);
            const checklist = normalizeChecklist(current).map((entry) => ({ ...entry, done: true }));
            await quickUpdateTaskState(id, { checklist }, 'checklist_completed', 'Checklist marquee complete');
          });
          document.getElementById('btn-workflow-task-approve')?.addEventListener('click', async () => {
            await quickUpdateTaskState(id, {
              status: 'approved',
              approvalStatus: 'approved',
              approvedAt: now(),
              approvedByUserId: currentUserId()
            }, 'task_approved', 'Tache validee');
          });
        }
        refs.detailBody?.querySelectorAll('[data-wf-history-restore]')?.forEach((btn) => {
          btn.addEventListener('click', async () => {
            const historyId = String(btn.getAttribute('data-wf-history-restore') || '').trim();
            const historyType = String(btn.getAttribute('data-wf-history-type') || '').trim() || type;
            await restoreFromHistory(historyId, historyType);
          });
        });
        refs.detailBody?.querySelectorAll('[data-wf-history-restore-fields]')?.forEach((btn) => {
          btn.addEventListener('click', async () => {
            const historyId = String(btn.getAttribute('data-wf-history-restore-fields') || '').trim();
            const historyType = String(btn.getAttribute('data-wf-history-type') || '').trim() || type;
            const defaults = String(btn.getAttribute('data-wf-history-default-fields') || '').trim();
            const answer = window.prompt('Champs a restaurer (csv)', defaults);
            if (answer === null) return;
            await restoreFieldsFromHistory(historyId, historyType, answer);
          });
        });
        refs.detailBody?.querySelectorAll('[data-wf-history-diff-toggle]')?.forEach((btn) => {
          btn.addEventListener('click', () => {
            const historyId = String(btn.getAttribute('data-wf-history-diff-toggle') || '').trim();
            if (!historyId) return;
            const panel = refs.detailBody?.querySelector(`[data-wf-history-diff="${historyId}"]`);
            if (!panel) return;
            const isHidden = panel.classList.contains('hidden');
            panel.classList.toggle('hidden', !isHidden);
            btn.textContent = isHidden ? 'Masquer diff' : 'Voir diff';
          });
        });
      }

      if (type === 'procedure') {
        initProcedureRichEditor(item, editable);
      } else {
        state.procedureQuill = null;
      }

      renderContent();
    }

    function readFieldMap() {
      const map = {};
      refs.detailBody?.querySelectorAll('[data-wf-key]')?.forEach((node) => {
        map[String(node.getAttribute('data-wf-key') || '')] = node.value;
      });
      return map;
    }

    async function quickUpdateTaskState(taskId, partial, auditAction, notificationMessage) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: edition reservee au role admin ou manager workflow');
        return;
      }
      const current = getItem('task', taskId);
      if (!current) return;
      const next = {
        ...current,
        ...(partial || {}),
        updatedAt: now()
      };
      await api.put('workflowTasks', next, STORE_KEY_FIELDS.workflowTasks);
      await logHistory('update', 'task', next.id, current, next, String(auditAction || 'task_update'), Object.keys(partial || {}));
      await syncTaskDependencyGraph(next.id, next.prerequisiteTaskIds, next.dependentTaskIds);
      await logAudit(auditAction || 'task_update', 'task', next.id, { partial });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      openDetail('task', next.id);
      if (notificationMessage) notifyInternal(notificationMessage);
    }

    function initProcedureRichEditor(item, editable) {
      const host = document.getElementById('wf-procedure-editor');
      if (!host) return;
      const initialHtml = String(item?.wikiBodyHtml || item?.summary || '').trim() || '<p><br></p>';
      const renderPanels = () => {
        const html = state.procedureQuill
          ? String(state.procedureQuill.root?.innerHTML || '')
          : String(host.innerHTML || '');
        renderProcedureWikiPanels(html);
      };

      if (!editable) {
        host.innerHTML = initialHtml;
        renderProcedureWikiPanels(initialHtml);
        return;
      }

      const quillCtor = window.Quill;
      if (!quillCtor) {
        host.setAttribute('contenteditable', 'true');
        host.innerHTML = initialHtml;
        bindProcedureFallbackToolbar();
        bindProcedureWikiHelpers(host);
        host.addEventListener('input', renderPanels);
        renderPanels();
        state.procedureQuill = null;
        return;
      }

      host.removeAttribute('contenteditable');
      if (!quillCtor.imports?.['modules/imageResize'] && window.ImageResize) {
        quillCtor.register('modules/imageResize', window.ImageResize);
      }
      const quill = new quillCtor(host, {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ header: [2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'image', 'clean']
          ]
        }
      });
      quill.clipboard.dangerouslyPasteHTML(initialHtml);
      quill.on('text-change', () => renderPanels());
      state.procedureQuill = quill;
      bindProcedureFallbackToolbar();
      bindProcedureWikiHelpers(host);
      renderPanels();
    }

    function renderProcedureWikiPanels(rawHtml) {
      const toc = document.getElementById('wf-procedure-wiki-toc');
      const previewBody = document.getElementById('wf-procedure-wiki-preview-body');
      if (!toc && !previewBody) return;

      const html = String(rawHtml || '');
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const headings = Array.from(temp.querySelectorAll('h1, h2, h3'))
        .map((node) => String(node.textContent || '').trim())
        .filter(Boolean);

      if (toc) {
        toc.innerHTML = headings.length
          ? `<h6>Sommaire</h6><ul class="workflow-map-list">${headings.map((title) => `<li class="workflow-map-item">${esc(title)}</li>`).join('')}</ul>`
          : '<h6>Sommaire</h6><div class="workflow-card-sub">Aucun titre detecte</div>';
      }

      if (previewBody) {
        previewBody.innerHTML = wikifyProcedureHtml(html);
        previewBody.querySelectorAll('[data-wf-wiki-target]').forEach((link) => {
          link.addEventListener('click', (event) => {
            event.preventDefault();
            const target = String(link.getAttribute('data-wf-wiki-target') || '').trim();
            if (!target) return;
            const found = state.collections.procedures.find((row) => normalize(row?.title || '') === normalize(target));
            if (!found) {
              toast(`Procedure introuvable: ${target}`);
              return;
            }
            openDetail('procedure', found.id);
          });
        });
      }
    }

    function wikifyProcedureHtml(html) {
      return String(html || '')
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, target, label) => `<a href="#" data-wf-wiki-target="${esc(target)}">${esc(label)}</a>`)
        .replace(/\[\[([^\]]+)\]\]/g, (_, target) => `<a href="#" data-wf-wiki-target="${esc(target)}">${esc(target)}</a>`);
    }

    function bindProcedureWikiHelpers(host) {
      const sectionBtn = document.getElementById('btn-wf-wiki-insert-section');
      const linkBtn = document.getElementById('btn-wf-wiki-insert-link');
      const previewBtn = document.getElementById('btn-wf-wiki-toggle-preview');
      const previewWrap = document.getElementById('wf-procedure-wiki-preview');

      if (sectionBtn && sectionBtn.dataset.boundWorkflowWikiHelper !== '1') {
        sectionBtn.dataset.boundWorkflowWikiHelper = '1';
        sectionBtn.addEventListener('click', () => {
          if (state.procedureQuill) {
            const quill = state.procedureQuill;
            const selection = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
            quill.insertText(selection.index, '\nNouvelle section\n', 'user');
            quill.setSelection(selection.index + 1, 16, 'user');
            quill.format('header', 2);
            return;
          }
          host.focus();
          document.execCommand('insertHTML', false, '<h2>Nouvelle section</h2><p><br></p>');
        });
      }

      if (linkBtn && linkBtn.dataset.boundWorkflowWikiHelper !== '1') {
        linkBtn.dataset.boundWorkflowWikiHelper = '1';
        linkBtn.addEventListener('click', () => {
          const target = (window.prompt('Titre de la procedure cible (wiki interne)') || '').trim();
          if (!target) return;
          const label = (window.prompt('Texte du lien (laisser vide = titre cible)') || '').trim();
          const token = label ? `[[${target}|${label}]]` : `[[${target}]]`;
          if (state.procedureQuill) {
            const quill = state.procedureQuill;
            const selection = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
            quill.insertText(selection.index, token, 'user');
            quill.setSelection(selection.index + token.length, 0, 'user');
            return;
          }
          host.focus();
          document.execCommand('insertText', false, token);
        });
      }

      if (previewBtn && previewBtn.dataset.boundWorkflowWikiHelper !== '1') {
        previewBtn.dataset.boundWorkflowWikiHelper = '1';
        previewBtn.addEventListener('click', () => {
          if (!previewWrap) return;
          previewWrap.classList.toggle('hidden');
          const html = state.procedureQuill
            ? String(state.procedureQuill.root?.innerHTML || '')
            : String(host.innerHTML || '');
          renderProcedureWikiPanels(html);
        });
      }
    }

    function bindProcedureFallbackToolbar() {
      refs.detailBody?.querySelectorAll('.project-editor-btn[data-editor-target="wf-procedure-editor"][data-editor-action]')?.forEach((btn) => {
        if (btn.dataset.boundWorkflowProcedureEditor === '1') return;
        btn.dataset.boundWorkflowProcedureEditor = '1';
        btn.addEventListener('click', () => {
          const action = String(btn.getAttribute('data-editor-action') || '');
          if (state.procedureQuill) {
            const quill = state.procedureQuill;
            const selection = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
            const formats = quill.getFormat(selection.index, selection.length || 1);
            if (action === 'bold') quill.format('bold', !formats.bold);
            if (action === 'italic') quill.format('italic', !formats.italic);
            if (action === 'h2') quill.format('header', formats.header === 2 ? false : 2);
            if (action === 'ul') quill.format('list', formats.list === 'bullet' ? false : 'bullet');
            return;
          }
          const host = document.getElementById('wf-procedure-editor');
          if (!host) return;
          host.focus();
          if (action === 'bold') document.execCommand('bold', false, null);
          if (action === 'italic') document.execCommand('italic', false, null);
          if (action === 'h2') document.execCommand('formatBlock', false, 'H2');
          if (action === 'ul') document.execCommand('insertUnorderedList', false, null);
        });
      });
    }

    async function saveCurrentDetail() {
      if (!canEditWorkflow()) {
        toast('Lecture seule: edition reservee au role admin ou manager workflow');
        return;
      }
      if (!state.selectedType || !state.selectedId) return;
      const type = state.selectedType;
      const meta = ENTITY_META[type];
      if (!meta) return;
      const item = getItem(type, state.selectedId);
      if (!item) return;

      const fields = readFieldMap();
      const updated = { ...item, updatedAt: now() };
      let procedureVersionBumped = false;
      const queuedNotifications = [];

      if (type === 'community') {
        updated.name = String(fields.name || '').trim();
        updated.description = String(fields.description || '').trim();
        updated.color = String(fields.color || '#1a428a').trim();
        updated.order = Number(fields.order || 1) || 1;
      }
      if (type === 'service') {
        updated.name = String(fields.name || '').trim();
        updated.description = String(fields.description || '').trim();
        updated.communityId = String(fields.communityId || '').trim() || null;
        updated.managerAgentId = String(fields.managerAgentId || '').trim() || null;
        updated.tags = parseCsv(fields.tags);
        updated.relatedServiceIds = parseCsv(fields.relatedServiceIds).filter((id) => id !== updated.id);
      }
      if (type === 'group') {
        updated.name = String(fields.name || '').trim();
        updated.description = String(fields.description || '').trim();
        updated.serviceId = String(fields.serviceId || '').trim() || null;
        updated.type = String(fields.type || '').trim() || 'metier';
        updated.memberAgentIds = parseCsv(fields.memberAgentIds);
      }
      if (type === 'agent') {
        updated.displayName = String(fields.displayName || '').trim();
        updated.handle = String(fields.handle || '').trim();
        updated.title = String(fields.title || '').trim();
        updated.serviceId = String(fields.serviceId || '').trim() || null;
        updated.groupIds = parseCsv(fields.groupIds);
        updated.managerAgentId = String(fields.managerAgentId || '').trim() || null;
        updated.rbacHints = parseUniqueCsv(fields.rbacHints);
        updated.metadata = {
          ...(updated.metadata || {}),
          userId: String(fields.metadataUserId || '').trim()
        };
        updated.mission = String(fields.mission || '').trim();
        updated.skills = parseCsv(fields.skills);
        updated.tools = parseCsv(fields.tools);
      }
      if (type === 'task') {
        const previousStatus = String(item.status || 'todo');
        const previousApprovalStatus = String(item.approvalStatus || 'pending');
        updated.title = String(fields.title || '').trim();
        updated.description = String(fields.description || '').trim();
        updated.serviceId = String(fields.serviceId || '').trim() || null;
        updated.groupId = String(fields.groupId || '').trim() || null;
        updated.ownerAgentId = String(fields.ownerAgentId || '').trim() || null;
        const nextStatus = String(fields.status || '').trim() || 'todo';
        updated.status = TASK_STATUS_OPTIONS.includes(nextStatus) ? nextStatus : 'todo';
        updated.priority = String(fields.priority || '').trim() || 'medium';
        const nextApproval = String(fields.approvalStatus || '').trim() || 'pending';
        updated.approvalStatus = TASK_APPROVAL_OPTIONS.includes(nextApproval) ? nextApproval : 'pending';
        updated.checklist = parseChecklistText(fields.checklist);
        updated.linkedProcedureId = String(fields.linkedProcedureId || '').trim() || null;
        updated.linkedSoftwareIds = parseCsv(fields.linkedSoftwareIds);
        updated.prerequisiteTaskIds = parseCsv(fields.prerequisiteTaskIds).filter((id) => id !== updated.id);
        updated.dependentTaskIds = parseCsv(fields.dependentTaskIds).filter((id) => id !== updated.id);
        updated.linkedGlobalTaskIds = parseUniqueCsv(fields.linkedGlobalTaskIds);
        updated.linkedDocumentIds = parseUniqueCsv(fields.linkedDocumentIds);
        updated.linkedThemeKeys = parseUniqueCsv(fields.linkedThemeKeys);
        updated.linkedGroupKeys = parseUniqueCsv(fields.linkedGroupKeys);
        if (updated.approvalStatus === 'approved' && previousApprovalStatus !== 'approved') {
          updated.approvedAt = now();
          updated.approvedByUserId = currentUserId();
          updated.status = 'approved';
        }
        if (updated.approvalStatus !== 'approved') {
          updated.approvedAt = null;
          updated.approvedByUserId = null;
        }
        if (updated.status !== previousStatus) {
          queuedNotifications.push(`Statut tache: ${updated.title || updated.id} -> ${updated.status}`);
        }
        if (updated.approvalStatus !== previousApprovalStatus) {
          queuedNotifications.push(`Validation tache: ${updated.title || updated.id} -> ${updated.approvalStatus}`);
        }
      }
      if (type === 'procedure') {
        const previousSnapshot = JSON.stringify({
          title: item.title || '',
          summary: item.summary || '',
          scope: item.scope || '',
          trigger: item.trigger || '',
          steps: item.steps || [],
          risks: item.risks || [],
          linkedSoftwareIds: item.linkedSoftwareIds || []
        });
        updated.title = String(fields.title || '').trim();
        updated.summary = String(fields.summary || '').trim();
        updated.scope = String(fields.scope || '').trim();
        updated.trigger = String(fields.trigger || '').trim();
        updated.steps = parseMultiline(fields.steps);
        updated.exceptions = parseMultiline(fields.exceptions);
        updated.risks = parseMultiline(fields.risks);
        updated.linkedTaskIds = parseUniqueCsv(fields.linkedTaskIds);
        updated.linkedSoftwareIds = parseCsv(fields.linkedSoftwareIds);
        updated.linkedGlobalTaskIds = parseUniqueCsv(fields.linkedGlobalTaskIds);
        updated.linkedGlobalDocIds = parseUniqueCsv(fields.linkedGlobalDocIds);
        updated.linkedThemeKeys = parseUniqueCsv(fields.linkedThemeKeys);
        updated.linkedGroupKeys = parseUniqueCsv(fields.linkedGroupKeys);
        updated.attachments = parseMultiline(fields.attachments);
        updated.wikiBodyHtml = state.procedureQuill
          ? String(state.procedureQuill.root?.innerHTML || '').trim()
          : String(document.getElementById('wf-procedure-editor')?.innerHTML || '').trim();
        const nextSnapshot = JSON.stringify({
          title: updated.title,
          summary: updated.summary,
          scope: updated.scope,
          trigger: updated.trigger,
          steps: updated.steps,
          exceptions: updated.exceptions,
          risks: updated.risks,
          linkedTaskIds: updated.linkedTaskIds,
          linkedSoftwareIds: updated.linkedSoftwareIds
        });
        const hasChange = previousSnapshot !== nextSnapshot;
        const nextVersion = hasChange ? (Number(item.version || 1) + 1) : Number(item.version || 1);
        const history = Array.isArray(item?.metadata?.versionHistory) ? item.metadata.versionHistory.slice(-20) : [];
        if (hasChange) {
          history.push({
            version: nextVersion,
            updatedAt: updated.updatedAt,
            byUserId: currentUserId()
          });
        }
        procedureVersionBumped = hasChange;
        updated.version = nextVersion;
        updated.metadata = {
          ...(updated.metadata || {}),
          versionHistory: history
        };
      }
      if (type === 'software') {
        updated.name = String(fields.name || '').trim();
        updated.description = String(fields.description || '').trim();
        updated.category = String(fields.category || '').trim();
        updated.documentationLinks = parseMultiline(fields.documentationLinks);
      }

      await api.put(meta.store, updated, STORE_KEY_FIELDS[meta.store]);
      await logHistory('update', type, updated.id, item, updated, 'detail_save', Object.keys(fields));
      if (type === 'task') {
        await syncTaskDependencyGraph(updated.id, updated.prerequisiteTaskIds, updated.dependentTaskIds);
      }
      if (type === 'task' || type === 'procedure') {
        await syncBidirectionalExternalLinks();
      }
      await logAudit('update', type, updated.id, { fields: Object.keys(fields) });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      openDetail(type, updated.id);
      toast('Workflow mis a jour');
      if (type === 'procedure' && procedureVersionBumped) {
        queuedNotifications.push(`Procedure versionnee: ${updated.title || updated.id} v${updated.version}`);
      }
      queuedNotifications.forEach((message) => notifyInternal(message));
    }

    async function syncTaskDependencyGraph(taskId, prerequisiteTaskIds, dependentTaskIds) {
      const safeTaskId = String(taskId || '').trim();
      if (!safeTaskId) return;
      const prerequisites = Array.from(new Set((prerequisiteTaskIds || []).map((id) => String(id || '').trim()).filter(Boolean).filter((id) => id !== safeTaskId)));
      const dependents = Array.from(new Set((dependentTaskIds || []).map((id) => String(id || '').trim()).filter(Boolean).filter((id) => id !== safeTaskId)));
      const updates = [];
      state.collections.tasks.forEach((task) => {
        if (!task || String(task.id || '') === safeTaskId) return;
        const currentPrereq = Array.isArray(task.prerequisiteTaskIds) ? task.prerequisiteTaskIds.slice() : [];
        const currentDepend = Array.isArray(task.dependentTaskIds) ? task.dependentTaskIds.slice() : [];

        let nextPrereq = currentPrereq.filter((id) => String(id || '') !== safeTaskId);
        let nextDepend = currentDepend.filter((id) => String(id || '') !== safeTaskId);

        if (dependents.includes(String(task.id))) {
          if (!nextPrereq.includes(safeTaskId)) nextPrereq.push(safeTaskId);
        }
        if (prerequisites.includes(String(task.id))) {
          if (!nextDepend.includes(safeTaskId)) nextDepend.push(safeTaskId);
        }

        const hasChanged = JSON.stringify(nextPrereq) !== JSON.stringify(currentPrereq)
          || JSON.stringify(nextDepend) !== JSON.stringify(currentDepend);
        if (!hasChanged) return;
        updates.push(api.put('workflowTasks', {
          ...task,
          prerequisiteTaskIds: nextPrereq,
          dependentTaskIds: nextDepend,
          updatedAt: now()
        }, STORE_KEY_FIELDS.workflowTasks));
      });
      await Promise.all(updates);
    }

    async function applyDetachOnDelete(type, id) {
      const updates = [];

      if (type === 'service') {
        state.collections.services.forEach((service) => {
          if (Array.isArray(service.relatedServiceIds) && service.relatedServiceIds.includes(id)) {
            updates.push(api.put('workflowServices', { ...service, relatedServiceIds: service.relatedServiceIds.filter((sid) => sid !== id), updatedAt: now() }, STORE_KEY_FIELDS.workflowServices));
          }
        });
        state.collections.groups.forEach((group) => {
          if (group.serviceId === id) {
            updates.push(api.put('workflowGroups', { ...group, serviceId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowGroups));
          }
        });
        state.collections.agents.forEach((agent) => {
          if (agent.serviceId === id) {
            updates.push(api.put('workflowAgents', { ...agent, serviceId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowAgents));
          }
        });
        state.collections.tasks.forEach((task) => {
          if (task.serviceId === id) {
            updates.push(api.put('workflowTasks', { ...task, serviceId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowTasks));
          }
        });
      }

      if (type === 'group') {
        state.collections.agents.forEach((agent) => {
          if (Array.isArray(agent.groupIds) && agent.groupIds.includes(id)) {
            updates.push(api.put('workflowAgents', { ...agent, groupIds: agent.groupIds.filter((gid) => gid !== id), updatedAt: now() }, STORE_KEY_FIELDS.workflowAgents));
          }
        });
        state.collections.tasks.forEach((task) => {
          if (task.groupId === id) {
            updates.push(api.put('workflowTasks', { ...task, groupId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowTasks));
          }
        });
      }

      if (type === 'agent') {
        state.collections.services.forEach((service) => {
          if (service.managerAgentId === id) {
            updates.push(api.put('workflowServices', { ...service, managerAgentId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowServices));
          }
        });
        state.collections.agents.forEach((agent) => {
          if (agent.managerAgentId === id) {
            updates.push(api.put('workflowAgents', { ...agent, managerAgentId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowAgents));
          }
        });
        state.collections.tasks.forEach((task) => {
          if (task.ownerAgentId === id) {
            updates.push(api.put('workflowTasks', { ...task, ownerAgentId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowTasks));
          }
        });
      }

      if (type === 'procedure') {
        state.collections.tasks.forEach((task) => {
          if (task.linkedProcedureId === id) {
            updates.push(api.put('workflowTasks', { ...task, linkedProcedureId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowTasks));
          }
        });
      }

      if (type === 'software') {
        state.collections.tasks.forEach((task) => {
          if (Array.isArray(task.linkedSoftwareIds) && task.linkedSoftwareIds.includes(id)) {
            updates.push(api.put('workflowTasks', { ...task, linkedSoftwareIds: task.linkedSoftwareIds.filter((sid) => sid !== id), updatedAt: now() }, STORE_KEY_FIELDS.workflowTasks));
          }
        });
        state.collections.procedures.forEach((procedure) => {
          if (Array.isArray(procedure.linkedSoftwareIds) && procedure.linkedSoftwareIds.includes(id)) {
            updates.push(api.put('workflowProcedures', { ...procedure, linkedSoftwareIds: procedure.linkedSoftwareIds.filter((sid) => sid !== id), updatedAt: now() }, STORE_KEY_FIELDS.workflowProcedures));
          }
        });
      }

      if (type === 'task') {
        await syncTaskDependencyGraph(id, [], []);
      }

      await Promise.all(updates);
    }

    async function deleteCurrentDetail() {
      if (!canEditWorkflow()) {
        toast('Lecture seule: edition reservee au role admin ou manager workflow');
        return;
      }
      if (!state.selectedType || !state.selectedId) return;
      const type = state.selectedType;
      const id = state.selectedId;
      const meta = ENTITY_META[type];
      if (!meta) return;
      const beforeDelete = getItem(type, id);

      await applyDetachOnDelete(type, id);
      await api.remove(meta.store, id);
      await logHistory('delete', type, id, beforeDelete || null, null, 'detail_delete', Object.keys(beforeDelete || {}));
      if (type === 'task' || type === 'procedure') {
        await syncBidirectionalExternalLinks();
      }
      await logAudit('delete', type, id, null);

      state.selectedType = null;
      state.selectedId = null;
      refs.detail?.classList.add('hidden');
      if (refs.detailBody) refs.detailBody.innerHTML = '';
      refs.detailModal?.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
      await loadCollections();
      renderServiceFilter();
      renderContent();
      toast('Element workflow supprime');
      notifyInternal(`Suppression workflow: ${type} ${id}`);
    }

    async function deleteEntityQuick(type, id) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: edition reservee au role admin ou manager workflow');
        return;
      }
      const safeType = String(type || '').trim();
      const safeId = String(id || '').trim();
      if (!safeType || !safeId) return;
      const meta = ENTITY_META[safeType];
      if (!meta) return;
      const current = getItem(safeType, safeId);
      if (!current) return;
      const label = current.name || current.displayName || current.title || current.id || safeId;
      if (!global.confirm(`Supprimer ${safeType} "${label}" ?`)) return;

      await applyDetachOnDelete(safeType, safeId);
      await api.remove(meta.store, safeId);
      await logHistory('delete', safeType, safeId, current || null, null, 'quick_delete', Object.keys(current || {}));
      if (safeType === 'task' || safeType === 'procedure') {
        await syncBidirectionalExternalLinks();
      }
      await logAudit('delete', safeType, safeId, { source: 'quick_card_action' });

      if (state.selectedType === safeType && String(state.selectedId || '') === safeId) {
        state.selectedType = null;
        state.selectedId = null;
        refs.detail?.classList.add('hidden');
        if (refs.detailBody) refs.detailBody.innerHTML = '';
        refs.detailModal?.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
      }

      await loadCollections();
      renderServiceFilter();
      renderContent();
      toast('Element workflow supprime');
      notifyInternal(`Suppression workflow: ${safeType} ${safeId}`);
    }

    let workflowCreateKind = '';

    function openCreateModal(kind) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: creation reservee au role admin ou manager workflow');
        return;
      }
      if (!refs.modal || !refs.modalBody || !refs.modalTitle || !refs.modalSave) return;
      workflowCreateKind = kind;
      refs.modal.classList.remove('hidden');

      if (kind === 'community') {
        refs.modalTitle.textContent = 'Nouvelle communaute workflow';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Nom</label><input id="wf-create-community-name" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Description</label><textarea id="wf-create-community-description" class="workflow-form-textarea"></textarea></div>
          <div><label class="workflow-form-label">Couleur</label><input id="wf-create-community-color" class="workflow-form-input" type="text" value="#1a428a"></div>
          <div><label class="workflow-form-label">Icone</label><input id="wf-create-community-icon" class="workflow-form-input" type="text" value="schema"></div>
        `;
      }

      if (kind === 'service') {
        refs.modalTitle.textContent = 'Nouveau service workflow';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Nom</label><input id="wf-create-service-name" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Description</label><textarea id="wf-create-service-description" class="workflow-form-textarea"></textarea></div>
          <div><label class="workflow-form-label">Communaute</label><select id="wf-create-service-community" class="workflow-form-select">${buildSelectOptions(state.collections.communities, 'id', 'name', '')}</select></div>
          <div><label class="workflow-form-label">Responsable</label><select id="wf-create-service-manager" class="workflow-form-select">${buildSelectOptions(state.collections.agents, 'id', 'displayName', '')}</select></div>
          <div><label class="workflow-form-label">Tags (csv)</label><input id="wf-create-service-tags" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Services lies (csv ids)</label><input id="wf-create-service-related" class="workflow-form-input" type="text"></div>
        `;
      }

      if (kind === 'group') {
        refs.modalTitle.textContent = 'Nouveau groupe workflow';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Nom</label><input id="wf-create-group-name" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Description</label><textarea id="wf-create-group-description" class="workflow-form-textarea"></textarea></div>
          <div><label class="workflow-form-label">Service</label><select id="wf-create-group-service" class="workflow-form-select">${buildSelectOptions(state.collections.services, 'id', 'name', state.serviceFilter !== 'all' ? state.serviceFilter : '')}</select></div>
          <div><label class="workflow-form-label">Type</label><input id="wf-create-group-type" class="workflow-form-input" type="text" value="metier"></div>
          <div><label class="workflow-form-label">Membres agentIds (csv)</label><input id="wf-create-group-members" class="workflow-form-input" type="text"></div>
        `;
      }

      if (kind === 'agent') {
        refs.modalTitle.textContent = 'Nouvel agent workflow';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Nom affiche</label><input id="wf-create-agent-name" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Titre / poste</label><input id="wf-create-agent-title" class="workflow-form-input" type="text" value="Agent"></div>
          <div><label class="workflow-form-label">Service</label><select id="wf-create-agent-service" class="workflow-form-select">${buildSelectOptions(state.collections.services, 'id', 'name', state.serviceFilter !== 'all' ? state.serviceFilter : '')}</select></div>
        `;
      }

      if (kind === 'task') {
        refs.modalTitle.textContent = 'Nouvelle tache workflow';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Titre</label><input id="wf-create-task-title" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Description</label><textarea id="wf-create-task-description" class="workflow-form-textarea"></textarea></div>
          <div><label class="workflow-form-label">Service</label><select id="wf-create-task-service" class="workflow-form-select">${buildSelectOptions(state.collections.services, 'id', 'name', state.serviceFilter !== 'all' ? state.serviceFilter : '')}</select></div>
          <div><label class="workflow-form-label">Agent responsable</label><select id="wf-create-task-owner" class="workflow-form-select">${buildSelectOptions(state.collections.agents, 'id', 'displayName', '')}</select></div>
          <div><label class="workflow-form-label">Priorite</label><select id="wf-create-task-priority" class="workflow-form-select"><option value="low">Basse</option><option value="medium" selected>Moyenne</option><option value="high">Haute</option></select></div>
          <div><label class="workflow-form-label">Statut</label><select id="wf-create-task-status" class="workflow-form-select">${TASK_STATUS_OPTIONS.map((status) => `<option value="${esc(status)}" ${status === 'todo' ? 'selected' : ''}>${esc(status)}</option>`).join('')}</select></div>
          <div><label class="workflow-form-label">Validation</label><select id="wf-create-task-approval" class="workflow-form-select">${TASK_APPROVAL_OPTIONS.map((status) => `<option value="${esc(status)}" ${status === 'pending' ? 'selected' : ''}>${esc(status)}</option>`).join('')}</select></div>
          <div><label class="workflow-form-label">Checklist execution (1 ligne, prefixe [x] optionnel)</label><textarea id="wf-create-task-checklist" class="workflow-form-textarea"></textarea></div>
          <div><label class="workflow-form-label">Prerequis (csv task ids)</label><input id="wf-create-task-prereq" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Dependants (csv task ids)</label><input id="wf-create-task-dependent" class="workflow-form-input" type="text"></div>
        `;
      }

      if (kind === 'procedure') {
        refs.modalTitle.textContent = 'Nouvelle procedure workflow';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Titre</label><input id="wf-create-procedure-title" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Resume</label><textarea id="wf-create-procedure-summary" class="workflow-form-textarea"></textarea></div>
          <div><label class="workflow-form-label">Scope</label><input id="wf-create-procedure-scope" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Declencheur</label><input id="wf-create-procedure-trigger" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Etapes (une ligne = une etape)</label><textarea id="wf-create-procedure-steps" class="workflow-form-textarea"></textarea></div>
          <div><label class="workflow-form-label">Exceptions (une ligne = une exception)</label><textarea id="wf-create-procedure-exceptions" class="workflow-form-textarea"></textarea></div>
          <div><label class="workflow-form-label">Risques (une ligne = un risque)</label><textarea id="wf-create-procedure-risks" class="workflow-form-textarea"></textarea></div>
          <div><label class="workflow-form-label">Taches workflow liees (csv ids)</label><input id="wf-create-procedure-linked-tasks" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Logiciels lies (csv ids)</label><input id="wf-create-procedure-linked-software" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Pieces jointes (une ligne = une reference)</label><textarea id="wf-create-procedure-attachments" class="workflow-form-textarea"></textarea></div>
        `;
      }

      if (kind === 'software') {
        refs.modalTitle.textContent = 'Nouveau logiciel metier workflow';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Nom</label><input id="wf-create-software-name" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Description</label><textarea id="wf-create-software-description" class="workflow-form-textarea"></textarea></div>
          <div><label class="workflow-form-label">Categorie</label><input id="wf-create-software-category" class="workflow-form-input" type="text" value="metier"></div>
          <div><label class="workflow-form-label">Documentation (1 ligne = 1 URL)</label><textarea id="wf-create-software-docs" class="workflow-form-textarea"></textarea></div>
        `;
      }
    }

    function closeCreateModal() {
      workflowCreateKind = '';
      if (refs.modal) refs.modal.classList.add('hidden');
      if (refs.modalBody) refs.modalBody.innerHTML = '';
    }

    async function submitCreateModal() {
      if (!canEditWorkflow()) {
        toast('Lecture seule: creation reservee au role admin ou manager workflow');
        return;
      }
      if (workflowCreateKind === 'community') {
        const name = String(document.getElementById('wf-create-community-name')?.value || '').trim();
        if (!name) {
          toast('Nom communaute requis');
          return;
        }
        const maxOrder = state.collections.communities.reduce((acc, item) => {
          const current = Number(item?.order || 0);
          return current > acc ? current : acc;
        }, 0);
        const row = {
          id: `wf-community-${uid()}`,
          name,
          description: String(document.getElementById('wf-create-community-description')?.value || '').trim(),
          color: String(document.getElementById('wf-create-community-color')?.value || '#1a428a').trim() || '#1a428a',
          icon: String(document.getElementById('wf-create-community-icon')?.value || 'schema').trim() || 'schema',
          order: maxOrder + 1,
          metadata: {},
          createdAt: now(),
          updatedAt: now()
        };
        await api.put('workflowCommunities', row, STORE_KEY_FIELDS.workflowCommunities);
        await logAudit('create', 'community', row.id, { name: row.name });
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail('community', row.id);
        closeCreateModal();
        toast('Communaute workflow ajoutee');
        return;
      }

      if (workflowCreateKind === 'service') {
        const name = String(document.getElementById('wf-create-service-name')?.value || '').trim();
        if (!name) {
          toast('Nom service requis');
          return;
        }
        const row = {
          id: `wf-service-${uid()}`,
          communityId: String(document.getElementById('wf-create-service-community')?.value || '').trim() || null,
          name,
          description: String(document.getElementById('wf-create-service-description')?.value || '').trim(),
          managerAgentId: String(document.getElementById('wf-create-service-manager')?.value || '').trim() || null,
          tags: parseCsv(document.getElementById('wf-create-service-tags')?.value || ''),
          relatedServiceIds: parseCsv(document.getElementById('wf-create-service-related')?.value || ''),
          metadata: {},
          createdAt: now(),
          updatedAt: now()
        };
        row.relatedServiceIds = row.relatedServiceIds.filter((id) => id !== row.id);
        await api.put('workflowServices', row, STORE_KEY_FIELDS.workflowServices);
        await logAudit('create', 'service', row.id, { name: row.name });
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail('service', row.id);
        closeCreateModal();
        toast('Service workflow ajoute');
        return;
      }

      if (workflowCreateKind === 'group') {
        const name = String(document.getElementById('wf-create-group-name')?.value || '').trim();
        if (!name) {
          toast('Nom groupe requis');
          return;
        }
        const row = {
          id: `wf-group-${uid()}`,
          serviceId: String(document.getElementById('wf-create-group-service')?.value || '').trim() || null,
          name,
          description: String(document.getElementById('wf-create-group-description')?.value || '').trim(),
          type: String(document.getElementById('wf-create-group-type')?.value || 'metier').trim() || 'metier',
          memberAgentIds: parseCsv(document.getElementById('wf-create-group-members')?.value || ''),
          metadata: {},
          createdAt: now(),
          updatedAt: now()
        };
        await api.put('workflowGroups', row, STORE_KEY_FIELDS.workflowGroups);
        await logAudit('create', 'group', row.id, { name: row.name });
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail('group', row.id);
        closeCreateModal();
        toast('Groupe workflow ajoute');
        return;
      }

      if (workflowCreateKind === 'agent') {
        const name = String(document.getElementById('wf-create-agent-name')?.value || '').trim();
        if (!name) {
          toast('Nom agent requis');
          return;
        }
        const title = String(document.getElementById('wf-create-agent-title')?.value || 'Agent').trim() || 'Agent';
        const serviceId = String(document.getElementById('wf-create-agent-service')?.value || '').trim() || null;
        const row = {
          id: `wf-agent-${uid()}`,
          displayName: name,
          handle: normalize(name).replace(/\s+/g, '.').slice(0, 32),
          title,
          serviceId,
          groupIds: [],
          managerAgentId: null,
          mission: '',
          responsibilities: [],
          skills: [],
          tools: [],
          rbacHints: [],
          metadata: {},
          createdAt: now(),
          updatedAt: now()
        };
        await api.put('workflowAgents', row, STORE_KEY_FIELDS.workflowAgents);
        await logAudit('create', 'agent', row.id, { displayName: row.displayName });
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail('agent', row.id);
        closeCreateModal();
        toast('Agent workflow ajoute');
        return;
      }

      if (workflowCreateKind === 'task') {
        const title = String(document.getElementById('wf-create-task-title')?.value || '').trim();
        if (!title) {
          toast('Titre tache requis');
          return;
        }
        const serviceId = String(document.getElementById('wf-create-task-service')?.value || '').trim() || null;
        const row = {
          id: `wf-task-${uid()}`,
          title,
          description: String(document.getElementById('wf-create-task-description')?.value || '').trim(),
          ownerAgentId: String(document.getElementById('wf-create-task-owner')?.value || '').trim() || null,
          serviceId,
          groupId: null,
          taskType: 'workflow',
          frequency: 'ponctuelle',
          priority: String(document.getElementById('wf-create-task-priority')?.value || 'medium').trim() || 'medium',
          criticality: 'medium',
          estimatedDuration: null,
          prerequisiteTaskIds: parseCsv(document.getElementById('wf-create-task-prereq')?.value || ''),
          dependentTaskIds: parseCsv(document.getElementById('wf-create-task-dependent')?.value || ''),
          linkedProcedureId: null,
          linkedSoftwareIds: [],
          linkedDocumentIds: [],
          linkedGlobalTaskIds: [],
          linkedThemeKeys: [],
          linkedGroupKeys: [],
          checklist: parseChecklistText(document.getElementById('wf-create-task-checklist')?.value || ''),
          status: String(document.getElementById('wf-create-task-status')?.value || 'todo').trim() || 'todo',
          approvalStatus: String(document.getElementById('wf-create-task-approval')?.value || 'pending').trim() || 'pending',
          approvedAt: null,
          approvedByUserId: null,
          metadata: {},
          createdAt: now(),
          updatedAt: now()
        };
        row.prerequisiteTaskIds = row.prerequisiteTaskIds.filter((id) => id !== row.id);
        row.dependentTaskIds = row.dependentTaskIds.filter((id) => id !== row.id);
        if (!TASK_STATUS_OPTIONS.includes(row.status)) row.status = 'todo';
        if (!TASK_APPROVAL_OPTIONS.includes(row.approvalStatus)) row.approvalStatus = 'pending';
        if (row.approvalStatus === 'approved') {
          row.approvedAt = now();
          row.approvedByUserId = currentUserId();
          row.status = 'approved';
        }
        await api.put('workflowTasks', row, STORE_KEY_FIELDS.workflowTasks);
        await syncTaskDependencyGraph(row.id, row.prerequisiteTaskIds, row.dependentTaskIds);
        await syncBidirectionalExternalLinks();
        await logAudit('create', 'task', row.id, { title: row.title });
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail('task', row.id);
        closeCreateModal();
        toast('Tache workflow ajoutee');
        return;
      }

      if (workflowCreateKind === 'procedure') {
        const title = String(document.getElementById('wf-create-procedure-title')?.value || '').trim();
        if (!title) {
          toast('Titre procedure requis');
          return;
        }
        const row = {
          id: `wf-procedure-${uid()}`,
          title,
          summary: String(document.getElementById('wf-create-procedure-summary')?.value || '').trim(),
          scope: String(document.getElementById('wf-create-procedure-scope')?.value || '').trim(),
          trigger: String(document.getElementById('wf-create-procedure-trigger')?.value || '').trim(),
          steps: parseMultiline(document.getElementById('wf-create-procedure-steps')?.value || ''),
          exceptions: parseMultiline(document.getElementById('wf-create-procedure-exceptions')?.value || ''),
          risks: parseMultiline(document.getElementById('wf-create-procedure-risks')?.value || ''),
          linkedSoftwareIds: parseUniqueCsv(document.getElementById('wf-create-procedure-linked-software')?.value || ''),
          linkedTaskIds: parseUniqueCsv(document.getElementById('wf-create-procedure-linked-tasks')?.value || ''),
          linkedGlobalTaskIds: [],
          linkedGlobalDocIds: [],
          linkedThemeKeys: [],
          linkedGroupKeys: [],
          attachments: parseMultiline(document.getElementById('wf-create-procedure-attachments')?.value || ''),
          wikiBodyHtml: String(document.getElementById('wf-create-procedure-summary')?.value || '').trim(),
          version: 1,
          updatedAt: now(),
          metadata: {},
          createdAt: now()
        };
        await api.put('workflowProcedures', row, STORE_KEY_FIELDS.workflowProcedures);
        await syncBidirectionalExternalLinks();
        await logAudit('create', 'procedure', row.id, { title: row.title });
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail('procedure', row.id);
        closeCreateModal();
        toast('Procedure workflow ajoutee');
        return;
      }

      if (workflowCreateKind === 'software') {
        const name = String(document.getElementById('wf-create-software-name')?.value || '').trim();
        if (!name) {
          toast('Nom logiciel requis');
          return;
        }
        const row = {
          id: `wf-software-${uid()}`,
          name,
          description: String(document.getElementById('wf-create-software-description')?.value || '').trim(),
          category: String(document.getElementById('wf-create-software-category')?.value || 'metier').trim() || 'metier',
          linkedTaskIds: [],
          linkedProcedureIds: [],
          documentationLinks: parseMultiline(document.getElementById('wf-create-software-docs')?.value || ''),
          metadata: {},
          createdAt: now(),
          updatedAt: now()
        };
        await api.put('workflowSoftware', row, STORE_KEY_FIELDS.workflowSoftware);
        await logAudit('create', 'software', row.id, { name: row.name });
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail('software', row.id);
        closeCreateModal();
        toast('Logiciel workflow ajoute');
      }
    }
    function bindEvents() {
      if (state.bound) return;
      state.bound = true;

      refs.quickAddToggle?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        refs.quickAddMenu?.classList.toggle('hidden');
      });

      refs.quickAddMenu?.addEventListener('click', (event) => {
        const item = event.target.closest('.workflow-quick-add-item');
        if (!item) return;
        refs.quickAddMenu?.classList.add('hidden');
      });

      refs.filtersToggle?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        refs.filtersPanel?.classList.toggle('hidden');
      });

      document.addEventListener('click', (event) => {
        const inQuickAdd = event.target.closest('.workflow-quick-add');
        if (!inQuickAdd) refs.quickAddMenu?.classList.add('hidden');
        const inFilters = event.target.closest('#workflow-filters-panel, #workflow-filters-toggle');
        if (!inFilters) refs.filtersPanel?.classList.add('hidden');
      });

      Object.entries(viewIds).forEach(([key, id]) => {
        document.getElementById(id)?.addEventListener('click', () => setView(key));
      });

      refs.search?.addEventListener('input', () => {
        state.query = String(refs.search.value || '').trim();
        persistLayout().catch(() => null);
        renderContent();
      });

      refs.serviceFilter?.addEventListener('change', () => {
        state.serviceFilter = String(refs.serviceFilter.value || 'all');
        if (state.serviceFilter === 'all') {
          state.groupFilter = 'all';
          state.agentFilter = 'all';
        }
        renderServiceFilter();
        persistLayout().catch(() => null);
        renderContent();
      });

      refs.groupFilter?.addEventListener('change', () => {
        state.groupFilter = String(refs.groupFilter.value || 'all');
        renderServiceFilter();
        persistLayout().catch(() => null);
        renderContent();
      });

      refs.agentFilter?.addEventListener('change', () => {
        state.agentFilter = String(refs.agentFilter.value || 'all');
        persistLayout().catch(() => null);
        renderContent();
      });

      refs.statusFilter?.addEventListener('change', () => {
        state.statusFilter = String(refs.statusFilter.value || 'all');
        persistLayout().catch(() => null);
        renderContent();
      });

      refs.content?.addEventListener('click', async (event) => {
        const quickAction = event.target.closest('[data-wf-card-action][data-wf-type][data-wf-id]');
        if (quickAction) {
          event.preventDefault();
          event.stopPropagation();
          const action = String(quickAction.getAttribute('data-wf-card-action') || '').trim();
          const type = String(quickAction.getAttribute('data-wf-type') || '').trim();
          const id = String(quickAction.getAttribute('data-wf-id') || '').trim();
          if (!action || !type || !id) return;
          if (action === 'open' || action === 'edit') {
            openDetail(type, id);
            return;
          }
          if (action === 'create-task') {
            await quickCreateWorkflowTaskFromContext(type, id);
            return;
          }
          if (action === 'task-status' && type === 'task') {
            const nextStatus = String(quickAction.getAttribute('data-wf-next-status') || '').trim();
            if (!nextStatus) return;
            await moveTaskToStatus(id, nextStatus);
            return;
          }
          if (action === 'delete') {
            await deleteEntityQuick(type, id);
            return;
          }
        }

        const mapAction = event.target.closest('[data-wf-map-action]');
        if (mapAction) {
          if (state.activeView !== 'map') return;
          event.preventDefault();
          event.stopPropagation();
          const action = String(mapAction.getAttribute('data-wf-map-action') || '').trim();
          if (action === 'zoom_in') state.mapOptions.zoom = clampMapZoom((state.mapOptions.zoom || 1) + 0.1);
          if (action === 'zoom_out') state.mapOptions.zoom = clampMapZoom((state.mapOptions.zoom || 1) - 0.1);
          if (action === 'reset') {
            state.mapOptions.zoom = 1;
            state.mapOptions.panX = 0;
            state.mapOptions.panY = 0;
          }
          applyMapTransform();
          persistLayout().catch(() => null);
          return;
        }

        const organigramAction = event.target.closest('[data-wf-organigram-action]');
        if (organigramAction) {
          if (state.activeView !== 'organigram') return;
          event.preventDefault();
          event.stopPropagation();
          const action = String(organigramAction.getAttribute('data-wf-organigram-action') || '').trim();
          if (action === 'export_pdf_portrait') {
            exportOrganigramAsPdf('portrait');
            return;
          }
          if (action === 'export_pdf_landscape') {
            exportOrganigramAsPdf('landscape');
            return;
          }
          if (action === 'export_pdf_auto') {
            const mode = detectOrganigramPdfOrientation();
            exportOrganigramAsPdf(mode);
            return;
          }
          if (action === 'zoom_in') state.organigramOptions.zoom = clampOrganigramZoom((state.organigramOptions.zoom || 1) + 0.1);
          if (action === 'zoom_out') state.organigramOptions.zoom = clampOrganigramZoom((state.organigramOptions.zoom || 1) - 0.1);
          if (action === 'reset') {
            state.organigramOptions.zoom = 1;
            state.organigramOptions.panX = 0;
            state.organigramOptions.panY = 0;
          }
          applyOrganigramTransform();
          persistLayout().catch(() => null);
          return;
        }

        const linkToRootAction = event.target.closest('[data-wf-organigram-link-root]');
        if (linkToRootAction) {
          if (state.activeView !== 'organigram') return;
          event.preventDefault();
          event.stopPropagation();
          const sourceId = String(linkToRootAction.getAttribute('data-wf-organigram-link-root') || '').trim();
          const rootId = String(linkToRootAction.getAttribute('data-wf-organigram-root-id') || '').trim();
          linkServiceToRoot(sourceId, rootId).catch((error) => {
            console.error('workflow organigram link root', error);
            toast(`Erreur liaison: ${error.message}`);
          });
          return;
        }

        const mapToggle = event.target.closest('[data-wf-map-toggle]');
        if (mapToggle) {
          const key = String(mapToggle.getAttribute('data-wf-map-toggle') || '').trim();
          if (key && key in state.mapOptions) {
            state.mapOptions[key] = !!mapToggle.checked;
            persistLayout().catch(() => null);
            renderContent();
          }
          return;
        }

        const mapLinksAction = event.target.closest('[data-wf-map-links-action]');
        if (mapLinksAction) {
          event.preventDefault();
          event.stopPropagation();
          const action = String(mapLinksAction.getAttribute('data-wf-map-links-action') || '').trim();
          const step = 100;
          if (action === 'expand_structure') state.mapOptions.showAllStructure = true;
          if (action === 'expand_transverse') state.mapOptions.showAllTransverse = true;
          if (action === 'expand_applicative') state.mapOptions.showAllApplicative = true;
          if (action === 'collapse_structure') {
            state.mapOptions.showAllStructure = false;
            state.mapOptions.structureVisible = Math.min(Number(state.mapOptions.structureVisible || 120), 120);
          }
          if (action === 'collapse_transverse') {
            state.mapOptions.showAllTransverse = false;
            state.mapOptions.transverseVisible = Math.min(Number(state.mapOptions.transverseVisible || 120), 120);
          }
          if (action === 'collapse_applicative') {
            state.mapOptions.showAllApplicative = false;
            state.mapOptions.applicativeVisible = Math.min(Number(state.mapOptions.applicativeVisible || 120), 120);
          }
          if (action === 'more_structure') state.mapOptions.structureVisible = Number(state.mapOptions.structureVisible || 120) + step;
          if (action === 'more_transverse') state.mapOptions.transverseVisible = Number(state.mapOptions.transverseVisible || 120) + step;
          if (action === 'more_applicative') state.mapOptions.applicativeVisible = Number(state.mapOptions.applicativeVisible || 120) + step;
          persistLayout().catch(() => null);
          renderContent();
          return;
        }

        const orgAction = event.target.closest('[data-wf-org-action]');
        if (orgAction) {
          event.preventDefault();
          event.stopPropagation();
          const action = String(orgAction.getAttribute('data-wf-org-action') || '').trim();
          if (action === 'export_pdf') {
            exportOrganizationAsPdf();
            return;
          }
          const shouldOpen = action === 'expand_all';
          refs.content?.querySelectorAll('.workflow-org-branch')?.forEach((node) => {
            node.setAttribute('data-wf-branch-state', shouldOpen ? 'open' : 'closed');
            const branchKey = String(node.getAttribute('data-wf-branch-key') || '').trim();
            if (branchKey) state.orgBranchState[branchKey] = shouldOpen ? 'open' : 'closed';
            const toggle = node.querySelector('[data-wf-branch-toggle]');
            if (toggle) {
              toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
              toggle.textContent = shouldOpen ? '▾' : '▸';
            }
          });
          persistLayout().catch(() => null);
          return;
        }
        const toggle = event.target.closest('[data-wf-branch-toggle]');
        if (toggle) {
          event.preventDefault();
          event.stopPropagation();
          const node = toggle.closest('[data-wf-branch-state]');
          if (!node) return;
          const isOpen = String(node.getAttribute('data-wf-branch-state') || '') === 'open';
          const nextState = isOpen ? 'closed' : 'open';
          node.setAttribute('data-wf-branch-state', nextState);
          const branchKey = String(node.getAttribute('data-wf-branch-key') || '').trim();
          if (branchKey) state.orgBranchState[branchKey] = nextState;
          toggle.setAttribute('aria-expanded', nextState === 'open' ? 'true' : 'false');
          toggle.textContent = nextState === 'open' ? '▾' : '▸';
          persistLayout().catch(() => null);
          return;
        }
        const target = event.target.closest('[data-wf-type][data-wf-id]');
        if (!target) return;
        const type = String(target.getAttribute('data-wf-type') || '');
        const id = String(target.getAttribute('data-wf-id') || '');
        if (!type || !id) return;
        openDetail(type, id);
      });

      refs.content?.addEventListener('input', (event) => {
        const mapInput = event.target.closest('[data-wf-map-input]');
        if (!mapInput || state.activeView !== 'map') return;
        const key = String(mapInput.getAttribute('data-wf-map-input') || '').trim();
        if (!key || !(key in state.mapOptions)) return;
        state.mapOptions[key] = String(mapInput.value || '');
        if (key === 'linkQuery') {
          state.mapOptions.showAllStructure = false;
          state.mapOptions.showAllTransverse = false;
          state.mapOptions.showAllApplicative = false;
        }
        persistLayout().catch(() => null);
        renderContent();
      });

      refs.content?.addEventListener('change', (event) => {
        const mapInput = event.target.closest('[data-wf-map-input]');
        if (!mapInput || state.activeView !== 'map') return;
        const key = String(mapInput.getAttribute('data-wf-map-input') || '').trim();
        if (!key || !(key in state.mapOptions)) return;
        state.mapOptions[key] = String(mapInput.value || '');
        persistLayout().catch(() => null);
        renderContent();
      });

      refs.content?.addEventListener('wheel', (event) => {
        const viewport = event.target.closest('[data-wf-map-viewport]');
        if (!viewport || state.activeView !== 'map') return;
        if (!event.ctrlKey) return;
        event.preventDefault();
        const delta = event.deltaY < 0 ? 0.08 : -0.08;
        state.mapOptions.zoom = clampMapZoom((state.mapOptions.zoom || 1) + delta);
        applyMapTransform();
        persistLayout().catch(() => null);
      }, { passive: false });

      refs.content?.addEventListener('wheel', (event) => {
        const viewport = event.target.closest('[data-wf-organigram-viewport]');
        if (!viewport || state.activeView !== 'organigram') return;
        if (!event.ctrlKey) return;
        event.preventDefault();
        const delta = event.deltaY < 0 ? 0.08 : -0.08;
        state.organigramOptions.zoom = clampOrganigramZoom((state.organigramOptions.zoom || 1) + delta);
        applyOrganigramTransform();
        persistLayout().catch(() => null);
      }, { passive: false });

      refs.content?.addEventListener('mousedown', (event) => {
        const viewport = event.target.closest('[data-wf-map-viewport]');
        if (!viewport || state.activeView !== 'map') return;
        if (event.button !== 0) return;
        if (event.target.closest('button, a, input, select, textarea, [data-wf-type]')) return;
        state.draggingMap = {
          startX: event.clientX,
          startY: event.clientY,
          panX: Number(state.mapOptions.panX || 0),
          panY: Number(state.mapOptions.panY || 0)
        };
        viewport.classList.add('is-panning');
      });

      refs.content?.addEventListener('mousedown', (event) => {
        const viewport = event.target.closest('[data-wf-organigram-viewport]');
        if (!viewport || state.activeView !== 'organigram') return;
        if (event.button !== 0) return;
        if (event.target.closest('button, a, input, select, textarea, [data-wf-type]')) return;
        state.draggingOrganigram = {
          startX: event.clientX,
          startY: event.clientY,
          panX: Number(state.organigramOptions.panX || 0),
          panY: Number(state.organigramOptions.panY || 0)
        };
        viewport.classList.add('is-panning');
      });

      document.addEventListener('mousemove', (event) => {
        if (!state.draggingMap || state.activeView !== 'map') return;
        const dx = event.clientX - state.draggingMap.startX;
        const dy = event.clientY - state.draggingMap.startY;
        state.mapOptions.panX = state.draggingMap.panX + dx;
        state.mapOptions.panY = state.draggingMap.panY + dy;
        applyMapTransform();
      });

      document.addEventListener('mousemove', (event) => {
        if (!state.draggingOrganigram || state.activeView !== 'organigram') return;
        const dx = event.clientX - state.draggingOrganigram.startX;
        const dy = event.clientY - state.draggingOrganigram.startY;
        state.organigramOptions.panX = state.draggingOrganigram.panX + dx;
        state.organigramOptions.panY = state.draggingOrganigram.panY + dy;
        applyOrganigramTransform();
      });

      document.addEventListener('mouseup', () => {
        if (!state.draggingMap) return;
        state.draggingMap = null;
        refs.content?.querySelectorAll('[data-wf-map-viewport].is-panning')?.forEach((node) => node.classList.remove('is-panning'));
        persistLayout().catch(() => null);
      });

      document.addEventListener('mouseup', () => {
        if (!state.draggingOrganigram) return;
        state.draggingOrganigram = null;
        refs.content?.querySelectorAll('[data-wf-organigram-viewport].is-panning')?.forEach((node) => node.classList.remove('is-panning'));
        persistLayout().catch(() => null);
      });

      refs.content?.addEventListener('dragstart', (event) => {
        const card = event.target.closest('[data-wf-task-card][data-wf-task-id]');
        if (!card || !canEditWorkflow() || state.activeView !== 'kanban') return;
        const taskId = String(card.getAttribute('data-wf-task-id') || '').trim();
        if (!taskId) return;
        state.draggingTaskId = taskId;
        card.classList.add('is-dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', taskId);
        }
      });

      refs.content?.addEventListener('dragend', (event) => {
        const card = event.target.closest('[data-wf-task-card][data-wf-task-id]');
        if (card) card.classList.remove('is-dragging');
        state.draggingTaskId = null;
        refs.content?.querySelectorAll('.workflow-kanban-lane.is-dragover')?.forEach((lane) => lane.classList.remove('is-dragover'));
      });

      refs.content?.addEventListener('dragover', (event) => {
        const lane = event.target.closest('[data-wf-kanban-lane]');
        if (!lane || !canEditWorkflow() || state.activeView !== 'kanban') return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        refs.content?.querySelectorAll('.workflow-kanban-lane.is-dragover')?.forEach((node) => {
          if (node !== lane) node.classList.remove('is-dragover');
        });
        lane.classList.add('is-dragover');
      });

      refs.content?.addEventListener('dragleave', (event) => {
        const lane = event.target.closest('[data-wf-kanban-lane]');
        if (!lane) return;
        lane.classList.remove('is-dragover');
      });

      refs.content?.addEventListener('drop', (event) => {
        const lane = event.target.closest('[data-wf-kanban-lane]');
        if (!lane || !canEditWorkflow() || state.activeView !== 'kanban') return;
        event.preventDefault();
        lane.classList.remove('is-dragover');
        const status = String(lane.getAttribute('data-wf-kanban-lane') || '').trim();
        const droppedTaskId = state.draggingTaskId
          || String(event.dataTransfer?.getData('text/plain') || '').trim();
        state.draggingTaskId = null;
        if (!droppedTaskId || !status) return;
        moveTaskToStatus(droppedTaskId, status).catch((error) => {
          console.error('workflow kanban drop', error);
          toast(`Erreur de deplacement: ${error.message}`);
        });
      });

      document.getElementById('btn-workflow-detail-close')?.addEventListener('click', () => {
        closeDetailModal();
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && refs.detailModal && !refs.detailModal.classList.contains('hidden')) {
          closeDetailModal();
        }
      });

      document.getElementById('btn-workflow-add-community')?.addEventListener('click', () => {
        openCreateModal('community');
      });

      document.getElementById('btn-workflow-add-service')?.addEventListener('click', () => {
        openCreateModal('service');
      });

      document.getElementById('btn-workflow-add-group')?.addEventListener('click', () => {
        openCreateModal('group');
      });

      document.getElementById('btn-workflow-add-agent')?.addEventListener('click', () => {
        openCreateModal('agent');
      });

      document.getElementById('btn-workflow-add-task')?.addEventListener('click', () => {
        openCreateModal('task');
      });

      document.getElementById('btn-workflow-add-procedure')?.addEventListener('click', () => {
        openCreateModal('procedure');
      });

      document.getElementById('btn-workflow-add-software')?.addEventListener('click', () => {
        openCreateModal('software');
      });

      document.getElementById('btn-workflow-migrate-agent-users')?.addEventListener('click', () => {
        migrateAgentUserIdsFromDirectory().catch((error) => {
          console.error('workflow migrateAgentUserIdsFromDirectory', error);
          toast(`Erreur migration agents: ${error.message}`);
        });
      });

      document.getElementById('btn-close-workflow-modal')?.addEventListener('click', closeCreateModal);
      document.getElementById('btn-cancel-workflow-modal')?.addEventListener('click', closeCreateModal);
      refs.modal?.addEventListener('click', (event) => {
        if (event.target === refs.modal) closeCreateModal();
      });
      refs.modalSave?.addEventListener('click', () => {
        submitCreateModal().catch((error) => {
          console.error('workflow submitCreateModal', error);
          toast(`Erreur workflow: ${error.message}`);
        });
      });

      refreshWorkflowActionPermissions();
    }

    async function init() {
      if (!refs.section || !refs.content) return;
      bindEvents();
      await ensureSeedData();
      await loadCollections();
      refreshWorkflowActionPermissions();
      const migrationKey = 'taskmda_workflow_agent_userid_migrated_v1';
      if (!localStorage.getItem(migrationKey)) {
        await migrateAgentUserIdsFromDirectory({ silent: true });
        localStorage.setItem(migrationKey, '1');
      }
      await readLayout();
      renderServiceFilter();
      setView(state.activeView);
      state.initialized = true;
    }

    async function render() {
      if (!state.initialized) {
        await init();
        return;
      }
      await loadCollections();
      refreshWorkflowActionPermissions();
      renderServiceFilter();
      renderContent();
      if (state.selectedType && state.selectedId) {
        const existing = getItem(state.selectedType, state.selectedId);
        if (existing) {
          openDetail(state.selectedType, state.selectedId);
        } else {
          state.selectedType = null;
          state.selectedId = null;
          refs.detail?.classList.add('hidden');
          refs.detailModal?.classList.add('hidden');
          document.body.classList.remove('overflow-hidden');
        }
      }
    }

    return {
      init,
      render
    };
  }

  global.TaskMDAWorkflow = {
    createModule
  };
}(window));

