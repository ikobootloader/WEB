(function initTaskMdaNotificationsModule(global) {
  'use strict';

  function normalizeList(items, maxItems = 120) {
    const next = Array.isArray(items) ? items : [];
    return next.slice(0, maxItems);
  }

  function load(storageKey = 'taskmda_notifications', maxItems = 120) {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return normalizeList(parsed, maxItems);
    } catch {
      return [];
    }
  }

  function save(items, storageKey = 'taskmda_notifications', maxItems = 120) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(normalizeList(items, maxItems)));
    } catch {
      // ignore quota / storage errors
    }
  }

  function add(items, payload, maxItems = 120) {
    const source = Array.isArray(items) ? items : [];
    const next = [payload, ...source];
    return normalizeList(next, maxItems);
  }

  function markAllRead(items) {
    return (Array.isArray(items) ? items : []).map(item => ({ ...item, read: true }));
  }

  function markRead(items, id) {
    return (Array.isArray(items) ? items : []).map(item => (
      item && item.id === id ? { ...item, read: true } : item
    ));
  }

  function unreadCount(items) {
    return (Array.isArray(items) ? items : []).filter(item => item && !item.read).length;
  }

  global.TaskMDANotifications = {
    load,
    save,
    add,
    markAllRead,
    markRead,
    unreadCount
  };
}(window));

