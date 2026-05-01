(function initTaskMdaTaskLifecycleDomainModule(global) {
  'use strict';

  function createModule(options) {
    const opts = options || {};
    const state = opts.state || {};

    function getCurrentProjectId() {
      return typeof state.getCurrentProjectId === 'function' ? state.getCurrentProjectId() : null;
    }

    function getCurrentProjectState() {
      return typeof state.getCurrentProjectState === 'function' ? state.getCurrentProjectState() : null;
    }

    function getCurrentUser() {
      return typeof state.getCurrentUser === 'function' ? state.getCurrentUser() : null;
    }

    function getStandaloneTaskMode() {
      return typeof state.getStandaloneTaskMode === 'function' ? !!state.getStandaloneTaskMode() : false;
    }

    function setStandaloneTaskMode(value) {
      if (typeof state.setStandaloneTaskMode === 'function') state.setStandaloneTaskMode(!!value);
    }

    function getPendingTaskStatusPrefill() {
      return typeof state.getPendingTaskStatusPrefill === 'function' ? state.getPendingTaskStatusPrefill() : null;
    }

    function setPendingTaskStatusPrefill(value) {
      if (typeof state.setPendingTaskStatusPrefill === 'function') state.setPendingTaskStatusPrefill(value || null);
    }

    function getEditingTaskId() {
      return typeof state.getEditingTaskId === 'function' ? state.getEditingTaskId() : null;
    }

    function setEditingTaskId(value) {
      if (typeof state.setEditingTaskId === 'function') state.setEditingTaskId(value || null);
    }

    function getEditingStandaloneTaskId() {
      return typeof state.getEditingStandaloneTaskId === 'function' ? state.getEditingStandaloneTaskId() : null;
    }

    function setEditingStandaloneTaskId(value) {
      if (typeof state.setEditingStandaloneTaskId === 'function') state.setEditingStandaloneTaskId(value || null);
    }

    function getCurrentGlobalTaskDetailResolved() {
      return typeof state.getCurrentGlobalTaskDetailResolved === 'function' ? state.getCurrentGlobalTaskDetailResolved() : null;
    }

    function getCurrentGlobalTaskDetailRef() {
      return typeof state.getCurrentGlobalTaskDetailRef === 'function' ? state.getCurrentGlobalTaskDetailRef() : '';
    }

    function getPendingTaskConvertRef() {
      return typeof state.getPendingTaskConvertRef === 'function' ? state.getPendingTaskConvertRef() : null;
    }

    function setPendingTaskConvertRef(value) {
      if (typeof state.setPendingTaskConvertRef === 'function') state.setPendingTaskConvertRef(value || null);
    }

    async function openProjectTaskCreateModalWithStatus(status) {
      opts.trackUxMetric?.('openNewTaskProject');
      setStandaloneTaskMode(false);
      setPendingTaskStatusPrefill(opts.normalizeTaskStatusForCreate?.(status || 'todo') || 'todo');
      openTaskModal();
    }

    async function openGlobalTaskCreateModalWithStatus(status) {
      opts.trackUxMetric?.('openNewTaskGlobal');
      setStandaloneTaskMode(true);
      setPendingTaskStatusPrefill(opts.normalizeTaskStatusForCreate?.(status || 'todo') || 'todo');
      openTaskModal();
    }

    function openTaskModal(task) {
      const standaloneTaskMode = getStandaloneTaskMode();
      const modal = document.getElementById('modal-new-task');
      if (!modal) return;
      modal.classList.remove('hidden');
      opts.updateEditLockBadges?.();
      const titleEl = modal.querySelector('h3');
      const standaloneModeWrap = document.getElementById('task-standalone-mode-wrap');
      const standaloneModeInput = document.getElementById('task-standalone-mode');
      const metadataWrap = document.getElementById('task-project-metadata-wrap');
      const groupAssignWrap = document.getElementById('task-group-assignment-wrap');
      const featureAssignWrap = document.getElementById('task-feature-assignment-wrap');
      const groupPendingBox = document.getElementById('task-group-pending-members');
      const taskThemeInput = document.getElementById('task-theme');
      const taskGroupInput = document.getElementById('task-group');
      const taskFeatureInput = document.getElementById('task-feature');
      if (standaloneModeWrap) standaloneModeWrap.classList.toggle('hidden', !standaloneTaskMode);
      if (metadataWrap) metadataWrap.classList.remove('hidden');
      if (groupAssignWrap) groupAssignWrap.classList.toggle('hidden', standaloneTaskMode);
      if (featureAssignWrap) featureAssignWrap.classList.toggle('hidden', standaloneTaskMode);
      if (groupPendingBox) {
        groupPendingBox.classList.add('hidden');
        groupPendingBox.innerHTML = '';
      }
      opts.setTaskPendingGroupMemberUserIds?.([]);
      opts.refreshTaskMetadataOptions?.(standaloneTaskMode ? null : getCurrentProjectState(), { skipGroups: standaloneTaskMode });
      const currentAssignees = opts.getTaskAssigneeEntries?.(task || null, standaloneTaskMode ? null : getCurrentProjectState()) || [];
      const selectedAssigneeValues = currentAssignees.map((entry) => opts.buildTaskAssigneeSelectValue?.(entry)).filter(Boolean);
      const defaultCreatorAssigneeValue = !task ? String(getCurrentUser()?.userId || '').trim() : '';
      const effectiveSelectedAssigneeValues = (!task && !selectedAssigneeValues.length && defaultCreatorAssigneeValue)
        ? [defaultCreatorAssigneeValue]
        : selectedAssigneeValues;
      opts.refreshTaskAssigneeOptionsMulti?.(standaloneTaskMode ? null : getCurrentProjectState(), effectiveSelectedAssigneeValues);
      opts.refreshTaskQuickAssigneeSuggestions?.(standaloneTaskMode ? null : getCurrentProjectState());
      if (titleEl) titleEl.textContent = standaloneTaskMode ? 'Nouvelle tâche hors projet' : 'Nouvelle tâche';

      if (task) {
        setPendingTaskStatusPrefill(null);
        setEditingTaskId(task.taskId || null);
        setEditingStandaloneTaskId(standaloneTaskMode ? (task.id || getEditingStandaloneTaskId() || null) : null);
        document.getElementById('task-title').value = task.title || '';
        opts.setProjectDescriptionEditorContent?.('task-description-editor', 'task-description', task.descriptionHtml || task.description || '');
        const manualAssignees = currentAssignees
          .filter((a) => !a.userId && !a.agentId && a.name)
          .map((a) => (a.email && opts.normalizeSearch?.(a.email) !== opts.normalizeSearch?.(a.name || '')) ? (a.name + ' <' + a.email + '>') : a.name);
        document.getElementById('task-assignee-manual').value = manualAssignees.join('\n');
        document.getElementById('task-request-date').value = task.requestDate || (task.createdAt ? opts.toYmd?.(new Date(task.createdAt)) : '');
        opts.populateTaskDeadlineForm?.(task);
        document.getElementById('task-status').value = task.status || 'todo';
        document.getElementById('task-urgency').value = task.urgency || 'medium';
        document.getElementById('task-subtasks').value = (task.subtasks || []).map((st) => st.label).join('\n');
        document.getElementById('task-files').value = '';
        const taskEditorImageInput = document.getElementById('task-description-image-input');
        if (taskEditorImageInput) taskEditorImageInput.value = '';
        document.getElementById('task-share-docs').checked = true;
        const saveTaskBtn = document.getElementById('btn-save-task');
        if (saveTaskBtn) {
          saveTaskBtn.setAttribute('data-action-kind', 'save');
          saveTaskBtn.setAttribute('data-action-label', 'Mettre à jour');
          saveTaskBtn.setAttribute('aria-label', 'Mettre à jour');
          saveTaskBtn.setAttribute('data-ui-tooltip', 'Mettre à jour');
          const saveTaskIcon = saveTaskBtn.querySelector('.taskmda-action-icon, .material-symbols-outlined');
          if (saveTaskIcon) saveTaskIcon.textContent = 'save';
          const saveTaskLabel = saveTaskBtn.querySelector('.taskmda-action-label');
          if (saveTaskLabel) saveTaskLabel.textContent = 'Mettre à jour';
        }
        if (standaloneModeInput) standaloneModeInput.value = opts.normalizeSharingMode?.(task.sharingMode, 'private') || 'private';
        if (taskThemeInput) taskThemeInput.value = task.theme || '';
        opts.syncThemePickerSelectionFromInput?.('task-theme-known', 'task-theme');
        if (taskGroupInput) {
          if (task.groupId) {
            taskGroupInput.value = task.groupId;
          } else if (task.groupName) {
            const wanted = opts.normalizeCatalogKey?.(task.groupName);
            const option = Array.from(taskGroupInput.options || [])
              .find((opt) => String(opt.value || '').startsWith('global:') && opts.normalizeCatalogKey?.(opt.dataset.groupName || '') === wanted);
            taskGroupInput.value = option ? option.value : '';
          } else {
            taskGroupInput.value = '';
          }
        }
        if (taskFeatureInput) taskFeatureInput.value = String(task.featureId || '').trim();
        if (global.TaskMDARecurrenceUI?.populateRecurrenceForm) global.TaskMDARecurrenceUI.populateRecurrenceForm(task.recurring);
        if (!standaloneTaskMode) opts.refreshTaskGroupSelectionPreview?.(getCurrentProjectState(), effectiveSelectedAssigneeValues);
        return;
      }

      setEditingTaskId(null);
      setEditingStandaloneTaskId(null);
      const defaultStatus = opts.normalizeTaskStatusForCreate?.(getPendingTaskStatusPrefill() || 'todo') || 'todo';
      setPendingTaskStatusPrefill(null);
      document.getElementById('task-title').value = '';
      opts.setProjectDescriptionEditorContent?.('task-description-editor', 'task-description', '');
      document.getElementById('task-assignee-manual').value = '';
      document.getElementById('task-request-date').value = opts.toYmd?.(new Date()) || '';
      opts.populateTaskDeadlineForm?.(null);
      document.getElementById('task-status').value = defaultStatus;
      document.getElementById('task-urgency').value = 'medium';
      document.getElementById('task-subtasks').value = '';
      document.getElementById('task-files').value = '';
      const taskEditorImageInput = document.getElementById('task-description-image-input');
      if (taskEditorImageInput) taskEditorImageInput.value = '';
      document.getElementById('task-share-docs').checked = true;
      const saveTaskBtn = document.getElementById('btn-save-task');
      if (saveTaskBtn) {
        saveTaskBtn.setAttribute('data-action-kind', 'create');
        saveTaskBtn.setAttribute('data-action-label', 'Créer');
        saveTaskBtn.setAttribute('aria-label', 'Créer');
        saveTaskBtn.setAttribute('data-ui-tooltip', 'Créer');
        const saveTaskIcon = saveTaskBtn.querySelector('.taskmda-action-icon, .material-symbols-outlined');
        if (saveTaskIcon) saveTaskIcon.textContent = 'add_circle';
        const saveTaskLabel = saveTaskBtn.querySelector('.taskmda-action-label');
        if (saveTaskLabel) saveTaskLabel.textContent = 'Créer';
      }
      if (standaloneModeInput) standaloneModeInput.value = 'private';
      if (taskThemeInput) taskThemeInput.value = (getCurrentProjectState()?.themes || [])[0] || '';
      opts.syncThemePickerSelectionFromInput?.('task-theme-known', 'task-theme');
      if (taskGroupInput) taskGroupInput.value = '';
      if (taskFeatureInput) taskFeatureInput.value = '';
      if (global.TaskMDARecurrenceUI?.resetRecurrenceForm) global.TaskMDARecurrenceUI.resetRecurrenceForm();
      if (!standaloneTaskMode) opts.refreshTaskGroupSelectionPreview?.(getCurrentProjectState(), effectiveSelectedAssigneeValues);
    }

    async function toggleTaskStatus(taskId) {
      const currentProjectId = getCurrentProjectId();
      if (!currentProjectId) return;
      const stateSnapshot = await opts.getProjectState?.(currentProjectId);
      const task = stateSnapshot?.tasks?.find((t) => t.taskId === taskId);
      if (!task) return;
      if (!opts.canChangeTaskStatus?.(task, stateSnapshot)) return opts.showToast?.('Action non autorisee');
      if (!opts.ensureProjectResourceUnlockedForAction?.(stateSnapshot, opts.LOCK_SCOPE_TASK, task.taskId, 'Changement de statut')?.ok) return;
      const statuses = ['todo', 'en-cours', 'suspendu', 'termine'];
      const currentIndex = statuses.indexOf(task.status);
      const newStatus = statuses[(currentIndex + 1) % statuses.length];
      const transition = opts.buildTaskStatusTransitionChanges?.(task, newStatus, { nowTs: Date.now() });
      const event = opts.createEvent?.(opts.EventTypes?.UPDATE_TASK, currentProjectId, getCurrentUser()?.userId, { taskId, changes: transition?.changes || {} });
      await opts.runWithLoading?.(async () => {
        await opts.publishEvent?.(event);
        if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      });
      if (transition?.recurringRolloverApplied && transition?.nextDueDate) {
        opts.showToast?.('🔁 Tâche récurrente replanifiée au ' + (opts.formatDate?.(transition.nextDueDate) || ''));
      } else {
        opts.showToast?.('✅ Statut mis à jour');
      }
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function markProjectTaskDone(taskId) {
      const currentProjectId = getCurrentProjectId();
      if (!currentProjectId) return;
      const stateSnapshot = await opts.getProjectState?.(currentProjectId);
      const task = stateSnapshot?.tasks?.find((t) => t.taskId === taskId);
      if (!task || (task.status || 'todo') === 'termine') return;
      if (!opts.canChangeTaskStatus?.(task, stateSnapshot)) return opts.showToast?.('Action non autorisee');
      if (!opts.ensureProjectResourceUnlockedForAction?.(stateSnapshot, opts.LOCK_SCOPE_TASK, task.taskId, 'Changement de statut')?.ok) return;
      const transition = opts.buildTaskStatusTransitionChanges?.(task, 'termine', { nowTs: Date.now() });
      const event = opts.createEvent?.(opts.EventTypes?.UPDATE_TASK, currentProjectId, getCurrentUser()?.userId, { taskId, changes: transition?.changes || {} });
      await opts.runWithLoading?.(async () => {
        await opts.publishEvent?.(event);
        if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      });
      if (transition?.recurringRolloverApplied && transition?.nextDueDate) {
        opts.showToast?.('🔁 Tâche récurrente replanifiée au ' + (opts.formatDate?.(transition.nextDueDate) || ''));
      } else {
        opts.showToast?.('✅ Tâche marquée comme réalisée');
      }
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function editTask(taskId) {
      const currentProjectId = getCurrentProjectId();
      if (!currentProjectId) return;
      const stateSnapshot = await opts.getProjectState?.(currentProjectId);
      const task = stateSnapshot?.tasks?.find((t) => t.taskId === taskId);
      if (!task) return;
      if (!opts.canEditTaskInProject?.(task, stateSnapshot)) return opts.showToast?.('Action non autorisee');
      const lockResult = await opts.acquireProjectResourceLock?.(currentProjectId, opts.LOCK_SCOPE_TASK, task.taskId, { scope: 'task-edit' });
      if (!lockResult?.ok) {
        opts.showToast?.(opts.buildLockBlockedMessage?.(lockResult?.lock, 'Tache en cours de modification') || 'Action non autorisee');
        return;
      }
      opts.setActiveTaskEditLock?.({
        projectId: currentProjectId,
        resourceType: opts.LOCK_SCOPE_TASK,
        resourceId: task.taskId,
        lockId: lockResult.lockId
      });
      openTaskModal(task);
    }

    async function deleteTask(taskId) {
      const currentProjectId = getCurrentProjectId();
      if (!currentProjectId) return;
      const stateSnapshot = await opts.getProjectState?.(currentProjectId);
      const task = stateSnapshot?.tasks?.find((t) => t.taskId === taskId);
      if (!task) return;
      if (!opts.canDeleteTaskInProject?.(task, stateSnapshot)) return opts.showToast?.('Action non autorisee');
      if (!opts.ensureProjectResourceUnlockedForAction?.(stateSnapshot, opts.LOCK_SCOPE_TASK, task.taskId, 'Suppression')?.ok) return;
      if (!global.confirm('Supprimer cette tâche ?')) return;
      const event = opts.createEvent?.(opts.EventTypes?.DELETE_TASK, currentProjectId, getCurrentUser()?.userId, { taskId });
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      opts.showToast?.('✅ Tâche supprimée');
      opts.addNotification?.('Tache', 'Une tache a ete supprimee', currentProjectId, { targetView: 'list', linkLabel: 'Ouvrir le projet' });
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function archiveTask(taskId) {
      const currentProjectId = getCurrentProjectId();
      if (!currentProjectId) return;
      const stateSnapshot = await opts.getProjectState?.(currentProjectId);
      const task = stateSnapshot?.tasks?.find((t) => t.taskId === taskId);
      if (!task) return;
      if (!opts.canEditTaskInProject?.(task, stateSnapshot)) return opts.showToast?.('Action non autorisee');
      if (!opts.ensureProjectResourceUnlockedForAction?.(stateSnapshot, opts.LOCK_SCOPE_TASK, task.taskId, 'Archivage')?.ok) return;
      if (!global.confirm('Archiver cette tâche ?')) return;
      const event = opts.createEvent?.(
        opts.EventTypes?.UPDATE_TASK,
        currentProjectId,
        getCurrentUser()?.userId,
        { taskId, changes: { status: 'termine', completedAt: Date.now(), archivedAt: Date.now() } }
      );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      opts.showToast?.('✅ Tâche archivée');
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function toggleSubtask(taskId, subtaskId, done) {
      const currentProjectId = getCurrentProjectId();
      if (!currentProjectId) return;
      const stateSnapshot = await opts.getProjectState?.(currentProjectId);
      const task = stateSnapshot?.tasks?.find((t) => t.taskId === taskId);
      if (!task) return;
      if (!opts.canChangeTaskStatus?.(task, stateSnapshot)) return opts.showToast?.('Action non autorisee');
      const subtasks = (task.subtasks || []).map((st) => st.id === subtaskId ? { ...st, done } : st);
      const event = opts.createEvent?.(opts.EventTypes?.UPDATE_TASK, currentProjectId, getCurrentUser()?.userId, { taskId, changes: { subtasks } });
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function saveTaskFromModal() {
      const currentProjectId = getCurrentProjectId();
      const standaloneTaskMode = getStandaloneTaskMode();
      if (!currentProjectId && !standaloneTaskMode) return;

      const title = String(document.getElementById('task-title')?.value || '').trim();
      if (!title) {
        opts.showToast?.('Le titre est requis');
        return;
      }

      let attachments = [];
      try {
        attachments = await opts.runWithLoading?.(async () => opts.readTaskFiles?.()) || [];
      } catch (error) {
        opts.showToast?.(error?.message || 'Erreur lecture fichiers');
        return;
      }

      const subtasksText = String(document.getElementById('task-subtasks')?.value || '');
      const subtasksParsed = opts.parseSubtasks?.(subtasksText) || [];
      const stateSnapshot = standaloneTaskMode ? null : await opts.getProjectState?.(currentProjectId);
      if (!standaloneTaskMode && !stateSnapshot?.project) {
        opts.showToast?.('Action non autorisee');
        return;
      }

      const editingTaskId = getEditingTaskId();
      const existingTask = (!standaloneTaskMode && editingTaskId)
        ? (stateSnapshot.tasks || []).find((t) => t.taskId === editingTaskId)
        : null;
      if (!standaloneTaskMode) {
        if (existingTask) {
          if (!opts.canEditTaskInProject?.(existingTask, stateSnapshot)) return opts.showToast?.('Action non autorisee');
        } else if (!opts.canCreateTaskInProject?.(stateSnapshot)) {
          return opts.showToast?.('Action non autorisee');
        }
      }

      const groupSelectEl = document.getElementById('task-group');
      const selectedGroupOption = groupSelectEl?.options?.[groupSelectEl.selectedIndex] || null;
      const selectedGroupScope = String(selectedGroupOption?.dataset?.groupScope || '');
      const selectedGroupName = String(selectedGroupOption?.dataset?.groupName || '').trim();
      const rawGroupValue = String(groupSelectEl?.value || '');
      let effectiveState = stateSnapshot;
      let resolvedGroupId = selectedGroupScope === 'project' ? rawGroupValue || null : null;
      let resolvedGroupName = rawGroupValue ? (selectedGroupName || null) : null;
      let autoAddedMembersCount = 0;

      if (!standaloneTaskMode && rawGroupValue) {
        const groupContext = await opts.resolveTaskSelectedGroupContext?.(stateSnapshot, rawGroupValue);
        if (!groupContext) {
          opts.showToast?.('Groupe selectionne introuvable. Rechargez et reessayez.');
          return;
        }
        try {
          const ensured = await opts.runWithLoading?.(async () => opts.ensureTaskGroupAssociationInProject?.(stateSnapshot, groupContext));
          effectiveState = ensured?.state || stateSnapshot;
          resolvedGroupId = ensured?.groupId || null;
          resolvedGroupName = ensured?.groupName || groupContext.groupName || resolvedGroupName;
          autoAddedMembersCount = Number(ensured?.addedMembersCount || 0);
        } catch (error) {
          opts.showToast?.(error?.message || 'Association du groupe impossible');
          return;
        }
      }

      const assigneeSelectEl = document.getElementById('task-assignee');
      const manualAssigneeInput = document.getElementById('task-assignee-manual');
      const selectedAssigneeValues = Array.from(assigneeSelectEl?.selectedOptions || [])
        .map((opt) => String(opt.value || '').trim())
        .filter(Boolean);
      const selectedAssigneesFromMembers = selectedAssigneeValues.map((assigneeValue) => {
        const parsed = opts.parseTaskAssigneeSelectValue?.(assigneeValue) || { kind: 'user', id: assigneeValue };
        const option = Array.from(assigneeSelectEl?.options || []).find((opt) => String(opt.value || '').trim() === assigneeValue);
        if (parsed.kind === 'agent') {
          const agentId = parsed.id;
          const linkedUserId = String(option?.dataset?.userId || '').trim();
          const name = String(option?.dataset?.assigneeName || option?.textContent || '').trim();
          return { agentId: agentId || null, userId: linkedUserId || null, name };
        }
        const userId = parsed.id;
        let name = '';
        if (!standaloneTaskMode) {
          const member = (effectiveState?.members || []).find((m) => m.userId === userId);
          name = member?.displayName || '';
        } else if (userId === getCurrentUser()?.userId) {
          name = getCurrentUser()?.name || '';
        }
        if (!name) name = String(option?.dataset?.assigneeName || option?.textContent || '').trim();
        return { userId, name };
      });
      const manualAssigneeEntries = opts.parseManualAssigneeEntries?.(manualAssigneeInput?.value || '') || [];
      const seenAssignees = new Set();
      const assignees = [...selectedAssigneesFromMembers, ...manualAssigneeEntries.map((entry) => ({
        userId: null,
        name: entry.name,
        email: entry.email || ''
      }))]
        .filter((entry) => entry.userId || entry.name)
        .filter((entry) => {
          const key = `${entry.agentId || ''}|${entry.userId || ''}|${opts.normalizeSearch?.(entry.name || '')}|${String(entry.email || '').toLowerCase()}`;
          if (seenAssignees.has(key)) return false;
          seenAssignees.add(key);
          return true;
        });
      const primaryAssignee = assignees[0] || { userId: null, name: '' };

      const taskDescriptionHtml = opts.getProjectDescriptionHtmlForStorage?.('task-description-editor', 'task-description') || '';
      const taskDescriptionText = String(opts.getProjectDescriptionPlainText?.(taskDescriptionHtml) || '').trim();
      const taskDeadline = opts.readTaskDeadlineFromForm?.() || {};

      const payload = {
        title,
        assignee: primaryAssignee.name || '',
        assigneeUserId: primaryAssignee.userId || null,
        assignees,
        description: taskDescriptionText,
        descriptionHtml: taskDescriptionHtml || '',
        requestDate: document.getElementById('task-request-date')?.value || null,
        dueDate: taskDeadline.dueDate,
        deadlineMode: taskDeadline.deadlineMode,
        deadlineDate: taskDeadline.deadlineDate,
        deadlineMonth: taskDeadline.deadlineMonth,
        deadlineYear: taskDeadline.deadlineYear,
        deadlineStart: taskDeadline.deadlineStart,
        deadlineEnd: taskDeadline.deadlineEnd,
        status: document.getElementById('task-status')?.value || 'todo',
        urgency: document.getElementById('task-urgency')?.value || 'medium',
        theme: String(document.getElementById('task-theme')?.value || '').trim(),
        groupId: resolvedGroupId || null,
        groupName: resolvedGroupName || null,
        featureId: standaloneTaskMode ? null : (String(document.getElementById('task-feature')?.value || '').trim() || null),
        subtasks: existingTask
          ? opts.mergeSubtasksWithExisting?.(existingTask.subtasks || [], subtasksParsed) || subtasksParsed
          : subtasksParsed
      };

      let recurring = null;
      if (global.TaskMDARecurrenceUI?.extractRecurrenceConfig) {
        try {
          recurring = global.TaskMDARecurrenceUI.extractRecurrenceConfig();
        } catch (error) {
          opts.showToast?.(`Erreur de recurrence: ${error.message}`);
          return;
        }
      }
      if (recurring) payload.recurring = recurring;

      if (existingTask) {
        payload.subtasks = opts.mergeSubtasksWithExisting?.(existingTask.subtasks || [], subtasksParsed) || subtasksParsed;
        if (attachments.length > 0) payload.attachments = [...(existingTask.attachments || []), ...attachments];
      } else {
        payload.attachments = attachments;
      }

      if (standaloneTaskMode) {
        const standaloneSharingMode = opts.normalizeSharingMode?.(document.getElementById('task-standalone-mode')?.value || 'private', 'private') || 'private';
        const editingStandaloneTaskId = getEditingStandaloneTaskId();
        const isEditStandalone = Boolean(editingStandaloneTaskId);
        const existingStandalone = isEditStandalone
          ? await opts.getDecrypted?.('globalTasks', editingStandaloneTaskId, 'id')
          : null;
        const mergedStandaloneSubtasks = isEditStandalone
          ? (opts.mergeSubtasksWithExisting?.(existingStandalone?.subtasks || [], subtasksParsed) || subtasksParsed)
          : subtasksParsed;
        const standaloneTask = {
          id: isEditStandalone ? editingStandaloneTaskId : opts.uuidv4?.(),
          title: payload.title,
          assignee: payload.assignee,
          assigneeUserId: payload.assigneeUserId,
          assignees: payload.assignees || [],
          description: payload.description,
          descriptionHtml: payload.descriptionHtml || '',
          requestDate: payload.requestDate,
          dueDate: payload.dueDate,
          deadlineMode: payload.deadlineMode || 'date',
          deadlineDate: payload.deadlineDate || null,
          deadlineMonth: payload.deadlineMonth || null,
          deadlineYear: payload.deadlineYear || null,
          deadlineStart: payload.deadlineStart || null,
          deadlineEnd: payload.deadlineEnd || null,
          status: payload.status,
          urgency: payload.urgency,
          subtasks: mergedStandaloneSubtasks,
          attachments: attachments.length > 0
            ? ([...(existingStandalone?.attachments || []), ...attachments])
            : (existingStandalone?.attachments || payload.attachments || []),
          theme: payload.theme || String(document.getElementById('global-task-theme-known')?.value || '').trim() || 'General',
          groupId: payload.groupId || null,
          groupName: payload.groupName || null,
          featureId: null,
          sharingMode: standaloneSharingMode,
          recurring: recurring || null,
          createdAt: existingStandalone?.createdAt || Date.now(),
          updatedAt: Date.now(),
          archivedAt: existingStandalone?.archivedAt || null
        };
        await opts.runWithLoading?.(async () => {
          await opts.putEncrypted?.('globalTasks', standaloneTask, 'id');
        });
        if (!isEditStandalone) {
          const standaloneFeedPostId = `auto-standalone-task-${standaloneTask.id}`;
          const existingStandalonePost = await opts.getDecrypted?.('globalPosts', standaloneFeedPostId, 'postId');
          if (!existingStandalonePost) {
            const standaloneTaskRef = opts.buildGlobalTaskRef?.({ sourceType: 'standalone', sourceProjectId: null, taskId: null, id: standaloneTask.id });
            const me = getCurrentUser();
            const standaloneAutoPost = {
              postId: standaloneFeedPostId,
              authorUserId: String(me?.userId || ''),
              authorName: String(me?.name || opts.fallbackDirectoryName?.(me?.userId || '')),
              content: `Nouvelle tâche créée: ${standaloneTask.title || 'Tâche'}\nProjet: Hors projet`,
              mentions: [],
              refs: [{ type: 'task', id: standaloneTaskRef, label: `${standaloneTask.title || 'Tâche'} • Hors projet` }],
              createdAt: Number(standaloneTask.createdAt || Date.now()),
              source: opts.getSharedFolderHandle?.() ? 'shared' : 'local',
              isAuto: true,
              autoKind: 'task-created',
              sourceEventId: `standalone:${standaloneTask.id}`
            };
            await opts.putEncrypted?.('globalPosts', standaloneAutoPost, 'postId');
            opts.addKnownGlobalPostId?.(standaloneAutoPost.postId);
            if (opts.getSharedFolderHandle?.()) await opts.writeGlobalFeedPostToSharedFolder?.(standaloneAutoPost);
            if (opts.getWorkspaceMode?.() === 'global' && opts.getGlobalWorkspaceView?.() === 'feed') {
              await opts.renderGlobalFeed?.();
            }
          }
        }
        document.getElementById('modal-new-task')?.classList.add('hidden');
        if (standaloneSharingMode === 'shared' && !opts.getSharedFolderHandle?.()) {
          opts.showToast?.('Visibilite collaborative active: connectez un dossier partage pour synchroniser.');
        }
        opts.showToast?.(isEditStandalone ? 'Tache hors projet mise a jour' : 'Tache hors projet creee');
        opts.addNotification?.('Tache', isEditStandalone ? 'Tache hors projet mise a jour' : 'Nouvelle tache hors projet creee', null, {
          targetType: 'task',
          targetId: standaloneTask.id,
          targetView: 'global-tasks',
          linkLabel: 'Ouvrir les taches'
        });
        setStandaloneTaskMode(false);
        setEditingStandaloneTaskId(null);
        await opts.renderGlobalTasks?.();
        await opts.refreshStats?.();
        return;
      }

      const me = getCurrentUser();
      const event = editingTaskId
        ? opts.createEvent?.(opts.EventTypes?.UPDATE_TASK, currentProjectId, me?.userId, { taskId: editingTaskId, changes: payload })
        : opts.createEvent?.(opts.EventTypes?.CREATE_TASK, currentProjectId, me?.userId, { taskId: opts.uuidv4?.(), createdBy: me?.userId, ...payload });

      await opts.runWithLoading?.(async () => {
        await opts.publishEvent?.(event);
        if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      });

      await opts.releaseActiveTaskEditLock?.();
      document.getElementById('modal-new-task')?.classList.add('hidden');
      opts.showToast?.(editingTaskId ? 'Tache mise a jour' : 'Tache creee');
      if (autoAddedMembersCount > 0) opts.showToast?.(`${autoAddedMembersCount} membre(s) du groupe ajoute(s) au projet`);
      setEditingTaskId(null);
      opts.addNotification?.('Tache', event?.type === opts.EventTypes?.UPDATE_TASK ? 'Tache mise a jour' : 'Nouvelle tache creee', currentProjectId, {
        targetType: 'task',
        targetId: event?.payload?.taskId || null,
        targetView: 'list',
        linkLabel: 'Ouvrir la tache'
      });
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function closeTaskModalAndReset() {
      await opts.releaseActiveTaskEditLock?.();
      const modal = document.getElementById('modal-new-task');
      if (modal) modal.classList.add('hidden');
      setEditingTaskId(null);
      setEditingStandaloneTaskId(null);
      setPendingTaskStatusPrefill(null);
      setStandaloneTaskMode(false);
      const standaloneModeInput = document.getElementById('task-standalone-mode');
      if (standaloneModeInput) standaloneModeInput.value = 'private';
      const taskThemeInput = document.getElementById('task-theme');
      const taskGroupInput = document.getElementById('task-group');
      const taskGroupPendingBox = document.getElementById('task-group-pending-members');
      const taskAssigneeManualInput = document.getElementById('task-assignee-manual');
      const taskAssigneeQuickInput = document.getElementById('task-assignee-quick-input');
      if (taskThemeInput) taskThemeInput.value = '';
      if (taskGroupInput) taskGroupInput.value = '';
      if (taskGroupPendingBox) {
        taskGroupPendingBox.classList.add('hidden');
        taskGroupPendingBox.innerHTML = '';
      }
      opts.setTaskPendingGroupMemberUserIds?.([]);
      if (taskAssigneeManualInput) taskAssigneeManualInput.value = '';
      if (taskAssigneeQuickInput) taskAssigneeQuickInput.value = '';
      opts.populateTaskDeadlineForm?.(null);
      if (global.TaskMDARecurrenceUI?.resetRecurrenceForm) global.TaskMDARecurrenceUI.resetRecurrenceForm();
    }

    async function removeAttachment(taskId, attachmentIndex) {
      const normalizedTaskId = String(taskId || '').trim();
      const normalizedIndex = Number.parseInt(String(attachmentIndex), 10);
      if (!normalizedTaskId || !Number.isFinite(normalizedIndex) || normalizedIndex < 0) return;

      let projectId = String(getCurrentProjectId() || '').trim();
      const detailResolved = getCurrentGlobalTaskDetailResolved();
      if (!projectId && detailResolved?.sourceType === 'project') {
        const ctxTaskId = String(detailResolved?.task?.taskId || '').trim();
        if (ctxTaskId && ctxTaskId === normalizedTaskId) {
          projectId = String(detailResolved?.projectId || '').trim();
        }
      }
      if (!projectId) return;

      const stateSnapshot = await opts.getProjectState?.(projectId);
      const task = stateSnapshot?.tasks?.find((t) => t.taskId === normalizedTaskId);
      if (!task) return;
      if (!opts.canEditTaskInProject?.(task, stateSnapshot)) {
        opts.showToast?.('Action non autorisee');
        return;
      }

      const attachments = [...(task.attachments || [])];
      if (normalizedIndex >= attachments.length) return;
      attachments.splice(normalizedIndex, 1);

      const event = opts.createEvent?.(
        opts.EventTypes?.UPDATE_TASK,
        projectId,
        getCurrentUser()?.userId,
        { taskId: normalizedTaskId, changes: { attachments } }
      );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(projectId, [event]);
      opts.showToast?.('Document supprime');
      if (opts.getWorkspaceMode?.() === 'project' && String(getCurrentProjectId() || '').trim() === projectId) {
        await opts.showProjectDetail?.(projectId);
      } else if (getCurrentGlobalTaskDetailRef()) {
        await opts.openGlobalTaskDetails?.(getCurrentGlobalTaskDetailRef());
      }
    }

    function handleQuickAssigneeAdd() {
      const value = document.getElementById('task-assignee-quick-input')?.value || '';
      opts.addQuickTaskAssignee?.(value);
    }

    function handleQuickAssigneeKeydown(event) {
      if (String(event?.key || '') !== 'Enter') return;
      event.preventDefault();
      opts.addQuickTaskAssignee?.(event?.target?.value || '');
    }

    async function handleTaskGroupChange() {
      if (getStandaloneTaskMode() || !getCurrentProjectState()?.project) return;
      await opts.refreshTaskGroupSelectionPreview?.(getCurrentProjectState());
    }

    function handleTaskDeadlineModeChange(event) {
      opts.setTaskDeadlineModeUi?.(event?.target?.value || 'date');
    }

    async function openTaskThemeManager() {
      await opts.showGlobalThemeManagementModal?.();
    }

    async function confirmTaskConvertFromModal() {
      const taskRef = getPendingTaskConvertRef();
      if (!taskRef) {
        opts.closeTaskConvertModal?.();
        return;
      }
      const projectNameInput = document.getElementById('task-convert-project-name');
      const projectName = String(projectNameInput?.value || '').trim();
      const sharingMode = opts.normalizeSharingMode?.(
        document.getElementById('task-convert-mode')?.value || 'private',
        'private'
      ) || 'private';
      const archiveSource = !!document.getElementById('task-convert-archive-source')?.checked;
      const openProjectAfterConvert = !!document.getElementById('task-convert-open-project')?.checked;
      const errorEl = document.getElementById('task-convert-error');
      if (!projectName) {
        if (errorEl) errorEl.classList.remove('hidden');
        projectNameInput?.focus();
        return;
      }
      if (errorEl) errorEl.classList.add('hidden');
      opts.closeTaskConvertModal?.();
      await opts.convertTaskToProject?.(taskRef, {
        __fromModal: true,
        projectName,
        sharingMode,
        archiveSource,
        openProjectAfterConvert
      });
    }

    function handleTaskConvertNameKeydown(event) {
      if (String(event?.key || '') !== 'Enter') return;
      event.preventDefault();
      const confirmBtn = document.getElementById('btn-task-convert-confirm');
      if (confirmBtn) {
        confirmBtn.click();
        return;
      }
      void confirmTaskConvertFromModal();
    }

    function closeTaskConvertModal() {
      const modal = document.getElementById('modal-task-convert');
      if (!modal) return;
      modal.classList.add('hidden');
      setPendingTaskConvertRef(null);
      const errorEl = document.getElementById('task-convert-error');
      if (errorEl) errorEl.classList.add('hidden');
    }

    async function openTaskConvertModal(taskRef, prefill) {
      const safePrefill = prefill && typeof prefill === 'object' ? prefill : {};
      const modal = document.getElementById('modal-task-convert');
      if (!modal) {
        await opts.convertTaskToProject?.(taskRef, { ...safePrefill, __fromModal: true });
        return;
      }
      const resolved = await opts.resolveGlobalTaskFromRef?.(taskRef);
      if (!resolved?.task) return opts.showToast?.('Tache introuvable');
      const task = resolved.task;
      const sourceType = resolved.sourceType;
      const sourceState = sourceType === 'project' ? resolved.state : null;
      if (sourceType === 'project' && !opts.canEditTaskInProject?.(task, sourceState)) {
        opts.showToast?.('Action non autorisee');
        return;
      }

      const suggestedName = String(task.title || '').trim() || 'Nouveau projet';
      const sharingMode = opts.normalizeSharingMode?.(
        safePrefill?.sharingMode || task.sharingMode || sourceState?.project?.sharingMode || 'private',
        'private'
      ) || 'private';
      const sourceProjectName = sourceType === 'project'
        ? String(sourceState?.project?.name || '').trim()
        : 'Hors projet';

      const sourceLabelEl = document.getElementById('task-convert-source-label');
      const projectNameInput = document.getElementById('task-convert-project-name');
      const modeSelect = document.getElementById('task-convert-mode');
      const archiveCheckbox = document.getElementById('task-convert-archive-source');
      const openCheckbox = document.getElementById('task-convert-open-project');
      const errorEl = document.getElementById('task-convert-error');

      if (sourceLabelEl) sourceLabelEl.textContent = `${String(task.title || 'Tâche').trim()} • ${sourceProjectName}`;
      if (projectNameInput) projectNameInput.value = String(safePrefill?.projectName || suggestedName);
      if (modeSelect) modeSelect.value = sharingMode;
      if (archiveCheckbox) archiveCheckbox.checked = safePrefill?.archiveSource !== false;
      if (openCheckbox) openCheckbox.checked = safePrefill?.openProjectAfterConvert !== false;
      if (errorEl) errorEl.classList.add('hidden');

      setPendingTaskConvertRef(taskRef);
      modal.classList.remove('hidden');
      requestAnimationFrame(() => {
        projectNameInput?.focus();
        projectNameInput?.select();
      });
    }

    return {
      openProjectTaskCreateModalWithStatus,
      openGlobalTaskCreateModalWithStatus,
      openTaskModal,
      toggleTaskStatus,
      markProjectTaskDone,
      editTask,
      deleteTask,
      archiveTask,
      toggleSubtask,
      saveTaskFromModal,
      closeTaskModalAndReset,
      handleQuickAssigneeAdd,
      handleQuickAssigneeKeydown,
      handleTaskGroupChange,
      handleTaskDeadlineModeChange,
      openTaskThemeManager,
      removeAttachment,
      confirmTaskConvertFromModal,
      handleTaskConvertNameKeydown,
      closeTaskConvertModal,
      openTaskConvertModal
    };
  }

  global.TaskMDATaskLifecycleDomain = {
    createModule
  };
})(window);
