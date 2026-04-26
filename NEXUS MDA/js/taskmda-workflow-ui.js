(function initTaskMdaWorkflowUi(global) {
  'use strict';

  function renderBreadcrumbHtml(crumbs, esc) {
    const safeEsc = typeof esc === 'function'
      ? esc
      : (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const list = Array.isArray(crumbs) ? crumbs : [];
    return `
      <nav class="workflow-breadcrumb-nav" aria-label="Breadcrumb workflow">
        ${list.map((crumb) => `<span class="workflow-breadcrumb-item">${safeEsc(crumb)}</span>`).join('<span class="workflow-breadcrumb-sep">›</span>')}
      </nav>
    `;
  }

  function renderHistoryPanelHtml(rows, esc, options = {}) {
    const safeEsc = typeof esc === 'function'
      ? esc
      : (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const type = String(options.type || '');
    const editable = options.editable !== false;
    const list = Array.isArray(rows) ? rows : [];
    const pagination = options?.pagination && typeof options.pagination === 'object'
      ? options.pagination
      : null;
    const formatValue = (value) => {
      if (value === undefined) return '(absent)';
      if (value === null) return 'null';
      if (typeof value === 'string') return value || '(vide)';
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      try {
        const raw = JSON.stringify(value);
        if (raw.length > 220) return `${raw.slice(0, 220)}...`;
        return raw;
      } catch (_) {
        return String(value);
      }
    };
    if (list.length === 0) {
      return `
        <div class="workflow-map-col">
          <h6>Historique</h6>
          <p class="workflow-card-sub">Aucune version historisee.</p>
        </div>
      `;
    }
    return `
      <div class="workflow-map-col">
        <div class="workflow-history-head">
          <h6>Historique</h6>
          ${pagination && Number(pagination.totalPages || 1) > 1 ? `
            <div class="workflow-history-pager">
              <button type="button" class="workflow-btn-light" data-wf-history-page-action="prev" ${pagination.currentPage <= 1 ? 'disabled' : ''}>Precedent</button>
              <span class="workflow-card-sub">${safeEsc(String(pagination.start || 0))}-${safeEsc(String(pagination.end || 0))} / ${safeEsc(String(pagination.totalItems || list.length || 0))}</span>
              <button type="button" class="workflow-btn-light" data-wf-history-page-action="next" ${pagination.currentPage >= pagination.totalPages ? 'disabled' : ''}>Suivant</button>
            </div>
          ` : ''}
        </div>
        <ul class="workflow-history-list">
          ${list.map((row) => {
            const when = Number(row?.createdAt || 0);
            const date = when ? new Date(when).toLocaleString() : '-';
            const action = String(row?.action || 'update');
            const reason = String(row?.reason || '');
            const changedKeys = Array.isArray(row?.changedKeys) ? row.changedKeys.filter(Boolean) : [];
            const changedPreview = changedKeys.slice(0, 6);
            const changedMore = Math.max(0, changedKeys.length - changedPreview.length);
            const beforeEntity = row?.beforeEntity && typeof row.beforeEntity === 'object' ? row.beforeEntity : {};
            const afterEntity = row?.afterEntity && typeof row.afterEntity === 'object' ? row.afterEntity : {};
            return `
              <li class="workflow-history-row">
                <div class="workflow-history-meta">
                  <span class="workflow-chip">${safeEsc(action)}</span>
                  <span class="workflow-card-sub">${safeEsc(`${date} - ${row?.byUserId || 'system'}`)}</span>
                  ${reason ? `<span class="workflow-card-sub">${safeEsc(reason)}</span>` : ''}
                  ${changedKeys.length > 0 ? `<span class="workflow-card-sub">Champs: ${safeEsc(changedPreview.join(', '))}${changedMore > 0 ? ` (+${changedMore})` : ''}</span>` : ''}
                </div>
                <div class="workflow-history-actions">
                  ${changedKeys.length > 0 ? `<button type="button" class="workflow-btn-light" data-wf-history-diff-toggle="${safeEsc(row.id)}">Voir diff</button>` : ''}
                  ${editable && action !== 'restore' ? `<button type="button" class="workflow-btn-light" data-wf-history-restore="${safeEsc(row.id)}" data-wf-history-type="${safeEsc(type)}">Restaurer tout</button>` : ''}
                  ${editable && changedKeys.length > 0 ? `<button type="button" class="workflow-btn-light" data-wf-history-restore-fields="${safeEsc(row.id)}" data-wf-history-type="${safeEsc(type)}" data-wf-history-default-fields="${safeEsc(changedKeys.join(','))}">Restaurer champs</button>` : ''}
                </div>
                ${changedKeys.length > 0 ? `
                  <div class="workflow-history-diff hidden" data-wf-history-diff="${safeEsc(row.id)}">
                    ${changedKeys.map((key) => `
                      <div class="workflow-history-diff-row">
                        <p class="workflow-history-diff-key">${safeEsc(key)}</p>
                        <p class="workflow-history-diff-val workflow-history-diff-before"><strong>Avant:</strong> ${safeEsc(formatValue(beforeEntity[key]))}</p>
                        <p class="workflow-history-diff-val workflow-history-diff-after"><strong>Apres:</strong> ${safeEsc(formatValue(afterEntity[key]))}</p>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    `;
  }

  global.TaskMDAWorkflowUI = {
    renderBreadcrumbHtml,
    renderHistoryPanelHtml
  };
}(window));
