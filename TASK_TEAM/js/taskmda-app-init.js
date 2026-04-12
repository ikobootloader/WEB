(function initTaskMdaAppInitModule(global) {
  'use strict';

  function createModule(options) {
    const opts = options || {};
    const state = opts.state || {};

    function setCurrentUser(value) {
      if (typeof state.setCurrentUser === 'function') state.setCurrentUser(value);
    }

    function getCurrentUser() {
      return typeof state.getCurrentUser === 'function' ? state.getCurrentUser() : null;
    }

    function setNotifiedCollaboratorEventIds(value) {
      if (typeof state.setNotifiedCollaboratorEventIds === 'function') {
        state.setNotifiedCollaboratorEventIds(value);
      }
    }

    function setDueReminderMemory(value) {
      if (typeof state.setDueReminderMemory === 'function') state.setDueReminderMemory(value);
    }

    function resetSessionState() {
      if (typeof state.resetSessionState === 'function') state.resetSessionState();
    }

    async function initApp() {
      opts.debugLog?.('Initializing NEXUS MDA...');

      try {
        opts.showLoading?.(true);

        if (global.TaskMDACrypto && global.TaskMDACrypto.isUnlocked()) {
          const encryptedData = await global.TaskMDACrypto.loadEncryptedData();
          if (encryptedData && encryptedData.config) {
            if (encryptedData.config.userId) {
              localStorage.setItem('userId', encryptedData.config.userId);
            }
            if (encryptedData.config.clientId) {
              localStorage.setItem('clientId', encryptedData.config.clientId);
            }
          }
        }

        await opts.initDatabase?.();
        await opts.refreshGlobalTaxonomyCache?.();

        const currentUser = await opts.initializeCurrentUser?.();
        setCurrentUser(currentUser);
        const recoveryStats = await opts.recoverLocalProjectsFromEvents?.();
        if ((recoveryStats?.rebuilt || 0) > 0) {
          opts.showToast?.(`${recoveryStats.rebuilt} projet(s) restauré(s) localement`);
        }
        await opts.refreshCurrentUserIdAliases?.();
        opts.refreshGlobalMessageHiddenGroupsForCurrentUser?.();
        await opts.upsertDirectoryUser?.({
          userId: currentUser?.userId,
          name: currentUser?.name,
          source: 'current_user',
          lastSeenAt: Date.now()
        });
        await opts.refreshDirectoryFromKnownSources?.();
        if (global.TaskMDACrypto && global.TaskMDACrypto.isUnlocked()) {
          const encryptedData = await global.TaskMDACrypto.loadEncryptedData();
          if (encryptedData?.config?.userName && currentUser) {
            currentUser.name = encryptedData.config.userName;
            setCurrentUser(currentUser);
          }
          const encryptedHistory = Array.isArray(encryptedData?.config?.userIdHistory)
            ? encryptedData.config.userIdHistory
            : [];
          if (encryptedHistory.length > 0) {
            try {
              const existing = JSON.parse(localStorage.getItem('taskmda_user_id_history') || '[]');
              const merged = Array.from(new Set([...(Array.isArray(existing) ? existing : []), ...encryptedHistory]
                .map((id) => String(id || '').trim())
                .filter(Boolean)));
              localStorage.setItem('taskmda_user_id_history', JSON.stringify(merged));
            } catch (_) {
              localStorage.setItem(
                'taskmda_user_id_history',
                JSON.stringify(Array.from(new Set(encryptedHistory.map((id) => String(id || '').trim()).filter(Boolean))))
              );
            }
          }
          await opts.refreshCurrentUserIdAliases?.();
        }
        await opts.loadAppBrandingConfig?.({ ensureRemote: false });
        await opts.loadViewOptions?.();
        await opts.loadUxMetrics?.();
        opts.updateUserInfo?.();
        opts.loadNotifications?.();
        setNotifiedCollaboratorEventIds(opts.loadNotifiedEventIds?.() || new Set());
        setDueReminderMemory(opts.loadReminderMemory?.() || {});
        opts.renderNotifications?.();

        await opts.saveEncryptedConfig?.();
        opts.showMainContent?.();
        opts.startIconButtonTitleObserver?.();
        opts.showDashboard?.();
        opts.updateSyncStatus?.('disconnected');
        await opts.tryConnectSavedFolder?.();
        if (!opts.isFileSystemSupported?.()) {
          opts.showToast?.('File System Access API non supporte: visibilite privee uniquement');
        }
        opts.showLoading?.(false);
        opts.debugLog?.('App initialized');
        return;
      } catch (error) {
        console.error('Init error:', error);
        opts.showSetupError?.(`Erreur: ${error.message}`);
        opts.showLoading?.(false);
      }
    }

    async function handleSelectFolder() {
      try {
        opts.showLoading?.(true);
        const handle = await opts.selectSharedFolder?.();
        const shouldReload = opts.askCollaborativeReload?.('liaison manuelle');
        await opts.connectSharedFolderHandle?.(handle, true, { rebuildLocal: shouldReload });
        opts.showLoading?.(false);
      } catch (error) {
        if (error?.name === 'AbortError') {
          console.info("Selection de dossier annulee par l'utilisateur.");
          opts.showToast?.('Selection du dossier annulee');
          opts.showLoading?.(false);
          return;
        }

        console.error('Error:', error);
        opts.showToast?.(`Erreur dossier partage: ${error.message}`);
        opts.showLoading?.(false);
      }
    }

    async function handleContinueWithoutFolder() {
      try {
        await opts.disconnectSharedFolder?.();
      } catch (error) {
        console.error('Error:', error);
        opts.showToast?.(`Erreur deconnexion dossier: ${error.message}`);
      }
    }

    async function handleLogout() {
      if (!global.confirm("Se deconnecter de l'application maintenant ?")) return;
      try {
        opts.closeMobileSidebar?.();
        opts.toggleNotificationsPanel?.(false);
        opts.stopPolling?.();
        opts.stopDueReminders?.();
        opts.stopBackupReminders?.();
        resetSessionState();

        if (global.TaskMDACrypto) {
          if (typeof global.TaskMDACrypto.lock === 'function') {
            global.TaskMDACrypto.lock();
          }
          global.TaskMDACrypto.showLockScreen('unlock');
          const lockBtn = document.getElementById('lockBtn');
          if (lockBtn) {
            lockBtn.onclick = () => {
              global.TaskMDACrypto.submitPassword(async () => {
                await initApp();
              });
            };
          }
        }

        document.getElementById('setup-screen')?.classList.add('hidden');
        document.getElementById('main-content')?.classList.add('hidden');
      } catch (error) {
        console.error('Logout error:', error);
        opts.showToast?.(`Erreur deconnexion: ${error.message}`);
      }
    }

    function startApp() {
      opts.initTheme?.();
      if (!opts.checkDependencies?.()) return;

      if (global.TaskMDACrypto) {
        global.TaskMDACrypto.initCryptoUI();
        global.addEventListener('taskmda-crypto-recovered', async () => {
          await initApp();
        });

        const hasSalt = global.TaskMDACrypto.hasSalt();
        global.TaskMDACrypto.showLockScreen(hasSalt ? 'unlock' : 'create');
        const lockBtn = document.getElementById('lockBtn');
        if (lockBtn) {
          lockBtn.onclick = () => {
            global.TaskMDACrypto.submitPassword(async (result) => {
              if (!hasSalt && result && !result.isNewUser) return;
              if (!hasSalt) {
                opts.showRecoveryKeyInstructions?.(result?.recoveryCode || '', 'Cle de recuperation initiale');
              }
              await initApp();
            });
          };
        }
      } else {
        console.warn('Crypto module not loaded, starting without encryption');
        initApp();
      }
    }

    return {
      initApp,
      handleSelectFolder,
      handleContinueWithoutFolder,
      handleLogout,
      startApp
    };
  }

  global.TaskMDAAppInit = {
    createModule
  };
}(window));
