// Initialisation des variables globales
let productivityChart, etpChart;
let agents = [];

// Fonction pour calculer la productivité 
function calculateProductivity(t, c0, r, b, m, k) {
    const adjustedT = Math.max(0, t);
    const competence = c0 + (1 - c0) * (1 - Math.exp(-k * adjustedT));
    return m * Math.pow(competence, b);
}

// Fonction pour ajouter un nouvel agent
function addAgent() {
    const name = document.getElementById('newAgentName')?.value || 'Agent sans nom';
    const c0 = parseFloat(document.getElementById('newAgentC0')?.value) || 0.2;
    const r = parseFloat(document.getElementById('newAgentR')?.value) || 0.05;
    const b = parseFloat(document.getElementById('newAgentB')?.value) || 0.5;
    const m = parseFloat(document.getElementById('newAgentM')?.value) || 1;
    const k = parseFloat(document.getElementById('newAgentK')?.value) || 0.1; // Nouveau paramètre : facteur de saturation
    const color = getRandomColor();
    
    if (isNaN(c0) || isNaN(r) || isNaN(b) || isNaN(m) || isNaN(k)) {
        alert('Veuillez entrer des valeurs numériques valides pour tous les paramètres.');
        return;
    }
    
    agents.push({ name, c0, r, b, m, k, color });
    updateAgentsList();
    updateCharts();
}

// Fonction pour mettre à jour la liste des agents
function updateAgentsList() {
    const list = document.getElementById('agentsList');
    list.innerHTML = '';
    agents.forEach((agent, index) => {
        list.innerHTML += `
            <div class="agent-item" style="border-left: 5px solid ${agent.color}">
                <strong>${agent.name}</strong>
                <br>Compétence initiale (c0): ${agent.c0}
                <br>Taux d'apprentissage (r): ${agent.r}
                <br>Facteur d'apprentissage (b): ${agent.b}
                <br>Facteur d'échelle (m): ${agent.m}
                <br>Facteur de saturation (k): ${agent.k}
                <button onclick="removeAgent(${index})">Supprimer</button>
            </div>`;
    });
}

// Fonction pour supprimer un agent
function removeAgent(index) {
    agents.splice(index, 1);
    updateAgentsList();
    updateCharts();
}

// Fonction pour générer une couleur aléatoire
function getRandomColor() {
    return '#' + Math.floor(Math.random()*16777215).toString(16);
}

// Fonction principale pour mettre à jour les graphiques
function updateCharts() {
    const duree = parseInt(document.getElementById('duree').value);
    const labels = Array.from({length: duree + 1}, (_, i) => i);

    updateProductivityChart(labels);
    updateEtpChart(labels);
    updateEquilibriumInfo(duree);
}

// Fonction pour mettre à jour le graphique de productivité
function updateProductivityChart(labels) {
    const datasets = agents.map(agent => ({
        label: `${agent.name} - Productivité`,
        data: labels.map(t => calculateProductivity(t, agent.c0, agent.r, agent.b, agent.m, agent.k)),
        borderColor: agent.color,
        tension: 0.1
    }));

    if (productivityChart) {
        productivityChart.destroy();
    }

    const ctx = document.getElementById('productivityChart').getContext('2d');
    productivityChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: 'Mois' } },
                y: { 
                    title: { display: true, text: 'Productivité' },
                    beginAtZero: true
                }
            }
        }
    });
}

// Fonction pour mettre à jour le graphique d'ETP
function updateEtpChart(labels) {
    const datasets = agents.map(agent => ({
        label: `${agent.name} - ETP Productif`,
        data: labels.map(t => calculateProductivity(t, agent.c0, agent.r, agent.b, agent.m, agent.k) / agent.m),
        borderColor: agent.color,
        tension: 0.1
    }));

    const totalEtpData = labels.map(t => {
        return agents.reduce((sum, agent) => sum + calculateProductivity(t, agent.c0, agent.r, agent.b, agent.m, agent.k) / agent.m, 0);
    });

    datasets.push({
        label: 'ETP Productif Total',
        data: totalEtpData,
        borderColor: 'rgb(0, 0, 0)',
        borderWidth: 3,
        tension: 0.1
    });

    if (etpChart) {
        etpChart.destroy();
    }

    const ctx = document.getElementById('etpChart').getContext('2d');
    etpChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: 'Mois' } },
                y: { 
                    title: { display: true, text: 'ETP Productif' },
                    beginAtZero: true,
                    max: Math.max(agents.length, 1)
                }
            }
        }
    });
}

// Fonction pour mettre à jour les informations d'équilibre
function updateEquilibriumInfo(duree) {
    const equilibriumInfo = document.getElementById('equilibriumInfo');
    let infoText = "<h3>Points d'équilibre ETP productif = ETP théorique</h3>";

    agents.forEach(agent => {
        const equilibriumMonth = calculateEquilibriumMonth(agent, duree);
        infoText += `<p><strong>${agent.name}</strong>: ${equilibriumMonth}</p>`;
    });

    const totalEquilibriumMonth = calculateTotalEquilibriumMonth(duree);
    infoText += `<p><strong>Équipe entière</strong>: ${totalEquilibriumMonth}</p>`;

    equilibriumInfo.innerHTML = infoText;
}

// Fonction pour calculer le mois d'équilibre pour un agent
function calculateEquilibriumMonth(agent, maxMonths) {
    for (let t = 0; t <= maxMonths; t++) {
        if (calculateProductivity(t, agent.c0, agent.r, agent.b, agent.m) / agent.m >= 0.99) {
            return `Mois ${t}`;
        }
    }
    return "Non atteint dans la période";
}

// Fonction pour calculer le mois d'équilibre pour l'équipe entière
function calculateTotalEquilibriumMonth(maxMonths) {
    for (let t = 0; t <= maxMonths; t++) {
        const totalEtp = agents.reduce((sum, agent) => sum + calculateProductivity(t, agent.c0, agent.r, agent.b, agent.m) / agent.m, 0);
        if (totalEtp >= agents.length * 0.99) {
            return `Mois ${t}`;
        }
    }
    return "Non atteint dans la période";
}

// Initialisation des graphiques au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    // Initialisation des graphiques ou autres fonctions de démarrage
    updateCharts();
});