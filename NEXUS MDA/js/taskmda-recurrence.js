(function initTaskMdaRecurrenceModule(global) {
  'use strict';

  /**
   * TASKMDA RECURRENCE MODULE
   * Gère la définition, validation et génération d'occurrences de tâches récurrentes
   */

  /**
   * Schéma de base pour la récurrence
   * @typedef {Object} RecurrenceConfig
   * @property {boolean} enabled - La tâche est-elle récurrente?
   * @property {string} frequency - 'weekly' | 'monthly' | 'yearly'
   * @property {number} interval - Tous les N périodes (1, 2, 3, etc.)
   * @property {Array<number>} weekdays - Pour weekly: jours de semaine [0-6] (0=dimanche)
   * @property {Array<number>} monthDays - Pour monthly: jours du mois [1-31]
   * @property {Array<string>} yearDates - Pour yearly: dates au format "MM-DD"
   * @property {string} endType - 'infinite' | 'count' | 'until'
   * @property {number} endCount - Nombre d'occurrences (si endType='count')
   * @property {string} endDate - Date limite ISO (si endType='until')
   * @property {string} startDate - Date de début au format ISO
   */

  function validateRecurrenceConfig(config) {
    if (!config) return { valid: false, errors: [] };
    
    const errors = [];

    if (!config.frequency || !['weekly', 'monthly', 'yearly'].includes(config.frequency)) {
      errors.push('frequency doit être weekly, monthly ou yearly');
    }

    if (!Number.isInteger(config.interval) || config.interval < 1) {
      errors.push('interval doit être un entier >= 1');
    }

    if (config.frequency === 'weekly') {
      if (!Array.isArray(config.weekdays) || config.weekdays.length === 0) {
        errors.push('weekdays est obligatoire et doit contenir au moins un jour');
      } else if (!config.weekdays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
        errors.push('weekdays doit être un tableau de nombres entre 0 et 6');
      }
    }

    if (config.frequency === 'monthly') {
      if (!Array.isArray(config.monthDays) || config.monthDays.length === 0) {
        errors.push('monthDays est obligatoire et doit contenir au moins un jour');
      } else if (!config.monthDays.every(d => Number.isInteger(d) && d >= 1 && d <= 31)) {
        errors.push('monthDays doit être un tableau de nombres entre 1 et 31');
      }
    }

    if (config.frequency === 'yearly') {
      if (!Array.isArray(config.yearDates) || config.yearDates.length === 0) {
        errors.push('yearDates est obligatoire et doit contenir au moins une date');
      } else if (!config.yearDates.every(d => /^\d{2}-\d{2}$/.test(d))) {
        errors.push('yearDates doit être un tableau de dates au format MM-DD');
      }
    }

    if (!['infinite', 'count', 'until'].includes(config.endType)) {
      errors.push('endType doit être infinite, count ou until');
    }

    if (config.endType === 'count' && (!Number.isInteger(config.endCount) || config.endCount < 1)) {
      errors.push('endCount doit être un entier >= 1');
    }

    if (config.endType === 'until' && !isValidISODate(config.endDate)) {
      errors.push('endDate doit être une date ISO valide (YYYY-MM-DD)');
    }

    if (!isValidISODate(config.startDate)) {
      errors.push('startDate doit être une date ISO valide (YYYY-MM-DD)');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  function isValidISODate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const match = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    if (!match) return false;
    const [y, m, d] = dateStr.split('-').map(v => parseInt(v, 10));
    const date = new Date(Date.UTC(y, m - 1, d));
    if (isNaN(date.getTime())) return false;
    return date.getUTCFullYear() === y
      && date.getUTCMonth() === (m - 1)
      && date.getUTCDate() === d;
  }

  function resolveMaxIterations(config, startDate) {
    const MIN_ITERATIONS = 1000;
    const DEFAULT_ITERATIONS = 5000;
    const MAX_ITERATIONS_CAP = 200000;
    const safeStart = startDate instanceof Date ? startDate : new Date();

    if (config?.endType === 'count') {
      const count = Math.max(1, Number.parseInt(String(config.endCount || 1), 10) || 1);
      return Math.min(MAX_ITERATIONS_CAP, Math.max(MIN_ITERATIONS, count * 370));
    }

    if (config?.endType === 'until' && isValidISODate(config.endDate)) {
      const endDate = new Date(config.endDate + 'T00:00:00Z');
      const days = Math.max(1, Math.ceil((endDate.getTime() - safeStart.getTime()) / 86400000) + 2);
      return Math.min(MAX_ITERATIONS_CAP, Math.max(MIN_ITERATIONS, days));
    }

    return DEFAULT_ITERATIONS;
  }

  /**
   * Génère les dates d'occurrence selon la configuration de récurrence
   * @param {RecurrenceConfig} config - Configuration de récurrence
   * @returns {Array<string>} - Tableau de dates ISO (YYYY-MM-DD)
   */
  function generateOccurrenceDates(config) {
    if (!config || !config.enabled) return [];
    
    const validation = validateRecurrenceConfig(config);
    if (!validation.valid) {
      console.warn('Invalid recurrence config:', validation.errors);
      return [];
    }

    const occurrences = [];
    const startDate = new Date(config.startDate + 'T00:00:00Z');

    let currentDate = new Date(startDate);
    let count = 0;

    // Limite de sécurité pour éviter les boucles infinies
    const MAX_ITERATIONS = resolveMaxIterations(config, startDate);
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      currentDate.setUTCHours(0, 0, 0, 0);

      // Vérifier si on a atteint la limite de fin
      if (config.endType === 'count' && count >= config.endCount) {
        break;
      }
      if (config.endType === 'until') {
        const endDate = new Date(config.endDate + 'T00:00:00Z');
        if (currentDate > endDate) {
          break;
        }
      }

      // Vérifier si la date courante correspond aux critères
      if (isOccurrenceMatch(currentDate, config)) {
        occurrences.push(formatDateISO(currentDate));
        count++;
      }

      // Passer à la période suivante
      advanceToNextPeriod(currentDate, config);
    }

    return occurrences;
  }

  function isOccurrenceMatch(currentDate, config) {
    if (config.frequency === 'weekly') {
      return isWeeklyMatch(currentDate, config);
    } else if (config.frequency === 'monthly') {
      return isMonthlyMatch(currentDate, config);
    } else if (config.frequency === 'yearly') {
      return isYearlyMatch(currentDate, config);
    }
    return false;
  }

  function isWeeklyMatch(currentDate, config) {
    // Calculer le nombre de semaines desde la date de début
    const startDate = new Date(config.startDate + 'T00:00:00Z');
    const daysDiff = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
    const weeksDiff = Math.floor(daysDiff / 7);

    // Vérifier que nous sommes bien sur une semaine dans l'intervalle
    if (weeksDiff % config.interval !== 0) {
      return false;
    }

    // Vérifier que le jour est dans la liste des jours sélectionnés
    const dayOfWeek = currentDate.getUTCDay();
    return config.weekdays.includes(dayOfWeek);
  }

  function isMonthlyMatch(currentDate, config) {
    // Pour mensuel avec intervalle >1, utiliser le mois comme référence
    const startDate = new Date(config.startDate + 'T00:00:00Z');
    const monthsDiff = (currentDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
                        (currentDate.getUTCMonth() - startDate.getUTCMonth());

    if (monthsDiff % config.interval !== 0 || monthsDiff < 0) {
      return false;
    }

    // Vérifier que le jour est dans la liste des jours sélectionnés
    const day = currentDate.getUTCDate();
    // Pour les jours qui n'existent pas dans tous les mois (ex: 31), adapter
    return config.monthDays.includes(day);
  }

  function isYearlyMatch(currentDate, config) {
    // Pour annuel avec intervalle >1, utiliser l'année comme référence
    const startDate = new Date(config.startDate + 'T00:00:00Z');
    const yearsDiff = currentDate.getUTCFullYear() - startDate.getUTCFullYear();

    if (yearsDiff % config.interval !== 0 || yearsDiff < 0) {
      return false;
    }

    // Vérifier que la date (MM-DD) est dans la liste des dates sélectionnées
    const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getUTCDate()).padStart(2, '0');
    const dateStr = `${month}-${day}`;

    return config.yearDates.includes(dateStr);
  }

  function advanceToNextPeriod(currentDate, config) {
    if (config.frequency === 'weekly') {
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    } else if (config.frequency === 'monthly') {
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    } else if (config.frequency === 'yearly') {
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
  }

  function formatDateISO(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Crée une configuration de récurrence par défaut
   * @returns {RecurrenceConfig}
   */
  function createDefaultConfig() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return {
      enabled: false,
      frequency: 'weekly',
      interval: 1,
      weekdays: [1], // Lundi par défaut
      monthDays: [1],
      yearDates: ['01-01'],
      endType: 'infinite',
      endCount: 10,
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      startDate: formatDateISO(tomorrow)
    };
  }

  /**
   * Formate une config de récurrence pour affichage
   * @param {RecurrenceConfig} config
   * @returns {string}
   */
  function formatRecurrenceLabel(config) {
    if (!config || !config.enabled) {
      return 'Non récurrente';
    }

    const frequencyLabels = {
      'weekly': 'Hebdomadaire',
      'monthly': 'Mensuelle',
      'yearly': 'Annuelle'
    };

    const label = frequencyLabels[config.frequency] || config.frequency;
    let details = '';

    if (config.frequency === 'weekly') {
      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const days = config.weekdays.map(d => dayNames[d]).join(', ');
      details = ` (${days})`;
    } else if (config.frequency === 'monthly') {
      const days = config.monthDays.join(', ');
      details = ` (jour${config.monthDays.length > 1 ? 's' : ''} ${days})`;
    } else if (config.frequency === 'yearly') {
      const dates = config.yearDates.join(', ');
      details = ` (${dates})`;
    }

    let endLabel = '';
    if (config.endType === 'count') {
      endLabel = ` - ${config.endCount} occurrences`;
    } else if (config.endType === 'until') {
      endLabel = ` - jusqu'au ${config.endDate}`;
    }

    return label + details + endLabel;
  }

  /**
   * Calcule la prochaine occurrence après une date donnée
   * @param {string} fromDate - Date ISO
   * @param {RecurrenceConfig} config
   * @returns {string|null} - Date ISO de la prochaine occurrence ou null
   */
  function getNextOccurrence(fromDate, config) {
    if (!config || !config.enabled) {
      return null;
    }

    const validation = validateRecurrenceConfig(config);
    if (!validation.valid) {
      return null;
    }

    const occurrences = generateOccurrenceDates(config);
    const from = new Date(fromDate + 'T00:00:00Z');

    for (const occurrence of occurrences) {
      const occDate = new Date(occurrence + 'T00:00:00Z');
      if (occDate > from) {
        return occurrence;
      }
    }

    return null;
  }

  // Export du module
  global.TaskMDARecurrence = {
    validateRecurrenceConfig,
    generateOccurrenceDates,
    createDefaultConfig,
    formatRecurrenceLabel,
    getNextOccurrence,
    isValidISODate
  };

}(window));

/* --- taskmda-recurrence-ui.js --- */

/**
 * TASKMDA RECURRENCE UI HANDLER
 * GÃ¨re l'interface utilisateur pour la configuration de la rÃ©currence
 * IntÃ©gration dans taskmda-team.js pour les Ã©vÃ©nements et validations
 */

(function initRecurrenceUIHandler() {
  'use strict';

  const STATE = {
    recurrenceConfig: null
  };

  /**
   * Initialise les comportements de l'UI de la rÃ©currence
   */
  function initRecurrenceUI() {
    const enableCheckbox = document.getElementById('task-recurrence-enabled');
    const configDiv = document.getElementById('task-recurrence-config');
    const typeSelect = document.getElementById('task-recurrence-type');
    const endTypeSelect = document.getElementById('task-recurrence-end-type');
    const dueDateWrap = document.getElementById('task-due-date-wrap');
    const startDateLabel = document.getElementById('task-recurrence-start-date-label');

    if (!enableCheckbox || !configDiv) return;

    // Toggle du formulaire de rÃ©currence
    enableCheckbox.addEventListener('change', () => {
      configDiv.classList.toggle('hidden', !enableCheckbox.checked);
      
      // Masquer/afficher l'Ã‰chÃ©ance selon la rÃ©currence
      if (dueDateWrap) {
        dueDateWrap.classList.toggle('hidden', enableCheckbox.checked);
      }
      
      // Modifier le label de la date de dÃ©part
      if (startDateLabel) {
        startDateLabel.textContent = enableCheckbox.checked 
          ? 'Date de premiÃ¨re occurrence' 
          : 'Date de dÃ©part';
      }
      
      if (enableCheckbox.checked) {
        // Copier l'Ã‰chÃ©ance vers la date de dÃ©part si elle existe
        const dueDate = document.getElementById('task-due-date');
        const startDate = document.getElementById('task-recurrence-start-date');
        if (dueDate?.value && startDate && !startDate.value) {
          startDate.value = dueDate.value;
        }
        initializeRecurrenceDefaults();
        updateRecurrenceSummary();
      } else {
        // Copier la date de dÃ©part vers l'Ã‰chÃ©ance si elle existe
        const dueDate = document.getElementById('task-due-date');
        const startDate = document.getElementById('task-recurrence-start-date');
        if (startDate?.value && dueDate && !dueDate.value) {
          dueDate.value = startDate.value;
        }
      }
    });

    // Changement du type de rÃ©currence
    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        updateRecurrenceTypeUI();
        updateRecurrenceSummary();
      });
    }

    // Changement du type de fin
    if (endTypeSelect) {
      endTypeSelect.addEventListener('change', () => {
        updateRecurrenceEndTypeUI();
        updateRecurrenceSummary();
      });
    }

    // Listener pour tous les champs de configuration
    document.addEventListener('change', (e) => {
      if (e.target.closest('#task-recurrence-config')) {
        updateRecurrenceSummary();
      }
    });

    document.addEventListener('input', (e) => {
      if (e.target.closest('#task-recurrence-config')) {
        updateRecurrenceSummary();
      }
    });
  }

  /**
   * Met Ã  jour la visibilitÃ© des champs selon le type de rÃ©currence
   */
  function updateRecurrenceTypeUI() {
    const typeSelect = document.getElementById('task-recurrence-type');
    const weeklyConfig = document.getElementById('task-recurrence-weekly-config');
    const monthlyConfig = document.getElementById('task-recurrence-monthly-config');
    const yearlyConfig = document.getElementById('task-recurrence-yearly-config');

    if (!typeSelect) return;

    const selectedType = typeSelect.value;

    if (weeklyConfig) weeklyConfig.classList.toggle('hidden', selectedType !== 'weekly');
    if (monthlyConfig) monthlyConfig.classList.toggle('hidden', selectedType !== 'monthly');
    if (yearlyConfig) yearlyConfig.classList.toggle('hidden', selectedType !== 'yearly');
  }

  /**
   * Met Ã  jour la visibilitÃ© des champs selon le type de fin
   */
  function updateRecurrenceEndTypeUI() {
    const endTypeSelect = document.getElementById('task-recurrence-end-type');
    const countConfig = document.getElementById('task-recurrence-count-config');
    const untilConfig = document.getElementById('task-recurrence-until-config');

    if (!endTypeSelect) return;

    const selectedEndType = endTypeSelect.value;

    if (countConfig) countConfig.classList.toggle('hidden', selectedEndType !== 'count');
    if (untilConfig) untilConfig.classList.toggle('hidden', selectedEndType !== 'until');
  }

  /**
   * Initialise les valeurs par dÃ©faut pour la rÃ©currence
   */
  function initializeRecurrenceDefaults() {
    const startDateInput = document.getElementById('task-recurrence-start-date');
    const dueDateInput = document.getElementById('task-due-date');

    if (startDateInput && !startDateInput.value) {
      // Si une date d'Ã©chÃ©ance est dÃ©finie, l'utiliser comme date de dÃ©part
      if (dueDateInput && dueDateInput.value) {
        startDateInput.value = dueDateInput.value;
      } else {
        // Sinon, utiliser demain
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        startDateInput.value = tomorrow.toISOString().split('T')[0];
      }
    }

    const endDateInput = document.getElementById('task-recurrence-end-date');
    if (endDateInput && !endDateInput.value) {
      // DÃ©finir une date de fin par dÃ©faut un an Ã  partir de maintenant
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      endDateInput.value = nextYear.toISOString().split('T')[0];
    }
  }

  /**
   * GÃ©nÃ¨re un rÃ©sumÃ© lisible de la configuration de rÃ©currence
   */
  function updateRecurrenceSummary() {
    const summaryDiv = document.getElementById('task-recurrence-summary');
    if (!summaryDiv) return;

    try {
      const config = extractRecurrenceConfig();
      if (!config || !config.enabled) {
        summaryDiv.textContent = 'RÃ©currence dÃ©sactivÃ©e';
        summaryDiv.className = 'px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900';
        return;
      }

      const label = window.TaskMDARecurrence?.formatRecurrenceLabel?.(config);
      if (label) {
        summaryDiv.textContent = `âœ“ ${label}`;
        summaryDiv.className = 'px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900';
      } else {
        summaryDiv.textContent = 'Configuration en cours...';
        summaryDiv.className = 'px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900';
      }
    } catch (error) {
      summaryDiv.textContent = `âš  ${error.message}`;
      summaryDiv.className = 'px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900';
    }
  }

  /**
   * Extrait la configuration de rÃ©currence du formulaire
   * @returns {Object|null}
   */
  function extractRecurrenceConfig() {
    const enableCheckbox = document.getElementById('task-recurrence-enabled');
    if (!enableCheckbox?.checked) {
      return null;
    }

    const typeSelect = document.getElementById('task-recurrence-type');
    const intervalInput = document.getElementById('task-recurrence-interval');
    const startDateInput = document.getElementById('task-recurrence-start-date');
    const endTypeSelect = document.getElementById('task-recurrence-end-type');

    const frequency = typeSelect?.value || 'weekly';
    const interval = parseInt(intervalInput?.value || '1', 10) || 1;
    const startDate = startDateInput?.value || '';
    const endType = endTypeSelect?.value || 'infinite';

    let weekdays = [];
    let monthDays = [];
    let yearDates = [];

    // Extraire les jours de la semaine
    if (frequency === 'weekly') {
      const weekdayCheckboxes = document.querySelectorAll('input[name="task-recurrence-weekday"]:checked');
      weekdays = Array.from(weekdayCheckboxes).map(cb => parseInt(cb.value, 10));
      if (weekdays.length === 0) {
        throw new Error('SÃ©lectionnez au moins un jour de la semaine');
      }
    }

    // Extraire les jours du mois
    if (frequency === 'monthly') {
      const monthDaysInput = document.getElementById('task-recurrence-month-days');
      const monthDaysStr = (monthDaysInput?.value || '').trim();
      if (!monthDaysStr) {
        throw new Error('Entrez les jours du mois');
      }
      monthDays = monthDaysStr.split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n) && n >= 1 && n <= 31);
      if (monthDays.length === 0) {
        throw new Error('Les jours doivent Ãªtre des nombres entre 1 et 31');
      }
    }

    // Extraire les dates de l'annÃ©e
    if (frequency === 'yearly') {
      const yearDatesInput = document.getElementById('task-recurrence-year-dates');
      const yearDatesStr = (yearDatesInput?.value || '').trim();
      if (!yearDatesStr) {
        throw new Error('Entrez les dates (format MM-DD)');
      }
      yearDates = yearDatesStr.split(',')
        .map(s => s.trim())
        .filter(s => /^\d{2}-\d{2}$/.test(s));
      if (yearDates.length === 0) {
        throw new Error('Les dates doivent Ãªtre au format MM-DD');
      }
    }

    if (!startDate) {
      throw new Error('La date de dÃ©part est obligatoire');
    }

    const config = {
      enabled: true,
      frequency,
      interval,
      weekdays,
      monthDays,
      yearDates,
      endType,
      startDate
    };

    // Ajouter les propriÃ©tÃ©s de fin selon le type
    if (endType === 'count') {
      const endCountInput = document.getElementById('task-recurrence-end-count');
      const endCount = parseInt(endCountInput?.value || '10', 10);
      if (endCount < 1) {
        throw new Error('Le nombre d\'occurrences doit Ãªtre >= 1');
      }
      config.endCount = endCount;
    } else if (endType === 'until') {
      const endDateInput = document.getElementById('task-recurrence-end-date');
      if (!endDateInput?.value) {
        throw new Error('La date de fin est obligatoire');
      }
      config.endDate = endDateInput.value;
    }

    return config;
  }

  /**
   * Remplit le formulaire avec une configuration de rÃ©currence existante
   * @param {Object} config - Configuration de rÃ©currence
   */
  function populateRecurrenceForm(config) {
    if (!config || !config.enabled) {
      const enableCheckbox = document.getElementById('task-recurrence-enabled');
      if (enableCheckbox) enableCheckbox.checked = false;
      const configDiv = document.getElementById('task-recurrence-config');
      if (configDiv) configDiv.classList.add('hidden');
      const dueDateWrap = document.getElementById('task-due-date-wrap');
      if (dueDateWrap) dueDateWrap.classList.remove('hidden');
      return;
    }

    const enableCheckbox = document.getElementById('task-recurrence-enabled');
    if (enableCheckbox) enableCheckbox.checked = true;

    const configDiv = document.getElementById('task-recurrence-config');
    if (configDiv) configDiv.classList.remove('hidden');
    
    // Masquer l'Ã‰chÃ©ance quand la rÃ©currence est activÃ©e
    const dueDateWrap = document.getElementById('task-due-date-wrap');
    if (dueDateWrap) dueDateWrap.classList.add('hidden');
    
    // Mettre Ã  jour le label de la date de dÃ©part
    const startDateLabel = document.getElementById('task-recurrence-start-date-label');
    if (startDateLabel) {
      startDateLabel.textContent = 'Date de premiÃ¨re occurrence';
    }

    // Remplir le type de rÃ©currence
    const typeSelect = document.getElementById('task-recurrence-type');
    if (typeSelect && config.frequency) {
      typeSelect.value = config.frequency;
      updateRecurrenceTypeUI();
    }

    // Remplir l'intervalle
    const intervalInput = document.getElementById('task-recurrence-interval');
    if (intervalInput && config.interval) {
      intervalInput.value = config.interval;
    }

    // Remplir les jours de la semaine
    if (config.frequency === 'weekly' && Array.isArray(config.weekdays)) {
      const weekdayCheckboxes = document.querySelectorAll('input[name="task-recurrence-weekday"]');
      weekdayCheckboxes.forEach(cb => {
        cb.checked = config.weekdays.includes(parseInt(cb.value, 10));
      });
    }

    // Remplir les jours du mois
    if (config.frequency === 'monthly' && Array.isArray(config.monthDays)) {
      const monthDaysInput = document.getElementById('task-recurrence-month-days');
      if (monthDaysInput) {
        monthDaysInput.value = config.monthDays.join(', ');
      }
    }

    // Remplir les dates de l'annÃ©e
    if (config.frequency === 'yearly' && Array.isArray(config.yearDates)) {
      const yearDatesInput = document.getElementById('task-recurrence-year-dates');
      if (yearDatesInput) {
        yearDatesInput.value = config.yearDates.join(', ');
      }
    }

    // Remplir la date de dÃ©part
    const startDateInput = document.getElementById('task-recurrence-start-date');
    if (startDateInput && config.startDate) {
      startDateInput.value = config.startDate;
    }

    // Remplir le type de fin
    const endTypeSelect = document.getElementById('task-recurrence-end-type');
    if (endTypeSelect && config.endType) {
      endTypeSelect.value = config.endType;
      updateRecurrenceEndTypeUI();
    }

    // Remplir le nombre d'occurrences
    if (config.endType === 'count') {
      const endCountInput = document.getElementById('task-recurrence-end-count');
      if (endCountInput && config.endCount) {
        endCountInput.value = config.endCount;
      }
    }

    // Remplir la date de fin
    if (config.endType === 'until') {
      const endDateInput = document.getElementById('task-recurrence-end-date');
      if (endDateInput && config.endDate) {
        endDateInput.value = config.endDate;
      }
    }

    updateRecurrenceSummary();
  }

  /**
   * RÃ©initialise le formulaire de rÃ©currence
   */
  function resetRecurrenceForm() {
    const enableCheckbox = document.getElementById('task-recurrence-enabled');
    if (enableCheckbox) enableCheckbox.checked = false;

    const configDiv = document.getElementById('task-recurrence-config');
    if (configDiv) configDiv.classList.add('hidden');
    
    // Afficher l'Ã‰chÃ©ance
    const dueDateWrap = document.getElementById('task-due-date-wrap');
    if (dueDateWrap) dueDateWrap.classList.remove('hidden');
    
    // Restaurer le label original
    const startDateLabel = document.getElementById('task-recurrence-start-date-label');
    if (startDateLabel) {
      startDateLabel.textContent = 'Date de dÃ©part';
    }

    // RÃ©initialiser tous les champs
    document.getElementById('task-recurrence-type').value = 'weekly';
    document.getElementById('task-recurrence-interval').value = '1';
    document.getElementById('task-recurrence-month-days').value = '';
    document.getElementById('task-recurrence-year-dates').value = '';
    document.getElementById('task-recurrence-start-date').value = '';
    document.getElementById('task-recurrence-end-type').value = 'infinite';
    document.getElementById('task-recurrence-end-count').value = '10';
    document.getElementById('task-recurrence-end-date').value = '';

    // RÃ©initialiser les checkboxes
    document.querySelectorAll('input[name="task-recurrence-weekday"]').forEach(cb => {
      cb.checked = cb.value === '1'; // Lundi par dÃ©faut
    });

    // Remasquer les sections spÃ©cifiques
    updateRecurrenceTypeUI();
    updateRecurrenceEndTypeUI();
  }

  // Export des fonctions publiques
  window.TaskMDARecurrenceUI = {
    init: initRecurrenceUI,
    extractRecurrenceConfig,
    populateRecurrenceForm,
    resetRecurrenceForm,
    updateRecurrenceSummary
  };

  // Auto-initialisation au chargement du document
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRecurrenceUI);
  } else {
    initRecurrenceUI();
  }
})();
