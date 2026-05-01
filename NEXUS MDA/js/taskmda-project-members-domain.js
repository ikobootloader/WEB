(function initTaskMdaProjectMembersDomainModule(global) {
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

    function getSelectedUserGroupId() {
      return typeof state.getSelectedUserGroupId === 'function' ? state.getSelectedUserGroupId() : null;
    }

    function setSelectedUserGroupId(value) {
      if (typeof state.setSelectedUserGroupId === 'function') {
        state.setSelectedUserGroupId(value || null);
      }
    }

    function getSelectedProjectGroupId() {
      return typeof state.getSelectedProjectGroupId === 'function' ? state.getSelectedProjectGroupId() : null;
    }

    function setSelectedProjectGroupId(value) {
      if (typeof state.setSelectedProjectGroupId === 'function') {
        state.setSelectedProjectGroupId(value || null);
      }
    }

    async function addProjectMember() {
      const currentProjectId = getCurrentProjectId();
      const currentProjectState = getCurrentProjectState();
      if (!currentProjectId || !currentProjectState) return;
      if (!opts.canManageProjectCollaboration?.(currentProjectState)) {
        opts.showToast?.('Action non autorisee');
        return;
      }

      const input = document.getElementById('member-name-input');
      const roleInput = document.getElementById('member-role-input');
      const name = String(input?.value || '').trim();
      const selectedRoleKey = String(roleInput?.value || 'member').trim() || 'member';
      const role = opts.getProjectRoleMeta?.(selectedRoleKey)?.roleKey || 'member';
      const targetRoleBase = opts.normalizeProjectRole?.(selectedRoleKey) || 'member';
      const myRole = opts.normalizeProjectRole?.(opts.getMyProjectRole?.(currentProjectState)) || 'member';
      if (myRole === 'manager' && targetRoleBase !== 'member') {
        opts.showToast?.('Action non autorisee');
        return;
      }
      if (!name) {
        opts.showToast?.('Saisissez le nom du membre');
        input?.focus();
        return;
      }

      const users = await opts.getAllDecrypted?.('users', 'userId') || [];
      const directoryUsers = await opts.getAllDecrypted?.('directoryUsers', 'userId') || [];
      const byName = (entry) => opts.normalizeSearch?.(entry?.name || '') === opts.normalizeSearch?.(name);
      let user = users.find(byName);
      const directoryUser = directoryUsers.find(byName);
      if (!user && directoryUser) {
        user = {
          userId: directoryUser.userId,
          name: directoryUser.name,
          email: directoryUser.email || '',
          createdAt: Date.now()
        };
        await opts.putEncrypted?.('users', user, 'userId');
      }
      if (!user) {
        user = { userId: opts.uuidv4?.() || String(Date.now()), name, createdAt: Date.now() };
        await opts.putEncrypted?.('users', user, 'userId');
      }

      await opts.upsertDirectoryUser?.({
        userId: user.userId,
        name: user.name,
        email: user.email || '',
        source: 'member_add',
        lastSeenAt: Date.now()
      });

      const exists = (currentProjectState.members || []).some((m) => m.userId === user.userId);
      if (exists) {
        opts.showToast?.('Ce membre est déjà dans le projet');
        return;
      }

      const currentUser = getCurrentUser();
      const event = opts.createEvent?.(
        opts.EventTypes?.ADD_MEMBER,
        currentProjectId,
        currentUser?.userId,
        { userId: user.userId, role, displayName: user.name }
      );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) {
        void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      }

      if (input) input.value = '';
      opts.showToast?.('Membre ajouté');
      opts.addNotification?.('Membre', `${user.name} a ete ajoute au projet`, currentProjectId);
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function removeProjectMember(userId) {
      const currentProjectId = getCurrentProjectId();
      const currentProjectState = getCurrentProjectState();
      const currentUser = getCurrentUser();
      if (!currentProjectId || !currentProjectState || !userId) return;
      if (userId === currentUser?.userId) {
        opts.showToast?.('Vous ne pouvez pas vous retirer vous-même');
        return;
      }

      if (!opts.canManageProjectCollaboration?.(currentProjectState)) {
        opts.showToast?.('Action non autorisee');
        return;
      }

      const target = (currentProjectState.members || []).find((m) => m.userId === userId);
      if (!target) return;
      const myRole = opts.normalizeProjectRole?.(opts.getMyProjectRole?.(currentProjectState)) || 'member';
      const targetRole = opts.normalizeProjectRole?.(target.role) || 'member';
      if (myRole === 'manager' && targetRole !== 'member') {
        opts.showToast?.('Action non autorisee');
        return;
      }
      if (!global.confirm(`Retirer ${target.displayName || userId} du projet ?`)) return;

      const event = opts.createEvent?.(
        opts.EventTypes?.REMOVE_MEMBER,
        currentProjectId,
        currentUser?.userId,
        { userId }
      );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) {
        void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event], { ensureRegistered: true });
      }
      opts.showToast?.('Membre retiré');
      opts.addNotification?.('Membre', 'Un membre a ete retire du projet', currentProjectId);
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function createUserGroup() {
      const currentProjectId = getCurrentProjectId();
      const currentProjectState = getCurrentProjectState();
      const currentUser = getCurrentUser();
      if (!currentProjectId || !currentProjectState) return;
      if (!opts.canManageProjectCollaboration?.(currentProjectState)) {
        opts.showToast?.('Action non autorisee');
        return;
      }
      const nameInput = document.getElementById('user-group-name-input');
      const membersSelect = document.getElementById('user-group-members-input');
      const name = String(nameInput?.value || '').trim();
      if (!name) {
        opts.showToast?.('Nom de groupe utilisateurs requis');
        return;
      }
      const exists = (currentProjectState.userGroups || []).some(
        (g) => opts.normalizeSearch?.(g.name) === opts.normalizeSearch?.(name)
      );
      if (exists) {
        opts.showToast?.('Ce groupe utilisateurs existe deja');
        return;
      }
      const selectedIds = Array.from(membersSelect?.selectedOptions || []).map((o) => o.value).filter(Boolean);
      const event = opts.createEvent?.(
        opts.EventTypes?.CREATE_USER_GROUP,
        currentProjectId,
        currentUser?.userId,
        { groupId: opts.uuidv4?.() || String(Date.now()), name, memberUserIds: selectedIds }
      );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      if (nameInput) nameInput.value = '';
      opts.showToast?.('Groupe utilisateurs cree');
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function updateUserGroupSelection() {
      const currentProjectId = getCurrentProjectId();
      const currentProjectState = getCurrentProjectState();
      const currentUser = getCurrentUser();
      const selectedUserGroupId = getSelectedUserGroupId();
      if (!currentProjectId || !currentProjectState || !selectedUserGroupId) return;
      if (!opts.canManageProjectCollaboration?.(currentProjectState)) {
        opts.showToast?.('Action non autorisee');
        return;
      }
      const exists = (currentProjectState.userGroups || []).some((g) => g.groupId === selectedUserGroupId);
      if (!exists) {
        opts.showToast?.('Selectionnez un groupe utilisateurs');
        return;
      }
      const membersSelect = document.getElementById('user-group-members-input');
      const selectedIds = Array.from(membersSelect?.selectedOptions || []).map((o) => o.value).filter(Boolean);
      const event = opts.createEvent?.(
        opts.EventTypes?.UPDATE_USER_GROUP,
        currentProjectId,
        currentUser?.userId,
        { groupId: selectedUserGroupId, changes: { memberUserIds: [...new Set(selectedIds)] } }
      );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      opts.showToast?.('Groupe utilisateurs mis a jour');
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function deleteUserGroup(groupId) {
      const currentProjectId = getCurrentProjectId();
      const currentProjectState = getCurrentProjectState();
      const currentUser = getCurrentUser();
      if (!currentProjectId || !currentProjectState || !groupId) return;
      if (!opts.canManageProjectCollaboration?.(currentProjectState)) {
        opts.showToast?.('Action non autorisee');
        return;
      }
      const group = (currentProjectState.userGroups || []).find((g) => g.groupId === groupId);
      if (!group) return;
      if (!global.confirm(`Supprimer le groupe utilisateurs "${group.name}" ?`)) return;
      const event = opts.createEvent?.(
        opts.EventTypes?.DELETE_USER_GROUP,
        currentProjectId,
        currentUser?.userId,
        { groupId }
      );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      if (getSelectedUserGroupId() === groupId) setSelectedUserGroupId(null);
      opts.showToast?.('Groupe utilisateurs supprime');
      await opts.showProjectDetail?.(currentProjectId);
    }

    function selectUserGroup(groupId) {
      setSelectedUserGroupId(groupId || null);
      opts.renderProjectUserGroups?.(getCurrentProjectState());
    }

    async function sendInvitationEmail(inviteId) {
      const currentProjectId = getCurrentProjectId();
      const currentProjectState = getCurrentProjectState();
      const currentUser = getCurrentUser();
      if (!currentProjectId) return;
      if (!opts.canManageProjectCollaboration?.(currentProjectState)) {
        opts.showToast?.('Seuls Propriétaire/Manager peuvent envoyer des invitations');
        return;
      }
      const state = await opts.getProjectState?.(currentProjectId);
      const invite = (state?.invites || []).find((i) => i.inviteId === inviteId);
      if (!invite) return;

      const projectName = state?.project?.name || 'Projet';
      const roleLabel = opts.getProjectRoleLabel?.(invite.role) || 'membre';
      const typeLabel = invite.inviteType === 'agent' ? 'agent' : 'utilisateur';
      const subject = `[NEXUS MDA] Invitation projet: ${projectName}`;
      const body = [
        `Bonjour ${invite.displayName || ''},`,
        '',
        `Vous êtes invité(e) en tant que ${typeLabel} (${roleLabel}) sur le projet "${projectName}".`,
        '',
        'Merci de confirmer votre disponibilité et votre prise en charge.',
        '',
        `Envoyé par: ${currentUser?.name || 'Equipe projet'}`,
        `Date: ${new Date().toLocaleDateString('fr-FR')}`
      ].join('\n');

      opts.openMailto?.({ to: [invite.email], subject, body });

      const event = opts.createEvent?.(
        opts.EventTypes?.UPDATE_INVITE,
        currentProjectId,
        currentUser?.userId,
        { inviteId, changes: { status: 'sent', lastSentAt: Date.now() } }
      );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function updateInviteStatus(inviteId, status) {
      const currentProjectId = getCurrentProjectId();
      const currentProjectState = getCurrentProjectState();
      const currentUser = getCurrentUser();
      if (!currentProjectId || !inviteId) return;
      if (!opts.canManageProjectCollaboration?.(currentProjectState)) {
        opts.showToast?.('Seuls Propriétaire/Manager peuvent mettre à jour les invitations');
        return;
      }
      const normalized = ['pending', 'sent', 'accepted', 'declined'].includes(status) ? status : 'pending';
      const invite = (currentProjectState?.invites || []).find((i) => i.inviteId === inviteId);
      const myRole = opts.normalizeProjectRole?.(opts.getMyProjectRole?.(currentProjectState)) || 'member';
      if (normalized === 'accepted' && myRole === 'manager' && (opts.normalizeProjectRole?.(invite?.role) || 'member') !== 'member') {
        opts.showToast?.('Action non autorisee');
        return;
      }
      const event = opts.createEvent?.(
        opts.EventTypes?.UPDATE_INVITE,
        currentProjectId,
        currentUser?.userId,
        { inviteId, changes: { status: normalized } }
      );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      if (normalized === 'accepted' && invite) {
        const users = await opts.getAllDecrypted?.('users', 'userId') || [];
        let user = users.find((u) => opts.normalizeSearch?.(u.name) === opts.normalizeSearch?.(invite.displayName));
        if (!user) {
          user = {
            userId: opts.uuidv4?.() || String(Date.now()),
            name: invite.displayName,
            email: invite.email,
            createdAt: Date.now()
          };
          await opts.putEncrypted?.('users', user, 'userId');
        }
        await opts.upsertDirectoryUser?.({
          userId: user.userId,
          name: user.name,
          email: user.email || '',
          source: 'invite_accept',
          lastSeenAt: Date.now()
        });
        const memberExists = (currentProjectState?.members || []).some((m) => m.userId === user.userId);
        if (!memberExists) {
          const memberEvent = opts.createEvent?.(
            opts.EventTypes?.ADD_MEMBER,
            currentProjectId,
            currentUser?.userId,
            { userId: user.userId, role: invite.role || 'member', displayName: user.name }
          );
          await opts.publishEvent?.(memberEvent);
          if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [memberEvent]);
        }
      }
      opts.showToast?.(`Invitation marquée: ${normalized}`);
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function addProjectInvite() {
      const currentProjectId = getCurrentProjectId();
      const currentProjectState = getCurrentProjectState();
      const currentUser = getCurrentUser();
      if (!currentProjectId || !currentProjectState) return;
      if (!opts.canManageProjectCollaboration?.(currentProjectState)) {
        opts.showToast?.('Seuls Propriétaire/Manager peuvent inviter');
        return;
      }

      const nameInput = document.getElementById('invite-name-input');
      const emailInput = document.getElementById('invite-email-input');
      const typeInput = document.getElementById('invite-type-input');
      const roleInput = document.getElementById('invite-role-input');
      const displayName = String(nameInput?.value || '').trim();
      const email = String(emailInput?.value || '').trim().toLowerCase();
      const inviteType = String(typeInput?.value || 'user').trim();
      const selectedRoleKey = String(roleInput?.value || 'member').trim() || 'member';
      const role = opts.getProjectRoleMeta?.(selectedRoleKey)?.roleKey || 'member';
      const targetRoleBase = opts.normalizeProjectRole?.(selectedRoleKey) || 'member';
      const myRole = opts.normalizeProjectRole?.(opts.getMyProjectRole?.(currentProjectState)) || 'member';
      if (myRole === 'manager' && targetRoleBase !== 'member') {
        opts.showToast?.('Action non autorisee');
        return;
      }

      if (!displayName) {
        opts.showToast?.('Nom invité requis');
        return;
      }
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailOk) {
        opts.showToast?.('Email professionnel invalide');
        return;
      }
      const exists = (currentProjectState.invites || []).some((inv) => opts.normalizeSearch?.(inv.email) === opts.normalizeSearch?.(email));
      if (exists) {
        opts.showToast?.('Cette adresse est déjà invitée');
        return;
      }

      const event = opts.createEvent?.(
        opts.EventTypes?.CREATE_INVITE,
        currentProjectId,
        currentUser?.userId,
        {
          inviteId: opts.uuidv4?.() || String(Date.now()),
          displayName,
          email,
          inviteType: inviteType === 'agent' ? 'agent' : 'user',
          role,
          status: 'pending'
        }
      );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);

      if (nameInput) nameInput.value = '';
      if (emailInput) emailInput.value = '';
      opts.showToast?.('Invitation créée');
      opts.addNotification?.('Invitation', `${displayName} invité(e)`, currentProjectId);
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function createProjectGroup() {
      const currentProjectId = getCurrentProjectId();
      const currentProjectState = getCurrentProjectState();
      const currentUser = getCurrentUser();
      if (!currentProjectId || !currentProjectState) return;
      if (!opts.canManageProjectCollaboration?.(currentProjectState)) {
        opts.showToast?.('Seuls Propriétaire/Manager peuvent créer des groupes');
        return;
      }
      const nameInput = document.getElementById('group-name-input');
      const descInput = document.getElementById('group-description-input');
      const membersSelect = document.getElementById('group-members-input');
      const name = String(nameInput?.value || '').trim();
      const description = String(descInput?.value || '').trim();
      const selectedIds = Array.from(membersSelect?.selectedOptions || []).map((o) => o.value).filter(Boolean);
      if (!name) {
        opts.showToast?.('Nom de groupe requis');
        return;
      }
      const selectedProjectGroupId = getSelectedProjectGroupId();
      const editGroup = selectedProjectGroupId
        ? (currentProjectState.groups || []).find((g) => g.groupId === selectedProjectGroupId)
        : null;
      const exists = (currentProjectState.groups || []).some(
        (g) => opts.normalizeSearch?.(g.name) === opts.normalizeSearch?.(name) && (!editGroup || g.groupId !== editGroup.groupId)
      );
      if (exists) {
        opts.showToast?.('Ce groupe existe déjà');
        return;
      }

      const groupId = editGroup?.groupId || (opts.uuidv4?.() || String(Date.now()));
      if (editGroup) {
        const event = opts.createEvent?.(
          opts.EventTypes?.UPDATE_GROUP,
          currentProjectId,
          currentUser?.userId,
          { groupId, changes: { name, description } }
        );
        await opts.publishEvent?.(event);
        if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      } else {
        const event = opts.createEvent?.(
          opts.EventTypes?.CREATE_GROUP,
          currentProjectId,
          currentUser?.userId,
          { groupId, name, description }
        );
        await opts.publishEvent?.(event);
        if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      }

      const existingUserGroup = (currentProjectState.userGroups || []).find(
        (g) => g.groupId === groupId || opts.normalizeSearch?.(g.name) === opts.normalizeSearch?.(editGroup?.name || name)
      );
      if (existingUserGroup) {
        const eventUserGroupUpdate = opts.createEvent?.(
          opts.EventTypes?.UPDATE_USER_GROUP,
          currentProjectId,
          currentUser?.userId,
          { groupId: existingUserGroup.groupId, changes: { memberUserIds: [...new Set(selectedIds)], name, description } }
        );
        await opts.publishEvent?.(eventUserGroupUpdate);
        if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [eventUserGroupUpdate]);
      } else {
        const eventUserGroupCreate = opts.createEvent?.(
          opts.EventTypes?.CREATE_USER_GROUP,
          currentProjectId,
          currentUser?.userId,
          { groupId, name, memberUserIds: [...new Set(selectedIds)] }
        );
        await opts.publishEvent?.(eventUserGroupCreate);
        if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [eventUserGroupCreate]);
      }

      const refreshedAfterGroupSave = await opts.getProjectState?.(currentProjectId, { ignoreAccessCheck: true });
      const savedGroup = (refreshedAfterGroupSave?.groups || []).find((g) => g.groupId === groupId) || { name, description };
      const savedLinkedUserGroup = (refreshedAfterGroupSave?.userGroups || []).find(
        (ug) => ug.groupId === groupId || opts.normalizeSearch?.(ug.name) === opts.normalizeSearch?.(savedGroup.name || name)
      );
      const savedMemberUserIds = Array.from(
        new Set((savedLinkedUserGroup?.memberUserIds || selectedIds).map((id) => String(id || '').trim()).filter(Boolean))
      );
      await opts.upsertGlobalGroup?.({
        name: savedGroup.name || name,
        description: savedGroup.description || description,
        memberUserIds: savedMemberUserIds,
        projectId: currentProjectId
      });
      await opts.refreshGlobalTaxonomyCache?.();
      if (nameInput) nameInput.value = '';
      if (descInput) descInput.value = '';
      if (membersSelect) {
        Array.from(membersSelect.options || []).forEach((opt) => {
          opt.selected = false;
        });
      }
      setSelectedProjectGroupId(null);
      opts.showToast?.(editGroup ? 'Groupe modifié' : 'Groupe créé');
      opts.addNotification?.('Groupe', editGroup ? `Groupe ${name} modifié` : `Groupe ${name} créé`, currentProjectId);
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function deleteProjectGroup(groupId) {
      const currentProjectId = getCurrentProjectId();
      const currentProjectState = getCurrentProjectState();
      const currentUser = getCurrentUser();
      if (!currentProjectId || !currentProjectState || !groupId) return;
      if (!opts.canManageProjectCollaboration?.(currentProjectState)) {
        opts.showToast?.('Seuls Propriétaire/Manager peuvent supprimer des groupes');
        return;
      }
      const groupName = opts.getGroupNameById?.(currentProjectState, groupId) || 'ce groupe';
      if (!global.confirm(`Supprimer le groupe "${groupName}" ?`)) return;
      const event = opts.createEvent?.(
        opts.EventTypes?.DELETE_GROUP,
        currentProjectId,
        currentUser?.userId,
        { groupId }
      );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      const linkedUserGroups = (currentProjectState.userGroups || []).filter(
        (g) => g.groupId === groupId || opts.normalizeSearch?.(g.name) === opts.normalizeSearch?.(groupName)
      );
      for (const userGroup of linkedUserGroups) {
        const userGroupDeleteEvent = opts.createEvent?.(
          opts.EventTypes?.DELETE_USER_GROUP,
          currentProjectId,
          currentUser?.userId,
          { groupId: userGroup.groupId }
        );
        await opts.publishEvent?.(userGroupDeleteEvent);
        if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [userGroupDeleteEvent]);
      }
      opts.showToast?.('Groupe supprimé');
      await opts.showProjectDetail?.(currentProjectId);
    }

    function selectProjectGroup(groupId) {
      setSelectedProjectGroupId(groupId || null);
      opts.renderProjectGroups?.(getCurrentProjectState());
      const membersSelect = document.getElementById('group-members-input');
      if (membersSelect) membersSelect.focus();
    }

    async function updateProjectGroupMembers() {
      const currentProjectId = getCurrentProjectId();
      const currentProjectState = getCurrentProjectState();
      const currentUser = getCurrentUser();
      const selectedProjectGroupId = getSelectedProjectGroupId();
      if (!currentProjectId || !currentProjectState || !selectedProjectGroupId) return;
      if (!opts.canManageProjectCollaboration?.(currentProjectState)) {
        opts.showToast?.('Action non autorisee');
        return;
      }
      const group = (currentProjectState.groups || []).find((g) => g.groupId === selectedProjectGroupId);
      if (!group) {
        opts.showToast?.('Sélectionnez un groupe');
        return;
      }
      const membersSelect = document.getElementById('group-members-input');
      const selectedIds = Array.from(membersSelect?.selectedOptions || []).map((o) => o.value).filter(Boolean);
      const linked = (currentProjectState.userGroups || []).find(
        (ug) => ug.groupId === group.groupId || opts.normalizeSearch?.(ug.name) === opts.normalizeSearch?.(group.name)
      );
      const event = linked
        ? opts.createEvent?.(
            opts.EventTypes?.UPDATE_USER_GROUP,
            currentProjectId,
            currentUser?.userId,
            { groupId: linked.groupId, changes: { memberUserIds: [...new Set(selectedIds)], name: group.name } }
          )
        : opts.createEvent?.(
            opts.EventTypes?.CREATE_USER_GROUP,
            currentProjectId,
            currentUser?.userId,
            { groupId: group.groupId, name: group.name, memberUserIds: [...new Set(selectedIds)] }
          );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      opts.showToast?.('Membres du groupe mis à jour');
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function addProjectTheme() {
      const currentProjectId = getCurrentProjectId();
      const currentProjectState = getCurrentProjectState();
      const currentUser = getCurrentUser();
      if (!currentProjectId || !currentProjectState) return;
      if (!opts.canManageProjectCollaboration?.(currentProjectState)) {
        opts.showToast?.('Seuls Propriétaire/Manager peuvent gérer les thèmes');
        return;
      }
      const input = document.getElementById('theme-name-input');
      const theme = String(input?.value || '').trim();
      if (!theme) {
        opts.showToast?.('Thématique requise');
        return;
      }
      const exists = (currentProjectState.themes || []).some(
        (t) => opts.normalizeSearch?.(t) === opts.normalizeSearch?.(theme)
      );
      if (exists) {
        opts.showToast?.('Thématique déjà présente');
        return;
      }
      const event = opts.createEvent?.(
        opts.EventTypes?.ADD_THEME,
        currentProjectId,
        currentUser?.userId,
        { theme }
      );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      await opts.upsertGlobalTheme?.(theme);
      await opts.refreshGlobalTaxonomyCache?.();
      if (input) input.value = '';
      opts.showToast?.('Thématique ajoutée');
      await opts.showProjectDetail?.(currentProjectId);
    }

    async function removeProjectTheme(theme) {
      const currentProjectId = getCurrentProjectId();
      const currentProjectState = getCurrentProjectState();
      const currentUser = getCurrentUser();
      if (!currentProjectId || !currentProjectState || !theme) return;
      if (!opts.canManageProjectCollaboration?.(currentProjectState)) {
        opts.showToast?.('Seuls Propriétaire/Manager peuvent gérer les thèmes');
        return;
      }
      const event = opts.createEvent?.(
        opts.EventTypes?.REMOVE_THEME,
        currentProjectId,
        currentUser?.userId,
        { theme }
      );
      await opts.publishEvent?.(event);
      if (opts.getSharedFolderHandle?.()) void opts.syncProjectEventsToSharedSpace?.(currentProjectId, [event]);
      opts.showToast?.('Thématique retirée');
      await opts.showProjectDetail?.(currentProjectId);
    }

    return {
      addProjectMember,
      removeProjectMember,
      createUserGroup,
      updateUserGroupSelection,
      deleteUserGroup,
      selectUserGroup,
      sendInvitationEmail,
      updateInviteStatus,
      addProjectInvite,
      createProjectGroup,
      deleteProjectGroup,
      selectProjectGroup,
      updateProjectGroupMembers,
      addProjectTheme,
      removeProjectTheme
    };
  }

  global.TaskMDAProjectMembersDomain = {
    createModule
  };
}(window));
