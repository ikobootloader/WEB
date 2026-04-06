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
