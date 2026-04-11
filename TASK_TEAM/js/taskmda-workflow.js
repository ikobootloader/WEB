
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
    workflowRoles: 'id',
    workflowProcesses: 'id',
    workflowProcessSteps: 'id',
    workflowFlows: 'id',
    workflowProcessTemplates: 'id',
    workflowMetrics: 'id',
    workflowLayout: 'id',
    workflowAudit: 'id',
    workflowHistory: 'id',
    workflowPermissionProfiles: 'id',
    workflowPermissionAssignments: 'id',
    workflowPermissionRequests: 'id',
    workflowPermissionReviews: 'id',
    workflowPermissionAudit: 'id',
    workflowContingencyPlans: 'id',
    workflowContingencyActions: 'id',
    workflowContingencyActivations: 'id',
    workflowContingencyExercises: 'id',
    workflowContingencyReviews: 'id',
    workflowContingencyAudit: 'id'
  };

  const ENTITY_META = {
    community: { store: 'workflowCommunities', label: 'Communaute' },
    service: { store: 'workflowServices', label: 'Service' },
    group: { store: 'workflowGroups', label: 'Groupe' },
    agent: { store: 'workflowAgents', label: 'Agent' },
    role: { store: 'workflowRoles', label: 'Role metier' },
    process: { store: 'workflowProcesses', label: 'Processus' },
    step: { store: 'workflowProcessSteps', label: 'Etape' },
    flow: { store: 'workflowFlows', label: 'Flux' },
    template: { store: 'workflowProcessTemplates', label: 'Modele de processus' },
    metric: { store: 'workflowMetrics', label: 'Metrique workflow' },
    task: { store: 'workflowTasks', label: 'Tache workflow' },
    procedure: { store: 'workflowProcedures', label: 'Procedure' },
    software: { store: 'workflowSoftware', label: 'Logiciel metier' },
    contingencyPlan: { store: 'workflowContingencyPlans', label: 'Plan de contingence' }
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
      activeView: 'organigram',
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
        showMinimap: true,
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
      activeView: 'organigram',
      activeGroup: 'structure',
      lastViewByGroup: {
        structure: 'organigram',
        processes: 'processes',
        pilotage: 'tasks',
        referentiels: 'procedures',
        supervision: 'analytics'
      },
      query: '',
      serviceFilter: 'all',
      groupFilter: 'all',
      agentFilter: 'all',
      statusFilter: 'all',
      governanceFilter: 'all',
      governancePermissionSoftwareFilter: 'all',
      governancePermissionBeneficiaryTypeFilter: 'all',
      governancePermissionRequestStatusFilter: 'all',
      orgBranchState: {},
      mapOptions: {
        zoom: 1,
        panX: 0,
        panY: 0,
        showStructure: true,
        showTransverse: true,
        showApplicative: true,
        showMinimap: true,
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
      flowDesigner: {
        sourceStepId: null,
        selectedFlowId: null,
        selectedFlowIds: [],
        multiSelectMode: false,
        linkMode: false,
        dragSourceStepId: null
      },
      permissionAutoReviewRunning: false,
      inlineDetailSaveTimers: new Map(),
      inlineDetailFinalizeTimers: new Map(),
      selectedType: null,
      selectedId: null,
      collections: {
        communities: [],
        services: [],
        groups: [],
        agents: [],
        roles: [],
        processes: [],
        steps: [],
        flows: [],
        templates: [],
        metrics: [],
        users: [],
        directoryUsers: [],
        tasks: [],
        procedures: [],
        software: [],
        permissionProfiles: [],
        permissionAssignments: [],
        permissionRequests: [],
        permissionReviews: [],
        permissionAudit: [],
        contingencyPlans: [],
        contingencyActions: [],
        contingencyActivations: [],
        contingencyExercises: [],
        contingencyReviews: [],
        contingencyAudit: [],
        softwareVersions: [],
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
      toolbarMain: document.querySelector('#global-workflow-section .workflow-toolbar-main'),
      head: document.querySelector('#global-workflow-section .workflow-head'),
      quickActions: document.querySelector('#global-workflow-section .workflow-head .workflow-quick-actions'),
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

    function normalizeWorkflowTopActionsRow() {
      const toolbarMain = refs.toolbarMain;
      const quickActions = refs.quickActions;
      if (toolbarMain && quickActions && quickActions.parentElement !== toolbarMain) {
        toolbarMain.appendChild(quickActions);
      }
      if (refs.head && quickActions && quickActions.parentElement === toolbarMain) {
        refs.head.classList.add('workflow-head-actions-moved');
      }
    }

    const viewIds = {
      map: 'workflow-view-map',
      organization: 'workflow-view-organization',
      organigram: 'workflow-view-organigram',
      agents: 'workflow-view-agents',
      processes: 'workflow-view-processes',
      templates: 'workflow-view-templates',
      tasks: 'workflow-view-tasks',
      kanban: 'workflow-view-kanban',
      timeline: 'workflow-view-timeline',
      procedures: 'workflow-view-procedures',
      software: 'workflow-view-software',
      contingency: 'workflow-view-contingency',
      analytics: 'workflow-view-analytics',
      governance: 'workflow-view-governance',
      journal: 'workflow-view-journal'
    };

    const WORKFLOW_GROUPS = {
      structure: {
        label: 'Structure',
        icon: 'apartment',
        views: ['map', 'organization', 'organigram', 'agents'],
        defaultView: 'organigram'
      },
      processes: {
        label: 'Processus',
        icon: 'hub',
        views: ['processes', 'templates'],
        defaultView: 'processes'
      },
      pilotage: {
        label: 'Pilotage',
        icon: 'assignment',
        views: ['tasks', 'kanban', 'timeline'],
        defaultView: 'tasks'
      },
      referentiels: {
        label: 'R\u00e9f\u00e9rentiels',
        icon: 'library_books',
        views: ['procedures', 'software', 'contingency'],
        defaultView: 'procedures'
      },
      supervision: {
        label: 'Supervision',
        icon: 'monitoring',
        views: ['analytics', 'governance', 'journal'],
        defaultView: 'analytics'
      }
    };

    function groupForView(viewKey) {
      const safeKey = String(viewKey || '').trim();
      const entry = Object.entries(WORKFLOW_GROUPS).find(([, grp]) => grp.views.includes(safeKey));
      return entry ? entry[0] : 'structure';
    }

    function groupLabel(groupKey) {
      return WORKFLOW_GROUPS[groupKey]?.label || '';
    }

    function updateGroupTabsUI(activeGroupKey) {
      const groupsContainer = document.querySelector('#global-workflow-section .workflow-group-tabs');
      if (groupsContainer) {
        groupsContainer.querySelectorAll('.workflow-group-tab').forEach(btn => {
          const g = String(btn.getAttribute('data-wf-group') || '').trim();
          btn.classList.toggle('is-active', g === activeGroupKey);
        });
      }
      const subTabsContainer = document.querySelector('#global-workflow-section .workflow-sub-tabs');
      if (subTabsContainer) {
        subTabsContainer.querySelectorAll('.workflow-view-tab').forEach(btn => {
          const g = String(btn.getAttribute('data-wf-group') || '').trim();
          btn.classList.toggle('wf-sub-hidden', g !== activeGroupKey);
        });
      }
    }

    function filterQuickAddByGroup(activeGroupKey) {
      const menu = document.getElementById('workflow-quick-add-menu');
      if (!menu) return;
      const items = menu.querySelectorAll('.workflow-quick-add-item[data-wf-add-group]');
      items.forEach(item => {
        const itemGroup = String(item.getAttribute('data-wf-add-group') || '').trim();
        item.style.display = itemGroup === activeGroupKey ? '' : 'none';
      });
      const columns = menu.querySelectorAll('.workflow-quick-add-column[data-wf-add-column]');
      columns.forEach(col => {
        const colGroups = String(col.getAttribute('data-wf-add-column') || '').split(',').map(s => s.trim());
        const hasVisible = Array.from(col.querySelectorAll('.workflow-quick-add-item[data-wf-add-group]'))
          .some(item => item.style.display !== 'none');
        col.style.display = hasVisible ? '' : 'none';
      });
    }

    const TASK_STATUS_OPTIONS = ['todo', 'in_progress', 'blocked', 'ready_for_review', 'done', 'approved'];
    const TASK_APPROVAL_OPTIONS = ['pending', 'approved', 'rejected'];
    const PERMISSION_LEVEL_OPTIONS = ['read', 'write', 'validate', 'admin'];
    const PERMISSION_STATUS_OPTIONS = ['active', 'suspended', 'revoked', 'review_due'];
    const PERMISSION_REQUEST_ACTIONS = ['grant', 'update', 'revoke'];
    const PERMISSION_REQUEST_STATUS = ['draft', 'submitted', 'approved', 'rejected', 'executed'];
    const PERMISSION_REVIEW_DECISIONS = ['pending', 'kept', 'revoked'];
    const CONTINGENCY_PLAN_STATUS = ['draft', 'ready', 'active', 'archived'];
    const CONTINGENCY_PLAN_CRITICALITY = ['low', 'medium', 'high', 'critical'];
    const CONTINGENCY_ACTION_STATUS = ['todo', 'in_progress', 'done', 'blocked'];
    const CONTINGENCY_ACTIVATION_STATUS = ['active', 'closed'];
    const CONTINGENCY_EXERCISE_RESULT = ['pending', 'ok', 'partial', 'ko'];

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

    function getCurrentUserPrimaryAgentId(preferredServiceId = '', preferredGroupId = '') {
      const currentId = String(currentUserId() || '').trim();
      if (!currentId || currentId === 'system') return null;
      const serviceId = String(preferredServiceId || '').trim();
      const groupId = String(preferredGroupId || '').trim();
      const agents = (state.collections.agents || []).filter((agent) => String(agent?.metadata?.userId || '').trim() === currentId);
      if (!agents.length) return null;
      const scored = agents.map((agent) => {
        let score = 0;
        if (serviceId && String(agent.serviceId || '') === serviceId) score += 2;
        if (groupId && Array.isArray(agent.groupIds) && agent.groupIds.includes(groupId)) score += 1;
        return { agent, score };
      }).sort((a, b) => b.score - a.score);
      return String(scored[0]?.agent?.id || '').trim() || null;
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
        processId: null,
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

    function getProcessBundle(processId) {
      const safeId = String(processId || '').trim();
      const process = state.collections.processes.find((row) => String(row.id) === safeId) || null;
      const steps = state.collections.steps
        .filter((row) => String(row.processId || '') === safeId)
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const flows = state.collections.flows.filter((row) => String(row.processId || '') === safeId);
      return { process, steps, flows };
    }

    function normalizeValidationRulesArray(rules, fallbackLevels, fallbackRoleIds) {
      const levelCount = Math.max(1, Number(fallbackLevels || 2) || 2);
      const roleDefaults = Array.isArray(fallbackRoleIds) ? fallbackRoleIds.filter(Boolean) : [];
      const rawRules = Array.isArray(rules) ? rules : [];
      const normalized = [];
      for (let i = 0; i < levelCount; i += 1) {
        const source = rawRules[i] || {};
        const requiredRoleIds = parseUniqueCsv(source.requiredRoleIds).filter(Boolean);
        normalized.push({
          level: i + 1,
          requiredRoleIds: requiredRoleIds.length ? requiredRoleIds : roleDefaults.slice(),
          quorum: Math.max(1, Number(source.quorum || 1) || 1)
        });
      }
      return normalized;
    }

    function normalizeProcessValidation(rawValidation) {
      const source = rawValidation || {};
      const requiredLevels = Math.max(1, Number(source.requiredLevels || 2) || 2);
      const requiredRoleIds = parseUniqueCsv(source.requiredRoleIds).filter(Boolean);
      const mode = String(source.mode || 'level').trim().toLowerCase() === 'sequential' ? 'sequential' : 'level';
      const levelRules = normalizeValidationRulesArray(source.levelRules, requiredLevels, requiredRoleIds);
      const level = Math.max(0, Math.min(requiredLevels, Number(source.level || 0) || 0));
      const approvers = Array.isArray(source.approvers)
        ? source.approvers.map((entry) => ({
          level: Math.max(1, Number(entry?.level || 1) || 1),
          byUserId: String(entry?.byUserId || '').trim(),
          roleId: String(entry?.roleId || '').trim() || null,
          at: Number(entry?.at || 0) || now()
        }))
        : [];
      return {
        level,
        requiredLevels,
        requiredRoleIds,
        mode,
        levelRules,
        approvers
      };
    }

    function parseValidationRulesJson(value, fallbackValidation) {
      const fallback = normalizeProcessValidation(fallbackValidation);
      const raw = String(value || '').trim();
      if (!raw) return fallback.levelRules;
      try {
        const parsed = JSON.parse(raw);
        return normalizeValidationRulesArray(parsed, fallback.requiredLevels, fallback.requiredRoleIds);
      } catch (error) {
        return fallback.levelRules;
      }
    }

    async function createTemplateFromProcess(processId) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: action reservee au role admin ou manager workflow');
        return;
      }
      const { process, steps, flows } = getProcessBundle(processId);
      if (!process) return;
      const template = {
        id: `wf-template-${uid()}`,
        name: `Modele ${process.title || process.id}`,
        description: process.description || '',
        sourceProcessId: process.id,
        communityId: process.communityId || null,
        serviceId: process.serviceId || null,
        groupId: process.groupId || null,
        ownerAgentId: process.ownerAgentId || null,
        status: 'draft',
        tags: Array.isArray(process.tags) ? process.tags.slice() : [],
        validation: normalizeProcessValidation(process.validation),
        version: 1,
        templateSteps: steps.map((step) => ({
          title: step.title || '',
          stepType: step.stepType || 'action',
          description: step.description || '',
          roleId: step.roleId || null,
          linkedProcedureId: step.linkedProcedureId || null,
          linkedSoftwareIds: Array.isArray(step.linkedSoftwareIds) ? step.linkedSoftwareIds.slice() : [],
          estimatedDurationMinutes: Number(step.estimatedDurationMinutes || 0) || 0,
          order: Number(step.order || 1) || 1
        })),
        templateFlows: flows.map((flow) => ({
          fromStepOrder: Number((steps.find((s) => s.id === flow.fromStepId)?.order) || 0),
          toStepOrder: Number((steps.find((s) => s.id === flow.toStepId)?.order) || 0),
          flowType: flow.flowType || 'sequence',
          condition: flow.condition || '',
          label: flow.label || ''
        })),
        metadata: {
          versionHistory: [{
            version: 1,
            updatedAt: now(),
            byUserId: currentUserId()
          }]
        },
        createdAt: now(),
        updatedAt: now()
      };
      await api.put('workflowProcessTemplates', template, STORE_KEY_FIELDS.workflowProcessTemplates);
      await logAudit('create_template_from_process', 'template', template.id, { processId: process.id });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      openDetail('template', template.id);
      toast('Modele cree depuis le processus');
    }

    async function createTemplateVariant(templateId) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: action reservee au role admin ou manager workflow');
        return;
      }
      const template = state.collections.templates.find((row) => String(row.id) === String(templateId || ''));
      if (!template) return;
      const defaultName = `${template.name || 'Modele'} - Variante`;
      const variantName = String(global.prompt('Nom de la variante', defaultName) || '').trim();
      if (!variantName) return;
      const variantGroupKey = String(template.variantGroupKey || `variant-group-${template.parentTemplateId || template.id}`).trim();
      const row = {
        ...template,
        id: `wf-template-${uid()}`,
        name: variantName,
        status: 'draft',
        version: 1,
        parentTemplateId: String(template.parentTemplateId || template.id),
        variantGroupKey,
        variantName,
        templateSteps: Array.isArray(template.templateSteps)
          ? template.templateSteps.map((step) => ({ ...step, linkedSoftwareIds: parseUniqueCsv(step.linkedSoftwareIds) }))
          : [],
        templateFlows: Array.isArray(template.templateFlows) ? template.templateFlows.map((flow) => ({ ...flow })) : [],
        metadata: {
          ...(template.metadata || {}),
          sourceTemplateId: template.id,
          versionHistory: [{
            version: 1,
            updatedAt: now(),
            byUserId: currentUserId(),
            reason: 'variant_create'
          }]
        },
        createdAt: now(),
        updatedAt: now()
      };
      await api.put('workflowProcessTemplates', row, STORE_KEY_FIELDS.workflowProcessTemplates);
      await logAudit('create_template_variant', 'template', row.id, { sourceTemplateId: template.id, variantGroupKey });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      openDetail('template', row.id);
      toast('Variante de modele creee');
    }

    async function instantiateTemplate(templateId) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: action reservee au role admin ou manager workflow');
        return;
      }
      const template = state.collections.templates.find((row) => String(row.id) === String(templateId || ''));
      if (!template) return;
      const processTitle = String(global.prompt('Titre du nouveau processus', `${template.name || 'Processus'} - instance`) || '').trim();
      if (!processTitle) return;

      const processId = `wf-process-${uid()}`;
      const stepIdByOrder = new Map();
      const createdAt = now();
      const newProcess = {
        id: processId,
        title: processTitle,
        description: String(template.description || '').trim(),
        communityId: template.communityId || null,
        serviceId: template.serviceId || null,
        groupId: template.groupId || null,
        ownerAgentId: template.ownerAgentId || null,
        status: 'draft',
        criticality: 'medium',
        inputs: [],
        outputs: [],
        tags: Array.isArray(template.tags) ? template.tags.slice() : [],
        validation: normalizeProcessValidation(template.validation || { level: 0, requiredLevels: 2, requiredRoleIds: [], approvers: [] }),
        metadata: { templateId: template.id },
        createdAt,
        updatedAt: createdAt
      };
      await api.put('workflowProcesses', newProcess, STORE_KEY_FIELDS.workflowProcesses);

      for (const tplStep of (template.templateSteps || [])) {
        const stepId = `wf-step-${uid()}`;
        const order = Math.max(1, Number(tplStep.order || 1) || 1);
        stepIdByOrder.set(order, stepId);
        await api.put('workflowProcessSteps', {
          id: stepId,
          processId,
          title: String(tplStep.title || '').trim() || `Etape ${order}`,
          stepType: String(tplStep.stepType || 'action').trim() || 'action',
          description: String(tplStep.description || '').trim(),
          serviceId: newProcess.serviceId,
          groupId: newProcess.groupId,
          ownerAgentId: newProcess.ownerAgentId,
          roleId: tplStep.roleId || null,
          linkedProcedureId: tplStep.linkedProcedureId || null,
          linkedSoftwareIds: Array.isArray(tplStep.linkedSoftwareIds) ? tplStep.linkedSoftwareIds.slice() : [],
          linkedTaskId: null,
          estimatedDurationMinutes: Number(tplStep.estimatedDurationMinutes || 0) || 0,
          order,
          metadata: { templateId: template.id },
          createdAt,
          updatedAt: createdAt
        }, STORE_KEY_FIELDS.workflowProcessSteps);
      }

      for (const tplFlow of (template.templateFlows || [])) {
        const fromStepId = stepIdByOrder.get(Number(tplFlow.fromStepOrder || 0));
        const toStepId = stepIdByOrder.get(Number(tplFlow.toStepOrder || 0));
        if (!fromStepId || !toStepId) continue;
        await api.put('workflowFlows', {
          id: `wf-flow-${uid()}`,
          processId,
          fromStepId,
          toStepId,
          flowType: String(tplFlow.flowType || 'sequence').trim() || 'sequence',
          condition: String(tplFlow.condition || '').trim(),
          label: String(tplFlow.label || '').trim(),
          metadata: { templateId: template.id },
          createdAt,
          updatedAt: createdAt
        }, STORE_KEY_FIELDS.workflowFlows);
      }

      await logAudit('instantiate_template', 'process', processId, { templateId: template.id });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      openDetail('process', processId);
      toast('Processus instancie depuis le modele');
    }

    function exportProcessSheetPdf(processId) {
      const { process, steps, flows } = getProcessBundle(processId);
      if (!process) return;
      const maps = getMaps();
      const dateLabel = new Date().toLocaleString('fr-FR');
      const html = `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8"><title>Fiche processus</title>
<style>
body{font-family:Arial,sans-serif;padding:16px;color:#0f172a}
h1{font-size:20px;margin:0 0 8px} h2{font-size:15px;margin:14px 0 6px}
table{border-collapse:collapse;width:100%;font-size:12px} th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}
.meta{font-size:12px;color:#475569;margin-bottom:8px}
</style></head><body>
<h1>${esc(process.title || process.id)}</h1>
<p class="meta">Export: ${esc(dateLabel)} | Statut: ${esc(process.status || 'draft')} | Service: ${esc(maps.serviceById.get(process.serviceId)?.name || '-')}</p>
<h2>Description</h2><p>${esc(process.description || '-')}</p>
<h2>Etapes</h2>
<table><thead><tr><th>#</th><th>Titre</th><th>Type</th><th>Responsable</th><th>Duree</th></tr></thead><tbody>
${steps.map((s)=>`<tr><td>${esc(String(s.order || ''))}</td><td>${esc(s.title || '')}</td><td>${esc(s.stepType || '')}</td><td>${esc(maps.agentById.get(s.ownerAgentId)?.displayName || '-')}</td><td>${esc(String(s.estimatedDurationMinutes || 0))} min</td></tr>`).join('')}
</tbody></table>
<h2>Flux</h2>
<table><thead><tr><th>Source</th><th>Cible</th><th>Type</th><th>Condition</th></tr></thead><tbody>
${flows.map((f)=>`<tr><td>${esc(maps.stepById.get(f.fromStepId)?.title || f.fromStepId || '-')}</td><td>${esc(maps.stepById.get(f.toStepId)?.title || f.toStepId || '-')}</td><td>${esc(f.flowType || 'sequence')}</td><td>${esc(f.condition || '-')}</td></tr>`).join('')}
</tbody></table>
<script>window.addEventListener('load',()=>setTimeout(()=>{window.print();},200));</script>
</body></html>`;
      printHtmlWithPopupOrIframe(html, {
        popupFeatures: 'noopener,noreferrer,width=1320,height=920'
      });
    }

    function printHtmlWithPopupOrIframe(html, options = {}) {
      const popupFeatures = String(options.popupFeatures || 'noopener,noreferrer,width=1320,height=920');
      let popup = null;
      try {
        popup = global.open('', '_blank', popupFeatures);
      } catch (_) {
        popup = null;
      }

      if (popup) {
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        return true;
      }

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
            console.error('workflow print iframe', error);
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
        return false;
      }
      doc.open();
      doc.write(html);
      doc.close();
      return true;
    }

    function printSheetHtml(html) {
      return printHtmlWithPopupOrIframe(html, {
        popupFeatures: 'noopener,noreferrer,width=1320,height=920'
      });
    }

    function exportServiceSheetPdf(serviceId) {
      const service = (state.collections.services || []).find((row) => String(row.id) === String(serviceId || ''));
      if (!service) return;
      const maps = getMaps();
      const groups = (state.collections.groups || []).filter((row) => String(row.serviceId || '') === String(service.id));
      const agents = (state.collections.agents || []).filter((row) => String(row.serviceId || '') === String(service.id));
      const processes = (state.collections.processes || []).filter((row) => String(row.serviceId || '') === String(service.id));
      const softwareByService = new Set();
      (state.collections.steps || []).forEach((step) => {
        if (String(step.serviceId || '') !== String(service.id)) return;
        (Array.isArray(step.linkedSoftwareIds) ? step.linkedSoftwareIds : []).forEach((sid) => {
          const safe = String(sid || '').trim();
          if (safe) softwareByService.add(safe);
        });
      });
      const exportedAt = new Date().toLocaleString('fr-FR');
      const html = `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8"><title>Fiche service</title>
<style>
body{font-family:Arial,sans-serif;padding:16px;color:#0f172a}
h1{font-size:20px;margin:0 0 8px} h2{font-size:15px;margin:14px 0 6px}
table{border-collapse:collapse;width:100%;font-size:12px} th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}
.meta{font-size:12px;color:#475569;margin-bottom:8px}
</style></head><body>
<h1>${esc(service.name || service.id)}</h1>
<p class="meta">Export: ${esc(exportedAt)} | Communaute: ${esc(maps.communityById.get(service.communityId)?.name || '-')} | Responsable: ${esc(maps.agentById.get(service.managerAgentId)?.displayName || '-')}</p>
<h2>Description</h2><p>${esc(service.description || '-')}</p>
<h2>Groupes</h2>
<table><thead><tr><th>Nom</th><th>Type</th><th>Membres</th></tr></thead><tbody>
${groups.map((row)=>`<tr><td>${esc(row.name || row.id)}</td><td>${esc(row.type || '-')}</td><td>${esc(String(Array.isArray(row.memberAgentIds) ? row.memberAgentIds.length : 0))}</td></tr>`).join('') || '<tr><td colspan="3">Aucun groupe</td></tr>'}
</tbody></table>
<h2>Agents</h2>
<table><thead><tr><th>Nom</th><th>Titre</th><th>Manager</th></tr></thead><tbody>
${agents.map((row)=>`<tr><td>${esc(row.displayName || row.id)}</td><td>${esc(row.title || '-')}</td><td>${esc(maps.agentById.get(row.managerAgentId)?.displayName || '-')}</td></tr>`).join('') || '<tr><td colspan="3">Aucun agent</td></tr>'}
</tbody></table>
<h2>Processus</h2>
<table><thead><tr><th>Titre</th><th>Statut</th><th>Responsable</th></tr></thead><tbody>
${processes.map((row)=>`<tr><td>${esc(row.title || row.id)}</td><td>${esc(row.status || 'draft')}</td><td>${esc(maps.agentById.get(row.ownerAgentId)?.displayName || '-')}</td></tr>`).join('') || '<tr><td colspan="3">Aucun processus</td></tr>'}
</tbody></table>
<h2>Logiciels relies via etapes</h2>
<p>${esc(Array.from(softwareByService).map((sid) => maps.softwareById.get(sid)?.name || sid).join(', ') || '-')}</p>
<script>window.addEventListener('load',()=>setTimeout(()=>{window.print();},220));</script>
</body></html>`;
      printSheetHtml(html);
    }

    function exportAgentSheetPdf(agentId) {
      const agent = (state.collections.agents || []).find((row) => String(row.id) === String(agentId || ''));
      if (!agent) return;
      const maps = getMaps();
      const processes = (state.collections.processes || []).filter((row) => String(row.ownerAgentId || '') === String(agent.id));
      const steps = (state.collections.steps || []).filter((row) => String(row.ownerAgentId || '') === String(agent.id));
      const tasks = (state.collections.tasks || []).filter((row) => String(row.ownerAgentId || '') === String(agent.id));
      const exportedAt = new Date().toLocaleString('fr-FR');
      const html = `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8"><title>Fiche agent</title>
<style>
body{font-family:Arial,sans-serif;padding:16px;color:#0f172a}
h1{font-size:20px;margin:0 0 8px} h2{font-size:15px;margin:14px 0 6px}
table{border-collapse:collapse;width:100%;font-size:12px} th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}
.meta{font-size:12px;color:#475569;margin-bottom:8px}
</style></head><body>
<h1>${esc(agent.displayName || agent.id)}</h1>
<p class="meta">Export: ${esc(exportedAt)} | Service: ${esc(maps.serviceById.get(agent.serviceId)?.name || '-')} | Titre: ${esc(agent.title || '-')}</p>
<h2>Mission</h2><p>${esc(agent.mission || '-')}</p>
<h2>Competences</h2><p>${esc((agent.skills || []).join(', ') || '-')}</p>
<h2>Outils</h2><p>${esc((agent.tools || []).join(', ') || '-')}</p>
<h2>Processus pilotes</h2>
<table><thead><tr><th>Processus</th><th>Statut</th></tr></thead><tbody>
${processes.map((row)=>`<tr><td>${esc(row.title || row.id)}</td><td>${esc(row.status || 'draft')}</td></tr>`).join('') || '<tr><td colspan="2">Aucun processus</td></tr>'}
</tbody></table>
<h2>Etapes affectees</h2>
<table><thead><tr><th>Etape</th><th>Processus</th><th>Type</th></tr></thead><tbody>
${steps.map((row)=>`<tr><td>${esc(row.title || row.id)}</td><td>${esc(maps.processById.get(row.processId)?.title || row.processId || '-')}</td><td>${esc(row.stepType || '-')}</td></tr>`).join('') || '<tr><td colspan="3">Aucune etape</td></tr>'}
</tbody></table>
<h2>Taches workflow</h2>
<table><thead><tr><th>Tache</th><th>Statut</th><th>Priorite</th></tr></thead><tbody>
${tasks.map((row)=>`<tr><td>${esc(row.title || row.id)}</td><td>${esc(row.status || 'todo')}</td><td>${esc(row.priority || 'medium')}</td></tr>`).join('') || '<tr><td colspan="3">Aucune tache</td></tr>'}
</tbody></table>
<script>window.addEventListener('load',()=>setTimeout(()=>{window.print();},220));</script>
</body></html>`;
      printSheetHtml(html);
    }

    function exportSoftwareSheetPdf(softwareId) {
      const software = (state.collections.software || []).find((row) => String(row.id) === String(softwareId || ''));
      if (!software) return;
      const maps = getMaps();
      const procedures = (state.collections.procedures || []).filter((row) => Array.isArray(row.linkedSoftwareIds) && row.linkedSoftwareIds.includes(software.id));
      const tasks = (state.collections.tasks || []).filter((row) => Array.isArray(row.linkedSoftwareIds) && row.linkedSoftwareIds.includes(software.id));
      const steps = (state.collections.steps || []).filter((row) => Array.isArray(row.linkedSoftwareIds) && row.linkedSoftwareIds.includes(software.id));
      const exportedAt = new Date().toLocaleString('fr-FR');
      const html = `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8"><title>Fiche logiciel</title>
<style>
body{font-family:Arial,sans-serif;padding:16px;color:#0f172a}
h1{font-size:20px;margin:0 0 8px} h2{font-size:15px;margin:14px 0 6px}
table{border-collapse:collapse;width:100%;font-size:12px} th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}
.meta{font-size:12px;color:#475569;margin-bottom:8px}
</style></head><body>
<h1>${esc(software.name || software.id)}</h1>
<p class="meta">Export: ${esc(exportedAt)} | Categorie: ${esc(software.category || '-')}</p>
<h2>Description</h2><p>${esc(software.description || '-')}</p>
<h2>Documentation</h2><p>${esc((software.documentationLinks || []).join(' | ') || '-')}</p>
<h2>Procedures liees</h2>
<table><thead><tr><th>Procedure</th><th>Scope</th></tr></thead><tbody>
${procedures.map((row)=>`<tr><td>${esc(row.title || row.id)}</td><td>${esc(row.scope || '-')}</td></tr>`).join('') || '<tr><td colspan="2">Aucune procedure</td></tr>'}
</tbody></table>
<h2>Etapes impactees</h2>
<table><thead><tr><th>Etape</th><th>Processus</th><th>Type</th></tr></thead><tbody>
${steps.map((row)=>`<tr><td>${esc(row.title || row.id)}</td><td>${esc(maps.processById.get(row.processId)?.title || row.processId || '-')}</td><td>${esc(row.stepType || '-')}</td></tr>`).join('') || '<tr><td colspan="3">Aucune etape</td></tr>'}
</tbody></table>
<h2>Taches liees</h2>
<table><thead><tr><th>Tache</th><th>Statut</th></tr></thead><tbody>
${tasks.map((row)=>`<tr><td>${esc(row.title || row.id)}</td><td>${esc(row.status || 'todo')}</td></tr>`).join('') || '<tr><td colspan="2">Aucune tache</td></tr>'}
</tbody></table>
<script>window.addEventListener('load',()=>setTimeout(()=>{window.print();},220));</script>
</body></html>`;
      printSheetHtml(html);
    }

    function exportContingencyPlanPdf(planId) {
      const plan = (state.collections.contingencyPlans || []).find((row) => String(row.id) === String(planId || ''));
      if (!plan) return;
      const maps = getMaps();
      const actions = (state.collections.contingencyActions || [])
        .filter((row) => String(row.planId) === String(planId))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const activations = (state.collections.contingencyActivations || [])
        .filter((row) => String(row.planId) === String(planId))
        .sort((a, b) => Number(b.startedAt || 0) - Number(a.startedAt || 0))
        .slice(0, 10);
      const exercises = (state.collections.contingencyExercises || [])
        .filter((row) => String(row.planId) === String(planId))
        .sort((a, b) => String(b.exerciseDate || '').localeCompare(String(a.exerciseDate || '')))
        .slice(0, 10);
      const reviews = (state.collections.contingencyReviews || [])
        .filter((row) => String(row.planId) === String(planId))
        .sort((a, b) => String(b.reviewDate || '').localeCompare(String(a.reviewDate || '')))
        .slice(0, 10);
      const exportedAt = new Date().toLocaleString('fr-FR');
      const readiness = computeContingencyPlanReadiness(plan);
      const owner = maps.agentById.get(plan.ownerAgentId)?.displayName || '-';
      const backup = maps.agentById.get(plan.backupAgentId)?.displayName || '-';
      const service = maps.serviceById.get(plan.serviceId)?.name || '-';
      const process = maps.processById.get(plan.processId)?.title || '-';
      const software = (state.collections.software || []).find((row) => String(row.id) === String(plan.softwareId || ''))?.name || '-';
      const html = `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8"><title>Plan de contingence - ${esc(plan.title || plan.code || '')}</title>
<style>
body{font-family:Arial,sans-serif;padding:16px;color:#0f172a}
h1{font-size:20px;margin:0 0 8px;color:#002b6b} h2{font-size:15px;margin:14px 0 6px;color:#1a428a;border-bottom:1px solid #cbd5e1;padding-bottom:4px}
table{border-collapse:collapse;width:100%;font-size:12px;margin:8px 0} th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}
.meta{font-size:12px;color:#475569;margin-bottom:8px}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.badge-critical{background:#fee;color:#b91c1c} .badge-high{background:#fed7aa;color:#c2410c}
.badge-medium{background:#fef3c7;color:#d97706} .badge-low{background:#d1fae5;color:#059669}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:8px 0}
.info-item{font-size:12px} .info-label{font-weight:600;color:#475569}
</style></head><body>
<h1>PLAN DE CONTINGENCE</h1>
<p class="meta">Export: ${esc(exportedAt)} | Code: ${esc(plan.code || '-')}</p>
<h2>Informations generales</h2>
<div class="info-grid">
  <div class="info-item"><span class="info-label">Titre:</span> ${esc(plan.title || '-')}</div>
  <div class="info-item"><span class="info-label">Version:</span> ${esc(String(plan.version || 1))}</div>
  <div class="info-item"><span class="info-label">Statut:</span> <span class="badge badge-${esc(normalizeContingencyPlanStatus(plan.status))}">${esc(normalizeContingencyPlanStatus(plan.status))}</span></div>
  <div class="info-item"><span class="info-label">Criticite:</span> <span class="badge badge-${esc(normalizeContingencyCriticality(plan.criticality))}">${esc(normalizeContingencyCriticality(plan.criticality))}</span></div>
  <div class="info-item"><span class="info-label">Responsable:</span> ${esc(owner)}</div>
  <div class="info-item"><span class="info-label">Suppleant:</span> ${esc(backup)}</div>
  <div class="info-item"><span class="info-label">Service:</span> ${esc(service)}</div>
  <div class="info-item"><span class="info-label">Processus:</span> ${esc(process)}</div>
  <div class="info-item"><span class="info-label">Logiciel:</span> ${esc(software)}</div>
  <div class="info-item"><span class="info-label">Preparation:</span> ${esc(String(readiness))}%</div>
  <div class="info-item"><span class="info-label">Derniere revue:</span> ${esc(plan.lastReviewDate || '-')}</div>
  <div class="info-item"><span class="info-label">Dernier test:</span> ${esc(plan.lastTestDate || '-')}</div>
</div>
<h2>Description et perimetre</h2>
<p>${esc(plan.description || '-')}</p>
<p><strong>Perimetre:</strong> ${esc(plan.scope || '-')}</p>
<h2>Declencheurs</h2>
<p>${esc(plan.triggerConditions || '-')}</p>
<h2>Impacts</h2>
<p>${esc(plan.impacts || '-')}</p>
<h2>Actions de contingence (${actions.length})</h2>
<table><thead><tr><th>Ordre</th><th>Action</th><th>Responsable</th><th>Statut</th></tr></thead><tbody>
${actions.map((row)=>`<tr><td>${esc(String(row.order || '-'))}</td><td>${esc(row.title || '-')}</td><td>${esc(maps.agentById.get(row.ownerAgentId)?.displayName || '-')}</td><td>${esc(normalizeContingencyActionStatus(row.status))}</td></tr>`).join('') || '<tr><td colspan="4">Aucune action definie</td></tr>'}
</tbody></table>
<h2>Historique des activations (${activations.length})</h2>
<table><thead><tr><th>Date</th><th>Statut</th><th>Initiateur</th><th>Cloture</th></tr></thead><tbody>
${activations.map((row)=>`<tr><td>${esc(row.startedAt ? new Date(Number(row.startedAt)).toLocaleString('fr-FR') : '-')}</td><td>${esc(normalizeContingencyActivationStatus(row.status))}</td><td>${esc(String(row.initiatorUserId || '-'))}</td><td>${esc(row.closedAt ? new Date(Number(row.closedAt)).toLocaleString('fr-FR') : '-')}</td></tr>`).join('') || '<tr><td colspan="4">Aucune activation</td></tr>'}
</tbody></table>
<h2>Exercices et tests (${exercises.length})</h2>
<table><thead><tr><th>Date</th><th>Resultat</th><th>Notes</th></tr></thead><tbody>
${exercises.map((row)=>`<tr><td>${esc(row.exerciseDate || '-')}</td><td>${esc(normalizeContingencyExerciseResult(row.result))}</td><td>${esc(row.notes || row.findings || '-')}</td></tr>`).join('') || '<tr><td colspan="3">Aucun exercice</td></tr>'}
</tbody></table>
<h2>Revues periodiques (${reviews.length})</h2>
<table><thead><tr><th>Date</th><th>Prochaine revue</th><th>Constats</th></tr></thead><tbody>
${reviews.map((row)=>`<tr><td>${esc(row.reviewDate || '-')}</td><td>${esc(row.nextReviewDate || '-')}</td><td>${esc(row.findings || '-')}</td></tr>`).join('') || '<tr><td colspan="3">Aucune revue</td></tr>'}
</tbody></table>
<script>window.addEventListener('load',()=>setTimeout(()=>{window.print();},220));</script>
</body></html>`;
      printSheetHtml(html);
    }

    function exportContingencyPlanCsv(planId) {
      const plan = (state.collections.contingencyPlans || []).find((row) => String(row.id) === String(planId || ''));
      if (!plan) return;
      const maps = getMaps();
      const actions = (state.collections.contingencyActions || [])
        .filter((row) => String(row.planId) === String(planId))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const activations = (state.collections.contingencyActivations || [])
        .filter((row) => String(row.planId) === String(planId))
        .sort((a, b) => Number(b.startedAt || 0) - Number(a.startedAt || 0));
      const exercises = (state.collections.contingencyExercises || [])
        .filter((row) => String(row.planId) === String(planId))
        .sort((a, b) => String(b.exerciseDate || '').localeCompare(String(a.exerciseDate || '')));
      const reviews = (state.collections.contingencyReviews || [])
        .filter((row) => String(row.planId) === String(planId))
        .sort((a, b) => String(b.reviewDate || '').localeCompare(String(a.reviewDate || '')));
      const readiness = computeContingencyPlanReadiness(plan);
      const owner = maps.agentById.get(plan.ownerAgentId)?.displayName || '-';
      const backup = maps.agentById.get(plan.backupAgentId)?.displayName || '-';
      const service = maps.serviceById.get(plan.serviceId)?.name || '-';
      const csvEsc = (val) => {
        const str = String(val || '').replace(/"/g, '""');
        return `"${str}"`;
      };
      const lines = [];
      lines.push('PLAN DE CONTINGENCE - EXPORT CSV');
      lines.push('');
      lines.push('INFORMATIONS GENERALES');
      lines.push(`Titre,${csvEsc(plan.title)}`);
      lines.push(`Code,${csvEsc(plan.code)}`);
      lines.push(`Version,${csvEsc(plan.version || 1)}`);
      lines.push(`Statut,${csvEsc(normalizeContingencyPlanStatus(plan.status))}`);
      lines.push(`Criticite,${csvEsc(normalizeContingencyCriticality(plan.criticality))}`);
      lines.push(`Responsable,${csvEsc(owner)}`);
      lines.push(`Suppleant,${csvEsc(backup)}`);
      lines.push(`Service,${csvEsc(service)}`);
      lines.push(`Preparation,${csvEsc(readiness)}%`);
      lines.push(`Derniere revue,${csvEsc(plan.lastReviewDate || '-')}`);
      lines.push(`Dernier test,${csvEsc(plan.lastTestDate || '-')}`);
      lines.push(`Description,${csvEsc(plan.description)}`);
      lines.push(`Declencheurs,${csvEsc(plan.triggerConditions)}`);
      lines.push(`Impacts,${csvEsc(plan.impacts)}`);
      lines.push('');
      lines.push('ACTIONS DE CONTINGENCE');
      lines.push('Ordre,Action,Responsable,Statut');
      actions.forEach((row) => {
        lines.push(`${csvEsc(row.order)},${csvEsc(row.title)},${csvEsc(maps.agentById.get(row.ownerAgentId)?.displayName || '-')},${csvEsc(normalizeContingencyActionStatus(row.status))}`);
      });
      lines.push('');
      lines.push('ACTIVATIONS');
      lines.push('Date debut,Statut,Initiateur,Date cloture');
      activations.forEach((row) => {
        lines.push(`${csvEsc(row.startedAt ? new Date(Number(row.startedAt)).toLocaleString('fr-FR') : '-')},${csvEsc(normalizeContingencyActivationStatus(row.status))},${csvEsc(row.initiatorUserId)},${csvEsc(row.closedAt ? new Date(Number(row.closedAt)).toLocaleString('fr-FR') : '-')}`);
      });
      lines.push('');
      lines.push('EXERCICES');
      lines.push('Date,Resultat,Notes');
      exercises.forEach((row) => {
        lines.push(`${csvEsc(row.exerciseDate)},${csvEsc(normalizeContingencyExerciseResult(row.result))},${csvEsc(row.notes || row.findings)}`);
      });
      lines.push('');
      lines.push('REVUES');
      lines.push('Date,Prochaine revue,Constats');
      reviews.forEach((row) => {
        lines.push(`${csvEsc(row.reviewDate)},${csvEsc(row.nextReviewDate)},${csvEsc(row.findings)}`);
      });
      const csv = lines.join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plan-contingence-${String(plan.code || plan.id || 'export')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast('Export CSV genere');
    }

    async function syncWorkflowSoftwareWithLatestVersion(softwareId) {
      const software = (state.collections.software || []).find((row) => String(row.id) === String(softwareId || ''));
      if (!software) return false;
      const latest = getLatestSoftwareVersionEntry(software);
      if (!latest) {
        toast('Aucune version trouvee dans le referentiel');
        return false;
      }
      const updated = {
        ...software,
        metadata: {
          ...(software.metadata || {}),
          softwareVersionRefId: String(latest.softwareId || '').trim() || null,
          softwareVersion: String(latest.version || '').trim() || null,
          softwareVersionUpdatedAt: Number(latest.updatedAt || latest.createdAt || now()) || now(),
          softwareVersionNotes: String(latest.notes || '').trim()
        },
        updatedAt: now()
      };
      await api.put('workflowSoftware', updated, STORE_KEY_FIELDS.workflowSoftware);
      await logAudit('software_sync_version_registry', 'software', software.id, {
        softwareName: software.name || software.id,
        version: latest.version || '',
        versionRefId: latest.softwareId || ''
      });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      openDetail('software', software.id);
      toast(`Version synchronisee: ${latest.version || '-'}`);
      return true;
    }

    function getCurrentUserWorkflowRoleIds() {
      const currentId = String(currentUserId() || '').trim();
      if (!currentId) return [];
      const agents = (state.collections.agents || []).filter((agent) => String(agent?.metadata?.userId || '').trim() === currentId);
      if (!agents.length) return [];
      const roleIds = new Set();
      agents.forEach((agent) => {
        (Array.isArray(agent.roleIds) ? agent.roleIds : []).forEach((roleId) => {
          const safe = String(roleId || '').trim();
          if (safe) roleIds.add(safe);
        });
        (state.collections.roles || []).forEach((role) => {
          if (String(role.serviceId || '') !== String(agent.serviceId || '')) return;
          const hints = Array.isArray(role.permissionHints) ? role.permissionHints.map((hint) => normalize(hint)) : [];
          const roleName = normalize(role.name || '');
          const canApprove = hints.includes('approver')
            || hints.includes('workflow_approver')
            || hints.includes('validator')
            || roleName.includes('approb')
            || roleName.includes('valid');
          if (canApprove) roleIds.add(String(role.id || '').trim());
        });
      });
      return Array.from(roleIds).filter(Boolean);
    }

    function serializeGovernanceDataset() {
      const processes = (state.collections.processes || []).map((process) => {
        const validation = normalizeProcessValidation(process?.validation);
        return {
          processId: process.id || '',
          title: process.title || '',
          status: process.status || 'draft',
          serviceId: process.serviceId || '',
          ownerAgentId: process.ownerAgentId || '',
          requiredLevels: validation.requiredLevels,
          approvedLevel: validation.level,
          requiredRoleIds: validation.requiredRoleIds,
          mode: validation.mode,
          levelRules: validation.levelRules,
          approverCount: Array.isArray(validation.approvers) ? validation.approvers.length : 0,
          updatedAt: Number(process.updatedAt || process.createdAt || 0) || 0
        };
      });
      const permissions = {
        assignments: Array.isArray(state.collections.permissionAssignments) ? state.collections.permissionAssignments : [],
        requests: Array.isArray(state.collections.permissionRequests) ? state.collections.permissionRequests : [],
        reviews: Array.isArray(state.collections.permissionReviews) ? state.collections.permissionReviews : []
      };
      return {
        exportedAt: Date.now(),
        processes,
        permissions,
        metrics: Array.isArray(state.collections.metrics) ? state.collections.metrics : []
      };
    }

    function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function exportGovernanceJson() {
      const dataset = serializeGovernanceDataset();
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      downloadTextFile(`workflow-governance-${ts}.json`, JSON.stringify(dataset, null, 2), 'application/json;charset=utf-8');
      toast('Export gouvernance JSON genere');
    }

    function exportGovernanceCsv() {
      const dataset = serializeGovernanceDataset();
      const rows = [
        ['kind', 'id', 'title', 'status', 'serviceId', 'ownerAgentId', 'requiredLevels', 'approvedLevel', 'mode', 'requiredRoleIds', 'levelRules', 'approverCount', 'updatedAt']
      ];
      dataset.processes.forEach((row) => {
        rows.push([
          'process',
          row.processId,
          row.title,
          row.status,
          row.serviceId,
          row.ownerAgentId,
          String(row.requiredLevels),
          String(row.approvedLevel),
          row.mode || 'level',
          (row.requiredRoleIds || []).join('|'),
          JSON.stringify(row.levelRules || []),
          String(row.approverCount),
          row.updatedAt ? new Date(row.updatedAt).toISOString() : ''
        ]);
      });
      (dataset.permissions?.assignments || []).forEach((row) => {
        rows.push([
          'permission_assignment',
          String(row.id || ''),
          String(row.profileName || row.profileId || ''),
          normalizePermissionStatus(row.status),
          String(row.softwareId || ''),
          String(row.beneficiaryId || ''),
          '',
          '',
          '',
          String(row.beneficiaryType || ''),
          '',
          '',
          Number(row.updatedAt || row.createdAt || 0) ? new Date(Number(row.updatedAt || row.createdAt || 0)).toISOString() : ''
        ]);
      });
      (dataset.permissions?.requests || []).forEach((row) => {
        rows.push([
          'permission_request',
          String(row.id || ''),
          String(row.profileName || row.profileId || ''),
          normalizePermissionRequestStatus(row.status),
          String(row.softwareId || ''),
          String(row.beneficiaryId || ''),
          '',
          '',
          String(row.action || ''),
          String(row.beneficiaryType || ''),
          '',
          '',
          Number(row.updatedAt || row.requestedAt || row.createdAt || 0) ? new Date(Number(row.updatedAt || row.requestedAt || row.createdAt || 0)).toISOString() : ''
        ]);
      });
      (dataset.permissions?.reviews || []).forEach((row) => {
        rows.push([
          'permission_review',
          String(row.id || ''),
          String(row.assignmentId || ''),
          normalizePermissionReviewDecision(row.decision),
          String(row.softwareId || ''),
          String(row.reviewerUserId || ''),
          '',
          '',
          '',
          '',
          String(row.reviewDate || ''),
          '',
          Number(row.updatedAt || row.createdAt || 0) ? new Date(Number(row.updatedAt || row.createdAt || 0)).toISOString() : ''
        ]);
      });
      const csv = rows.map((cols) => cols.map((value) => {
        const safe = String(value ?? '');
        return `"${safe.replace(/"/g, '""')}"`;
      }).join(';')).join('\n');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      downloadTextFile(`workflow-governance-${ts}.csv`, csv, 'text/csv;charset=utf-8');
      toast('Export gouvernance CSV genere');
    }

    function getGovernancePermissionFilterState() {
      return {
        softwareId: String(state.governancePermissionSoftwareFilter || 'all'),
        beneficiaryType: String(state.governancePermissionBeneficiaryTypeFilter || 'all'),
        requestStatus: String(state.governancePermissionRequestStatusFilter || 'all')
      };
    }

    function matchesGovernancePermissionFilters(row, filters, kind = 'assignment') {
      const safeRow = row || {};
      const safeFilters = filters || getGovernancePermissionFilterState();
      if (safeFilters.softwareId && safeFilters.softwareId !== 'all' && String(safeRow.softwareId || '') !== safeFilters.softwareId) {
        return false;
      }
      if (safeFilters.beneficiaryType && safeFilters.beneficiaryType !== 'all') {
        let rowType = normalizePermissionBeneficiaryType(safeRow.beneficiaryType);
        if (kind === 'review') {
          const assignmentId = String(safeRow.assignmentId || '').trim();
          const assignment = (state.collections.permissionAssignments || []).find((entry) => String(entry.id || '') === assignmentId);
          if (assignment) rowType = normalizePermissionBeneficiaryType(assignment.beneficiaryType);
        }
        if (rowType !== safeFilters.beneficiaryType) return false;
      }
      if (kind === 'request' && safeFilters.requestStatus && safeFilters.requestStatus !== 'all') {
        const rowStatus = normalizePermissionRequestStatus(safeRow.status);
        if (rowStatus !== safeFilters.requestStatus) return false;
      }
      return true;
    }

    function exportPermissionMatrixCsv() {
      const filters = getGovernancePermissionFilterState();
      const assignments = (state.collections.permissionAssignments || []).filter((row) => matchesGovernancePermissionFilters(row, filters, 'assignment'));
      const requests = (state.collections.permissionRequests || []).filter((row) => matchesGovernancePermissionFilters(row, filters, 'request'));
      const reviews = (state.collections.permissionReviews || []).filter((row) => matchesGovernancePermissionFilters(row, filters, 'review'));

      const softwareById = new Map((state.collections.software || []).map((row) => [String(row.id || ''), row]));
      const rows = [[
        'softwareId',
        'softwareName',
        'activeAssignments',
        'reviewDueAssignments',
        'expiredAssignments',
        'revokedAssignments',
        'submittedRequests',
        'approvedRequests',
        'pendingReviews'
      ]];

      const matrixBySoftware = new Map();
      function ensure(softwareId) {
        const sid = String(softwareId || '').trim();
        if (!matrixBySoftware.has(sid)) {
          matrixBySoftware.set(sid, {
            softwareId: sid,
            softwareName: softwareById.get(sid)?.name || sid || 'Logiciel non reference',
            activeAssignments: 0,
            reviewDueAssignments: 0,
            expiredAssignments: 0,
            revokedAssignments: 0,
            submittedRequests: 0,
            approvedRequests: 0,
            pendingReviews: 0
          });
        }
        return matrixBySoftware.get(sid);
      }

      const today = todayIsoDate();
      assignments.forEach((row) => {
        const bucket = ensure(row.softwareId);
        const status = normalizePermissionStatus(row.status);
        if (status === 'active') bucket.activeAssignments += 1;
        if (status === 'review_due') bucket.reviewDueAssignments += 1;
        if (status === 'revoked') bucket.revokedAssignments += 1;
        const endDate = normalizeIsoDate(row.endDate || '');
        if (endDate && endDate < today && status !== 'revoked') bucket.expiredAssignments += 1;
      });
      requests.forEach((row) => {
        const bucket = ensure(row.softwareId);
        const status = normalizePermissionRequestStatus(row.status);
        if (status === 'submitted') bucket.submittedRequests += 1;
        if (status === 'approved') bucket.approvedRequests += 1;
      });
      reviews.forEach((row) => {
        const bucket = ensure(row.softwareId);
        if (normalizePermissionReviewDecision(row.decision) === 'pending') bucket.pendingReviews += 1;
      });

      Array.from(matrixBySoftware.values())
        .sort((a, b) => String(a.softwareName || '').localeCompare(String(b.softwareName || ''), 'fr'))
        .forEach((row) => {
          rows.push([
            row.softwareId,
            row.softwareName,
            String(row.activeAssignments),
            String(row.reviewDueAssignments),
            String(row.expiredAssignments),
            String(row.revokedAssignments),
            String(row.submittedRequests),
            String(row.approvedRequests),
            String(row.pendingReviews)
          ]);
        });

      const csv = rows.map((cols) => cols.map((value) => {
        const safe = String(value ?? '');
        return `"${safe.replace(/"/g, '""')}"`;
      }).join(';')).join('\n');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      downloadTextFile(`workflow-permissions-matrix-${ts}.csv`, csv, 'text/csv;charset=utf-8');
      toast('Export matrice habilitations CSV genere');
    }

    function serializeWorkflowModelDataset() {
      return {
        exportedAt: Date.now(),
        schemaVersion: 2,
        communities: Array.isArray(state.collections.communities) ? state.collections.communities : [],
        services: Array.isArray(state.collections.services) ? state.collections.services : [],
        groups: Array.isArray(state.collections.groups) ? state.collections.groups : [],
        agents: Array.isArray(state.collections.agents) ? state.collections.agents : [],
        roles: Array.isArray(state.collections.roles) ? state.collections.roles : [],
        processes: Array.isArray(state.collections.processes) ? state.collections.processes : [],
        steps: Array.isArray(state.collections.steps) ? state.collections.steps : [],
        flows: Array.isArray(state.collections.flows) ? state.collections.flows : [],
        templates: Array.isArray(state.collections.templates) ? state.collections.templates : [],
        tasks: Array.isArray(state.collections.tasks) ? state.collections.tasks : [],
        procedures: Array.isArray(state.collections.procedures) ? state.collections.procedures : [],
        software: Array.isArray(state.collections.software) ? state.collections.software : [],
        metrics: Array.isArray(state.collections.metrics) ? state.collections.metrics : []
      };
    }

    function exportWorkflowModelJson() {
      const dataset = serializeWorkflowModelDataset();
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      downloadTextFile(`workflow-model-${ts}.json`, JSON.stringify(dataset, null, 2), 'application/json;charset=utf-8');
      toast('Export modele workflow JSON genere');
    }

    function exportWorkflowSynthesisCsv() {
      const maps = getMaps();
      const rows = [
        ['processId', 'processTitle', 'service', 'owner', 'status', 'stepCount', 'flowCount', 'taskCount', 'unassignedStepCount', 'softwareCount', 'approvalLevel', 'approvalRequiredLevels', 'updatedAt']
      ];
      (state.collections.processes || []).forEach((process) => {
        const pid = String(process.id || '');
        const processSteps = (state.collections.steps || []).filter((step) => String(step.processId || '') === pid);
        const processFlows = (state.collections.flows || []).filter((flow) => String(flow.processId || '') === pid);
        const processTasks = (state.collections.tasks || []).filter((task) => String(task.processId || '') === pid);
        const unassignedStepCount = processSteps.filter((step) => !step.ownerAgentId && !step.roleId).length;
        const softwareIds = new Set();
        processSteps.forEach((step) => {
          (Array.isArray(step.linkedSoftwareIds) ? step.linkedSoftwareIds : []).forEach((softwareId) => {
            const safe = String(softwareId || '').trim();
            if (safe) softwareIds.add(safe);
          });
        });
        const validation = normalizeProcessValidation(process?.validation);
        rows.push([
          pid,
          process.title || '',
          maps.serviceById.get(process.serviceId)?.name || process.serviceId || '',
          maps.agentById.get(process.ownerAgentId)?.displayName || process.ownerAgentId || '',
          process.status || 'draft',
          String(processSteps.length),
          String(processFlows.length),
          String(processTasks.length),
          String(unassignedStepCount),
          String(softwareIds.size),
          String(validation.level || 0),
          String(validation.requiredLevels || 0),
          process.updatedAt ? new Date(process.updatedAt).toISOString() : ''
        ]);
      });
      const csv = rows.map((cols) => cols.map((value) => {
        const safe = String(value ?? '');
        return `"${safe.replace(/"/g, '""')}"`;
      }).join(';')).join('\n');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      downloadTextFile(`workflow-synthesis-${ts}.csv`, csv, 'text/csv;charset=utf-8');
      toast('Export synthese workflow CSV genere');
    }

    async function transitionTemplateStatus(templateId, action) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: action reservee au role admin ou manager workflow');
        return;
      }
      const template = state.collections.templates.find((row) => String(row.id) === String(templateId || ''));
      if (!template) return;
      const current = { ...template };
      const next = { ...template, updatedAt: now() };
      if (action === 'publish') next.status = 'published';
      else if (action === 'archive') next.status = 'archived';
      else if (action === 'unarchive') next.status = 'draft';
      else return;

      if (String(next.status || '') !== String(current.status || '')) {
        const nextVersion = Number(next.version || 1) + 1;
        const history = Array.isArray(next?.metadata?.versionHistory) ? next.metadata.versionHistory.slice(-20) : [];
        history.push({
          version: nextVersion,
          updatedAt: next.updatedAt,
          byUserId: currentUserId(),
          reason: `status_${action}`
        });
        next.version = nextVersion;
        next.metadata = {
          ...(next.metadata || {}),
          versionHistory: history
        };
      }

      await api.put('workflowProcessTemplates', next, STORE_KEY_FIELDS.workflowProcessTemplates);
      await logHistory('update', 'template', next.id, current, next, `template_${action}`, ['status', 'version']);
      await logAudit(`template_${action}`, 'template', next.id, { status: next.status, version: next.version });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      if (state.selectedType === 'template' && String(state.selectedId || '') === String(next.id)) {
        openDetail('template', next.id);
      }
      toast(`Modele ${action === 'publish' ? 'publie' : action === 'archive' ? 'archive' : 'reactive'}`);
    }

    async function transitionProcessValidation(processId, action) {
      const process = state.collections.processes.find((row) => String(row.id) === String(processId || ''));
      if (!process) return;
      const needsValidationRights = action === 'approve_level' || action === 'reject';
      if (action === 'submit_review' && !canEditWorkflow()) {
        toast('Lecture seule: soumission reservee au role admin ou manager workflow');
        return;
      }
      if (needsValidationRights && !canValidateWorkflow(process)) {
        toast('Validation reservee aux profils habilites');
        return;
      }
      const current = { ...process };
      const next = { ...process, updatedAt: now() };
      const validation = normalizeProcessValidation(process?.validation);

      if (action === 'submit_review') {
        next.status = 'review';
      } else if (action === 'approve_level') {
        const nextTargetLevel = Math.max(1, Math.min(validation.requiredLevels, validation.level + 1));
        const levelRule = validation.levelRules[nextTargetLevel - 1] || { level: nextTargetLevel, requiredRoleIds: validation.requiredRoleIds.slice(), quorum: 1 };
        const requiredRoles = Array.isArray(levelRule.requiredRoleIds) ? levelRule.requiredRoleIds : [];
        const quorum = Math.max(1, Number(levelRule.quorum || 1) || 1);
        const currentRoles = getCurrentUserWorkflowRoleIds();
        const currentUser = currentUserId();
        const alreadyApproved = validation.approvers.some((entry) => Number(entry?.level || 0) === nextTargetLevel && String(entry?.byUserId || '') === String(currentUser || ''));
        if (alreadyApproved) {
          toast('Cet utilisateur a deja approuve ce niveau');
          return;
        }
        if (validation.mode === 'sequential' && nextTargetLevel > 1 && !state.permissions.isAdmin) {
          const previousRule = validation.levelRules[nextTargetLevel - 2] || { quorum: 1 };
          const previousQuorum = Math.max(1, Number(previousRule.quorum || 1) || 1);
          const previousCount = validation.approvers.filter((entry) => Number(entry?.level || 0) === (nextTargetLevel - 1)).length;
          if (previousCount < previousQuorum) {
            toast(`Validation sequentielle: niveau ${nextTargetLevel - 1} incomplet`);
            return;
          }
        }
        let approvalRoleId = currentRoles[0] || null;
        if (requiredRoles.length > 0 && !state.permissions.isAdmin) {
          const intersection = currentRoles.filter((roleId) => requiredRoles.includes(roleId));
          if (intersection.length === 0) {
            toast('Approbation refusee: role approbateur requis');
            return;
          }
          approvalRoleId = intersection[0];
        }
        validation.approvers.push({
          level: nextTargetLevel,
          byUserId: currentUser,
          roleId: approvalRoleId,
          at: now()
        });
        const levelApprovalCount = validation.approvers.filter((entry) => Number(entry?.level || 0) === nextTargetLevel).length;
        if (levelApprovalCount >= quorum) {
          validation.level = Math.max(validation.level, nextTargetLevel);
        }
        if (validation.level >= validation.requiredLevels) {
          next.status = 'published';
        } else {
          next.status = 'review';
        }
      } else if (action === 'reject') {
        next.status = 'draft';
        validation.level = 0;
        validation.approvers = [];
      }

      next.validation = validation;
      await api.put('workflowProcesses', next, STORE_KEY_FIELDS.workflowProcesses);
      await logHistory('update', 'process', next.id, current, next, `process_${action}`, ['status', 'validation']);
      await logAudit(`process_${action}`, 'process', next.id, { status: next.status, validation: next.validation });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      openDetail('process', next.id);
      toast(`Processus mis a jour: ${next.status}`);
    }

    function canEditWorkflow() {
      const admin = typeof api.canEditWorkflow === 'function' ? !!api.canEditWorkflow() : state.permissions.isAdmin;
      return !!(admin || state.permissions.isWorkflowManager);
    }

    function isWorkflowItemLocked(type, id) {
      if (typeof api.isResourceLocked !== 'function') return false;
      return api.isResourceLocked(type, id);
    }

    function canValidateWorkflow(process) {
      if (state.permissions.isAdmin || state.permissions.isWorkflowManager) return true;
      const currentRoles = getCurrentUserWorkflowRoleIds();
      if (!currentRoles.length) return false;
      if (!process) return true;
      const validation = normalizeProcessValidation(process?.validation);
      const nextTargetLevel = Math.max(1, Math.min(validation.requiredLevels, validation.level + 1));
      const levelRule = validation.levelRules[nextTargetLevel - 1] || { requiredRoleIds: validation.requiredRoleIds.slice() };
      const requiredRoles = Array.isArray(levelRule.requiredRoleIds) ? levelRule.requiredRoleIds : [];
      if (!requiredRoles.length) return true;
      return currentRoles.some((roleId) => requiredRoles.includes(roleId));
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
      let safe = viewIds[nextView] ? nextView : 'organigram';
      const requestedBtn = document.getElementById(viewIds[safe] || '');
      if (requestedBtn && requestedBtn.classList.contains('hidden')) {
        const fallbackEntry = Object.entries(viewIds).find(([, id]) => {
          const btn = document.getElementById(id);
          return !!(btn && !btn.classList.contains('hidden'));
        });
        safe = fallbackEntry ? fallbackEntry[0] : safe;
      }
      state.activeView = safe;
      const resolvedGroup = groupForView(safe);
      state.activeGroup = resolvedGroup;
      state.lastViewByGroup[resolvedGroup] = safe;
      Object.entries(viewIds).forEach(([key, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('is-active', key === safe);
      });
      updateGroupTabsUI(resolvedGroup);
      persistLayout().catch(() => null);
      updateToolbarVisibility();
      render();
    }

    function setGroup(groupKey) {
      const grp = WORKFLOW_GROUPS[groupKey];
      if (!grp) return;
      const lastView = state.lastViewByGroup[groupKey] || grp.defaultView;
      setView(lastView);
    }

    function updateToolbarVisibility() {
      const quickAdd = refs.quickAdd || document.querySelector('#global-workflow-section .workflow-quick-add');
      if (quickAdd) {
        const hideInAdd = ['supervision'];
        quickAdd.classList.toggle('hidden', hideInAdd.includes(state.activeGroup));
      }
      filterQuickAddByGroup(state.activeGroup);
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
      const [communities, services, groups, agents, roles, processes, steps, flows, templates, metrics, users, directoryUsers, tasks, procedures, software, permissionProfiles, permissionAssignments, permissionRequests, permissionReviews, permissionAudit, contingencyPlans, contingencyActions, contingencyActivations, contingencyExercises, contingencyReviews, contingencyAudit, softwareVersions, audit, history, globalTasks, globalDocs, globalThemes, globalGroups] = await Promise.all([
        api.getAll('workflowCommunities', STORE_KEY_FIELDS.workflowCommunities),
        api.getAll('workflowServices', STORE_KEY_FIELDS.workflowServices),
        api.getAll('workflowGroups', STORE_KEY_FIELDS.workflowGroups),
        api.getAll('workflowAgents', STORE_KEY_FIELDS.workflowAgents),
        api.getAll('workflowRoles', STORE_KEY_FIELDS.workflowRoles),
        api.getAll('workflowProcesses', STORE_KEY_FIELDS.workflowProcesses),
        api.getAll('workflowProcessSteps', STORE_KEY_FIELDS.workflowProcessSteps),
        api.getAll('workflowFlows', STORE_KEY_FIELDS.workflowFlows),
        api.getAll('workflowProcessTemplates', STORE_KEY_FIELDS.workflowProcessTemplates),
        api.getAll('workflowMetrics', STORE_KEY_FIELDS.workflowMetrics),
        api.getAll('users', 'userId'),
        api.getAll('directoryUsers', 'userId'),
        api.getAll('workflowTasks', STORE_KEY_FIELDS.workflowTasks),
        api.getAll('workflowProcedures', STORE_KEY_FIELDS.workflowProcedures),
        api.getAll('workflowSoftware', STORE_KEY_FIELDS.workflowSoftware),
        api.getAll('workflowPermissionProfiles', STORE_KEY_FIELDS.workflowPermissionProfiles),
        api.getAll('workflowPermissionAssignments', STORE_KEY_FIELDS.workflowPermissionAssignments),
        api.getAll('workflowPermissionRequests', STORE_KEY_FIELDS.workflowPermissionRequests),
        api.getAll('workflowPermissionReviews', STORE_KEY_FIELDS.workflowPermissionReviews),
        api.getAll('workflowPermissionAudit', STORE_KEY_FIELDS.workflowPermissionAudit),
        api.getAll('workflowContingencyPlans', STORE_KEY_FIELDS.workflowContingencyPlans),
        api.getAll('workflowContingencyActions', STORE_KEY_FIELDS.workflowContingencyActions),
        api.getAll('workflowContingencyActivations', STORE_KEY_FIELDS.workflowContingencyActivations),
        api.getAll('workflowContingencyExercises', STORE_KEY_FIELDS.workflowContingencyExercises),
        api.getAll('workflowContingencyReviews', STORE_KEY_FIELDS.workflowContingencyReviews),
        api.getAll('workflowContingencyAudit', STORE_KEY_FIELDS.workflowContingencyAudit),
        typeof api.getSoftwareVersionCatalog === 'function' ? api.getSoftwareVersionCatalog() : Promise.resolve([]),
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
      state.collections.roles = Array.isArray(roles) ? roles : [];
      state.collections.processes = Array.isArray(processes) ? processes : [];
      state.collections.steps = Array.isArray(steps) ? steps : [];
      state.collections.flows = Array.isArray(flows) ? flows : [];
      state.collections.templates = Array.isArray(templates) ? templates : [];
      state.collections.metrics = Array.isArray(metrics) ? metrics : [];
      state.collections.users = Array.isArray(users) ? users : [];
      state.collections.directoryUsers = Array.isArray(directoryUsers) ? directoryUsers : [];
      state.collections.tasks = Array.isArray(tasks) ? tasks : [];
      state.collections.procedures = Array.isArray(procedures) ? procedures : [];
      state.collections.software = Array.isArray(software) ? software : [];
      state.collections.permissionProfiles = Array.isArray(permissionProfiles) ? permissionProfiles : [];
      state.collections.permissionAssignments = Array.isArray(permissionAssignments) ? permissionAssignments : [];
      state.collections.permissionRequests = Array.isArray(permissionRequests) ? permissionRequests : [];
      state.collections.permissionReviews = Array.isArray(permissionReviews) ? permissionReviews : [];
      state.collections.permissionAudit = Array.isArray(permissionAudit) ? permissionAudit : [];
      state.collections.contingencyPlans = Array.isArray(contingencyPlans) ? contingencyPlans : [];
      state.collections.contingencyActions = Array.isArray(contingencyActions) ? contingencyActions : [];
      state.collections.contingencyActivations = Array.isArray(contingencyActivations) ? contingencyActivations : [];
      state.collections.contingencyExercises = Array.isArray(contingencyExercises) ? contingencyExercises : [];
      state.collections.contingencyReviews = Array.isArray(contingencyReviews) ? contingencyReviews : [];
      state.collections.contingencyAudit = Array.isArray(contingencyAudit) ? contingencyAudit : [];
      state.collections.softwareVersions = Array.isArray(softwareVersions) ? softwareVersions : [];
      state.collections.audit = Array.isArray(audit) ? audit : [];
      state.collections.history = Array.isArray(history) ? history : [];
      state.collections.globalTasks = Array.isArray(globalTasks) ? globalTasks : [];
      state.collections.globalDocs = Array.isArray(globalDocs) ? globalDocs : [];
      state.collections.globalThemes = Array.isArray(globalThemes) ? globalThemes : [];
      state.collections.globalGroups = Array.isArray(globalGroups) ? globalGroups : [];
      await runAutomaticPermissionReviews();
      resolveWorkflowPermissions();
    }

    function getMatchedSoftwareVersionEntries(softwareItem) {
      const name = normalize(softwareItem?.name || '');
      if (!name) return [];
      const compactName = name.replace(/[^a-z0-9]/g, '');
      return (state.collections.softwareVersions || [])
        .filter((entry) => {
          const entryName = normalize(entry?.softwareName || '');
          if (!entryName) return false;
          if (entryName === name) return true;
          const compactEntry = entryName.replace(/[^a-z0-9]/g, '');
          if (!compactEntry || !compactName) return false;
          if (compactEntry === compactName) return true;
          if (compactEntry.length >= 5 && compactName.includes(compactEntry)) return true;
          if (compactName.length >= 5 && compactEntry.includes(compactName)) return true;
          return false;
        })
        .slice()
        .sort((a, b) => Number(b?.updatedAt || b?.createdAt || 0) - Number(a?.updatedAt || a?.createdAt || 0));
    }

    function getLatestSoftwareVersionEntry(softwareItem) {
      return getMatchedSoftwareVersionEntries(softwareItem)[0] || null;
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

    function normalizePermissionBeneficiaryType(value) {
      const key = String(value || '').trim().toLowerCase();
      return ['agent', 'user', 'group', 'role'].includes(key) ? key : 'agent';
    }

    function normalizePermissionStatus(value) {
      const key = String(value || '').trim().toLowerCase();
      return PERMISSION_STATUS_OPTIONS.includes(key) ? key : 'active';
    }

    function normalizePermissionLevel(value) {
      const key = String(value || '').trim().toLowerCase();
      return PERMISSION_LEVEL_OPTIONS.includes(key) ? key : 'read';
    }

    function normalizePermissionRequestAction(value) {
      const key = String(value || '').trim().toLowerCase();
      return PERMISSION_REQUEST_ACTIONS.includes(key) ? key : 'grant';
    }

    function normalizePermissionRequestStatus(value) {
      const key = String(value || '').trim().toLowerCase();
      return PERMISSION_REQUEST_STATUS.includes(key) ? key : 'draft';
    }

    function permissionRequestActionLabel(value) {
      const key = normalizePermissionRequestAction(value);
      if (key === 'grant') return 'Octroi';
      if (key === 'update') return 'Modification';
      if (key === 'revoke') return 'Retrait';
      return key;
    }

    function permissionRequestStatusLabel(value) {
      const key = normalizePermissionRequestStatus(value);
      if (key === 'draft') return 'Brouillon';
      if (key === 'submitted') return 'Soumise';
      if (key === 'approved') return 'Approuvee';
      if (key === 'rejected') return 'Refusee';
      if (key === 'executed') return 'Executee';
      return key;
    }

    function normalizePermissionReviewDecision(value) {
      const key = String(value || '').trim().toLowerCase();
      return PERMISSION_REVIEW_DECISIONS.includes(key) ? key : 'pending';
    }

    function getPermissionRequestTransitions(status) {
      const current = normalizePermissionRequestStatus(status);
      if (current === 'draft') return ['submit'];
      if (current === 'submitted') return ['approve', 'reject'];
      if (current === 'approved') return ['execute', 'reject'];
      return [];
    }

    function normalizeIsoDate(value) {
      const raw = String(value || '').trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
    }

    function normalizeContingencyPlanStatus(value) {
      const key = String(value || '').trim().toLowerCase();
      return CONTINGENCY_PLAN_STATUS.includes(key) ? key : 'draft';
    }

    function normalizeContingencyCriticality(value) {
      const key = String(value || '').trim().toLowerCase();
      return CONTINGENCY_PLAN_CRITICALITY.includes(key) ? key : 'medium';
    }

    function normalizeContingencyActionStatus(value) {
      const key = String(value || '').trim().toLowerCase();
      return CONTINGENCY_ACTION_STATUS.includes(key) ? key : 'todo';
    }

    function normalizeContingencyActivationStatus(value) {
      const key = String(value || '').trim().toLowerCase();
      return CONTINGENCY_ACTIVATION_STATUS.includes(key) ? key : 'active';
    }

    function normalizeContingencyExerciseResult(value) {
      const key = String(value || '').trim().toLowerCase();
      return CONTINGENCY_EXERCISE_RESULT.includes(key) ? key : 'pending';
    }

    function computeContingencyPlanReadiness(plan) {
      const planId = String(plan?.id || '').trim();
      if (!planId) return 0;
      const actions = (state.collections.contingencyActions || []).filter((row) => String(row.planId || '') === planId);
      if (!actions.length) return 0;
      const done = actions.filter((row) => normalizeContingencyActionStatus(row.status) === 'done').length;
      return Math.round((done / actions.length) * 100);
    }

    async function logContingencyAudit(eventType, planId, payload = {}) {
      const row = {
        id: `wf-cont-audit-${uid()}`,
        planId: String(planId || '').trim() || null,
        eventType: String(eventType || '').trim() || 'update',
        byUserId: currentUserId(),
        payload: payload || null,
        createdAt: now()
      };
      await api.put('workflowContingencyAudit', row, STORE_KEY_FIELDS.workflowContingencyAudit);
    }

    async function activateContingencyPlan(planId) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: edition reservee au role admin ou manager workflow');
        return;
      }
      const safePlanId = String(planId || '').trim();
      if (!safePlanId) return;
      const plan = (state.collections.contingencyPlans || []).find((row) => String(row.id || '') === safePlanId);
      if (!plan) return;
      const activationId = `wf-cont-activation-${uid()}`;
      const row = {
        id: activationId,
        planId: safePlanId,
        status: 'active',
        trigger: String(plan.triggerConditions || '').trim() || 'activation_manuelle',
        initiatorUserId: currentUserId(),
        notes: '',
        startedAt: now(),
        closedAt: null,
        updatedAt: now()
      };
      await api.put('workflowContingencyActivations', row, STORE_KEY_FIELDS.workflowContingencyActivations);
      await logContingencyAudit('activation_start', safePlanId, { activationId: row.id });
      await logAudit('contingency_activation_start', 'contingencyPlan', safePlanId, { activationId: row.id });

      const actions = (state.collections.contingencyActions || [])
        .filter((act) => String(act.planId || '') === safePlanId)
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

      const tasksGenerated = [];
      for (const action of actions) {
        const taskId = `wf-task-${uid()}`;
        const taskObj = {
          id: taskId,
          title: `[CONTINGENCE] ${String(action.title || 'Action')}`,
          description: `Action de contingence du plan: ${String(plan.title || '')}\nActivation: ${activationId}\nOrdre: ${action.order || 1}`,
          processId: String(plan.processId || '').trim() || null,
          serviceId: String(plan.serviceId || '').trim() || null,
          groupId: null,
          ownerAgentId: String(action.ownerAgentId || plan.ownerAgentId || '').trim() || null,
          status: 'todo',
          priority: String(plan.criticality || 'medium'),
          approvalStatus: 'pending',
          checklist: [],
          linkedProcedureId: null,
          linkedSoftwareIds: String(plan.softwareId || '').trim() ? [String(plan.softwareId).trim()] : [],
          prerequisiteTaskIds: [],
          dependentTaskIds: [],
          linkedGlobalTaskIds: [],
          linkedDocumentIds: [],
          linkedThemeKeys: [],
          linkedGroupKeys: [],
          metadata: {
            contingencyPlanId: safePlanId,
            contingencyActivationId: activationId,
            contingencyActionId: String(action.id || '')
          },
          createdAt: now(),
          updatedAt: now()
        };
        await api.put('workflowTasks', taskObj, STORE_KEY_FIELDS.workflowTasks);
        tasksGenerated.push(taskId);
        await logAudit('task_create_from_contingency', 'task', taskId, { planId: safePlanId, activationId, actionId: action.id });
      }

      await notifyInternal(`Plan de contingence active: ${String(plan.title || '')} - ${tasksGenerated.length} tache(s) generee(s)`);
      await loadCollections();
      renderServiceFilter();
      renderContent();
      if (state.selectedType === 'contingencyPlan' && String(state.selectedId || '') === safePlanId) {
        openDetail('contingencyPlan', safePlanId);
      }
      toast(`Plan active - ${tasksGenerated.length} tache(s) generee(s)`);
    }

    async function closeContingencyActivation(activationId) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: edition reservee au role admin ou manager workflow');
        return;
      }
      const safeActivationId = String(activationId || '').trim();
      if (!safeActivationId) return;
      const current = (state.collections.contingencyActivations || []).find((row) => String(row.id || '') === safeActivationId);
      if (!current) return;
      const next = {
        ...current,
        status: 'closed',
        closedAt: now(),
        updatedAt: now()
      };
      await api.put('workflowContingencyActivations', next, STORE_KEY_FIELDS.workflowContingencyActivations);
      await logContingencyAudit('activation_close', String(next.planId || ''), { activationId: next.id });
      await logAudit('contingency_activation_close', 'contingencyPlan', String(next.planId || ''), { activationId: next.id });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      if (state.selectedType === 'contingencyPlan' && String(state.selectedId || '') === String(next.planId || '')) {
        openDetail('contingencyPlan', String(next.planId || ''));
      }
      toast('Activation cloturee');
    }

    function resolvePermissionBeneficiaryLabel(type, id) {
      const safeType = normalizePermissionBeneficiaryType(type);
      const safeId = String(id || '').trim();
      if (!safeId) return '';
      if (safeType === 'agent') {
        return String(state.collections.agents.find((row) => String(row.id) === safeId)?.displayName || safeId);
      }
      if (safeType === 'group') {
        return String(state.collections.groups.find((row) => String(row.id) === safeId)?.name || safeId);
      }
      if (safeType === 'role') {
        return String(state.collections.roles.find((row) => String(row.id) === safeId)?.name || safeId);
      }
      const userFromStore = state.collections.users.find((row) => String(row.userId) === safeId)
        || state.collections.directoryUsers.find((row) => String(row.userId) === safeId);
      return String(userFromStore?.name || userFromStore?.displayName || safeId);
    }

    async function logPermissionAudit(action, softwareId, payload = {}) {
      const entry = {
        id: `wf-perm-audit-${uid()}`,
        action: String(action || '').trim() || 'update',
        softwareId: String(softwareId || '').trim() || null,
        entityType: 'permission',
        entityId: String(payload?.id || payload?.assignmentId || payload?.profileId || payload?.requestId || '').trim() || null,
        payload: payload || null,
        byUserId: currentUserId(),
        createdAt: now()
      };
      await api.put('workflowPermissionAudit', entry, STORE_KEY_FIELDS.workflowPermissionAudit);
    }

    function permissionReviewDatePlusDays(days) {
      const d = new Date();
      d.setDate(d.getDate() + Math.max(1, Number(days || 90) || 90));
      return d.toISOString().slice(0, 10);
    }

    function todayIsoDate() {
      return new Date().toISOString().slice(0, 10);
    }

    function findPermissionAssignmentsForRequest(request) {
      const softwareId = String(request?.softwareId || '').trim();
      const beneficiaryType = normalizePermissionBeneficiaryType(request?.beneficiaryType);
      const beneficiaryId = String(request?.beneficiaryId || '').trim();
      if (!softwareId || !beneficiaryId) return [];
      return (state.collections.permissionAssignments || []).filter((row) => (
        String(row.softwareId || '') === softwareId
        && normalizePermissionBeneficiaryType(row.beneficiaryType) === beneficiaryType
        && String(row.beneficiaryId || '') === beneficiaryId
      ));
    }

    async function executePermissionRequestRow(request) {
      const requestId = String(request?.id || '').trim();
      if (!requestId) throw new Error('Demande invalide');
      const softwareId = String(request.softwareId || '').trim();
      if (!softwareId) throw new Error('Logiciel manquant');
      const profileId = String(request.profileId || '').trim();
      const action = normalizePermissionRequestAction(request.action);
      const beneficiaryType = normalizePermissionBeneficiaryType(request.beneficiaryType);
      const beneficiaryId = String(request.beneficiaryId || '').trim();
      if (!beneficiaryId) throw new Error('Beneficiaire manquant');
      const relatedAssignments = findPermissionAssignmentsForRequest(request);
      const nowTs = now();
      const actorId = currentUserId();
      const today = todayIsoDate();

      if (action === 'revoke') {
        if (!relatedAssignments.length) return null;
        const changes = relatedAssignments.map(async (assignment) => {
          const next = {
            ...assignment,
            status: 'revoked',
            endDate: normalizeIsoDate(assignment.endDate || '') || today,
            updatedAt: nowTs
          };
          await api.put('workflowPermissionAssignments', next, STORE_KEY_FIELDS.workflowPermissionAssignments);
          return next;
        });
        const updated = await Promise.all(changes);
        return { action, updatedAssignments: updated, actorId };
      }

      const profile = (state.collections.permissionProfiles || []).find((row) => String(row.id || '') === profileId);
      if (!profile && action !== 'revoke') throw new Error('Profil introuvable');

      const base = {
        softwareId,
        profileId,
        profileName: String(profile?.name || request.profileName || profileId || ''),
        level: normalizePermissionLevel(profile?.level || request.level || 'read'),
        beneficiaryType,
        beneficiaryId,
        beneficiaryLabel: resolvePermissionBeneficiaryLabel(beneficiaryType, beneficiaryId),
        status: 'active',
        startDate: normalizeIsoDate(request.startDate || '') || today,
        endDate: normalizeIsoDate(request.endDate || ''),
        reviewDate: normalizeIsoDate(request.reviewDate || '') || permissionReviewDatePlusDays(90),
        notes: String(request.justification || request.comments || '').trim(),
        updatedAt: nowTs
      };

      const target = relatedAssignments[0] || null;
      if (target) {
        const next = { ...target, ...base };
        await api.put('workflowPermissionAssignments', next, STORE_KEY_FIELDS.workflowPermissionAssignments);
        return { action, updatedAssignments: [next], actorId };
      }

      const row = {
        id: `wf-perm-assignment-${uid()}`,
        ...base,
        source: 'request',
        createdByUserId: String(request.requestedByUserId || actorId),
        createdAt: nowTs
      };
      await api.put('workflowPermissionAssignments', row, STORE_KEY_FIELDS.workflowPermissionAssignments);
      return { action, updatedAssignments: [row], actorId };
    }

    async function transitionPermissionRequest(requestId, transition) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: edition reservee au role admin ou manager workflow');
        return;
      }
      const safeRequestId = String(requestId || '').trim();
      const action = String(transition || '').trim().toLowerCase();
      if (!safeRequestId || !action) return;
      const current = (state.collections.permissionRequests || []).find((row) => String(row.id || '') === safeRequestId);
      if (!current) return;
      const currentStatus = normalizePermissionRequestStatus(current.status);
      const next = { ...current, updatedAt: now() };
      const actorId = currentUserId();

      if (action === 'submit') {
        if (currentStatus !== 'draft') return;
        next.status = 'submitted';
      } else if (action === 'approve') {
        if (currentStatus !== 'submitted') return;
        if (String(current.requestedByUserId || '') === actorId && !state.permissions.isAdmin) {
          toast('Separation des droits: demandeur et valideur doivent etre differents');
          return;
        }
        next.status = 'approved';
        next.approverUserId = actorId;
        next.approvedAt = now();
      } else if (action === 'reject') {
        if (!['submitted', 'approved'].includes(currentStatus)) return;
        if (String(current.requestedByUserId || '') === actorId && !state.permissions.isAdmin) {
          toast('Separation des droits: demandeur et valideur doivent etre differents');
          return;
        }
        next.status = 'rejected';
        next.approverUserId = actorId;
        if (!next.approvedAt) next.approvedAt = now();
      } else if (action === 'execute') {
        if (currentStatus !== 'approved') return;
        const execResult = await executePermissionRequestRow(current);
        next.status = 'executed';
        next.executedByUserId = actorId;
        next.executedAt = now();
        await logPermissionAudit('request_execute', String(current.softwareId || ''), {
          requestId: next.id,
          action: current.action,
          assignmentCount: Number(execResult?.updatedAssignments?.length || 0)
        });
      } else {
        return;
      }

      await api.put('workflowPermissionRequests', next, STORE_KEY_FIELDS.workflowPermissionRequests);
      await logPermissionAudit(`request_${action}`, String(next.softwareId || ''), {
        requestId: next.id,
        from: currentStatus,
        to: next.status,
        by: actorId
      });
      await logAudit(`permission_request_${action}`, 'software', String(next.softwareId || ''), {
        requestId: next.id,
        from: currentStatus,
        to: next.status
      });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      if (state.selectedType === 'software' && String(state.selectedId || '') === String(next.softwareId || '')) {
        openDetail('software', String(next.softwareId || ''));
      }
      toast(`Demande ${next.status}`);
    }

    async function transitionPermissionReview(reviewId, decision) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: edition reservee au role admin ou manager workflow');
        return;
      }
      const safeReviewId = String(reviewId || '').trim();
      const targetDecision = normalizePermissionReviewDecision(decision);
      if (!safeReviewId || targetDecision === 'pending') return;
      const current = (state.collections.permissionReviews || []).find((row) => String(row.id || '') === safeReviewId);
      if (!current) return;
      if (normalizePermissionReviewDecision(current.decision) !== 'pending') {
        toast('Cette revue est deja traitee');
        return;
      }
      const assignmentId = String(current.assignmentId || '').trim();
      const assignment = (state.collections.permissionAssignments || []).find((row) => String(row.id || '') === assignmentId);
      if (!assignment) {
        toast('Attribution introuvable');
        return;
      }
      const actorId = currentUserId();
      const reviewedAt = now();
      const today = todayIsoDate();
      const nextReviewDate = permissionReviewDatePlusDays(90);
      const nextReview = {
        ...current,
        decision: targetDecision,
        reviewerUserId: actorId,
        reviewedAt,
        updatedAt: reviewedAt
      };
      const nextAssignment = {
        ...assignment,
        status: targetDecision === 'revoked' ? 'revoked' : 'active',
        endDate: targetDecision === 'revoked'
          ? (normalizeIsoDate(assignment.endDate || '') || today)
          : normalizeIsoDate(assignment.endDate || ''),
        reviewDate: targetDecision === 'revoked' ? normalizeIsoDate(assignment.reviewDate || '') : nextReviewDate,
        updatedAt: reviewedAt
      };
      await Promise.all([
        api.put('workflowPermissionReviews', nextReview, STORE_KEY_FIELDS.workflowPermissionReviews),
        api.put('workflowPermissionAssignments', nextAssignment, STORE_KEY_FIELDS.workflowPermissionAssignments)
      ]);
      await logPermissionAudit(`review_${targetDecision}`, String(nextAssignment.softwareId || ''), {
        reviewId: nextReview.id,
        assignmentId: nextAssignment.id,
        beneficiaryType: nextAssignment.beneficiaryType,
        beneficiaryId: nextAssignment.beneficiaryId
      });
      await logAudit(`permission_review_${targetDecision}`, 'software', String(nextAssignment.softwareId || ''), {
        reviewId: nextReview.id,
        assignmentId: nextAssignment.id
      });
      await loadCollections();
      renderServiceFilter();
      renderContent();
      if (state.selectedType === 'software' && String(state.selectedId || '') === String(nextAssignment.softwareId || '')) {
        openDetail('software', String(nextAssignment.softwareId || ''));
      }
      toast(targetDecision === 'revoked' ? 'Habilitation retiree via revue' : 'Revue validee');
    }

    async function runAutomaticPermissionReviews() {
      if (state.permissionAutoReviewRunning) return;
      state.permissionAutoReviewRunning = true;
      try {
        const today = todayIsoDate();
        const reviewRows = Array.isArray(state.collections.permissionReviews) ? state.collections.permissionReviews : [];
        const reviewDedupe = new Set(reviewRows.map((row) => `${String(row.assignmentId || '')}::${String(row.reviewDate || '')}`));
        const toCreate = [];
        const toUpdate = [];
        (state.collections.permissionAssignments || []).forEach((assignment) => {
          if (!assignment) return;
          const assignmentId = String(assignment.id || '').trim();
          if (!assignmentId) return;
          const reviewDate = normalizeIsoDate(assignment.reviewDate || '');
          if (!reviewDate || reviewDate > today) return;
          if (normalizePermissionStatus(assignment.status) === 'revoked') return;
          const key = `${assignmentId}::${reviewDate}`;
          if (!reviewDedupe.has(key)) {
            toCreate.push({
              id: `wf-perm-review-${uid()}`,
              softwareId: String(assignment.softwareId || '').trim() || null,
              assignmentId,
              reviewDate,
              decision: 'pending',
              reviewerUserId: null,
              comments: 'Revue automatique générée',
              createdAt: now(),
              updatedAt: now()
            });
            reviewDedupe.add(key);
          }
          if (normalizePermissionStatus(assignment.status) !== 'review_due') {
            toUpdate.push({ ...assignment, status: 'review_due', updatedAt: now() });
          }
        });
        if (!toCreate.length && !toUpdate.length) return;
        await Promise.all([
          ...toCreate.map((row) => api.put('workflowPermissionReviews', row, STORE_KEY_FIELDS.workflowPermissionReviews)),
          ...toUpdate.map((row) => api.put('workflowPermissionAssignments', row, STORE_KEY_FIELDS.workflowPermissionAssignments))
        ]);
        const bySoftware = new Map();
        toCreate.forEach((row) => {
          const sid = String(row.softwareId || '').trim() || 'global';
          bySoftware.set(sid, (bySoftware.get(sid) || 0) + 1);
        });
        for (const [softwareId, count] of bySoftware.entries()) {
          await logPermissionAudit('auto_review_due', softwareId === 'global' ? null : softwareId, {
            createdReviews: count,
            date: today
          });
        }
      } finally {
        state.permissionAutoReviewRunning = false;
      }
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
      const roleId = `wf-role-${uid()}`;
      const processId = `wf-process-${uid()}`;
      const stepStartId = `wf-step-${uid()}`;
      const stepDecisionId = `wf-step-${uid()}`;
      const stepEndId = `wf-step-${uid()}`;
      const flow1Id = `wf-flow-${uid()}`;
      const flow2Id = `wf-flow-${uid()}`;
      const templateId = `wf-template-${uid()}`;
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

      await api.put('workflowRoles', {
        id: roleId,
        name: 'Instructeur de dossier',
        description: 'Role metier charge de qualifier et instruire les demandes.',
        serviceId,
        requiredSkills: ['Analyse', 'Rigueur', 'Coordination'],
        permissionHints: ['workflow_manager'],
        metadata: {},
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowRoles);

      await api.put('workflowProcesses', {
        id: processId,
        title: 'Instruction d une demande MDA',
        description: 'Processus metier de la reception a la notification finale.',
        communityId,
        serviceId,
        groupId,
        ownerAgentId: agentId,
        status: 'active',
        criticality: 'high',
        inputs: ['Dossier usager', 'Pieces justificatives'],
        outputs: ['Decision notifiee', 'Trace d instruction'],
        tags: ['instruction', 'orientation'],
        validation: { level: 0, requiredLevels: 2, requiredRoleIds: [], approvers: [] },
        metadata: {},
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowProcesses);

      await api.put('workflowProcessSteps', {
        id: stepStartId,
        processId,
        title: 'Reception du dossier',
        stepType: 'action',
        description: 'Verifier la completude du dossier.',
        serviceId,
        groupId,
        ownerAgentId: agentId,
        roleId,
        linkedProcedureId: null,
        linkedSoftwareIds: [],
        linkedTaskId: null,
        estimatedDurationMinutes: 20,
        order: 1,
        metadata: {},
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowProcessSteps);

      await api.put('workflowProcessSteps', {
        id: stepDecisionId,
        processId,
        title: 'Decision d orientation',
        stepType: 'decision',
        description: 'Arbitrer le parcours selon les elements collectes.',
        serviceId,
        groupId,
        ownerAgentId: agentId,
        roleId,
        linkedProcedureId: procedureId,
        linkedSoftwareIds: [softwareId],
        linkedTaskId: taskId,
        estimatedDurationMinutes: 30,
        order: 2,
        metadata: {},
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowProcessSteps);

      await api.put('workflowProcessSteps', {
        id: stepEndId,
        processId,
        title: 'Notification finale',
        stepType: 'notification',
        description: 'Informer les parties prenantes de la decision.',
        serviceId,
        groupId,
        ownerAgentId: agentId,
        roleId,
        linkedProcedureId: null,
        linkedSoftwareIds: [],
        linkedTaskId: null,
        estimatedDurationMinutes: 10,
        order: 3,
        metadata: {},
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowProcessSteps);

      await api.put('workflowFlows', {
        id: flow1Id,
        processId,
        fromStepId: stepStartId,
        toStepId: stepDecisionId,
        flowType: 'sequence',
        condition: '',
        label: 'Dossier complet',
        metadata: {},
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowFlows);

      await api.put('workflowFlows', {
        id: flow2Id,
        processId,
        fromStepId: stepDecisionId,
        toStepId: stepEndId,
        flowType: 'sequence',
        condition: 'Decision validee',
        label: 'Orientation retenue',
        metadata: {},
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowFlows);

      await api.put('workflowProcessTemplates', {
        id: templateId,
        name: 'Modele instruction MDA',
        description: 'Modele reutilisable d instruction de demande.',
        sourceProcessId: processId,
        communityId,
        serviceId,
        groupId,
        ownerAgentId: agentId,
        status: 'draft',
        tags: ['template', 'instruction'],
        version: 1,
        templateSteps: [
          { title: 'Reception du dossier', stepType: 'action', description: 'Verifier completude', roleId, linkedProcedureId: null, linkedSoftwareIds: [], estimatedDurationMinutes: 20, order: 1 },
          { title: 'Decision d orientation', stepType: 'decision', description: 'Arbitrage', roleId, linkedProcedureId: procedureId, linkedSoftwareIds: [softwareId], estimatedDurationMinutes: 30, order: 2 },
          { title: 'Notification finale', stepType: 'notification', description: 'Informer usager', roleId, linkedProcedureId: null, linkedSoftwareIds: [], estimatedDurationMinutes: 10, order: 3 }
        ],
        templateFlows: [
          { fromStepOrder: 1, toStepOrder: 2, flowType: 'sequence', condition: '', label: 'Dossier complet' },
          { fromStepOrder: 2, toStepOrder: 3, flowType: 'sequence', condition: 'Decision validee', label: 'Orientation retenue' }
        ],
        metadata: {
          versionHistory: [{
            version: 1,
            updatedAt: stamp,
            byUserId: currentUserId()
          }]
        },
        createdAt: stamp,
        updatedAt: stamp
      }, STORE_KEY_FIELDS.workflowProcessTemplates);

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
        processId,
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

    async function injectOrganizationModelSampleData() {
      if (!canEditWorkflow()) {
        toast('Lecture seule: injection reservee au role admin ou manager workflow');
        return;
      }
      const sampleDatasetKey = 'org_model_full_v1';
      const existingCommunities = await api.getAll('workflowCommunities', STORE_KEY_FIELDS.workflowCommunities);
      if ((existingCommunities || []).some((row) => String(row?.metadata?.sampleDatasetKey || '') === sampleDatasetKey)) {
        toast('Jeu de donnees exemple deja present');
        return;
      }

      const stamp = now();
      const mk = (prefix) => `${prefix}-${uid()}`;
      const ids = {
        community: { gov: mk('wf-community'), ops: mk('wf-community') },
        service: { strategy: mk('wf-service'), quality: mk('wf-service'), intake: mk('wf-service'), eval: mk('wf-service'), intervention: mk('wf-service') },
        group: { steering: mk('wf-group'), compliance: mk('wf-group'), front: mk('wf-group'), triage: mk('wf-group'), medical: mk('wf-group'), social: mk('wf-group'), field: mk('wf-group') },
        agent: { director: mk('wf-agent'), qualityLead: mk('wf-agent'), intakeLead: mk('wf-agent'), intakeA: mk('wf-agent'), intakeB: mk('wf-agent'), evalLead: mk('wf-agent'), nurse: mk('wf-agent'), social: mk('wf-agent'), interLead: mk('wf-agent'), fieldA: mk('wf-agent'), fieldB: mk('wf-agent'), analyst: mk('wf-agent') },
        role: { wfManager: mk('wf-role'), intake: mk('wf-role'), triage: mk('wf-role'), nurse: mk('wf-role'), social: mk('wf-role'), planner: mk('wf-role'), field: mk('wf-role'), quality: mk('wf-role') },
        software: { core: mk('wf-software'), docs: mk('wf-software'), sched: mk('wf-software'), mobile: mk('wf-software'), bi: mk('wf-software') },
        procedure: { intake: mk('wf-procedure'), triage: mk('wf-procedure'), eval: mk('wf-procedure'), intervention: mk('wf-procedure'), quality: mk('wf-procedure') },
        process: { intake: mk('wf-process'), triage: mk('wf-process'), eval: mk('wf-process'), intervention: mk('wf-process'), quality: mk('wf-process') },
        template: { intake: mk('wf-template'), eval: mk('wf-template'), intervention: mk('wf-template') }
      };

      const communities = [
        { id: ids.community.gov, name: 'Gouvernance et pilotage', description: 'Direction, qualite et conformite', color: '#0f766e', icon: 'account_balance', order: 1 },
        { id: ids.community.ops, name: 'Operations territoriales', description: 'Accueil, evaluation et interventions', color: '#1d4ed8', icon: 'lan', order: 2 }
      ];

      const services = [
        { id: ids.service.strategy, communityId: ids.community.gov, name: 'Direction strategique', description: 'Pilotage global', managerAgentId: ids.agent.director, tags: ['pilotage'], relatedServiceIds: [ids.service.quality] },
        { id: ids.service.quality, communityId: ids.community.gov, name: 'Qualite et conformite', description: 'Controle interne', managerAgentId: ids.agent.qualityLead, tags: ['qualite'], relatedServiceIds: [ids.service.strategy, ids.service.intake] },
        { id: ids.service.intake, communityId: ids.community.ops, name: 'Accueil et orientation', description: 'Qualification initiale', managerAgentId: ids.agent.intakeLead, tags: ['accueil'], relatedServiceIds: [ids.service.eval] },
        { id: ids.service.eval, communityId: ids.community.ops, name: 'Evaluation pluridisciplinaire', description: 'Analyse medico-sociale', managerAgentId: ids.agent.evalLead, tags: ['evaluation'], relatedServiceIds: [ids.service.intake, ids.service.intervention] },
        { id: ids.service.intervention, communityId: ids.community.ops, name: 'Interventions et suivi', description: 'Execution terrain', managerAgentId: ids.agent.interLead, tags: ['terrain'], relatedServiceIds: [ids.service.eval, ids.service.quality] }
      ];

      const groups = [
        { id: ids.group.steering, serviceId: ids.service.strategy, name: 'Comite pilotage', description: 'Arbitrage', type: 'metier', memberAgentIds: [ids.agent.director, ids.agent.analyst] },
        { id: ids.group.compliance, serviceId: ids.service.quality, name: 'Cellule conformite', description: 'Audit', type: 'metier', memberAgentIds: [ids.agent.qualityLead, ids.agent.analyst] },
        { id: ids.group.front, serviceId: ids.service.intake, name: 'Front office', description: 'Accueil usagers', type: 'metier', memberAgentIds: [ids.agent.intakeLead, ids.agent.intakeA, ids.agent.intakeB] },
        { id: ids.group.triage, serviceId: ids.service.eval, name: 'Cellule triage', description: 'Priorisation', type: 'metier', memberAgentIds: [ids.agent.evalLead, ids.agent.nurse, ids.agent.social] },
        { id: ids.group.medical, serviceId: ids.service.eval, name: 'Volet medical', description: 'Evaluation medicale', type: 'metier', memberAgentIds: [ids.agent.nurse] },
        { id: ids.group.social, serviceId: ids.service.eval, name: 'Volet social', description: 'Evaluation sociale', type: 'metier', memberAgentIds: [ids.agent.social] },
        { id: ids.group.field, serviceId: ids.service.intervention, name: 'Coordination terrain', description: 'Execution', type: 'metier', memberAgentIds: [ids.agent.interLead, ids.agent.fieldA, ids.agent.fieldB] }
      ];

      const agents = [
        { id: ids.agent.director, displayName: 'Sophie Martin', handle: 's.martin', title: 'Directrice strategique', serviceId: ids.service.strategy, groupIds: [ids.group.steering], managerAgentId: null, mission: 'Piloter l organisation', responsibilities: ['Prioriser'], skills: ['Leadership'], tools: ['NEXUS Core'], rbacHints: ['admin', 'workflow_admin'] },
        { id: ids.agent.qualityLead, displayName: 'Nadia Roussel', handle: 'n.roussel', title: 'Responsable qualite', serviceId: ids.service.quality, groupIds: [ids.group.compliance], managerAgentId: ids.agent.director, mission: 'Superviser la conformite', responsibilities: ['Auditer'], skills: ['Qualite'], tools: ['BI Portal'], rbacHints: ['manager', 'workflow_manager'] },
        { id: ids.agent.intakeLead, displayName: 'Karim Benali', handle: 'k.benali', title: 'Responsable accueil', serviceId: ids.service.intake, groupIds: [ids.group.front], managerAgentId: ids.agent.director, mission: 'Superviser intake', responsibilities: ['Affecter'], skills: ['Organisation'], tools: ['NEXUS Core'], rbacHints: ['manager'] },
        { id: ids.agent.intakeA, displayName: 'Lea Fournier', handle: 'l.fournier', title: 'Chargee accueil', serviceId: ids.service.intake, groupIds: [ids.group.front], managerAgentId: ids.agent.intakeLead, mission: 'Verifier dossiers', responsibilities: ['Verifier'], skills: ['Rigueur'], tools: ['DocHub'], rbacHints: [] },
        { id: ids.agent.intakeB, displayName: 'Yanis Giraud', handle: 'y.giraud', title: 'Charge accueil', serviceId: ids.service.intake, groupIds: [ids.group.front], managerAgentId: ids.agent.intakeLead, mission: 'Completer dossiers', responsibilities: ['Completer'], skills: ['Coordination'], tools: ['DocHub'], rbacHints: [] },
        { id: ids.agent.evalLead, displayName: 'Claire Dupont', handle: 'c.dupont', title: 'Responsable evaluation', serviceId: ids.service.eval, groupIds: [ids.group.triage], managerAgentId: ids.agent.director, mission: 'Prioriser evaluations', responsibilities: ['Valider'], skills: ['Analyse'], tools: ['NEXUS Core'], rbacHints: ['manager', 'workflow_manager'] },
        { id: ids.agent.nurse, displayName: 'Thomas Nguyen', handle: 't.nguyen', title: 'Evaluateur medical', serviceId: ids.service.eval, groupIds: [ids.group.triage, ids.group.medical], managerAgentId: ids.agent.evalLead, mission: 'Avis medical', responsibilities: ['Evaluer'], skills: ['Medical'], tools: ['NEXUS Core'], rbacHints: [] },
        { id: ids.agent.social, displayName: 'Ines Robert', handle: 'i.robert', title: 'Evaluatrice sociale', serviceId: ids.service.eval, groupIds: [ids.group.triage, ids.group.social], managerAgentId: ids.agent.evalLead, mission: 'Avis social', responsibilities: ['Evaluer'], skills: ['Social'], tools: ['NEXUS Core'], rbacHints: [] },
        { id: ids.agent.interLead, displayName: 'Paul Simon', handle: 'p.simon', title: 'Responsable interventions', serviceId: ids.service.intervention, groupIds: [ids.group.field], managerAgentId: ids.agent.director, mission: 'Planifier interventions', responsibilities: ['Planifier'], skills: ['Planification'], tools: ['Scheduling'], rbacHints: ['manager'] },
        { id: ids.agent.fieldA, displayName: 'Maya Petit', handle: 'm.petit', title: 'Coordinatrice terrain', serviceId: ids.service.intervention, groupIds: [ids.group.field], managerAgentId: ids.agent.interLead, mission: 'Coordonner terrain', responsibilities: ['Executer'], skills: ['Terrain'], tools: ['MobileOps'], rbacHints: [] },
        { id: ids.agent.fieldB, displayName: 'Hugo Barre', handle: 'h.barre', title: 'Coordinateur terrain', serviceId: ids.service.intervention, groupIds: [ids.group.field], managerAgentId: ids.agent.interLead, mission: 'Suivre interventions', responsibilities: ['Reporter'], skills: ['Terrain'], tools: ['MobileOps'], rbacHints: [] },
        { id: ids.agent.analyst, displayName: 'Emma Laurent', handle: 'e.laurent', title: 'Analyste performance', serviceId: ids.service.quality, groupIds: [ids.group.compliance, ids.group.steering], managerAgentId: ids.agent.qualityLead, mission: 'Mesurer KPI', responsibilities: ['Mesurer'], skills: ['Data'], tools: ['BI Portal'], rbacHints: ['workflow_manager'] }
      ];

      const roles = [
        { id: ids.role.wfManager, name: 'Workflow manager', description: 'Pilotage governance', serviceId: ids.service.strategy, requiredSkills: ['Pilotage'], permissionHints: ['workflow_manager', 'approver'] },
        { id: ids.role.intake, name: 'Intake officer', description: 'Qualification initiale', serviceId: ids.service.intake, requiredSkills: ['Accueil'], permissionHints: ['validator'] },
        { id: ids.role.triage, name: 'Triage officer', description: 'Priorisation', serviceId: ids.service.eval, requiredSkills: ['Analyse'], permissionHints: ['approver'] },
        { id: ids.role.nurse, name: 'Medical reviewer', description: 'Evaluation medicale', serviceId: ids.service.eval, requiredSkills: ['Medical'], permissionHints: ['validator'] },
        { id: ids.role.social, name: 'Social reviewer', description: 'Evaluation sociale', serviceId: ids.service.eval, requiredSkills: ['Social'], permissionHints: ['validator'] },
        { id: ids.role.planner, name: 'Intervention planner', description: 'Planification intervention', serviceId: ids.service.intervention, requiredSkills: ['Planning'], permissionHints: ['approver'] },
        { id: ids.role.field, name: 'Field coordinator', description: 'Execution terrain', serviceId: ids.service.intervention, requiredSkills: ['Terrain'], permissionHints: [] },
        { id: ids.role.quality, name: 'Quality controller', description: 'Controle qualite', serviceId: ids.service.quality, requiredSkills: ['Audit'], permissionHints: ['workflow_approver'] }
      ];

      const software = [
        { id: ids.software.core, name: 'NEXUS Core', description: 'Suivi des dossiers', category: 'Case management', linkedTaskIds: [], linkedProcedureIds: [], documentationLinks: ['https://intranet/doc/nexus-core'] },
        { id: ids.software.docs, name: 'DocHub', description: 'Depot documentaire', category: 'Document', linkedTaskIds: [], linkedProcedureIds: [], documentationLinks: ['https://intranet/doc/dochub'] },
        { id: ids.software.sched, name: 'Scheduling Suite', description: 'Planification', category: 'Scheduling', linkedTaskIds: [], linkedProcedureIds: [], documentationLinks: ['https://intranet/doc/scheduling'] },
        { id: ids.software.mobile, name: 'MobileOps', description: 'Execution mobile terrain', category: 'Field operations', linkedTaskIds: [], linkedProcedureIds: [], documentationLinks: ['https://intranet/doc/mobileops'] },
        { id: ids.software.bi, name: 'BI Portal', description: 'KPI et gouvernance', category: 'Analytics', linkedTaskIds: [], linkedProcedureIds: [], documentationLinks: ['https://intranet/doc/biportal'] }
      ];

      const procedures = [
        { id: ids.procedure.intake, title: 'Procedure intake dossier', summary: 'Collecte et verification initiale', scope: 'Accueil', trigger: 'Reception demande', steps: ['Collecter', 'Verifier', 'Affecter'], exceptions: ['Piece manquante'], risks: ['Erreur qualification'], linkedSoftwareIds: [ids.software.docs, ids.software.core], linkedTaskIds: [] },
        { id: ids.procedure.triage, title: 'Procedure triage priorite', summary: 'Scoring et orientation', scope: 'Evaluation', trigger: 'Dossier enregistre', steps: ['Analyser risque', 'Classer'], exceptions: ['Dossier incomplet'], risks: ['Mauvaise priorite'], linkedSoftwareIds: [ids.software.core], linkedTaskIds: [] },
        { id: ids.procedure.eval, title: 'Procedure evaluation conjointe', summary: 'Evaluation medicale et sociale', scope: 'Evaluation', trigger: 'Triage valide', steps: ['Planifier', 'Evaluer', 'Synthese'], exceptions: ['Usager absent'], risks: ['Retard'], linkedSoftwareIds: [ids.software.sched, ids.software.core], linkedTaskIds: [] },
        { id: ids.procedure.intervention, title: 'Procedure intervention terrain', summary: 'Planifier et executer intervention', scope: 'Intervention', trigger: 'Evaluation finalisee', steps: ['Plan', 'Dispatch', 'Compte rendu'], exceptions: ['Ressource indisponible'], risks: ['Retard terrain'], linkedSoftwareIds: [ids.software.sched, ids.software.mobile], linkedTaskIds: [] },
        { id: ids.procedure.quality, title: 'Procedure qualite REX', summary: 'Audit et amelioration continue', scope: 'Qualite', trigger: 'Cycle cloture', steps: ['Mesurer', 'Auditer', 'Corriger'], exceptions: ['Donnees manquantes'], risks: ['Non conformite'], linkedSoftwareIds: [ids.software.bi], linkedTaskIds: [] }
      ];

      const addMeta = (row) => ({
        ...row,
        metadata: { ...(row.metadata || {}), sampleDatasetKey },
        createdAt: stamp,
        updatedAt: stamp
      });
      const addProcedureMeta = (row) => ({
        ...addMeta(row),
        linkedGlobalTaskIds: [],
        linkedGlobalDocIds: [],
        linkedThemeKeys: [],
        linkedGroupKeys: [],
        attachments: [],
        wikiBodyHtml: '<h2>Mode operatoire</h2><p>Exemple de documentation.</p>',
        version: 1
      });
      const putRows = async (store, rows) => {
        for (const row of (rows || [])) {
          await api.put(store, row, STORE_KEY_FIELDS[store]);
        }
      };
      const processDefs = [
        {
          key: 'intake',
          id: ids.process.intake,
          title: 'Intake et enregistrement dossier',
          description: 'Qualifier et enregistrer la demande',
          communityId: ids.community.ops,
          serviceId: ids.service.intake,
          groupId: ids.group.front,
          ownerAgentId: ids.agent.intakeLead,
          status: 'published',
          criticality: 'medium',
          tags: ['intake', 'orientation'],
          roleLevel1: ids.role.intake,
          roleLevel2: ids.role.triage,
          procedureId: ids.procedure.intake,
          softwareIds: [ids.software.docs, ids.software.core],
          steps: [
            { title: 'Reception demande', stepType: 'input', roleId: ids.role.intake, ownerAgentId: ids.agent.intakeA, duration: 15 },
            { title: 'Verification pieces', stepType: 'validation', roleId: ids.role.intake, ownerAgentId: ids.agent.intakeB, duration: 20 },
            { title: 'Affectation referent', stepType: 'decision', roleId: ids.role.wfManager, ownerAgentId: ids.agent.intakeLead, duration: 10 }
          ]
        },
        {
          key: 'triage',
          id: ids.process.triage,
          title: 'Triage priorite',
          description: 'Classer les dossiers par niveau de criticite',
          communityId: ids.community.ops,
          serviceId: ids.service.eval,
          groupId: ids.group.triage,
          ownerAgentId: ids.agent.evalLead,
          status: 'review',
          criticality: 'high',
          tags: ['triage', 'priorite'],
          roleLevel1: ids.role.triage,
          roleLevel2: ids.role.wfManager,
          validationMode: 'sequential',
          procedureId: ids.procedure.triage,
          softwareIds: [ids.software.core],
          steps: [
            { title: 'Scoring risque', stepType: 'action', roleId: ids.role.triage, ownerAgentId: ids.agent.social, duration: 20 },
            { title: 'Decision orientation', stepType: 'decision', roleId: ids.role.triage, ownerAgentId: ids.agent.evalLead, duration: 15 },
            { title: 'Notification services', stepType: 'notification', roleId: ids.role.wfManager, ownerAgentId: ids.agent.intakeLead, duration: 8 }
          ]
        },
        {
          key: 'eval',
          id: ids.process.eval,
          title: 'Evaluation medico-sociale',
          description: 'Consolider avis medical et social',
          communityId: ids.community.ops,
          serviceId: ids.service.eval,
          groupId: ids.group.medical,
          ownerAgentId: ids.agent.evalLead,
          status: 'review',
          criticality: 'high',
          tags: ['evaluation', 'synthese'],
          roleLevel1: ids.role.nurse,
          roleLevel2: ids.role.triage,
          quorumLevel1: 2,
          procedureId: ids.procedure.eval,
          softwareIds: [ids.software.sched, ids.software.core],
          steps: [
            { title: 'Planifier visite', stepType: 'action', roleId: ids.role.nurse, ownerAgentId: ids.agent.nurse, duration: 25 },
            { title: 'Evaluer volet medical', stepType: 'validation', roleId: ids.role.nurse, ownerAgentId: ids.agent.nurse, duration: 50 },
            { title: 'Evaluer volet social', stepType: 'validation', roleId: ids.role.social, ownerAgentId: ids.agent.social, duration: 50 },
            { title: 'Produire synthese', stepType: 'output', roleId: ids.role.triage, ownerAgentId: ids.agent.evalLead, duration: 20 }
          ]
        },
        {
          key: 'intervention',
          id: ids.process.intervention,
          title: 'Planification intervention terrain',
          description: 'Construire le plan et executer',
          communityId: ids.community.ops,
          serviceId: ids.service.intervention,
          groupId: ids.group.field,
          ownerAgentId: ids.agent.interLead,
          status: 'draft',
          criticality: 'high',
          tags: ['intervention', 'terrain'],
          roleLevel1: ids.role.planner,
          roleLevel2: ids.role.quality,
          validationMode: 'sequential',
          procedureId: ids.procedure.intervention,
          softwareIds: [ids.software.sched, ids.software.mobile],
          steps: [
            { title: 'Concevoir plan', stepType: 'action', roleId: ids.role.planner, ownerAgentId: ids.agent.interLead, duration: 35 },
            { title: 'Valider plan qualite', stepType: 'validation', roleId: ids.role.quality, ownerAgentId: ids.agent.qualityLead, duration: 20 },
            { title: 'Dispatcher terrain', stepType: 'action', roleId: ids.role.field, ownerAgentId: ids.agent.fieldA, duration: 30 },
            { title: 'Cloturer intervention', stepType: 'output', roleId: ids.role.field, ownerAgentId: ids.agent.fieldB, duration: 15 }
          ]
        },
        {
          key: 'quality',
          id: ids.process.quality,
          title: 'Boucle qualite et REX',
          description: 'Mesurer, auditer, corriger',
          communityId: ids.community.gov,
          serviceId: ids.service.quality,
          groupId: ids.group.compliance,
          ownerAgentId: ids.agent.qualityLead,
          status: 'review',
          criticality: 'medium',
          tags: ['qualite', 'rex'],
          roleLevel1: ids.role.quality,
          roleLevel2: ids.role.wfManager,
          procedureId: ids.procedure.quality,
          softwareIds: [ids.software.bi],
          steps: [
            { title: 'Collecter KPI', stepType: 'input', roleId: ids.role.quality, ownerAgentId: ids.agent.analyst, duration: 25 },
            { title: 'Auditer echantillon', stepType: 'validation', roleId: ids.role.quality, ownerAgentId: ids.agent.qualityLead, duration: 40 },
            { title: 'Lancer plan action', stepType: 'decision', roleId: ids.role.wfManager, ownerAgentId: ids.agent.director, duration: 20 }
          ]
        }
      ];

      const processes = [];
      const steps = [];
      const flows = [];
      const tasks = [];
      const templates = [];
      processDefs.forEach((def) => {
        const validation = normalizeProcessValidation({
          level: def.key === 'quality' ? 1 : 0,
          requiredLevels: 2,
          mode: def.validationMode || 'level',
          requiredRoleIds: [def.roleLevel1, def.roleLevel2],
          levelRules: [
            { level: 1, requiredRoleIds: [def.roleLevel1], quorum: Math.max(1, Number(def.quorumLevel1 || 1) || 1) },
            { level: 2, requiredRoleIds: [def.roleLevel2], quorum: 1 }
          ],
          approvers: def.key === 'quality'
            ? [{ level: 1, byUserId: currentUserId(), roleId: def.roleLevel1, at: stamp }]
            : []
        });
        processes.push(addMeta({
          id: def.id,
          title: def.title,
          description: def.description,
          communityId: def.communityId,
          serviceId: def.serviceId,
          groupId: def.groupId,
          ownerAgentId: def.ownerAgentId,
          status: def.status,
          criticality: def.criticality,
          inputs: ['Input standard'],
          outputs: ['Output standard'],
          tags: def.tags,
          validation
        }));

        const templateSteps = [];
        const templateFlows = [];
        const localStepIds = [];
        def.steps.forEach((stepDef, index) => {
          const stepId = mk('wf-step');
          localStepIds.push(stepId);
          const taskId = mk('wf-task');
          const order = index + 1;
          tasks.push(addMeta({
            id: taskId,
            title: `${def.title} - ${stepDef.title}`,
            description: `Execution et suivi: ${stepDef.title}`,
            ownerAgentId: stepDef.ownerAgentId,
            processId: def.id,
            serviceId: def.serviceId,
            groupId: def.groupId,
            taskType: 'workflow',
            frequency: 'ponctuelle',
            priority: order <= 2 ? 'high' : 'medium',
            criticality: def.criticality,
            estimatedDuration: stepDef.duration,
            prerequisiteTaskIds: [],
            dependentTaskIds: [],
            linkedProcedureId: def.procedureId,
            linkedSoftwareIds: def.softwareIds.slice(),
            linkedDocumentIds: [],
            linkedGlobalTaskIds: [],
            linkedThemeKeys: [],
            linkedGroupKeys: [],
            checklist: [{ id: `chk-${uid()}`, label: 'Action initialisee', done: false }],
            status: order === 1 ? 'in_progress' : 'todo',
            approvalStatus: 'pending',
            approvedAt: null,
            approvedByUserId: null
          }));
          steps.push(addMeta({
            id: stepId,
            processId: def.id,
            title: stepDef.title,
            stepType: stepDef.stepType,
            description: `Etape ${order}: ${stepDef.title}`,
            serviceId: def.serviceId,
            groupId: def.groupId,
            ownerAgentId: stepDef.ownerAgentId,
            roleId: stepDef.roleId,
            linkedProcedureId: def.procedureId,
            linkedSoftwareIds: def.softwareIds.slice(),
            linkedTaskId: taskId,
            estimatedDurationMinutes: stepDef.duration,
            order
          }));
          templateSteps.push({
            title: stepDef.title,
            stepType: stepDef.stepType,
            description: `Modele ${stepDef.title}`,
            roleId: stepDef.roleId,
            linkedProcedureId: def.procedureId,
            linkedSoftwareIds: def.softwareIds.slice(),
            estimatedDurationMinutes: stepDef.duration,
            order
          });
          if (index > 0) {
            flows.push(addMeta({
              id: mk('wf-flow'),
              processId: def.id,
              fromStepId: localStepIds[index - 1],
              toStepId: localStepIds[index],
              flowType: 'sequence',
              condition: '',
              label: `Transition ${index} -> ${index + 1}`
            }));
            templateFlows.push({
              fromStepOrder: index,
              toStepOrder: index + 1,
              flowType: 'sequence',
              condition: '',
              label: `Transition ${index} -> ${index + 1}`
            });
          }
        });

        if (def.key === 'intake' || def.key === 'eval' || def.key === 'intervention') {
          const templateId = def.key === 'intake' ? ids.template.intake : def.key === 'eval' ? ids.template.eval : ids.template.intervention;
          templates.push(addMeta({
            id: templateId,
            name: `Modele - ${def.title}`,
            description: `Modele reutilisable: ${def.title}`,
            sourceProcessId: def.id,
            communityId: def.communityId,
            serviceId: def.serviceId,
            groupId: def.groupId,
            ownerAgentId: def.ownerAgentId,
            status: def.key === 'intake' ? 'published' : 'draft',
            tags: ['template', def.key],
            validation,
            version: 1,
            templateSteps,
            templateFlows,
            metadata: {
              sampleDatasetKey,
              versionHistory: [{ version: 1, updatedAt: stamp, byUserId: currentUserId() }]
            }
          }));
        }
      });

      procedures.forEach((proc) => {
        const related = tasks.filter((task) => String(task.linkedProcedureId || '') === String(proc.id));
        proc.linkedTaskIds = related.map((task) => task.id);
      });
      software.forEach((sw) => {
        const relatedTasks = tasks.filter((task) => Array.isArray(task.linkedSoftwareIds) && task.linkedSoftwareIds.includes(sw.id));
        const relatedProcedures = procedures.filter((proc) => Array.isArray(proc.linkedSoftwareIds) && proc.linkedSoftwareIds.includes(sw.id));
        sw.linkedTaskIds = relatedTasks.map((task) => task.id);
        sw.linkedProcedureIds = relatedProcedures.map((proc) => proc.id);
      });

      await putRows('workflowCommunities', communities.map(addMeta));
      await putRows('workflowServices', services.map(addMeta));
      await putRows('workflowGroups', groups.map(addMeta));
      await putRows('workflowAgents', agents.map(addMeta));
      await putRows('workflowRoles', roles.map(addMeta));
      await putRows('workflowProcedures', procedures.map(addProcedureMeta));
      await putRows('workflowSoftware', software.map(addMeta));
      await putRows('workflowProcesses', processes);
      await putRows('workflowTasks', tasks);
      await putRows('workflowProcessSteps', steps);
      await putRows('workflowFlows', flows);
      await putRows('workflowProcessTemplates', templates);
      await putRows('workflowMetrics', [
        { id: `wf-metric-orgseed-process-${new Date(stamp).toISOString().slice(0, 10)}`, metricKey: 'process_total', periodKey: new Date(stamp).toISOString().slice(0, 10), value: processes.length, source: 'sample_injection', updatedAt: stamp },
        { id: `wf-metric-orgseed-step-${new Date(stamp).toISOString().slice(0, 10)}`, metricKey: 'step_total', periodKey: new Date(stamp).toISOString().slice(0, 10), value: steps.length, source: 'sample_injection', updatedAt: stamp },
        { id: `wf-metric-orgseed-task-${new Date(stamp).toISOString().slice(0, 10)}`, metricKey: 'task_total', periodKey: new Date(stamp).toISOString().slice(0, 10), value: tasks.length, source: 'sample_injection', updatedAt: stamp }
      ]);

      await logAudit('seed_sample_org_model', 'workflow', sampleDatasetKey, {
        communities: communities.length,
        services: services.length,
        groups: groups.length,
        agents: agents.length,
        roles: roles.length,
        processes: processes.length,
        steps: steps.length,
        flows: flows.length,
        templates: templates.length,
        tasks: tasks.length
      });

      notifyInternal('Jeu d exemple organisationnel injecte');
      await loadCollections();
      renderServiceFilter();
      renderContent();
      openDetail('process', ids.process.intake);
      toast('Jeu de donnees exemple injecte');
    }

    function getByType(type) {
      if (type === 'community') return state.collections.communities;
      if (type === 'service') return state.collections.services;
      if (type === 'group') return state.collections.groups;
      if (type === 'agent') return state.collections.agents;
      if (type === 'role') return state.collections.roles;
      if (type === 'process') return state.collections.processes;
      if (type === 'step') return state.collections.steps;
      if (type === 'flow') return state.collections.flows;
      if (type === 'template') return state.collections.templates;
      if (type === 'metric') return state.collections.metrics;
      if (type === 'task') return state.collections.tasks;
      if (type === 'procedure') return state.collections.procedures;
      if (type === 'software') return state.collections.software;
      if (type === 'contingencyPlan') return state.collections.contingencyPlans;
      return [];
    }

    function getMaps() {
      const serviceById = new Map(state.collections.services.map((item) => [item.id, item]));
      const groupById = new Map(state.collections.groups.map((item) => [item.id, item]));
      const agentById = new Map(state.collections.agents.map((item) => [item.id, item]));
      const roleById = new Map(state.collections.roles.map((item) => [item.id, item]));
      const processById = new Map(state.collections.processes.map((item) => [item.id, item]));
      const stepById = new Map(state.collections.steps.map((item) => [item.id, item]));
      const procedureById = new Map(state.collections.procedures.map((item) => [item.id, item]));
      const softwareById = new Map(state.collections.software.map((item) => [item.id, item]));
      const communityById = new Map(state.collections.communities.map((item) => [item.id, item]));
      return {
        serviceById,
        groupById,
        agentById,
        roleById,
        processById,
        stepById,
        procedureById,
        softwareById,
        communityById
      };
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
      console.log('[PERMISSIONS] canEditWorkflow:', editable, 'state.permissions:', state.permissions);
      [
        'btn-workflow-add-community',
        'btn-workflow-add-service',
        'btn-workflow-add-group',
        'btn-workflow-add-agent',
        'btn-workflow-add-role',
        'btn-workflow-add-process',
        'btn-workflow-add-template',
        'btn-workflow-add-step',
        'btn-workflow-add-flow',
        'btn-workflow-add-task',
        'btn-workflow-add-procedure',
        'btn-workflow-add-software',
        'btn-workflow-add-contingency-plan',
        'btn-workflow-migrate-agent-users',
        'btn-workflow-inject-org-model'
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
      clearWorkflowInlineSaveTimers();
      state.flowDesigner.sourceStepId = null;
      state.flowDesigner.selectedFlowId = null;
      state.flowDesigner.selectedFlowIds = [];
      state.flowDesigner.multiSelectMode = false;
      state.flowDesigner.linkMode = false;
      state.flowDesigner.dragSourceStepId = null;
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
      if (viewKey === 'processes') return 'Processus';
      if (viewKey === 'templates') return 'Modeles de processus';
      if (viewKey === 'tasks') return 'Taches';
      if (viewKey === 'kanban') return 'Kanban';
      if (viewKey === 'timeline') return 'Timeline';
      if (viewKey === 'procedures') return 'Procedures';
      if (viewKey === 'software') return 'Logiciels metiers';
      if (viewKey === 'contingency') return 'Contingence';
      if (viewKey === 'analytics') return 'Analyse';
      if (viewKey === 'governance') return 'Gouvernance';
      if (viewKey === 'journal') return 'Journal';
      return 'Workflow';
    }

    function renderBreadcrumbs() {
      if (!refs.breadcrumbs) return;
      const grpLabel = groupLabel(state.activeGroup);
      const crumbs = grpLabel
        ? ['Workflow', grpLabel, viewLabel(state.activeView)]
        : ['Workflow', viewLabel(state.activeView)];
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
        icon: 'visibility',
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
      if (safeType === 'contingencyPlan' && editable) {
        actions.push({ action: 'contingency-activate', label: 'Activer', icon: 'warning' });
      }

      if (safeType === 'process' && editable) {
        actions.push({ action: 'process-export', label: 'Exporter fiche', icon: 'picture_as_pdf' });
        actions.push({ action: 'create-template', label: 'Creer modele', icon: 'content_copy' });
        actions.push({ action: 'process-submit-review', label: 'Soumettre', icon: 'rate_review' });
      }

      if (safeType === 'service' || safeType === 'agent' || safeType === 'software') {
        actions.push({ action: 'entity-export', label: 'Exporter fiche', icon: 'picture_as_pdf' });
      }

      if (safeType === 'template' && editable) {
        actions.push({ action: 'instantiate-template', label: 'Instancier modele', icon: 'library_add' });
        actions.push({ action: 'template-create-variant', label: 'Creer variante', icon: 'call_split' });
        if (status === 'archived') {
          actions.push({ action: 'template-unarchive', label: 'Reactiver', icon: 'unarchive' });
        } else {
          actions.push({ action: 'template-publish', label: 'Publier', icon: 'publish' });
          actions.push({ action: 'template-archive', label: 'Archiver', icon: 'archive' });
        }
      }

      if ((safeType === 'task' || safeType === 'procedure' || safeType === 'software' || safeType === 'process' || safeType === 'step' || safeType === 'flow' || safeType === 'role' || safeType === 'template' || safeType === 'contingencyPlan') && editable) {
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
              ${actionMode === 'text' ? '' : `<span class="material-symbols-outlined" aria-hidden="true">${esc(entry.icon || 'more_horiz')}</span>`}
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
      renderMapMinimap();
    }

    function renderMapMinimap() {
      const minimap = refs.content?.querySelector('[data-wf-map-minimap]');
      if (!minimap) return;
      const viewport = refs.content?.querySelector('[data-wf-map-viewport]');
      const canvas = refs.content?.querySelector('[data-wf-map-canvas]');
      const nodesLayer = refs.content?.querySelector('[data-wf-map-minimap-nodes]');
      const viewportMarker = refs.content?.querySelector('[data-wf-map-minimap-viewport]');
      if (!viewport || !canvas || !nodesLayer || !viewportMarker) return;

      minimap.classList.toggle('hidden', state.mapOptions?.showMinimap === false);
      if (state.mapOptions?.showMinimap === false) return;

      const canvasWidth = Math.max(1, Number(canvas.scrollWidth || canvas.getBoundingClientRect().width || 1));
      const canvasHeight = Math.max(1, Number(canvas.scrollHeight || canvas.getBoundingClientRect().height || 1));
      const zoom = clampMapZoom(state.mapOptions?.zoom || 1);
      const panX = Number(state.mapOptions?.panX || 0);
      const panY = Number(state.mapOptions?.panY || 0);
      const visibleX = Math.max(0, -panX / zoom);
      const visibleY = Math.max(0, -panY / zoom);
      const visibleW = Math.max(1, Number(viewport.clientWidth || 1) / zoom);
      const visibleH = Math.max(1, Number(viewport.clientHeight || 1) / zoom);

      const vx = (visibleX / canvasWidth) * 100;
      const vy = (visibleY / canvasHeight) * 100;
      const vw = (visibleW / canvasWidth) * 100;
      const vh = (visibleH / canvasHeight) * 100;
      viewportMarker.style.left = `${Math.max(0, Math.min(100, vx))}%`;
      viewportMarker.style.top = `${Math.max(0, Math.min(100, vy))}%`;
      viewportMarker.style.width = `${Math.max(2, Math.min(100, vw))}%`;
      viewportMarker.style.height = `${Math.max(2, Math.min(100, vh))}%`;

      const typeColor = {
        community: '#0f766e',
        service: '#1d4ed8',
        group: '#7c3aed',
        agent: '#f59e0b',
        process: '#2563eb',
        step: '#16a34a'
      };
      const canvasRect = canvas.getBoundingClientRect();
      const dots = refs.content?.querySelectorAll('[data-wf-col-type]') || [];
      const dotHtml = Array.from(dots).map((node) => {
        const type = String(node.getAttribute('data-wf-col-type') || '').trim();
        const rect = node.getBoundingClientRect();
        const relX = Math.max(0, rect.left - canvasRect.left);
        const relY = Math.max(0, rect.top - canvasRect.top);
        const relW = Math.max(1, rect.width);
        const relH = Math.max(1, rect.height);
        const x = (relX / canvasWidth) * 100;
        const y = (relY / canvasHeight) * 100;
        const w = (relW / canvasWidth) * 100;
        const h = (relH / canvasHeight) * 100;
        const color = typeColor[type] || '#64748b';
        return `<span class="workflow-map-minimap-node" style="left:${Math.max(0, Math.min(100, x))}%;top:${Math.max(0, Math.min(100, y))}%;width:${Math.max(2, Math.min(100, w))}%;height:${Math.max(2, Math.min(100, h))}%;background:${esc(color)}1f;border-color:${esc(color)}66;"></span>`;
      }).join('');
      nodesLayer.innerHTML = dotHtml;
    }

    function autoLayoutMapView() {
      const viewport = refs.content?.querySelector('[data-wf-map-viewport]');
      const canvas = refs.content?.querySelector('[data-wf-map-canvas]');
      if (!viewport || !canvas) return;
      const canvasW = Math.max(1, Number(canvas.scrollWidth || 1));
      const canvasH = Math.max(1, Number(canvas.scrollHeight || 1));
      const viewportW = Math.max(1, Number(viewport.clientWidth || 1));
      const viewportH = Math.max(1, Number(viewport.clientHeight || 1));
      const fitZoom = clampMapZoom(Math.min(viewportW / canvasW, viewportH / canvasH) * 0.96);
      state.mapOptions.zoom = fitZoom;
      state.mapOptions.panX = Math.round((viewportW - canvasW * fitZoom) / 2);
      state.mapOptions.panY = Math.round((viewportH - canvasH * fitZoom) / 2);
      applyMapTransform();
      persistLayout().catch(() => null);
    }

    function exportMapAsPdf() {
      const shell = refs.content?.querySelector('.workflow-map-shell');
      if (!shell) {
        toast('Aucune carte metier a exporter');
        return;
      }
      const clone = shell.cloneNode(true);
      clone.querySelectorAll('.workflow-map-toolbar,.workflow-map-link-filters,.workflow-map-minimap-wrap,[data-wf-map-minimap]').forEach((node) => node.remove());
      clone.querySelectorAll('[data-wf-map-canvas]').forEach((node) => {
        node.style.transform = 'none';
      });
      const exportedAt = new Date().toLocaleString();
      const html = `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8"><title>Carte metier workflow</title>
<style>
body{font-family:Arial,sans-serif;padding:12px;color:#0f172a}
.head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px}
.title{margin:0;font-size:18px;font-weight:800}
.meta{margin:0;font-size:12px;color:#475569}
.workflow-map{display:grid;grid-template-columns:repeat(3,minmax(200px,1fr));gap:8px}
.workflow-map-col,.workflow-map-links-col{break-inside:avoid;border:1px solid #cbd5e1;border-radius:10px;padding:8px;background:#fff}
.workflow-map-links{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:8px;margin-top:8px}
.workflow-map-list,.workflow-map-links-col ul{margin:0;padding-left:16px}
@page{size:A4 landscape;margin:9mm;}
</style></head><body>
<div class="head"><h1 class="title">Carte metier workflow</h1><p class="meta">Export du ${esc(exportedAt)}</p></div>
${clone.outerHTML}
<script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print();},220));</script>
</body></html>`;
      printHtmlWithPopupOrIframe(html, {
        popupFeatures: 'noopener,noreferrer,width=1320,height=920'
      });
    }

    async function exportMapAsImage() {
      const viewport = refs.content?.querySelector('[data-wf-map-viewport]');
      const canvasSource = refs.content?.querySelector('[data-wf-map-canvas]');
      if (!viewport || !canvasSource) {
        toast('Aucune carte metier a exporter');
        return;
      }
      try {
        const clone = canvasSource.cloneNode(true);
        clone.style.transform = 'none';
        clone.style.padding = '10px';
        const width = Math.max(900, Number(clone.scrollWidth || canvasSource.scrollWidth || 900));
        const height = Math.max(560, Number(clone.scrollHeight || canvasSource.scrollHeight || 560));
        const html = `<div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;background:#ffffff;color:#0f172a;width:${width}px;height:${height}px;">${clone.outerHTML}</div>`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${html}</foreignObject></svg>`;
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const image = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D indisponible');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) {
            toast('Echec export image');
            return;
          }
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const dlUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = dlUrl;
          a.download = `workflow-map-${ts}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(dlUrl);
          toast('Export PNG genere');
        }, 'image/png');
      } catch (error) {
        console.error('workflow exportMapAsImage', error);
        toast('Export PNG indisponible sur ce navigateur');
      }
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

    function buildMapRelations({ services, groups, agents, processes, steps, flows, tasks, maps }) {
      if (global.TaskMDAWorkflowGraph?.buildMapRelations) {
        return global.TaskMDAWorkflowGraph.buildMapRelations({ services, groups, agents, processes, steps, flows, tasks, maps });
      }
      const serviceIds = new Set((services || []).map((row) => String(row.id)));
      const groupIds = new Set((groups || []).map((row) => String(row.id)));
      const agentIds = new Set((agents || []).map((row) => String(row.id)));
      const processIds = new Set((processes || []).map((row) => String(row.id)));
      const stepIds = new Set((steps || []).map((row) => String(row.id)));
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

      (processes || []).forEach((process) => {
        if (process.serviceId && serviceIds.has(String(process.serviceId))) {
          structure.push({
            label: 'Service -> Processus',
            source: { type: 'service', id: process.serviceId, name: maps.serviceById.get(process.serviceId)?.name || process.serviceId },
            target: { type: 'process', id: process.id, name: process.title || process.id }
          });
        }
        if (process.ownerAgentId && agentIds.has(String(process.ownerAgentId))) {
          transverse.push({
            label: 'Agent -> Processus',
            source: { type: 'agent', id: process.ownerAgentId, name: maps.agentById.get(process.ownerAgentId)?.displayName || process.ownerAgentId },
            target: { type: 'process', id: process.id, name: process.title || process.id }
          });
        }
      });

      (steps || []).forEach((step) => {
        if (!stepIds.has(String(step.id))) return;
        if (step.processId && processIds.has(String(step.processId))) {
          structure.push({
            label: 'Processus -> Etape',
            source: { type: 'process', id: step.processId, name: maps.processById.get(step.processId)?.title || step.processId },
            target: { type: 'step', id: step.id, name: step.title || step.id }
          });
        }
        if (step.linkedTaskId && taskIds.has(String(step.linkedTaskId))) {
          applicative.push({
            label: 'Etape -> Tache',
            source: { type: 'step', id: step.id, name: step.title || step.id },
            target: { type: 'task', id: step.linkedTaskId, name: state.collections.tasks.find((row) => String(row.id) === String(step.linkedTaskId))?.title || step.linkedTaskId }
          });
        }
        if (step.linkedProcedureId) {
          applicative.push({
            label: 'Etape -> Procedure',
            source: { type: 'step', id: step.id, name: step.title || step.id },
            target: { type: 'procedure', id: step.linkedProcedureId, name: maps.procedureById.get(step.linkedProcedureId)?.title || step.linkedProcedureId }
          });
        }
        (step.linkedSoftwareIds || []).forEach((softwareId) => {
          applicative.push({
            label: 'Etape -> Logiciel',
            source: { type: 'step', id: step.id, name: step.title || step.id },
            target: { type: 'software', id: softwareId, name: maps.softwareById.get(softwareId)?.name || softwareId }
          });
        });
      });

      (flows || []).forEach((flow) => {
        if (!flow.fromStepId || !flow.toStepId) return;
        if (!stepIds.has(String(flow.fromStepId)) || !stepIds.has(String(flow.toStepId))) return;
        transverse.push({
          label: `Flux ${flow.flowType || 'sequence'}`,
          source: { type: 'step', id: flow.fromStepId, name: maps.stepById.get(flow.fromStepId)?.title || flow.fromStepId },
          target: { type: 'step', id: flow.toStepId, name: maps.stepById.get(flow.toStepId)?.title || flow.toStepId }
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
      const processes = applyFilters(state.collections.processes, (item) => ({
        serviceId: item.serviceId,
        groupId: item.groupId,
        agentId: item.ownerAgentId
      }));
      const steps = applyFilters(state.collections.steps, (item) => ({
        serviceId: item.serviceId,
        groupId: item.groupId,
        agentId: item.ownerAgentId
      }));
      const flows = applyFilters(state.collections.flows, () => 'all');
      const tasks = filterTasksByStatus(applyFilters(state.collections.tasks, (item) => ({
        serviceId: item.serviceId,
        groupId: item.groupId,
        agentId: item.ownerAgentId
      })));
      const relations = buildMapRelations({ services, groups, agents, processes, steps, flows, tasks, maps });
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
              <button type="button" class="workflow-org-action" data-wf-map-action="auto_layout">Auto-layout</button>
              <button type="button" class="workflow-org-action" data-wf-map-action="export_image">Export PNG</button>
              <button type="button" class="workflow-org-action" data-wf-map-action="export_pdf">Export PDF</button>
              <span class="workflow-map-zoom" data-wf-map-zoom-label>100%</span>
            </div>
            <div class="workflow-map-legend">
              <label><input type="checkbox" data-wf-map-toggle="showStructure" checked> Structure</label>
              <label><input type="checkbox" data-wf-map-toggle="showTransverse" checked> Transverses</label>
              <label><input type="checkbox" data-wf-map-toggle="showApplicative" checked> Applicatives</label>
              <label><input type="checkbox" data-wf-map-toggle="showMinimap" checked> Mini-carte</label>
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
                ${col('Processus', 'process', processes, (item) => `${item.status || 'draft'} - ${maps.serviceById.get(item.serviceId)?.name || 'Sans service'}`)}
                ${col('Etapes', 'step', steps, (item) => `${item.stepType || 'action'} - ${maps.processById.get(item.processId)?.title || 'Sans processus'}`)}
              </div>
            </div>
          </div>
          <div class="workflow-map-links">
            ${state.mapOptions.showStructure ? relationSectionHtml('Liaisons structurelles', preparedRelations.structure, '→', 'showAllStructure', 'structureVisible', 'structure', 'is-structure') : ''}
            ${state.mapOptions.showTransverse ? relationSectionHtml('Liaisons transverses', preparedRelations.transverse, '↔', 'showAllTransverse', 'transverseVisible', 'transverse', 'is-transverse') : ''}
            ${state.mapOptions.showApplicative ? relationSectionHtml('Liaisons applicatives', preparedRelations.applicative, '→', 'showAllApplicative', 'applicativeVisible', 'applicative', 'is-applicative') : ''}
          </div>
          <div class="workflow-map-minimap-wrap ${state.mapOptions.showMinimap === false ? 'hidden' : ''}" data-wf-map-minimap>
            <div class="workflow-map-minimap-surface" data-wf-map-minimap-surface title="Cliquer pour recentrer">
              <div class="workflow-map-minimap-nodes" data-wf-map-minimap-nodes></div>
              <div class="workflow-map-minimap-viewport" data-wf-map-minimap-viewport></div>
            </div>
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
      printHtmlWithPopupOrIframe(html, {
        popupFeatures: `noopener,noreferrer,width=${mode === 'portrait' ? 1000 : 1320},height=920`
      });
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
      printHtmlWithPopupOrIframe(html, {
        popupFeatures: 'noopener,noreferrer,width=1320,height=920'
      });
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
        return cardHtml('agent', item.id, item.displayName || 'Agent', `${item.title || 'Poste'} - ${serviceName}`, [`${taskCount} taches`, `Manager: ${managerName}`, `${reports} rattaches`], buildQuickCardActions('agent', item.id));
      });
      refs.content.innerHTML = `<div class="workflow-grid">${cards.join('') || '<div class="workflow-empty">Aucun agent</div>'}</div>`;
    }

    function renderProcessesView() {
      const maps = getMaps();
      const candidates = applyFilters(state.collections.processes, (item) => ({
        serviceId: item.serviceId,
        groupId: item.groupId,
        agentId: item.ownerAgentId
      }));

      const cards = candidates.map((item) => {
        const processSteps = state.collections.steps.filter((step) => String(step.processId || '') === String(item.id || ''));
        const processFlows = state.collections.flows.filter((flow) => String(flow.processId || '') === String(item.id || ''));
        const todoTasks = state.collections.tasks.filter((task) => String(task.processId || '') === String(item.id || '')).length;
        const ownerName = maps.agentById.get(item.ownerAgentId)?.displayName || 'Non assigne';
        const serviceName = maps.serviceById.get(item.serviceId)?.name || 'Sans service';
        const status = String(item.status || 'draft');
        const validation = item?.validation || {};
        const chips = [
          serviceName,
          ownerName,
          `Statut: ${status}`,
          `Validation ${Number(validation.level || 0)}/${Number(validation.requiredLevels || 2)}`,
          `${processSteps.length} etapes`,
          `${processFlows.length} flux`,
          `${todoTasks} taches`
        ];
        return cardHtml('process', item.id, item.title || 'Processus', item.description || '', chips);
      });

      refs.content.innerHTML = `<div class="workflow-grid">${cards.join('') || '<div class="workflow-empty">Aucun processus workflow</div>'}</div>`;
    }

    function renderTemplatesView() {
      const templates = state.collections.templates || [];
      const cards = applyFilters(state.collections.templates, (item) => ({
        serviceId: item.serviceId,
        groupId: item.groupId,
        agentId: item.ownerAgentId
      })).map((item) => {
        const stepCount = Array.isArray(item.templateSteps) ? item.templateSteps.length : 0;
        const flowCount = Array.isArray(item.templateFlows) ? item.templateFlows.length : 0;
        const variantGroupKey = String(item.variantGroupKey || '').trim();
        const variantCount = variantGroupKey
          ? templates.filter((row) => String(row.variantGroupKey || '') === variantGroupKey).length
          : 0;
        const isVariant = !!String(item.parentTemplateId || '').trim();
        return cardHtml(
          'template',
          item.id,
          item.name || 'Modele',
          item.description || '',
          [
            item.status || 'draft',
            `${stepCount} etapes`,
            `${flowCount} flux`,
            `${Array.isArray(item.tags) ? item.tags.length : 0} tags`,
            isVariant ? `Variante (${variantGroupKey || '-'})` : (variantCount > 0 ? `${variantCount} variantes` : 'Modele racine')
          ],
          buildQuickCardActions('template', item.id, { status: item.status || 'draft' })
        );
      });
      refs.content.innerHTML = `<div class="workflow-grid">${cards.join('') || '<div class="workflow-empty">Aucun modele de processus</div>'}</div>`;
    }

    function renderAnalyticsView() {
      const processes = state.collections.processes || [];
      const steps = state.collections.steps || [];
      const flows = state.collections.flows || [];
      const tasks = state.collections.tasks || [];
      const procedures = state.collections.procedures || [];
      const software = state.collections.software || [];
      const agents = state.collections.agents || [];
      const services = state.collections.services || [];
      const metrics = state.collections.metrics || [];
      const maps = getMaps();

      const published = processes.filter((p) => String(p.status || '') === 'published').length;
      const inReview = processes.filter((p) => String(p.status || '') === 'review').length;
      const unassignedSteps = steps.filter((s) => !s.ownerAgentId && !s.roleId).length;
      const orphanTasks = tasks.filter((t) => !t.processId).length;
      const softwareWithoutProcedureList = software.filter((sw) => {
        const linked = procedures.some((pr) => Array.isArray(pr.linkedSoftwareIds) && pr.linkedSoftwareIds.includes(sw.id));
        return !linked;
      });
      const softwareWithoutProcedure = softwareWithoutProcedureList.length;

      const periodKey = new Date().toISOString().slice(0, 10);
      const metricPayloads = [
        { metricKey: 'process_total', value: processes.length },
        { metricKey: 'process_published', value: published },
        { metricKey: 'process_review', value: inReview },
        { metricKey: 'step_unassigned', value: unassignedSteps },
        { metricKey: 'task_orphan', value: orphanTasks },
        { metricKey: 'software_without_procedure', value: softwareWithoutProcedure }
      ];
      metricPayloads.forEach((metric) => {
        api.put('workflowMetrics', {
          id: `wf-metric-${metric.metricKey}-${periodKey}`,
          metricKey: metric.metricKey,
          periodKey,
          value: Number(metric.value || 0),
          source: 'analytics_view',
          updatedAt: now()
        }, STORE_KEY_FIELDS.workflowMetrics).catch(() => null);
      });

      const processByService = new Map();
      processes.forEach((p) => {
        const key = String(p.serviceId || 'none');
        processByService.set(key, (processByService.get(key) || 0) + 1);
      });
      const serviceRows = services.map((service) => {
        const count = processByService.get(String(service.id)) || 0;
        return `<tr><td class="px-2 py-1">${esc(service.name || service.id)}</td><td class="px-2 py-1 text-right">${count}</td></tr>`;
      }).join('');

      const processSoftwareRows = processes.map((process) => {
        const processSteps = steps.filter((row) => String(row.processId || '') === String(process.id || ''));
        const softwareIds = new Set();
        processSteps.forEach((step) => {
          (Array.isArray(step.linkedSoftwareIds) ? step.linkedSoftwareIds : []).forEach((softwareId) => {
            const safeId = String(softwareId || '').trim();
            if (safeId) softwareIds.add(safeId);
          });
          if (step.linkedProcedureId) {
            const linkedProcedure = procedures.find((row) => String(row.id) === String(step.linkedProcedureId));
            if (linkedProcedure && Array.isArray(linkedProcedure.linkedSoftwareIds)) {
              linkedProcedure.linkedSoftwareIds.forEach((softwareId) => {
                const safeId = String(softwareId || '').trim();
                if (safeId) softwareIds.add(safeId);
              });
            }
          }
        });
        return `<tr><td class="px-2 py-1">${esc(process.title || process.id)}</td><td class="px-2 py-1 text-right">${softwareIds.size}</td></tr>`;
      }).join('');

      const responsibilityRows = agents.map((agent) => {
        const ownedProcesses = processes.filter((p) => p.ownerAgentId === agent.id).length;
        const ownedSteps = steps.filter((s) => s.ownerAgentId === agent.id).length;
        return `<tr><td class="px-2 py-1">${esc(agent.displayName || agent.id)}</td><td class="px-2 py-1 text-right">${ownedProcesses}</td><td class="px-2 py-1 text-right">${ownedSteps}</td></tr>`;
      }).join('');

      const unassignedStepRows = steps
        .filter((step) => !step.ownerAgentId && !step.roleId)
        .map((step) => {
          const processName = maps.processById.get(step.processId)?.title || step.processId || '-';
          return `<tr><td class="px-2 py-1">${esc(step.title || step.id)}</td><td class="px-2 py-1">${esc(processName)}</td></tr>`;
        }).join('');

      const softwareWithoutProcedureRows = softwareWithoutProcedureList.map((sw) =>
        `<tr><td class="px-2 py-1">${esc(sw.name || sw.id)}</td><td class="px-2 py-1">${esc(sw.category || '-')}</td></tr>`
      ).join('');

      const incompleteProcessRows = processes
        .map((process) => {
          const pid = String(process.id || '');
          const processSteps = steps.filter((step) => String(step.processId || '') === pid);
          const processFlows = flows.filter((flow) => String(flow.processId || '') === pid);
          const missing = [];
          if (!process.ownerAgentId) missing.push('responsable');
          if (!processSteps.length) missing.push('etapes');
          if (processSteps.length > 1 && !processFlows.length) missing.push('flux');
          if (String(process.status || '') === 'review') {
            const validation = normalizeProcessValidation(process.validation);
            if (!validation.requiredRoleIds.length) missing.push('roles approbateurs');
          }
          return { process, missing };
        })
        .filter((row) => row.missing.length > 0)
        .map((row) =>
          `<tr><td class="px-2 py-1">${esc(row.process.title || row.process.id)}</td><td class="px-2 py-1">${esc(row.missing.join(', '))}</td></tr>`
        )
        .join('');

      const criticalDependencyRows = flows
        .map((flow) => {
          const flowType = String(flow.flowType || 'sequence').toLowerCase();
          const fromStep = maps.stepById.get(flow.fromStepId);
          const toStep = maps.stepById.get(flow.toStepId);
          const fromOwner = String(fromStep?.ownerAgentId || '').trim();
          const toOwner = String(toStep?.ownerAgentId || '').trim();
          const fromService = String(fromStep?.serviceId || '').trim();
          const toService = String(toStep?.serviceId || '').trim();
          const crossService = !!(fromService && toService && fromService !== toService);
          const ownerGap = !fromOwner || !toOwner;
          const exceptionPath = flowType === 'exception';
          const decisionPath = flowType === 'decision';
          const critical = crossService || ownerGap || exceptionPath || decisionPath;
          return {
            flow,
            critical,
            reason: [
              crossService ? 'inter-service' : null,
              ownerGap ? 'owner manquant' : null,
              exceptionPath ? 'exception' : null,
              decisionPath ? 'decision' : null
            ].filter(Boolean).join(', ')
          };
        })
        .filter((row) => row.critical)
        .slice(0, 50)
        .map((row) => {
          const fromName = maps.stepById.get(row.flow.fromStepId)?.title || row.flow.fromStepId || '-';
          const toName = maps.stepById.get(row.flow.toStepId)?.title || row.flow.toStepId || '-';
          return `<tr><td class="px-2 py-1">${esc(fromName)}</td><td class="px-2 py-1">${esc(toName)}</td><td class="px-2 py-1">${esc(row.reason || '-')}</td></tr>`;
        }).join('');

      refs.content.innerHTML = `
        <div class="workflow-detail-actions mb-3">
          <button type="button" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" data-wf-analytics-action="export-json">Exporter gouvernance JSON</button>
          <button type="button" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" data-wf-analytics-action="export-csv">Exporter gouvernance CSV</button>
          <button type="button" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" data-wf-analytics-action="export-model-json">Exporter modele JSON</button>
          <button type="button" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" data-wf-analytics-action="export-synthesis-csv">Exporter synthese CSV</button>
        </div>
        <div class="workflow-grid">
          <article class="workflow-card"><p class="workflow-card-title">Processus publies</p><p class="workflow-card-sub">${published}</p></article>
          <article class="workflow-card"><p class="workflow-card-title">Processus en revue</p><p class="workflow-card-sub">${inReview}</p></article>
          <article class="workflow-card"><p class="workflow-card-title">Etapes non affectees</p><p class="workflow-card-sub">${unassignedSteps}</p></article>
          <article class="workflow-card"><p class="workflow-card-title">Taches hors processus</p><p class="workflow-card-sub">${orphanTasks}</p></article>
          <article class="workflow-card"><p class="workflow-card-title">Logiciels sans procedure</p><p class="workflow-card-sub">${softwareWithoutProcedure}</p></article>
          <article class="workflow-card"><p class="workflow-card-title">Couverture moyenne</p><p class="workflow-card-sub">${processes.length ? Math.round((steps.length / processes.length) * 100) / 100 : 0} etapes/processus</p></article>
        </div>
        <div class="workflow-map" style="margin-top: 0.8rem;">
          <section class="workflow-map-col">
            <h6>Matrice processus x services</h6>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead><tr><th class="px-2 py-1 text-left">Service</th><th class="px-2 py-1 text-right">Processus</th></tr></thead>
                <tbody>${serviceRows || '<tr><td class="px-2 py-1 text-slate-500" colspan="2">Aucune donnee</td></tr>'}</tbody>
              </table>
            </div>
          </section>
          <section class="workflow-map-col">
            <h6>Matrice agents x responsabilites</h6>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead><tr><th class="px-2 py-1 text-left">Agent</th><th class="px-2 py-1 text-right">Processus</th><th class="px-2 py-1 text-right">Etapes</th></tr></thead>
                <tbody>${responsibilityRows || '<tr><td class="px-2 py-1 text-slate-500" colspan="3">Aucune donnee</td></tr>'}</tbody>
              </table>
            </div>
          </section>
        </div>
        <div class="workflow-map" style="margin-top: 0.8rem;">
          <section class="workflow-map-col">
            <h6>Matrice processus x logiciels</h6>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead><tr><th class="px-2 py-1 text-left">Processus</th><th class="px-2 py-1 text-right">Logiciels</th></tr></thead>
                <tbody>${processSoftwareRows || '<tr><td class="px-2 py-1 text-slate-500" colspan="2">Aucune donnee</td></tr>'}</tbody>
              </table>
            </div>
          </section>
          <section class="workflow-map-col">
            <h6>Dependances critiques (flux)</h6>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead><tr><th class="px-2 py-1 text-left">Source</th><th class="px-2 py-1 text-left">Cible</th><th class="px-2 py-1 text-left">Raison</th></tr></thead>
                <tbody>${criticalDependencyRows || '<tr><td class="px-2 py-1 text-slate-500" colspan="3">Aucune dependance critique</td></tr>'}</tbody>
              </table>
            </div>
          </section>
        </div>
        <div class="workflow-map" style="margin-top: 0.8rem;">
          <section class="workflow-map-col">
            <h6>Indicateurs structure</h6>
            <ul class="workflow-map-list">
              <li class="workflow-map-item"><strong>${esc(String(processes.length))}</strong> processus</li>
              <li class="workflow-map-item"><strong>${esc(String(steps.length))}</strong> etapes</li>
              <li class="workflow-map-item"><strong>${esc(String(flows.length))}</strong> flux</li>
              <li class="workflow-map-item"><strong>${esc(String(tasks.filter((t) => t.processId).length))}</strong> taches reliees a un processus</li>
            </ul>
          </section>
          <section class="workflow-map-col">
            <h6>Historique metriques (7 derniers)</h6>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead><tr><th class="px-2 py-1 text-left">Date</th><th class="px-2 py-1 text-left">Cle</th><th class="px-2 py-1 text-right">Valeur</th></tr></thead>
                <tbody>
                  ${metrics.slice().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, 7).map((row) => `
                    <tr>
                      <td class="px-2 py-1">${esc(String(row.periodKey || '-'))}</td>
                      <td class="px-2 py-1">${esc(String(row.metricKey || '-'))}</td>
                      <td class="px-2 py-1 text-right">${esc(String(row.value ?? ''))}</td>
                    </tr>
                  `).join('') || '<tr><td class="px-2 py-1 text-slate-500" colspan="3">Aucune metrique</td></tr>'}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div class="workflow-map" style="margin-top: 0.8rem;">
          <section class="workflow-map-col">
            <h6>Etapes sans responsable</h6>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead><tr><th class="px-2 py-1 text-left">Etape</th><th class="px-2 py-1 text-left">Processus</th></tr></thead>
                <tbody>${unassignedStepRows || '<tr><td class="px-2 py-1 text-slate-500" colspan="2">Aucune etape non affectee</td></tr>'}</tbody>
              </table>
            </div>
          </section>
          <section class="workflow-map-col">
            <h6>Logiciels sans procedure</h6>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead><tr><th class="px-2 py-1 text-left">Logiciel</th><th class="px-2 py-1 text-left">Categorie</th></tr></thead>
                <tbody>${softwareWithoutProcedureRows || '<tr><td class="px-2 py-1 text-slate-500" colspan="2">Tous les logiciels sont relies a au moins une procedure</td></tr>'}</tbody>
              </table>
            </div>
          </section>
        </div>
        <div class="workflow-map" style="margin-top: 0.8rem;">
          <section class="workflow-map-col">
            <h6>Processus incomplets</h6>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead><tr><th class="px-2 py-1 text-left">Processus</th><th class="px-2 py-1 text-left">Elements manquants</th></tr></thead>
                <tbody>${incompleteProcessRows || '<tr><td class="px-2 py-1 text-slate-500" colspan="2">Aucun processus incomplet detecte</td></tr>'}</tbody>
              </table>
            </div>
          </section>
        </div>
      `;
    }

    function renderGovernanceView() {
      const maps = getMaps();
      const processes = applyFilters(state.collections.processes, (item) => ({
        serviceId: item.serviceId,
        groupId: item.groupId,
        agentId: item.ownerAgentId
      }));
      const today = todayIsoDate();
      const dayMs = 24 * 60 * 60 * 1000;
      const softwareById = new Map((state.collections.software || []).map((row) => [String(row.id || ''), row]));
      const profileById = new Map((state.collections.permissionProfiles || []).map((row) => [String(row.id || ''), row]));
      const filterSoftwareId = String(state.governancePermissionSoftwareFilter || 'all');
      const filterBeneficiaryType = String(state.governancePermissionBeneficiaryTypeFilter || 'all');
      const filterRequestStatus = String(state.governancePermissionRequestStatusFilter || 'all');
      const allPermissionAssignments = Array.isArray(state.collections.permissionAssignments) ? state.collections.permissionAssignments : [];
      const allPermissionRequests = Array.isArray(state.collections.permissionRequests) ? state.collections.permissionRequests : [];
      const allPermissionReviews = Array.isArray(state.collections.permissionReviews) ? state.collections.permissionReviews : [];
      const permissionAssignments = allPermissionAssignments.filter((row) => (
        matchesGovernancePermissionFilters(row, {
          softwareId: filterSoftwareId,
          beneficiaryType: filterBeneficiaryType,
          requestStatus: filterRequestStatus
        }, 'assignment')
      ));
      const permissionRequests = allPermissionRequests.filter((row) => (
        matchesGovernancePermissionFilters(row, {
          softwareId: filterSoftwareId,
          beneficiaryType: filterBeneficiaryType,
          requestStatus: filterRequestStatus
        }, 'request')
      ));
      const permissionReviews = allPermissionReviews.filter((row) => (
        matchesGovernancePermissionFilters(row, {
          softwareId: filterSoftwareId,
          beneficiaryType: filterBeneficiaryType,
          requestStatus: filterRequestStatus
        }, 'review')
      ));
      const alerts = [];
      const assignmentById = new Map(allPermissionAssignments.map((row) => [String(row.id || ''), row]));

      function daysFromTimestamp(timestamp) {
        const safeTs = Number(timestamp || 0);
        if (!safeTs || !Number.isFinite(safeTs)) return 0;
        return Math.max(0, Math.floor((Date.now() - safeTs) / dayMs));
      }

      processes.forEach((process) => {
        const pid = String(process.id || '');
        const title = process.title || pid;
        const validation = normalizeProcessValidation(process?.validation);
        const requiredLevels = validation.requiredLevels;
        const level = validation.level;
        const requiredRoleIds = validation.requiredRoleIds;
        const hasOwner = !!process.ownerAgentId;
        if (!hasOwner) {
          alerts.push({ severity: 'high', type: 'owner_missing', processId: pid, entityType: 'process', entityId: pid, message: `Processus sans responsable: ${title}` });
        }
        if (String(process.status || '') === 'review' && requiredRoleIds.length === 0) {
          alerts.push({ severity: 'high', type: 'approver_role_missing', processId: pid, entityType: 'process', entityId: pid, message: `Revue sans role approbateur requis: ${title}` });
        }
        if (String(process.status || '') === 'review' && level < requiredLevels) {
          alerts.push({ severity: 'medium', type: 'approval_pending', processId: pid, entityType: 'process', entityId: pid, message: `Validation en attente (${level}/${requiredLevels}): ${title}` });
        }
        if (String(process.status || '') === 'review') {
          const currentTarget = Math.max(1, Math.min(requiredLevels, level + 1));
          const levelRule = validation.levelRules[currentTarget - 1] || { quorum: 1 };
          const quorum = Math.max(1, Number(levelRule.quorum || 1) || 1);
          const approvalsAtLevel = validation.approvers.filter((entry) => Number(entry?.level || 0) === currentTarget).length;
          if (approvalsAtLevel < quorum) {
            alerts.push({ severity: 'high', type: 'approval_quorum_missing', processId: pid, entityType: 'process', entityId: pid, message: `Quorum niveau ${currentTarget} incomplet (${approvalsAtLevel}/${quorum}): ${title}` });
          }
        }
        const processSteps = (state.collections.steps || []).filter((step) => String(step.processId || '') === pid);
        const unassignedCount = processSteps.filter((step) => !step.ownerAgentId && !step.roleId).length;
        if (unassignedCount > 0) {
          alerts.push({ severity: 'high', type: 'step_unassigned', processId: pid, entityType: 'process', entityId: pid, message: `${unassignedCount} etape(s) non affectee(s): ${title}` });
        }
      });

      permissionAssignments.forEach((assignment) => {
        const assignmentId = String(assignment?.id || '').trim();
        if (!assignmentId) return;
        const softwareId = String(assignment.softwareId || '').trim();
        const softwareLabel = softwareById.get(softwareId)?.name || softwareId || 'Logiciel';
        const status = normalizePermissionStatus(assignment.status);
        const profileExists = !!profileById.get(String(assignment.profileId || ''));
        if (!profileExists) {
          alerts.push({
            severity: 'high',
            type: 'permission_profile_missing',
            entityType: 'software',
            entityId: softwareId,
            message: `Habilitation sans profil valide (${softwareLabel})`
          });
        }
        const endDate = normalizeIsoDate(assignment.endDate || '');
        if (endDate && endDate < today && status !== 'revoked') {
          alerts.push({
            severity: 'high',
            type: 'permission_assignment_expired',
            entityType: 'software',
            entityId: softwareId,
            message: `Habilitation expiree non retiree (${softwareLabel})`
          });
        }
        if (status === 'review_due') {
          alerts.push({
            severity: 'high',
            type: 'permission_review_due',
            entityType: 'software',
            entityId: softwareId,
            message: `Revue d habilitation a traiter (${softwareLabel})`
          });
        }
      });

      permissionRequests.forEach((request) => {
        const status = normalizePermissionRequestStatus(request.status);
        if (!['submitted', 'approved'].includes(status)) return;
        const softwareId = String(request.softwareId || '').trim();
        const softwareLabel = softwareById.get(softwareId)?.name || softwareId || 'Logiciel';
        const ageDays = daysFromTimestamp(request.requestedAt || request.updatedAt || request.createdAt || 0);
        if (status === 'submitted' && ageDays >= 3) {
          alerts.push({
            severity: ageDays >= 7 ? 'high' : 'medium',
            type: 'permission_request_stale',
            entityType: 'software',
            entityId: softwareId,
            message: `Demande soumise en attente depuis ${ageDays}j (${softwareLabel})`
          });
        }
        if (status === 'approved' && ageDays >= 2) {
          alerts.push({
            severity: 'medium',
            type: 'permission_request_execution_pending',
            entityType: 'software',
            entityId: softwareId,
            message: `Demande approuvee non executee depuis ${ageDays}j (${softwareLabel})`
          });
        }
      });

      permissionReviews.forEach((review) => {
        const decision = normalizePermissionReviewDecision(review.decision);
        if (decision !== 'pending') return;
        const assignment = assignmentById.get(String(review.assignmentId || ''));
        const softwareId = String(review.softwareId || assignment?.softwareId || '').trim();
        const softwareLabel = softwareById.get(softwareId)?.name || softwareId || 'Logiciel';
        const reviewDate = normalizeIsoDate(review.reviewDate || '');
        if (!reviewDate || reviewDate > today) return;
        alerts.push({
          severity: 'high',
          type: 'permission_review_pending',
          entityType: 'software',
          entityId: softwareId,
          message: `Revue automatique en attente (${softwareLabel}, ${reviewDate})`
        });
      });

      const highAlerts = alerts.filter((row) => row.severity === 'high');
      if (highAlerts.length) {
        const todayKey = new Date().toISOString().slice(0, 10);
        const storageKey = 'workflow.governance.alerts.seen.v1';
        let seenMap = {};
        try {
          const raw = global.localStorage?.getItem(storageKey) || '{}';
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') seenMap = parsed;
        } catch (error) {
          seenMap = {};
        }
        let dirty = false;
        highAlerts.slice(0, 10).forEach((alert) => {
          const dedupeKey = `${todayKey}:${String(alert.entityType || 'process')}:${String(alert.entityId || alert.processId || '')}:${String(alert.type || '')}`;
          if (seenMap[dedupeKey]) return;
          notifyInternal(`Alerte gouvernance: ${alert.message}`);
          seenMap[dedupeKey] = now();
          dirty = true;
        });
        const dayPrefix = `${todayKey}:`;
        Object.keys(seenMap).forEach((key) => {
          if (key.startsWith(dayPrefix)) return;
          delete seenMap[key];
          dirty = true;
        });
        if (dirty) {
          try {
            global.localStorage?.setItem(storageKey, JSON.stringify(seenMap));
          } catch (error) {
            // ignore localStorage failures
          }
        }
      }

      const severityFilter = String(state.governanceFilter || 'all');
      const filteredAlerts = severityFilter === 'all' ? alerts : alerts.filter((row) => row.severity === severityFilter);

      const rows = processes.map((process) => {
        const validation = normalizeProcessValidation(process?.validation);
        const requiredLevels = validation.requiredLevels;
        const level = validation.level;
        const requiredRoleIds = validation.requiredRoleIds;
        const requiredRoleNames = requiredRoleIds.map((rid) => maps.roleById.get(rid)?.name || rid);
        const processAlerts = alerts.filter((row) => String(row.processId) === String(process.id || ''));
        const owner = maps.agentById.get(process.ownerAgentId)?.displayName || '-';
        const service = maps.serviceById.get(process.serviceId)?.name || '-';
        const canValidate = canValidateWorkflow(process);
        return `
          <tr class="${processAlerts.some((a) => a.severity === 'high') ? 'bg-rose-50' : ''}">
            <td class="px-2 py-1">${esc(process.title || process.id || '-')}</td>
            <td class="px-2 py-1">${esc(service)}</td>
            <td class="px-2 py-1">${esc(owner)}</td>
            <td class="px-2 py-1">${esc(process.status || 'draft')}</td>
            <td class="px-2 py-1 text-center">${esc(String(level))}/${esc(String(requiredLevels))}</td>
            <td class="px-2 py-1">${esc(requiredRoleNames.join(', ') || '-')}</td>
            <td class="px-2 py-1 text-center">${esc(String(processAlerts.length))}</td>
            <td class="px-2 py-1">
              <div class="flex gap-1">
                <button type="button" class="workflow-btn-light px-2 py-1 text-xs" data-wf-governance-action="open" data-wf-id="${esc(process.id)}">Ouvrir</button>
                <button type="button" class="workflow-btn-light px-2 py-1 text-xs" data-wf-governance-action="approve" data-wf-id="${esc(process.id)}" ${canValidate ? '' : 'disabled'} title="${canValidate ? 'Valider niveau' : 'Validation reservee'}">+1</button>
                <button type="button" class="workflow-btn-light px-2 py-1 text-xs" data-wf-governance-action="reject" data-wf-id="${esc(process.id)}" ${canValidate ? '' : 'disabled'} title="${canValidate ? 'Rejeter' : 'Validation reservee'}">Rejeter</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      const matrixBySoftwareMap = new Map();
      function ensureSoftwareMatrixRow(softwareId) {
        const sid = String(softwareId || '').trim();
        if (!matrixBySoftwareMap.has(sid)) {
          const name = softwareById.get(sid)?.name || sid || 'Logiciel non reference';
          matrixBySoftwareMap.set(sid, {
            softwareId: sid,
            softwareName: name,
            active: 0,
            reviewDue: 0,
            revoked: 0,
            expired: 0,
            submitted: 0,
            approved: 0,
            reviewsPending: 0
          });
        }
        return matrixBySoftwareMap.get(sid);
      }
      permissionAssignments.forEach((row) => {
        const bucket = ensureSoftwareMatrixRow(row.softwareId);
        const status = normalizePermissionStatus(row.status);
        if (status === 'active') bucket.active += 1;
        if (status === 'review_due') bucket.reviewDue += 1;
        if (status === 'revoked') bucket.revoked += 1;
        const endDate = normalizeIsoDate(row.endDate || '');
        if (endDate && endDate < today && status !== 'revoked') bucket.expired += 1;
      });
      permissionRequests.forEach((row) => {
        const bucket = ensureSoftwareMatrixRow(row.softwareId);
        const status = normalizePermissionRequestStatus(row.status);
        if (status === 'submitted') bucket.submitted += 1;
        if (status === 'approved') bucket.approved += 1;
      });
      permissionReviews.forEach((row) => {
        const bucket = ensureSoftwareMatrixRow(row.softwareId);
        if (normalizePermissionReviewDecision(row.decision) === 'pending') bucket.reviewsPending += 1;
      });
      const matrixSoftwareRows = Array.from(matrixBySoftwareMap.values())
        .sort((a, b) => String(a.softwareName || '').localeCompare(String(b.softwareName || ''), 'fr'))
        .map((row) => `
          <tr>
            <td class="px-2 py-1">${esc(row.softwareName)}</td>
            <td class="px-2 py-1 text-center">${esc(String(row.active))}</td>
            <td class="px-2 py-1 text-center">${esc(String(row.reviewDue))}</td>
            <td class="px-2 py-1 text-center">${esc(String(row.expired))}</td>
            <td class="px-2 py-1 text-center">${esc(String(row.submitted))}</td>
            <td class="px-2 py-1 text-center">${esc(String(row.approved))}</td>
            <td class="px-2 py-1 text-center">${esc(String(row.reviewsPending))}</td>
            <td class="px-2 py-1 text-right">
              ${row.softwareId ? `<button type="button" class="workflow-btn-light px-2 py-1 text-xs" data-wf-governance-action="open_software" data-wf-id="${esc(row.softwareId)}">Ouvrir</button>` : ''}
            </td>
          </tr>
        `).join('');

      const matrixByBeneficiaryMap = new Map();
      function ensureBeneficiaryMatrixRow(beneficiaryType, beneficiaryId) {
        const type = normalizePermissionBeneficiaryType(beneficiaryType);
        const id = String(beneficiaryId || '').trim();
        const key = `${type}:${id}`;
        if (!matrixByBeneficiaryMap.has(key)) {
          matrixByBeneficiaryMap.set(key, {
            key,
            beneficiaryType: type,
            beneficiaryId: id,
            label: resolvePermissionBeneficiaryLabel(type, id) || id || '-',
            softwareIds: new Set(),
            active: 0,
            reviewDue: 0,
            revoked: 0,
            pendingRequests: 0
          });
        }
        return matrixByBeneficiaryMap.get(key);
      }
      permissionAssignments.forEach((row) => {
        const bucket = ensureBeneficiaryMatrixRow(row.beneficiaryType, row.beneficiaryId);
        const softwareId = String(row.softwareId || '').trim();
        if (softwareId) bucket.softwareIds.add(softwareId);
        const status = normalizePermissionStatus(row.status);
        if (status === 'active') bucket.active += 1;
        if (status === 'review_due') bucket.reviewDue += 1;
        if (status === 'revoked') bucket.revoked += 1;
      });
      permissionRequests.forEach((row) => {
        const status = normalizePermissionRequestStatus(row.status);
        if (status !== 'submitted' && status !== 'approved') return;
        const bucket = ensureBeneficiaryMatrixRow(row.beneficiaryType, row.beneficiaryId);
        bucket.pendingRequests += 1;
      });
      const matrixBeneficiaryRows = Array.from(matrixByBeneficiaryMap.values())
        .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'fr'))
        .map((row) => `
          <tr>
            <td class="px-2 py-1">${esc(row.label)}</td>
            <td class="px-2 py-1">${esc(row.beneficiaryType)}</td>
            <td class="px-2 py-1 text-center">${esc(String(row.softwareIds.size))}</td>
            <td class="px-2 py-1 text-center">${esc(String(row.active))}</td>
            <td class="px-2 py-1 text-center">${esc(String(row.reviewDue))}</td>
            <td class="px-2 py-1 text-center">${esc(String(row.pendingRequests))}</td>
            <td class="px-2 py-1 text-right">
              <button type="button" class="workflow-btn-light px-2 py-1 text-xs" data-wf-governance-action="open_beneficiary" data-wf-beneficiary-type="${esc(row.beneficiaryType)}" data-wf-beneficiary-id="${esc(row.beneficiaryId)}">Ouvrir</button>
            </td>
          </tr>
        `).join('');
      const softwareFilterOptions = [
        `<option value="all" ${filterSoftwareId === 'all' ? 'selected' : ''}>Tous logiciels</option>`,
        ...Array.from(softwareById.values())
          .slice()
          .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'fr'))
          .map((row) => {
            const sid = String(row?.id || '');
            const selected = sid === filterSoftwareId ? 'selected' : '';
            return `<option value="${esc(sid)}" ${selected}>${esc(String(row?.name || sid))}</option>`;
          })
      ].join('');
      const beneficiaryTypeFilterOptions = [
        { value: 'all', label: 'Tous beneficiaires' },
        { value: 'agent', label: 'Agents' },
        { value: 'user', label: 'Utilisateurs' },
        { value: 'group', label: 'Groupes' },
        { value: 'role', label: 'Roles' }
      ].map((row) => `<option value="${esc(row.value)}" ${row.value === filterBeneficiaryType ? 'selected' : ''}>${esc(row.label)}</option>`).join('');
      const requestStatusFilterOptions = [
        { value: 'all', label: 'Tous statuts demandes' },
        ...PERMISSION_REQUEST_STATUS.map((status) => ({ value: status, label: permissionRequestStatusLabel(status) }))
      ].map((row) => `<option value="${esc(row.value)}" ${row.value === filterRequestStatus ? 'selected' : ''}>${esc(row.label)}</option>`).join('');

      refs.content.innerHTML = `
        <div class="workflow-detail-actions mb-3">
          <label class="workflow-form-label m-0">Filtre alertes</label>
          <select class="workflow-form-select max-w-[220px]" data-wf-governance-filter>
            <option value="all" ${severityFilter === 'all' ? 'selected' : ''}>Toutes</option>
            <option value="high" ${severityFilter === 'high' ? 'selected' : ''}>Bloquantes</option>
            <option value="medium" ${severityFilter === 'medium' ? 'selected' : ''}>Moyennes</option>
          </select>
          <select class="workflow-form-select max-w-[240px]" data-wf-governance-perm-software-filter>${softwareFilterOptions}</select>
          <select class="workflow-form-select max-w-[220px]" data-wf-governance-perm-beneficiary-filter>${beneficiaryTypeFilterOptions}</select>
          <select class="workflow-form-select max-w-[230px]" data-wf-governance-perm-request-status-filter>${requestStatusFilterOptions}</select>
          <button type="button" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" data-wf-governance-perm-reset="1">Reinitialiser filtres habilitations</button>
          <button type="button" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" data-wf-governance-export="json">Export JSON</button>
          <button type="button" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" data-wf-governance-export="csv">Export CSV</button>
          <button type="button" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" data-wf-governance-export="perm-matrix-csv">Export matrice habilitations CSV</button>
        </div>
        <div class="workflow-map">
          <section class="workflow-map-col">
            <h6>Alertes gouvernance (${filteredAlerts.length})</h6>
            <ul class="workflow-map-list">
              ${filteredAlerts.map((row) => `<li class="workflow-map-item ${row.severity === 'high' ? 'text-rose-700' : 'text-amber-700'}">${esc(row.message)}</li>`).join('') || '<li class="workflow-map-item text-emerald-700">Aucune alerte</li>'}
            </ul>
          </section>
        </div>
        <div class="workflow-map mt-3">
          <section class="workflow-map-col">
            <h6>Tableau de pilotage des validations</h6>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead>
                  <tr>
                    <th class="px-2 py-1 text-left">Processus</th>
                    <th class="px-2 py-1 text-left">Service</th>
                    <th class="px-2 py-1 text-left">Owner</th>
                    <th class="px-2 py-1 text-left">Statut</th>
                    <th class="px-2 py-1 text-center">Validation</th>
                    <th class="px-2 py-1 text-left">Roles requis</th>
                    <th class="px-2 py-1 text-center">Alertes</th>
                    <th class="px-2 py-1 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>${rows || '<tr><td class="px-2 py-1 text-slate-500" colspan="8">Aucun processus</td></tr>'}</tbody>
              </table>
            </div>
          </section>
        </div>
        <div class="workflow-map mt-3">
          <section class="workflow-map-col">
            <h6>Matrice transverse habilitations - par logiciel</h6>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead>
                  <tr>
                    <th class="px-2 py-1 text-left">Logiciel</th>
                    <th class="px-2 py-1 text-center">Actives</th>
                    <th class="px-2 py-1 text-center">A revoir</th>
                    <th class="px-2 py-1 text-center">Expirees</th>
                    <th class="px-2 py-1 text-center">Demandes soumises</th>
                    <th class="px-2 py-1 text-center">Demandes approuvees</th>
                    <th class="px-2 py-1 text-center">Revues en attente</th>
                    <th class="px-2 py-1 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>${matrixSoftwareRows || '<tr><td class="px-2 py-1 text-slate-500" colspan="8">Aucune donnee d habilitation</td></tr>'}</tbody>
              </table>
            </div>
          </section>
        </div>
        <div class="workflow-map mt-3">
          <section class="workflow-map-col">
            <h6>Matrice transverse habilitations - par beneficiaire</h6>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead>
                  <tr>
                    <th class="px-2 py-1 text-left">Beneficiaire</th>
                    <th class="px-2 py-1 text-left">Type</th>
                    <th class="px-2 py-1 text-center">Logiciels</th>
                    <th class="px-2 py-1 text-center">Actives</th>
                    <th class="px-2 py-1 text-center">A revoir</th>
                    <th class="px-2 py-1 text-center">Demandes en cours</th>
                    <th class="px-2 py-1 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>${matrixBeneficiaryRows || '<tr><td class="px-2 py-1 text-slate-500" colspan="7">Aucune donnee d habilitation</td></tr>'}</tbody>
              </table>
            </div>
          </section>
        </div>
      `;
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
        const process = maps.processById.get(item.processId)?.title || 'Sans processus';
        const prereqCount = Array.isArray(item.prerequisiteTaskIds) ? item.prerequisiteTaskIds.length : 0;
        const dependentCount = Array.isArray(item.dependentTaskIds) ? item.dependentTaskIds.length : 0;
        const checklist = normalizeChecklist(item);
        const doneCount = checklist.filter((entry) => entry.done).length;
        const bridgeCount = (item.linkedGlobalTaskIds || []).length + (item.linkedDocumentIds || []).length + (item.linkedThemeKeys || []).length + (item.linkedGroupKeys || []).length;
        const chips = [owner, process, procedure, item.status || 'todo', item.approvalStatus || 'pending', `${doneCount}/${checklist.length} checklist`, `${prereqCount} prerequis`, `${dependentCount} dependants`, `${bridgeCount} ponts`];
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
        const latestVersion = getLatestSoftwareVersionEntry(item);
        return cardHtml(
          'software',
          item.id,
          item.name || 'Logiciel',
          item.description || '',
          [`${item.category || 'Categorie'}`, latestVersion ? `v${latestVersion.version}` : 'Version n/d', `${links} taches`],
          buildQuickCardActions('software', item.id)
        );
      });
      refs.content.innerHTML = `<div class="workflow-grid">${cards.join('') || '<div class="workflow-empty">Aucun logiciel metier</div>'}</div>`;
    }

    function renderContingencyView() {
      const maps = getMaps();
      const today = todayIsoDate();
      const plans = applyFilters(state.collections.contingencyPlans || [], (item) => ({
        serviceId: item.serviceId,
        groupId: null,
        agentId: item.ownerAgentId
      }));
      const cards = plans.map((plan) => {
        const readiness = computeContingencyPlanReadiness(plan);
        const owner = maps.agentById.get(plan.ownerAgentId)?.displayName || '-';
        const backup = maps.agentById.get(plan.backupAgentId)?.displayName || '-';
        const service = maps.serviceById.get(plan.serviceId)?.name || '-';
        const status = normalizeContingencyPlanStatus(plan.status);
        const criticality = normalizeContingencyCriticality(plan.criticality);
        const nextReviewDate = normalizeIsoDate(plan.nextReviewDate || '');
        const reviewFlag = nextReviewDate && nextReviewDate < today ? 'Revue due' : 'Revue ok';
        const testFlag = normalizeIsoDate(plan.lastTestDate || '') ? 'Teste' : 'Non teste';
        const chips = [
          `Statut: ${status}`,
          `Criticite: ${criticality}`,
          `Preparation: ${readiness}%`,
          `Service: ${service}`,
          `Owner: ${owner}`,
          `Backup: ${backup}`,
          reviewFlag,
          testFlag
        ];
        return cardHtml(
          'contingencyPlan',
          plan.id,
          plan.title || plan.code || 'Plan de contingence',
          plan.description || '',
          chips,
          buildQuickCardActions('contingencyPlan', plan.id, { status })
        );
      });

      const reviewDueCount = plans.filter((row) => {
        const reviewDate = normalizeIsoDate(row.nextReviewDate || row.lastReviewDate || '');
        return !!reviewDate && reviewDate <= today;
      }).length;
      const notTestedCount = plans.filter((row) => !normalizeIsoDate(row.lastTestDate || '')).length;
      const weakPrepCount = plans.filter((row) => computeContingencyPlanReadiness(row) < 50).length;
      const criticalCount = plans.filter((row) => normalizeContingencyCriticality(row.criticality) === 'critical').length;
      const activeActivations = (state.collections.contingencyActivations || []).filter((act) => normalizeContingencyActivationStatus(act.status) === 'active').length;
      const avgReadiness = plans.length > 0 ? Math.round(plans.reduce((sum, row) => sum + computeContingencyPlanReadiness(row), 0) / plans.length) : 0;

      const byCriticality = {};
      plans.forEach((row) => {
        const crit = normalizeContingencyCriticality(row.criticality);
        byCriticality[crit] = (byCriticality[crit] || 0) + 1;
      });
      const byService = {};
      plans.forEach((row) => {
        const svc = maps.serviceById.get(row.serviceId)?.name || 'Sans service';
        byService[svc] = (byService[svc] || 0) + 1;
      });
      const byStatus = {};
      plans.forEach((row) => {
        const st = normalizeContingencyPlanStatus(row.status);
        byStatus[st] = (byStatus[st] || 0) + 1;
      });

      const criticalityHtml = Object.entries(byCriticality).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([crit, count]) =>
        `<p class="workflow-card-sub"><span class="workflow-badge workflow-badge-${esc(crit)}">${esc(crit)}</span>: ${esc(String(count))}</p>`
      ).join('');
      const serviceHtml = Object.entries(byService).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([svc, count]) =>
        `<p class="workflow-card-sub">${esc(svc)}: ${esc(String(count))}</p>`
      ).join('');
      const statusHtml = Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([st, count]) =>
        `<p class="workflow-card-sub">${esc(st)}: ${esc(String(count))}</p>`
      ).join('');

      const alertPlans = [];
      plans.forEach((row) => {
        const alerts = [];
        const nextReview = normalizeIsoDate(row.nextReviewDate || '');
        if (nextReview && nextReview < today) {
          alerts.push({ type: 'warning', message: 'Revue en retard' });
        }
        if (!normalizeIsoDate(row.lastTestDate || '')) {
          alerts.push({ type: 'error', message: 'Jamais teste' });
        }
        const daysSinceTest = normalizeIsoDate(row.lastTestDate || '') ? Math.floor((Date.now() - new Date(row.lastTestDate).getTime()) / (1000 * 60 * 60 * 24)) : null;
        if (daysSinceTest && daysSinceTest > 365) {
          alerts.push({ type: 'warning', message: `Test datant de ${daysSinceTest} jours` });
        }
        const readiness = computeContingencyPlanReadiness(row);
        if (readiness < 30 && normalizeContingencyCriticality(row.criticality) === 'critical') {
          alerts.push({ type: 'error', message: `Preparation critique faible (${readiness}%)` });
        } else if (readiness < 50) {
          alerts.push({ type: 'warning', message: `Preparation faible (${readiness}%)` });
        }
        if (!row.ownerAgentId) {
          alerts.push({ type: 'error', message: 'Pas de responsable' });
        }
        if (normalizeContingencyCriticality(row.criticality) === 'critical' && !row.backupAgentId) {
          alerts.push({ type: 'warning', message: 'Plan critique sans suppleant' });
        }
        if (alerts.length > 0) {
          alertPlans.push({ plan: row, alerts });
        }
      });
      const alertsHtml = alertPlans.length > 0 ? `
        <div class="workflow-map-col mt-3" style="background:#fef3c7;border:1px solid #f59e0b;border-radius:12px;padding:1rem;">
          <h3 style="margin:0 0 0.75rem;font-size:15px;font-weight:700;color:#92400e;display:flex;align-items:center;gap:0.5rem;">
            <span class="material-symbols-outlined" style="font-size:20px;">warning</span>
            Alertes et actions requises (${alertPlans.length})
          </h3>
          ${alertPlans.slice(0, 10).map((item) => {
            const errorCount = item.alerts.filter((a) => a.type === 'error').length;
            const warningCount = item.alerts.filter((a) => a.type === 'warning').length;
            return `
              <div style="background:white;border-radius:8px;padding:0.75rem;margin-bottom:0.5rem;border-left:4px solid ${errorCount > 0 ? '#dc2626' : '#f59e0b'}">
                <p style="margin:0 0 0.5rem;font-weight:700;font-size:13px;">
                  <a href="#" data-wf-open-detail="contingencyPlan" data-wf-open-detail-id="${esc(item.plan.id)}" style="color:#002b6b;text-decoration:none;">${esc(item.plan.title || item.plan.code || 'Plan sans titre')}</a>
                  <span style="margin-left:0.5rem;font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;background:${errorCount > 0 ? '#fee' : '#fef3c7'};color:${errorCount > 0 ? '#b91c1c' : '#d97706'};">
                    ${errorCount > 0 ? `${errorCount} erreur${errorCount > 1 ? 's' : ''}` : ''} ${warningCount > 0 ? `${warningCount} avertissement${warningCount > 1 ? 's' : ''}` : ''}
                  </span>
                </p>
                <ul style="margin:0;padding-left:1.25rem;font-size:12px;color:#475569;">
                  ${item.alerts.map((alert) => `<li style="color:${alert.type === 'error' ? '#dc2626' : '#f59e0b'};">${esc(alert.message)}</li>`).join('')}
                </ul>
              </div>
            `;
          }).join('')}
          ${alertPlans.length > 10 ? `<p style="margin:0.5rem 0 0;font-size:12px;color:#92400e;font-style:italic;">... et ${alertPlans.length - 10} autre(s) plan(s) avec alertes</p>` : ''}
        </div>
      ` : '';

      refs.content.innerHTML = `
        <div class="workflow-metrics-grid">
          <article class="workflow-card"><p class="workflow-card-title">Total plans</p><p class="workflow-card-sub text-2xl font-bold">${esc(String(plans.length))}</p></article>
          <article class="workflow-card"><p class="workflow-card-title">Plans critiques</p><p class="workflow-card-sub text-2xl font-bold text-red-600">${esc(String(criticalCount))}</p></article>
          <article class="workflow-card"><p class="workflow-card-title">Activations en cours</p><p class="workflow-card-sub text-2xl font-bold text-orange-600">${esc(String(activeActivations))}</p></article>
          <article class="workflow-card"><p class="workflow-card-title">Preparation moyenne</p><p class="workflow-card-sub text-2xl font-bold">${esc(String(avgReadiness))}%</p></article>
          <article class="workflow-card"><p class="workflow-card-title">Revues dues</p><p class="workflow-card-sub text-xl font-bold ${reviewDueCount > 0 ? 'text-orange-600' : 'text-green-600'}">${esc(String(reviewDueCount))}</p></article>
          <article class="workflow-card"><p class="workflow-card-title">Non testes</p><p class="workflow-card-sub text-xl font-bold ${notTestedCount > 0 ? 'text-red-600' : 'text-green-600'}">${esc(String(notTestedCount))}</p></article>
          <article class="workflow-card"><p class="workflow-card-title">Preparation faible</p><p class="workflow-card-sub text-xl font-bold ${weakPrepCount > 0 ? 'text-orange-600' : 'text-green-600'}">${esc(String(weakPrepCount))}</p></article>
        </div>
        <div class="workflow-metrics-grid mt-3">
          <article class="workflow-card">
            <p class="workflow-card-title">Par criticite</p>
            ${criticalityHtml || '<p class="workflow-card-sub">Aucune donnee</p>'}
          </article>
          <article class="workflow-card">
            <p class="workflow-card-title">Par service</p>
            ${serviceHtml || '<p class="workflow-card-sub">Aucune donnee</p>'}
          </article>
          <article class="workflow-card">
            <p class="workflow-card-title">Par statut</p>
            ${statusHtml || '<p class="workflow-card-sub">Aucune donnee</p>'}
          </article>
        </div>
        ${alertsHtml}
        <div class="workflow-grid mt-3">${cards.join('') || '<div class="workflow-empty">Aucun plan de contingence</div>'}</div>
      `;
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
              <div class="workflow-kanban-lane-head">
                <h6>${esc(lane.label)}</h6>
                ${canEditWorkflow() ? `
                  <button
                    type="button"
                    class="workflow-btn-light workflow-kanban-add-btn taskmda-create-cta"
                    data-action-kind="create"
                    data-action-label="Ajouter une tâche workflow"
                    data-ui-tooltip="Ajouter une tâche workflow"
                    data-wf-kanban-add="1"
                    data-wf-target-status="${esc(lane.key)}"
                    aria-label="Ajouter une tâche workflow dans ${esc(lane.label)}"
                  >
                    <span class="material-symbols-outlined taskmda-action-icon" aria-hidden="true">add</span>
                    <span class="taskmda-action-label">Ajouter</span>
                  </button>
                ` : ''}
              </div>
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
            const process = maps.processById.get(task.processId)?.title || 'Sans processus';
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
                  <span class="workflow-chip">${esc(process)}</span>
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
      else if (state.activeView === 'processes') renderProcessesView();
      else if (state.activeView === 'templates') renderTemplatesView();
      else if (state.activeView === 'tasks') renderTasksView();
      else if (state.activeView === 'kanban') renderKanbanView();
      else if (state.activeView === 'timeline') renderTimelineView();
      else if (state.activeView === 'procedures') renderProceduresView();
      else if (state.activeView === 'software') renderSoftwareView();
      else if (state.activeView === 'contingency') renderContingencyView();
      else if (state.activeView === 'analytics') renderAnalyticsView();
      else if (state.activeView === 'governance') renderGovernanceView();
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
      if (kind === 'select-role') {
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><select id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-select">${buildSelectOptions(state.collections.roles, 'id', 'name', value)}</select>`;
      }
      if (kind === 'select-process') {
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><select id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-select">${buildSelectOptions(state.collections.processes, 'id', 'title', value)}</select>`;
      }
      if (kind === 'select-step') {
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><select id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-select">${buildSelectOptions(state.collections.steps, 'id', 'title', value)}</select>`;
      }
      if (kind === 'select-validation-mode') {
        const selected = String(value || 'level').trim().toLowerCase();
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><select id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-select"><option value="level" ${selected === 'level' ? 'selected' : ''}>Niveaux (quorum)</option><option value="sequential" ${selected === 'sequential' ? 'selected' : ''}>Sequentiel</option></select>`;
      }
      if (kind === 'select-roles-multi') {
        const selected = new Set(Array.isArray(value) ? value.map((v) => String(v || '').trim()) : parseCsv(value).map((v) => String(v || '').trim()));
        const options = (state.collections.roles || []).map((role) => {
          const id = String(role.id || '').trim();
          if (!id) return '';
          const label = `${role.name || id}${role.serviceId ? ` (${state.collections.services.find((s) => String(s.id) === String(role.serviceId))?.name || role.serviceId})` : ''}`;
          return `<option value="${esc(id)}" ${selected.has(id) ? 'selected' : ''}>${esc(label)}</option>`;
        }).join('');
        return `<label class="workflow-form-label" for="wf-field-${esc(key)}">${esc(label)}</label><select id="wf-field-${esc(key)}" data-wf-key="${esc(key)}" class="workflow-form-select" multiple size="6">${options}</select>`;
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

    function clearWorkflowInlineSaveTimers() {
      state.inlineDetailSaveTimers.forEach((timer) => clearTimeout(timer));
      state.inlineDetailFinalizeTimers.forEach((timer) => clearTimeout(timer));
      state.inlineDetailSaveTimers.clear();
      state.inlineDetailFinalizeTimers.clear();
    }

    function isWorkflowInlineEditableField(node, editable) {
      if (!editable || !node) return false;
      if (node.hasAttribute('readonly')) return false;
      if (String(node.getAttribute('data-wf-key') || '').trim() === 'version') return false;
      if (String(node.getAttribute('data-wf-key') || '').trim() === 'parentTemplateId') return false;
      if (String(node.getAttribute('data-wf-key') || '').trim() === 'variantGroupKey') return false;
      const tag = String(node.tagName || '').toUpperCase();
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    function setWorkflowFieldReadMode(node, enabled) {
      if (!node) return;
      const tag = String(node.tagName || '').toUpperCase();
      if (tag === 'SELECT') {
        node.disabled = false;
        node.dataset.wfSelectLocked = enabled ? '1' : '0';
      } else {
        node.readOnly = !!enabled;
      }
      node.classList.toggle('task-detail-inline-editable', !!enabled);
      if (enabled) {
        node.classList.remove('is-inline-editing');
        node.setAttribute('title', 'Cliquer pour modifier');
      } else {
        node.classList.add('is-inline-editing');
        node.removeAttribute('title');
      }
    }

    function lockWorkflowField(node) {
      if (!node || node.dataset.wfInlineEligible !== '1') return;
      node.dataset.wfInlineEditing = '0';
      setWorkflowFieldReadMode(node, true);
    }

    function unlockWorkflowField(node) {
      if (!node || node.dataset.wfInlineEligible !== '1') return;
      node.dataset.wfInlineEditing = '1';
      setWorkflowFieldReadMode(node, false);
    }

    function scheduleWorkflowInlineAutosave(fieldKey, immediate = false) {
      const safeKey = String(fieldKey || '').trim();
      if (!safeKey || !state.selectedType || !state.selectedId) return;
      const saveDelay = immediate ? 0 : 280;
      if (state.inlineDetailSaveTimers.has(safeKey)) {
        clearTimeout(state.inlineDetailSaveTimers.get(safeKey));
      }
      state.inlineDetailSaveTimers.set(safeKey, setTimeout(() => {
        saveCurrentDetail({ silent: true, inlineAutosave: true, skipNotify: true }).catch((error) => {
          console.error('workflow inline autosave failed', error);
        });
      }, saveDelay));
      if (state.inlineDetailFinalizeTimers.has(safeKey)) {
        clearTimeout(state.inlineDetailFinalizeTimers.get(safeKey));
      }
      state.inlineDetailFinalizeTimers.set(safeKey, setTimeout(() => {
        saveCurrentDetail({ silent: true, inlineAutosave: true, skipNotify: true }).catch((error) => {
          console.error('workflow inline finalize failed', error);
        });
      }, 950));
    }

    function bindWorkflowInlineField(node) {
      if (!node || node.dataset.wfInlineBound === '1') return;
      node.dataset.wfInlineBound = '1';
      const key = String(node.getAttribute('data-wf-key') || '').trim();
      if (!key) return;
      node.addEventListener('mousedown', (event) => {
        if (String(node.tagName || '').toUpperCase() !== 'SELECT') return;
        if (node.dataset.wfInlineEligible !== '1') return;
        if (node.dataset.wfInlineEditing === '1') return;
        event.preventDefault();
        unlockWorkflowField(node);
        requestAnimationFrame(() => node.focus());
      });
      node.addEventListener('focus', () => {
        if (node.dataset.wfInlineEligible === '1' && node.dataset.wfInlineEditing !== '1') {
          unlockWorkflowField(node);
        }
      });
      node.addEventListener('input', () => {
        if (node.dataset.wfInlineEligible !== '1' || node.dataset.wfInlineEditing !== '1') return;
        scheduleWorkflowInlineAutosave(key, false);
      });
      node.addEventListener('change', () => {
        if (node.dataset.wfInlineEligible !== '1' || node.dataset.wfInlineEditing !== '1') return;
        scheduleWorkflowInlineAutosave(key, false);
      });
      node.addEventListener('keydown', (event) => {
        if (node.dataset.wfInlineEligible !== '1') return;
        if (event.key === 'Escape') {
          event.preventDefault();
          const original = node.dataset.wfInlineOriginalValue;
          if (typeof original === 'string') node.value = original;
          lockWorkflowField(node);
          return;
        }
        if (event.key === 'Enter' && String(node.tagName || '').toUpperCase() !== 'TEXTAREA') {
          event.preventDefault();
          node.blur();
        }
      });
      node.addEventListener('blur', () => {
        if (node.dataset.wfInlineEligible !== '1') return;
        if (node.dataset.wfInlineEditing !== '1') return;
        scheduleWorkflowInlineAutosave(key, true);
        node.dataset.wfInlineOriginalValue = String(node.value || '');
        lockWorkflowField(node);
      });
    }

    function initWorkflowDetailInlineEditing(editable = false) {
      if (!refs.detailBody) return;
      clearWorkflowInlineSaveTimers();
      const fields = Array.from(refs.detailBody.querySelectorAll('[data-wf-key]'));
      fields.forEach((node) => {
        const eligible = isWorkflowInlineEditableField(node, editable);
        node.dataset.wfInlineEligible = eligible ? '1' : '0';
        bindWorkflowInlineField(node);
        if (!eligible) return;
        node.dataset.wfInlineOriginalValue = String(node.value || '');
        lockWorkflowField(node);
      });

      if (refs.detailBody.dataset.wfInlineClickBound === '1') return;
      refs.detailBody.dataset.wfInlineClickBound = '1';
      refs.detailBody.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('[data-wf-key]') : null;
        if (!target || target.dataset.wfInlineEligible !== '1') return;
        if (target.dataset.wfInlineEditing === '1') return;
        unlockWorkflowField(target);
        requestAnimationFrame(() => target.focus());
      });
    }

    function getProcessStepsSorted(processId) {
      const pid = String(processId || '').trim();
      return (state.collections.steps || [])
        .filter((step) => String(step.processId || '') === pid)
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    }

    function getProcessFlows(processId) {
      const pid = String(processId || '').trim();
      return (state.collections.flows || []).filter((flow) => String(flow.processId || '') === pid);
    }

    async function relinkProcessFlowsLinear(processId, orderedStepIds, options = {}) {
      const pid = String(processId || '').trim();
      const sequence = Array.isArray(orderedStepIds) ? orderedStepIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
      if (!pid || sequence.length < 2) return;
      const existing = getProcessFlows(pid);
      for (const flow of existing) {
        await api.remove('workflowFlows', flow.id);
      }
      for (let i = 0; i < sequence.length - 1; i += 1) {
        await api.put('workflowFlows', {
          id: `wf-flow-${uid()}`,
          processId: pid,
          fromStepId: sequence[i],
          toStepId: sequence[i + 1],
          flowType: 'sequence',
          condition: '',
          label: `Flux ${i + 1}`,
          metadata: { ...(options.metadata || {}), linearRelink: true },
          createdAt: now(),
          updatedAt: now()
        }, STORE_KEY_FIELDS.workflowFlows);
      }
    }

    function processDesignerHtml(process, editable, maps) {
      const steps = getProcessStepsSorted(process.id);
      const flows = getProcessFlows(process.id);
      const flowKeys = new Set(flows.map((flow) => `${flow.fromStepId}->${flow.toStepId}`));
      const typeLabel = (type) => {
        if (type === 'action') return 'Action';
        if (type === 'validation') return 'Validation';
        if (type === 'decision') return 'Decision';
        if (type === 'notification') return 'Notification';
        if (type === 'input') return 'Entree';
        if (type === 'output') return 'Sortie';
        return type || 'Action';
      };
      return `
        <div class="workflow-map-col">
          <h6>Concepteur de processus</h6>
          <p class="workflow-card-sub">Edition rapide par blocs: ajout d etape, reordonnancement et reliage automatique des flux.</p>
          ${editable ? `
          <div class="workflow-detail-actions" style="justify-content:flex-start;">
            <button type="button" class="workflow-btn-light" data-wf-designer-add-type="action">+ Action</button>
            <button type="button" class="workflow-btn-light" data-wf-designer-add-type="validation">+ Validation</button>
            <button type="button" class="workflow-btn-light" data-wf-designer-add-type="decision">+ Decision</button>
            <button type="button" class="workflow-btn-light" data-wf-designer-add-type="notification">+ Notification</button>
            <button type="button" class="workflow-btn-light" data-wf-designer-add-type="input">+ Entree</button>
            <button type="button" class="workflow-btn-light" data-wf-designer-add-type="output">+ Sortie</button>
          </div>
          ` : ''}
          <div class="workflow-grid">
            ${steps.map((step, index) => {
              const owner = maps.agentById.get(step.ownerAgentId)?.displayName || 'Non assigne';
              const role = maps.roleById.get(step.roleId)?.name || step.roleId || '-';
              const next = steps[index + 1];
              const linked = next ? flowKeys.has(`${step.id}->${next.id}`) : false;
              return `
                <article class="workflow-card">
                  <p class="workflow-card-title">${esc(String(index + 1))}. ${esc(step.title || 'Etape')}</p>
                  <p class="workflow-card-sub">${esc(typeLabel(step.stepType))} - ${esc(owner)}</p>
                  <div class="workflow-chip-row">
                    <span class="workflow-chip">Role: ${esc(role)}</span>
                    <span class="workflow-chip">${esc(String(step.estimatedDurationMinutes || 0))} min</span>
                    <span class="workflow-chip">${next ? (linked ? 'Flux OK' : 'Flux manquant') : 'Fin process'}</span>
                  </div>
                  <div class="workflow-card-actions" style="max-height:180px;opacity:1;pointer-events:auto;transform:none;">
                    <button type="button" class="workflow-card-action-btn" data-wf-designer-action="open-step" data-wf-process-id="${esc(process.id)}" data-wf-step-id="${esc(step.id)}"><span>Ouvrir</span></button>
                    ${editable ? `<button type="button" class="workflow-card-action-btn" data-wf-designer-action="duplicate-step" data-wf-process-id="${esc(process.id)}" data-wf-step-id="${esc(step.id)}"><span>Dupliquer</span></button>` : ''}
                    ${editable ? `<button type="button" class="workflow-card-action-btn" data-wf-designer-action="move-up" data-wf-process-id="${esc(process.id)}" data-wf-step-id="${esc(step.id)}"><span>Monter</span></button>` : ''}
                    ${editable ? `<button type="button" class="workflow-card-action-btn" data-wf-designer-action="move-down" data-wf-process-id="${esc(process.id)}" data-wf-step-id="${esc(step.id)}"><span>Descendre</span></button>` : ''}
                    ${editable ? `<button type="button" class="workflow-card-action-btn is-danger" data-wf-designer-action="delete-step" data-wf-process-id="${esc(process.id)}" data-wf-step-id="${esc(step.id)}"><span>Supprimer</span></button>` : ''}
                  </div>
                </article>
              `;
            }).join('') || '<div class="workflow-empty">Aucune etape. Utiliser les blocs ci-dessus pour demarrer.</div>'}
          </div>
          ${editable ? `
          <div class="workflow-detail-actions" style="justify-content:flex-start;">
            <button type="button" class="workflow-btn-light" data-wf-designer-action="relink" data-wf-process-id="${esc(process.id)}">Relier automatiquement les flux</button>
          </div>
          ` : ''}
        </div>
      `;
    }

    function processFlowDesignerHtml(process, editable, maps) {
      const steps = getProcessStepsSorted(process.id);
      const flows = getProcessFlows(process.id).slice().sort((a, b) => String(a.id || '').localeCompare(String(b.id || ''), 'fr'));
      const selectedSourceStepId = String(state.flowDesigner?.sourceStepId || '').trim();
      const selectedFlowId = String(state.flowDesigner?.selectedFlowId || '').trim();
      const selectedFlowIds = Array.isArray(state.flowDesigner?.selectedFlowIds) ? state.flowDesigner.selectedFlowIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
      const selectedFlowSet = new Set(selectedFlowIds);
      const multiSelectMode = !!state.flowDesigner?.multiSelectMode;
      const stepOptions = steps.map((step) => `<option value="${esc(step.id)}" ${selectedSourceStepId === String(step.id || '') ? 'selected' : ''}>${esc(`${step.order || '-'} - ${step.title || step.id}`)}</option>`).join('');
      const customMode = !!process?.metadata?.customFlowMode;
      const linkMode = !!state.flowDesigner?.linkMode;
      const stepName = (stepId) => {
        const row = maps.stepById.get(stepId);
        if (!row) return stepId || '-';
        return `${row.order || '-'} - ${row.title || row.id}`;
      };
      const graphWidth = Math.max(920, steps.length * 170);
      const graphHeight = Math.max(260, Math.min(560, 240 + Math.max(0, steps.length - 4) * 20));
      const nodes = steps.map((step, index) => {
        const x = 70 + index * 150;
        const y = 44 + ((index % 2) * 88);
        return {
          id: step.id,
          label: step.title || step.id,
          type: step.stepType || 'action',
          x,
          y
        };
      });
      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      const graphSvg = nodes.length === 0
        ? '<div class="workflow-empty">Aucune etape pour visualiser le graphe.</div>'
        : `
          <svg class="workflow-flow-graph-svg" viewBox="0 0 ${graphWidth} ${graphHeight}" role="img" aria-label="Graphe des etapes et flux">
            <defs>
              <marker id="wf-flow-arrow" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                <polygon points="0 0, 9 3.5, 0 7" fill="#2563eb"></polygon>
              </marker>
            </defs>
            ${flows.map((flow) => {
              const src = nodeById.get(flow.fromStepId);
              const tgt = nodeById.get(flow.toStepId);
              if (!src || !tgt) return '';
              const x1 = src.x + 88;
              const y1 = src.y + 20;
              const x2 = tgt.x;
              const y2 = tgt.y + 20;
              const cx = Math.round((x1 + x2) / 2);
              const cy1 = y1 + (src.id === tgt.id ? -40 : 0);
              const cy2 = y2 + (src.id === tgt.id ? -40 : 0);
              const labelX = Math.round((x1 + x2) / 2);
              const labelY = Math.round((y1 + y2) / 2) - 8;
              const color = flow.flowType === 'decision' ? '#d97706' : flow.flowType === 'parallel' ? '#7c3aed' : flow.flowType === 'exception' ? '#dc2626' : '#2563eb';
              return `
                <path class="workflow-flow-graph-edge ${(selectedFlowSet.has(String(flow.id || '')) || selectedFlowId === String(flow.id || '')) ? 'is-selected' : ''}" data-wf-flow-graph-edge="${esc(flow.id)}" d="M ${x1} ${y1} C ${cx} ${cy1}, ${cx} ${cy2}, ${x2} ${y2}" fill="none" stroke="${esc(color)}" stroke-width="2" marker-end="url(#wf-flow-arrow)"></path>
                <text x="${labelX}" y="${labelY}" text-anchor="middle" class="workflow-flow-graph-edge-label">${esc(flow.label || flow.condition || flow.flowType || '')}</text>
              `;
            }).join('')}
            ${nodes.map((node) => {
              const fill = node.type === 'decision' ? '#fffbeb' : node.type === 'validation' ? '#ecfeff' : node.type === 'notification' ? '#eff6ff' : node.type === 'input' ? '#ecfdf5' : node.type === 'output' ? '#fdf2f8' : '#f8fafc';
              const stroke = node.type === 'decision' ? '#d97706' : node.type === 'validation' ? '#0891b2' : node.type === 'notification' ? '#2563eb' : node.type === 'input' ? '#16a34a' : node.type === 'output' ? '#be185d' : '#475569';
              return `
                <g class="workflow-flow-graph-node ${selectedSourceStepId === String(node.id || '') ? 'is-selected' : ''}" data-wf-flow-graph-node="${esc(node.id)}">
                  <rect x="${node.x}" y="${node.y}" width="88" height="40" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.4"></rect>
                  <text x="${node.x + 44}" y="${node.y + 15}" text-anchor="middle" class="workflow-flow-graph-node-type">${esc(node.type)}</text>
                  <text x="${node.x + 44}" y="${node.y + 30}" text-anchor="middle" class="workflow-flow-graph-node-label">${esc(node.label)}</text>
                </g>
              `;
            }).join('')}
          </svg>
        `;
      return `
        <div class="workflow-map-col">
          <h6>Concepteur de flux (graphe)</h6>
          <p class="workflow-card-sub">Mode ${customMode ? 'graphe non-lineaire' : 'lineaire'} - ${flows.length} flux definis.</p>
          <p class="workflow-card-sub">Astuce: clique un noeud pour choisir la source, puis un second noeud pour la cible. Mode drag-link disponible.</p>
          <div class="workflow-flow-graph-wrap ${linkMode ? 'is-link-mode' : ''}">${graphSvg}</div>
          ${editable ? `
          <div class="workflow-detail-actions" style="justify-content:flex-start;flex-wrap:wrap;">
            <button type="button" class="workflow-btn-light" data-wf-flow-action="enable-custom" data-wf-process-id="${esc(process.id)}">${customMode ? 'Mode graphe actif' : 'Activer mode graphe'}</button>
            <button type="button" class="workflow-btn-light" data-wf-flow-action="switch-linear" data-wf-process-id="${esc(process.id)}">Basculer lineaire</button>
            <button type="button" class="workflow-btn-light ${linkMode ? 'is-primary' : ''}" data-wf-flow-action="toggle-link-mode" data-wf-process-id="${esc(process.id)}">${linkMode ? 'Drag-link: ON' : 'Drag-link: OFF'}</button>
            <button type="button" class="workflow-btn-light ${multiSelectMode ? 'is-primary' : ''}" data-wf-flow-bulk-action="toggle-multi" data-wf-process-id="${esc(process.id)}">${multiSelectMode ? 'Multi-select: ON' : 'Multi-select: OFF'}</button>
            <button type="button" class="workflow-btn-light" data-wf-flow-bulk-action="clear-selection" data-wf-process-id="${esc(process.id)}">Deselectionner</button>
            <span class="workflow-chip">${selectedFlowIds.length} flux selectionne(s)</span>
          </div>
          <div class="workflow-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">
            <div><label class="workflow-form-label" for="wf-flow-source">Source</label><select id="wf-flow-source" class="workflow-form-select">${stepOptions}</select></div>
            <div><label class="workflow-form-label" for="wf-flow-target">Cible</label><select id="wf-flow-target" class="workflow-form-select">${stepOptions}</select></div>
            <div><label class="workflow-form-label" for="wf-flow-type">Type</label><select id="wf-flow-type" class="workflow-form-select"><option value="sequence">sequence</option><option value="decision">decision</option><option value="parallel">parallel</option><option value="exception">exception</option></select></div>
            <div><label class="workflow-form-label" for="wf-flow-condition">Condition</label><input id="wf-flow-condition" class="workflow-form-input" type="text" placeholder="Ex: urgence=haute"></div>
            <div><label class="workflow-form-label" for="wf-flow-label">Label</label><input id="wf-flow-label" class="workflow-form-input" type="text" placeholder="Ex: branche oui"></div>
          </div>
          <div class="workflow-detail-actions" style="justify-content:flex-start;">
            <button type="button" class="workflow-btn-light" data-wf-flow-action="add" data-wf-process-id="${esc(process.id)}">Ajouter flux</button>
            <button type="button" class="workflow-btn-light" data-wf-flow-action="add-yes-no" data-wf-process-id="${esc(process.id)}">Ajouter branche oui/non</button>
            <button type="button" class="workflow-btn-light" data-wf-flow-bulk-action="delete-selected" data-wf-process-id="${esc(process.id)}">Supprimer selection</button>
            <select id="wf-flow-bulk-type" class="workflow-form-select" style="max-width:170px;">
              <option value="sequence">sequence</option>
              <option value="decision">decision</option>
              <option value="parallel">parallel</option>
              <option value="exception">exception</option>
            </select>
            <button type="button" class="workflow-btn-light" data-wf-flow-bulk-action="apply-type" data-wf-process-id="${esc(process.id)}">Appliquer type</button>
          </div>
          ` : ''}
          <div class="workflow-grid">
            ${flows.map((flow) => `
              <article class="workflow-card ${(selectedFlowSet.has(String(flow.id || '')) || selectedFlowId === String(flow.id || '')) ? 'is-selected' : ''}" data-wf-flow-card-id="${esc(flow.id)}">
                <p class="workflow-card-title">${esc(flow.label || flow.flowType || 'flux')}</p>
                <p class="workflow-card-sub">${esc(stepName(flow.fromStepId))} -> ${esc(stepName(flow.toStepId))}</p>
                <div class="workflow-chip-row">
                  <span class="workflow-chip">${esc(flow.flowType || 'sequence')}</span>
                  <span class="workflow-chip">${esc(flow.condition || 'sans condition')}</span>
                </div>
                ${editable ? `
                <div class="workflow-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:0.5rem;">
                  <div><label class="workflow-form-label">Source</label><select class="workflow-form-select" data-wf-flow-field="fromStepId">${steps.map((step) => `<option value="${esc(step.id)}" ${String(step.id) === String(flow.fromStepId) ? 'selected' : ''}>${esc(`${step.order || '-'} - ${step.title || step.id}`)}</option>`).join('')}</select></div>
                  <div><label class="workflow-form-label">Cible</label><select class="workflow-form-select" data-wf-flow-field="toStepId">${steps.map((step) => `<option value="${esc(step.id)}" ${String(step.id) === String(flow.toStepId) ? 'selected' : ''}>${esc(`${step.order || '-'} - ${step.title || step.id}`)}</option>`).join('')}</select></div>
                  <div><label class="workflow-form-label">Type</label><select class="workflow-form-select" data-wf-flow-field="flowType"><option value="sequence" ${String(flow.flowType || 'sequence') === 'sequence' ? 'selected' : ''}>sequence</option><option value="decision" ${String(flow.flowType || '') === 'decision' ? 'selected' : ''}>decision</option><option value="parallel" ${String(flow.flowType || '') === 'parallel' ? 'selected' : ''}>parallel</option><option value="exception" ${String(flow.flowType || '') === 'exception' ? 'selected' : ''}>exception</option></select></div>
                  <div><label class="workflow-form-label">Condition</label><input class="workflow-form-input" type="text" data-wf-flow-field="condition" value="${esc(flow.condition || '')}"></div>
                  <div><label class="workflow-form-label">Label</label><input class="workflow-form-input" type="text" data-wf-flow-field="label" value="${esc(flow.label || '')}"></div>
                </div>
                <div class="workflow-card-actions" style="max-height:120px;opacity:1;pointer-events:auto;transform:none;">
                  <button type="button" class="workflow-card-action-btn" data-wf-flow-action="update" data-wf-process-id="${esc(process.id)}" data-wf-flow-id="${esc(flow.id)}"><span>Enregistrer</span></button>
                  <button type="button" class="workflow-card-action-btn" data-wf-flow-action="delete" data-wf-process-id="${esc(process.id)}" data-wf-flow-id="${esc(flow.id)}"><span>Supprimer</span></button>
                </div>
                ` : ''}
              </article>
            `).join('') || '<div class="workflow-empty">Aucun flux defini</div>'}
          </div>
        </div>
      `;
    }

    async function activateContingencyPlan(planId) {
      if (!planId) return;
      const plan = getItem('contingencyPlan', planId);
      if (!plan) return;
      
      const isAlreadyActive = (state.collections.contingencyActivations || [])
        .filter((act) => String(act.planId) === String(planId))
        .some((act) => normalizeContingencyActivationStatus(act.status) === 'active');
      if (isAlreadyActive) {
        toast('Plan deja actif');
        return;
      }
      
      const actions = (state.collections.contingencyActions || [])
        .filter((row) => String(row.planId || '') === String(planId));

      const actId = `wf-cont-act-${uid()}`;
      const activation = {
        id: actId,
        planId: planId,
        startedAt: now(),
        endedAt: null,
        status: 'active',
        initiatorUserId: currentUserId(),
        metadata: { triggeringContext: 'Activation manuelle', tasksGenerated: actions.length }
      };
      await api.put('workflowContingencyActivations', activation, STORE_KEY_FIELDS.workflowContingencyActivations);
      
      plan.status = 'active';
      await api.put('workflowContingencyPlans', plan, STORE_KEY_FIELDS.workflowContingencyPlans);
      
      for (const action of actions) {
          const taskId = `wf-task-${uid()}`;
          const task = {
            id: taskId,
            processId: plan.processId || null,
            serviceId: plan.serviceId || null,
            groupId: null,
            ownerAgentId: action.ownerAgentId || plan.ownerAgentId || null,
            title: `[Urgence] ${action.title || 'Action contingence'}`,
            description: `Action generée automatiquement par le déclenchement du plan de contingence: ${plan.title || plan.id}.`,
            status: 'todo',
            priority: 'high',
            approvalStatus: 'pending',
            checklist: [],
            linkedProcedureId: null,
            linkedSoftwareIds: plan.softwareId ? [plan.softwareId] : [],
            prerequisiteTaskIds: [],
            dependentTaskIds: [],
            linkedGlobalTaskIds: [],
            linkedDocumentIds: Object.keys(plan.linkedDocumentIds || {}),
            linkedThemeKeys: [],
            linkedGroupKeys: [],
            createdAt: now(),
            updatedAt: now()
          };
          await api.put('workflowTasks', task, STORE_KEY_FIELDS.workflowTasks);
      }
      
      await logAudit('contingency_activate', 'contingencyPlan', planId, { activationId: actId, actionsGenerated: actions.length });
      
      await loadCollections();
      renderServiceFilter();
      renderContent();
      openDetail('contingencyPlan', planId);
      toast('Plan declenche et taches genérees.');
    }

    async function closeContingencyActivation(activationId) {
      if (!activationId) return;
      const act = (state.collections.contingencyActivations || []).find((a) => String(a.id) === String(activationId));
      if (!act) return;
      
      act.status = 'closed';
      act.endedAt = now();
      await api.put('workflowContingencyActivations', act, STORE_KEY_FIELDS.workflowContingencyActivations);
      
      const plan = getItem('contingencyPlan', act.planId);
      if (plan) {
         plan.status = 'valid';
         await api.put('workflowContingencyPlans', plan, STORE_KEY_FIELDS.workflowContingencyPlans);
      }
      
      await logAudit('contingency_close', 'contingencyPlan', act.planId, { activationId: activationId });
      
      await loadCollections();
      renderServiceFilter();
      renderContent();
      openDetail('contingencyPlan', act.planId);
      toast('Crise cloturee.');
    }

    function openDetail(type, id) {
      const item = getItem(type, id);
      if (!item || !refs.detail || !refs.detailBody || !refs.detailTitle) return;
      if (type !== 'process') {
        state.flowDesigner.sourceStepId = null;
        state.flowDesigner.selectedFlowId = null;
        state.flowDesigner.selectedFlowIds = [];
        state.flowDesigner.multiSelectMode = false;
        state.flowDesigner.linkMode = false;
        state.flowDesigner.dragSourceStepId = null;
      }

      state.selectedType = type;
      state.selectedId = id;
      renderBreadcrumbs();
      openDetailModal();
      refs.detailTitle.textContent = `${ENTITY_META[type]?.label || 'Element'} - ${item.name || item.displayName || item.title || id}`;
      if (refs.detailBody) {
        refs.detailBody.setAttribute('data-wf-context-type', String(type || '').trim());
        refs.detailBody.setAttribute('data-wf-context-id', String(id || '').trim());
        refs.detailBody.setAttribute(
          'data-wf-context-label',
          String(item.name || item.displayName || item.title || id || '').trim()
        );
      }

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
      if (type === 'role') {
        fields.push(fieldHtml('Nom role', 'name', item.name || '', 'text'));
        fields.push(fieldHtml('Description', 'description', item.description || '', 'textarea'));
        fields.push(fieldHtml('Service', 'serviceId', item.serviceId || '', 'select-service'));
        fields.push(fieldHtml('Competences requises (csv)', 'requiredSkills', toCsv(item.requiredSkills), 'text'));
        fields.push(fieldHtml('Permissions hints (csv)', 'permissionHints', toCsv(item.permissionHints), 'text'));
      }
      if (type === 'process') {
        const validation = normalizeProcessValidation(item?.validation);
        fields.push(fieldHtml('Titre', 'title', item.title || '', 'text'));
        fields.push(fieldHtml('Description', 'description', item.description || '', 'textarea'));
        fields.push(fieldHtml('Communaute', 'communityId', item.communityId || '', 'select-community'));
        fields.push(fieldHtml('Service', 'serviceId', item.serviceId || '', 'select-service'));
        fields.push(fieldHtml('Groupe', 'groupId', item.groupId || '', 'select-group'));
        fields.push(fieldHtml('Responsable', 'ownerAgentId', item.ownerAgentId || '', 'select-agent'));
        fields.push(fieldHtml('Statut', 'status', item.status || 'draft', 'text'));
        fields.push(fieldHtml('Criticite', 'criticality', item.criticality || 'medium', 'text'));
        fields.push(fieldHtml('Entrees (1 ligne = 1 element)', 'inputs', (item.inputs || []).join('\n'), 'textarea'));
        fields.push(fieldHtml('Sorties (1 ligne = 1 element)', 'outputs', (item.outputs || []).join('\n'), 'textarea'));
        fields.push(fieldHtml('Tags (csv)', 'tags', toCsv(item.tags), 'text'));
        fields.push(fieldHtml('Validation niveaux requis', 'validationRequiredLevels', String(validation.requiredLevels || 2), 'text'));
        fields.push(fieldHtml('Mode validation', 'validationMode', validation.mode || 'level', 'select-validation-mode'));
        fields.push(fieldHtml('Roles approbateurs requis', 'validationRequiredRoleIds', validation.requiredRoleIds || [], 'select-roles-multi'));
        fields.push(fieldHtml('Regles validation (JSON)', 'validationLevelRulesJson', JSON.stringify(validation.levelRules || [], null, 2), 'textarea'));
      }
      if (type === 'step') {
        fields.push(fieldHtml('Processus', 'processId', item.processId || '', 'select-process'));
        fields.push(fieldHtml('Titre', 'title', item.title || '', 'text'));
        fields.push(fieldHtml('Type', 'stepType', item.stepType || 'action', 'text'));
        fields.push(fieldHtml('Description', 'description', item.description || '', 'textarea'));
        fields.push(fieldHtml('Service', 'serviceId', item.serviceId || '', 'select-service'));
        fields.push(fieldHtml('Groupe', 'groupId', item.groupId || '', 'select-group'));
        fields.push(fieldHtml('Responsable', 'ownerAgentId', item.ownerAgentId || '', 'select-agent'));
        fields.push(fieldHtml('Role metier', 'roleId', item.roleId || '', 'select-role'));
        fields.push(fieldHtml('Procedure liee', 'linkedProcedureId', item.linkedProcedureId || '', 'select-procedure'));
        fields.push(fieldHtml('Logiciels lies (csv ids)', 'linkedSoftwareIds', toCsv(item.linkedSoftwareIds), 'text'));
        fields.push(fieldHtml('Tache workflow liee', 'linkedTaskId', item.linkedTaskId || '', 'text'));
        fields.push(fieldHtml('Duree estimee (min)', 'estimatedDurationMinutes', String(item.estimatedDurationMinutes || ''), 'text'));
        fields.push(fieldHtml('Ordre', 'order', String(item.order || 1), 'text'));
      }
      if (type === 'flow') {
        fields.push(fieldHtml('Processus', 'processId', item.processId || '', 'select-process'));
        fields.push(fieldHtml('Etape source', 'fromStepId', item.fromStepId || '', 'select-step'));
        fields.push(fieldHtml('Etape cible', 'toStepId', item.toStepId || '', 'select-step'));
        fields.push(fieldHtml('Type de flux', 'flowType', item.flowType || 'sequence', 'text'));
        fields.push(fieldHtml('Condition', 'condition', item.condition || '', 'textarea'));
        fields.push(fieldHtml('Label', 'label', item.label || '', 'text'));
      }
      if (type === 'template') {
        fields.push(fieldHtml('Nom', 'name', item.name || '', 'text'));
        fields.push(fieldHtml('Description', 'description', item.description || '', 'textarea'));
        fields.push(fieldHtml('Service', 'serviceId', item.serviceId || '', 'select-service'));
        fields.push(fieldHtml('Groupe', 'groupId', item.groupId || '', 'select-group'));
        fields.push(fieldHtml('Responsable', 'ownerAgentId', item.ownerAgentId || '', 'select-agent'));
        fields.push(fieldHtml('Statut', 'status', item.status || 'draft', 'text'));
        fields.push(fieldHtml('Tags (csv)', 'tags', toCsv(item.tags), 'text'));
        fields.push(fieldHtml('Version', 'version', String(item.version || 1), 'readonly'));
        fields.push(fieldHtml('Modele parent', 'parentTemplateId', String(item.parentTemplateId || ''), 'readonly'));
        fields.push(fieldHtml('Groupe variantes', 'variantGroupKey', String(item.variantGroupKey || ''), 'readonly'));
      }
      if (type === 'task') {
        const checklist = normalizeChecklist(item);
        fields.push(fieldHtml('Titre', 'title', item.title || '', 'text'));
        fields.push(fieldHtml('Description', 'description', item.description || '', 'textarea'));
        fields.push(fieldHtml('Processus', 'processId', item.processId || '', 'select-process'));
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
      if (type === 'contingencyPlan') {
        fields.push(fieldHtml('Titre', 'title', item.title || '', 'text'));
        fields.push(fieldHtml('Code', 'code', item.code || '', 'text'));
        fields.push(fieldHtml('Description', 'description', item.description || '', 'textarea'));
        fields.push(fieldHtml('Perimetre', 'scope', item.scope || '', 'text'));
        fields.push(fieldHtml('Statut', 'status', normalizeContingencyPlanStatus(item.status), 'text'));
        fields.push(fieldHtml('Criticite', 'criticality', normalizeContingencyCriticality(item.criticality), 'text'));
        fields.push(fieldHtml('Version', 'version', String(item.version || 1), 'text'));
        fields.push(fieldHtml('Responsable', 'ownerAgentId', item.ownerAgentId || '', 'select-agent'));
        fields.push(fieldHtml('Suppleant', 'backupAgentId', item.backupAgentId || '', 'select-agent'));
        fields.push(fieldHtml('Service', 'serviceId', item.serviceId || '', 'select-service'));
        fields.push(fieldHtml('Processus lie', 'processId', item.processId || '', 'select-process'));
        fields.push(fieldHtml('Logiciel lie (id)', 'softwareId', item.softwareId || '', 'text'));
        fields.push(fieldHtml('Declencheurs', 'triggerConditions', item.triggerConditions || '', 'textarea'));
        fields.push(fieldHtml('Impacts', 'impacts', item.impacts || '', 'textarea'));
        fields.push(fieldHtml('Date derniere revue', 'lastReviewDate', item.lastReviewDate || '', 'text'));
        fields.push(fieldHtml('Date dernier test', 'lastTestDate', item.lastTestDate || '', 'text'));
        fields.push(fieldHtml('Prochaine revue', 'nextReviewDate', item.nextReviewDate || '', 'text'));
        fields.push(fieldHtml('Niveau preparation (0-100)', 'readinessLevel', String(item.readinessLevel || ''), 'text'));
        fields.push(fieldHtml('Documents lies (csv ids)', 'linkedDocumentIds', toCsv(item.linkedDocumentIds), 'text'));
        fields.push(fieldHtml('Taches liees (csv ids)', 'linkedTaskIds', toCsv(item.linkedTaskIds), 'text'));
      }

      const isLocked = isWorkflowItemLocked(type, id);
      const canEdit = canEditWorkflow();
      const editable = canEdit && !isLocked;

      if (isLocked) {
        refs.detailTitle.innerHTML += ` <span class="badge badge-error ml-2" title="Ce contenu est verrouillé par un autre utilisateur">VERROUILLÉ</span>`;
      }
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
      const processValidation = type === 'process'
        ? normalizeProcessValidation(item?.validation)
        : null;
      const processDesignerPanel = type === 'process'
        ? processDesignerHtml(item, editable, getMaps())
        : '';
      const processFlowDesignerPanel = type === 'process'
        ? processFlowDesignerHtml(item, editable, getMaps())
        : '';
      const canValidateCurrentProcess = type === 'process' ? canValidateWorkflow(item) : false;
      const softwareVersionMatches = type === 'software' ? getMatchedSoftwareVersionEntries(item).slice(0, 8) : [];
      const softwareVersionLatest = type === 'software' ? (softwareVersionMatches[0] || null) : null;
      const permissionProfiles = type === 'software'
        ? (state.collections.permissionProfiles || [])
          .filter((row) => String(row.softwareId || '') === String(id))
          .slice()
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'))
        : [];
      const permissionAssignments = type === 'software'
        ? (state.collections.permissionAssignments || [])
          .filter((row) => String(row.softwareId || '') === String(id))
          .slice()
          .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))
        : [];
      const permissionRequests = type === 'software'
        ? (state.collections.permissionRequests || [])
          .filter((row) => String(row.softwareId || '') === String(id))
          .slice()
          .sort((a, b) => Number(b.requestedAt || b.updatedAt || b.createdAt || 0) - Number(a.requestedAt || a.updatedAt || a.createdAt || 0))
        : [];
      const permissionAudit = type === 'software'
        ? (state.collections.permissionAudit || [])
          .filter((row) => String(row.softwareId || '') === String(id))
          .slice()
          .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
          .slice(0, 20)
        : [];
      const permissionReviews = type === 'software'
        ? (state.collections.permissionReviews || [])
          .filter((row) => String(row.softwareId || '') === String(id))
          .slice()
          .sort((a, b) => String(b.reviewDate || '').localeCompare(String(a.reviewDate || '')))
        : [];
      const contingencyActions = type === 'contingencyPlan'
        ? (state.collections.contingencyActions || [])
          .filter((row) => String(row.planId || '') === String(id))
          .slice()
          .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
        : [];
      const contingencyActivations = type === 'contingencyPlan'
        ? (state.collections.contingencyActivations || [])
          .filter((row) => String(row.planId || '') === String(id))
          .slice()
          .sort((a, b) => Number(b.startedAt || 0) - Number(a.startedAt || 0))
        : [];
      const contingencyExercises = type === 'contingencyPlan'
        ? (state.collections.contingencyExercises || [])
          .filter((row) => String(row.planId || '') === String(id))
          .slice()
          .sort((a, b) => String(b.exerciseDate || '').localeCompare(String(a.exerciseDate || '')))
        : [];
      const contingencyReviews = type === 'contingencyPlan'
        ? (state.collections.contingencyReviews || [])
          .filter((row) => String(row.planId || '') === String(id))
          .slice()
          .sort((a, b) => String(b.reviewDate || '').localeCompare(String(a.reviewDate || '')))
        : [];
      const contingencyAudit = type === 'contingencyPlan'
        ? (state.collections.contingencyAudit || [])
          .filter((row) => String(row.planId || '') === String(id))
          .slice()
          .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
          .slice(0, 25)
        : [];
      const profileById = new Map(permissionProfiles.map((row) => [String(row.id || ''), row]));
      const assignmentById = new Map(permissionAssignments.map((row) => [String(row.id || ''), row]));

      refs.detailBody.innerHTML = `
        ${fields.map((field) => `<div>${field}</div>`).join('')}
        ${crossLinksHtml}
        ${wikiEditorHtml}
        ${type === 'process' ? `
        <div class="workflow-map-col">
          <h6>Gouvernance processus</h6>
          <p class="workflow-card-sub">Statut: ${esc(item.status || 'draft')}</p>
          <p class="workflow-card-sub">Validation: niveau ${esc(String(processValidation.level))} / ${esc(String(processValidation.requiredLevels))}</p>
          <p class="workflow-card-sub">Mode validation: ${esc(processValidation.mode || 'level')}</p>
          <p class="workflow-card-sub">Roles requis: ${esc((processValidation.requiredRoleIds || []).join(', ') || '-')}</p>
          <p class="workflow-card-sub">Approbations: ${esc(String(processValidation.approvers.length || 0))}</p>
        </div>
        ` : ''}
        ${processDesignerPanel}
        ${processFlowDesignerPanel}
        ${historyPanelHtml}
        ${editable && type === 'task' ? `
        <div class="workflow-detail-actions">
          <button id="btn-workflow-task-start" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold" type="button">Passer en cours</button>
          <button id="btn-workflow-task-complete-checklist" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold" type="button">Cocher checklist</button>
          <button id="btn-workflow-task-approve" class="btn-primary task-action-btn px-3 py-2 rounded-lg text-white text-xs font-semibold" data-action-kind="success" type="button">Valider</button>
        </div>
        ` : ''}
        ${type === 'process' ? `
        <div class="workflow-detail-actions">
          ${editable ? '<button id="btn-workflow-process-submit" class="btn-primary task-action-btn px-3 py-2 rounded-lg text-white text-xs font-semibold" data-action-kind="submit" type="button">Soumettre en revue</button>' : ''}
          <button id="btn-workflow-process-approve" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold" type="button" ${canValidateCurrentProcess ? '' : 'disabled'} title="${canValidateCurrentProcess ? 'Valider niveau' : 'Validation reservee aux profils habilites'}">Approuver niveau</button>
          <button id="btn-workflow-process-reject" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" type="button" ${canValidateCurrentProcess ? '' : 'disabled'} title="${canValidateCurrentProcess ? 'Rejeter vers draft' : 'Validation reservee aux profils habilites'}">Rejeter vers draft</button>
          <button id="btn-workflow-process-export" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" type="button">Exporter fiche PDF</button>
          ${editable ? '<button id="btn-workflow-process-template" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" type="button">Creer modele</button>' : ''}
        </div>
        ` : ''}
        ${type === 'service' ? `
        <div class="workflow-detail-actions">
          <button id="btn-workflow-service-export" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" type="button">Exporter fiche service PDF</button>
        </div>
        ` : ''}
        ${type === 'agent' ? `
        <div class="workflow-detail-actions">
          <button id="btn-workflow-agent-export" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" type="button">Exporter fiche agent PDF</button>
        </div>
        ` : ''}
        ${type === 'software' ? `
        <div class="workflow-map-col">
          <h6>Suivi des versions logicielles</h6>
          <p class="workflow-card-sub">Version: ${esc(String(softwareVersionLatest?.version || item?.metadata?.softwareVersion || '-'))}</p>
          <p class="workflow-card-sub">Maj: ${esc(softwareVersionLatest?.updatedAt ? new Date(Number(softwareVersionLatest.updatedAt)).toLocaleString('fr-FR') : '-')}</p>
          <p class="workflow-card-sub">Ref ID: ${esc(String(softwareVersionLatest?.softwareId || item?.metadata?.softwareVersionRefId || '-'))}</p>
          <p class="workflow-card-sub">Notes: ${esc(String(softwareVersionLatest?.notes || item?.metadata?.softwareVersionNotes || '-'))}</p>
          ${softwareVersionMatches.length ? `
          <div class="overflow-x-auto" style="margin-top:0.4rem;">
            <table class="min-w-full text-xs">
              <thead><tr><th class="px-2 py-1 text-left">Version</th><th class="px-2 py-1 text-left">Maj</th><th class="px-2 py-1 text-left">Notes</th>${editable ? '<th class="px-2 py-1 text-right">Actions</th>' : ''}</tr></thead>
              <tbody>${softwareVersionMatches.map((row) => `<tr><td class="px-2 py-1">${esc(String(row.version || '-'))}</td><td class="px-2 py-1">${esc(row.updatedAt ? new Date(Number(row.updatedAt)).toLocaleString('fr-FR') : '-')}</td><td class="px-2 py-1">${esc(String(row.notes || '-'))}</td>${editable ? `<td class="px-2 py-1 text-right"><button type="button" class="workflow-btn-light text-xs px-2 py-1" data-wf-software-version-edit="${esc(String(row.softwareId || ''))}">Modifier</button> <button type="button" class="workflow-btn-light text-xs px-2 py-1" data-wf-software-version-delete="${esc(String(row.softwareId || ''))}">Supprimer</button></td>` : ''}</tr>`).join('')}</tbody>
            </table>
          </div>
          ` : '<p class="workflow-card-sub">Aucune entree referentielle pour ce logiciel.</p>'}
          ${editable ? `
            <div class="workflow-perm-create-grid" style="margin-top:0.45rem;">
              <input id="wf-software-version-input" class="workflow-form-input" type="text" placeholder="Version (ex: 3.4.1)">
              <input id="wf-software-version-notes-input" class="workflow-form-input" type="text" placeholder="Notes version (optionnel)">
              <button id="btn-wf-software-version-add" type="button" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold">Ajouter version</button>
            </div>
          ` : ''}
        </div>
        <div class="workflow-map-col workflow-perm-panel">
          <h6>Profils d habilitation</h6>
          ${permissionProfiles.length ? `
            <div class="workflow-perm-table-wrap">
              <table class="workflow-perm-table">
                <thead><tr><th>Nom</th><th>Niveau</th><th>Sensibilite</th><th></th></tr></thead>
                <tbody>
                  ${permissionProfiles.map((row) => `
                    <tr>
                      <td>${esc(String(row.name || '-'))}</td>
                      <td>${esc(String(row.level || 'read'))}</td>
                      <td>${esc(String(row.sensitivity || 'normal'))}</td>
                      <td class="text-right">
                        ${editable ? `<button type="button" class="workflow-btn-light text-xs" data-wf-perm-profile-delete="${esc(String(row.id || ''))}">Supprimer</button>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="workflow-card-sub">Aucun profil defini.</p>'}
          ${editable ? `
            <div class="workflow-perm-create-grid">
              <input id="wf-perm-profile-name" class="workflow-form-input" type="text" placeholder="Nom profil (ex: Lecteur metier)">
              <select id="wf-perm-profile-level" class="workflow-form-select">
                ${PERMISSION_LEVEL_OPTIONS.map((level) => `<option value="${esc(level)}">${esc(level)}</option>`).join('')}
              </select>
              <select id="wf-perm-profile-sensitivity" class="workflow-form-select">
                <option value="normal">normal</option>
                <option value="sensitive">sensitive</option>
                <option value="critical">critical</option>
              </select>
              <input id="wf-perm-profile-description" class="workflow-form-input" type="text" placeholder="Description courte (optionnel)">
              <button id="btn-wf-perm-profile-add" type="button" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold">Ajouter profil</button>
            </div>
          ` : ''}
        </div>
        <div class="workflow-map-col workflow-perm-panel">
          <h6>Attributions d habilitation</h6>
          ${permissionAssignments.length ? `
            <div class="workflow-perm-table-wrap">
              <table class="workflow-perm-table">
                <thead><tr><th>Beneficiaire</th><th>Profil</th><th>Statut</th><th>Revue</th><th></th></tr></thead>
                <tbody>
                  ${permissionAssignments.map((row) => `
                    <tr>
                      <td>${esc(resolvePermissionBeneficiaryLabel(row.beneficiaryType, row.beneficiaryId))} <span class="workflow-card-sub">(${esc(String(row.beneficiaryType || 'agent'))})</span></td>
                      <td>${esc(String(profileById.get(String(row.profileId || ''))?.name || row.profileName || row.profileId || '-'))}</td>
                      <td>${esc(String(row.status || 'active'))}</td>
                      <td>${esc(String(row.reviewDate || '-'))}</td>
                      <td class="text-right">
                        ${editable ? `<button type="button" class="workflow-btn-light text-xs" data-wf-perm-assignment-delete="${esc(String(row.id || ''))}">Supprimer</button>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="workflow-card-sub">Aucune attribution enregistree.</p>'}
          ${editable ? `
            <div class="workflow-perm-create-grid">
              <select id="wf-perm-assignment-beneficiary-type" class="workflow-form-select">
                <option value="agent">agent</option>
                <option value="user">user</option>
                <option value="group">group</option>
                <option value="role">role</option>
              </select>
              <input id="wf-perm-assignment-beneficiary-id" class="workflow-form-input" type="text" placeholder="ID beneficiaire">
              <select id="wf-perm-assignment-profile-id" class="workflow-form-select">
                <option value="">Profil...</option>
                ${permissionProfiles.map((row) => `<option value="${esc(String(row.id || ''))}">${esc(String(row.name || row.id || 'Profil'))}</option>`).join('')}
              </select>
              <select id="wf-perm-assignment-status" class="workflow-form-select">
                ${PERMISSION_STATUS_OPTIONS.map((status) => `<option value="${esc(status)}">${esc(status)}</option>`).join('')}
              </select>
              <input id="wf-perm-assignment-start" class="workflow-form-input" type="date">
              <input id="wf-perm-assignment-end" class="workflow-form-input" type="date">
              <input id="wf-perm-assignment-review" class="workflow-form-input" type="date">
              <input id="wf-perm-assignment-notes" class="workflow-form-input" type="text" placeholder="Motif / notes">
              <button id="btn-wf-perm-assignment-add" type="button" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold">Ajouter attribution</button>
            </div>
          ` : ''}
        </div>
        <div class="workflow-map-col workflow-perm-panel">
          <h6>Demandes d habilitation</h6>
          ${permissionRequests.length ? `
            <div class="workflow-perm-table-wrap">
              <table class="workflow-perm-table">
                <thead><tr><th>Action</th><th>Beneficiaire</th><th>Profil</th><th>Statut</th><th></th></tr></thead>
                <tbody>
                  ${permissionRequests.map((row) => `
                    <tr>
                      <td>${esc(permissionRequestActionLabel(row.action || 'grant'))}</td>
                      <td>${esc(resolvePermissionBeneficiaryLabel(row.beneficiaryType, row.beneficiaryId))}</td>
                      <td>${esc(String(profileById.get(String(row.profileId || ''))?.name || row.profileName || row.profileId || '-'))}</td>
                      <td>${esc(permissionRequestStatusLabel(row.status || 'draft'))}</td>
                      <td class="text-right">
                        ${editable ? getPermissionRequestTransitions(row.status).map((transition) => {
                          const label = transition === 'submit'
                            ? 'Soumettre'
                            : transition === 'approve'
                              ? 'Approuver'
                              : transition === 'reject'
                                ? 'Rejeter'
                                : 'Executer';
                          const kindClass = transition === 'approve' || transition === 'execute'
                            ? 'btn-primary text-white'
                            : 'workflow-btn-light';
                          return `<button type="button" class="${kindClass} text-xs px-2 py-1" data-wf-perm-request-transition="${esc(String(row.id || ''))}" data-wf-perm-transition-action="${esc(transition)}">${esc(label)}</button>`;
                        }).join(' ') : ''}
                        ${editable ? `<button type="button" class="workflow-btn-light text-xs" data-wf-perm-request-delete="${esc(String(row.id || ''))}">Supprimer</button>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="workflow-card-sub">Aucune demande enregistree.</p>'}
          ${editable ? `
            <div class="workflow-perm-create-grid">
              <select id="wf-perm-request-action" class="workflow-form-select">
                ${PERMISSION_REQUEST_ACTIONS.map((action) => `<option value="${esc(action)}">${esc(permissionRequestActionLabel(action))}</option>`).join('')}
              </select>
              <select id="wf-perm-request-status" class="workflow-form-select">
                ${PERMISSION_REQUEST_STATUS.map((status) => `<option value="${esc(status)}">${esc(permissionRequestStatusLabel(status))}</option>`).join('')}
              </select>
              <select id="wf-perm-request-beneficiary-type" class="workflow-form-select">
                <option value="agent">agent</option>
                <option value="user">user</option>
                <option value="group">group</option>
                <option value="role">role</option>
              </select>
              <input id="wf-perm-request-beneficiary-id" class="workflow-form-input" type="text" placeholder="ID beneficiaire">
              <select id="wf-perm-request-profile-id" class="workflow-form-select">
                <option value="">Profil...</option>
                ${permissionProfiles.map((row) => `<option value="${esc(String(row.id || ''))}">${esc(String(row.name || row.id || 'Profil'))}</option>`).join('')}
              </select>
              <input id="wf-perm-request-justification" class="workflow-form-input" type="text" placeholder="Justification">
              <button id="btn-wf-perm-request-add" type="button" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold">Ajouter demande</button>
            </div>
          ` : ''}
        </div>
        <div class="workflow-map-col workflow-perm-panel">
          <h6>Revues d habilitation</h6>
          ${permissionReviews.length ? `
            <div class="workflow-perm-table-wrap">
              <table class="workflow-perm-table">
                <thead><tr><th>Date revue</th><th>Beneficiaire</th><th>Decision</th><th></th></tr></thead>
                <tbody>
                  ${permissionReviews.map((row) => {
                    const assignment = assignmentById.get(String(row.assignmentId || ''));
                    const beneficiaryLabel = assignment
                      ? resolvePermissionBeneficiaryLabel(assignment.beneficiaryType, assignment.beneficiaryId)
                      : '-';
                    const decision = normalizePermissionReviewDecision(row.decision);
                    return `
                      <tr>
                        <td>${esc(String(row.reviewDate || '-'))}</td>
                        <td>${esc(beneficiaryLabel)}</td>
                        <td>${esc(decision)}</td>
                        <td class="text-right">
                          ${editable && decision === 'pending'
                            ? `<button type="button" class="btn-primary text-white text-xs px-2 py-1" data-wf-perm-review-transition="${esc(String(row.id || ''))}" data-wf-perm-review-decision="kept">Conserver</button>
                               <button type="button" class="workflow-btn-light text-xs px-2 py-1" data-wf-perm-review-transition="${esc(String(row.id || ''))}" data-wf-perm-review-decision="revoked">Retirer</button>`
                            : ''}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="workflow-card-sub">Aucune revue d habilitation.</p>'}
        </div>
        <div class="workflow-map-col workflow-perm-panel">
          <h6>Journal habilitations</h6>
          ${permissionAudit.length ? `
            <ul class="workflow-perm-audit-list">
              ${permissionAudit.map((row) => `<li><strong>${esc(String(row.action || 'update'))}</strong> - ${esc(row.createdAt ? new Date(Number(row.createdAt)).toLocaleString('fr-FR') : '-')} - ${esc(String(row.byUserId || 'system'))}</li>`).join('')}
            </ul>
          ` : '<p class="workflow-card-sub">Aucun evenement d habilitation.</p>'}
        </div>
        <div class="workflow-detail-actions">
          <button id="btn-workflow-software-export" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" type="button">Exporter fiche logiciel PDF</button>
          <button id="btn-workflow-software-sync-version" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" type="button">Synchroniser version</button>
        </div>
        ` : ''}
        ${type === 'contingencyPlan' ? `
        <div class="workflow-map-col workflow-perm-panel">
          <h6>Actions de contingence</h6>
          ${contingencyActions.length ? `
            <div class="workflow-perm-table-wrap">
              <table class="workflow-perm-table">
                <thead><tr><th>Ordre</th><th>Action</th><th>Responsable</th><th>Statut</th><th></th></tr></thead>
                <tbody>
                  ${contingencyActions.map((row) => `<tr>
                    <td>${esc(String(row.order || '-'))}</td>
                    <td>${esc(String(row.title || '-'))}</td>
                    <td>${esc(String(getMaps().agentById.get(row.ownerAgentId)?.displayName || '-'))}</td>
                    <td>${esc(normalizeContingencyActionStatus(row.status))}</td>
                    <td class="text-right">${editable ? `<button type="button" class="workflow-btn-light text-xs" data-wf-cont-action-delete="${esc(String(row.id || ''))}">Supprimer</button>` : ''}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="workflow-card-sub">Aucune action definie.</p>'}
          ${editable ? `
            <div class="workflow-perm-create-grid">
              <input id="wf-cont-action-title" class="workflow-form-input" type="text" placeholder="Action a declencher">
              <select id="wf-cont-action-owner" class="workflow-form-select">${buildSelectOptions(state.collections.agents, 'id', 'displayName', '')}</select>
              <select id="wf-cont-action-status" class="workflow-form-select">${CONTINGENCY_ACTION_STATUS.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>
              <input id="wf-cont-action-order" class="workflow-form-input" type="number" min="1" value="${esc(String((contingencyActions.length || 0) + 1))}">
              <button id="btn-wf-cont-action-add" type="button" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold">Ajouter action</button>
            </div>
          ` : ''}
        </div>
        <div class="workflow-map-col workflow-perm-panel">
          <h6>Activations</h6>
          ${contingencyActivations.length ? `
            <div class="workflow-perm-table-wrap">
              <table class="workflow-perm-table">
                <thead><tr><th>Debut</th><th>Statut</th><th>Initiateur</th><th></th></tr></thead>
                <tbody>
                  ${contingencyActivations.map((row) => `<tr>
                    <td>${esc(row.startedAt ? new Date(Number(row.startedAt)).toLocaleString('fr-FR') : '-')}</td>
                    <td>${esc(normalizeContingencyActivationStatus(row.status))}</td>
                    <td>${esc(String(row.initiatorUserId || '-'))}</td>
                    <td class="text-right">${editable && normalizeContingencyActivationStatus(row.status) === 'active' ? `<button type="button" class="workflow-btn-light text-xs" data-wf-cont-activation-close="${esc(String(row.id || ''))}">Cloturer</button>` : ''}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="workflow-card-sub">Aucune activation.</p>'}
        </div>
        <div class="workflow-map-col workflow-perm-panel">
          <h6>Exercices de test</h6>
          ${contingencyExercises.length ? `
            <div class="workflow-perm-table-wrap">
              <table class="workflow-perm-table">
                <thead><tr><th>Date</th><th>Resultat</th><th>Notes</th>${editable ? '<th></th>' : ''}</tr></thead>
                <tbody>
                  ${contingencyExercises.map((row) => `<tr>
                    <td>${esc(String(row.exerciseDate || '-'))}</td>
                    <td><span class="workflow-badge workflow-badge-${esc(normalizeContingencyExerciseResult(row.result))}">${esc(normalizeContingencyExerciseResult(row.result))}</span></td>
                    <td>${esc(String(row.notes || row.findings || '-'))}</td>
                    ${editable ? `<td class="text-right"><button type="button" class="workflow-btn-light text-xs" data-wf-cont-exercise-delete="${esc(String(row.id || ''))}">Supprimer</button></td>` : ''}
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="workflow-card-sub">Aucun exercice enregistre.</p>'}
          ${editable ? `
            <div class="workflow-perm-create-grid" style="margin-top:0.6rem;">
              <input id="wf-cont-exercise-date" class="workflow-form-input" type="date">
              <select id="wf-cont-exercise-result" class="workflow-form-select">${CONTINGENCY_EXERCISE_RESULT.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>
              <input id="wf-cont-exercise-notes" class="workflow-form-input" type="text" placeholder="Resultat / ecarts">
              <button id="btn-wf-cont-exercise-add" type="button" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold">Ajouter exercice</button>
            </div>
          ` : ''}
        </div>
        <div class="workflow-map-col workflow-perm-panel">
          <h6>Revues periodiques</h6>
          ${contingencyReviews.length ? `
            <div class="workflow-perm-table-wrap">
              <table class="workflow-perm-table">
                <thead><tr><th>Date revue</th><th>Prochaine revue</th><th>Constats</th>${editable ? '<th></th>' : ''}</tr></thead>
                <tbody>
                  ${contingencyReviews.map((row) => `<tr>
                    <td>${esc(String(row.reviewDate || '-'))}</td>
                    <td>${esc(String(row.nextReviewDate || '-'))}</td>
                    <td>${esc(String(row.findings || row.comments || '-'))}</td>
                    ${editable ? `<td class="text-right"><button type="button" class="workflow-btn-light text-xs" data-wf-cont-review-delete="${esc(String(row.id || ''))}">Supprimer</button></td>` : ''}
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="workflow-card-sub">Aucune revue enregistree.</p>'}
          ${editable ? `
            <div class="workflow-perm-create-grid" style="margin-top:0.6rem;">
              <input id="wf-cont-review-date" class="workflow-form-input" type="date" placeholder="Date revue">
              <input id="wf-cont-review-next-date" class="workflow-form-input" type="date" placeholder="Prochaine revue">
              <input id="wf-cont-review-comments" class="workflow-form-input" type="text" placeholder="Constats revue">
              <button id="btn-wf-cont-review-add" type="button" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold">Ajouter revue</button>
            </div>
          ` : ''}
        </div>
        <div class="workflow-map-col workflow-perm-panel">
          <h6>Journal contingence</h6>
          ${contingencyAudit.length ? `
            <ul class="workflow-perm-audit-list">
              ${contingencyAudit.map((row) => `<li><strong>${esc(String(row.eventType || 'update'))}</strong> - ${esc(row.createdAt ? new Date(Number(row.createdAt)).toLocaleString('fr-FR') : '-')} - ${esc(String(row.byUserId || 'system'))}</li>`).join('')}
            </ul>
          ` : '<p class="workflow-card-sub">Aucun evenement.</p>'}
        </div>
        <div class="workflow-detail-actions">
          ${editable ? '<button id="btn-wf-cont-activate" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold" type="button">Activer plan</button>' : ''}
          <button id="btn-wf-cont-export-pdf" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" type="button">Exporter PDF</button>
          <button id="btn-wf-cont-export-csv" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" type="button">Exporter CSV</button>
        </div>
        ` : ''}
        ${editable && type === 'template' ? `
        <div class="workflow-detail-actions">
          <button id="btn-workflow-template-instantiate" class="btn-primary px-3 py-2 rounded-lg text-white text-xs font-semibold" type="button">Instancier ce modele</button>
          <button id="btn-workflow-template-variant" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" type="button">Creer variante</button>
          <button id="btn-workflow-template-publish" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" type="button">Publier</button>
          <button id="btn-workflow-template-archive" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" type="button">Archiver</button>
          <button id="btn-workflow-template-unarchive" class="workflow-btn-light px-3 py-2 rounded-lg text-xs font-semibold" type="button">Reactiver</button>
        </div>
        ` : ''}
        ${editable ? `
        <div class="workflow-detail-actions">
          <button id="btn-workflow-delete" class="workflow-btn-danger" type="button">Supprimer</button>
          <button id="btn-workflow-save" class="btn-primary task-action-btn px-3 py-2 rounded-lg text-white text-xs font-semibold" data-action-kind="save" type="button">Enregistrer</button>
        </div>
        ` : '<p class="text-xs text-slate-500">Lecture seule: edition reservee au role admin ou manager workflow.</p>'}
      `;

      if (type === 'process') {
        document.getElementById('btn-workflow-process-submit')?.addEventListener('click', async () => {
          await transitionProcessValidation(id, 'submit_review');
        });
        document.getElementById('btn-workflow-process-approve')?.addEventListener('click', async () => {
          await transitionProcessValidation(id, 'approve_level');
        });
        document.getElementById('btn-workflow-process-reject')?.addEventListener('click', async () => {
          await transitionProcessValidation(id, 'reject');
        });
        document.getElementById('btn-workflow-process-export')?.addEventListener('click', () => {
          exportProcessSheetPdf(id);
        });
      }
      if (type === 'service') {
        document.getElementById('btn-workflow-service-export')?.addEventListener('click', () => {
          exportServiceSheetPdf(id);
        });
      }
      if (type === 'agent') {
        document.getElementById('btn-workflow-agent-export')?.addEventListener('click', () => {
          exportAgentSheetPdf(id);
        });
      }
      if (type === 'software') {
        const refreshSoftwareDetail = async () => {
          await loadCollections();
          renderServiceFilter();
          renderContent();
          openDetail('software', id);
        };
        document.getElementById('btn-workflow-software-export')?.addEventListener('click', () => {
          exportSoftwareSheetPdf(id);
        });
        document.getElementById('btn-workflow-software-sync-version')?.addEventListener('click', async () => {
          await syncWorkflowSoftwareWithLatestVersion(id);
        });
        document.getElementById('btn-wf-software-version-add')?.addEventListener('click', async () => {
          if (!editable) return;
          if (typeof api.upsertSoftwareVersionEntry !== 'function') {
            toast('Ajout de version indisponible');
            return;
          }
          const version = String(document.getElementById('wf-software-version-input')?.value || '').trim();
          const notes = String(document.getElementById('wf-software-version-notes-input')?.value || '').trim();
          if (!version) {
            toast('Version requise');
            return;
          }
          await api.upsertSoftwareVersionEntry({
            softwareName: String(item.name || '').trim() || String(id),
            version,
            notes
          });
          await logAudit('software_version_create_inline', 'software', id, { version, notes });
          await refreshSoftwareDetail();
          toast('Version logicielle ajoutee');
        });
        refs.detailBody?.querySelectorAll('[data-wf-software-version-edit]')?.forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (!editable) return;
            if (typeof api.upsertSoftwareVersionEntry !== 'function') {
              toast('Edition de version indisponible');
              return;
            }
            const softwareVersionId = String(btn.getAttribute('data-wf-software-version-edit') || '').trim();
            if (!softwareVersionId) return;
            const current = (state.collections.softwareVersions || []).find((row) => String(row.softwareId || '') === softwareVersionId);
            if (!current) return;
            const nextVersion = (global.prompt('Version', String(current.version || '')) || '').trim();
            if (!nextVersion) return;
            const nextNotes = (global.prompt('Notes', String(current.notes || '')) || '').trim();
            await api.upsertSoftwareVersionEntry({
              softwareId: softwareVersionId,
              softwareName: String(current.softwareName || item.name || '').trim() || String(id),
              version: nextVersion,
              notes: nextNotes
            });
            await logAudit('software_version_update_inline', 'software', id, { softwareVersionId, version: nextVersion });
            await refreshSoftwareDetail();
            toast('Version logicielle modifiee');
          });
        });
        refs.detailBody?.querySelectorAll('[data-wf-software-version-delete]')?.forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (!editable) return;
            if (typeof api.deleteSoftwareVersionEntry !== 'function') {
              toast('Suppression de version indisponible');
              return;
            }
            const softwareVersionId = String(btn.getAttribute('data-wf-software-version-delete') || '').trim();
            if (!softwareVersionId) return;
            const current = (state.collections.softwareVersions || []).find((row) => String(row.softwareId || '') === softwareVersionId);
            if (!current) return;
            if (!global.confirm(`Supprimer l entree ${String(current.softwareName || item.name || 'Logiciel')} ${String(current.version || '')} ?`)) return;
            await api.deleteSoftwareVersionEntry(softwareVersionId);
            await logAudit('software_version_delete_inline', 'software', id, { softwareVersionId });
            await refreshSoftwareDetail();
            toast('Version logicielle supprimee');
          });
        });
        document.getElementById('btn-wf-perm-profile-add')?.addEventListener('click', async () => {
          if (!editable) return;
          const profileName = String(document.getElementById('wf-perm-profile-name')?.value || '').trim();
          if (!profileName) {
            toast('Nom de profil requis');
            return;
          }
          const profileLevel = normalizePermissionLevel(document.getElementById('wf-perm-profile-level')?.value || 'read');
          const profileSensitivity = String(document.getElementById('wf-perm-profile-sensitivity')?.value || 'normal').trim() || 'normal';
          const profileDescription = String(document.getElementById('wf-perm-profile-description')?.value || '').trim();
          const row = {
            id: `wf-perm-profile-${uid()}`,
            softwareId: id,
            name: profileName,
            level: profileLevel,
            sensitivity: profileSensitivity,
            description: profileDescription,
            createdByUserId: currentUserId(),
            createdAt: now(),
            updatedAt: now()
          };
          await api.put('workflowPermissionProfiles', row, STORE_KEY_FIELDS.workflowPermissionProfiles);
          await logPermissionAudit('profile_create', id, { profileId: row.id, name: row.name, level: row.level });
          await logAudit('permission_profile_create', 'software', id, { profileId: row.id, name: row.name });
          await loadCollections();
          renderServiceFilter();
          renderContent();
          openDetail('software', id);
          toast('Profil d habilitation ajoute');
        });
        refs.detailBody?.querySelectorAll('[data-wf-perm-profile-delete]')?.forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (!editable) return;
            const profileId = String(btn.getAttribute('data-wf-perm-profile-delete') || '').trim();
            if (!profileId) return;
            const inUse = (state.collections.permissionAssignments || []).some((row) => String(row.profileId || '') === profileId);
            if (inUse) {
              toast('Profil utilise par des attributions');
              return;
            }
            await api.remove('workflowPermissionProfiles', profileId);
            await logPermissionAudit('profile_delete', id, { profileId });
            await logAudit('permission_profile_delete', 'software', id, { profileId });
            await loadCollections();
            renderServiceFilter();
            renderContent();
            openDetail('software', id);
          });
        });

        document.getElementById('btn-wf-perm-assignment-add')?.addEventListener('click', async () => {
          if (!editable) return;
          const beneficiaryType = normalizePermissionBeneficiaryType(document.getElementById('wf-perm-assignment-beneficiary-type')?.value || 'agent');
          const beneficiaryId = String(document.getElementById('wf-perm-assignment-beneficiary-id')?.value || '').trim();
          const profileId = String(document.getElementById('wf-perm-assignment-profile-id')?.value || '').trim();
          if (!beneficiaryId || !profileId) {
            toast('Beneficiaire et profil requis');
            return;
          }
          const profile = (state.collections.permissionProfiles || []).find((row) => String(row.id || '') === profileId);
          if (!profile) {
            toast('Profil introuvable');
            return;
          }
          const row = {
            id: `wf-perm-assignment-${uid()}`,
            softwareId: id,
            profileId,
            profileName: String(profile.name || profileId),
            level: normalizePermissionLevel(profile.level),
            beneficiaryType,
            beneficiaryId,
            beneficiaryLabel: resolvePermissionBeneficiaryLabel(beneficiaryType, beneficiaryId),
            status: normalizePermissionStatus(document.getElementById('wf-perm-assignment-status')?.value || 'active'),
            startDate: normalizeIsoDate(document.getElementById('wf-perm-assignment-start')?.value || ''),
            endDate: normalizeIsoDate(document.getElementById('wf-perm-assignment-end')?.value || ''),
            reviewDate: normalizeIsoDate(document.getElementById('wf-perm-assignment-review')?.value || ''),
            notes: String(document.getElementById('wf-perm-assignment-notes')?.value || '').trim(),
            source: 'manual',
            createdByUserId: currentUserId(),
            createdAt: now(),
            updatedAt: now()
          };
          await api.put('workflowPermissionAssignments', row, STORE_KEY_FIELDS.workflowPermissionAssignments);
          await logPermissionAudit('assignment_create', id, { assignmentId: row.id, beneficiaryType, beneficiaryId, profileId });
          await logAudit('permission_assignment_create', 'software', id, { assignmentId: row.id, beneficiaryId, profileId });
          await loadCollections();
          renderServiceFilter();
          renderContent();
          openDetail('software', id);
          toast('Attribution ajoutee');
        });
        refs.detailBody?.querySelectorAll('[data-wf-perm-assignment-delete]')?.forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (!editable) return;
            const assignmentId = String(btn.getAttribute('data-wf-perm-assignment-delete') || '').trim();
            if (!assignmentId) return;
            await api.remove('workflowPermissionAssignments', assignmentId);
            await logPermissionAudit('assignment_delete', id, { assignmentId });
            await logAudit('permission_assignment_delete', 'software', id, { assignmentId });
            await loadCollections();
            renderServiceFilter();
            renderContent();
            openDetail('software', id);
          });
        });

        document.getElementById('btn-wf-perm-request-add')?.addEventListener('click', async () => {
          if (!editable) return;
          const action = normalizePermissionRequestAction(document.getElementById('wf-perm-request-action')?.value || 'grant');
          const status = normalizePermissionRequestStatus(document.getElementById('wf-perm-request-status')?.value || 'draft');
          const beneficiaryType = normalizePermissionBeneficiaryType(document.getElementById('wf-perm-request-beneficiary-type')?.value || 'agent');
          const beneficiaryId = String(document.getElementById('wf-perm-request-beneficiary-id')?.value || '').trim();
          const profileId = String(document.getElementById('wf-perm-request-profile-id')?.value || '').trim();
          const justification = String(document.getElementById('wf-perm-request-justification')?.value || '').trim();
          if (!beneficiaryId || !profileId) {
            toast('Beneficiaire et profil requis');
            return;
          }
          const profile = (state.collections.permissionProfiles || []).find((row) => String(row.id || '') === profileId);
          const row = {
            id: `wf-perm-request-${uid()}`,
            softwareId: id,
            action,
            status,
            beneficiaryType,
            beneficiaryId,
            beneficiaryLabel: resolvePermissionBeneficiaryLabel(beneficiaryType, beneficiaryId),
            profileId,
            profileName: String(profile?.name || profileId),
            requestedByUserId: currentUserId(),
            approverUserId: null,
            executedByUserId: null,
            requestedAt: now(),
            approvedAt: null,
            executedAt: null,
            justification,
            comments: '',
            updatedAt: now()
          };
          await api.put('workflowPermissionRequests', row, STORE_KEY_FIELDS.workflowPermissionRequests);
          await logPermissionAudit('request_create', id, { requestId: row.id, action: row.action, beneficiaryId, profileId });
          await logAudit('permission_request_create', 'software', id, { requestId: row.id, action: row.action });
          await loadCollections();
          renderServiceFilter();
          renderContent();
          openDetail('software', id);
          toast('Demande ajoutee');
        });
        refs.detailBody?.querySelectorAll('[data-wf-perm-request-delete]')?.forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (!editable) return;
            const requestId = String(btn.getAttribute('data-wf-perm-request-delete') || '').trim();
            if (!requestId) return;
            await api.remove('workflowPermissionRequests', requestId);
            await logPermissionAudit('request_delete', id, { requestId });
            await logAudit('permission_request_delete', 'software', id, { requestId });
            await loadCollections();
            renderServiceFilter();
            renderContent();
            openDetail('software', id);
          });
        });
        refs.detailBody?.querySelectorAll('[data-wf-perm-request-transition]')?.forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (!editable) return;
            const requestId = String(btn.getAttribute('data-wf-perm-request-transition') || '').trim();
            const transition = String(btn.getAttribute('data-wf-perm-transition-action') || '').trim();
            if (!requestId || !transition) return;
            await transitionPermissionRequest(requestId, transition);
          });
        });
        refs.detailBody?.querySelectorAll('[data-wf-perm-review-transition]')?.forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (!editable) return;
            const reviewId = String(btn.getAttribute('data-wf-perm-review-transition') || '').trim();
            const decision = String(btn.getAttribute('data-wf-perm-review-decision') || '').trim();
            if (!reviewId || !decision) return;
            await transitionPermissionReview(reviewId, decision);
          });
        });
      }

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
        if (type === 'process') {
          document.getElementById('btn-workflow-process-template')?.addEventListener('click', async () => {
            await createTemplateFromProcess(id);
          });
          refs.detailBody?.querySelectorAll('[data-wf-designer-add-type]')?.forEach((btn) => {
            btn.addEventListener('click', async () => {
              if (!canEditWorkflow()) return;
              const stepType = String(btn.getAttribute('data-wf-designer-add-type') || 'action').trim() || 'action';
              const ordered = getProcessStepsSorted(id);
              const nextOrder = ordered.length + 1;
              const ownerAgentId = item.ownerAgentId || null;
              const roleId = Array.isArray(item?.validation?.requiredRoleIds) && item.validation.requiredRoleIds.length
                ? item.validation.requiredRoleIds[0]
                : null;
              const stepId = `wf-step-${uid()}`;
              await api.put('workflowProcessSteps', {
                id: stepId,
                processId: id,
                title: `${stepType === 'decision' ? 'Decision' : stepType === 'validation' ? 'Validation' : stepType === 'notification' ? 'Notification' : 'Etape'} ${nextOrder}`,
                stepType,
                description: '',
                serviceId: item.serviceId || null,
                groupId: item.groupId || null,
                ownerAgentId,
                roleId,
                linkedProcedureId: null,
                linkedSoftwareIds: [],
                linkedTaskId: null,
                estimatedDurationMinutes: 15,
                order: nextOrder,
                metadata: { createdByDesigner: true },
                createdAt: now(),
                updatedAt: now()
              }, STORE_KEY_FIELDS.workflowProcessSteps);
              if (!item?.metadata?.customFlowMode) {
                const sequence = getProcessStepsSorted(id).map((step) => step.id).concat([stepId]);
                await relinkProcessFlowsLinear(id, sequence, { reason: 'designer_add' });
              }
              await logAudit('designer_add_step', 'process', id, { stepId, stepType });
              await loadCollections();
              renderServiceFilter();
              renderContent();
              openDetail('process', id);
              toast('Etape ajoutee');
            });
          });
          refs.detailBody?.querySelectorAll('[data-wf-designer-action][data-wf-step-id]')?.forEach((btn) => {
            btn.addEventListener('click', async () => {
              const action = String(btn.getAttribute('data-wf-designer-action') || '').trim();
              const stepId = String(btn.getAttribute('data-wf-step-id') || '').trim();
              if (!action || !stepId) return;
              if (action === 'open-step') {
                openDetail('step', stepId);
                return;
              }
              if (!canEditWorkflow()) return;
              const ordered = getProcessStepsSorted(id);
              const index = ordered.findIndex((step) => String(step.id) === stepId);
              if (index < 0) return;
              if (action === 'duplicate-step') {
                const source = ordered[index];
                const duplicateId = `wf-step-${uid()}`;
                await api.put('workflowProcessSteps', {
                  ...source,
                  id: duplicateId,
                  title: `${source.title || 'Etape'} (copie)`,
                  order: ordered.length + 1,
                  metadata: { ...(source.metadata || {}), duplicatedFrom: source.id, createdByDesigner: true },
                  createdAt: now(),
                  updatedAt: now()
                }, STORE_KEY_FIELDS.workflowProcessSteps);
                if (!item?.metadata?.customFlowMode) {
                  const nextSequence = getProcessStepsSorted(id).map((step) => step.id).concat([duplicateId]);
                  await relinkProcessFlowsLinear(id, nextSequence, { reason: 'designer_duplicate' });
                }
                await logAudit('designer_duplicate_step', 'process', id, { sourceStepId: source.id, duplicateId });
                await loadCollections();
                renderServiceFilter();
                renderContent();
                openDetail('process', id);
                toast('Etape dupliquee');
                return;
              }
              if (action === 'move-up' || action === 'move-down') {
                const swapIndex = action === 'move-up' ? index - 1 : index + 1;
                if (swapIndex < 0 || swapIndex >= ordered.length) return;
                const tmp = ordered[index];
                ordered[index] = ordered[swapIndex];
                ordered[swapIndex] = tmp;
                for (let i = 0; i < ordered.length; i += 1) {
                  const row = ordered[i];
                  await api.put('workflowProcessSteps', {
                    ...row,
                    order: i + 1,
                    updatedAt: now()
                  }, STORE_KEY_FIELDS.workflowProcessSteps);
                }
                if (!item?.metadata?.customFlowMode) {
                  await relinkProcessFlowsLinear(id, ordered.map((step) => step.id), { reason: 'designer_reorder' });
                }
                await logAudit('designer_reorder_steps', 'process', id, { stepId, action });
                await loadCollections();
                renderServiceFilter();
                renderContent();
                openDetail('process', id);
                return;
              }
              if (action === 'delete-step') {
                const step = ordered[index];
                await api.remove('workflowProcessSteps', step.id);
                const next = ordered.filter((row) => String(row.id) !== String(step.id));
                for (let i = 0; i < next.length; i += 1) {
                  await api.put('workflowProcessSteps', {
                    ...next[i],
                    order: i + 1,
                    updatedAt: now()
                  }, STORE_KEY_FIELDS.workflowProcessSteps);
                }
                const flows = getProcessFlows(id);
                for (const flow of flows) {
                  if (String(flow.fromStepId || '') === String(step.id) || String(flow.toStepId || '') === String(step.id)) {
                    await api.remove('workflowFlows', flow.id);
                  }
                }
                if (!item?.metadata?.customFlowMode && next.length > 1) {
                  await relinkProcessFlowsLinear(id, next.map((row) => row.id), { reason: 'designer_delete' });
                }
                await logAudit('designer_delete_step', 'process', id, { stepId: step.id });
                await loadCollections();
                renderServiceFilter();
                renderContent();
                openDetail('process', id);
                toast('Etape supprimee');
                return;
              }
            });
          });
          refs.detailBody?.querySelectorAll('[data-wf-designer-action="relink"]')?.forEach((btn) => {
            btn.addEventListener('click', async () => {
              if (!canEditWorkflow()) return;
              const ordered = getProcessStepsSorted(id);
              if (ordered.length < 2) {
                toast('Au moins 2 etapes sont requises');
                return;
              }
              await relinkProcessFlowsLinear(id, ordered.map((step) => step.id), { reason: 'designer_relink' });
              await logAudit('designer_relink_flows', 'process', id, { steps: ordered.length });
              await loadCollections();
              renderServiceFilter();
              renderContent();
              openDetail('process', id);
              toast('Flux relie automatiquement');
            });
          });
          const refreshFlowGraphSelection = () => {
            const selectedFlowSet = new Set(
              (Array.isArray(state.flowDesigner?.selectedFlowIds) ? state.flowDesigner.selectedFlowIds : [])
                .map((flowId) => String(flowId || '').trim())
                .filter(Boolean)
            );
            refs.detailBody?.querySelectorAll('[data-wf-flow-graph-node]')?.forEach((node) => {
              const stepId = String(node.getAttribute('data-wf-flow-graph-node') || '').trim();
              node.classList.toggle('is-selected', stepId && stepId === String(state.flowDesigner?.sourceStepId || ''));
            });
            refs.detailBody?.querySelectorAll('[data-wf-flow-graph-edge]')?.forEach((edge) => {
              const edgeId = String(edge.getAttribute('data-wf-flow-graph-edge') || '').trim();
              edge.classList.toggle('is-selected', !!(edgeId && (selectedFlowSet.has(edgeId) || edgeId === String(state.flowDesigner?.selectedFlowId || ''))));
            });
          };
          const normalizeFlowSelection = (ids) => Array.from(new Set(
            (Array.isArray(ids) ? ids : [])
              .map((flowId) => String(flowId || '').trim())
              .filter(Boolean)
          ));
          const setFlowSelection = (ids, primaryId = null) => {
            const normalized = normalizeFlowSelection(ids);
            const safePrimary = String(primaryId || '').trim();
            state.flowDesigner.selectedFlowIds = normalized;
            if (safePrimary && normalized.includes(safePrimary)) {
              state.flowDesigner.selectedFlowId = safePrimary;
            } else {
              state.flowDesigner.selectedFlowId = normalized[0] || null;
            }
          };
          const fillFlowForm = (flow) => {
            if (!flow) return;
            const sourceInput = document.getElementById('wf-flow-source');
            const targetInput = document.getElementById('wf-flow-target');
            const typeInput = document.getElementById('wf-flow-type');
            const conditionInput = document.getElementById('wf-flow-condition');
            const labelInput = document.getElementById('wf-flow-label');
            if (sourceInput) sourceInput.value = String(flow.fromStepId || '');
            if (targetInput) targetInput.value = String(flow.toStepId || '');
            if (typeInput) typeInput.value = String(flow.flowType || 'sequence');
            if (conditionInput) conditionInput.value = String(flow.condition || '');
            if (labelInput) labelInput.value = String(flow.label || '');
          };
          const createFlowFromGraph = async (fromStepId, toStepId, flowType = 'sequence', condition = '', label = '') => {
            const safeFrom = String(fromStepId || '').trim();
            const safeTo = String(toStepId || '').trim();
            if (!safeFrom || !safeTo || safeFrom === safeTo) {
              toast('Flux invalide: source/cible');
              return false;
            }
            const alreadyExists = getProcessFlows(id).some((row) =>
              String(row.fromStepId || '') === safeFrom
              && String(row.toStepId || '') === safeTo
              && String(row.flowType || 'sequence') === String(flowType || 'sequence')
            );
            if (alreadyExists) {
              toast('Flux deja present');
              return false;
            }
            const processCurrent = getItem('process', id);
            if (!processCurrent) {
              toast('Processus introuvable');
              return false;
            }
            const newFlowId = `wf-flow-${uid()}`;
            await api.put('workflowFlows', {
              id: newFlowId,
              processId: id,
              fromStepId: safeFrom,
              toStepId: safeTo,
              flowType: String(flowType || 'sequence').trim() || 'sequence',
              condition: String(condition || '').trim(),
              label: String(label || '').trim() || `Flux ${String(flowType || 'sequence').trim() || 'sequence'}`,
              metadata: { customFlow: true, createdFromGraph: true },
              createdAt: now(),
              updatedAt: now()
            }, STORE_KEY_FIELDS.workflowFlows);
            await api.put('workflowProcesses', {
              ...processCurrent,
              metadata: { ...(processCurrent.metadata || {}), customFlowMode: true },
              updatedAt: now()
            }, STORE_KEY_FIELDS.workflowProcesses);
            await logAudit('designer_add_flow_drag', 'process', id, { fromStepId: safeFrom, toStepId: safeTo, flowType });
            setFlowSelection([newFlowId], newFlowId);
            state.flowDesigner.sourceStepId = safeFrom || null;
            return true;
          };
          refs.detailBody?.querySelectorAll('[data-wf-flow-graph-node]')?.forEach((node) => {
            node.addEventListener('mousedown', (event) => {
              if (!canEditWorkflow() || !state.flowDesigner.linkMode) return;
              event.preventDefault();
              event.stopPropagation();
              const stepId = String(node.getAttribute('data-wf-flow-graph-node') || '').trim();
              if (!stepId) return;
              state.flowDesigner.dragSourceStepId = stepId;
              state.flowDesigner.sourceStepId = stepId;
              setFlowSelection([], null);
              const sourceInput = document.getElementById('wf-flow-source');
              if (sourceInput) sourceInput.value = stepId;
              refreshFlowGraphSelection();
            });
            node.addEventListener('mouseup', async (event) => {
              if (!canEditWorkflow() || !state.flowDesigner.linkMode) return;
              event.preventDefault();
              event.stopPropagation();
              const targetStepId = String(node.getAttribute('data-wf-flow-graph-node') || '').trim();
              const sourceStepId = String(state.flowDesigner.dragSourceStepId || state.flowDesigner.sourceStepId || '').trim();
              state.flowDesigner.dragSourceStepId = null;
              if (!sourceStepId || !targetStepId || sourceStepId === targetStepId) {
                refreshFlowGraphSelection();
                return;
              }
              const created = await createFlowFromGraph(sourceStepId, targetStepId, 'sequence', '', 'Flux drag-link');
              if (!created) return;
              await loadCollections();
              renderServiceFilter();
              renderContent();
              openDetail('process', id);
              toast('Flux cree par drag-link');
            });
            node.addEventListener('click', () => {
              if (!canEditWorkflow()) return;
              if (state.flowDesigner.linkMode) return;
              const stepId = String(node.getAttribute('data-wf-flow-graph-node') || '').trim();
              if (!stepId) return;
              const sourceInput = document.getElementById('wf-flow-source');
              const targetInput = document.getElementById('wf-flow-target');
              const previousSource = String(state.flowDesigner?.sourceStepId || '').trim();
              if (!previousSource || previousSource === stepId) {
                state.flowDesigner.sourceStepId = previousSource === stepId ? null : stepId;
                if (sourceInput) sourceInput.value = String(state.flowDesigner.sourceStepId || '');
              } else {
                if (sourceInput) sourceInput.value = previousSource;
                if (targetInput) targetInput.value = stepId;
              state.flowDesigner.sourceStepId = null;
            }
              setFlowSelection([], null);
              refreshFlowGraphSelection();
            });
          });
          refs.detailBody?.querySelectorAll('[data-wf-flow-graph-edge]')?.forEach((edge) => {
            edge.addEventListener('click', (event) => {
              if (!canEditWorkflow()) return;
              const flowId = String(edge.getAttribute('data-wf-flow-graph-edge') || '').trim();
              if (!flowId) return;
              const flow = (state.collections.flows || []).find((row) => String(row.id) === flowId);
              if (!flow) return;
              const multiClick = !!(state.flowDesigner.multiSelectMode || event?.ctrlKey || event?.metaKey || event?.shiftKey);
              const currentSet = new Set(normalizeFlowSelection(state.flowDesigner.selectedFlowIds));
              if (multiClick) {
                if (currentSet.has(flowId)) {
                  currentSet.delete(flowId);
                } else {
                  currentSet.add(flowId);
                }
                setFlowSelection(Array.from(currentSet), flowId);
              } else {
                setFlowSelection([flowId], flowId);
              }
              state.flowDesigner.sourceStepId = String(flow.fromStepId || '').trim() || null;
              fillFlowForm(flow);
              refreshFlowGraphSelection();
              const card = refs.detailBody?.querySelector(`[data-wf-flow-card-id="${flowId}"]`);
              if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
          });
          refs.detailBody?.querySelectorAll('[data-wf-flow-action]')?.forEach((btn) => {
            btn.addEventListener('click', async () => {
              if (!canEditWorkflow()) return;
              const action = String(btn.getAttribute('data-wf-flow-action') || '').trim();
              const flowId = String(btn.getAttribute('data-wf-flow-id') || '').trim();
              if (!action) return;
              const processCurrent = getItem('process', id);
              if (!processCurrent) return;
              if (action === 'enable-custom') {
                await api.put('workflowProcesses', {
                  ...processCurrent,
                  metadata: { ...(processCurrent.metadata || {}), customFlowMode: true },
                  updatedAt: now()
                }, STORE_KEY_FIELDS.workflowProcesses);
                await logAudit('designer_enable_custom_flow_mode', 'process', id, {});
                await loadCollections();
                renderServiceFilter();
                renderContent();
                openDetail('process', id);
                return;
              }
              if (action === 'switch-linear') {
                const ordered = getProcessStepsSorted(id);
                if (ordered.length > 1) {
                  await relinkProcessFlowsLinear(id, ordered.map((step) => step.id), { reason: 'designer_switch_linear' });
                }
                await api.put('workflowProcesses', {
                  ...processCurrent,
                  metadata: { ...(processCurrent.metadata || {}), customFlowMode: false },
                  updatedAt: now()
                }, STORE_KEY_FIELDS.workflowProcesses);
                await logAudit('designer_switch_linear_flow_mode', 'process', id, {});
                await loadCollections();
                renderServiceFilter();
                renderContent();
                openDetail('process', id);
                toast('Mode lineaire active');
                return;
              }
              if (action === 'toggle-link-mode') {
                state.flowDesigner.linkMode = !state.flowDesigner.linkMode;
                state.flowDesigner.dragSourceStepId = null;
                state.flowDesigner.sourceStepId = null;
                setFlowSelection([], null);
                renderContent();
                openDetail('process', id);
                return;
              }
              if (action === 'add') {
                const fromStepId = String(document.getElementById('wf-flow-source')?.value || '').trim();
                const toStepId = String(document.getElementById('wf-flow-target')?.value || '').trim();
                const flowType = String(document.getElementById('wf-flow-type')?.value || 'sequence').trim() || 'sequence';
                const condition = String(document.getElementById('wf-flow-condition')?.value || '').trim();
                const label = String(document.getElementById('wf-flow-label')?.value || '').trim();
                if (!fromStepId || !toStepId || fromStepId === toStepId) {
                  toast('Source/cible invalide');
                  return;
                }
                const newFlowId = `wf-flow-${uid()}`;
                await api.put('workflowFlows', {
                  id: newFlowId,
                  processId: id,
                  fromStepId,
                  toStepId,
                  flowType,
                  condition,
                  label: label || `Flux ${flowType}`,
                  metadata: { customFlow: true },
                  createdAt: now(),
                  updatedAt: now()
                }, STORE_KEY_FIELDS.workflowFlows);
                await api.put('workflowProcesses', {
                  ...processCurrent,
                  metadata: { ...(processCurrent.metadata || {}), customFlowMode: true },
                  updatedAt: now()
                }, STORE_KEY_FIELDS.workflowProcesses);
                await logAudit('designer_add_flow', 'process', id, { fromStepId, toStepId, flowType });
                setFlowSelection([newFlowId], newFlowId);
                state.flowDesigner.sourceStepId = fromStepId || null;
                await loadCollections();
                renderServiceFilter();
                renderContent();
                openDetail('process', id);
                toast('Flux ajoute');
                return;
              }
              if (action === 'add-yes-no') {
                const fromStepId = String(document.getElementById('wf-flow-source')?.value || '').trim();
                const toStepIdYes = String(document.getElementById('wf-flow-target')?.value || '').trim();
                const ordered = getProcessStepsSorted(id);
                const sourceIndex = ordered.findIndex((row) => String(row.id) === fromStepId);
                const defaultNo = sourceIndex >= 0 && ordered[sourceIndex + 1] ? ordered[sourceIndex + 1].id : '';
                const toStepIdNo = String(global.prompt('Etape cible pour branche NON (id etape)', defaultNo) || '').trim();
                if (!fromStepId || !toStepIdYes || !toStepIdNo || fromStepId === toStepIdYes || fromStepId === toStepIdNo) {
                  toast('Branches invalides');
                  return;
                }
                const yesFlowId = `wf-flow-${uid()}`;
                const noFlowId = `wf-flow-${uid()}`;
                await api.put('workflowFlows', {
                  id: yesFlowId,
                  processId: id,
                  fromStepId,
                  toStepId: toStepIdYes,
                  flowType: 'decision',
                  condition: 'oui',
                  label: 'Branche oui',
                  metadata: { customFlow: true },
                  createdAt: now(),
                  updatedAt: now()
                }, STORE_KEY_FIELDS.workflowFlows);
                await api.put('workflowFlows', {
                  id: noFlowId,
                  processId: id,
                  fromStepId,
                  toStepId: toStepIdNo,
                  flowType: 'decision',
                  condition: 'non',
                  label: 'Branche non',
                  metadata: { customFlow: true },
                  createdAt: now(),
                  updatedAt: now()
                }, STORE_KEY_FIELDS.workflowFlows);
                await api.put('workflowProcesses', {
                  ...processCurrent,
                  metadata: { ...(processCurrent.metadata || {}), customFlowMode: true },
                  updatedAt: now()
                }, STORE_KEY_FIELDS.workflowProcesses);
                await logAudit('designer_add_yes_no_branch', 'process', id, { fromStepId, toStepIdYes, toStepIdNo });
                setFlowSelection([yesFlowId, noFlowId], yesFlowId);
                state.flowDesigner.sourceStepId = fromStepId || null;
                await loadCollections();
                renderServiceFilter();
                renderContent();
                openDetail('process', id);
                toast('Branche oui/non ajoutee');
                return;
              }
              if (action === 'delete' && flowId) {
                await api.remove('workflowFlows', flowId);
                await logAudit('designer_delete_flow', 'process', id, { flowId });
                const remaining = normalizeFlowSelection(state.flowDesigner.selectedFlowIds).filter((selectedId) => selectedId !== flowId);
                setFlowSelection(remaining, String(state.flowDesigner.selectedFlowId || '') === flowId ? null : state.flowDesigner.selectedFlowId);
                await loadCollections();
                renderServiceFilter();
                renderContent();
                openDetail('process', id);
                toast('Flux supprime');
                return;
              }
              if (action === 'update' && flowId) {
                const currentFlow = (state.collections.flows || []).find((row) => String(row.id) === String(flowId));
                if (!currentFlow) return;
                const card = refs.detailBody?.querySelector(`[data-wf-flow-card-id="${flowId}"]`);
                if (!card) return;
                const read = (key) => {
                  const node = card.querySelector(`[data-wf-flow-field="${key}"]`);
                  return String(node?.value || '').trim();
                };
                const fromStepId = read('fromStepId');
                const toStepId = read('toStepId');
                const flowType = read('flowType') || 'sequence';
                const condition = read('condition');
                const label = read('label');
                if (!fromStepId || !toStepId || fromStepId === toStepId) {
                  toast('Flux invalide: source/cible');
                  return;
                }
                await api.put('workflowFlows', {
                  ...currentFlow,
                  fromStepId,
                  toStepId,
                  flowType,
                  condition,
                  label: label || currentFlow.label || `Flux ${flowType}`,
                  metadata: { ...(currentFlow.metadata || {}), customFlow: true },
                  updatedAt: now()
                }, STORE_KEY_FIELDS.workflowFlows);
                await api.put('workflowProcesses', {
                  ...processCurrent,
                  metadata: { ...(processCurrent.metadata || {}), customFlowMode: true },
                  updatedAt: now()
                }, STORE_KEY_FIELDS.workflowProcesses);
                await logAudit('designer_update_flow', 'process', id, { flowId, flowType });
                setFlowSelection([flowId], flowId);
                state.flowDesigner.sourceStepId = fromStepId || null;
                await loadCollections();
                renderServiceFilter();
                renderContent();
                openDetail('process', id);
                toast('Flux mis a jour');
              }
            });
          });
          refs.detailBody?.querySelectorAll('[data-wf-flow-bulk-action]')?.forEach((btn) => {
            btn.addEventListener('click', async () => {
              if (!canEditWorkflow()) return;
              const action = String(btn.getAttribute('data-wf-flow-bulk-action') || '').trim();
              if (!action) return;
              const processCurrent = getItem('process', id);
              if (!processCurrent) return;
              const selectedIds = normalizeFlowSelection(state.flowDesigner.selectedFlowIds);
              if (action === 'toggle-multi') {
                state.flowDesigner.multiSelectMode = !state.flowDesigner.multiSelectMode;
                if (!state.flowDesigner.multiSelectMode && selectedIds.length > 1) {
                  setFlowSelection([state.flowDesigner.selectedFlowId || selectedIds[0]], state.flowDesigner.selectedFlowId || selectedIds[0]);
                }
                renderContent();
                openDetail('process', id);
                return;
              }
              if (action === 'clear-selection') {
                state.flowDesigner.sourceStepId = null;
                setFlowSelection([], null);
                renderContent();
                openDetail('process', id);
                return;
              }
              if (action === 'delete-selected') {
                if (!selectedIds.length) {
                  toast('Aucun flux selectionne');
                  return;
                }
                for (const selectedId of selectedIds) {
                  await api.remove('workflowFlows', selectedId);
                }
                await logAudit('designer_bulk_delete_flows', 'process', id, { count: selectedIds.length });
                setFlowSelection([], null);
                await loadCollections();
                renderServiceFilter();
                renderContent();
                openDetail('process', id);
                toast(`${selectedIds.length} flux supprime(s)`);
                return;
              }
              if (action === 'apply-type') {
                if (!selectedIds.length) {
                  toast('Aucun flux selectionne');
                  return;
                }
                const typeInput = document.getElementById('wf-flow-bulk-type');
                const nextType = String(typeInput?.value || '').trim();
                if (!nextType) {
                  toast('Type de flux invalide');
                  return;
                }
                for (const selectedId of selectedIds) {
                  const flow = (state.collections.flows || []).find((row) => String(row.id) === selectedId);
                  if (!flow) continue;
                  await api.put('workflowFlows', {
                    ...flow,
                    flowType: nextType,
                    metadata: { ...(flow.metadata || {}), customFlow: true },
                    updatedAt: now()
                  }, STORE_KEY_FIELDS.workflowFlows);
                }
                await api.put('workflowProcesses', {
                  ...processCurrent,
                  metadata: { ...(processCurrent.metadata || {}), customFlowMode: true },
                  updatedAt: now()
                }, STORE_KEY_FIELDS.workflowProcesses);
                await logAudit('designer_bulk_apply_flow_type', 'process', id, { count: selectedIds.length, flowType: nextType });
                setFlowSelection(selectedIds, selectedIds[0] || null);
                await loadCollections();
                renderServiceFilter();
                renderContent();
                openDetail('process', id);
                toast(`Type applique a ${selectedIds.length} flux`);
              }
            });
          });
        }
        if (type === 'template') {
          const templateState = String(item?.status || 'draft');
          const publishBtn = document.getElementById('btn-workflow-template-publish');
          const archiveBtn = document.getElementById('btn-workflow-template-archive');
          const unarchiveBtn = document.getElementById('btn-workflow-template-unarchive');
          if (publishBtn) publishBtn.classList.toggle('hidden', templateState === 'published' || templateState === 'archived');
          if (archiveBtn) archiveBtn.classList.toggle('hidden', templateState === 'archived');
          if (unarchiveBtn) unarchiveBtn.classList.toggle('hidden', templateState !== 'archived');
          document.getElementById('btn-workflow-template-instantiate')?.addEventListener('click', async () => {
            await instantiateTemplate(id);
          });
          document.getElementById('btn-workflow-template-variant')?.addEventListener('click', async () => {
            await createTemplateVariant(id);
          });
          document.getElementById('btn-workflow-template-publish')?.addEventListener('click', async () => {
            await transitionTemplateStatus(id, 'publish');
          });
          document.getElementById('btn-workflow-template-archive')?.addEventListener('click', async () => {
            await transitionTemplateStatus(id, 'archive');
          });
          document.getElementById('btn-workflow-template-unarchive')?.addEventListener('click', async () => {
            await transitionTemplateStatus(id, 'unarchive');
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
        
        if (type === 'contingencyPlan') {
          document.getElementById('btn-wf-cont-activate')?.addEventListener('click', async () => {
             await activateContingencyPlan(id);
          });
          document.getElementById('btn-wf-cont-export-pdf')?.addEventListener('click', () => {
             exportContingencyPlanPdf(id);
          });
          document.getElementById('btn-wf-cont-export-csv')?.addEventListener('click', () => {
             exportContingencyPlanCsv(id);
          });
          document.getElementById('btn-wf-cont-action-add')?.addEventListener('click', async () => {
             const title = String(document.getElementById('wf-cont-action-title')?.value || '').trim();
             const ownerAgentId = String(document.getElementById('wf-cont-action-owner')?.value || '').trim();
             const status = normalizeContingencyActionStatus(document.getElementById('wf-cont-action-status')?.value || 'valid');
             const orderValue = parseInt(String(document.getElementById('wf-cont-action-order')?.value || '1'), 10);
             if (!title) { toast('Titre de l action requis'); return; }
             const actionId = `wf-cont-act-row-${uid()}`;
             const actionObj = {
               id: actionId,
               planId: id,
               title,
               ownerAgentId,
               order: isNaN(orderValue) ? 1 : orderValue,
               status,
               createdAt: now(),
               updatedAt: now()
             };
             await api.put('workflowContingencyActions', actionObj, STORE_KEY_FIELDS.workflowContingencyActions);
             await logAudit('contingency_action_add', 'contingencyPlan', id, { actionId });
             await loadCollections();
             renderServiceFilter();
             renderContent();
             openDetail('contingencyPlan', id);
             toast('Action ajoutee');
          });
          refs.detailBody?.querySelectorAll('[data-wf-cont-action-delete]')?.forEach((btn) => {
            btn.addEventListener('click', async () => {
              const actionId = String(btn.getAttribute('data-wf-cont-action-delete') || '').trim();
              if (!actionId) return;
              if (!global.confirm('Supprimer cette action de contingence ?')) return;
              await api.remove('workflowContingencyActions', actionId);
              await logAudit('contingency_action_delete', 'contingencyPlan', id, { actionId });
              await loadCollections();
              renderServiceFilter();
              renderContent();
              openDetail('contingencyPlan', id);
              toast('Action supprimee');
            });
          });
          refs.detailBody?.querySelectorAll('[data-wf-cont-activation-close]')?.forEach((btn) => {
            btn.addEventListener('click', async () => {
               const actId = String(btn.getAttribute('data-wf-cont-activation-close') || '').trim();
               if (!global.confirm('Voulez-vous vraiment cloturer cette crise pour ce plan ?')) return;
               await closeContingencyActivation(actId);
            });
          });
          document.getElementById('btn-wf-cont-exercise-add')?.addEventListener('click', async () => {
             const exerciseDate = String(document.getElementById('wf-cont-exercise-date')?.value || '').trim();
             const result = normalizeContingencyExerciseResult(document.getElementById('wf-cont-exercise-result')?.value || 'pending');
             const notes = String(document.getElementById('wf-cont-exercise-notes')?.value || '').trim();
             if (!exerciseDate) { toast('Date d exercice requise'); return; }
             const exerciseId = `wf-cont-exercise-${uid()}`;
             const exerciseObj = {
               id: exerciseId,
               planId: id,
               exerciseDate,
               result,
               notes,
               participants: [],
               findings: notes,
               recommendations: [],
               createdAt: now(),
               updatedAt: now()
             };
             await api.put('workflowContingencyExercises', exerciseObj, STORE_KEY_FIELDS.workflowContingencyExercises);
             await logContingencyAudit('exercise_add', id, { exerciseId, exerciseDate, result });
             await loadCollections();
             renderServiceFilter();
             renderContent();
             openDetail('contingencyPlan', id);
             toast('Exercice ajoute');
          });
          document.getElementById('btn-wf-cont-review-add')?.addEventListener('click', async () => {
             const reviewDate = String(document.getElementById('wf-cont-review-date')?.value || '').trim();
             const nextReviewDate = String(document.getElementById('wf-cont-review-next-date')?.value || '').trim();
             const comments = String(document.getElementById('wf-cont-review-comments')?.value || '').trim();
             if (!reviewDate) { toast('Date de revue requise'); return; }
             const reviewId = `wf-cont-review-${uid()}`;
             const reviewObj = {
               id: reviewId,
               planId: id,
               reviewDate,
               reviewerUserId: currentUserId(),
               findings: comments,
               recommendations: [],
               nextReviewDate: nextReviewDate || null,
               status: 'completed',
               createdAt: now(),
               updatedAt: now()
             };
             await api.put('workflowContingencyReviews', reviewObj, STORE_KEY_FIELDS.workflowContingencyReviews);
             await logContingencyAudit('review_add', id, { reviewId, reviewDate, nextReviewDate });
             const planCurrent = getItem('contingencyPlan', id);
             if (planCurrent) {
               const planUpdated = {
                 ...planCurrent,
                 lastReviewDate: reviewDate,
                 nextReviewDate: nextReviewDate || planCurrent.nextReviewDate,
                 updatedAt: now()
               };
               await api.put('workflowContingencyPlans', planUpdated, STORE_KEY_FIELDS.workflowContingencyPlans);
             }
             await loadCollections();
             renderServiceFilter();
             renderContent();
             openDetail('contingencyPlan', id);
             toast('Revue ajoutee');
          });
          refs.detailBody?.querySelectorAll('[data-wf-cont-exercise-delete]')?.forEach((btn) => {
            btn.addEventListener('click', async () => {
              const exerciseId = String(btn.getAttribute('data-wf-cont-exercise-delete') || '').trim();
              if (!exerciseId) return;
              if (!global.confirm('Supprimer cet exercice ?')) return;
              await api.remove('workflowContingencyExercises', exerciseId);
              await logContingencyAudit('exercise_delete', id, { exerciseId });
              await loadCollections();
              renderServiceFilter();
              renderContent();
              openDetail('contingencyPlan', id);
              toast('Exercice supprime');
            });
          });
          refs.detailBody?.querySelectorAll('[data-wf-cont-review-delete]')?.forEach((btn) => {
            btn.addEventListener('click', async () => {
              const reviewId = String(btn.getAttribute('data-wf-cont-review-delete') || '').trim();
              if (!reviewId) return;
              if (!global.confirm('Supprimer cette revue ?')) return;
              await api.remove('workflowContingencyReviews', reviewId);
              await logContingencyAudit('review_delete', id, { reviewId });
              await loadCollections();
              renderServiceFilter();
              renderContent();
              openDetail('contingencyPlan', id);
              toast('Revue supprimee');
            });
          });
        }
      }

      if (type === 'procedure') {
        initProcedureRichEditor(item, editable);
      } else {
        state.procedureQuill = null;
      }

      initWorkflowDetailInlineEditing(editable);

      renderContent();
    }

    function readFieldMap() {
      const map = {};
      refs.detailBody?.querySelectorAll('[data-wf-key]')?.forEach((node) => {
        const key = String(node.getAttribute('data-wf-key') || '');
        if (!key) return;
        const isMultipleSelect = node.tagName === 'SELECT' && !!node.multiple;
        if (isMultipleSelect) {
          const values = Array.from(node.selectedOptions || []).map((opt) => String(opt.value || '').trim()).filter(Boolean);
          map[key] = values.join(',');
          return;
        }
        map[key] = node.value;
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

    async function saveCurrentDetail(options = {}) {
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
      if (type === 'role') {
        updated.name = String(fields.name || '').trim();
        updated.description = String(fields.description || '').trim();
        updated.serviceId = String(fields.serviceId || '').trim() || null;
        updated.requiredSkills = parseUniqueCsv(fields.requiredSkills);
        updated.permissionHints = parseUniqueCsv(fields.permissionHints);
      }
      if (type === 'process') {
        const currentValidation = normalizeProcessValidation(item?.validation);
        updated.title = String(fields.title || '').trim();
        updated.description = String(fields.description || '').trim();
        updated.communityId = String(fields.communityId || '').trim() || null;
        updated.serviceId = String(fields.serviceId || '').trim() || null;
        updated.groupId = String(fields.groupId || '').trim() || null;
        updated.ownerAgentId = String(fields.ownerAgentId || '').trim() || null;
        updated.status = String(fields.status || '').trim() || 'draft';
        updated.criticality = String(fields.criticality || '').trim() || 'medium';
        updated.inputs = parseMultiline(fields.inputs);
        updated.outputs = parseMultiline(fields.outputs);
        updated.tags = parseUniqueCsv(fields.tags);
        currentValidation.requiredLevels = Math.max(1, Number(fields.validationRequiredLevels || 2) || 2);
        currentValidation.mode = String(fields.validationMode || 'level').trim().toLowerCase() === 'sequential' ? 'sequential' : 'level';
        currentValidation.requiredRoleIds = parseUniqueCsv(fields.validationRequiredRoleIds);
        currentValidation.levelRules = parseValidationRulesJson(fields.validationLevelRulesJson, currentValidation);
        currentValidation.requiredLevels = Math.max(currentValidation.requiredLevels, currentValidation.levelRules.length || 1);
        currentValidation.levelRules = normalizeValidationRulesArray(currentValidation.levelRules, currentValidation.requiredLevels, currentValidation.requiredRoleIds);
        currentValidation.level = Math.max(0, Math.min(currentValidation.requiredLevels, Number(currentValidation.level || 0) || 0));
        updated.validation = currentValidation;
      }
      if (type === 'step') {
        updated.processId = String(fields.processId || '').trim() || null;
        updated.title = String(fields.title || '').trim();
        updated.stepType = String(fields.stepType || '').trim() || 'action';
        updated.description = String(fields.description || '').trim();
        updated.serviceId = String(fields.serviceId || '').trim() || null;
        updated.groupId = String(fields.groupId || '').trim() || null;
        updated.ownerAgentId = String(fields.ownerAgentId || '').trim() || null;
        updated.roleId = String(fields.roleId || '').trim() || null;
        updated.linkedProcedureId = String(fields.linkedProcedureId || '').trim() || null;
        updated.linkedSoftwareIds = parseUniqueCsv(fields.linkedSoftwareIds);
        updated.linkedTaskId = String(fields.linkedTaskId || '').trim() || null;
        updated.estimatedDurationMinutes = Number(fields.estimatedDurationMinutes || 0) || 0;
        updated.order = Math.max(1, Number(fields.order || 1) || 1);
      }
      if (type === 'flow') {
        updated.processId = String(fields.processId || '').trim() || null;
        updated.fromStepId = String(fields.fromStepId || '').trim() || null;
        updated.toStepId = String(fields.toStepId || '').trim() || null;
        updated.flowType = String(fields.flowType || '').trim() || 'sequence';
        updated.condition = String(fields.condition || '').trim();
        updated.label = String(fields.label || '').trim();
      }
      if (type === 'template') {
        const previousSnapshot = JSON.stringify({
          name: item.name || '',
          description: item.description || '',
          serviceId: item.serviceId || '',
          groupId: item.groupId || '',
          ownerAgentId: item.ownerAgentId || '',
          status: item.status || 'draft',
          tags: item.tags || []
        });
        updated.name = String(fields.name || '').trim();
        updated.description = String(fields.description || '').trim();
        updated.serviceId = String(fields.serviceId || '').trim() || null;
        updated.groupId = String(fields.groupId || '').trim() || null;
        updated.ownerAgentId = String(fields.ownerAgentId || '').trim() || null;
        updated.status = String(fields.status || '').trim() || 'draft';
        updated.tags = parseUniqueCsv(fields.tags);
        const nextSnapshot = JSON.stringify({
          name: updated.name,
          description: updated.description,
          serviceId: updated.serviceId || '',
          groupId: updated.groupId || '',
          ownerAgentId: updated.ownerAgentId || '',
          status: updated.status,
          tags: updated.tags || []
        });
        const changed = previousSnapshot !== nextSnapshot;
        const nextVersion = changed ? (Number(item.version || 1) + 1) : Number(item.version || 1);
        const history = Array.isArray(item?.metadata?.versionHistory) ? item.metadata.versionHistory.slice(-20) : [];
        if (changed) {
          history.push({
            version: nextVersion,
            updatedAt: updated.updatedAt,
            byUserId: currentUserId()
          });
        }
        updated.version = nextVersion;
        updated.metadata = {
          ...(updated.metadata || {}),
          versionHistory: history
        };
      }
      if (type === 'task') {
        const previousStatus = String(item.status || 'todo');
        const previousApprovalStatus = String(item.approvalStatus || 'pending');
        updated.title = String(fields.title || '').trim();
        updated.description = String(fields.description || '').trim();
        updated.processId = String(fields.processId || '').trim() || null;
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
      if (!options.inlineAutosave) {
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail(type, updated.id);
      } else {
        const list = getByType(type);
        const idx = list.findIndex((row) => String(row.id) === String(updated.id));
        if (idx >= 0) list[idx] = updated;
      }
      if (!options.silent) toast('Workflow mis a jour');
      if (type === 'procedure' && procedureVersionBumped) {
        queuedNotifications.push(`Procedure versionnee: ${updated.title || updated.id} v${updated.version}`);
      }
      if (!options.skipNotify) {
        queuedNotifications.forEach((message) => notifyInternal(message));
      }
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
        state.collections.roles.forEach((role) => {
          if (role.serviceId === id) {
            updates.push(api.put('workflowRoles', { ...role, serviceId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowRoles));
          }
        });
        state.collections.processes.forEach((process) => {
          if (process.serviceId === id) {
            updates.push(api.put('workflowProcesses', { ...process, serviceId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowProcesses));
          }
        });
        state.collections.contingencyPlans.forEach((plan) => {
          if (plan.serviceId === id) {
            updates.push(api.put('workflowContingencyPlans', { ...plan, serviceId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowContingencyPlans));
          }
        });
        state.collections.steps.forEach((step) => {
          if (step.serviceId === id) {
            updates.push(api.put('workflowProcessSteps', { ...step, serviceId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowProcessSteps));
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
        state.collections.processes.forEach((process) => {
          if (process.groupId === id) {
            updates.push(api.put('workflowProcesses', { ...process, groupId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowProcesses));
          }
        });
        state.collections.steps.forEach((step) => {
          if (step.groupId === id) {
            updates.push(api.put('workflowProcessSteps', { ...step, groupId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowProcessSteps));
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
        state.collections.processes.forEach((process) => {
          if (process.ownerAgentId === id) {
            updates.push(api.put('workflowProcesses', { ...process, ownerAgentId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowProcesses));
          }
        });
        state.collections.steps.forEach((step) => {
          if (step.ownerAgentId === id) {
            updates.push(api.put('workflowProcessSteps', { ...step, ownerAgentId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowProcessSteps));
          }
        });
        state.collections.contingencyPlans.forEach((plan) => {
          if (plan.ownerAgentId === id || plan.backupAgentId === id) {
            updates.push(api.put('workflowContingencyPlans', {
              ...plan,
              ownerAgentId: plan.ownerAgentId === id ? null : plan.ownerAgentId,
              backupAgentId: plan.backupAgentId === id ? null : plan.backupAgentId,
              updatedAt: now()
            }, STORE_KEY_FIELDS.workflowContingencyPlans));
          }
        });
        state.collections.contingencyActions.forEach((row) => {
          if (row.ownerAgentId === id) {
            updates.push(api.put('workflowContingencyActions', { ...row, ownerAgentId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowContingencyActions));
          }
        });
      }

      if (type === 'role') {
        state.collections.steps.forEach((step) => {
          if (step.roleId === id) {
            updates.push(api.put('workflowProcessSteps', { ...step, roleId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowProcessSteps));
          }
        });
      }

      if (type === 'process') {
        state.collections.steps.forEach((step) => {
          if (step.processId === id) {
            updates.push(api.remove('workflowProcessSteps', step.id));
          }
        });
        state.collections.flows.forEach((flow) => {
          if (flow.processId === id) {
            updates.push(api.remove('workflowFlows', flow.id));
          }
        });
        state.collections.tasks.forEach((task) => {
          if (task.processId === id) {
            updates.push(api.put('workflowTasks', { ...task, processId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowTasks));
          }
        });
        state.collections.templates.forEach((tpl) => {
          if (tpl.sourceProcessId === id) {
            updates.push(api.put('workflowProcessTemplates', { ...tpl, sourceProcessId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowProcessTemplates));
          }
        });
        state.collections.contingencyPlans.forEach((plan) => {
          if (plan.processId === id) {
            updates.push(api.put('workflowContingencyPlans', { ...plan, processId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowContingencyPlans));
          }
        });
      }

      if (type === 'step') {
        state.collections.flows.forEach((flow) => {
          if (flow.fromStepId === id || flow.toStepId === id) {
            updates.push(api.remove('workflowFlows', flow.id));
          }
        });
      }

      if (type === 'procedure') {
        state.collections.tasks.forEach((task) => {
          if (task.linkedProcedureId === id) {
            updates.push(api.put('workflowTasks', { ...task, linkedProcedureId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowTasks));
          }
        });
        state.collections.steps.forEach((step) => {
          if (step.linkedProcedureId === id) {
            updates.push(api.put('workflowProcessSteps', { ...step, linkedProcedureId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowProcessSteps));
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
        state.collections.steps.forEach((step) => {
          if (Array.isArray(step.linkedSoftwareIds) && step.linkedSoftwareIds.includes(id)) {
            updates.push(api.put('workflowProcessSteps', { ...step, linkedSoftwareIds: step.linkedSoftwareIds.filter((sid) => sid !== id), updatedAt: now() }, STORE_KEY_FIELDS.workflowProcessSteps));
          }
        });
        state.collections.permissionProfiles.forEach((row) => {
          if (String(row.softwareId || '') === String(id)) updates.push(api.remove('workflowPermissionProfiles', row.id));
        });
        state.collections.permissionAssignments.forEach((row) => {
          if (String(row.softwareId || '') === String(id)) updates.push(api.remove('workflowPermissionAssignments', row.id));
        });
        state.collections.permissionRequests.forEach((row) => {
          if (String(row.softwareId || '') === String(id)) updates.push(api.remove('workflowPermissionRequests', row.id));
        });
        state.collections.permissionReviews.forEach((row) => {
          if (String(row.softwareId || '') === String(id)) updates.push(api.remove('workflowPermissionReviews', row.id));
        });
        state.collections.permissionAudit.forEach((row) => {
          if (String(row.softwareId || '') === String(id)) updates.push(api.remove('workflowPermissionAudit', row.id));
        });
        state.collections.contingencyPlans.forEach((plan) => {
          if (String(plan.softwareId || '') === String(id)) {
            updates.push(api.put('workflowContingencyPlans', { ...plan, softwareId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowContingencyPlans));
          }
        });
      }

      if (type === 'contingencyPlan') {
        state.collections.contingencyActions.forEach((row) => {
          if (String(row.planId || '') === String(id)) updates.push(api.remove('workflowContingencyActions', row.id));
        });
        state.collections.contingencyActivations.forEach((row) => {
          if (String(row.planId || '') === String(id)) updates.push(api.remove('workflowContingencyActivations', row.id));
        });
        state.collections.contingencyExercises.forEach((row) => {
          if (String(row.planId || '') === String(id)) updates.push(api.remove('workflowContingencyExercises', row.id));
        });
        state.collections.contingencyReviews.forEach((row) => {
          if (String(row.planId || '') === String(id)) updates.push(api.remove('workflowContingencyReviews', row.id));
        });
        state.collections.contingencyAudit.forEach((row) => {
          if (String(row.planId || '') === String(id)) updates.push(api.remove('workflowContingencyAudit', row.id));
        });
      }

      if (type === 'task') {
        state.collections.steps.forEach((step) => {
          if (step.linkedTaskId === id) {
            updates.push(api.put('workflowProcessSteps', { ...step, linkedTaskId: null, updatedAt: now() }, STORE_KEY_FIELDS.workflowProcessSteps));
          }
        });
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

    function injectCreateModalHints(kind) {
      if (!refs.modalBody) return;
      const hintsByKind = {
        process: [
          ['wf-create-process-title', 'Donnez un titre orienté action, clair et court.'],
          ['wf-create-process-service', 'Le service pilote simplifie le suivi et la gouvernance.']
        ],
        template: [
          ['wf-create-template-name', 'Un modèle sert de base réutilisable pour lancer des processus.'],
          ['wf-create-template-source-process', 'Depuis un processus: structure préremplie en un clic.']
        ],
        step: [
          ['wf-create-step-title', 'Une étape = une action métier mesurable et attribuable.'],
          ['wf-create-step-type', 'Choisissez le type pour clarifier la logique du flux.']
        ],
        flow: [
          ['wf-create-flow-process', 'Un flux relie des étapes d un même processus.'],
          ['wf-create-flow-type', 'Utilisez condition/parallèle pour décrire les bifurcations.']
        ],
        task: [
          ['wf-create-task-title', 'Titre court, précis et actionnable.'],
          ['wf-create-task-process', 'Lier au processus facilite le suivi transverse immédiat.']
        ],
        procedure: [
          ['wf-create-procedure-title', 'La procédure décrit clairement le mode opératoire.'],
          ['wf-create-procedure-trigger', 'Le déclencheur standardise le démarrage.']
        ],
        software: [
          ['wf-create-software-name', 'Utilisez le nom métier connu des équipes.'],
          ['wf-create-software-category', 'La catégorie facilite la recherche dans les référentiels.']
        ]
      };
      const hints = hintsByKind[String(kind || '').trim()] || [];
      hints.forEach(([fieldId, text]) => {
        const field = document.getElementById(fieldId);
        if (!field || !field.parentElement) return;
        if (field.parentElement.querySelector(`[data-wf-field-hint="${fieldId}"]`)) return;
        const hint = document.createElement('p');
        hint.className = 'workflow-card-sub';
        hint.style.marginTop = '0.3rem';
        hint.setAttribute('data-wf-field-hint', fieldId);
        hint.textContent = text;
        field.parentElement.appendChild(hint);
      });
      if (!refs.modalBody.querySelector('[data-wf-create-shortcuts]')) {
        const shortcutHint = document.createElement('p');
        shortcutHint.className = 'workflow-card-sub';
        shortcutHint.style.marginTop = '0.35rem';
        shortcutHint.setAttribute('data-wf-create-shortcuts', '1');
        shortcutHint.textContent = 'Raccourcis: Entrée pour enregistrer, Échap pour fermer.';
        refs.modalBody.appendChild(shortcutHint);
      }
    }

    function openCreateModal(kind, options = {}) {
      if (!canEditWorkflow()) {
        toast('Lecture seule: creation reservee au role admin ou manager workflow');
        return;
      }
      if (!refs.modal || !refs.modalBody || !refs.modalTitle || !refs.modalSave) return;
      workflowCreateKind = kind;
      refs.modal.classList.remove('hidden');
      refs.modalSave.textContent = 'Enregistrer';

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

      if (kind === 'role') {
        refs.modalTitle.textContent = 'Nouveau role metier workflow';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Nom</label><input id="wf-create-role-name" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Description</label><textarea id="wf-create-role-description" class="workflow-form-textarea"></textarea></div>
          <div><label class="workflow-form-label">Service</label><select id="wf-create-role-service" class="workflow-form-select">${buildSelectOptions(state.collections.services, 'id', 'name', state.serviceFilter !== 'all' ? state.serviceFilter : '')}</select></div>
          <div><label class="workflow-form-label">Competences requises (csv)</label><input id="wf-create-role-skills" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Permissions hints (csv)</label><input id="wf-create-role-permissions" class="workflow-form-input" type="text"></div>
        `;
      }

      if (kind === 'process') {
        const defaultServiceId = state.serviceFilter !== 'all' ? state.serviceFilter : '';
        const defaultGroupId = state.groupFilter !== 'all' ? state.groupFilter : '';
        const defaultOwnerAgentId = getCurrentUserPrimaryAgentId(defaultServiceId, defaultGroupId) || '';
        refs.modalTitle.textContent = 'Nouveau processus workflow';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Titre</label><input id="wf-create-process-title" class="workflow-form-input" type="text" placeholder="Ex: Traitement d une demande"></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.6rem;">
            <div><label class="workflow-form-label">Service</label><select id="wf-create-process-service" class="workflow-form-select">${buildSelectOptions(state.collections.services, 'id', 'name', defaultServiceId)}</select></div>
            <div><label class="workflow-form-label">Groupe</label><select id="wf-create-process-group" class="workflow-form-select">${buildSelectOptions(state.collections.groups, 'id', 'name', defaultGroupId)}</select></div>
            <div><label class="workflow-form-label">Responsable</label><select id="wf-create-process-owner" class="workflow-form-select">${buildSelectOptions(state.collections.agents, 'id', 'displayName', defaultOwnerAgentId)}</select></div>
          </div>
          <details style="border:1px solid #cbd5e1;border-radius:12px;padding:0.65rem 0.75rem;background:#f8fafc;">
            <summary class="workflow-form-label" style="cursor:pointer;list-style:none;">Parametres avances</summary>
            <div style="margin-top:0.6rem;display:grid;gap:0.6rem;">
              <div><label class="workflow-form-label">Description</label><textarea id="wf-create-process-description" class="workflow-form-textarea"></textarea></div>
              <div><label class="workflow-form-label">Communaute</label><select id="wf-create-process-community" class="workflow-form-select">${buildSelectOptions(state.collections.communities, 'id', 'name', '')}</select></div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.6rem;">
                <div><label class="workflow-form-label">Statut</label><select id="wf-create-process-status" class="workflow-form-select"><option value="draft" selected>brouillon</option><option value="active">actif</option><option value="paused">en pause</option><option value="archived">archive</option></select></div>
                <div><label class="workflow-form-label">Criticite</label><select id="wf-create-process-criticality" class="workflow-form-select"><option value="low">faible</option><option value="medium" selected>moyenne</option><option value="high">haute</option></select></div>
              </div>
              <div><label class="workflow-form-label">Entrees (1 ligne = 1 element)</label><textarea id="wf-create-process-inputs" class="workflow-form-textarea"></textarea></div>
              <div><label class="workflow-form-label">Sorties (1 ligne = 1 element)</label><textarea id="wf-create-process-outputs" class="workflow-form-textarea"></textarea></div>
              <div><label class="workflow-form-label">Tags (csv)</label><input id="wf-create-process-tags" class="workflow-form-input" type="text"></div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.6rem;">
                <div><label class="workflow-form-label">Niveaux validation</label><input id="wf-create-process-approval-levels" class="workflow-form-input" type="number" min="1" value="2"></div>
                <div><label class="workflow-form-label">Mode validation</label><select id="wf-create-process-approval-mode" class="workflow-form-select"><option value="level" selected>Niveaux (quorum)</option><option value="sequential">Sequentiel</option></select></div>
              </div>
              <div><label class="workflow-form-label">Roles approbateurs requis</label><select id="wf-create-process-approval-roles" class="workflow-form-select" multiple size="6">${(state.collections.roles || []).map((role) => `<option value="${esc(role.id)}">${esc(role.name || role.id)}</option>`).join('')}</select></div>
            </div>
          </details>
        `;
        const processTitleInput = document.getElementById('wf-create-process-title');
        if (processTitleInput) processTitleInput.focus();
      }

      if (kind === 'template') {
        const defaultServiceId = state.serviceFilter !== 'all' ? state.serviceFilter : '';
        const defaultGroupId = state.groupFilter !== 'all' ? state.groupFilter : '';
        const defaultOwnerAgentId = getCurrentUserPrimaryAgentId(defaultServiceId, defaultGroupId) || '';
        const sourceProcessOptions = (state.collections.processes || [])
          .filter((row) => {
            if (defaultServiceId && String(row.serviceId || '') !== defaultServiceId) return false;
            if (defaultGroupId && String(row.groupId || '') !== defaultGroupId) return false;
            return true;
          })
          .slice()
          .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'fr'));
        refs.modalTitle.textContent = 'Nouveau modele de processus';
        refs.modalSave.textContent = 'Creer le modele';
        refs.modalBody.innerHTML = `
          <input id="wf-create-template-mode" type="hidden" value="blank">
          <div style="display:grid;gap:0.45rem;">
            <label class="workflow-form-label">Mode de creation</label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.5rem;">
              <button id="wf-template-mode-blank" type="button" class="workflow-btn-light px-3 py-2 rounded-lg text-sm font-semibold" aria-pressed="true">Modele vierge</button>
              <button id="wf-template-mode-process" type="button" class="workflow-btn-light px-3 py-2 rounded-lg text-sm font-semibold" aria-pressed="false">Depuis un processus</button>
            </div>
          </div>
          <div>
            <label class="workflow-form-label">Nom du modele</label>
            <input id="wf-create-template-name" class="workflow-form-input" type="text" placeholder="Ex: Parcours d admission standard">
          </div>
          <div id="wf-template-source-wrap" class="hidden">
            <label class="workflow-form-label">Creer depuis un processus (optionnel)</label>
            <select id="wf-create-template-source-process" class="workflow-form-select">
              <option value="">Aucun (modele vide)</option>
              ${sourceProcessOptions.map((row) => `<option value="${esc(row.id)}">${esc(row.title || row.id)}</option>`).join('')}
            </select>
            <p id="wf-template-source-hint" class="workflow-card-sub" style="margin-top:0.35rem;">Selectionnez un processus source pour pre-remplir les etapes et les flux.</p>
            <p id="wf-template-source-stats" class="workflow-card-sub hidden" style="margin-top:0.25rem;"></p>
          </div>
          <details id="wf-template-advanced" style="border:1px solid #cbd5e1;border-radius:12px;padding:0.65rem 0.75rem;background:#f8fafc;">
            <summary class="workflow-form-label" style="cursor:pointer;list-style:none;">Parametres avances</summary>
            <div style="margin-top:0.6rem;display:grid;gap:0.6rem;">
              <div><label class="workflow-form-label">Description</label><textarea id="wf-create-template-description" class="workflow-form-textarea" placeholder="Objectif, perimetre, variantes..."></textarea></div>
              <div><label class="workflow-form-label">Service</label><select id="wf-create-template-service" class="workflow-form-select">${buildSelectOptions(state.collections.services, 'id', 'name', defaultServiceId)}</select></div>
              <div><label class="workflow-form-label">Groupe</label><select id="wf-create-template-group" class="workflow-form-select">${buildSelectOptions(state.collections.groups, 'id', 'name', defaultGroupId)}</select></div>
              <div><label class="workflow-form-label">Responsable</label><select id="wf-create-template-owner" class="workflow-form-select">${buildSelectOptions(state.collections.agents, 'id', 'displayName', defaultOwnerAgentId)}</select></div>
              <div><label class="workflow-form-label">Tags (csv)</label><input id="wf-create-template-tags" class="workflow-form-input" type="text" placeholder="modele, standard, ..."></div>
            </div>
          </details>
        `;
        const modeInput = document.getElementById('wf-create-template-mode');
        const modeBlankBtn = document.getElementById('wf-template-mode-blank');
        const modeProcessBtn = document.getElementById('wf-template-mode-process');
        const sourceWrap = document.getElementById('wf-template-source-wrap');
        const sourceSelect = document.getElementById('wf-create-template-source-process');
        const sourceStats = document.getElementById('wf-template-source-stats');
        const sourceHint = document.getElementById('wf-template-source-hint');
        const advancedSection = document.getElementById('wf-template-advanced');
        const nameInput = document.getElementById('wf-create-template-name');
        const serviceSelect = document.getElementById('wf-create-template-service');
        const groupSelect = document.getElementById('wf-create-template-group');
        const ownerSelect = document.getElementById('wf-create-template-owner');
        const sourceProcessById = new Map(sourceProcessOptions.map((row) => [String(row.id), row]));
        const fieldTouched = { name: false, service: false, group: false, owner: false };
        const setMode = (mode) => {
          const safeMode = mode === 'process' ? 'process' : 'blank';
          if (modeInput) modeInput.value = safeMode;
          if (modeBlankBtn) {
            modeBlankBtn.classList.toggle('btn-primary', safeMode === 'blank');
            modeBlankBtn.classList.toggle('text-white', safeMode === 'blank');
            modeBlankBtn.setAttribute('aria-pressed', safeMode === 'blank' ? 'true' : 'false');
          }
          if (modeProcessBtn) {
            modeProcessBtn.classList.toggle('btn-primary', safeMode === 'process');
            modeProcessBtn.classList.toggle('text-white', safeMode === 'process');
            modeProcessBtn.setAttribute('aria-pressed', safeMode === 'process' ? 'true' : 'false');
          }
          if (sourceWrap) sourceWrap.classList.toggle('hidden', safeMode !== 'process');
          if (advancedSection && safeMode === 'process') advancedSection.open = true;
        };
        const updateSourceProcessPreview = () => {
          const sourceId = String(sourceSelect?.value || '').trim();
          const source = sourceId ? sourceProcessById.get(sourceId) : null;
          if (!source) {
            if (sourceStats) {
              sourceStats.textContent = '';
              sourceStats.classList.add('hidden');
            }
            if (sourceHint) sourceHint.textContent = 'Selectionnez un processus source pour pre-remplir les etapes et les flux.';
            return;
          }
          const steps = getProcessStepsSorted(source.id);
          const flows = getProcessFlows(source.id);
          if (sourceHint) sourceHint.textContent = 'Le modele reprendra la structure du processus selectionne.';
          if (sourceStats) {
            sourceStats.textContent = `${steps.length} etape(s), ${flows.length} flux - service: ${source.serviceId || 'n/a'} - groupe: ${source.groupId || 'n/a'}`;
            sourceStats.classList.remove('hidden');
          }
          if (nameInput && !fieldTouched.name && !String(nameInput.value || '').trim()) {
            nameInput.value = `Modele ${String(source.title || source.id || '').trim()}`;
          }
          if (serviceSelect && !fieldTouched.service && String(source.serviceId || '').trim()) serviceSelect.value = String(source.serviceId || '');
          if (groupSelect && !fieldTouched.group && String(source.groupId || '').trim()) groupSelect.value = String(source.groupId || '');
          if (ownerSelect && !fieldTouched.owner && String(source.ownerAgentId || '').trim()) ownerSelect.value = String(source.ownerAgentId || '');
        };
        modeBlankBtn?.addEventListener('click', () => setMode('blank'));
        modeProcessBtn?.addEventListener('click', () => {
          setMode('process');
          if (sourceSelect && !String(sourceSelect.value || '').trim()) {
            const firstSelectable = sourceProcessOptions.length ? String(sourceProcessOptions[0].id || '').trim() : '';
            if (firstSelectable) sourceSelect.value = firstSelectable;
          }
          updateSourceProcessPreview();
        });
        sourceSelect?.addEventListener('change', updateSourceProcessPreview);
        nameInput?.addEventListener('input', () => { fieldTouched.name = true; });
        serviceSelect?.addEventListener('change', () => { fieldTouched.service = true; });
        groupSelect?.addEventListener('change', () => { fieldTouched.group = true; });
        ownerSelect?.addEventListener('change', () => { fieldTouched.owner = true; });
        setMode('blank');
        if (nameInput) nameInput.focus();
      }

      if (kind === 'step') {
        const defaultProcessId = state.selectedType === 'process'
          ? String(state.selectedId || '').trim()
          : '';
        const defaultProcess = defaultProcessId
          ? (state.collections.processes || []).find((row) => String(row.id) === defaultProcessId)
          : null;
        const defaultServiceId = String(defaultProcess?.serviceId || (state.serviceFilter !== 'all' ? state.serviceFilter : '')).trim();
        const defaultGroupId = String(defaultProcess?.groupId || (state.groupFilter !== 'all' ? state.groupFilter : '')).trim();
        const defaultOwnerAgentId = String(defaultProcess?.ownerAgentId || getCurrentUserPrimaryAgentId(defaultServiceId, defaultGroupId) || '').trim();
        refs.modalTitle.textContent = 'Nouvelle etape de processus';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Processus</label><select id="wf-create-step-process" class="workflow-form-select">${buildSelectOptions(state.collections.processes, 'id', 'title', defaultProcessId)}</select></div>
          <div><label class="workflow-form-label">Titre</label><input id="wf-create-step-title" class="workflow-form-input" type="text" placeholder="Ex: Controle de completude"></div>
          <div><label class="workflow-form-label">Type</label><select id="wf-create-step-type" class="workflow-form-select"><option value="action">action</option><option value="validation">validation</option><option value="decision">decision</option><option value="notification">notification</option><option value="input">input</option><option value="output">output</option></select></div>
          <details style="border:1px solid #cbd5e1;border-radius:12px;padding:0.65rem 0.75rem;background:#f8fafc;">
            <summary class="workflow-form-label" style="cursor:pointer;list-style:none;">Parametres avances</summary>
            <div style="margin-top:0.6rem;display:grid;gap:0.6rem;">
              <div><label class="workflow-form-label">Description</label><textarea id="wf-create-step-description" class="workflow-form-textarea"></textarea></div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.6rem;">
                <div><label class="workflow-form-label">Service</label><select id="wf-create-step-service" class="workflow-form-select">${buildSelectOptions(state.collections.services, 'id', 'name', defaultServiceId)}</select></div>
                <div><label class="workflow-form-label">Groupe</label><select id="wf-create-step-group" class="workflow-form-select">${buildSelectOptions(state.collections.groups, 'id', 'name', defaultGroupId)}</select></div>
                <div><label class="workflow-form-label">Responsable</label><select id="wf-create-step-owner" class="workflow-form-select">${buildSelectOptions(state.collections.agents, 'id', 'displayName', defaultOwnerAgentId)}</select></div>
              </div>
              <div><label class="workflow-form-label">Role metier</label><select id="wf-create-step-role" class="workflow-form-select">${buildSelectOptions(state.collections.roles, 'id', 'name', '')}</select></div>
              <div><label class="workflow-form-label">Procedure liee</label><select id="wf-create-step-procedure" class="workflow-form-select">${buildSelectOptions(state.collections.procedures, 'id', 'title', '')}</select></div>
              <div><label class="workflow-form-label">Logiciels lies (csv ids)</label><input id="wf-create-step-software" class="workflow-form-input" type="text"></div>
              <div><label class="workflow-form-label">Tache workflow liee</label><select id="wf-create-step-task" class="workflow-form-select">${buildSelectOptions(state.collections.tasks, 'id', 'title', '')}</select></div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.6rem;">
                <div><label class="workflow-form-label">Duree estimee (min)</label><input id="wf-create-step-duration" class="workflow-form-input" type="number" value="0" min="0"></div>
                <div><label class="workflow-form-label">Ordre</label><input id="wf-create-step-order" class="workflow-form-input" type="number" value="1" min="1"></div>
              </div>
            </div>
          </details>
        `;
        const stepTitleInput = document.getElementById('wf-create-step-title');
        const stepProcessSelect = document.getElementById('wf-create-step-process');
        const stepServiceSelect = document.getElementById('wf-create-step-service');
        const stepGroupSelect = document.getElementById('wf-create-step-group');
        const stepOwnerSelect = document.getElementById('wf-create-step-owner');
        const touched = { service: false, group: false, owner: false };
        const processById = new Map((state.collections.processes || []).map((row) => [String(row.id), row]));
        stepServiceSelect?.addEventListener('change', () => { touched.service = true; });
        stepGroupSelect?.addEventListener('change', () => { touched.group = true; });
        stepOwnerSelect?.addEventListener('change', () => { touched.owner = true; });
        stepProcessSelect?.addEventListener('change', () => {
          const processId = String(stepProcessSelect.value || '').trim();
          const process = processId ? processById.get(processId) : null;
          if (!process) return;
          if (stepServiceSelect && !touched.service && String(process.serviceId || '').trim()) stepServiceSelect.value = String(process.serviceId || '');
          if (stepGroupSelect && !touched.group && String(process.groupId || '').trim()) stepGroupSelect.value = String(process.groupId || '');
          if (stepOwnerSelect && !touched.owner && String(process.ownerAgentId || '').trim()) stepOwnerSelect.value = String(process.ownerAgentId || '');
        });
        if (stepTitleInput) stepTitleInput.focus();
      }

      if (kind === 'flow') {
        const defaultProcessId = state.selectedType === 'process'
          ? String(state.selectedId || '').trim()
          : '';
        refs.modalTitle.textContent = 'Nouveau flux de processus';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Processus</label><select id="wf-create-flow-process" class="workflow-form-select">${buildSelectOptions(state.collections.processes, 'id', 'title', defaultProcessId)}</select></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.6rem;">
            <div><label class="workflow-form-label">Etape source</label><select id="wf-create-flow-from" class="workflow-form-select"></select></div>
            <div><label class="workflow-form-label">Etape cible</label><select id="wf-create-flow-to" class="workflow-form-select"></select></div>
            <div><label class="workflow-form-label">Type de flux</label><select id="wf-create-flow-type" class="workflow-form-select"><option value="sequence" selected>sequence</option><option value="condition">condition</option><option value="parallel">parallel</option><option value="loop">loop</option></select></div>
          </div>
          <details style="border:1px solid #cbd5e1;border-radius:12px;padding:0.65rem 0.75rem;background:#f8fafc;">
            <summary class="workflow-form-label" style="cursor:pointer;list-style:none;">Parametres avances</summary>
            <div style="margin-top:0.6rem;display:grid;gap:0.6rem;">
              <div><label class="workflow-form-label">Condition</label><textarea id="wf-create-flow-condition" class="workflow-form-textarea"></textarea></div>
              <div><label class="workflow-form-label">Label</label><input id="wf-create-flow-label" class="workflow-form-input" type="text"></div>
            </div>
          </details>
        `;
        const flowProcessSelect = document.getElementById('wf-create-flow-process');
        const flowFromSelect = document.getElementById('wf-create-flow-from');
        const flowToSelect = document.getElementById('wf-create-flow-to');
        const renderFlowStepOptions = () => {
          const processId = String(flowProcessSelect?.value || '').trim();
          const steps = (state.collections.steps || [])
            .filter((row) => String(row.processId || '').trim() === processId)
            .slice()
            .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
          const options = ['<option value="">Selectionner</option>']
            .concat(steps.map((step) => `<option value="${esc(step.id)}">${esc(step.title || step.id)}</option>`));
          if (flowFromSelect) flowFromSelect.innerHTML = options.join('');
          if (flowToSelect) flowToSelect.innerHTML = options.join('');
          if (steps.length > 0) {
            if (flowFromSelect) flowFromSelect.value = String(steps[0].id || '');
            if (flowToSelect) flowToSelect.value = String((steps[1]?.id || steps[0].id || ''));
          }
        };
        flowProcessSelect?.addEventListener('change', renderFlowStepOptions);
        renderFlowStepOptions();
      }

      if (kind === 'task') {
        const defaultServiceId = state.serviceFilter !== 'all' ? state.serviceFilter : '';
        const defaultOwnerAgentId = getCurrentUserPrimaryAgentId(defaultServiceId, state.groupFilter !== 'all' ? state.groupFilter : '') || '';
        const requestedStatus = String(options?.statusPrefill || '').trim();
        const selectedTaskStatus = TASK_STATUS_OPTIONS.includes(requestedStatus) ? requestedStatus : 'todo';
        refs.modalTitle.textContent = 'Nouvelle tache workflow';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Titre</label><input id="wf-create-task-title" class="workflow-form-input" type="text" placeholder="Ex: Verifier les pieces du dossier"></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.6rem;">
            <div><label class="workflow-form-label">Processus (optionnel)</label><select id="wf-create-task-process" class="workflow-form-select">${buildSelectOptions(state.collections.processes, 'id', 'title', '')}</select></div>
            <div><label class="workflow-form-label">Agent responsable</label><select id="wf-create-task-owner" class="workflow-form-select">${buildSelectOptions(state.collections.agents, 'id', 'displayName', defaultOwnerAgentId)}</select></div>
            <div><label class="workflow-form-label">Priorite</label><select id="wf-create-task-priority" class="workflow-form-select"><option value="low">Basse</option><option value="medium" selected>Moyenne</option><option value="high">Haute</option></select></div>
          </div>
          <details style="border:1px solid #cbd5e1;border-radius:12px;padding:0.65rem 0.75rem;background:#f8fafc;">
            <summary class="workflow-form-label" style="cursor:pointer;list-style:none;">Parametres avances</summary>
            <div style="margin-top:0.6rem;display:grid;gap:0.6rem;">
              <div><label class="workflow-form-label">Description</label><textarea id="wf-create-task-description" class="workflow-form-textarea"></textarea></div>
              <div><label class="workflow-form-label">Service</label><select id="wf-create-task-service" class="workflow-form-select">${buildSelectOptions(state.collections.services, 'id', 'name', defaultServiceId)}</select></div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.6rem;">
                <div><label class="workflow-form-label">Statut</label><select id="wf-create-task-status" class="workflow-form-select">${TASK_STATUS_OPTIONS.map((status) => `<option value="${esc(status)}" ${status === selectedTaskStatus ? 'selected' : ''}>${esc(status)}</option>`).join('')}</select></div>
                <div><label class="workflow-form-label">Validation</label><select id="wf-create-task-approval" class="workflow-form-select">${TASK_APPROVAL_OPTIONS.map((status) => `<option value="${esc(status)}" ${status === 'pending' ? 'selected' : ''}>${esc(status)}</option>`).join('')}</select></div>
              </div>
              <div><label class="workflow-form-label">Checklist execution (1 ligne, prefixe [x] optionnel)</label><textarea id="wf-create-task-checklist" class="workflow-form-textarea"></textarea></div>
              <div><label class="workflow-form-label">Prerequis (csv task ids)</label><input id="wf-create-task-prereq" class="workflow-form-input" type="text"></div>
              <div><label class="workflow-form-label">Dependants (csv task ids)</label><input id="wf-create-task-dependent" class="workflow-form-input" type="text"></div>
            </div>
          </details>
        `;
        const taskTitleInput = document.getElementById('wf-create-task-title');
        const taskProcessSelect = document.getElementById('wf-create-task-process');
        const taskServiceSelect = document.getElementById('wf-create-task-service');
        const taskOwnerSelect = document.getElementById('wf-create-task-owner');
        const processById = new Map((state.collections.processes || []).map((row) => [String(row.id), row]));
        const touched = { service: false, owner: false };
        taskServiceSelect?.addEventListener('change', () => { touched.service = true; });
        taskOwnerSelect?.addEventListener('change', () => { touched.owner = true; });
        taskProcessSelect?.addEventListener('change', () => {
          const processId = String(taskProcessSelect.value || '').trim();
          const process = processId ? processById.get(processId) : null;
          if (!process) return;
          if (taskServiceSelect && !touched.service && String(process.serviceId || '').trim()) taskServiceSelect.value = String(process.serviceId || '');
          if (taskOwnerSelect && !touched.owner && String(process.ownerAgentId || '').trim()) taskOwnerSelect.value = String(process.ownerAgentId || '');
        });
        if (taskTitleInput) taskTitleInput.focus();
      }

      if (kind === 'procedure') {
        refs.modalTitle.textContent = 'Nouvelle procedure workflow';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Titre</label><input id="wf-create-procedure-title" class="workflow-form-input" type="text" placeholder="Ex: Procedure de validation dossier"></div>
          <div><label class="workflow-form-label">Scope</label><input id="wf-create-procedure-scope" class="workflow-form-input" type="text"></div>
          <div><label class="workflow-form-label">Declencheur</label><input id="wf-create-procedure-trigger" class="workflow-form-input" type="text"></div>
          <details style="border:1px solid #cbd5e1;border-radius:12px;padding:0.65rem 0.75rem;background:#f8fafc;">
            <summary class="workflow-form-label" style="cursor:pointer;list-style:none;">Parametres avances</summary>
            <div style="margin-top:0.6rem;display:grid;gap:0.6rem;">
              <div><label class="workflow-form-label">Resume</label><textarea id="wf-create-procedure-summary" class="workflow-form-textarea"></textarea></div>
              <div><label class="workflow-form-label">Etapes (une ligne = une etape)</label><textarea id="wf-create-procedure-steps" class="workflow-form-textarea"></textarea></div>
              <div><label class="workflow-form-label">Exceptions (une ligne = une exception)</label><textarea id="wf-create-procedure-exceptions" class="workflow-form-textarea"></textarea></div>
              <div><label class="workflow-form-label">Risques (une ligne = un risque)</label><textarea id="wf-create-procedure-risks" class="workflow-form-textarea"></textarea></div>
              <div><label class="workflow-form-label">Taches workflow liees (csv ids)</label><input id="wf-create-procedure-linked-tasks" class="workflow-form-input" type="text"></div>
              <div><label class="workflow-form-label">Logiciels lies (csv ids)</label><input id="wf-create-procedure-linked-software" class="workflow-form-input" type="text"></div>
              <div><label class="workflow-form-label">Pieces jointes (une ligne = une reference)</label><textarea id="wf-create-procedure-attachments" class="workflow-form-textarea"></textarea></div>
            </div>
          </details>
        `;
        const procedureTitleInput = document.getElementById('wf-create-procedure-title');
        if (procedureTitleInput) procedureTitleInput.focus();
      }

      if (kind === 'software') {
        refs.modalTitle.textContent = 'Nouveau logiciel metier workflow';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Nom</label><input id="wf-create-software-name" class="workflow-form-input" type="text" placeholder="Ex: NEXUS Core"></div>
          <div><label class="workflow-form-label">Categorie</label><input id="wf-create-software-category" class="workflow-form-input" type="text" value="metier"></div>
          <details style="border:1px solid #cbd5e1;border-radius:12px;padding:0.65rem 0.75rem;background:#f8fafc;">
            <summary class="workflow-form-label" style="cursor:pointer;list-style:none;">Parametres avances</summary>
            <div style="margin-top:0.6rem;display:grid;gap:0.6rem;">
              <div><label class="workflow-form-label">Description</label><textarea id="wf-create-software-description" class="workflow-form-textarea"></textarea></div>
              <div><label class="workflow-form-label">Documentation (1 ligne = 1 URL)</label><textarea id="wf-create-software-docs" class="workflow-form-textarea"></textarea></div>
            </div>
          </details>
        `;
        const softwareNameInput = document.getElementById('wf-create-software-name');
        if (softwareNameInput) softwareNameInput.focus();
      }

      if (kind === 'contingency-plan') {
        refs.modalTitle.textContent = 'Nouveau plan de contingence';
        refs.modalBody.innerHTML = `
          <div><label class="workflow-form-label">Titre</label><input id="wf-create-contingency-title" class="workflow-form-input" type="text" placeholder="Ex: Plan bascule secours"></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.6rem;">
            <div><label class="workflow-form-label">Criticite</label><select id="wf-create-contingency-criticality" class="workflow-form-select"><option value="low">Basse</option><option value="medium" selected>Moyenne</option><option value="high">Haute</option></select></div>
            <div><label class="workflow-form-label">Statut</label><select id="wf-create-contingency-status" class="workflow-form-select"><option value="draft">Brouillon</option><option value="active" selected>Actif</option><option value="archived">Archive</option></select></div>
          </div>
          <details style="border:1px solid #cbd5e1;border-radius:12px;padding:0.65rem 0.75rem;background:#f8fafc;" open>
            <summary class="workflow-form-label" style="cursor:pointer;list-style:none;">Liens et perimetre</summary>
            <div style="margin-top:0.6rem;display:grid;gap:0.6rem;">
              <div><label class="workflow-form-label">Description / Perimetre</label><textarea id="wf-create-contingency-description" class="workflow-form-textarea"></textarea></div>
              <div><label class="workflow-form-label">Processus impacte</label><select id="wf-create-contingency-process" class="workflow-form-select"><option value="">-- Aucun --</option>${buildSelectOptions(state.collections.processes, 'id', 'title', '')}</select></div>
              <div><label class="workflow-form-label">Service impacte</label><select id="wf-create-contingency-service" class="workflow-form-select"><option value="">-- Aucun --</option>${buildSelectOptions(state.collections.services, 'id', 'name', '')}</select></div>
              <div><label class="workflow-form-label">Logiciel metier impacte</label><select id="wf-create-contingency-software" class="workflow-form-select"><option value="">-- Aucun --</option>${buildSelectOptions(state.collections.software, 'id', 'name', '')}</select></div>
              <div><label class="workflow-form-label">Proprietaire (Agent)</label><select id="wf-create-contingency-owner" class="workflow-form-select"><option value="">-- Aucun --</option>${buildSelectOptions(state.collections.agents, 'id', 'displayName', '')}</select></div>
            </div>
          </details>
        `;
        const contingencyTitleInput = document.getElementById('wf-create-contingency-title');
        if (contingencyTitleInput) contingencyTitleInput.focus();
      }
      injectCreateModalHints(kind);
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

      if (workflowCreateKind === 'role') {
        const name = String(document.getElementById('wf-create-role-name')?.value || '').trim();
        if (!name) {
          toast('Nom role requis');
          return;
        }
        const row = {
          id: `wf-role-${uid()}`,
          name,
          description: String(document.getElementById('wf-create-role-description')?.value || '').trim(),
          serviceId: String(document.getElementById('wf-create-role-service')?.value || '').trim() || null,
          requiredSkills: parseUniqueCsv(document.getElementById('wf-create-role-skills')?.value || ''),
          permissionHints: parseUniqueCsv(document.getElementById('wf-create-role-permissions')?.value || ''),
          metadata: {},
          createdAt: now(),
          updatedAt: now()
        };
        await api.put('workflowRoles', row, STORE_KEY_FIELDS.workflowRoles);
        await logAudit('create', 'role', row.id, { name: row.name });
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail('role', row.id);
        closeCreateModal();
        toast('Role workflow ajoute');
        return;
      }

      if (workflowCreateKind === 'process') {
        const title = String(document.getElementById('wf-create-process-title')?.value || '').trim();
        if (!title) {
          toast('Titre processus requis');
          return;
        }
        const selectedServiceId = String(document.getElementById('wf-create-process-service')?.value || '').trim() || null;
        const selectedService = selectedServiceId
          ? (state.collections.services || []).find((row) => String(row.id) === selectedServiceId)
          : null;
        const selectedCommunityId = String(document.getElementById('wf-create-process-community')?.value || '').trim() || null;
        const requiredRoleIds = Array.from(document.getElementById('wf-create-process-approval-roles')?.selectedOptions || [])
          .map((opt) => String(opt.value || '').trim())
          .filter(Boolean);
        const requiredLevels = Math.max(1, Number(document.getElementById('wf-create-process-approval-levels')?.value || 2) || 2);
        const validationMode = String(document.getElementById('wf-create-process-approval-mode')?.value || 'level').trim().toLowerCase() === 'sequential'
          ? 'sequential'
          : 'level';
        const row = {
          id: `wf-process-${uid()}`,
          title,
          description: String(document.getElementById('wf-create-process-description')?.value || '').trim(),
          communityId: selectedCommunityId || selectedService?.communityId || null,
          serviceId: selectedServiceId,
          groupId: String(document.getElementById('wf-create-process-group')?.value || '').trim() || null,
          ownerAgentId: String(document.getElementById('wf-create-process-owner')?.value || '').trim() || null,
          status: String(document.getElementById('wf-create-process-status')?.value || 'draft').trim() || 'draft',
          criticality: String(document.getElementById('wf-create-process-criticality')?.value || 'medium').trim() || 'medium',
          inputs: parseMultiline(document.getElementById('wf-create-process-inputs')?.value || ''),
          outputs: parseMultiline(document.getElementById('wf-create-process-outputs')?.value || ''),
          tags: parseUniqueCsv(document.getElementById('wf-create-process-tags')?.value || ''),
          validation: normalizeProcessValidation({
            level: 0,
            requiredLevels,
            mode: validationMode,
            requiredRoleIds,
            approvers: []
          }),
          metadata: {},
          createdAt: now(),
          updatedAt: now()
        };
        await api.put('workflowProcesses', row, STORE_KEY_FIELDS.workflowProcesses);
        await logAudit('create', 'process', row.id, { title: row.title });
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail('process', row.id);
        closeCreateModal();
        toast('Processus workflow ajoute');
        return;
      }

      if (workflowCreateKind === 'template') {
        const templateMode = String(document.getElementById('wf-create-template-mode')?.value || 'blank').trim();
        const sourceProcessId = templateMode === 'process'
          ? String(document.getElementById('wf-create-template-source-process')?.value || '').trim() || null
          : null;
        const sourceProcess = sourceProcessId
          ? (state.collections.processes || []).find((row) => String(row.id) === sourceProcessId)
          : null;
        const requestedName = String(document.getElementById('wf-create-template-name')?.value || '').trim();
        const name = requestedName || (sourceProcess ? `Modele ${sourceProcess.title || sourceProcess.id}` : '');
        if (!name) {
          toast('Nom du modele requis');
          return;
        }
        const selectedServiceId = String(document.getElementById('wf-create-template-service')?.value || '').trim() || null;
        const selectedGroupId = String(document.getElementById('wf-create-template-group')?.value || '').trim() || null;
        const selectedOwnerAgentId = String(document.getElementById('wf-create-template-owner')?.value || '').trim() || null;
        const sourceSteps = sourceProcess ? getProcessStepsSorted(sourceProcess.id) : [];
        const sourceFlows = sourceProcess ? getProcessFlows(sourceProcess.id) : [];
        const stepOrderById = new Map(sourceSteps.map((step, index) => [String(step.id), Number(step.order || index + 1)]));
        const tagsInput = parseUniqueCsv(document.getElementById('wf-create-template-tags')?.value || '');
        const mergedTags = Array.from(new Set([
          ...tagsInput,
          ...(sourceProcess && Array.isArray(sourceProcess.tags) ? sourceProcess.tags : [])
        ].map((tag) => String(tag || '').trim()).filter(Boolean)));
        const row = {
          id: `wf-template-${uid()}`,
          name,
          description: String(document.getElementById('wf-create-template-description')?.value || '').trim() || String(sourceProcess?.description || '').trim(),
          sourceProcessId,
          communityId: sourceProcess?.communityId || null,
          serviceId: selectedServiceId || sourceProcess?.serviceId || null,
          groupId: selectedGroupId || sourceProcess?.groupId || null,
          ownerAgentId: selectedOwnerAgentId || sourceProcess?.ownerAgentId || null,
          status: 'draft',
          tags: mergedTags,
          validation: normalizeProcessValidation(sourceProcess?.validation || { level: 0, requiredLevels: 2, requiredRoleIds: [], approvers: [] }),
          version: 1,
          templateSteps: sourceSteps.map((step, index) => ({
            title: String(step.title || '').trim(),
            stepType: String(step.stepType || 'action').trim() || 'action',
            description: String(step.description || '').trim(),
            serviceId: step.serviceId || null,
            groupId: step.groupId || null,
            roleId: step.roleId || null,
            linkedProcedureId: step.linkedProcedureId || null,
            linkedSoftwareIds: Array.isArray(step.linkedSoftwareIds) ? step.linkedSoftwareIds.slice() : [],
            ownerAgentId: step.ownerAgentId || null,
            estimatedDurationMinutes: Number(step.estimatedDurationMinutes || 0) || 0,
            order: Number(step.order || index + 1)
          })),
          templateFlows: sourceFlows
            .map((flow) => ({
              fromStepOrder: stepOrderById.get(String(flow.fromStepId || '')) || 0,
              toStepOrder: stepOrderById.get(String(flow.toStepId || '')) || 0,
              flowType: String(flow.flowType || 'sequence').trim() || 'sequence',
              condition: String(flow.condition || '').trim(),
              label: String(flow.label || '').trim()
            }))
            .filter((flow) => flow.fromStepOrder > 0 && flow.toStepOrder > 0),
          metadata: {
            versionHistory: [{
              version: 1,
              updatedAt: now(),
              byUserId: currentUserId()
            }],
            createdQuick: true,
            sourceKind: sourceProcess ? 'from_process' : 'blank'
          },
          createdAt: now(),
          updatedAt: now()
        };
        await api.put('workflowProcessTemplates', row, STORE_KEY_FIELDS.workflowProcessTemplates);
        await logAudit('create', 'template', row.id, { name: row.name });
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail('template', row.id);
        closeCreateModal();
        toast('Modele workflow ajoute');
        return;
      }

      if (workflowCreateKind === 'step') {
        const title = String(document.getElementById('wf-create-step-title')?.value || '').trim();
        const processId = String(document.getElementById('wf-create-step-process')?.value || '').trim();
        if (!title || !processId) {
          toast('Processus et titre etape requis');
          return;
        }
        const row = {
          id: `wf-step-${uid()}`,
          processId,
          title,
          stepType: String(document.getElementById('wf-create-step-type')?.value || 'action').trim() || 'action',
          description: String(document.getElementById('wf-create-step-description')?.value || '').trim(),
          serviceId: String(document.getElementById('wf-create-step-service')?.value || '').trim() || null,
          groupId: String(document.getElementById('wf-create-step-group')?.value || '').trim() || null,
          ownerAgentId: String(document.getElementById('wf-create-step-owner')?.value || '').trim() || null,
          roleId: String(document.getElementById('wf-create-step-role')?.value || '').trim() || null,
          linkedProcedureId: String(document.getElementById('wf-create-step-procedure')?.value || '').trim() || null,
          linkedSoftwareIds: parseUniqueCsv(document.getElementById('wf-create-step-software')?.value || ''),
          linkedTaskId: String(document.getElementById('wf-create-step-task')?.value || '').trim() || null,
          estimatedDurationMinutes: Number(document.getElementById('wf-create-step-duration')?.value || 0) || 0,
          order: Math.max(1, Number(document.getElementById('wf-create-step-order')?.value || 1) || 1),
          metadata: {},
          createdAt: now(),
          updatedAt: now()
        };
        await api.put('workflowProcessSteps', row, STORE_KEY_FIELDS.workflowProcessSteps);
        await logAudit('create', 'step', row.id, { title: row.title, processId: row.processId });
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail('step', row.id);
        closeCreateModal();
        toast('Etape workflow ajoutee');
        return;
      }

      if (workflowCreateKind === 'flow') {
        const processId = String(document.getElementById('wf-create-flow-process')?.value || '').trim();
        const fromStepId = String(document.getElementById('wf-create-flow-from')?.value || '').trim();
        const toStepId = String(document.getElementById('wf-create-flow-to')?.value || '').trim();
        if (!processId || !fromStepId || !toStepId) {
          toast('Processus et etapes source/cible requis');
          return;
        }
        const row = {
          id: `wf-flow-${uid()}`,
          processId,
          fromStepId,
          toStepId,
          flowType: String(document.getElementById('wf-create-flow-type')?.value || 'sequence').trim() || 'sequence',
          condition: String(document.getElementById('wf-create-flow-condition')?.value || '').trim(),
          label: String(document.getElementById('wf-create-flow-label')?.value || '').trim(),
          metadata: {},
          createdAt: now(),
          updatedAt: now()
        };
        await api.put('workflowFlows', row, STORE_KEY_FIELDS.workflowFlows);
        await logAudit('create', 'flow', row.id, { processId: row.processId, fromStepId: row.fromStepId, toStepId: row.toStepId });
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail('flow', row.id);
        closeCreateModal();
        toast('Flux workflow ajoute');
        return;
      }

      if (workflowCreateKind === 'task') {
        const title = String(document.getElementById('wf-create-task-title')?.value || '').trim();
        if (!title) {
          toast('Titre tache requis');
          return;
        }
        const processId = String(document.getElementById('wf-create-task-process')?.value || '').trim() || null;
        const relatedProcess = processId
          ? (state.collections.processes || []).find((row) => String(row.id) === processId)
          : null;
        const selectedServiceId = String(document.getElementById('wf-create-task-service')?.value || '').trim() || null;
        const serviceId = selectedServiceId || relatedProcess?.serviceId || null;
        const row = {
          id: `wf-task-${uid()}`,
          title,
          description: String(document.getElementById('wf-create-task-description')?.value || '').trim(),
          ownerAgentId: String(document.getElementById('wf-create-task-owner')?.value || '').trim() || null,
          processId,
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

      if (workflowCreateKind === 'contingency-plan') {
        const title = String(document.getElementById('wf-create-contingency-title')?.value || '').trim();
        if (!title) {
          toast('Titre plan de contingence requis');
          return;
        }
        const row = {
          id: `wf-contingency-plan-${uid()}`,
          code: '',
          title,
          description: String(document.getElementById('wf-create-contingency-description')?.value || '').trim(),
          criticality: String(document.getElementById('wf-create-contingency-criticality')?.value || 'medium').trim(),
          status: String(document.getElementById('wf-create-contingency-status')?.value || 'draft').trim(),
          ownerAgentId: String(document.getElementById('wf-create-contingency-owner')?.value || '').trim() || null,
          processId: String(document.getElementById('wf-create-contingency-process')?.value || '').trim() || null,
          serviceId: String(document.getElementById('wf-create-contingency-service')?.value || '').trim() || null,
          softwareId: String(document.getElementById('wf-create-contingency-software')?.value || '').trim() || null,
          version: 1,
          metadata: {},
          createdAt: now(),
          updatedAt: now()
        };
        await api.put('workflowContingencyPlans', row, STORE_KEY_FIELDS.workflowContingencyPlans);
        await logAudit('create', 'contingencyPlan', row.id, { title: row.title });
        await loadCollections();
        renderServiceFilter();
        renderContent();
        openDetail('contingencyPlan', row.id);
        closeCreateModal();
        toast('Plan de contingence ajoute');
      }
    }
    function bindEvents() {
      if (state.bound) return;
      state.bound = true;

      // Gestion du bouton "Ajouter" (Quick Add) avec delegation d'evenement pour robustesse
      document.addEventListener('click', (event) => {
        const toggleBtn = event.target.closest('#workflow-quick-add-toggle');
        if (toggleBtn) {
          event.preventDefault();
          event.stopPropagation();
          
          // Logique contextuelle : fenetre modale directe ou menu de creation rapide
          const viewToModalMap = {
            'agents': 'agent',
            'processes': 'process',
            'templates': 'template',
            'tasks': 'task',
            'kanban': 'task',
            'timeline': 'task',
            'procedures': 'procedure',
            'software': 'software',
            'contingency': 'contingency-plan'
          };
          
          const modalKind = viewToModalMap[state.activeView];
          if (modalKind) {
            // Ouvrir directement la modale de creation appropriee
            openCreateModal(modalKind);
          } else {
            // Ouvrir le menu de creation rapide (fallback ou vues Map/Org/etc)
            const menu = refs.quickAddMenu || document.getElementById('workflow-quick-add-menu');
            menu?.classList.toggle('hidden');
          }
          return;
        }

        const filtersToggle = event.target.closest('#workflow-filters-toggle');
        if (filtersToggle) {
          event.preventDefault();
          event.stopPropagation();
          const panel = refs.filtersPanel || document.getElementById('workflow-filters-panel');
          panel?.classList.toggle('hidden');
          return;
        }

        // Fermer les menus si clic a l'exterieur (avec petit delai pour laisser les handlers s'executer)
        setTimeout(() => {
          const inQuickAdd = event.target.closest('.workflow-quick-add');
          if (!inQuickAdd) {
            const menu = refs.quickAddMenu || document.getElementById('workflow-quick-add-menu');
            menu?.classList.add('hidden');
          }
          const inFilters = event.target.closest('#workflow-filters-panel, #workflow-filters-toggle');
          if (!inFilters) {
            const panel = refs.filtersPanel || document.getElementById('workflow-filters-panel');
            panel?.classList.add('hidden');
          }
        }, 0);
      });

      Object.entries(viewIds).forEach(([key, id]) => {
        document.getElementById(id)?.addEventListener('click', () => setView(key));
      });

      document.querySelectorAll('#global-workflow-section .workflow-group-tab[data-wf-group]').forEach(btn => {
        btn.addEventListener('click', () => {
          const groupKey = String(btn.getAttribute('data-wf-group') || '').trim();
          if (groupKey && WORKFLOW_GROUPS[groupKey]) {
            setGroup(groupKey);
          }
        });
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
          if (action === 'contingency-activate' && type === 'contingencyPlan') {
            await activateContingencyPlan(id);
            return;
          }
          if (action === 'create-template' && type === 'process') {
            await createTemplateFromProcess(id);
            return;
          }
          if (action === 'instantiate-template' && type === 'template') {
            await instantiateTemplate(id);
            return;
          }
          if (action === 'template-create-variant' && type === 'template') {
            await createTemplateVariant(id);
            return;
          }
          if (action === 'template-publish' && type === 'template') {
            await transitionTemplateStatus(id, 'publish');
            return;
          }
          if (action === 'template-archive' && type === 'template') {
            await transitionTemplateStatus(id, 'archive');
            return;
          }
          if (action === 'template-unarchive' && type === 'template') {
            await transitionTemplateStatus(id, 'unarchive');
            return;
          }
          if (action === 'process-export' && type === 'process') {
            exportProcessSheetPdf(id);
            return;
          }
          if (action === 'entity-export') {
            if (type === 'service') exportServiceSheetPdf(id);
            if (type === 'agent') exportAgentSheetPdf(id);
            if (type === 'software') exportSoftwareSheetPdf(id);
            return;
          }
          if (action === 'process-submit-review' && type === 'process') {
            await transitionProcessValidation(id, 'submit_review');
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

        const analyticsAction = event.target.closest('[data-wf-analytics-action]');
        if (analyticsAction) {
          event.preventDefault();
          event.stopPropagation();
          const action = String(analyticsAction.getAttribute('data-wf-analytics-action') || '').trim();
          if (action === 'export-json') {
            exportGovernanceJson();
            return;
          }
          if (action === 'export-csv') {
            exportGovernanceCsv();
            return;
          }
          if (action === 'export-model-json') {
            exportWorkflowModelJson();
            return;
          }
          if (action === 'export-synthesis-csv') {
            exportWorkflowSynthesisCsv();
            return;
          }
        }
        const governanceAction = event.target.closest('[data-wf-governance-action]');
        if (governanceAction) {
          event.preventDefault();
          event.stopPropagation();
          const action = String(governanceAction.getAttribute('data-wf-governance-action') || '').trim();
          const id = String(governanceAction.getAttribute('data-wf-id') || '').trim();
          if (action === 'open') {
            if (!id) return;
            openDetail('process', id);
            return;
          }
          if (action === 'open_software') {
            if (!id) return;
            openDetail('software', id);
            return;
          }
          if (action === 'open_beneficiary') {
            const beneficiaryType = String(governanceAction.getAttribute('data-wf-beneficiary-type') || '').trim();
            const beneficiaryId = String(governanceAction.getAttribute('data-wf-beneficiary-id') || '').trim();
            if (beneficiaryType === 'agent' && beneficiaryId) {
              openDetail('agent', beneficiaryId);
              return;
            }
            if (beneficiaryType === 'group' && beneficiaryId) {
              openDetail('group', beneficiaryId);
              return;
            }
            if (beneficiaryType === 'role' && beneficiaryId) {
              openDetail('role', beneficiaryId);
              return;
            }
            toast('Ouverture detail indisponible pour ce beneficiaire');
            return;
          }
          if (action === 'approve') {
            if (!id) return;
            transitionProcessValidation(id, 'approve_level').catch((error) => {
              console.error('workflow governance approve', error);
              toast(`Erreur validation: ${error.message}`);
            });
            return;
          }
          if (action === 'reject') {
            if (!id) return;
            transitionProcessValidation(id, 'reject').catch((error) => {
              console.error('workflow governance reject', error);
              toast(`Erreur rejet: ${error.message}`);
            });
            return;
          }
        }
        const governanceExport = event.target.closest('[data-wf-governance-export]');
        if (governanceExport) {
          event.preventDefault();
          event.stopPropagation();
          const action = String(governanceExport.getAttribute('data-wf-governance-export') || '').trim();
          if (action === 'json') {
            exportGovernanceJson();
            return;
          }
          if (action === 'csv') {
            exportGovernanceCsv();
            return;
          }
          if (action === 'perm-matrix-csv') {
            exportPermissionMatrixCsv();
            return;
          }
        }
        const governancePermReset = event.target.closest('[data-wf-governance-perm-reset]');
        if (governancePermReset) {
          event.preventDefault();
          event.stopPropagation();
          state.governancePermissionSoftwareFilter = 'all';
          state.governancePermissionBeneficiaryTypeFilter = 'all';
          state.governancePermissionRequestStatusFilter = 'all';
          renderContent();
          return;
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
          if (action === 'auto_layout') {
            autoLayoutMapView();
            return;
          }
          if (action === 'export_image') {
            exportMapAsImage();
            return;
          }
          if (action === 'export_pdf') {
            exportMapAsPdf();
            return;
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

        const minimapSurface = event.target.closest('[data-wf-map-minimap-surface]');
        if (minimapSurface) {
          if (state.activeView !== 'map') return;
          event.preventDefault();
          event.stopPropagation();
          const viewport = refs.content?.querySelector('[data-wf-map-viewport]');
          const canvas = refs.content?.querySelector('[data-wf-map-canvas]');
          if (!viewport || !canvas) return;
          const rect = minimapSurface.getBoundingClientRect();
          const ratioX = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
          const ratioY = Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height)));
          const canvasW = Math.max(1, Number(canvas.scrollWidth || 1));
          const canvasH = Math.max(1, Number(canvas.scrollHeight || 1));
          const zoom = clampMapZoom(state.mapOptions.zoom || 1);
          const targetCanvasX = ratioX * canvasW;
          const targetCanvasY = ratioY * canvasH;
          state.mapOptions.panX = Math.round((viewport.clientWidth / 2) - targetCanvasX * zoom);
          state.mapOptions.panY = Math.round((viewport.clientHeight / 2) - targetCanvasY * zoom);
          applyMapTransform();
          persistLayout().catch(() => null);
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
        const governanceFilter = event.target.closest('[data-wf-governance-filter]');
        if (governanceFilter) {
          state.governanceFilter = String(governanceFilter.value || 'all') || 'all';
          renderContent();
          return;
        }
        const governancePermSoftwareFilter = event.target.closest('[data-wf-governance-perm-software-filter]');
        if (governancePermSoftwareFilter) {
          state.governancePermissionSoftwareFilter = String(governancePermSoftwareFilter.value || 'all') || 'all';
          renderContent();
          return;
        }
        const governancePermBeneficiaryFilter = event.target.closest('[data-wf-governance-perm-beneficiary-filter]');
        if (governancePermBeneficiaryFilter) {
          state.governancePermissionBeneficiaryTypeFilter = String(governancePermBeneficiaryFilter.value || 'all') || 'all';
          renderContent();
          return;
        }
        const governancePermRequestStatusFilter = event.target.closest('[data-wf-governance-perm-request-status-filter]');
        if (governancePermRequestStatusFilter) {
          state.governancePermissionRequestStatusFilter = String(governancePermRequestStatusFilter.value || 'all') || 'all';
          renderContent();
          return;
        }
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

      refs.content?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-wf-kanban-add="1"]');
        if (!button || !canEditWorkflow() || state.activeView !== 'kanban') return;
        event.preventDefault();
        event.stopPropagation();
        const status = String(button.getAttribute('data-wf-target-status') || '').trim();
        openCreateModal('task', { statusPrefill: status });
      });

      document.getElementById('btn-workflow-detail-close')?.addEventListener('click', () => {
        closeDetailModal();
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && refs.modal && !refs.modal.classList.contains('hidden')) {
          event.preventDefault();
          closeCreateModal();
          return;
        }
        if (event.key === 'Enter' && refs.modal && !refs.modal.classList.contains('hidden')) {
          if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
          const target = event.target;
          if (!target || !(target instanceof HTMLElement)) return;
          if (target.closest('textarea')) return;
          if (target.isContentEditable) return;
          if (target.closest('button')) return;
          event.preventDefault();
          submitCreateModal().catch((error) => {
            console.error('workflow submitCreateModal keyboard', error);
            toast(`Erreur workflow: ${error.message}`);
          });
          return;
        }
        if (event.key === 'Escape' && refs.detailModal && !refs.detailModal.classList.contains('hidden')) {
          closeDetailModal();
        }
      });

      // Utiliser la délégation d'événements sur le menu parent
      // Cela évite que les listeners soient perdus si les boutons sont modifiés
      if (refs.quickAddMenu) {
        refs.quickAddMenu.addEventListener('click', (e) => {
          const button = e.target.closest('button[id^="btn-workflow-add-"]');
          if (!button) return;

          console.log('[MENU CLICK] Button clicked:', button.id);
          e.stopPropagation();
          refs.quickAddMenu.classList.add('hidden');

          // Mapper l'ID du bouton à l'action correspondante
          const actionMap = {
            'btn-workflow-add-community': 'community',
            'btn-workflow-add-service': 'service',
            'btn-workflow-add-group': 'group',
            'btn-workflow-add-agent': 'agent',
            'btn-workflow-add-role': 'role',
            'btn-workflow-add-process': 'process',
            'btn-workflow-add-template': 'template',
            'btn-workflow-add-step': 'step',
            'btn-workflow-add-flow': 'flow',
            'btn-workflow-add-task': 'task',
            'btn-workflow-add-procedure': 'procedure',
            'btn-workflow-add-software': 'software',
            'btn-workflow-add-contingency-plan': 'contingency-plan'
          };

          const modalKind = actionMap[button.id];
          if (modalKind) {
            console.log('[MENU CLICK] Opening modal:', modalKind);
            openCreateModal(modalKind);
          }
        });
        console.log('[BIND] Event delegation added to quick-add menu');
      }

      document.getElementById('btn-workflow-migrate-agent-users')?.addEventListener('click', () => {
        migrateAgentUserIdsFromDirectory().catch((error) => {
          console.error('workflow migrateAgentUserIdsFromDirectory', error);
          toast(`Erreur migration agents: ${error.message}`);
        });
      });

      document.getElementById('btn-workflow-inject-org-model')?.addEventListener('click', () => {
        injectOrganizationModelSampleData().catch((error) => {
          console.error('workflow injectOrganizationModelSampleData', error);
          toast(`Erreur injection jeu exemple: ${error.message}`);
        });
      });

      document.getElementById('btn-close-workflow-modal')?.addEventListener('click', closeCreateModal);
      document.getElementById('btn-cancel-workflow-modal')?.addEventListener('click', closeCreateModal);
      refs.modal?.addEventListener('click', (event) => {
        if (event.target === refs.modal) {
          event.preventDefault();
          event.stopPropagation();
          closeCreateModal();
        }
      });
      refs.detailModal?.addEventListener('click', (event) => {
        if (event.target === refs.detailModal) {
          event.preventDefault();
          event.stopPropagation();
          closeDetailModal();
        }
      });
      refs.modalSave?.addEventListener('click', () => {
        submitCreateModal().catch((error) => {
          console.error('workflow submitCreateModal', error);
          toast(`Erreur workflow: ${error.message}`);
        });
      });
    }

    async function init() {
      if (!refs.section || !refs.content) return;
      normalizeWorkflowTopActionsRow();
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

