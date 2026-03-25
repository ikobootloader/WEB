(function initTaskMdaThemeModule(global) {
  'use strict';

  const STORAGE_KEY = 'taskmda_theme_choice';
  let themeChoice = 'system';
  let mediaQuery = null;

  function getStoredThemeChoice() {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark') return value;
    return 'system';
  }

  function setThemeIcon(isDark) {
    const icon = document.getElementById('theme-toggle-icon');
    const btn = document.getElementById('btn-theme-toggle');
    if (icon) {
      icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    }
    if (btn) {
      const label = isDark ? 'Activer le mode clair' : 'Activer le mode sombre';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    }
  }

  function applyTheme(choice, persist = true) {
    themeChoice = (choice === 'light' || choice === 'dark') ? choice : 'system';
    const prefersDark = global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark = themeChoice === 'dark' || (themeChoice === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', useDark);
    document.documentElement.classList.toggle('light', !useDark);
    setThemeIcon(useDark);

    if (!persist) return;
    if (themeChoice === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, themeChoice);
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    applyTheme(isDark ? 'light' : 'dark', true);
  }

  function initTheme() {
    applyTheme(getStoredThemeChoice(), false);
    if (!global.matchMedia) return;
    mediaQuery = global.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (themeChoice === 'system') {
        applyTheme('system', false);
      }
    };
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(onChange);
    }
  }

  global.TaskMDATheme = {
    getStoredThemeChoice,
    setThemeIcon,
    applyTheme,
    toggleTheme,
    initTheme
  };
}(window));

