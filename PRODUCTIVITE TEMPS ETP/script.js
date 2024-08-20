// Initialisation des variables globales
let productivityChart, etpChart;
let agents = [];

// Fonction pour calculer la productivité 
//TODO:rendre le calcul plus fiable !! 
function calculateProductivity(t, c0, r, b) {
	const adjustedT = Math.max(0, t);
    const competence = Math.pow(c0,b) + (r * adjustedT);
	return Math.pow(c0,b) + (1 - Math.pow(c0,b)) * (1 - Math.exp(-b * competence));
}

// Fonction pour ajouter un nouvel agent
function addAgent() {
    const name = document.getElementById('newAgentName').value;
    const c0 = parseFloat(document.getElementById('newAgentC0').value);
    const r = parseFloat(document.getElementById('newAgentR').value);
    const b = parseFloat(document.getElementById('newAgentB').value);
    const color = getRandomColor();
    
    agents.push({ name, c0, r, b, color });
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
                <br>Compétence initiale: ${agent.c0}
                <br>Taux d'augmentation: ${agent.r}
                <br>Facteur d'apprentissage: ${agent.b}
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
        data: labels.map(t => calculateProductivity(t, agent.c0, agent.r, agent.b)),
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
                    beginAtZero: true,
                    max: 1
                }
            }
        }
    });
}

// Fonction pour mettre à jour le graphique d'ETP
function updateEtpChart(labels) {
    const datasets = agents.map(agent => ({
        label: `${agent.name} - ETP Productif`,
        data: labels.map(t => calculateProductivity(t, agent.c0, agent.r, agent.b)),
        borderColor: agent.color,
        tension: 0.1
    }));

    const totalEtpData = labels.map(t => {
        return agents.reduce((sum, agent) => sum + calculateProductivity(t, agent.c0, agent.r, agent.b), 0);
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
        if (calculateProductivity(t, agent.c0, agent.r, agent.b) >= 0.99) {
            return `Mois ${t}`;
        }
    }
    return "Non atteint dans la période";
}

// Fonction pour calculer le mois d'équilibre pour l'équipe entière
function calculateTotalEquilibriumMonth(maxMonths) {
    for (let t = 0; t <= maxMonths; t++) {
        const totalEtp = agents.reduce((sum, agent) => sum + calculateProductivity(t, agent.c0, agent.r, agent.b), 0);
        if (totalEtp >= agents.length * 0.99) {
            return `Mois ${t}`;
        }
    }
    return "Non atteint dans la période";
}

// Initialisation des graphiques au chargement de la page
document.addEventListener('DOMContentLoaded', updateCharts);