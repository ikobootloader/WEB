(function initTaskMdaUiModule(global) {
  'use strict';

  function showToast(message, duration) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = String(message || '');
    toast.classList.remove('hidden');
    const timeout = Number.isFinite(duration) ? duration : 3000;
    setTimeout(() => {
      toast.classList.add('hidden');
    }, timeout);
  }

  global.TaskMDAUI = {
    showToast
  };
}(window));

