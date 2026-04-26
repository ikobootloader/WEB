(function initTaskMdaWorkflowGraph(global) {
  'use strict';

  function normalizeText(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function buildMapRelations(params) {
    const maps = params?.maps || {};
    const services = Array.isArray(params?.services) ? params.services : [];
    const groups = Array.isArray(params?.groups) ? params.groups : [];
    const agents = Array.isArray(params?.agents) ? params.agents : [];
    const tasks = Array.isArray(params?.tasks) ? params.tasks : [];
    const serviceIds = new Set(services.map((row) => String(row.id)));
    const groupIds = new Set(groups.map((row) => String(row.id)));
    const taskIds = new Set(tasks.map((row) => String(row.id)));
    const structure = [];
    const transverse = [];
    const applicative = [];

    services.forEach((service) => {
      if (service.communityId) {
        structure.push({
          label: 'Communaute -> Service',
          source: { type: 'community', id: service.communityId, name: maps.communityById?.get(service.communityId)?.name || service.communityId },
          target: { type: 'service', id: service.id, name: service.name || service.id }
        });
      }
      (service.relatedServiceIds || []).forEach((relatedId) => {
        if (!serviceIds.has(String(relatedId))) return;
        if (String(relatedId) <= String(service.id)) return;
        transverse.push({
          label: 'Service <-> Service',
          source: { type: 'service', id: service.id, name: service.name || service.id },
          target: { type: 'service', id: relatedId, name: maps.serviceById?.get(relatedId)?.name || relatedId }
        });
      });
    });

    groups.forEach((group) => {
      structure.push({
        label: 'Service -> Groupe',
        source: { type: 'service', id: group.serviceId, name: maps.serviceById?.get(group.serviceId)?.name || group.serviceId || 'Sans service' },
        target: { type: 'group', id: group.id, name: group.name || group.id }
      });
    });

    agents.forEach((agent) => {
      if (Array.isArray(agent.groupIds) && agent.groupIds.some((id) => groupIds.has(String(id)))) {
        agent.groupIds.filter((id) => groupIds.has(String(id))).forEach((groupId) => {
          structure.push({
            label: 'Groupe -> Agent',
            source: { type: 'group', id: groupId, name: maps.groupById?.get(groupId)?.name || groupId },
            target: { type: 'agent', id: agent.id, name: agent.displayName || agent.id }
          });
        });
        return;
      }
      structure.push({
        label: 'Service -> Agent',
        source: { type: 'service', id: agent.serviceId, name: maps.serviceById?.get(agent.serviceId)?.name || agent.serviceId || 'Sans service' },
        target: { type: 'agent', id: agent.id, name: agent.displayName || agent.id }
      });
    });

    tasks.forEach((task) => {
      if (!taskIds.has(String(task.id))) return;
      if (task.linkedProcedureId) {
        applicative.push({
          label: 'Tache -> Procedure',
          source: { type: 'task', id: task.id, name: task.title || task.id },
          target: { type: 'procedure', id: task.linkedProcedureId, name: maps.procedureById?.get(task.linkedProcedureId)?.title || task.linkedProcedureId }
        });
      }
      (task.linkedSoftwareIds || []).forEach((softwareId) => {
        applicative.push({
          label: 'Tache -> Logiciel',
          source: { type: 'task', id: task.id, name: task.title || task.id },
          target: { type: 'software', id: softwareId, name: maps.softwareById?.get(softwareId)?.name || softwareId }
        });
      });
    });

    return { structure, transverse, applicative };
  }

  function filterAndSortRelations(relations, query, sortKey) {
    const safeQuery = normalizeText(query);
    const safeSort = ['source', 'target', 'label'].includes(String(sortKey || '')) ? String(sortKey) : 'source';
    const list = Array.isArray(relations) ? relations : [];
    const filtered = list.filter((link) => {
      if (!safeQuery) return true;
      const haystack = normalizeText(`${link?.label || ''} ${link?.source?.name || ''} ${link?.target?.name || ''}`);
      return haystack.includes(safeQuery);
    });
    return filtered.sort((a, b) => {
      const sourceCmp = String(a?.source?.name || '').localeCompare(String(b?.source?.name || ''), 'fr');
      const targetCmp = String(a?.target?.name || '').localeCompare(String(b?.target?.name || ''), 'fr');
      const labelCmp = String(a?.label || '').localeCompare(String(b?.label || ''), 'fr');
      if (safeSort === 'target') return targetCmp || sourceCmp || labelCmp;
      if (safeSort === 'label') return labelCmp || sourceCmp || targetCmp;
      return sourceCmp || targetCmp || labelCmp;
    });
  }

  global.TaskMDAWorkflowGraph = {
    buildMapRelations,
    filterAndSortRelations
  };
}(window));

