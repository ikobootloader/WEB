//Peut-être implémenter l'idée que plus l'agent est proche d'un point de recharge plus l'influence de celui-ci augmente : cela permet à l'agent de profiter du point de recharge le plus proche et ne plus être attiré par un cluster de points de recharge plus éloigné. Peut-être envisager que les influences des PdR ne soient pas cumulatives ?

document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('territory');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const stepSize = 5;
    const gridWidth = width / stepSize;
    const gridHeight = height / stepSize;

    let agentX = Math.floor(gridWidth / 2) * stepSize;
    let agentY = Math.floor(gridHeight / 2) * stepSize;

    let agentHealth = 500;
    const maxHealth = 500;
    const criticalHealthThreshold = 0.2 * maxHealth;

    let modeSurvival = false;

    const numObstacles = 800;
    const numRewards = 50;
    const gamma = 0.9;

    const obstacles = [];
    const rewards = [];
    const stateValues = Array(gridWidth).fill().map(() => Array(gridHeight).fill(0));

    const discoveredObstacles = [];
    const discoveredRewards = [];

    const healthDisplay = document.getElementById('health');
    healthDisplay.textContent = agentHealth;

    const directionDisplay = document.getElementById('direction');
    directionDisplay.textContent = "Exploration";

    // Nouvel élément pour afficher la valeur de l'état
    const stateValueDisplay = document.getElementById('stateValue');
    stateValueDisplay.textContent = "0";	
	
// Add these variables at the beginning of your script, after other variable declarations
let visitedPositions = new Map();
let lastPosition = null;	

    function drawObstacle(x, y) {
        ctx.fillStyle = 'red';
        ctx.fillRect(x, y, stepSize, stepSize);
    }

    function drawReward(x, y) {
        ctx.fillStyle = 'green';
        ctx.fillRect(x, y, stepSize, stepSize);
    }

function generateObstaclesAndRewards() {
    const occupiedCells = new Set();

    for (let i = 0; i < numObstacles; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * gridWidth) * stepSize;
            y = Math.floor(Math.random() * gridHeight) * stepSize;
        } while (occupiedCells.has(`${x},${y}`));
        
        obstacles.push({ x, y });
        occupiedCells.add(`${x},${y}`);
    }

    for (let i = 0; i < numRewards; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * gridWidth) * stepSize;
            y = Math.floor(Math.random() * gridHeight) * stepSize;
        } while (occupiedCells.has(`${x},${y}`));
        
        rewards.push({ x, y, value: 1 });
        occupiedCells.add(`${x},${y}`);
    }
}

    function isObstacle(x, y) {
        return obstacles.some(obstacle => obstacle.x === x && obstacle.y === y);
    }

    function isReward(x, y) {
        return rewards.some(reward => reward.x === x && reward.y === y);
    }

	function propagateValues() {
		stateValues.forEach(row => row.fill(0));

		discoveredRewards.forEach(reward => {
			stateValues[reward.x / stepSize][reward.y / stepSize] = Infinity;

			for (let i = 0; i < gridWidth; i++) {
				for (let j = 0; j < gridHeight; j++) {
					if (i * stepSize !== reward.x || j * stepSize !== reward.y) {
						const distance = Math.abs(i * stepSize - reward.x) + Math.abs(j * stepSize - reward.y);
						stateValues[i][j] += Math.pow(gamma, distance / stepSize) * reward.value;
					}
				}
			}
		});

		discoveredObstacles.forEach(obstacle => {
			stateValues[obstacle.x / stepSize][obstacle.y / stepSize] = -1;
		});
	}

    function drawAgent(x, y) {
        ctx.fillStyle = 'blue';
        ctx.fillRect(x, y, stepSize, stepSize);
    }

    function clearAgent(x, y) {
        ctx.clearRect(x, y, stepSize, stepSize);
    }

    function discoverSurroundings() {
        const surroundingCells = [
            { x: agentX, y: agentY },
            { x: agentX + stepSize, y: agentY },
            { x: agentX - stepSize, y: agentY },
            { x: agentX, y: agentY + stepSize },
            { x: agentX, y: agentY - stepSize }
        ];

        surroundingCells.forEach(cell => {
            if (isReward(cell.x, cell.y) && !discoveredRewards.some(reward => reward.x === cell.x && reward.y === cell.y)) {
                const reward = rewards.find(reward => reward.x === cell.x && reward.y === cell.y);
                discoveredRewards.push(reward);
                drawReward(cell.x, cell.y);
            }

            if (isObstacle(cell.x, cell.y) && !discoveredObstacles.some(obstacle => obstacle.x === cell.x && obstacle.y === cell.y)) {
                const obstacle = obstacles.find(obstacle => obstacle.x === cell.x && obstacle.y === cell.y);
                discoveredObstacles.push(obstacle);
                drawObstacle(cell.x, cell.y);
            }
        });
    }
	
// Add this function to check if the agent has iterated twice over two same positions
function hasTwoIterationsOverTwoPositions() {
    const recentPositions = Array.from(visitedPositions.entries())
        .filter(([_, count]) => count >= 2)
        .map(([pos, _]) => pos);
    return recentPositions.length >= 2;
}	

// Modify the findBestDirection function
function findBestDirection() {
    const directions = [
        { x: 0, y: -stepSize, name: 'Haut' },
        { x: 0, y: stepSize, name: 'Bas' },
        { x: -stepSize, y: 0, name: 'Gauche' },
        { x: stepSize, y: 0, name: 'Droite' }
    ];

    // Filter valid directions (not obstacles and within bounds)
    const validDirections = directions.filter(direction => {
        const newX = agentX + direction.x;
        const newY = agentY + direction.y;
        return newX >= 0 && newX < width && newY >= 0 && newY < height &&
               !discoveredObstacles.some(obstacle => obstacle.x === newX && obstacle.y === newY);
    });

    if (modeSurvival) {
        // Get current position value
        const currentValue = stateValues[agentX / stepSize][agentY / stepSize];

        // Sort valid directions by their state value and visit count
        const sortedDirections = validDirections.map(direction => {
            const newX = agentX + direction.x;
            const newY = agentY + direction.y;
            const posKey = `${newX},${newY}`;
            const value = stateValues[newX / stepSize][newY / stepSize];
            const visitCount = visitedPositions.get(posKey) || 0;
            return { ...direction, value, visitCount };
        }).sort((a, b) => {
            // Prioritize less visited positions
            if (a.visitCount !== b.visitCount) {
                return a.visitCount - b.visitCount;
            }
            // Then prioritize higher values
            return b.value - a.value;
        });

        // Choose the best direction based on the sorted list
        for (const direction of sortedDirections) {
            // If we've visited this position less than twice or it has a lower value, choose it
            if (direction.visitCount < 2 || direction.value < currentValue) {
                return direction;
            }
        }

        // If all directions have been visited twice or more and have higher values,
        // choose the least visited one
        return sortedDirections[0];
    } else {
        // Normal exploration mode (unchanged)
        let bestValue = -Infinity;
        let bestDirection = null;

        validDirections.forEach(direction => {
            const newX = agentX + direction.x;
            const newY = agentY + direction.y;
            const value = stateValues[newX / stepSize][newY / stepSize];
            if (value > bestValue) {
                bestValue = value;
                bestDirection = direction;
            }
        });

        return bestDirection;
    }
}

// Update the updateVisitedPositions function to decay visit counts over time
function updateVisitedPositions(x, y) {
    const posKey = `${x},${y}`;
    const visitCount = visitedPositions.get(posKey) || 0;
    visitedPositions.set(posKey, visitCount + 1);

    // Decay visit counts for all positions
    for (const [key, count] of visitedPositions.entries()) {
        if (key !== posKey) {
            visitedPositions.set(key, Math.max(0, count - 0.1));
        }
    }

    lastPosition = posKey;
}

    function moveAgent() {
        if (agentHealth <= 0) {
            console.log("L'agent est mort...");
            clearInterval(moveInterval);
            return;
        }

        agentHealth -= 1;
        healthDisplay.textContent = agentHealth;

        clearAgent(agentX, agentY);

        discoverSurroundings();
        propagateValues();

        // Mode survie si les points de vie sont critiques
        if (agentHealth <= criticalHealthThreshold) {
            modeSurvival = true;
            directionDisplay.textContent = "Survie";
        } else {
            // Revenir en mode exploration si la santé n'est plus critique
            modeSurvival = false;
            directionDisplay.textContent = "Exploration";
        }

        let direction;

        if (modeSurvival) {
            // En mode survie, se diriger vers la récompense la plus proche
            direction = findBestDirection();
        } else {
            // En mode exploration, se déplacer aléatoirement ou vers des zones inexplorées
            direction = findExplorationDirection();
        }

if (direction) {
	agentX += direction.x;
	agentY += direction.y;
	directionDisplay.textContent = direction.name;
	updateVisitedPositions(agentX, agentY);
}

        if (isReward(agentX, agentY)) {
            agentHealth = maxHealth;
            healthDisplay.textContent = agentHealth;
            console.log("Récompense collectée! Points de vie restaurés.");
            // Forcer le retour en mode exploration après avoir collecté une récompense
            modeSurvival = false;
            directionDisplay.textContent = "Exploration";
        }

        // Afficher la valeur de l'état choisi
        const stateValue = stateValues[agentX / stepSize][agentY / stepSize];
        stateValueDisplay.textContent = stateValue.toFixed(2);

        drawAgent(agentX, agentY);
    }

    function findExplorationDirection() {
        const directions = [
            { x: 0, y: -stepSize, name: 'Haut' },
            { x: 0, y: stepSize, name: 'Bas' },
            { x: -stepSize, y: 0, name: 'Gauche' },
            { x: stepSize, y: 0, name: 'Droite' }
        ];

        const unexploredDirections = directions.filter(direction => {
            const newX = agentX + direction.x;
            const newY = agentY + direction.y;

            return (newX >= 0 && newX < width && newY >= 0 && newY < height &&
                !discoveredObstacles.some(obstacle => obstacle.x === newX && obstacle.y === newY) &&
                !discoveredRewards.some(reward => reward.x === newX && reward.y === newY));
        });

        if (unexploredDirections.length > 0) {
            return unexploredDirections[Math.floor(Math.random() * unexploredDirections.length)];
        } else {
            // Si toutes les directions sont explorées, choisir celle avec la plus grande valeur d'état
            return findBestDirection();
        }
    }

  // Ajout d'un élément pour l'infobulle
    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.padding = '5px';
    tooltip.style.background = 'rgba(0, 0, 0, 0.7)';
    tooltip.style.color = 'white';
    tooltip.style.borderRadius = '3px';
    tooltip.style.fontSize = '12px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    // Fonction pour obtenir la position de la souris relative au canvas
    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }

    // Gestionnaire d'événement pour le survol de la souris
    canvas.addEventListener('mousemove', (event) => {
        const mousePos = getMousePos(canvas, event);
        const gridX = Math.floor(mousePos.x / stepSize);
        const gridY = Math.floor(mousePos.y / stepSize);

        if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
            const stateValue = stateValues[gridX][gridY];
            let displayValue;
            if (stateValue === Infinity) {
                displayValue = "∞ (Récompense)";
            } else {
                displayValue = stateValue.toFixed(2);
            }
            tooltip.textContent = `Valeur d'état: ${displayValue}`;
            tooltip.style.left = `${event.pageX + 10}px`;
            tooltip.style.top = `${event.pageY + 10}px`;
            tooltip.style.display = 'block';
        } else {
            tooltip.style.display = 'none';
        }
    });

    // Masquer l'infobulle lorsque la souris quitte le canvas
    canvas.addEventListener('mouseout', () => {
        tooltip.style.display = 'none';
    });

    function drawGrid() {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        for (let x = 0; x <= width; x += stepSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += stepSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    function redrawAll() {
        ctx.clearRect(0, 0, width, height);
        drawGrid();
        discoveredObstacles.forEach(obstacle => drawObstacle(obstacle.x, obstacle.y));
        discoveredRewards.forEach(reward => drawReward(reward.x, reward.y));
        drawAgent(agentX, agentY);
    }

    generateObstaclesAndRewards();
    drawGrid();
    drawAgent(agentX, agentY);

    const moveInterval = setInterval(() => {
        moveAgent();
        redrawAll();
    }, 100);
});