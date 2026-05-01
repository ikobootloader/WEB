(function initTaskMdaCoreUtilsModule(global) {
  'use strict';

  const TASK_STATUS_ALIAS_MAP = Object.freeze({
    'todo': 'todo',
    'a-faire': 'todo',
    'à-faire': 'todo',
    'afaire': 'todo',
    'a faire': 'todo',
    'à faire': 'todo',
    'en-cours': 'en-cours',
    'encours': 'en-cours',
    'in-progress': 'en-cours',
    'in progress': 'en-cours',
    'en-attente': 'suspendu',
    'en attente': 'suspendu',
    'suspendu': 'suspendu',
    'paused': 'suspendu',
    'termine': 'termine',
    'terminé': 'termine',
    'done': 'termine',
    'completed': 'termine',
    'realise': 'termine',
    'réalisé': 'termine'
  });

  function normalizeTaskStatusValue(rawStatus) {
    const value = String(rawStatus || '').trim().toLowerCase();
    if (!value) return 'todo';
    return TASK_STATUS_ALIAS_MAP[value] || 'todo';
  }

  function normalizeTaskStatusForCreate(rawStatus) {
    return normalizeTaskStatusValue(rawStatus);
  }

  function normalizeSearch(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function normalizeCatalogKey(value) {
    return normalizeSearch(value).trim().replace(/\s+/g, '-');
  }

  function toYmd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function normalizeDashboardHeroShortContentMaxChars(rawValue) {
    const parsed = Number.parseInt(String(rawValue ?? ''), 10);
    if (!Number.isFinite(parsed)) return 520;
    return Math.min(4000, Math.max(80, parsed));
  }

  function normalizeFeedSummaryWordCount(rawValue) {
    const parsed = Number.parseInt(String(rawValue ?? ''), 10);
    if (!Number.isFinite(parsed)) return 300;
    return Math.min(1200, Math.max(40, parsed));
  }

  function normalizeWorkspaceWideSections(rawSections, sectionMeta) {
    const source = rawSections && typeof rawSections === 'object' ? rawSections : {};
    const meta = sectionMeta && typeof sectionMeta === 'object' ? sectionMeta : {};
    const normalized = {};
    Object.keys(meta).forEach((sectionKey) => {
      normalized[sectionKey] = source[sectionKey] === true;
    });
    return normalized;
  }

  function normalizeTaskAutoArchiveMonths(value, defaults) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    const min = Number(defaults?.min ?? 1);
    const max = Number(defaults?.max ?? 36);
    const fallback = Number(defaults?.fallback ?? 6);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function normalizeProjectSortMode(value) {
    const mode = String(value || 'recent').trim().toLowerCase();
    if (mode === 'status') return 'priority';
    if (
      mode === 'recent' ||
      mode === 'oldest' ||
      mode === 'name-asc' ||
      mode === 'name-desc' ||
      mode === 'priority' ||
      mode === 'deadline-near' ||
      mode === 'deadline-far'
    ) {
      return mode;
    }
    return 'recent';
  }

  function normalizeWorkflowActionButtonsMode(rawMode) {
    const mode = String(rawMode || '').trim().toLowerCase();
    if (mode === 'text' || mode === 'icon' || mode === 'icon_text') return mode;
    return 'icon';
  }

  function normalizeWorkflowActionButtonsShape(rawShape) {
    const shape = String(rawShape || '').trim().toLowerCase();
    if (shape === 'round' || shape === 'rect') return shape;
    return 'rect';
  }

  function normalizeSharingMode(mode, fallback) {
    const safeFallback = fallback === 'shared' || fallback === 'private' ? fallback : 'private';
    return mode === 'shared' || mode === 'private' ? mode : safeFallback;
  }

  function normalizeProjectReadAccess(value, fallback) {
    const safeFallback = fallback === 'public' || fallback === 'members' || fallback === 'private'
      ? fallback
      : 'private';
    return value === 'public' || value === 'members' || value === 'private' ? value : safeFallback;
  }

  function sharingModeLabel(mode) {
    return normalizeSharingMode(mode, 'private') === 'shared'
      ? 'Visibilité collaborative'
      : 'Visibilité privée';
  }

  function normalizeProjectPriority(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (
      normalized === 'critique' ||
      normalized === 'haute' ||
      normalized === 'normale' ||
      normalized === 'basse'
    ) {
      return normalized;
    }
    return 'normale';
  }

  function getProjectPriorityLabel(value, labelsMap) {
    const labels = labelsMap && typeof labelsMap === 'object'
      ? labelsMap
      : { critique: 'Critique', haute: 'Haute', normale: 'Normale', basse: 'Basse' };
    const key = normalizeProjectPriority(value);
    return labels[key] || labels.normale || 'Normale';
  }

  function getProjectPriorityChipClass(value) {
    const key = normalizeProjectPriority(value);
    if (key === 'critique') return 'workspace-chip-priority-critique';
    if (key === 'haute') return 'workspace-chip-priority-haute';
    if (key === 'basse') return 'workspace-chip-priority-basse';
    return 'workspace-chip-priority-normale';
  }

  function normalizeTaskAutoArchiveSettings(rawValue, options) {
    const value = rawValue && typeof rawValue === 'object'
      ? rawValue
      : { months: rawValue };
    const months = normalizeTaskAutoArchiveMonths(value.months, options);
    const lastRunAt = Number(value.lastRunAt || 0);
    return {
      months,
      lastRunAt: Number.isFinite(lastRunAt) && lastRunAt > 0 ? lastRunAt : 0
    };
  }

  function formatFileSize(size) {
    if (!size) return '0 o';
    if (size < 1024) return `${size} o`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
    return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
  }

  function paginateItems(items, page, pageSize) {
    const safeItems = Array.isArray(items) ? items : [];
    const safePageSize = Math.max(1, Number(pageSize) || 1);
    const totalItems = safeItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
    const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const start = (currentPage - 1) * safePageSize;
    const end = Math.min(totalItems, start + safePageSize);
    const pageItems = safeItems.slice(start, start + safePageSize);
    return { totalItems, totalPages, currentPage, start, end, pageItems };
  }

  function normalizeCalendarYmd(rawValue) {
    const raw = String(rawValue || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
  }

  function parseYmdLocalToDate(dateKey) {
    const raw = String(dateKey || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const [y, m, d] = raw.split('-').map((v) => Number.parseInt(v, 10));
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() !== y || date.getMonth() !== (m - 1) || date.getDate() !== d) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function addDays(date, delta) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    return d;
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeCsvValue(value) {
    const raw = String(value ?? '');
    if (/[;"\n\r]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  }

  function toCsv(rows, headers) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const safeHeaders = Array.isArray(headers) ? headers : [];
    const head = safeHeaders.map(escapeCsvValue).join(';');
    const lines = safeRows.map((row) => safeHeaders.map((h) => escapeCsvValue(row?.[h])).join(';'));
    return '\uFEFF' + [head, ...lines].join('\n');
  }

  function formatExportDateTag(dateValue) {
    const d = dateValue instanceof Date ? dateValue : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${mi}`;
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function stringToColor(str) {
    const source = String(str || '');
    const colors = ['#006c4a', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#3b82f6'];
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      hash = source.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function normalizeActionButtonLabel(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeActionToken(value) {
    return normalizeActionButtonLabel(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeViaAnnuaireLiveDomain(value) {
    return String(value || '').trim().toUpperCase() === 'PH' ? 'PH' : 'PA';
  }

  function normalizeViaAnnuaireDepartmentCode(value) {
    return String(value || '').trim().toUpperCase();
  }

  function normalizeViaAnnuaireLiveSortKey(value) {
    return String(value || '').trim().toLowerCase() === 'city' ? 'city' : 'name';
  }

  function buildViaAnnuaireLiveResultRef(item) {
    const source = [
      String(item?.finess || '').trim(),
      String(item?.idStructure || '').trim(),
      String(item?.name || '').trim(),
      String(item?.city || '').trim()
    ].filter(Boolean).join('|');
    return source || `row:${Math.random().toString(36).slice(2, 10)}`;
  }

  function sortViaAnnuaireLiveResults(rows, sortKey) {
    const key = normalizeViaAnnuaireLiveSortKey(sortKey);
    const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
    return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
      const aPrimary = key === 'city' ? String(a?.city || '').trim() : String(a?.name || '').trim();
      const bPrimary = key === 'city' ? String(b?.city || '').trim() : String(b?.name || '').trim();
      const primaryOrder = collator.compare(aPrimary, bPrimary);
      if (primaryOrder !== 0) return primaryOrder;
      const aSecondary = key === 'city' ? String(a?.name || '').trim() : String(a?.city || '').trim();
      const bSecondary = key === 'city' ? String(b?.name || '').trim() : String(b?.city || '').trim();
      return collator.compare(aSecondary, bSecondary);
    });
  }

  function buildViaAnnuairePublicFicheUrl(item, domain) {
    const finess = String(item?.finess || '').trim();
    if (!finess) return '';
    const normalizedDomain = normalizeViaAnnuaireLiveDomain(domain);
    const path = normalizedDomain === 'PH'
      ? `fiche-etablissement/personnes-situation-handicap/${encodeURIComponent(finess)}`
      : `fiche-etablissement/personnes-agees/${encodeURIComponent(finess)}`;
    return `https://usager.viatrajectoire.fr/${path}`;
  }

  function normalizeViaAnnuaireComparableText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,;:/()'"`’\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function normalizeViaAnnuaireComparablePhone(value) {
    return String(value || '').replace(/[^\d+]/g, '').trim();
  }

  function normalizeViaAnnuaireComparableEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function tokenizeViaAnnuaireComparableText(value) {
    return normalizeViaAnnuaireComparableText(value)
      .split(' ')
      .map((token) => token.trim())
      .filter(Boolean);
  }

  function computeViaAnnuaireTokenOverlap(leftTokens = [], rightTokens = []) {
    const a = new Set(leftTokens);
    const b = new Set(rightTokens);
    if (!a.size || !b.size) return 0;
    let common = 0;
    a.forEach((token) => {
      if (b.has(token)) common += 1;
    });
    return common / Math.max(a.size, b.size);
  }

  function buildViaAnnuaireRecommendedAddress(localAddress, remoteAddress) {
    const localRaw = String(localAddress || '').trim();
    const remoteRaw = String(remoteAddress || '').trim();
    if (!localRaw || !remoteRaw) return '';
    const localNorm = normalizeViaAnnuaireComparableText(localRaw);
    const remoteNorm = normalizeViaAnnuaireComparableText(remoteRaw);
    if (!localNorm || !remoteNorm) return '';
    if (localNorm === remoteNorm) return '';
    const localTokens = tokenizeViaAnnuaireComparableText(localRaw);
    const remoteTokens = tokenizeViaAnnuaireComparableText(remoteRaw);
    const overlap = computeViaAnnuaireTokenOverlap(localTokens, remoteTokens);
    const contains = remoteNorm.includes(localNorm) || localNorm.includes(remoteNorm);
    const lengthGain = remoteNorm.length - localNorm.length;
    if ((contains && lengthGain >= 6) || (overlap >= 0.58 && remoteNorm.length > localNorm.length)) {
      return remoteRaw;
    }
    return '';
  }

  function computeViaAnnuaireDiceSimilarity(left, right) {
    const a = normalizeViaAnnuaireComparableText(left);
    const b = normalizeViaAnnuaireComparableText(right);
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    if (a === b) return 1;
    const grams = (text) => {
      if (text.length < 2) return [text];
      const out = [];
      for (let i = 0; i < text.length - 1; i += 1) out.push(text.slice(i, i + 2));
      return out;
    };
    const gA = grams(a);
    const gB = grams(b);
    const counts = new Map();
    gA.forEach((g) => counts.set(g, (counts.get(g) || 0) + 1));
    let overlap = 0;
    gB.forEach((g) => {
      const c = counts.get(g) || 0;
      if (c > 0) {
        overlap += 1;
        counts.set(g, c - 1);
      }
    });
    return (2 * overlap) / (gA.length + gB.length);
  }

  function normalizeViaAnnuaireRorEndpoint(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (!/^https?:\/\//i.test(raw)) return '';
    try {
      const parsed = new URL(raw);
      const host = String(parsed.hostname || '').toLowerCase();
      let path = String(parsed.pathname || '').replace(/\/+$/, '');
      if (host === 'gateway.api.esante.gouv.fr') {
        if (!path || path === '/') {
          path = '/fhir/v2';
        } else if (path === '/fhir') {
          path = '/fhir/v2';
        }
      }
      parsed.pathname = path || '/';
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString().replace(/\/+$/, '');
    } catch (_) {
      return '';
    }
  }

  function normalizeViaAnnuaireRorSettings(rawValue) {
    const value = rawValue && typeof rawValue === 'object' ? rawValue : {};
    const endpoint = normalizeViaAnnuaireRorEndpoint(value.endpoint || value.endpoints?.[0] || '');
    const apiKey = String(value.apiKey || '').trim();
    return { endpoint, apiKey };
  }

  function extractViaAnnuaireRorEmailFromOrganization(org) {
    if (!org || typeof org !== 'object') return '';
    const candidates = [];
    if (Array.isArray(org.telecom)) candidates.push(...org.telecom);
    if (Array.isArray(org.contact)) {
      org.contact.forEach((contact) => {
        if (Array.isArray(contact?.telecom)) candidates.push(...contact.telecom);
      });
    }
    for (const telecom of candidates) {
      const system = String(telecom?.system || '').trim().toLowerCase();
      if (system !== 'email') continue;
      const value = String(telecom?.value || '').trim();
      if (value) return value;
    }
    return '';
  }

  function extractViaAnnuaireRorEmailFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return '';
    const bundleEntries = Array.isArray(payload.entry) ? payload.entry : [];
    for (const entry of bundleEntries) {
      const email = extractViaAnnuaireRorEmailFromOrganization(entry?.resource);
      if (email) return email;
    }
    return extractViaAnnuaireRorEmailFromOrganization(payload);
  }

  function extractViaAnnuaireRorOrganizationFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (String(payload.resourceType || '').trim() === 'Organization') return payload;
    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    for (const entry of entries) {
      const resource = entry?.resource;
      if (resource && String(resource.resourceType || '').trim() === 'Organization') {
        return resource;
      }
    }
    return null;
  }

  function extractViaAnnuaireRorTelecomValue(org, system) {
    const wanted = String(system || '').trim().toLowerCase();
    if (!wanted || !org || typeof org !== 'object') return '';
    const values = [];
    const pushTelecomValues = (items) => {
      if (!Array.isArray(items)) return;
      items.forEach((telecom) => {
        if (String(telecom?.system || '').trim().toLowerCase() !== wanted) return;
        const value = String(telecom?.value || '').trim();
        if (value) values.push(value);
      });
    };
    pushTelecomValues(org.telecom);
    if (Array.isArray(org.contact)) {
      org.contact.forEach((contact) => pushTelecomValues(contact?.telecom));
    }
    return values[0] || '';
  }

  function extractViaAnnuaireRorOrganizationAddress(org) {
    const first = Array.isArray(org?.address) ? org.address.find(Boolean) : null;
    if (!first || typeof first !== 'object') return '';
    const line = Array.isArray(first.line) ? first.line.map((v) => String(v || '').trim()).filter(Boolean).join(' ') : '';
    return String(line || first.text || '').trim();
  }

  function buildViaAnnuaireRorLookupUrlsFromEndpoint(finess, endpoint) {
    const normalizedFiness = String(finess || '').trim();
    const normalizedEndpoint = normalizeViaAnnuaireRorEndpoint(endpoint);
    if (!normalizedFiness || !normalizedEndpoint) return [];
    const buildUrl = (pairs = []) => {
      const params = new URLSearchParams();
      pairs.forEach(([key, value]) => {
        if (!key || !String(value || '').trim()) return;
        params.set(String(key), String(value));
      });
      params.set('_count', '1');
      return `${normalizedEndpoint}/Organization?${params.toString()}`;
    };
    return [
      buildUrl([['identifier', normalizedFiness]]),
      buildUrl([['identifier', `urn:oid:1.2.250.1.71.4.2.2|${normalizedFiness}`]]),
      buildUrl([['identifier', `https://finess.esante.gouv.fr|${normalizedFiness}`]])
    ];
  }

  function getViaAnnuaireAuditBadgeMeta(status) {
    const key = String(status || '').trim();
    if (key === 'ok') return { label: 'OK', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    if (key === 'close') return { label: 'Proche', className: 'bg-cyan-100 text-cyan-800 border-cyan-200' };
    if (key === 'different') return { label: 'Different', className: 'bg-amber-100 text-amber-900 border-amber-200' };
    if (key === 'incomplete') return { label: 'Incomplet', className: 'bg-slate-100 text-slate-700 border-slate-200' };
    if (key === 'error') return { label: 'Erreur', className: 'bg-red-100 text-red-800 border-red-200' };
    return { label: 'Audit…', className: 'bg-blue-100 text-blue-800 border-blue-200' };
  }

  function computeViaAnnuaireAuditBreakdown(audit) {
    const counts = { ok: 0, close: 0, incomplete: 0, different: 0 };
    const fields = Array.isArray(audit?.fields) ? audit.fields : [];
    fields.forEach((field) => {
      const status = String(field?.status || '').trim();
      if (status === 'ok') counts.ok += 1;
      else if (status === 'close') counts.close += 1;
      else if (status === 'incomplete') counts.incomplete += 1;
      else if (status === 'different') counts.different += 1;
    });
    return counts;
  }

  function normalizeViaAnnuaireTextForMatch(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function matchesViaAnnuaireAnyToken(haystack, tokens = []) {
    if (!haystack || !tokens.length) return false;
    return tokens.some((token) => haystack.includes(token));
  }

  function isViaAnnuaireDomainMatch(item, domain) {
    const normalizedDomain = normalizeViaAnnuaireLiveDomain(domain);
    const searchable = normalizeViaAnnuaireTextForMatch([
      item?.name,
      item?.category,
      item?.mode,
      item?.speciality
    ].filter(Boolean).join(' '));
    if (!searchable) return false;
    const paTokens = [
      'ehpad', 'personnes agees', 'residence autonomie', 'usld', 'accueil de jour',
      'ssiad pa', 'hebergement personnes agees', 'maison de retraite'
    ];
    const phTokens = [
      'handicap', 'ime', 'iem', 'mas', 'fam', 'esat', 'sessad', 'samsah',
      'foyer accueil medicalise', 'foyer de vie', 'institut medico educatif',
      'deficient', 'polyhandicap'
    ];
    if (normalizedDomain === 'PH') {
      return matchesViaAnnuaireAnyToken(searchable, phTokens);
    }
    return matchesViaAnnuaireAnyToken(searchable, paTokens);
  }

  global.TaskMDACoreUtils = {
    normalizeTaskStatusValue,
    normalizeTaskStatusForCreate,
    normalizeSearch,
    normalizeCatalogKey,
    toYmd,
    normalizeDashboardHeroShortContentMaxChars,
    normalizeFeedSummaryWordCount,
    normalizeWorkspaceWideSections,
    normalizeTaskAutoArchiveMonths,
    normalizeProjectSortMode,
    normalizeSharingMode,
    normalizeProjectReadAccess,
    sharingModeLabel,
    normalizeProjectPriority,
    getProjectPriorityLabel,
    getProjectPriorityChipClass,
    normalizeWorkflowActionButtonsMode,
    normalizeWorkflowActionButtonsShape,
    normalizeTaskAutoArchiveSettings,
    formatFileSize,
    paginateItems,
    normalizeCalendarYmd,
    parseYmdLocalToDate,
    addDays,
    escapeHtml,
    escapeCsvValue,
    toCsv,
    formatExportDateTag,
    getInitials,
    stringToColor,
    normalizeActionButtonLabel,
    normalizeActionToken,
    normalizeViaAnnuaireLiveDomain,
    normalizeViaAnnuaireDepartmentCode,
    normalizeViaAnnuaireLiveSortKey,
    buildViaAnnuaireLiveResultRef,
    sortViaAnnuaireLiveResults,
    buildViaAnnuairePublicFicheUrl,
    normalizeViaAnnuaireComparableText,
    normalizeViaAnnuaireComparablePhone,
    normalizeViaAnnuaireComparableEmail,
    tokenizeViaAnnuaireComparableText,
    computeViaAnnuaireTokenOverlap,
    buildViaAnnuaireRecommendedAddress,
    computeViaAnnuaireDiceSimilarity,
    normalizeViaAnnuaireRorEndpoint,
    normalizeViaAnnuaireRorSettings,
    extractViaAnnuaireRorEmailFromOrganization,
    extractViaAnnuaireRorEmailFromPayload,
    extractViaAnnuaireRorOrganizationFromPayload,
    extractViaAnnuaireRorTelecomValue,
    extractViaAnnuaireRorOrganizationAddress,
    buildViaAnnuaireRorLookupUrlsFromEndpoint,
    getViaAnnuaireAuditBadgeMeta,
    computeViaAnnuaireAuditBreakdown,
    normalizeViaAnnuaireTextForMatch,
    matchesViaAnnuaireAnyToken,
    isViaAnnuaireDomainMatch
  };
}(window));
