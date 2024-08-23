//TODO: le délai d'atteinte de productivité maximale doit être calculé en fonction de la compétence initiale!
//=> Ce délai doit diminuer proportionnellement
//Définir un coefficient qui harmonise automatiquement la compétence initiale avec le facteur d'apprentissage et le facteur de saturation

// Initialisation des variables globales
let productivityChart, etpChart;
let agents = [];

// Fonction pour calculer la productivité 
function calculateProductivity(t, monthsLearned, b, m, k, maxTime) {
    const totalTime = monthsLearned + t;
    const adjustedT = Math.max(0, totalTime);
    const competence = 1 - Math.exp(-k * adjustedT / maxTime);
    return m * Math.pow(competence, b);
}

// Fonction pour ajouter un nouvel agent
function addAgent() {
    const name = document.getElementById('newAgentName')?.value || 'Agent sans nom';
    const monthsLearned = parseInt(document.getElementById('newAgentMonthsLearned')?.value) || 0;
    const b = parseFloat(document.getElementById('newAgentB')?.value) || 0.5;
    const m = parseFloat(document.getElementById('newAgentM')?.value) || 1;
    const k = parseFloat(document.getElementById('newAgentK')?.value) || 3;
    const maxTime = parseInt(document.getElementById('newAgentMaxTime')?.value) || 36;
    const color = getRandomColor();
    
    if (isNaN(monthsLearned) || isNaN(b) || isNaN(m) || isNaN(k) || isNaN(maxTime)) {
        alert('Veuillez entrer des valeurs numériques valides pour tous les paramètres.');
        return;
    }
    
    agents.push({ name, monthsLearned, b, m, k, maxTime, color });
    updateAgentsList();
    updateCharts();  // Assurez-vous que cette ligne est présente
}

// Fonction pour mettre à jour la liste des agents
function updateAgentsList() {
    const list = document.getElementById('agentsList');
    list.innerHTML = '';
    agents.forEach((agent, index) => {
        list.innerHTML += `
            <div class="agent-item" style="border-left: 5px solid ${agent.color}">
                <strong>${agent.name}</strong>
                <br>Mois déjà passés à apprendre: ${agent.monthsLearned}
                <br>Facteur d'apprentissage (b): ${agent.b}
                <br>Facteur d'échelle (m): ${agent.m}
                <br>Facteur de saturation (k): ${agent.k}
                <br>Temps pour productivité max: ${agent.maxTime} mois
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
        data: labels.map(t => calculateProductivity(t, agent.monthsLearned, agent.b, agent.m, agent.k, agent.maxTime)),
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
    console.log("Updating ETP Chart");
    console.log("Labels:", labels);
    console.log("Agents:", agents);

    const datasets = agents.map(agent => {
        const data = labels.map(t => calculateProductivity(t, agent.monthsLearned, agent.b, agent.m, agent.k, agent.maxTime) / agent.m);
        console.log(`Data for ${agent.name}:`, data);
        return {
            label: `${agent.name} - ETP Productif`,
            data: data,
            borderColor: agent.color,
            backgroundColor: agent.color + '20',
            fill: false,
            tension: 0.1
        };
    });

    // Calcul de l'ETP Productif Total
    const totalEtpData = labels.map(t => 
        agents.reduce((sum, agent) => 
            sum + calculateProductivity(t, agent.monthsLearned, agent.b, agent.m, agent.k, agent.maxTime) / agent.m, 
        0)
    );
    console.log("Total ETP Data:", totalEtpData);

    // Ajout du dataset pour l'ETP Productif Total
    datasets.push({
        label: 'ETP Productif Total',
        data: totalEtpData,
        borderColor: 'rgb(0, 0, 0)',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        fill: true,
        tension: 0.1,
        borderWidth: 2
    });

    console.log("Final datasets:", datasets);

    if (etpChart) {
        console.log("Destroying existing chart");
        etpChart.destroy();
    }

    const ctx = document.getElementById('etpChart').getContext('2d');
    etpChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            scales: {
                x: { 
                    title: { display: true, text: 'Mois' }
                },
                y: { 
                    title: { display: true, text: 'ETP Productif' },
                    beginAtZero: true,
                    suggestedMax: Math.max(agents.length, 1)
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Évolution de l\'ETP Productif'
                }
            }
        }
    });

    console.log("New chart created:", etpChart);
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
    // Si l'agent a déjà atteint ou dépassé le temps pour la productivité maximale
    if (agent.monthsLearned >= agent.maxTime) {
        return "Mois 0 (déjà atteint)";
    }

    for (let t = 0; t <= maxMonths; t++) {
        const productivity = calculateProductivity(t, agent.monthsLearned, agent.b, agent.m, agent.k, agent.maxTime);
        if (productivity / agent.m >= 0.95) {
            return `Mois ${t}`;
        }
    }
    return "Non atteint dans la période";
}

// Fonction pour calculer le mois d'équilibre pour l'équipe entière
function calculateTotalEquilibriumMonth(maxMonths) {
    // Vérifier si tous les agents ont déjà atteint leur productivité maximale
    const allAgentsAtMax = agents.every(agent => agent.monthsLearned >= agent.maxTime);
    if (allAgentsAtMax) {
        return "Mois 0 (déjà atteint)";
    }

    for (let t = 0; t <= maxMonths; t++) {
        const totalEtp = agents.reduce((sum, agent) => {
            const productivity = calculateProductivity(t, agent.monthsLearned, agent.b, agent.m, agent.k, agent.maxTime);
            return sum + productivity / agent.m;
        }, 0);
        if (totalEtp >= agents.length * 0.95) {
            return `Mois ${t}`;
        }
    }
    return "Non atteint dans la période";
}


// Initialisation des graphiques au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    updateCharts();
});