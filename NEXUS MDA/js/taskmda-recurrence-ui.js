/**
 * TASKMDA RECURRENCE UI HANDLER
 * Gère l'interface utilisateur pour la configuration de la récurrence
 * Intégration dans taskmda-team.js pour les événements et validations
 */

(function initRecurrenceUIHandler() {
  'use strict';

  const STATE = {
    recurrenceConfig: null
  };

  /**
   * Initialise les comportements de l'UI de la récurrence
   */
  function initRecurrenceUI() {
    const enableCheckbox = document.getElementById('task-recurrence-enabled');
    const configDiv = document.getElementById('task-recurrence-config');
    const typeSelect = document.getElementById('task-recurrence-type');
    const endTypeSelect = document.getElementById('task-recurrence-end-type');
    const dueDateWrap = document.getElementById('task-due-date-wrap');
    const startDateLabel = document.getElementById('task-recurrence-start-date-label');

    if (!enableCheckbox || !configDiv) return;

    // Toggle du formulaire de récurrence
    enableCheckbox.addEventListener('change', () => {
      configDiv.classList.toggle('hidden', !enableCheckbox.checked);
      
      // Masquer/afficher l'Échéance selon la récurrence
      if (dueDateWrap) {
        dueDateWrap.classList.toggle('hidden', enableCheckbox.checked);
      }
      
      // Modifier le label de la date de départ
      if (startDateLabel) {
        startDateLabel.textContent = enableCheckbox.checked 
          ? 'Date de première occurrence' 
          : 'Date de départ';
      }
      
      if (enableCheckbox.checked) {
        // Copier l'Échéance vers la date de départ si elle existe
        const dueDate = document.getElementById('task-due-date');
        const startDate = document.getElementById('task-recurrence-start-date');
        if (dueDate?.value && startDate && !startDate.value) {
          startDate.value = dueDate.value;
        }
        initializeRecurrenceDefaults();
        updateRecurrenceSummary();
      } else {
        // Copier la date de départ vers l'Échéance si elle existe
        const dueDate = document.getElementById('task-due-date');
        const startDate = document.getElementById('task-recurrence-start-date');
        if (startDate?.value && dueDate && !dueDate.value) {
          dueDate.value = startDate.value;
        }
      }
    });

    // Changement du type de récurrence
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
   * Met à jour la visibilité des champs selon le type de récurrence
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
   * Met à jour la visibilité des champs selon le type de fin
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
   * Initialise les valeurs par défaut pour la récurrence
   */
  function initializeRecurrenceDefaults() {
    const startDateInput = document.getElementById('task-recurrence-start-date');
    const dueDateInput = document.getElementById('task-due-date');

    if (startDateInput && !startDateInput.value) {
      // Si une date d'échéance est définie, l'utiliser comme date de départ
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
      // Définir une date de fin par défaut un an à partir de maintenant
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      endDateInput.value = nextYear.toISOString().split('T')[0];
    }
  }

  /**
   * Génère un résumé lisible de la configuration de récurrence
   */
  function updateRecurrenceSummary() {
    const summaryDiv = document.getElementById('task-recurrence-summary');
    if (!summaryDiv) return;

    try {
      const config = extractRecurrenceConfig();
      if (!config || !config.enabled) {
        summaryDiv.textContent = 'Récurrence désactivée';
        summaryDiv.className = 'px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900';
        return;
      }

      const label = window.TaskMDARecurrence?.formatRecurrenceLabel?.(config);
      if (label) {
        summaryDiv.textContent = `✓ ${label}`;
        summaryDiv.className = 'px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900';
      } else {
        summaryDiv.textContent = 'Configuration en cours...';
        summaryDiv.className = 'px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900';
      }
    } catch (error) {
      summaryDiv.textContent = `⚠ ${error.message}`;
      summaryDiv.className = 'px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900';
    }
  }

  /**
   * Extrait la configuration de récurrence du formulaire
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
        throw new Error('Sélectionnez au moins un jour de la semaine');
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
        throw new Error('Les jours doivent être des nombres entre 1 et 31');
      }
    }

    // Extraire les dates de l'année
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
        throw new Error('Les dates doivent être au format MM-DD');
      }
    }

    if (!startDate) {
      throw new Error('La date de départ est obligatoire');
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

    // Ajouter les propriétés de fin selon le type
    if (endType === 'count') {
      const endCountInput = document.getElementById('task-recurrence-end-count');
      const endCount = parseInt(endCountInput?.value || '10', 10);
      if (endCount < 1) {
        throw new Error('Le nombre d\'occurrences doit être >= 1');
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
   * Remplit le formulaire avec une configuration de récurrence existante
   * @param {Object} config - Configuration de récurrence
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
    
    // Masquer l'Échéance quand la récurrence est activée
    const dueDateWrap = document.getElementById('task-due-date-wrap');
    if (dueDateWrap) dueDateWrap.classList.add('hidden');
    
    // Mettre à jour le label de la date de départ
    const startDateLabel = document.getElementById('task-recurrence-start-date-label');
    if (startDateLabel) {
      startDateLabel.textContent = 'Date de première occurrence';
    }

    // Remplir le type de récurrence
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

    // Remplir les dates de l'année
    if (config.frequency === 'yearly' && Array.isArray(config.yearDates)) {
      const yearDatesInput = document.getElementById('task-recurrence-year-dates');
      if (yearDatesInput) {
        yearDatesInput.value = config.yearDates.join(', ');
      }
    }

    // Remplir la date de départ
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
   * Réinitialise le formulaire de récurrence
   */
  function resetRecurrenceForm() {
    const enableCheckbox = document.getElementById('task-recurrence-enabled');
    if (enableCheckbox) enableCheckbox.checked = false;

    const configDiv = document.getElementById('task-recurrence-config');
    if (configDiv) configDiv.classList.add('hidden');
    
    // Afficher l'Échéance
    const dueDateWrap = document.getElementById('task-due-date-wrap');
    if (dueDateWrap) dueDateWrap.classList.remove('hidden');
    
    // Restaurer le label original
    const startDateLabel = document.getElementById('task-recurrence-start-date-label');
    if (startDateLabel) {
      startDateLabel.textContent = 'Date de départ';
    }

    // Réinitialiser tous les champs
    document.getElementById('task-recurrence-type').value = 'weekly';
    document.getElementById('task-recurrence-interval').value = '1';
    document.getElementById('task-recurrence-month-days').value = '';
    document.getElementById('task-recurrence-year-dates').value = '';
    document.getElementById('task-recurrence-start-date').value = '';
    document.getElementById('task-recurrence-end-type').value = 'infinite';
    document.getElementById('task-recurrence-end-count').value = '10';
    document.getElementById('task-recurrence-end-date').value = '';

    // Réinitialiser les checkboxes
    document.querySelectorAll('input[name="task-recurrence-weekday"]').forEach(cb => {
      cb.checked = cb.value === '1'; // Lundi par défaut
    });

    // Remasquer les sections spécifiques
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
