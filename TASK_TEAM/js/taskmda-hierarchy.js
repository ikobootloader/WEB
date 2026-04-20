(function initTaskMdaHierarchyModule(global) {
  'use strict';

  const EVENT_TYPES = new Set([
    'CREATE_EPIC',
    'UPDATE_EPIC',
    'DELETE_EPIC',
    'CREATE_FEATURE',
    'UPDATE_FEATURE',
    'DELETE_FEATURE',
    'MOVE_FEATURE_TO_EPIC',
    'MOVE_TASK_TO_FEATURE'
  ]);

  function normalizeString(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    const key = normalizeString(value).toLowerCase();
    if (key === 'archived' || key === 'done' || key === 'closed') return 'archived';
    return 'active';
  }

  function ensureStateShape(state) {
    if (!state || typeof state !== 'object') return;
    if (!Array.isArray(state.epics)) state.epics = [];
    if (!Array.isArray(state.features)) state.features = [];
    if (!Array.isArray(state.tasks)) state.tasks = [];
  }

  function applyEventToState(state, event) {
    ensureStateShape(state);
    if (!state || !event || !EVENT_TYPES.has(String(event.type || '').trim())) return false;

    const payload = event.payload || {};
    const ts = Number(event.timestamp || Date.now()) || Date.now();
    const author = normalizeString(event.author || '');

    switch (event.type) {
      case 'CREATE_EPIC': {
        const epicId = normalizeString(payload.epicId);
        const name = normalizeString(payload.name);
        if (!epicId || !name) return true;
        if (state.epics.some((epic) => normalizeString(epic.epicId) === epicId)) return true;
        state.epics.push({
          epicId,
          name,
          description: normalizeString(payload.description),
          status: normalizeStatus(payload.status),
          createdBy: author || null,
          createdAt: ts
        });
        return true;
      }
      case 'UPDATE_EPIC': {
        const epicId = normalizeString(payload.epicId);
        if (!epicId) return true;
        state.epics = state.epics.map((epic) => {
          if (normalizeString(epic.epicId) !== epicId) return epic;
          const changes = payload.changes && typeof payload.changes === 'object' ? payload.changes : {};
          const next = { ...epic, ...changes, updatedAt: ts };
          if (Object.prototype.hasOwnProperty.call(changes, 'status')) {
            next.status = normalizeStatus(changes.status);
          }
          return next;
        });
        return true;
      }
      case 'DELETE_EPIC': {
        const epicId = normalizeString(payload.epicId);
        if (!epicId) return true;
        state.epics = state.epics.map((epic) => (
          normalizeString(epic.epicId) === epicId
            ? { ...epic, status: 'archived', archivedAt: ts, updatedAt: ts }
            : epic
        ));
        state.features = state.features.map((feature) => (
          normalizeString(feature.epicId) === epicId
            ? { ...feature, epicId: null, updatedAt: ts }
            : feature
        ));
        return true;
      }
      case 'CREATE_FEATURE': {
        const featureId = normalizeString(payload.featureId);
        const name = normalizeString(payload.name);
        if (!featureId || !name) return true;
        if (state.features.some((feature) => normalizeString(feature.featureId) === featureId)) return true;
        const epicId = normalizeString(payload.epicId) || null;
        state.features.push({
          featureId,
          epicId,
          name,
          description: normalizeString(payload.description),
          status: normalizeStatus(payload.status),
          createdBy: author || null,
          createdAt: ts
        });
        return true;
      }
      case 'UPDATE_FEATURE': {
        const featureId = normalizeString(payload.featureId);
        if (!featureId) return true;
        state.features = state.features.map((feature) => {
          if (normalizeString(feature.featureId) !== featureId) return feature;
          const changes = payload.changes && typeof payload.changes === 'object' ? payload.changes : {};
          const next = { ...feature, ...changes, updatedAt: ts };
          if (Object.prototype.hasOwnProperty.call(changes, 'status')) {
            next.status = normalizeStatus(changes.status);
          }
          if (Object.prototype.hasOwnProperty.call(changes, 'epicId')) {
            const epicId = normalizeString(changes.epicId);
            next.epicId = epicId || null;
          }
          return next;
        });
        return true;
      }
      case 'DELETE_FEATURE': {
        const featureId = normalizeString(payload.featureId);
        if (!featureId) return true;
        state.features = state.features.map((feature) => (
          normalizeString(feature.featureId) === featureId
            ? { ...feature, status: 'archived', archivedAt: ts, updatedAt: ts }
            : feature
        ));
        state.tasks = state.tasks.map((task) => (
          normalizeString(task.featureId) === featureId
            ? { ...task, featureId: null, updatedAt: ts }
            : task
        ));
        return true;
      }
      case 'MOVE_FEATURE_TO_EPIC': {
        const featureId = normalizeString(payload.featureId);
        if (!featureId) return true;
        const epicId = normalizeString(payload.epicId) || null;
        state.features = state.features.map((feature) => (
          normalizeString(feature.featureId) === featureId
            ? { ...feature, epicId, updatedAt: ts }
            : feature
        ));
        return true;
      }
      case 'MOVE_TASK_TO_FEATURE': {
        const taskId = normalizeString(payload.taskId);
        if (!taskId) return true;
        const featureId = normalizeString(payload.featureId) || null;
        state.tasks = state.tasks.map((task) => (
          normalizeString(task.taskId) === taskId
            ? { ...task, featureId, updatedAt: ts }
            : task
        ));
        return true;
      }
      default:
        return false;
    }
  }

  function renderProjectHierarchyPanel(options = {}) {
    const state = options.state || {};
    const canManage = !!options.canManage;
    const escapeHtml = typeof options.escapeHtml === 'function'
      ? options.escapeHtml
      : (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    ensureStateShape(state);
    const epics = (state.epics || []).filter((epic) => normalizeStatus(epic.status) !== 'archived');
    const features = (state.features || []).filter((feature) => normalizeStatus(feature.status) !== 'archived');
    const tasks = (Array.isArray(state.tasks) ? state.tasks : []).filter((task) => !task?.archivedAt);

    const featureById = new Map(
      features
        .map((feature) => [normalizeString(feature.featureId), feature])
        .filter((entry) => !!entry[0])
    );

    const taskCountByFeature = new Map();
    const taskDoneCountByFeature = new Map();
    const taskCountByEpic = new Map();
    const taskDoneCountByEpic = new Map();
    let taskWithoutFeatureCount = 0;
    let taskDoneCount = 0;
    tasks.forEach((task) => {
      const isDone = normalizeString(task.status).toLowerCase() === 'termine';
      if (isDone) taskDoneCount += 1;
      const featureId = normalizeString(task.featureId);
      if (!featureId || !featureById.has(featureId)) {
        taskWithoutFeatureCount += 1;
        return;
      }
      taskCountByFeature.set(featureId, (taskCountByFeature.get(featureId) || 0) + 1);
      if (isDone) taskDoneCountByFeature.set(featureId, (taskDoneCountByFeature.get(featureId) || 0) + 1);
      const epicId = normalizeString(featureById.get(featureId)?.epicId) || '__none__';
      taskCountByEpic.set(epicId, (taskCountByEpic.get(epicId) || 0) + 1);
      if (isDone) taskDoneCountByEpic.set(epicId, (taskDoneCountByEpic.get(epicId) || 0) + 1);
    });

    const featuresByEpic = new Map();
    features.forEach((feature) => {
      const epicId = normalizeString(feature.epicId) || '__none__';
      if (!featuresByEpic.has(epicId)) featuresByEpic.set(epicId, []);
      featuresByEpic.get(epicId).push(feature);
    });

    const epicOptions = [
      '<option value="">Sans epic</option>',
      ...epics.map((epic) => `<option value="${escapeHtml(epic.epicId)}">${escapeHtml(epic.name)}</option>`)
    ].join('');
    const featureOptions = [
      '<option value="">Sans feature</option>',
      ...features.map((feature) => `<option value="${escapeHtml(feature.featureId)}">${escapeHtml(feature.name)}</option>`)
    ].join('');
    const taskOptions = [
      '<option value="">Selectionner une tache</option>',
      ...tasks
        .slice()
        .sort((a, b) => String(a?.title || '').localeCompare(String(b?.title || ''), 'fr', { sensitivity: 'base' }))
        .map((task) => `<option value="${escapeHtml(normalizeString(task.taskId))}">${escapeHtml(task.title || 'Tache')}</option>`)
    ].join('');
    const draggableTaskRows = tasks
      .slice()
      .sort((a, b) => String(a?.title || '').localeCompare(String(b?.title || ''), 'fr', { sensitivity: 'base' }))
      .map((task) => {
        const taskId = normalizeString(task.taskId);
        const taskIdEncoded = encodeURIComponent(taskId);
        const feature = featureById.get(normalizeString(task.featureId));
        const featureLabel = feature ? String(feature.name || 'Feature') : 'Sans feature';
        return `
          <div class="hierarchy-task-drag-item rounded-lg border border-slate-200 bg-white px-2 py-1.5" draggable="true" ondragstart="startTaskDragToFeature(event, '${taskIdEncoded}')">
            <p class="text-xs font-semibold text-slate-800 truncate">${escapeHtml(task.title || 'Tache')}</p>
            <p class="text-[11px] text-slate-500 truncate">${escapeHtml(featureLabel)}</p>
          </div>
        `;
      }).join('');

    const renderFeatureLine = (feature) => {
      const featureId = normalizeString(feature.featureId);
      const featureIdEncoded = encodeURIComponent(featureId);
      const count = taskCountByFeature.get(featureId) || 0;
      const doneCount = taskDoneCountByFeature.get(featureId) || 0;
      return `
        <li class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-white" ${canManage ? `draggable="true" ondragstart="startFeatureDragToEpic(event, '${featureIdEncoded}')" ondragover="allowHierarchyDrop(event)" ondrop="dropTaskOnFeature(event, '${featureIdEncoded}')"` : ''}>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(feature.name || 'Feature')}</p>
            <p class="text-xs text-slate-500 truncate">${escapeHtml(feature.description || 'Sans description')}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 whitespace-nowrap">${count} tache(s)</span>
            <span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 whitespace-nowrap">${doneCount} terminee(s)</span>
            ${canManage ? `
              <button type="button" class="task-action-btn task-action-btn-subtle text-xs" onclick="openProjectFeatureEditor('${featureIdEncoded}')">Modifier</button>
              <button type="button" class="task-action-btn task-action-btn-danger text-xs" onclick="deleteProjectFeature('${featureIdEncoded}')">Supprimer</button>
            ` : ''}
          </div>
        </li>
      `;
    };

    const renderEpicBlock = (epic) => {
      const epicId = normalizeString(epic.epicId);
      const epicIdEncoded = encodeURIComponent(epicId);
      const featureList = featuresByEpic.get(epicId) || [];
      const epicTaskCount = taskCountByEpic.get(epicId) || 0;
      const epicDoneCount = taskDoneCountByEpic.get(epicId) || 0;
      return `
        <section class="rounded-xl border border-slate-200 bg-slate-50 p-3" ${canManage ? `ondragover="allowHierarchyDrop(event)" ondrop="dropFeatureOnEpic(event, '${epicIdEncoded}')"` : ''}>
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="min-w-0">
              <h4 class="text-sm font-bold text-slate-800 truncate">${escapeHtml(epic.name || 'Epic')}</h4>
              <p class="text-xs text-slate-500 truncate">${escapeHtml(epic.description || 'Sans description')}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700 whitespace-nowrap">${featureList.length} feature(s)</span>
              <span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 whitespace-nowrap">${epicTaskCount} tache(s)</span>
              <span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 whitespace-nowrap">${epicDoneCount} terminee(s)</span>
              ${canManage ? `
                <button type="button" class="task-action-btn task-action-btn-subtle text-xs" onclick="editProjectEpicPrompt('${epicIdEncoded}')">Editer</button>
                <button type="button" class="task-action-btn task-action-btn-danger text-xs" onclick="deleteProjectEpic('${epicIdEncoded}')">Supprimer</button>
              ` : ''}
            </div>
          </div>
          ${featureList.length > 0
            ? `<ul class="space-y-2">${featureList.map(renderFeatureLine).join('')}</ul>`
            : '<p class="text-xs text-slate-500">Aucune feature rattachee.</p>'}
        </section>
      `;
    };

    const noEpicFeatures = featuresByEpic.get('__none__') || [];
    const noEpicTaskCount = taskCountByEpic.get('__none__') || 0;
    const noEpicDoneCount = taskDoneCountByEpic.get('__none__') || 0;
    const taskWithFeatureCount = Math.max(0, tasks.length - taskWithoutFeatureCount);
    const completionRate = tasks.length > 0 ? Math.round((taskDoneCount / tasks.length) * 100) : 0;

    return `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 class="font-bold text-slate-800">Structure Epic / Feature</h3>
          <span class="text-xs text-slate-500">${epics.length} epic(s) • ${features.length} feature(s)</span>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
          <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-slate-500">Taches actives</p>
            <p class="text-lg font-bold text-slate-800">${tasks.length}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-slate-500">Avec feature</p>
            <p class="text-lg font-bold text-indigo-700">${taskWithFeatureCount}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-slate-500">Sans feature</p>
            <p class="text-lg font-bold text-amber-700">${taskWithoutFeatureCount}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-slate-500">Terminees</p>
            <p class="text-lg font-bold text-emerald-700">${taskDoneCount}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-slate-500">Completion</p>
            <p class="text-lg font-bold text-slate-800">${completionRate}%</p>
          </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
          <div class="rounded-xl border border-slate-200 bg-white p-3">
            <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Ajouter un epic</p>
            <div class="flex gap-2">
              <input id="project-epic-name-input" type="text" placeholder="Nom epic" class="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" ${canManage ? '' : 'disabled'}>
              <button type="button" class="task-action-btn task-action-btn-subtle text-sm" onclick="createProjectEpic()" ${canManage ? '' : 'disabled'}>Creer</button>
            </div>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-3">
            <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Ajouter une feature</p>
            <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <input id="project-feature-name-input" type="text" placeholder="Nom feature" class="px-3 py-2 border border-slate-300 rounded-lg text-sm" ${canManage ? '' : 'disabled'}>
              <select id="project-feature-epic-select" class="px-3 py-2 border border-slate-300 rounded-lg text-sm" ${canManage ? '' : 'disabled'}>${epicOptions}</select>
            </div>
            <div class="mt-2">
              <button type="button" class="task-action-btn task-action-btn-subtle text-sm" onclick="createProjectFeature()" ${canManage ? '' : 'disabled'}>Creer</button>
            </div>
          </div>
        </div>
        <section class="rounded-xl border border-slate-200 bg-white p-3 mb-4">
          <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Actions rapides</p>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p class="text-xs font-semibold text-slate-700 mb-2">Deplacer une feature vers un epic</p>
              <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                <select id="project-hierarchy-move-feature-id" class="px-3 py-2 border border-slate-300 rounded-lg text-sm" ${canManage ? '' : 'disabled'}>
                  <option value="">Selectionner feature</option>
                  ${features.map((feature) => `<option value="${escapeHtml(feature.featureId)}">${escapeHtml(feature.name || 'Feature')}</option>`).join('')}
                </select>
                <select id="project-hierarchy-move-epic-id" class="px-3 py-2 border border-slate-300 rounded-lg text-sm" ${canManage ? '' : 'disabled'}>
                  ${epicOptions}
                </select>
                <button type="button" class="task-action-btn text-sm" onclick="moveFeatureToEpicQuick()" ${canManage ? '' : 'disabled'}>Deplacer</button>
              </div>
            </div>
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p class="text-xs font-semibold text-slate-700 mb-2">Affecter une tache a une feature</p>
              <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                <select id="project-hierarchy-move-task-id" class="px-3 py-2 border border-slate-300 rounded-lg text-sm" ${canManage ? '' : 'disabled'}>
                  ${taskOptions}
                </select>
                <select id="project-hierarchy-move-task-feature-id" class="px-3 py-2 border border-slate-300 rounded-lg text-sm" ${canManage ? '' : 'disabled'}>
                  ${featureOptions}
                </select>
                <button type="button" class="task-action-btn text-sm" onclick="moveTaskToFeatureQuick()" ${canManage ? '' : 'disabled'}>Affecter</button>
              </div>
            </div>
          </div>
          ${canManage ? `
            <div class="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p class="text-xs font-semibold text-slate-700 mb-2">Glisser les taches</p>
                <div class="space-y-2 max-h-44 overflow-auto">
                  ${draggableTaskRows || '<p class="text-xs text-slate-500">Aucune tache active.</p>'}
                </div>
              </div>
              <div class="rounded-lg border border-dashed border-slate-300 bg-white p-2" ondragover="allowHierarchyDrop(event)" ondrop="dropTaskOnFeature(event, '')">
                <p class="text-xs font-semibold text-slate-700 mb-1">Zone de depot: Sans feature</p>
                <p class="text-[11px] text-slate-500">Deposez ici une tache pour la detacher de sa feature.</p>
              </div>
            </div>
          ` : ''}
        </section>
        <div class="space-y-3">
          ${canManage ? `
            <section id="project-feature-editor" class="hidden rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <div class="flex items-center justify-between gap-2 mb-2">
                <h4 class="text-sm font-bold text-indigo-900">Modifier la feature</h4>
                <button type="button" class="task-action-btn task-action-btn-subtle text-xs" onclick="cancelProjectFeatureEditor()">Fermer</button>
              </div>
              <input id="project-feature-edit-id" type="hidden" value="">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                <input id="project-feature-edit-name" type="text" placeholder="Nom feature" class="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <select id="project-feature-edit-epic" class="px-3 py-2 border border-slate-300 rounded-lg text-sm">${epicOptions}</select>
              </div>
              <textarea id="project-feature-edit-description" rows="2" placeholder="Description feature" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"></textarea>
              <div class="mt-2 flex items-center justify-end gap-2">
                <button type="button" class="task-action-btn task-action-btn-subtle text-xs" onclick="cancelProjectFeatureEditor()">Annuler</button>
                <button type="button" class="task-action-btn text-xs" onclick="saveProjectFeatureEditor()">Enregistrer</button>
              </div>
            </section>
          ` : ''}
          ${epics.length > 0 ? epics.map(renderEpicBlock).join('') : '<p class="text-sm text-slate-500">Aucun epic defini.</p>'}
          <section class="rounded-xl border border-dashed border-slate-300 bg-white p-3" ${canManage ? 'ondragover="allowHierarchyDrop(event)" ondrop="dropFeatureOnEpic(event, \'\')"' : ''}>
            <div class="flex items-center justify-between gap-2 mb-2">
              <h4 class="text-sm font-bold text-slate-700">Features sans epic</h4>
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">${noEpicFeatures.length}</span>
                <span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">${noEpicTaskCount} tache(s)</span>
                <span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">${noEpicDoneCount} terminee(s)</span>
              </div>
            </div>
            ${noEpicFeatures.length > 0
              ? `<ul class="space-y-2">${noEpicFeatures.map(renderFeatureLine).join('')}</ul>`
              : '<p class="text-xs text-slate-500">Aucune feature orpheline.</p>'}
          </section>
        </div>
      </div>
    `;
  }

  global.TaskMDAHierarchy = {
    ensureStateShape,
    applyEventToState,
    renderProjectHierarchyPanel
  };
}(window));
