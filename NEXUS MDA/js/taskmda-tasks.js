(function initTaskMdaTasksModule(global) {
  'use strict';

  function parseSubtasks(textValue, idFactory) {
    if (!textValue) return [];
    const makeId = typeof idFactory === 'function'
      ? idFactory
      : (() => `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    return String(textValue)
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(label => ({ id: makeId(), label, done: false }));
  }

  function getSubtaskProgress(task) {
    const subtasks = Array.isArray(task && task.subtasks) ? task.subtasks : [];
    const total = subtasks.length;
    const done = subtasks.filter(st => Boolean(st && st.done)).length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, percent };
  }

  function buildSubtaskProgressHtml(task, compact = false) {
    const stats = getSubtaskProgress(task);
    if (!stats.total) return '';
    const wrapperClass = compact ? 'subtask-progress subtask-progress-compact' : 'subtask-progress';
    return [
      `<div class="${wrapperClass}">`,
      '  <div class="subtask-progress-head">',
      `    <span class="subtask-progress-title">Sous-taches (${stats.done}/${stats.total})</span>`,
      `    <span class="subtask-progress-percent">${stats.percent}%</span>`,
      '  </div>',
      '  <div class="subtask-progress-track">',
      `    <div class="subtask-progress-fill" style="width:${stats.percent}%"></div>`,
      '  </div>',
      '</div>'
    ].join('\n');
  }

  function mergeSubtasksWithExisting(existingSubtasks, subtasksParsed, normalizeSearchFn, idFactory) {
    if (!Array.isArray(subtasksParsed)) return [];
    const existing = Array.isArray(existingSubtasks) ? existingSubtasks : [];
    const used = new Set();
    const normalize = typeof normalizeSearchFn === 'function'
      ? normalizeSearchFn
      : (value => String(value || '').trim().toLowerCase());
    const makeId = typeof idFactory === 'function'
      ? idFactory
      : (() => `${Date.now()}-${Math.random().toString(16).slice(2)}`);

    return subtasksParsed.map((nextSt) => {
      const matchIndex = existing.findIndex((oldSt, idx) => (
        !used.has(idx) && normalize(oldSt && oldSt.label) === normalize(nextSt && nextSt.label)
      ));
      if (matchIndex >= 0) {
        used.add(matchIndex);
        const matched = existing[matchIndex];
        return {
          id: (matched && matched.id) || (nextSt && nextSt.id) || makeId(),
          label: (nextSt && nextSt.label) || '',
          done: Boolean(matched && matched.done)
        };
      }
      return {
        id: (nextSt && nextSt.id) || makeId(),
        label: (nextSt && nextSt.label) || '',
        done: false
      };
    });
  }

  global.TaskMDATasks = {
    parseSubtasks,
    getSubtaskProgress,
    buildSubtaskProgressHtml,
    mergeSubtasksWithExisting
  };
}(window));

