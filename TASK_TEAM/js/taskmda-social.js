(function initTaskMDASocialModule() {
  function defaultEscape(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sanitizeAvatarUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return '';
    if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('blob:')) return raw;
    if (lower.startsWith('data:image/')) return raw;
    return '';
  }

  function renderAvatar({
    className = 'discussion-member-avatar',
    avatarDataUrl = '',
    initials = '?',
    color = '#3b82f6',
    escapeHtml = defaultEscape
  }) {
    const url = sanitizeAvatarUrl(avatarDataUrl || '');
    if (url) {
      const safeUrl = url.replace(/'/g, '%27').replace(/"/g, '%22');
      return `<span class="${className}" style="background-image:url('${safeUrl}')"></span>`;
    }
    return `<span class="${className}" style="background:${escapeHtml(color)}">${escapeHtml(initials)}</span>`;
  }

  function renderUnreadBadge(unreadCount = 0) {
    const unread = Number(unreadCount || 0);
    if (unread <= 0) return '';
    return `<span class="ml-2 inline-flex min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-bold">${unread > 99 ? '99+' : unread}</span>`;
  }

  function renderGroupDismissButton(item = {}, escapeHtml = defaultEscape) {
    if (!item?.isGroup || !item?.groupRemovable) return '';
    const convId = String(item?.conversationId || '').trim();
    if (!convId) return '';
    return `
      <button
        type="button"
        class="discussion-group-dismiss-btn"
        title="Masquer ce canal pour moi"
        aria-label="Masquer ce canal pour moi"
        onclick="event.stopPropagation(); hideGlobalMessageGroupChannel('${escapeHtml(convId)}')"
      >
        <span class="material-symbols-outlined">close</span>
      </button>
    `;
  }

  function renderContactsList({
    items = [],
    broadcastTarget = '__all__',
    multiSelectedIds = new Set(),
    escapeHtml = defaultEscape
  }) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<p class="text-sm text-slate-500">Aucun agent connu.</p>';
    }
    return items.map((item) => {
      const id = String(item?.id || '').trim();
      if (!id) return '';
      const isBroadcast = Boolean(item?.isBroadcast);
      const clickValue = isBroadcast ? broadcastTarget : id;
      const clickHandler = String(item?.clickHandler || 'selectGlobalMessagePeer');
      const avatar = renderAvatar({
        className: 'discussion-member-avatar',
        avatarDataUrl: item?.avatarDataUrl || '',
        initials: item?.initials || '?',
        color: item?.avatarColor || '#3b82f6',
        escapeHtml
      });
      return `
        <div
          role="button"
          tabindex="0"
          class="discussion-member-item w-full text-left ${item?.isActive ? 'is-active' : ''}"
          onclick="${escapeHtml(clickHandler)}('${escapeHtml(clickValue)}')"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${escapeHtml(clickHandler)}('${escapeHtml(clickValue)}')}"
        >
          <div class="discussion-member-avatar-wrap">
            ${avatar}
            <span class="discussion-member-dot is-online"></span>
          </div>
          <div class="discussion-member-meta min-w-0">
            <p class="discussion-member-name truncate">${escapeHtml(item?.name || 'Utilisateur')}</p>
            <p class="discussion-member-status is-online truncate">${escapeHtml(item?.status || '')}</p>
            ${item?.subtitle ? `<p class="discussion-member-channel-subtitle truncate">${escapeHtml(item.subtitle)}</p>` : ''}
          </div>
          ${renderGroupDismissButton(item, escapeHtml)}
          ${(!isBroadcast && !item?.isGroup) ? `
            <span
              role="button"
              tabindex="0"
              class="discussion-member-selector ${multiSelectedIds?.has?.(id) ? 'is-selected' : ''}"
              title="${multiSelectedIds?.has?.(id) ? 'Retirer des destinataires' : 'Ajouter aux destinataires'}"
              aria-label="${multiSelectedIds?.has?.(id) ? 'Retirer des destinataires' : 'Ajouter aux destinataires'}"
              onclick="event.stopPropagation(); toggleGlobalMessageRecipient('${escapeHtml(id)}')"
              onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();toggleGlobalMessageRecipient('${escapeHtml(id)}')}"
            >
              <span class="material-symbols-outlined">done</span>
            </span>
          ` : ''}
          ${renderUnreadBadge(item?.unreadCount || 0)}
        </div>
      `;
    }).join('');
  }

  function renderThread({
    items = [],
    escapeHtml = defaultEscape,
    renderMarkdown = (text) => escapeHtml(text)
  }) {
    if (!Array.isArray(items) || items.length === 0) {
      return '';
    }
    return items.map((item) => {
      const avatar = renderAvatar({
        className: 'discussion-avatar',
        avatarDataUrl: item?.avatarDataUrl || '',
        initials: item?.avatarInitials || '?',
        color: item?.avatarColor || '#3b82f6',
        escapeHtml
      });
      return `
        <div class="discussion-message-row ${item?.mine ? 'is-mine' : 'is-other'}">
          ${avatar}
          <div class="discussion-message-wrap">
            <div class="discussion-message-meta">
              <span class="discussion-author">${escapeHtml(item?.author || 'Utilisateur')}</span>
              <span class="discussion-time">${escapeHtml(item?.timeLabel || '')}</span>
              ${item?.editedLabel ? `<span class="discussion-edited">${escapeHtml(item.editedLabel)}</span>` : ''}
            </div>
            <div class="discussion-bubble ${item?.mine ? 'is-mine' : 'is-other'}">
              ${item?.editorHtml || `<div class="markdown-content">${renderMarkdown(item?.content || '')}</div>`}
              ${item?.editorHtml ? '' : (item?.attachmentsHtml || '')}
              ${item?.footerActionsHtml || ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.TaskMDASocial = {
    renderContactsList,
    renderThread
  };
})();
