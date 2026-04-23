(function initTaskMDAProjectNotesModule(global) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeSearch(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function formatDateTime(ts) {
    const safeTs = Number(ts || 0);
    if (!safeTs) return '-';
    return new Date(safeTs).toLocaleString('fr-FR');
  }

  function parseTagsInput(raw) {
    return Array.from(new Set(
      String(raw || '')
        .split(/[,;\n]/g)
        .map((tag) => tag.trim())
        .filter(Boolean)
    ));
  }

  function stringifyTags(tags) {
    return (Array.isArray(tags) ? tags : [])
      .map((tag) => String(tag || '').trim())
      .filter(Boolean)
      .join(', ');
  }

  function matchByMode(note, mode, currentUserId) {
    const key = String(mode || 'all').trim();
    if (key === 'archived') return Number(note?.archivedAt || 0) > 0;
    if (Number(note?.archivedAt || 0) > 0) return false;
    if (key === 'pinned') return Number(note?.pinnedAt || 0) > 0;
    if (key === 'mine') return String(note?.createdBy || '') === String(currentUserId || '');
    if (key === 'linked') return Array.isArray(note?.linkedTaskIds) && note.linkedTaskIds.length > 0;
    if (key === 'published') return !!note?.shareToGlobalFeed;
    return true;
  }

  function buildCardHtml(note, ctx) {
    const tags = Array.isArray(note.tags) ? note.tags : [];
    const linkedTaskIds = Array.isArray(note.linkedTaskIds) ? note.linkedTaskIds : [];
    const taskLabels = linkedTaskIds
      .map((taskId) => ctx.taskTitleById.get(String(taskId || '').trim()))
      .filter(Boolean);
    const canManage = !!ctx.canManageById.get(String(note.noteId || ''));
    const isFocused = String(ctx.focusNoteId || '') === String(note.noteId || '');
    const isArchived = Number(note.archivedAt || 0) > 0;

    return `
      <article
        id="project-note-${escapeHtml(note.noteId)}"
        class="rounded-xl border ${isFocused ? 'border-blue-400 shadow-[0_0_0_2px_rgba(59,130,246,0.14)]' : 'border-slate-200'} bg-white p-4 cursor-pointer"
        onclick="openProjectNoteReadModal('${escapeHtml(note.noteId)}')"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              ${isArchived ? '<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-slate-200 text-slate-700 font-semibold">Archivee</span>' : ''}
              ${Number(note.pinnedAt || 0) > 0 ? '<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">Epinglee</span>' : ''}
              ${note.shareToGlobalFeed ? '<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">Fil transverse</span>' : ''}
              ${linkedTaskIds.length > 0 ? `<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">${linkedTaskIds.length} tache(s) liee(s)</span>` : ''}
            </div>
            <h4 class="mt-2 text-base font-bold text-slate-800">${escapeHtml(note.title || 'Note sans titre')}</h4>
            <p class="mt-1 text-xs text-slate-500">${escapeHtml(String(ctx.authorById.get(String(note.createdBy || '')) || note.createdByName || 'Auteur'))} • ${escapeHtml(formatDateTime(note.createdAt))}</p>
          </div>
          ${canManage ? `
            <div class="flex items-center gap-1" onclick="event.stopPropagation();">
              ${isArchived
                ? `<button type="button" class="workspace-action-inline" onclick="restoreProjectNote('${escapeHtml(note.noteId)}')" data-action-kind="unarchive">Restaurer</button>`
                : `
                  <button type="button" class="workspace-action-inline" onclick="openProjectNoteEditor('${escapeHtml(note.noteId)}')" data-action-kind="edit">Editer</button>
                  <button type="button" class="workspace-action-inline" onclick="toggleProjectNotePinned('${escapeHtml(note.noteId)}')" data-action-kind="manage">${Number(note.pinnedAt || 0) > 0 ? 'Desepingler' : 'Epingler'}</button>
                  <button type="button" class="workspace-action-inline" onclick="toggleProjectNoteFeedPublish('${escapeHtml(note.noteId)}')" data-action-kind="notify">${note.shareToGlobalFeed ? 'Retirer fil' : 'Publier fil'}</button>
                  <button type="button" class="workspace-action-inline" onclick="convertProjectNoteToTask('${escapeHtml(note.noteId)}')" data-action-kind="convert">En tache</button>
                  <button type="button" class="workspace-action-inline" onclick="archiveProjectNote('${escapeHtml(note.noteId)}')" data-action-kind="archive">Archiver</button>
                  <button type="button" class="workspace-action-inline" onclick="deleteProjectNote('${escapeHtml(note.noteId)}')" data-action-kind="danger">Supprimer</button>
                `
              }
            </div>
          ` : ''}
        </div>
        ${tags.length ? `<div class="mt-3 flex flex-wrap gap-1">${tags.map((tag) => `<span class="inline-flex text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">#${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        ${taskLabels.length ? `<p class="mt-2 text-xs text-slate-500">Liens taches: ${escapeHtml(taskLabels.join(' • '))}</p>` : ''}
      </article>
    `;
  }

  function renderProjectNotesList(container, options = {}) {
    if (!container) return { total: 0, visible: 0 };
    const notes = Array.isArray(options.notes) ? options.notes : [];
    const mode = String(options.mode || 'all').trim();
    const query = normalizeSearch(options.query || '');
    const currentUserId = String(options.currentUserId || '');
    const taskTitleById = options.taskTitleById instanceof Map ? options.taskTitleById : new Map();
    const authorById = options.authorById instanceof Map ? options.authorById : new Map();
    const canManageById = options.canManageById instanceof Map ? options.canManageById : new Map();
    const focusNoteId = String(options.focusNoteId || '');

    const visible = notes
      .filter((note) => matchByMode(note, mode, currentUserId))
      .filter((note) => {
        if (!query) return true;
        const blob = normalizeSearch([
          note.title,
          note.content,
          ...(Array.isArray(note.tags) ? note.tags : []),
          ...(Array.isArray(note.linkedTaskIds) ? note.linkedTaskIds : []).map((id) => taskTitleById.get(String(id || '').trim()) || '')
        ].join(' '));
        return blob.includes(query);
      })
      .sort((a, b) => {
        if (mode === 'archived') {
          return Number(b.archivedAt || b.updatedAt || b.createdAt || 0) - Number(a.archivedAt || a.updatedAt || a.createdAt || 0);
        }
        const pinDiff = Number(b.pinnedAt || 0) - Number(a.pinnedAt || 0);
        if (pinDiff !== 0) return pinDiff;
        return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0);
      });

    if (!visible.length) {
      container.innerHTML = `
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
          Aucune note pour ces criteres.
        </div>
      `;
      return { total: notes.length, visible: 0 };
    }

    container.innerHTML = visible.map((note) => buildCardHtml(note, {
      taskTitleById,
      authorById,
      canManageById,
      focusNoteId
    })).join('');
    return { total: notes.length, visible: visible.length };
  }

  global.TaskMDAProjectNotes = {
    parseTagsInput,
    stringifyTags,
    renderProjectNotesList
  };
}(window));
