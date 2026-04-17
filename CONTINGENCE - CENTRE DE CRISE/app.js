/**
 * Contingence Local - Application de Gestion de Plans de Contingence
 *
 * @author Frédérick MURAT
 * @license MIT
 * @year 2026
 * @description Application web locale de gestion de plans de contingence
 *              avec sauvegarde automatique via File System Access API
 */

const {
  addAuditLog,
  addExportHistory,
  clearPlans,
  deletePlan,
  getPlan,
  getSetting,
  listAllSettings,
  listPlans,
  setSetting,
  upsertPlan
} = window.DBAPI;

const APP_SCHEMA_VERSION = 1;
const APP_VERSION = "1.0.0";

const CATEGORIES = [
  { value: "cyberattaque", label: "Cyberattaque / perte de données" },
  { value: "panne-it", label: "Panne informatique majeure" },
  { value: "reseau-telecom", label: "Indisponibilité réseau / télécom" },
  { value: "sinistre-batiment", label: "Sinistre bâtiment" },
  { value: "indispo-personnel", label: "Indisponibilité massive du personnel" },
  { value: "catastrophe-naturelle", label: "Catastrophe naturelle" },
  { value: "crise-securitaire", label: "Crise sécuritaire" },
  { value: "prestataire-critique", label: "Défaillance prestataire critique" },
  { value: "rupture-energetique", label: "Rupture énergétique" },
  { value: "libre", label: "Plan libre / personnalisé" }
];

const CRITICALITIES = [
  { value: "basse", label: "Basse" },
  { value: "moyenne", label: "Moyenne" },
  { value: "haute", label: "Haute" },
  { value: "critique", label: "Critique" }
];

const PRIORITIES = [
  { value: 1, label: "1 - Très basse" },
  { value: 2, label: "2 - Basse" },
  { value: 3, label: "3 - Moyenne" },
  { value: 4, label: "4 - Haute" },
  { value: 5, label: "5 - Critique" }
];

const STATUSES = [
  { value: "brouillon", label: "Brouillon" },
  { value: "valide", label: "Validé" },
  { value: "archive", label: "Archivé" }
];

// Mapping criticality to numeric value for score calculation
const CRITICALITY_WEIGHT = {
  "basse": 1,
  "moyenne": 2,
  "haute": 3,
  "critique": 4
};

const initialState = {
  plans: [],
  selectedId: null,
  search: "",
  filterCategory: "all",
  filterCriticality: "all",
  filterStatus: "all",
  sortBy: "updatedAt", // updatedAt | crisisScore | priority
  pendingImport: null,
  currentView: "plans", // default view
  activeCrisisPlanId: null, // ID du plan actif en mode crise
  crisisActivatedAt: null // Timestamp d'activation du mode crise
};

const state = { ...initialState };

// Crisis timer interval ID
let crisisTimerInterval = null;

// Elements cache
const el = {
  form: document.getElementById("planForm"),
  editorTitle: document.getElementById("editorTitle"),
  plansList: document.getElementById("plansList"),
  saveReminder: document.getElementById("saveReminder"),
  importPreview: document.getElementById("importPreview"),
  errorBox: document.getElementById("errorBox"),
  searchInput: document.getElementById("searchInput"),
  filterCategory: document.getElementById("filterCategory"),
  filterCriticality: document.getElementById("filterCriticality"),
  filterStatus: document.getElementById("filterStatus"),
  sortBy: document.getElementById("sortBy"),
  globalSearch: document.getElementById("globalSearch"),

  // Navigation
  sideNav: document.getElementById("sideNav"),

  // Views
  viewDashboard: document.getElementById("viewDashboard"),
  viewPlans: document.getElementById("viewPlans"),
  viewEditor: document.getElementById("viewEditor"),
  viewCrisis: document.getElementById("viewCrisis"),
  viewConflicts: document.getElementById("viewConflicts"),
  viewSettings: document.getElementById("viewSettings"),
  conflictsContent: document.getElementById("conflictsContent"),

  // Dashboard elements
  statTotalPlans: document.getElementById("statTotalPlans"),
  statCriticalPlans: document.getElementById("statCriticalPlans"),
  statMaxScore: document.getElementById("statMaxScore"),
  statMaxScoreMeta: document.getElementById("statMaxScoreMeta"),
  statLastBackup: document.getElementById("statLastBackup"),
  statBackupMeta: document.getElementById("statBackupMeta"),
  dashboardEmergencyBtn: document.getElementById("dashboardEmergencyBtn"),
  dashboardNewPlanBtn: document.getElementById("dashboardNewPlanBtn"),
  dashboardExportBtn: document.getElementById("dashboardExportBtn"),
  dashboardImportBtn: document.getElementById("dashboardImportBtn"),

  // Buttons - Top actions
  newIncidentBtn: document.getElementById("newIncidentBtn"),
  emergencyBtn: document.getElementById("emergencyBtn"),
  plansNewBtn: document.getElementById("plansNewBtn"),

  // Buttons - Editor actions
  saveBtn: document.getElementById("saveBtn"),
  duplicateBtn: document.getElementById("duplicateBtn"),
  archiveBtn: document.getElementById("archiveBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
  exportOneBtn: document.getElementById("exportOneBtn"),
  exportOneExcelBtn: document.getElementById("exportOneExcelBtn"),
  exportOnePdfBtn: document.getElementById("exportOnePdfBtn"),
  printBtn: document.getElementById("printBtn"),
  resetBtn: document.getElementById("resetBtn"),

  // Buttons - Global exports
  exportAllBtn: document.getElementById("exportAllBtn"),
  exportAllExcelBtn: document.getElementById("exportAllExcelBtn"),
  exportAllPdfBtn: document.getElementById("exportAllPdfBtn"),
  importFile: document.getElementById("importFile"),

  // Branding elements
  settingAppName: document.getElementById("settingAppName"),
  settingAppSubtitle: document.getElementById("settingAppSubtitle"),
  saveBrandingBtn: document.getElementById("saveBrandingBtn"),
  resetBrandingBtn: document.getElementById("resetBrandingBtn"),
  brandingPreview: document.getElementById("brandingPreview"),

  // Help modal
  helpBtn: document.getElementById("helpBtn"),
  helpModal: document.getElementById("helpModal"),
  closeHelpModal: document.getElementById("closeHelpModal"),
  helpModalOverlay: document.getElementById("helpModalOverlay"),
  appVersionDisplay: document.getElementById("appVersionDisplay"),

  // Notifications
  notificationsBtn: document.getElementById("notificationsBtn"),

  // FSA elements
  fsaStatusIndicator: document.getElementById("fsaStatusIndicator"),
  fsaStatusIcon: document.getElementById("fsaStatusIcon"),
  fsaStatusLabel: document.getElementById("fsaStatusLabel"),
  fsaNotSupported: document.getElementById("fsaNotSupported"),
  fsaConnected: document.getElementById("fsaConnected"),
  fsaDisconnected: document.getElementById("fsaDisconnected"),
  fsaStatusText: document.getElementById("fsaStatusText"),
  fsaFolderName: document.getElementById("fsaFolderName"),
  fsaLinkBtn: document.getElementById("fsaLinkBtn"),
  fsaUnlinkBtn: document.getElementById("fsaUnlinkBtn"),
  fsaBackupNowBtn: document.getElementById("fsaBackupNowBtn"),

  // Crisis mode
  urgencyContent: document.getElementById("urgencyContent"),
  closeCrisisBtn: document.getElementById("closeCrisisBtn"),
  urgencyTemplate: document.getElementById("urgencyTemplate"),

  // Form fields
  fields: {
    id: document.getElementById("planId"),
    title: document.getElementById("planTitle"),
    category: document.getElementById("planCategory"),
    criticality: document.getElementById("planCriticality"),
    priority: document.getElementById("planPriority"),
    status: document.getElementById("planStatus"),
    updatedAt: document.getElementById("planUpdatedAt"),
    summary: document.getElementById("planSummary"),
    scenario: document.getElementById("planScenario"),
    triggers: document.getElementById("planTriggers"),
    impacts: document.getElementById("planImpacts"),
    services: document.getElementById("planServices"),
    roles: document.getElementById("planRoles"),
    immediateActions: document.getElementById("planImmediate"),
    continuityActions: document.getElementById("planContinuity"),
    recoveryActions: document.getElementById("planRecovery"),
    contacts: document.getElementById("planContacts"),
    resources: document.getElementById("planResources"),
    checklists: document.getElementById("planChecklist"),
    attachments: document.getElementById("planAttachments"),
    decisionMatrix: document.getElementById("planDecisionMatrix"),
    communicationChannels: document.getElementById("planCommunicationChannels"),
    exitCriteria: document.getElementById("planExitCriteria")
  }
};

const categoryLabelByValue = Object.fromEntries(CATEGORIES.map((x) => [x.value, x.label]));
const criticalityLabelByValue = Object.fromEntries(CRITICALITIES.map((x) => [x.value, x.label]));
const priorityLabelByValue = Object.fromEntries(PRIORITIES.map((x) => [x.value, x.label]));
const statusLabelByValue = Object.fromEntries(STATUSES.map((x) => [x.value, x.label]));

// ============================================
// ROUTING SYSTEM
// ============================================

function navigateTo(view) {
  state.currentView = view;

  // Scroll to top when changing view
  window.scrollTo(0, 0);

  // Hide all views
  el.viewDashboard?.classList.add("hidden");
  el.viewPlans?.classList.add("hidden");
  el.viewEditor?.classList.add("hidden");
  el.viewCrisis?.classList.add("hidden");
  el.viewConflicts?.classList.add("hidden");
  el.viewSettings?.classList.add("hidden");

  // Update Crisis Mode indicator
  const crisisIndicator = document.getElementById("crisisModeIndicator");
  if (crisisIndicator) {
    if (view === "crisis") {
      crisisIndicator.style.display = "flex";
    } else {
      crisisIndicator.style.display = "none";
    }
  }

  // Show active view
  switch (view) {
    case "dashboard":
      el.viewDashboard?.classList.remove("hidden");
      renderDashboard();
      break;
    case "plans":
      el.viewPlans?.classList.remove("hidden");
      renderPlansList();
      break;
    case "editor":
      el.viewEditor?.classList.remove("hidden");
      fillForm(getSelectedPlan() || createEmptyPlan());
      break;
    case "crisis":
      el.viewCrisis?.classList.remove("hidden");
      renderUrgency();
      break;
    case "conflicts":
      el.viewConflicts?.classList.remove("hidden");
      renderConflicts();
      break;
    case "settings":
      el.viewSettings?.classList.remove("hidden");
      break;
    default:
      el.viewPlans?.classList.remove("hidden");
      renderPlansList();
  }

  // Update active nav item
  updateActiveNav(view);

  // Update hash
  if (window.location.hash !== `#${view}`) {
    window.location.hash = view;
  }
}

function updateActiveNav(view) {
  const navItems = document.querySelectorAll(".sidenav-item");
  navItems.forEach((item) => {
    const itemView = item.getAttribute("data-view");
    if (itemView === view) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

function handleHashChange() {
  const hash = window.location.hash.slice(1);
  const validViews = ["dashboard", "plans", "editor", "crisis", "conflicts", "settings", "support"];
  const view = validViews.includes(hash) ? hash : "plans";
  navigateTo(view);
}

// ============================================
// DASHBOARD RENDERING
// ============================================

async function renderDashboard() {
  // Total plans
  if (el.statTotalPlans) {
    el.statTotalPlans.textContent = state.plans.length;
  }

  // Critical plans
  if (el.statCriticalPlans) {
    const criticalCount = state.plans.filter(p => p.criticality === "critique").length;
    el.statCriticalPlans.textContent = criticalCount;
  }

  // Maximum Crisis Score (Phase 2)
  if (el.statMaxScore && el.statMaxScoreMeta) {
    if (state.plans.length > 0) {
      const scores = state.plans.map(p => calculateCrisisScore(p));
      const maxScore = Math.max(...scores);
      const maxPlan = state.plans.find(p => calculateCrisisScore(p) === maxScore);

      el.statMaxScore.textContent = maxScore;
      if (maxPlan) {
        const scoreLabel = getScoreLabel(maxScore);
        el.statMaxScoreMeta.textContent = `${scoreLabel} - ${maxPlan.title}`;
      } else {
        el.statMaxScoreMeta.textContent = "Score de crise le plus élevé";
      }
    } else {
      el.statMaxScore.textContent = "0";
      el.statMaxScoreMeta.textContent = "Aucun plan enregistré";
    }
  }

  // Last backup
  const lastBackupAt = await getSetting("lastBackupAt");
  if (el.statLastBackup && el.statBackupMeta) {
    if (lastBackupAt) {
      const date = new Date(lastBackupAt);
      el.statLastBackup.textContent = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      el.statBackupMeta.textContent = `Dernière sauvegarde: ${date.toLocaleDateString("fr-FR")}`;
    } else {
      el.statLastBackup.textContent = "--:--";
      el.statBackupMeta.textContent = "Aucune sauvegarde détectée";
    }
  }
}

// ============================================
// CONFLICTS ANALYSIS (Phase 2)
// ============================================

/**
 * Analyze resource conflicts across plans
 * Detects when the same person is responsible in multiple critical plans
 */
function analyzeResourceConflicts() {
  // Map: person name -> array of {plan, role}
  const resourceMap = new Map();

  // Analyze roles in each plan
  state.plans.forEach(plan => {
    // Skip archived plans
    if (plan.status === "archive") return;

    // Analyze roles
    if (Array.isArray(plan.roles)) {
      plan.roles.forEach(role => {
        const name = (role.role || "").trim();
        if (!name) return;

        if (!resourceMap.has(name)) {
          resourceMap.set(name, []);
        }
        resourceMap.get(name).push({
          plan: plan,
          responsibility: role.responsibility,
          type: "role"
        });
      });
    }

    // Analyze decision matrix
    if (Array.isArray(plan.decisionMatrix)) {
      plan.decisionMatrix.forEach(decision => {
        const responsibleName = (decision.responsible || "").trim();
        const backupName = (decision.backup || "").trim();

        if (responsibleName) {
          if (!resourceMap.has(responsibleName)) {
            resourceMap.set(responsibleName, []);
          }
          resourceMap.get(responsibleName).push({
            plan: plan,
            responsibility: `Décision: ${decision.decision}`,
            type: "decision"
          });
        }

        if (backupName) {
          if (!resourceMap.has(backupName)) {
            resourceMap.set(backupName, []);
          }
          resourceMap.get(backupName).push({
            plan: plan,
            responsibility: `Backup décision: ${decision.decision}`,
            type: "backup"
          });
        }
      });
    }

    // Analyze contacts
    if (Array.isArray(plan.contacts)) {
      plan.contacts.forEach(contact => {
        const name = (contact.name || "").trim();
        if (!name) return;

        if (!resourceMap.has(name)) {
          resourceMap.set(name, []);
        }
        resourceMap.get(name).push({
          plan: plan,
          responsibility: "Contact stratégique",
          type: "contact"
        });
      });
    }
  });

  // Identify conflicts (person in multiple critical/high priority plans)
  const conflicts = [];
  resourceMap.forEach((assignments, personName) => {
    if (assignments.length > 1) {
      // Count critical plans
      const criticalCount = assignments.filter(a => a.plan.criticality === "critique").length;
      const highPriorityCount = assignments.filter(a => (a.plan.priority || 3) >= 4).length;

      if (criticalCount > 1 || highPriorityCount > 1) {
        conflicts.push({
          personName,
          assignments,
          criticalCount,
          highPriorityCount,
          totalPlans: assignments.length,
          severity: criticalCount > 1 ? "high" : "medium"
        });
      }
    }
  });

  // Sort by severity
  conflicts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === "high" ? -1 : 1;
    }
    return b.totalPlans - a.totalPlans;
  });

  return conflicts;
}

/**
 * Render conflicts view
 */
function renderConflicts() {
  if (!el.conflictsContent) return;

  const conflicts = analyzeResourceConflicts();

  if (conflicts.length === 0) {
    el.conflictsContent.innerHTML = `
      <div class="card" style="padding: var(--spacing-8); text-align: center;">
        <span class="material-symbols-outlined" style="font-size: 64px; color: var(--primary); margin-bottom: var(--spacing-4);">check_circle</span>
        <h3 class="headline-md" style="margin-bottom: var(--spacing-2);">Aucun conflit détecté</h3>
        <p class="body-md text-muted">Toutes les ressources humaines sont correctement réparties entre les plans.</p>
      </div>
    `;
    return;
  }

  const conflictsHtml = conflicts.map(conflict => {
    const severityBadge = conflict.severity === "high"
      ? `<span class="badge badge-error">Critique</span>`
      : `<span class="badge badge-warning">Modéré</span>`;

    const assignmentsHtml = conflict.assignments.map(assignment => {
      const score = calculateCrisisScore(assignment.plan);
      const scoreBadge = getScoreBadgeClass(score);

      return `
        <div style="padding: var(--spacing-3); background: var(--surface-container-low); border-radius: var(--border-radius-md); margin-bottom: var(--spacing-2);">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--spacing-1);">
            <strong class="body-md">${escapeHtml(assignment.plan.title)}</strong>
            <span class="badge ${scoreBadge}">Score ${score}</span>
          </div>
          <p class="body-sm text-muted">${escapeHtml(assignment.responsibility)}</p>
          <div style="display: flex; gap: var(--spacing-2); margin-top: var(--spacing-1);">
            <span class="label-sm">${escapeHtml(criticalityLabelByValue[assignment.plan.criticality])}</span>
            <span class="label-sm">Priorité ${assignment.plan.priority || 3}</span>
            <span class="label-sm">${escapeHtml(assignment.type)}</span>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="card" style="padding: var(--spacing-6); margin-bottom: var(--spacing-4);">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--spacing-4);">
          <div>
            <h3 class="headline-md" style="margin-bottom: var(--spacing-2);">${escapeHtml(conflict.personName)}</h3>
            <p class="body-sm text-muted">Sollicité sur ${conflict.totalPlans} plan${conflict.totalPlans > 1 ? "s" : ""} · ${conflict.criticalCount} critique${conflict.criticalCount > 1 ? "s" : ""} · ${conflict.highPriorityCount} haute priorité</p>
          </div>
          ${severityBadge}
        </div>
        ${assignmentsHtml}
      </div>
    `;
  }).join("");

  el.conflictsContent.innerHTML = `
    <div class="card" style="padding: var(--spacing-6); margin-bottom: var(--spacing-6); background: linear-gradient(135deg, var(--error-container), var(--surface-container));">
      <div style="display: flex; align-items: center; gap: var(--spacing-4);">
        <span class="material-symbols-outlined filled" style="font-size: 48px; color: var(--error);">flag</span>
        <div>
          <h3 class="headline-md" style="margin-bottom: var(--spacing-1);">${conflicts.length} Conflit${conflicts.length > 1 ? "s" : ""} Détecté${conflicts.length > 1 ? "s" : ""}</h3>
          <p class="body-md">Ressources humaines sollicitées sur plusieurs plans critiques simultanément</p>
        </div>
      </div>
    </div>
    ${conflictsHtml}
  `;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function nowIso() {
  return new Date().toISOString();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Calculate Crisis Score (Phase 2)
 * Formula: criticality_weight × priority × impact_count
 *
 * @param {Object} plan - The plan object
 * @returns {number} - Crisis score (0-100)
 */
function calculateCrisisScore(plan) {
  if (!plan) return 0;

  const criticalityWeight = CRITICALITY_WEIGHT[plan.criticality] || 2;
  const priority = plan.priority || 3;
  const impactCount = Array.isArray(plan.impacts) ? plan.impacts.length : 0;

  // Base score: criticality (1-4) × priority (1-5) × impacts (0-N)
  const baseScore = criticalityWeight * priority * Math.min(impactCount, 5);

  // Normalize to 0-100 scale
  // Max theoretical: 4 × 5 × 5 = 100
  return Math.min(baseScore, 100);
}

/**
 * Get crisis score badge class
 */
function getScoreBadgeClass(score) {
  if (score >= 75) return "badge-error"; // Rouge
  if (score >= 50) return "badge-warning"; // Orange
  if (score >= 25) return "badge-info"; // Bleu
  return "badge-success"; // Vert
}

/**
 * Get crisis score label
 */
function getScoreLabel(score) {
  if (score >= 75) return "Critique";
  if (score >= 50) return "Élevé";
  if (score >= 25) return "Modéré";
  return "Faible";
}

function optionHtml(value, label) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function setSelectOptions(select, options, withAll = false) {
  if (!select) return;
  const all = withAll ? [optionHtml("all", "Tous")] : [];
  const optionNodes = options.map((o) => optionHtml(o.value, o.label));
  select.innerHTML = all.concat(optionNodes).join("");
}

function listToMultiline(list) {
  return Array.isArray(list) ? list.join("\n") : "";
}

function multilineToList(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function rolesToMultiline(roles) {
  if (!Array.isArray(roles)) {
    return "";
  }
  return roles.map((r) => `${r.role || ""} | ${r.responsibility || ""}`).join("\n");
}

function multilineToRoles(text) {
  return multilineToList(text).map((line) => {
    const [role = "", responsibility = ""] = line.split("|").map((x) => x.trim());
    return { role, responsibility };
  });
}

function contactsToMultiline(contacts) {
  if (!Array.isArray(contacts)) {
    return "";
  }
  return contacts
    .map((c) => `${c.name || ""} | ${c.phone || ""} | ${c.email || ""}`)
    .join("\n");
}

function multilineToContacts(text) {
  return multilineToList(text).map((line) => {
    const [name = "", phone = "", email = ""] = line.split("|").map((x) => x.trim());
    return { name, phone, email };
  });
}

function checklistsToMultiline(checklists) {
  if (!Array.isArray(checklists)) {
    return "";
  }
  return checklists
    .map((c) => `${c.title || "Phase"}: ${(c.items || []).join("; ")}`)
    .join("\n");
}

function multilineToChecklists(text) {
  return multilineToList(text).map((line) => {
    const [title = "Phase", rawItems = ""] = line.split(":");
    const items = rawItems
      .split(";")
      .map((i) => i.trim())
      .filter(Boolean);
    return { title: title.trim(), items };
  });
}

function decisionMatrixToMultiline(matrix) {
  if (!Array.isArray(matrix)) {
    return "";
  }
  return matrix
    .map((d) => `${d.decision || ""} | ${d.responsible || ""} | ${d.backup || ""}`)
    .join("\n");
}

function multilineToDecisionMatrix(text) {
  return multilineToList(text).map((line) => {
    const [decision = "", responsible = "", backup = ""] = line.split("|").map((x) => x.trim());
    return { decision, responsible, backup };
  });
}

function communicationChannelsToMultiline(channels) {
  if (!Array.isArray(channels)) {
    return "";
  }
  return channels
    .map((c) => `${c.type || ""} | ${c.frequency || ""} | ${c.recipients || ""} | ${c.template || ""}`)
    .join("\n");
}

function multilineToCommunicationChannels(text) {
  return multilineToList(text).map((line) => {
    const [type = "", frequency = "", recipients = "", template = ""] = line.split("|").map((x) => x.trim());
    return { type, frequency, recipients, template };
  });
}

function exitCriteriaToMultiline(criteria) {
  if (!Array.isArray(criteria)) {
    return "";
  }
  return criteria
    .map((e) => `${e.criterion || ""} | ${e.indicator || ""} | ${e.target || ""}`)
    .join("\n");
}

function multilineToExitCriteria(text) {
  return multilineToList(text).map((line) => {
    const [criterion = "", indicator = "", target = ""] = line.split("|").map((x) => x.trim());
    return { criterion, indicator, target };
  });
}

function createEmptyPlan() {
  const id = `plan-${Date.now()}`;
  return {
    id,
    title: "",
    category: CATEGORIES[0].value,
    criticality: CRITICALITIES[1].value,
    status: STATUSES[0].value,
    priority: 3, // 1=Très basse, 2=Basse, 3=Moyenne, 4=Haute, 5=Critique
    summary: "",
    scenario: "",
    triggers: [],
    impacts: [],
    services: [],
    roles: [],
    immediateActions: [],
    continuityActions: [],
    recoveryActions: [],
    contacts: [],
    resources: [],
    checklists: [],
    attachments: [],
    decisionMatrix: [], // [{decision: "", responsible: "", backup: ""}]
    communicationChannels: [], // [{type: "", frequency: "", recipients: "", template: ""}]
    exitCriteria: [], // [{criterion: "", indicator: "", target: ""}]
    version: 1,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function normalizePlan(input) {
  const base = createEmptyPlan();
  const plan = { ...base, ...input };
  plan.id = String(plan.id || "").trim();
  plan.title = String(plan.title || "").trim();
  plan.category = String(plan.category || base.category).trim();
  plan.criticality = String(plan.criticality || base.criticality).trim();
  plan.status = String(plan.status || base.status).trim();
  plan.priority = Number.isFinite(plan.priority) && plan.priority >= 1 && plan.priority <= 5 ? plan.priority : 3;
  plan.summary = String(plan.summary || "");
  plan.scenario = String(plan.scenario || "");
  plan.triggers = Array.isArray(plan.triggers) ? plan.triggers.map(String) : [];
  plan.impacts = Array.isArray(plan.impacts) ? plan.impacts.map(String) : [];
  plan.services = Array.isArray(plan.services) ? plan.services.map(String) : [];
  plan.roles = Array.isArray(plan.roles)
    ? plan.roles.map((r) => ({
        role: String(r.role || ""),
        responsibility: String(r.responsibility || "")
      }))
    : [];
  plan.immediateActions = Array.isArray(plan.immediateActions)
    ? plan.immediateActions.map(String)
    : [];
  plan.continuityActions = Array.isArray(plan.continuityActions)
    ? plan.continuityActions.map(String)
    : [];
  plan.recoveryActions = Array.isArray(plan.recoveryActions)
    ? plan.recoveryActions.map(String)
    : [];
  plan.contacts = Array.isArray(plan.contacts)
    ? plan.contacts.map((c) => ({
        name: String(c.name || ""),
        phone: String(c.phone || ""),
        email: String(c.email || "")
      }))
    : [];
  plan.resources = Array.isArray(plan.resources) ? plan.resources.map(String) : [];
  plan.checklists = Array.isArray(plan.checklists)
    ? plan.checklists.map((c) => ({
        title: String(c.title || "Phase"),
        items: Array.isArray(c.items) ? c.items.map(String) : []
      }))
    : [];
  plan.attachments = Array.isArray(plan.attachments) ? plan.attachments.map(String) : [];
  plan.decisionMatrix = Array.isArray(plan.decisionMatrix)
    ? plan.decisionMatrix.map((d) => ({
        decision: String(d.decision || ""),
        responsible: String(d.responsible || ""),
        backup: String(d.backup || "")
      }))
    : [];
  plan.communicationChannels = Array.isArray(plan.communicationChannels)
    ? plan.communicationChannels.map((c) => ({
        type: String(c.type || ""),
        frequency: String(c.frequency || ""),
        recipients: String(c.recipients || ""),
        template: String(c.template || "")
      }))
    : [];
  plan.exitCriteria = Array.isArray(plan.exitCriteria)
    ? plan.exitCriteria.map((e) => ({
        criterion: String(e.criterion || ""),
        indicator: String(e.indicator || ""),
        target: String(e.target || "")
      }))
    : [];
  plan.version = Number.isFinite(plan.version) ? plan.version : 1;
  plan.createdAt = plan.createdAt || nowIso();
  plan.updatedAt = plan.updatedAt || nowIso();
  return plan;
}

function validatePlanShape(plan) {
  if (!plan || typeof plan !== "object") {
    return "Plan invalide: objet attendu.";
  }
  if (!String(plan.id || "").trim()) {
    return "Plan invalide: id manquant.";
  }
  if (!String(plan.title || "").trim()) {
    return "Plan invalide: titre manquant.";
  }
  if (!Array.isArray(plan.immediateActions)) {
    return "Plan invalide: immediateActions doit être un tableau.";
  }
  if (!Array.isArray(plan.contacts)) {
    return "Plan invalide: contacts doit être un tableau.";
  }
  return null;
}

function showError(message) {
  if (!message) {
    el.errorBox?.classList.add("hidden");
    if (el.errorBox) el.errorBox.textContent = "";
    return;
  }
  if (el.errorBox) {
    el.errorBox.textContent = message;
    el.errorBox.classList.remove("hidden");
  }
}

function showWarning(message) {
  if (!message) {
    el.saveReminder?.classList.add("hidden");
    if (el.saveReminder) el.saveReminder.textContent = "";
    return;
  }
  if (el.saveReminder) {
    el.saveReminder.className = "banner banner-warning";
    el.saveReminder.textContent = message;
    el.saveReminder.classList.remove("hidden");
  }
}

function showInfo(message) {
  if (!message) {
    el.saveReminder?.classList.add("hidden");
    if (el.saveReminder) el.saveReminder.textContent = "";
    return;
  }
  if (el.saveReminder) {
    el.saveReminder.className = "banner banner-info";
    el.saveReminder.textContent = message;
    el.saveReminder.classList.remove("hidden");

    // Auto-hide after 5 seconds
    setTimeout(() => {
      el.saveReminder?.classList.add("hidden");
    }, 5000);
  }
}

function filteredPlans() {
  const q = state.search.trim().toLowerCase();

  const filtered = state.plans
    .filter((plan) => (state.filterCategory === "all" ? true : plan.category === state.filterCategory))
    .filter((plan) =>
      state.filterCriticality === "all" ? true : plan.criticality === state.filterCriticality
    )
    .filter((plan) => (state.filterStatus === "all" ? true : plan.status === state.filterStatus))
    .filter((plan) => {
      if (!q) {
        return true;
      }
      const bag = [
        plan.id,
        plan.title,
        plan.summary,
        plan.scenario,
        ...(plan.immediateActions || []),
        ...(plan.services || [])
      ]
        .join(" ")
        .toLowerCase();
      return bag.includes(q);
    });

  // Sort based on sortBy state (Phase 2)
  if (state.sortBy === "crisisScore") {
    return filtered.sort((a, b) => calculateCrisisScore(b) - calculateCrisisScore(a));
  } else if (state.sortBy === "priority") {
    return filtered.sort((a, b) => (b.priority || 3) - (a.priority || 3));
  } else {
    // Default: sort by updatedAt
    return filtered.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
}

function getBadgeClass(criticality) {
  switch (criticality) {
    case "critique":
      return "badge-error";
    case "haute":
      return "badge-warning";
    case "moyenne":
      return "badge-neutral";
    case "basse":
      return "badge-neutral";
    default:
      return "badge-neutral";
  }
}

function renderPlansList() {
  const plans = filteredPlans();
  if (plans.length === 0) {
    el.plansList.innerHTML = `<li class="empty" style="padding: var(--spacing-6); text-align: center; color: var(--on-surface-variant);">Aucun plan trouvé</li>`;
    return;
  }

  const html = plans
    .map((plan) => {
      const active = plan.id === state.selectedId ? "active" : "";
      const badgeClass = getBadgeClass(plan.criticality);
      const crisisScore = calculateCrisisScore(plan);
      const scoreBadgeClass = getScoreBadgeClass(crisisScore);
      const scoreLabel = getScoreLabel(crisisScore);

      return `<li>
        <button type="button" class="plan-item ${active}" data-id="${escapeHtml(plan.id)}">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--spacing-2);">
            <strong class="title-lg">${escapeHtml(plan.title || plan.id)}</strong>
            <div style="display: flex; gap: var(--spacing-2);">
              <span class="badge ${scoreBadgeClass}" style="font-weight: 700;">Score ${crisisScore}</span>
              <span class="badge ${badgeClass}">${escapeHtml(criticalityLabelByValue[plan.criticality] || plan.criticality)}</span>
            </div>
          </div>
          <span class="body-md text-muted" style="display: block; margin-bottom: var(--spacing-1);">${escapeHtml(categoryLabelByValue[plan.category] || plan.category)} · ${escapeHtml(statusLabelByValue[plan.status] || plan.status)} · Priorité ${plan.priority || 3} · ${scoreLabel}</span>
          <small class="label-sm text-muted">MàJ ${escapeHtml(new Date(plan.updatedAt).toLocaleDateString("fr-FR"))}</small>
        </button>
      </li>`;
    })
    .join("");

  el.plansList.innerHTML = html;
}

function getSelectedPlan() {
  return state.plans.find((p) => p.id === state.selectedId) || null;
}

function fillForm(plan) {
  const p = normalizePlan(plan || createEmptyPlan());

  if (el.fields.id) el.fields.id.value = p.id;
  if (el.fields.title) el.fields.title.value = p.title;
  if (el.fields.category) el.fields.category.value = p.category;
  if (el.fields.criticality) el.fields.criticality.value = p.criticality;
  if (el.fields.priority) el.fields.priority.value = p.priority;
  if (el.fields.status) el.fields.status.value = p.status;
  if (el.fields.updatedAt) el.fields.updatedAt.value = new Date(p.updatedAt).toLocaleString("fr-FR");
  if (el.fields.summary) el.fields.summary.value = p.summary;
  if (el.fields.scenario) el.fields.scenario.value = p.scenario;
  if (el.fields.triggers) el.fields.triggers.value = listToMultiline(p.triggers);
  if (el.fields.impacts) el.fields.impacts.value = listToMultiline(p.impacts);
  if (el.fields.services) el.fields.services.value = listToMultiline(p.services);
  if (el.fields.roles) el.fields.roles.value = rolesToMultiline(p.roles);
  if (el.fields.immediateActions) el.fields.immediateActions.value = listToMultiline(p.immediateActions);
  if (el.fields.continuityActions) el.fields.continuityActions.value = listToMultiline(p.continuityActions);
  if (el.fields.recoveryActions) el.fields.recoveryActions.value = listToMultiline(p.recoveryActions);
  if (el.fields.contacts) el.fields.contacts.value = contactsToMultiline(p.contacts);
  if (el.fields.resources) el.fields.resources.value = listToMultiline(p.resources);
  if (el.fields.checklists) el.fields.checklists.value = checklistsToMultiline(p.checklists);
  if (el.fields.attachments) el.fields.attachments.value = listToMultiline(p.attachments);
  if (el.fields.decisionMatrix) el.fields.decisionMatrix.value = decisionMatrixToMultiline(p.decisionMatrix);
  if (el.fields.communicationChannels) el.fields.communicationChannels.value = communicationChannelsToMultiline(p.communicationChannels);
  if (el.fields.exitCriteria) el.fields.exitCriteria.value = exitCriteriaToMultiline(p.exitCriteria);
  if (el.editorTitle) el.editorTitle.textContent = p.title ? `${p.title}` : "Nouveau Plan";
}

function planFromForm() {
  const existing = getSelectedPlan();
  const createdAt = existing?.createdAt || nowIso();
  const version = existing ? existing.version + 1 : 1;

  return normalizePlan({
    id: el.fields.id.value.trim(),
    title: el.fields.title.value.trim(),
    category: el.fields.category.value,
    criticality: el.fields.criticality.value,
    priority: parseInt(el.fields.priority.value, 10),
    status: el.fields.status.value,
    summary: el.fields.summary.value.trim(),
    scenario: el.fields.scenario.value.trim(),
    triggers: multilineToList(el.fields.triggers.value),
    impacts: multilineToList(el.fields.impacts.value),
    services: multilineToList(el.fields.services.value),
    roles: multilineToRoles(el.fields.roles.value),
    immediateActions: multilineToList(el.fields.immediateActions.value),
    continuityActions: multilineToList(el.fields.continuityActions.value),
    recoveryActions: multilineToList(el.fields.recoveryActions.value),
    contacts: multilineToContacts(el.fields.contacts.value),
    resources: multilineToList(el.fields.resources.value),
    checklists: multilineToChecklists(el.fields.checklists.value),
    attachments: multilineToList(el.fields.attachments.value),
    decisionMatrix: multilineToDecisionMatrix(el.fields.decisionMatrix.value),
    communicationChannels: multilineToCommunicationChannels(el.fields.communicationChannels.value),
    exitCriteria: multilineToExitCriteria(el.fields.exitCriteria.value),
    createdAt,
    updatedAt: nowIso(),
    version
  });
}

async function refreshPlansAndRender() {
  state.plans = (await listPlans()).map(normalizePlan);
  if (!state.selectedId && state.plans.length > 0) {
    state.selectedId = state.plans[0].id;
  }
  if (state.selectedId && !state.plans.some((p) => p.id === state.selectedId)) {
    state.selectedId = state.plans.length ? state.plans[0].id : null;
  }

  // Render current view
  if (state.currentView === "plans") {
    renderPlansList();
  } else if (state.currentView === "editor") {
    fillForm(getSelectedPlan() || createEmptyPlan());
  } else if (state.currentView === "crisis") {
    renderUrgency();
  } else if (state.currentView === "dashboard") {
    renderDashboard();
  }

  await renderSaveReminder();
}

async function addAudit(action, details = {}) {
  await addAuditLog({
    at: nowIso(),
    action,
    details
  });
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  downloadBlob(filename, blob);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
}

function flattenPlanForCsv(plan) {
  return {
    id: plan.id,
    title: plan.title,
    category: categoryLabelByValue[plan.category] || plan.category,
    criticality: criticalityLabelByValue[plan.criticality] || plan.criticality,
    priority: priorityLabelByValue[plan.priority] || plan.priority || 3,
    status: statusLabelByValue[plan.status] || plan.status,
    summary: plan.summary || "",
    scenario: plan.scenario || "",
    triggers: (plan.triggers || []).join(" | "),
    impacts: (plan.impacts || []).join(" | "),
    services: (plan.services || []).join(" | "),
    roles: (plan.roles || []).map((r) => `${r.role}: ${r.responsibility}`).join(" | "),
    immediateActions: (plan.immediateActions || []).join(" | "),
    continuityActions: (plan.continuityActions || []).join(" | "),
    recoveryActions: (plan.recoveryActions || []).join(" | "),
    contacts: (plan.contacts || [])
      .map((c) => [c.name, c.phone, c.email].filter(Boolean).join(" - "))
      .join(" | "),
    resources: (plan.resources || []).join(" | "),
    checklists: (plan.checklists || [])
      .map((c) => `${c.title}: ${(c.items || []).join("; ")}`)
      .join(" | "),
    attachments: (plan.attachments || []).join(" | "),
    decisionMatrix: (plan.decisionMatrix || [])
      .map((d) => `${d.decision}: ${d.responsible} (backup: ${d.backup})`)
      .join(" | "),
    communicationChannels: (plan.communicationChannels || [])
      .map((c) => `${c.type} - ${c.frequency} - ${c.recipients}`)
      .join(" | "),
    exitCriteria: (plan.exitCriteria || [])
      .map((e) => `${e.criterion}: ${e.indicator} (cible: ${e.target})`)
      .join(" | "),
    version: plan.version,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt
  };
}

function plansToCsv(plans) {
  const rows = plans.map(flattenPlanForCsv);
  const headers = [
    "id",
    "title",
    "category",
    "criticality",
    "status",
    "summary",
    "scenario",
    "triggers",
    "impacts",
    "services",
    "roles",
    "immediateActions",
    "continuityActions",
    "recoveryActions",
    "contacts",
    "resources",
    "checklists",
    "attachments",
    "version",
    "createdAt",
    "updatedAt"
  ];
  const lines = [headers.map(csvCell).join(";")];
  rows.forEach((row) => {
    lines.push(headers.map((h) => csvCell(row[h])).join(";"));
  });
  return "\ufeff" + lines.join("\n");
}

function planToHtmlForPdf(plan) {
  const itemList = (list) =>
    (list || []).length
      ? `<ul>${list.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`
      : "<p>Aucune donnée</p>";

  const roles =
    (plan.roles || []).length > 0
      ? `<ul>${plan.roles
          .map(
            (r) =>
              `<li><strong>${escapeHtml(r.role || "")}</strong> - ${escapeHtml(
                r.responsibility || ""
              )}</li>`
          )
          .join("")}</ul>`
      : "<p>Aucune donnee</p>";

  const contacts =
    (plan.contacts || []).length > 0
      ? `<ul>${plan.contacts
          .map((c) => `<li>${escapeHtml([c.name, c.phone, c.email].filter(Boolean).join(" - "))}</li>`)
          .join("")}</ul>`
      : "<p>Aucune donnee</p>";

  return `
    <article class="pdf-plan">
      <h2>${escapeHtml(plan.title || plan.id)}</h2>
      <p class="pdf-meta">
        ${escapeHtml(categoryLabelByValue[plan.category] || plan.category)} |
        Criticite ${escapeHtml(criticalityLabelByValue[plan.criticality] || plan.criticality)} |
        Statut ${escapeHtml(statusLabelByValue[plan.status] || plan.status)}
      </p>
      <h3>Resume</h3>
      <p>${escapeHtml(plan.summary || "")}</p>
      <h3>Scenario</h3>
      <p>${escapeHtml(plan.scenario || "")}</p>
      <h3>Actions immediates</h3>
      ${itemList(plan.immediateActions)}
      <h3>Procedure de continuite</h3>
      ${itemList(plan.continuityActions)}
      <h3>Procedure de reprise</h3>
      ${itemList(plan.recoveryActions)}
      <h3>Declencheurs</h3>
      ${itemList(plan.triggers)}
      <h3>Impacts</h3>
      ${itemList(plan.impacts)}
      <h3>Services concernes</h3>
      ${itemList(plan.services)}
      <h3>Roles et responsabilites</h3>
      ${roles}
      <h3>Contacts utiles</h3>
      ${contacts}
      <h3>Ressources</h3>
      ${itemList(plan.resources)}
      <h3>Checklist</h3>
      ${itemList((plan.checklists || []).map((c) => `${c.title}: ${(c.items || []).join("; ")}`))}
    </article>
  `;
}

function exportPlansPdf(plans, title) {
  if (!plans.length) {
    showError("Aucun plan a exporter en PDF.");
    return;
  }
  const opened = window.open("", "_blank");
  if (!opened) {
    showError("Le navigateur a bloque la fenetre PDF. Autoriser les popups pour continuer.");
    return;
  }

  const html = `
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; margin: 20px; color: #101010; }
    h1 { margin-bottom: 6px; }
    .meta { color: #444; margin-bottom: 14px; }
    .pdf-plan { page-break-after: always; border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
    .pdf-plan:last-child { page-break-after: auto; }
    .pdf-meta { color: #333; font-size: 0.95rem; margin-bottom: 8px; }
    h2 { margin-bottom: 2px; }
    h3 { margin-top: 12px; margin-bottom: 4px; font-size: 1rem; }
    ul { margin-top: 0; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Genere le ${escapeHtml(new Date().toLocaleString("fr-FR"))}</p>
  ${plans.map((p) => planToHtmlForPdf(p)).join("")}
  <script>
    window.addEventListener("load", () => window.print());
  </script>
</body>
</html>`;

  opened.document.open();
  opened.document.write(html);
  opened.document.close();
}

async function exportAllExcel() {
  if (!state.plans.length) {
    showError("Aucun plan a exporter.");
    return;
  }
  const csv = plansToCsv(state.plans);
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8"
  });
  downloadBlob(`contingence-plans-${Date.now()}.csv`, blob);
  await addAudit("export_excel_all", { count: state.plans.length });
}

async function exportOneExcel() {
  const plan = getSelectedPlan();
  if (!plan) {
    showError("Aucun plan selectionne.");
    return;
  }
  const csv = plansToCsv([plan]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(`plan-${plan.id}.csv`, blob);
  await addAudit("export_excel_one", { planId: plan.id });
}

async function exportAllPdf() {
  exportPlansPdf(state.plans, "Export PDF - Plans de contingence");
  await addAudit("export_pdf_all", { count: state.plans.length });
}

async function exportOnePdf() {
  const plan = getSelectedPlan();
  if (!plan) {
    showError("Aucun plan selectionne.");
    return;
  }
  exportPlansPdf([plan], `Export PDF - ${plan.title || plan.id}`);
  await addAudit("export_pdf_one", { planId: plan.id });
}

async function exportGlobal() {
  const settings = await listAllSettings();
  const payload = {
    app: "contingence-local",
    schemaVersion: APP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: nowIso(),
    data: {
      plans: state.plans,
      settings
    }
  };
  downloadJson(`contingence-export-${Date.now()}.json`, payload);
  await setSetting("lastBackupAt", payload.exportedAt);
  await addExportHistory({ createdAt: payload.exportedAt, kind: "global", count: state.plans.length });
  await addAudit("export_global", { count: state.plans.length });
  await renderSaveReminder();
  await renderDashboard();
}

async function exportSelectedPlan() {
  const plan = getSelectedPlan();
  if (!plan) {
    showError("Aucun plan sélectionné.");
    return;
  }
  downloadJson(`plan-${plan.id}.json`, {
    app: "contingence-local",
    schemaVersion: APP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: nowIso(),
    plan
  });
  await addExportHistory({ createdAt: nowIso(), kind: "single", count: 1, planId: plan.id });
  await addAudit("export_single", { planId: plan.id });
}

// ============================================
// IMPORT FUNCTIONS
// ============================================

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}

function parseImportPayload(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("JSON invalide.");
  }

  // Support des formats: schemaVersion (export app) ou version (export manuel) ou plans directement
  const schemaVersion = Number(parsed?.schemaVersion);
  const versionString = parsed?.version;
  const hasDirectPlans = Array.isArray(parsed?.plans);

  // Si format export app avec schemaVersion
  if (Number.isFinite(schemaVersion)) {
    if (schemaVersion !== APP_SCHEMA_VERSION) {
      throw new Error(
        `Incompatibilité de version: import=${schemaVersion}, attendu=${APP_SCHEMA_VERSION}.`
      );
    }
  }
  // Si format manuel avec version string OU plans directement -> accepter
  else if (!versionString && !hasDirectPlans) {
    throw new Error("Version de schéma absente.");
  }

  let plans = [];
  if (Array.isArray(parsed?.data?.plans)) {
    plans = parsed.data.plans;
  } else if (Array.isArray(parsed?.plans)) {
    // Support du format direct avec tableau plans à la racine
    plans = parsed.plans;
  } else if (parsed?.plan && typeof parsed.plan === "object") {
    plans = [parsed.plan];
  } else {
    throw new Error("Aucune donnée plan trouvée.");
  }

  const normalized = plans.map(normalizePlan);
  for (const plan of normalized) {
    const validation = validatePlanShape(plan);
    if (validation) {
      throw new Error(validation);
    }
  }
  return { parsed, plans: normalized };
}

function renderImportPreview(summary) {
  if (!summary) {
    el.importPreview.classList.add("hidden");
    el.importPreview.innerHTML = "";
    return;
  }
  el.importPreview.classList.remove("hidden");
  el.importPreview.innerHTML = `
    <strong>Import détecté</strong> · ${escapeHtml(String(summary.total))} plans
    (${escapeHtml(String(summary.newCount))} nouveaux, ${escapeHtml(String(summary.updateCount))} existants)
    <span class="import-actions">
      <button id="confirmMergeBtn" type="button" class="btn btn-secondary btn-sm">Importer en fusion</button>
      <button id="confirmReplaceBtn" type="button" class="btn btn-danger btn-sm">Remplacer tout</button>
      <button id="cancelImportBtn" type="button" class="btn btn-secondary btn-sm">Annuler</button>
    </span>
  `;

  document.getElementById("confirmMergeBtn").addEventListener("click", () => doImport("merge"));
  document.getElementById("confirmReplaceBtn").addEventListener("click", () => doImport("replace"));
  document.getElementById("cancelImportBtn").addEventListener("click", cancelImport);
}

function cancelImport() {
  state.pendingImport = null;
  if (el.importFile) el.importFile.value = "";
  renderImportPreview(null);
}

async function doImport(mode) {
  if (!state.pendingImport) {
    return;
  }
  if (mode === "replace") {
    if (!window.confirm("Remplacer toutes les données existantes ?")) {
      return;
    }
    await clearPlans();
  }

  let imported = 0;
  for (const plan of state.pendingImport.plans) {
    await upsertPlan(normalizePlan(plan));
    imported += 1;
  }
  await addAudit("import", { mode, imported });
  cancelImport();
  await refreshPlansAndRender();
  await autoBackupToFSA();
}

// ============================================
// URGENCY MODE (CRISIS)
// ============================================

async function renderUrgency() {
  if (!el.urgencyContent) return;

  const criticalPlans = state.plans
    .filter((p) => p.criticality === "critique" && p.status !== "archive")
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  if (criticalPlans.length === 0) {
    el.urgencyContent.innerHTML = `
      <div style="padding: var(--spacing-10); text-align: center;">
        <span class="material-symbols-outlined" style="font-size: 64px; color: var(--outline); opacity: 0.3;">shield_lock</span>
        <p class="headline-md" style="margin-top: var(--spacing-4); color: var(--outline);">Aucun plan critique actif</p>
        <p class="body-lg text-muted" style="margin-top: var(--spacing-2);">Les plans marqués comme "critique" apparaîtront ici en mode crise.</p>
      </div>
    `;
    return;
  }

  // Si aucun plan n'est sélectionné, afficher l'écran de sélection
  if (!state.activeCrisisPlanId) {
    renderCrisisSelection(criticalPlans);
    return;
  }

  // Récupérer le plan actif
  const plan = state.plans.find(p => p.id === state.activeCrisisPlanId);

  // Si le plan n'existe plus ou n'est plus critique, retourner à la sélection
  if (!plan || plan.criticality !== "critique" || plan.status === "archive") {
    state.activeCrisisPlanId = null;
    renderCrisisSelection(criticalPlans);
    return;
  }

  // Afficher le centre de crise pour le plan sélectionné
  await renderCrisisCenter(plan, criticalPlans.length);
}

function renderCrisisSelection(criticalPlans) {
  el.urgencyContent.innerHTML = `
    <div class="page-header" style="margin-bottom: var(--spacing-8);">
      <h2 class="page-title">
        <span class="material-symbols-outlined filled" style="vertical-align: middle; color: var(--error); font-size: 3rem; margin-right: var(--spacing-3);">emergency</span>
        Activation du Mode Crise
      </h2>
      <p class="page-subtitle">Sélectionnez le plan de contingence à activer pour démarrer le centre de commandement tactique.</p>
    </div>

    <div class="banner banner-error" style="margin-bottom: var(--spacing-8); font-size: var(--font-size-body-md);">
      <span class="material-symbols-outlined filled" style="vertical-align: middle;">warning</span>
      <strong>Attention :</strong> L'activation d'un plan de crise déclenchera l'affichage du centre de commandement tactique avec chronomètre et checklists opérationnelles.
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: var(--spacing-6);">
      ${criticalPlans.map(plan => `
        <div class="card card-bordered-error" style="padding: var(--spacing-6); cursor: pointer; transition: all var(--transition-base); border-width: 2px;" onclick="activateCrisisPlan('${escapeHtml(plan.id)}')" onmouseenter="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--shadow-elevated)'" onmouseleave="this.style.transform=''; this.style.boxShadow=''">
          <div style="display: flex; align-items: start; gap: var(--spacing-4); margin-bottom: var(--spacing-4);">
            <div style="width: 56px; height: 56px; border-radius: var(--radius-lg); background: var(--error); color: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <span class="material-symbols-outlined filled" style="font-size: 32px;">
                ${plan.category === 'cyberattaque' ? 'security' :
                  plan.category === 'panne-informatique' ? 'computer' :
                  plan.category === 'reseau-telecom' ? 'router' :
                  plan.category === 'sinistre-batiment' ? 'home' :
                  plan.category === 'indisponibilite-personnel' ? 'group' :
                  plan.category === 'catastrophe-naturelle' ? 'thunderstorm' :
                  plan.category === 'crise-sanitaire' ? 'health_and_safety' :
                  plan.category === 'defaillance-prestataire' ? 'business' :
                  plan.category === 'coupure-energie' ? 'power_off' :
                  'emergency'}
              </span>
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-2);">
                <span class="badge badge-error" style="font-size: 9px; font-weight: 900; letter-spacing: 0.15em;">CRITIQUE</span>
                <span class="label-sm" style="color: var(--on-surface-variant); text-transform: uppercase; letter-spacing: 0.1em;">
                  ${categoryLabelByValue[plan.category] || plan.category}
                </span>
              </div>
              <h3 class="title-lg" style="margin-bottom: var(--spacing-2); color: var(--primary); line-height: 1.3;">${escapeHtml(plan.title)}</h3>
              <p class="body-md text-muted" style="line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${escapeHtml(plan.summary || plan.scenario || 'Aucune description')}
              </p>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: var(--spacing-4); border-top: 1px solid var(--outline-variant);">
            <div style="display: flex; gap: var(--spacing-4); font-size: var(--font-size-label-sm); color: var(--on-surface-variant);">
              <div style="display: flex; align-items: center; gap: var(--spacing-1);">
                <span class="material-symbols-outlined" style="font-size: 16px;">check_circle</span>
                <span>${(plan.immediateActions || []).length} actions</span>
              </div>
              <div style="display: flex; align-items: center; gap: var(--spacing-1);">
                <span class="material-symbols-outlined" style="font-size: 16px;">contacts</span>
                <span>${(plan.contacts || []).length} contacts</span>
              </div>
            </div>
            <span class="label-md" style="color: var(--error); font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em;">
              Activer →
            </span>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card" style="margin-top: var(--spacing-8); padding: var(--spacing-6); background: var(--surface-container-lowest);">
      <div style="display: flex; align-items: start; gap: var(--spacing-4);">
        <span class="material-symbols-outlined" style="color: var(--primary); font-size: 32px;">info</span>
        <div>
          <h4 class="title-md" style="margin-bottom: var(--spacing-2); color: var(--primary);">Comment utiliser le mode crise ?</h4>
          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--spacing-2);">
            <li class="body-md text-muted">• Sélectionnez le plan correspondant à la situation d'urgence en cours</li>
            <li class="body-md text-muted">• Le centre de commandement tactique s'affichera avec chronomètre automatique</li>
            <li class="body-md text-muted">• Suivez les checklists d'actions immédiates et contactez les responsables</li>
            <li class="body-md text-muted">• Utilisez le bouton "Quitter Mode Urgence" pour désactiver le plan</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

async function activateCrisisPlan(planId) {
  state.activeCrisisPlanId = planId;
  state.crisisActivatedAt = Date.now();

  // Sauvegarder dans IndexedDB pour persistance
  await setSetting("activeCrisisPlanId", planId);
  await setSetting("crisisActivatedAt", state.crisisActivatedAt);

  // Mettre à jour l'indicateur dans la topbar
  updateCrisisModeIndicator();

  renderUrgency();
}

async function deactivateCrisisPlan() {
  if (window.confirm("Quitter le mode urgence ?\nLe chronomètre sera arrêté et vous retournerez à la sélection de plans.")) {
    state.activeCrisisPlanId = null;
    state.crisisActivatedAt = null;

    // Nettoyer IndexedDB
    await setSetting("activeCrisisPlanId", null);
    await setSetting("crisisActivatedAt", null);

    // Mettre à jour l'indicateur dans la topbar
    updateCrisisModeIndicator();

    renderUrgency();
  }
}

window.activateCrisisPlan = activateCrisisPlan;
window.deactivateCrisisPlan = deactivateCrisisPlan;

/**
 * Get checklist state for a plan from IndexedDB
 */
async function getChecklistState(planId) {
  const stateKey = `checklist_state_${planId}`;
  return (await getSetting(stateKey)) || {};
}

/**
 * Save checklist state for a plan to IndexedDB
 */
async function saveChecklistState(planId, checklistState) {
  const stateKey = `checklist_state_${planId}`;
  await setSetting(stateKey, checklistState);
}

/**
 * Toggle a checkbox and save the state
 */
async function toggleChecklistItem(planId, itemIndex) {
  const checklistState = await getChecklistState(planId);
  checklistState[itemIndex] = !checklistState[itemIndex];
  await saveChecklistState(planId, checklistState);

  // Update UI
  const checkbox = document.getElementById(`crisis-checkbox-${itemIndex}`);
  const checkmark = document.getElementById(`crisis-checkmark-${itemIndex}`);

  if (checkbox && checkmark) {
    const isChecked = checklistState[itemIndex];
    checkbox.style.background = isChecked ? 'var(--primary)' : 'transparent';
    checkmark.style.display = isChecked ? 'block' : 'none';
  }
}

window.toggleChecklistItem = toggleChecklistItem;

async function renderCrisisCenter(plan, totalCriticalPlans) {
  // Récupérer le nom de l'app
  const appName = await getSetting("appName") || "VANGUARD";

  // Calculer le temps écoulé depuis l'activation
  const activationTime = state.crisisActivatedAt || Date.now();
  const elapsed = Date.now() - activationTime;
  const hours = Math.floor(elapsed / (1000 * 60 * 60));
  const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
  const elapsedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Récupérer les checklists 0-30 min
  const checklist030 = (plan.checklists || []).find(c => c.title && c.title.includes("0-30"));
  const checklistItems = checklist030?.items || plan.immediateActions.slice(0, 4) || [];

  // Récupérer l'état des checkboxes
  const checklistState = await getChecklistState(plan.id);

  el.urgencyContent.innerHTML = `
    <!-- Breadcrumb with Exit Button -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-6);">
      <div class="page-breadcrumb">
        <span>${escapeHtml(appName.toUpperCase())}</span>
        <span class="page-breadcrumb-sep">›</span>
        <span>CENTRE DE CRISE</span>
      </div>
      <button class="btn btn-secondary" onclick="deactivateCrisisPlan()" style="display: flex; align-items: center; gap: var(--spacing-2);">
        <span class="material-symbols-outlined">close</span>
        <span>Quitter Mode Urgence</span>
      </button>
    </div>

    <!-- Crisis Header: Editorial Structuralism -->
    <section style="margin-bottom: var(--spacing-10); display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--spacing-8); align-items: end;">
      <div style="grid-column: span 8;">
        <div style="display: flex; align-items: center; gap: var(--spacing-3); margin-bottom: var(--spacing-2);">
          <span class="badge badge-error" style="font-size: 10px; font-weight: 900; letter-spacing: 0.15em;">CODE ROUGE</span>
          <span style="color: var(--on-surface-variant); font-size: var(--font-size-label-sm); font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em;">
            ${categoryLabelByValue[plan.category]} · ID: ${escapeHtml(plan.id)}
          </span>
        </div>
        <h2 class="page-title" style="font-size: 3rem; line-height: 1.1; margin-bottom: var(--spacing-3);">${escapeHtml(plan.title)}</h2>
        <p class="page-subtitle" style="font-size: var(--font-size-title-md); max-width: none;">${escapeHtml(plan.summary || plan.scenario || '')}</p>
      </div>
      <div style="grid-column: span 4; display: flex; justify-content: flex-end; gap: var(--spacing-4);">
        <div style="text-align: right;">
          <div style="font-size: var(--font-size-label-sm); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--on-surface-variant); margin-bottom: var(--spacing-1);">
            Temps écoulé
          </div>
          <div style="font-size: 2.5rem; font-family: 'Courier New', monospace; font-weight: 900; color: var(--primary);" id="crisisTimer">
            ${elapsedTime}
          </div>
        </div>
      </div>
    </section>

    <!-- Bento Grid Layout -->
    <div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--spacing-6);">
      <!-- Checklist Immédiate: Left Column -->
      <div style="grid-column: span 4; display: flex; flex-direction: column; gap: var(--spacing-6);">
        <div class="card" style="padding: var(--spacing-6); border-left: 4px solid var(--tertiary-fixed-dim);">
          <h3 class="label-lg" style="text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: var(--spacing-6); display: flex; justify-content: space-between; align-items: center;">
            <span>Checklist Immédiate</span>
            <span style="color: var(--outline); font-weight: 400;">${checklistItems.length} ACTIONS</span>
          </h3>
          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--spacing-4);">
            ${checklistItems.map((item, idx) => {
              const isChecked = checklistState[idx] || false;
              return `
              <li style="display: flex; align-items: start; gap: var(--spacing-4);">
                <div id="crisis-checkbox-${idx}" style="margin-top: 2px; width: 20px; height: 20px; border-radius: 4px; border: 2px solid var(--primary); flex-shrink: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; background: ${isChecked ? 'var(--primary)' : 'transparent'};" onclick="toggleChecklistItem('${escapeHtml(plan.id)}', ${idx})">
                  <span id="crisis-checkmark-${idx}" class="material-symbols-outlined" style="font-size: 14px; color: white; display: ${isChecked ? 'block' : 'none'};">check</span>
                </div>
                <div style="flex: 1;">
                  <p class="body-md" style="font-weight: 500; color: var(--primary); line-height: 1.4;">
                    ${escapeHtml(typeof item === 'string' ? item : item.text || item.action || '')}
                  </p>
                </div>
              </li>
              `;
            }).join('')}
          </ul>
          <button class="btn btn-secondary" style="width: 100%; margin-top: var(--spacing-6); font-size: var(--font-size-label-sm); text-transform: uppercase; letter-spacing: 0.1em;" onclick="state.selectedId = '${plan.id}'; navigateTo('editor');">
            Voir Protocole Complet
          </button>
        </div>

        <!-- Contacts d'Urgence -->
        <div class="card" style="padding: var(--spacing-6); border-left: 4px solid var(--primary);">
          <h3 class="label-lg" style="text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: var(--spacing-6);">
            Contacts Stratégiques
          </h3>
          <div style="display: flex; flex-direction: column; gap: var(--spacing-4);">
            ${(plan.contacts || []).slice(0, 3).map(contact => `
              <div class="card" style="padding: var(--spacing-3); display: flex; align-items: center; justify-content: space-between; background: var(--surface-container-lowest);">
                <div style="display: flex; align-items: center; gap: var(--spacing-3);">
                  <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: var(--font-size-title-md);">
                    ${escapeHtml((contact.name || 'X')[0].toUpperCase())}
                  </div>
                  <div>
                    <p class="label-md" style="font-weight: 700; text-transform: uppercase; color: var(--primary);">${escapeHtml(contact.name || 'Contact')}</p>
                    <p class="body-sm text-muted">${escapeHtml(contact.role || contact.phone || '')}</p>
                  </div>
                </div>
                ${contact.phone ? `
                  <a href="tel:${escapeHtml(contact.phone)}" class="btn btn-icon" style="width: 32px; height: 32px; background: var(--primary-container); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;" title="Appeler">
                    <span class="material-symbols-outlined" style="font-size: 18px;">call</span>
                  </a>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Central Intelligence: Resources & Services -->
      <div style="grid-column: span 8; display: flex; flex-direction: column; gap: var(--spacing-6);">
        <!-- Carte Tactique (Placeholder) -->
        <div style="height: 400px; background: linear-gradient(135deg, #0a1929 0%, #1a3668 100%); border-radius: var(--radius-xl); overflow: hidden; position: relative; box-shadow: var(--shadow-elevated);">
          <div style="position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(243, 146, 0, 0.03) 50px, rgba(243, 146, 0, 0.03) 100px); opacity: 0.5;"></div>
          <div style="position: absolute; inset: 0; background: repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(243, 146, 0, 0.03) 50px, rgba(243, 146, 0, 0.03) 100px); opacity: 0.5;"></div>

          <div style="position: absolute; top: var(--spacing-6); left: var(--spacing-6); background: rgba(10, 25, 41, 0.9); backdrop-filter: blur(16px); padding: var(--spacing-4); border-radius: var(--radius-lg); border: 1px solid rgba(255, 255, 255, 0.1); color: white;">
            <div style="display: flex; align-items: center; gap: var(--spacing-3); margin-bottom: var(--spacing-3);">
              <span class="material-symbols-outlined" style="color: var(--tertiary-fixed-dim);">layers</span>
              <span class="label-sm" style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Zones d'Impact</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--spacing-2);">
              ${(plan.impacts || []).slice(0, 3).map(impact => `
                <div style="display: flex; align-items: center; gap: var(--spacing-2); font-size: var(--font-size-label-sm); opacity: 0.8;">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--error);"></div>
                  <span>${escapeHtml(impact).substring(0, 35)}${impact.length > 35 ? '...' : ''}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
            <div style="width: 200px; height: 200px; border-radius: 50%; background: rgba(186, 26, 26, 0.1); border: 3px solid var(--error); animation: pulse 2s ease-in-out infinite; display: flex; align-items: center; justify-content: center; flex-direction: column;">
              <span class="material-symbols-outlined" style="font-size: 64px; color: var(--error); margin-bottom: var(--spacing-2);">emergency</span>
              <span class="label-lg" style="color: white; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; background: var(--error); padding: var(--spacing-2) var(--spacing-3); border-radius: var(--radius-md);">ZONE IMPACT</span>
            </div>
          </div>
        </div>

        <!-- Services Critiques -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-6);">
          ${(plan.services || []).slice(0, 4).map((service, idx) => {
            const percentage = 100 - (idx * 10);
            const isWarning = percentage < 85;
            return `
              <div class="card" style="padding: var(--spacing-6); display: flex; align-items: center; gap: var(--spacing-6);">
                <div style="flex: 1;">
                  <h4 class="label-sm" style="font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; color: var(--primary); margin-bottom: var(--spacing-1);">
                    ${escapeHtml(service).substring(0, 20)}
                  </h4>
                  <p style="font-size: 1.75rem; font-weight: 900; color: ${isWarning ? 'var(--error)' : 'var(--primary)'};">
                    ${percentage}% <span class="body-sm text-muted">Opérationnel</span>
                  </p>
                  <div style="width: 100%; height: 4px; background: ${isWarning ? 'rgba(186, 26, 26, 0.1)' : 'rgba(0, 32, 79, 0.1)'}; border-radius: var(--radius-full); margin-top: var(--spacing-3);">
                    <div style="width: ${percentage}%; height: 100%; background: ${isWarning ? 'var(--error)' : 'var(--primary)'}; border-radius: var(--radius-full); transition: width 0.3s ease;"></div>
                  </div>
                </div>
                <span class="material-symbols-outlined" style="font-size: 48px; color: ${isWarning ? 'var(--error)' : 'var(--primary)'}; opacity: 0.2;">
                  ${idx === 0 ? 'bolt' : idx === 1 ? 'local_hospital' : idx === 2 ? 'water_drop' : 'wifi'}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Real-time Feed Bar -->
    <footer style="margin-top: var(--spacing-8); background: var(--primary); color: white; padding: var(--spacing-4); border-radius: var(--radius-xl); display: flex; align-items: center; gap: var(--spacing-8); box-shadow: var(--shadow-elevated);">
      <div style="display: flex; align-items: center; gap: var(--spacing-2); white-space: nowrap;">
        <span style="width: 8px; height: 8px; background: var(--error); border-radius: 50%; animation: pulse 1s ease-in-out infinite;"></span>
        <span class="label-sm" style="font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em;">FLUX LIVE</span>
      </div>
      <div style="overflow: hidden; flex: 1; position: relative;">
        <div style="display: flex; gap: var(--spacing-8); font-size: var(--font-size-body-md); font-weight: 500; animation: marquee 30s linear infinite;">
          <p style="opacity: 0.8; white-space: nowrap;"><span style="font-weight: 700; color: var(--tertiary-fixed-dim);">[${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}]</span> Plan de contingence activé · Mode crise opérationnel</p>
          <p style="opacity: 0.8; white-space: nowrap;"><span style="font-weight: 700; color: var(--tertiary-fixed-dim);">[${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}]</span> ${(plan.triggers || [])[0] || 'Déclenchement manuel'}</p>
          <p style="opacity: 0.8; white-space: nowrap;"><span style="font-weight: 700; color: var(--tertiary-fixed-dim);">[${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}]</span> Suivi des actions en cours...</p>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: var(--spacing-4); border-left: 1px solid rgba(255, 255, 255, 0.1); padding-left: var(--spacing-8);">
        <span class="label-sm" style="text-transform: uppercase; opacity: 0.6;">${totalCriticalPlans} plan${totalCriticalPlans > 1 ? 's' : ''} critique${totalCriticalPlans > 1 ? 's' : ''}</span>
      </div>
    </footer>
  `;

  // Nettoyer l'ancien intervalle s'il existe
  if (crisisTimerInterval) {
    clearInterval(crisisTimerInterval);
    crisisTimerInterval = null;
  }

  // Mise à jour du timer toutes les secondes
  crisisTimerInterval = setInterval(() => {
    const timerEl = document.getElementById('crisisTimer');
    if (!timerEl || window.location.hash !== '#crisis' || !state.activeCrisisPlanId) {
      clearInterval(crisisTimerInterval);
      crisisTimerInterval = null;
      return;
    }

    const activationTime = state.crisisActivatedAt || Date.now();
    const newElapsed = Date.now() - activationTime;
    const h = Math.floor(newElapsed / (1000 * 60 * 60));
    const m = Math.floor((newElapsed % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((newElapsed % (1000 * 60)) / 1000);
    timerEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, 1000);
}

// ============================================
// SAVE REMINDER
// ============================================

async function renderSaveReminder() {
  if (!el.saveReminder) return;

  const lastBackupAt = await getSetting("lastBackupAt");
  if (!lastBackupAt) {
    el.saveReminder.classList.remove("hidden");
    el.saveReminder.textContent =
      "Aucune sauvegarde globale détectée. Recommandation: exporter maintenant sur support externe.";
    return;
  }
  const diffHours = (Date.now() - new Date(lastBackupAt).getTime()) / (1000 * 60 * 60);
  if (diffHours > 72) {
    el.saveReminder.classList.remove("hidden");
    el.saveReminder.textContent = `Dernière sauvegarde: ${new Date(lastBackupAt).toLocaleString(
      "fr-FR"
    )}. Recommandation: faire une sauvegarde maintenant.`;
    return;
  }
  el.saveReminder.classList.add("hidden");
  el.saveReminder.textContent = "";
}

// ============================================
// KEY BINDINGS
// ============================================

function setupKeyBindings() {
  document.addEventListener("keydown", (event) => {
    const cmdOrCtrl = event.ctrlKey || event.metaKey;
    if (cmdOrCtrl && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (state.currentView === "editor") {
        el.form?.requestSubmit();
      }
    }
    if (cmdOrCtrl && event.key.toLowerCase() === "f") {
      event.preventDefault();
      if (el.globalSearch) {
        el.globalSearch.focus();
        el.globalSearch.select();
      }
    }
  });
}

// ============================================
// EVENT BINDINGS
// ============================================

function bindEvents() {
  // Navigation
  document.querySelectorAll(".sidenav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const view = item.getAttribute("data-view");
      if (view) {
        navigateTo(view);
      }
    });
  });

  // Hash change
  window.addEventListener("hashchange", handleHashChange);

  // New plan buttons
  if (el.newIncidentBtn) {
    el.newIncidentBtn.addEventListener("click", () => {
      state.selectedId = null;
      navigateTo("editor");
    });
  }

  if (el.plansNewBtn) {
    el.plansNewBtn.addEventListener("click", () => {
      state.selectedId = null;
      navigateTo("editor");
    });
  }

  if (el.dashboardNewPlanBtn) {
    el.dashboardNewPlanBtn.addEventListener("click", () => {
      state.selectedId = null;
      navigateTo("editor");
    });
  }

  // Emergency buttons
  if (el.emergencyBtn) {
    el.emergencyBtn.addEventListener("click", () => {
      navigateTo("crisis");
    });
  }

  if (el.dashboardEmergencyBtn) {
    el.dashboardEmergencyBtn.addEventListener("click", () => {
      navigateTo("crisis");
    });
  }

  if (el.closeCrisisBtn) {
    el.closeCrisisBtn.addEventListener("click", () => {
      navigateTo("plans");
    });
  }

  // Search and filters
  if (el.searchInput) {
    el.searchInput.addEventListener("input", () => {
      state.search = el.searchInput.value;
      renderPlansList();
    });
  }

  if (el.globalSearch) {
    el.globalSearch.addEventListener("input", () => {
      state.search = el.globalSearch.value;
      if (el.searchInput) el.searchInput.value = el.globalSearch.value;
      if (state.currentView === "plans") {
        renderPlansList();
      }
    });
  }

  if (el.filterCategory) {
    el.filterCategory.addEventListener("change", () => {
      state.filterCategory = el.filterCategory.value;
      renderPlansList();
    });
  }

  if (el.filterCriticality) {
    el.filterCriticality.addEventListener("change", () => {
      state.filterCriticality = el.filterCriticality.value;
      renderPlansList();
    });
  }

  if (el.filterStatus) {
    el.filterStatus.addEventListener("change", () => {
      state.filterStatus = el.filterStatus.value;
      renderPlansList();
    });
  }

  // Sort By (Phase 2)
  if (el.sortBy) {
    el.sortBy.addEventListener("change", () => {
      state.sortBy = el.sortBy.value;
      renderPlansList();
    });
  }

  // Plans list selection
  if (el.plansList) {
    el.plansList.addEventListener("click", async (event) => {
      const target = event.target.closest("button[data-id]");
      if (!target) {
        return;
      }
      const id = target.getAttribute("data-id");
      if (!id) {
        return;
      }
      state.selectedId = id;
      navigateTo("editor");
    });
  }

  // Form submit
  if (el.form) {
    el.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      showError("");

      const plan = planFromForm();
      const validation = validatePlanShape(plan);
      if (validation) {
        showError(validation);
        return;
      }

      await upsertPlan(plan);
      state.selectedId = plan.id;
      await addAudit("save_plan", { id: plan.id, version: plan.version });
      await refreshPlansAndRender();

      // Auto-backup to FSA
      await autoBackupToFSA();

      // Show success feedback
      const originalText = el.saveBtn?.textContent;
      if (el.saveBtn) {
        el.saveBtn.innerHTML = '<span class="material-symbols-outlined">check_circle</span><span>Enregistré !</span>';
        el.saveBtn.style.background = "var(--secondary)";
        setTimeout(() => {
          if (el.saveBtn) {
            el.saveBtn.innerHTML = '<span class="material-symbols-outlined">save</span><span>Enregistrer</span>';
            el.saveBtn.style.background = "";
          }
        }, 2000);
      }
    });
  }

  // Reset button
  if (el.resetBtn) {
    el.resetBtn.addEventListener("click", () => {
      fillForm(getSelectedPlan() || createEmptyPlan());
      showError("");
    });
  }

  // Delete button
  if (el.deleteBtn) {
    el.deleteBtn.addEventListener("click", async () => {
      const plan = getSelectedPlan();
      if (!plan) {
        showError("Aucun plan sélectionné.");
        return;
      }
      if (!window.confirm(`Supprimer définitivement le plan "${plan.title || plan.id}" ?`)) {
        return;
      }
      await deletePlan(plan.id);
      await addAudit("delete_plan", { id: plan.id });
      state.selectedId = null;
      await refreshPlansAndRender();
      await autoBackupToFSA();
      navigateTo("plans");
    });
  }

  // Archive button
  if (el.archiveBtn) {
    el.archiveBtn.addEventListener("click", async () => {
      const plan = getSelectedPlan();
      if (!plan) {
        showError("Aucun plan sélectionné.");
        return;
      }
      const next = normalizePlan({ ...plan, status: "archive", updatedAt: nowIso(), version: plan.version + 1 });
      await upsertPlan(next);
      await addAudit("archive_plan", { id: plan.id });
      await refreshPlansAndRender();
      await autoBackupToFSA();
    });
  }

  // Duplicate button
  if (el.duplicateBtn) {
    el.duplicateBtn.addEventListener("click", async () => {
      const plan = getSelectedPlan();
      if (!plan) {
        showError("Aucun plan sélectionné.");
        return;
      }
      const id = `${plan.id}-copy-${Date.now()}`;
      const clone = normalizePlan({
        ...plan,
        id,
        title: `${plan.title} (copie)`,
        status: "brouillon",
        version: 1,
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
      await upsertPlan(clone);
      state.selectedId = clone.id;
      await addAudit("duplicate_plan", { from: plan.id, to: clone.id });
      await refreshPlansAndRender();
      await autoBackupToFSA();
    });
  }

  // Export buttons
  if (el.exportAllBtn) {
    el.exportAllBtn.addEventListener("click", async () => {
      showError("");
      await exportGlobal();
    });
  }

  if (el.dashboardExportBtn) {
    el.dashboardExportBtn.addEventListener("click", async () => {
      showError("");
      await exportGlobal();
    });
  }

  if (el.exportAllExcelBtn) {
    el.exportAllExcelBtn.addEventListener("click", async () => {
      showError("");
      await exportAllExcel();
    });
  }

  if (el.exportAllPdfBtn) {
    el.exportAllPdfBtn.addEventListener("click", async () => {
      showError("");
      await exportAllPdf();
    });
  }

  if (el.exportOneBtn) {
    el.exportOneBtn.addEventListener("click", async () => {
      showError("");
      await exportSelectedPlan();
    });
  }

  if (el.exportOneExcelBtn) {
    el.exportOneExcelBtn.addEventListener("click", async () => {
      showError("");
      await exportOneExcel();
    });
  }

  if (el.exportOnePdfBtn) {
    el.exportOnePdfBtn.addEventListener("click", async () => {
      showError("");
      await exportOnePdf();
    });
  }

  if (el.printBtn) {
    el.printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // Import
  if (el.importFile) {
    el.importFile.addEventListener("change", async () => {
      showError("");
      const file = el.importFile.files?.[0];
      if (!file) {
        return;
      }
      try {
        const raw = await readFileText(file);
        const { plans } = parseImportPayload(raw);
        const existingIds = new Set(state.plans.map((p) => p.id));
        const updateCount = plans.filter((p) => existingIds.has(p.id)).length;
        const summary = {
          total: plans.length,
          updateCount,
          newCount: plans.length - updateCount
        };
        state.pendingImport = { plans, fileName: file.name };
        renderImportPreview(summary);
      } catch (err) {
        showError(String(err.message || err));
        cancelImport();
      }
    });
  }

  if (el.dashboardImportBtn) {
    el.dashboardImportBtn.addEventListener("click", () => {
      el.importFile?.click();
    });
  }

  // Import depuis Paramètres
  const settingsImportFile = document.getElementById("settingsImportFile");
  const settingsImportBtn = document.getElementById("settingsImportBtn");

  if (settingsImportFile) {
    settingsImportFile.addEventListener("change", async () => {
      showError("");
      const file = settingsImportFile.files?.[0];
      if (!file) return;
      try {
        const raw = await readFileText(file);
        const { plans } = parseImportPayload(raw);
        const existingIds = new Set(state.plans.map((p) => p.id));
        const updateCount = plans.filter((p) => existingIds.has(p.id)).length;
        const summary = {
          total: plans.length,
          updateCount,
          newCount: plans.length - updateCount
        };
        state.pendingImport = { plans, fileName: file.name };
        renderImportPreview(summary);
      } catch (err) {
        showError(String(err.message || err));
        cancelImport();
      } finally {
        settingsImportFile.value = "";
      }
    });
  }

  if (settingsImportBtn) {
    settingsImportBtn.addEventListener("click", () => {
      settingsImportFile?.click();
    });
  }

  // FSA buttons
  if (el.fsaLinkBtn) {
    el.fsaLinkBtn.addEventListener("click", async () => {
      if (!window.FSA) return;

      try {
        const result = await FSA.linkFolder();

        if (result.success) {
          const status = FSA.getStatus();
          updateFSAUI({ connected: true, folderName: status.folderName });
          showInfo(`Dossier "${result.folderName}" lié avec succès. Les plans seront sauvegardés automatiquement.`);

          // Backup immédiat
          await autoBackupToFSA();
        } else if (result.cancelled) {
          showInfo("Liaison de dossier annulée.");
        }
      } catch (err) {
        showError(`Erreur lors de la liaison du dossier: ${err.message}`);
      }
    });
  }

  if (el.fsaUnlinkBtn) {
    el.fsaUnlinkBtn.addEventListener("click", async () => {
      if (!window.FSA) return;

      if (!window.confirm("Délier le dossier de sauvegarde ?\nLes fichiers existants ne seront pas supprimés.")) {
        return;
      }

      try {
        await FSA.unlinkFolder();
        updateFSAUI({ connected: false });
        showInfo("Dossier de sauvegarde délié.");
      } catch (err) {
        showError(`Erreur lors de la suppression du lien: ${err.message}`);
      }
    });
  }

  if (el.fsaBackupNowBtn) {
    el.fsaBackupNowBtn.addEventListener("click", async () => {
      if (!window.FSA) return;

      try {
        const plans = state.plans;
        const settings = await listAllSettings();
        const result = await FSA.backupAll(plans, settings);

        if (result.success) {
          await setSetting("lastBackupAt", result.timestamp);
          await renderDashboard();
          showInfo("Sauvegarde manuelle effectuée avec succès.");
        } else if (result.notConnected) {
          showWarning("Aucun dossier lié. Veuillez d'abord lier un dossier.");
        } else {
          showError(`Erreur de sauvegarde: ${result.error}`);
        }
      } catch (err) {
        showError(`Erreur lors de la sauvegarde: ${err.message}`);
      }
    });
  }

  // Branding buttons
  if (el.settingAppName) {
    el.settingAppName.addEventListener("input", () => {
      updateBrandingPreview();
    });
  }

  if (el.settingAppSubtitle) {
    el.settingAppSubtitle.addEventListener("input", () => {
      updateBrandingPreview();
    });
  }

  if (el.saveBrandingBtn) {
    el.saveBrandingBtn.addEventListener("click", async () => {
      const appName = el.settingAppName?.value.trim() || "Vanguard";
      const appSubtitle = el.settingAppSubtitle?.value.trim() || "Command Center";

      try {
        await setSetting("appName", appName);
        await setSetting("appSubtitle", appSubtitle);
        updateBranding(appName, appSubtitle);
        showInfo("Personnalisation enregistrée avec succès.");
      } catch (err) {
        showError(`Erreur lors de l'enregistrement: ${err.message}`);
      }
    });
  }

  if (el.resetBrandingBtn) {
    el.resetBrandingBtn.addEventListener("click", async () => {
      if (!window.confirm("Réinitialiser le nom de l'application aux valeurs par défaut ?")) {
        return;
      }

      const defaultName = "Vanguard";
      const defaultSubtitle = "Command Center";

      try {
        await setSetting("appName", defaultName);
        await setSetting("appSubtitle", defaultSubtitle);

        if (el.settingAppName) {
          el.settingAppName.value = defaultName;
        }
        if (el.settingAppSubtitle) {
          el.settingAppSubtitle.value = defaultSubtitle;
        }

        updateBranding(defaultName, defaultSubtitle);
        updateBrandingPreview();
        showInfo("Personnalisation réinitialisée.");
      } catch (err) {
        showError(`Erreur lors de la réinitialisation: ${err.message}`);
      }
    });
  }

  // Help modal
  if (el.helpBtn) {
    el.helpBtn.addEventListener("click", () => {
      if (el.helpModal) {
        el.helpModal.classList.remove("hidden");
        if (el.appVersionDisplay) {
          el.appVersionDisplay.textContent = APP_VERSION;
        }
      }
    });
  }

  if (el.closeHelpModal) {
    el.closeHelpModal.addEventListener("click", () => {
      el.helpModal?.classList.add("hidden");
    });
  }

  if (el.helpModalOverlay) {
    el.helpModalOverlay.addEventListener("click", () => {
      el.helpModal?.classList.add("hidden");
    });
  }

  // Notifications button
  if (el.notificationsBtn) {
    el.notificationsBtn.addEventListener("click", async () => {
      if (!('Notification' in window)) {
        showError("Les notifications navigateur ne sont pas supportées par votre navigateur.");
        return;
      }

      const permission = Notification.permission;

      if (permission === 'granted') {
        showInfo("✅ Les notifications sont déjà activées.");
        // Test notification
        try {
          new Notification('Contingence Local', {
            body: 'Les notifications sont actives ! Vous recevrez des alertes pour les événements importants.',
            icon: '/favicon.ico',
            tag: 'test-notification'
          });
        } catch (err) {
          showError("Erreur lors de l'envoi de la notification test.");
        }
      } else if (permission === 'denied') {
        showWarning("❌ Les notifications ont été bloquées. Veuillez les autoriser dans les paramètres de votre navigateur.");
      } else {
        // Demander la permission
        try {
          const result = await Notification.requestPermission();

          if (result === 'granted') {
            showInfo("✅ Notifications activées avec succès !");
            updateNotificationIcon();
            // Test notification
            new Notification('Contingence Local', {
              body: 'Les notifications sont maintenant activées ! Vous recevrez des alertes pour les événements importants.',
              icon: '/favicon.ico',
              tag: 'welcome-notification'
            });
          } else {
            showWarning("Les notifications ont été refusées.");
            updateNotificationIcon();
          }
        } catch (err) {
          showError(`Erreur lors de la demande de permission: ${err.message}`);
        }
      }
    });
  }
}

// ============================================
// SEED DATA
// ============================================

function seedIfEmpty() {
  if (state.plans.length > 0) {
    return Promise.resolve();
  }
  const starter = normalizePlan({
    id: "plan-cyber-001",
    title: "Cyberattaque avec chiffrement des postes",
    category: "cyberattaque",
    criticality: "critique",
    status: "valide",
    summary: "Plan de réaction rapide en cas de ransomware.",
    scenario: "Blocage généralisé des postes et serveurs avec demande de rançon.",
    triggers: ["Fichiers chiffrés", "Alertes EDR", "Arrêt services métiers"],
    impacts: ["Interruption de service", "Risque perte de données", "Stress usagers"],
    services: ["DSI", "Direction générale", "Communication"],
    roles: [{ role: "Directeur de crise", responsibility: "Décisions et coordination globale" }],
    immediateActions: ["Isoler les segments réseau", "Déclencher cellule de crise", "Informer les agents"],
    continuityActions: ["Basculer en mode papier", "Activer procédures manuelles"],
    recoveryActions: ["Restaurer sauvegardes saines", "Changer secrets d'accès"],
    contacts: [{ name: "DSI astreinte", phone: "0102030405", email: "dsi@collectivite.fr" }],
    resources: ["Annuaire papier", "Postes de secours", "Guide réflexe imprimé"],
    checklists: [{ title: "0-30 min", items: ["Alerte", "Isolement réseau", "Point de situation"] }],
    attachments: ["Lien interne: \\intranet\\secours\\guide-ransomware"]
  });
  return upsertPlan(starter);
}

// ============================================
// STATIC OPTIONS
// ============================================

function setupStaticOptions() {
  setSelectOptions(el.filterCategory, CATEGORIES, true);
  setSelectOptions(el.filterCriticality, CRITICALITIES, true);
  setSelectOptions(el.filterStatus, STATUSES, true);

  setSelectOptions(el.fields.category, CATEGORIES, false);
  setSelectOptions(el.fields.criticality, CRITICALITIES, false);
  setSelectOptions(el.fields.priority, PRIORITIES, false);
  setSelectOptions(el.fields.status, STATUSES, false);
}

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Met à jour l'icône de notification selon le statut des permissions
 */
function updateNotificationIcon() {
  if (!('Notification' in window) || !el.notificationsBtn) {
    return;
  }

  const icon = el.notificationsBtn.querySelector('.material-symbols-outlined');
  if (!icon) return;

  const permission = Notification.permission;

  if (permission === 'granted') {
    icon.textContent = 'notifications_active';
    icon.classList.add('filled');
    el.notificationsBtn.setAttribute('aria-label', 'Notifications activées');
  } else if (permission === 'denied') {
    icon.textContent = 'notifications_off';
    icon.classList.remove('filled');
    el.notificationsBtn.setAttribute('aria-label', 'Notifications bloquées');
  } else {
    icon.textContent = 'notifications';
    icon.classList.remove('filled');
    el.notificationsBtn.setAttribute('aria-label', 'Activer les notifications');
  }
}

// ============================================
// SERVICE WORKER
// ============================================

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // No-op by design; app remains functional without service worker.
  });
}

// ============================================
// FSA INTEGRATION
// ============================================

async function initFSA() {
  if (!window.FSA) {
    console.warn("FSA module not loaded");
    return;
  }

  const status = await FSA.init();

  if (!status.supported) {
    if (el.fsaNotSupported) {
      el.fsaNotSupported.style.display = "block";
    }
    if (el.fsaDisconnected) {
      el.fsaDisconnected.style.display = "none";
    }
    return;
  }

  updateFSAUI(status);

  if (status.connected) {
    if (status.permissionRestored) {
      // Message d'information visible
      showInfo(`✅ Connexion automatique au dossier de sauvegarde "${status.folderName}" restaurée`);

      // Notification navigateur (si permissions accordées)
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Contingence Local - Sauvegarde Active', {
            body: `Connexion restaurée au dossier: ${status.folderName}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'fsa-reconnection',
            requireInteraction: false
          });
        } catch (err) {
          console.log('Browser notification not supported or blocked:', err);
        }
      }
    }
  } else if (status.requiresPermission) {
    showWarning(`⚠️ Le dossier de sauvegarde "${status.folderName}" nécessite une reconnexion. Allez dans Paramètres → Sauvegarde Automatique pour relier le dossier.`);

    // Notification navigateur pour alerter l'utilisateur
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Contingence Local - Action Requise', {
          body: `Le dossier "${status.folderName}" nécessite une reconnexion`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'fsa-permission-needed',
          requireInteraction: true
        });
      } catch (err) {
        console.log('Browser notification not supported or blocked:', err);
      }
    }
  }
}

function updateFSAUI(status) {
  const isConnected = status && status.connected;

  // Update settings UI
  if (el.fsaConnected && el.fsaDisconnected) {
    el.fsaConnected.style.display = isConnected ? "block" : "none";
    el.fsaDisconnected.style.display = isConnected ? "none" : "block";
  }

  if (isConnected && el.fsaFolderName && status.folderName) {
    el.fsaFolderName.textContent = status.folderName;
  }

  if (el.fsaStatusText) {
    el.fsaStatusText.textContent = isConnected
      ? `Connecté au dossier : ${status.folderName}`
      : "Aucun dossier lié";
  }

  // Update TopBar indicator
  if (el.fsaStatusIndicator) {
    el.fsaStatusIndicator.style.display = "flex";
  }

  if (el.fsaStatusIcon) {
    el.fsaStatusIcon.textContent = isConnected ? "cloud_done" : "cloud_off";
    el.fsaStatusIcon.style.color = isConnected ? "#00b074" : "#747780";
  }

  if (el.fsaStatusLabel) {
    el.fsaStatusLabel.textContent = isConnected ? "Sauvegarde Active" : "Non lié";
  }
}

async function autoBackupToFSA() {
  if (!window.FSA) return;

  const status = FSA.getStatus();
  if (!status.connected) return;

  try {
    const plans = state.plans;
    const settings = await listAllSettings();

    const result = await FSA.backupAll(plans, settings);

    if (result.success) {
      await setSetting("lastBackupAt", result.timestamp);
      console.log("Auto-backup FSA completed:", result.timestamp);
    }
  } catch (err) {
    console.error("Auto-backup FSA failed:", err);
  }
}

// ============================================
// BRANDING CONFIGURATION
// ============================================

async function initBranding() {
  // Set default branding if not configured
  let appName = await getSetting("appName");
  if (!appName) {
    appName = "Vanguard";
    await setSetting("appName", appName);
  }

  let appSubtitle = await getSetting("appSubtitle");
  if (!appSubtitle) {
    appSubtitle = "Command Center";
    await setSetting("appSubtitle", appSubtitle);
  }

  // Update UI
  updateBranding(appName, appSubtitle);

  // Load values in settings form if on settings page
  if (el.settingAppName) {
    el.settingAppName.value = appName;
  }
  if (el.settingAppSubtitle) {
    el.settingAppSubtitle.value = appSubtitle;
  }
  updateBrandingPreview();
}

function updateBranding(appName, appSubtitle) {
  // Update SideNav
  const sidenavTitle = document.querySelector(".sidenav-title");
  if (sidenavTitle) {
    sidenavTitle.textContent = appName;
  }

  const sidenavSubtitle = document.querySelector(".sidenav-subtitle");
  if (sidenavSubtitle) {
    sidenavSubtitle.textContent = appSubtitle;
  }

  // Update all breadcrumbs
  const breadcrumbSiteNames = document.querySelectorAll(".breadcrumb-site-name");
  breadcrumbSiteNames.forEach(breadcrumb => {
    breadcrumb.textContent = appName;
  });

  // Update page title
  document.title = `${appName} ${appSubtitle}`;
}

function updateBrandingPreview() {
  const appName = el.settingAppName?.value.trim() || "Vanguard";
  const appSubtitle = el.settingAppSubtitle?.value.trim() || "Command Center";

  if (el.brandingPreview) {
    el.brandingPreview.textContent = `${appName} ${appSubtitle}`;
  }
}

// ============================================
// CRISIS MODE PERSISTENCE
// ============================================

/**
 * Restore crisis mode from IndexedDB if it was active
 */
async function restoreCrisisMode() {
  const savedPlanId = await getSetting("activeCrisisPlanId");
  const savedActivatedAt = await getSetting("crisisActivatedAt");

  if (savedPlanId && savedActivatedAt) {
    // Vérifier que le plan existe toujours et est toujours critique
    const plan = state.plans.find(p => p.id === savedPlanId);

    if (plan && plan.criticality === "critique" && plan.status !== "archive") {
      // Restaurer l'état de crise
      state.activeCrisisPlanId = savedPlanId;
      state.crisisActivatedAt = savedActivatedAt;

      // Mettre à jour l'indicateur
      updateCrisisModeIndicator();

      console.log(`[Crisis Mode] Restored: Plan ${savedPlanId}, activated ${new Date(savedActivatedAt).toLocaleString()}`);
    } else {
      // Le plan n'est plus valide, nettoyer les données
      await setSetting("activeCrisisPlanId", null);
      await setSetting("crisisActivatedAt", null);
      console.log(`[Crisis Mode] Plan ${savedPlanId} no longer valid, cleared crisis mode`);
    }
  }
}

/**
 * Update the crisis mode indicator in the topbar
 */
function updateCrisisModeIndicator() {
  const indicator = document.getElementById("crisisModeIndicator");
  if (!indicator) return;

  if (state.activeCrisisPlanId && state.crisisActivatedAt) {
    indicator.style.display = "flex";
  } else {
    indicator.style.display = "none";
  }
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  setupStaticOptions();
  bindEvents();
  setupKeyBindings();
  registerServiceWorker();
  await refreshPlansAndRender();
  await seedIfEmpty();
  await refreshPlansAndRender();

  // Initialize branding
  await initBranding();

  // Initialize notification icon
  updateNotificationIcon();

  // Initialize FSA
  await initFSA();

  // Restore crisis mode if it was active
  await restoreCrisisMode();

  // Handle initial route
  handleHashChange();
}

init().catch((err) => {
  showError(`Erreur initialisation: ${String(err.message || err)}`);
});
