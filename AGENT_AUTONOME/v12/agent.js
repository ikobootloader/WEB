/**
 * AGENT AUTONOME SANS ETAT TERMINAL - APPROCHE HEURISTIQUE - 2024
 * Ce programme simule un agent autonome explorant une grille contenant des obstacles et des récompenses.
 * L'agent utilise une approche heuristique basée sur la propagation de valeurs pour naviguer efficacement.
 */
//TODO: l'exploration doit tenir compte de la quantité d'énergie restante et du point de recharge le plus proche! (ne doit pas parcourir plus de chemin qu'il ne peut en faire pour revenir au point de recharge le plus proche)
//Si le territoire devient trop complexe (beaucoup d'obstacles) l'agent a des difficultés à se diriger vers le point de recharge le plus proche. A une certaine distance et lorsqu'il y a beaucoup d'obstacles, il n'y a plus vraiment de valeurs d'état qui se démarquent et l'agent est comme perdu. C'est une limitation de cette approche qui nécessiterait pour l'agent de mémoriser davantage d'informations ou de construire la trajectoire au complet (ou à minima partielle, par segments) pour s'en sortir lorsqu'il est en mode survie.
//S'il y a des obstacles qui entoure l'agent et seulement quelques voies de sortie, l'agent boucle autour des obstacles sans pouvoir sortir.
const COLORS = {
    AGENT_NORMAL: 'blue',
    AGENT_SURVIVAL: 'black', 
    OBSTACLE: 'red',
    REWARD: 'green',
};

class Agent {
    constructor(x, y, health, color, config, width, height, state, elements, isObstacle, isReward, drawAgent, clearAgent, updateVisitedPositions, discoverSurroundings, propagateValues, stopSimulation) {
        this.x = x;
        this.y = y;
        this.health = health;
        this.color = color;
        this.config = config;
        this.width = width;
        this.height = height;
        this.state = state;
        this.elements = elements;
        this.isObstacle = isObstacle;
        this.isReward = isReward;
        this.drawAgent = drawAgent;
        this.clearAgent = clearAgent;
        this.updateVisitedPositions = updateVisitedPositions;
        this.discoverSurroundings = discoverSurroundings;
        this.propagateValues = propagateValues;
        this.stopSimulation = stopSimulation;
    }

    move() {
        if (this.health <= 0) {
            console.log("L'agent est mort...");
            this.stopSimulation();
            return;
        }

        this.health -= 1;
        this.elements.healthDisplay.textContent = this.health;

        this.clearAgent(this.x, this.y);

		this.discoverSurroundings();
		this.propagateValues();

        if (this.health <= this.config.criticalHealthThreshold * this.config.maxHealth) {
            this.state.modeSurvival = true;
            this.elements.directionDisplay.textContent = "Survie";
            this.color = COLORS.AGENT_SURVIVAL;
        } else {
            this.state.modeSurvival = false;
            this.elements.directionDisplay.textContent = "Exploration";
            this.color = COLORS.AGENT_NORMAL;
        }

        let direction;

        if (this.state.modeSurvival) {
            direction = this.findBestDirection();
        } else {
            direction = this.findExplorationDirection();
        }

        if (direction) {
            this.x += direction.x;
            this.y += direction.y;
            this.elements.directionDisplay.textContent = direction.name;
            this.updateVisitedPositions(this.x, this.y);
        }

        if (this.isReward(this.x, this.y)) {
            this.health = this.config.maxHealth;
            this.elements.healthDisplay.textContent = this.health;
            console.log("Récompense collectée! Points de vie restaurés.");
            this.state.modeSurvival = false;
            this.elements.directionDisplay.textContent = "Exploration";
        }

        const stateValue = this.state.stateValues[this.x / this.config.stepSize][this.y / this.config.stepSize];
        this.elements.stateValueDisplay.textContent = stateValue.toFixed(2);

        this.drawAgent(this.x, this.y);
    }

    findBestDirection() {
        const directions = [
            { x: 0, y: -this.config.stepSize, name: 'Haut' },
            { x: 0, y: this.config.stepSize, name: 'Bas' },
            { x: -this.config.stepSize, y: 0, name: 'Gauche' },
            { x: this.config.stepSize, y: 0, name: 'Droite' }
        ];

        const validDirections = directions.filter(direction => {
            const newX = this.x + direction.x;
            const newY = this.y + direction.y;
            return newX >= 0 && newX < this.width && newY >= 0 && newY < this.height &&
                   !this.state.discoveredObstacles.some(obstacle => obstacle.x === newX && obstacle.y === newY);
        });

        const currentValue = this.state.stateValues[this.x / this.config.stepSize][this.y / this.config.stepSize];

        const sortedDirections = validDirections.map(direction => {
            const newX = this.x + direction.x;
            const newY = this.y + direction.y;
            const posKey = `${newX},${newY}`;
            const value = this.state.stateValues[newX / this.config.stepSize][newY / this.config.stepSize];
            const visitCount = this.state.visitedPositions.get(posKey) || 0;
            return { ...direction, value, visitCount };
        }).sort((a, b) => {
            if (a.visitCount !== b.visitCount) {
                return a.visitCount - b.visitCount;
            }
            return b.value - a.value;
        });

        for (const direction of sortedDirections) {
            if (direction.visitCount < 2 || direction.value < currentValue) {
                return direction;
            }
        }

        return sortedDirections[0];
    }

    findExplorationDirection() {
        const directions = [
            { x: 0, y: -this.config.stepSize, name: 'Haut' },
            { x: 0, y: this.config.stepSize, name: 'Bas' },
            { x: -this.config.stepSize, y: 0, name: 'Gauche' },
            { x: this.config.stepSize, y: 0, name: 'Droite' }
        ];

        const unexploredDirections = directions.filter(direction => {
            const newX = this.x + direction.x;
            const newY = this.y + direction.y;

            return (newX >= 0 && newX < this.width && newY >= 0 && newY < this.height &&
                !this.state.discoveredObstacles.some(obstacle => obstacle.x === newX && obstacle.y === newY) &&
                !this.state.discoveredRewards.some(reward => reward.x === newX && reward.y === newY));
        });

        if (unexploredDirections.length > 0) {
            return unexploredDirections[Math.floor(Math.random() * unexploredDirections.length)];
        } else {
            return this.findBestDirection();
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('territory');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const config = {
        stepSize: 5,
        numObstacles: 2500,
        numRewards: 30,
        gamma: 0.9,
        maxHealth: 500,
        criticalHealthThreshold: 0.3,
    };

    const state = {
        modeSurvival: false,
        obstacles: [],
        rewards: [],
        discoveredObstacles: [],
        discoveredRewards: [],
        stateValues: Array(width / config.stepSize).fill().map(() => Array(height / config.stepSize).fill(0)),
        visitedPositions: new Map(),
        lastPosition: null,
    };

    function isObstacle(x, y) {
        return state.obstacles.some(obstacle => obstacle.x === x && obstacle.y === y);
    }

    function isReward(x, y) {
        return state.rewards.some(reward => reward.x === x && reward.y === y);
    }

    function drawAgent(x, y) {
        ctx.fillStyle = agent.color;
        ctx.fillRect(x, y, config.stepSize, config.stepSize);
    }

    function clearAgent(x, y) {
        ctx.clearRect(x, y, config.stepSize, config.stepSize);
    }

    function updateVisitedPositions(x, y) {
        const posKey = `${x},${y}`;
        const visitCount = state.visitedPositions.get(posKey) || 0;
        state.visitedPositions.set(posKey, visitCount + 1);

        // Decay visit counts for all positions
        for (const [key, count] of state.visitedPositions.entries()) {
            if (key !== posKey) {
                state.visitedPositions.set(key, Math.max(0, count - 0.1));
            }
        }

        state.lastPosition = posKey;
    }

    const elements = {
        healthDisplay: document.getElementById('health'),
        directionDisplay: document.getElementById('direction'),
        stateValueDisplay: document.getElementById('stateValue'),
        tooltip: createTooltip(),
    };
	
    let isRunning = true;
    let moveInterval;

    const playPauseBtn = document.getElementById('playPauseBtn');

    function toggleSimulation() {
        if (isRunning) {
            clearInterval(moveInterval);
            playPauseBtn.textContent = 'Play';
        } else {
            moveInterval = setInterval(() => {
                moveAgent();
                redrawAll();
            }, 100);
            playPauseBtn.textContent = 'Pause';
        }
        isRunning = !isRunning;
    }

    playPauseBtn.addEventListener('click', toggleSimulation);

    function stopSimulation() {
        clearInterval(moveInterval);
        isRunning = false;
        playPauseBtn.textContent = 'Play';
    }

    const agent = new Agent(
        Math.floor((width / config.stepSize) / 2) * config.stepSize, 
        Math.floor((height / config.stepSize) / 2) * config.stepSize,
        config.maxHealth,
        COLORS.AGENT_NORMAL,
        config,
        width,
        height,
        state,
        elements,
        isObstacle,
        isReward,
        drawAgent,
        clearAgent,
        updateVisitedPositions,
        discoverSurroundings,
        propagateValues,
        stopSimulation
    );

    function createTooltip() {
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
        return tooltip;
    }

    function drawObstacle(x, y) {
        ctx.fillStyle = COLORS.OBSTACLE;
        ctx.fillRect(x, y, config.stepSize, config.stepSize);
    }

    function drawReward(x, y) {
        ctx.fillStyle = COLORS.REWARD;
        ctx.fillRect(x, y, config.stepSize, config.stepSize);
    }

    /**
     * Génère aléatoirement des obstacles et des récompenses sur la grille.
     * S'assure qu'une cellule ne peut pas contenir à la fois un obstacle et une récompense.
     */
    function generateObstaclesAndRewards() {
        const occupiedCells = new Set();

        for (let i = 0; i < config.numObstacles; i++) {
            let cellX, cellY;
            do {
                cellX = Math.floor(Math.random() * (width / config.stepSize)) * config.stepSize;
                cellY = Math.floor(Math.random() * (height / config.stepSize)) * config.stepSize;
            } while (occupiedCells.has(`${cellX},${cellY}`));

            state.obstacles.push({ x: cellX, y: cellY });
            occupiedCells.add(`${cellX},${cellY}`);
        }

        for (let i = 0; i < config.numRewards; i++) {
            let cellX, cellY;
            do {
                cellX = Math.floor(Math.random() * (width / config.stepSize)) * config.stepSize;
                cellY = Math.floor(Math.random() * (height / config.stepSize)) * config.stepSize;
            } while (occupiedCells.has(`${cellX},${cellY}`));

            state.rewards.push({ x: cellX, y: cellY, value: 1 });
            occupiedCells.add(`${cellX},${cellY}`);
        }
    }

    /**
     * Propage les valeurs d'état à partir des récompenses découvertes.
     * Chaque cellule reçoit la valeur de la récompense la plus influente.
     * Les obstacles reçoivent une valeur négative fixe.
     */
    function propagateValues() {
        state.stateValues.forEach(row => row.fill(0));

        state.discoveredRewards.forEach(reward => {
            state.stateValues[reward.x / config.stepSize][reward.y / config.stepSize] = Infinity;

            for (let col = 0; col < width / config.stepSize; col++) {
                for (let row = 0; row < height / config.stepSize; row++) {
                    if (col * config.stepSize !== reward.x || row * config.stepSize !== reward.y) {
                        const distance = Math.abs(col * config.stepSize - reward.x) + Math.abs(row * config.stepSize - reward.y);
                        const value = Math.pow(config.gamma, distance / config.stepSize) * reward.value;
                        state.stateValues[col][row] = Math.max(state.stateValues[col][row], value);
                    }
                }
            }
        });

        state.discoveredObstacles.forEach(obstacle => {
            state.stateValues[obstacle.x / config.stepSize][obstacle.y / config.stepSize] = -1;
        });
    }

    function discoverSurroundings() {
        const surroundingCells = [
            { x: agent.x, y: agent.y },
            { x: agent.x + config.stepSize, y: agent.y },
            { x: agent.x - config.stepSize, y: agent.y },
            { x: agent.x, y: agent.y + config.stepSize },
            { x: agent.x, y: agent.y - config.stepSize }
        ];

        surroundingCells.forEach(cell => {
            if (isReward(cell.x, cell.y) && !state.discoveredRewards.some(reward => reward.x === cell.x && reward.y === cell.y)) {
                const reward = state.rewards.find(reward => reward.x === cell.x && reward.y === cell.y);
                state.discoveredRewards.push(reward);
                drawReward(cell.x, cell.y);
            }

            if (isObstacle(cell.x, cell.y) && !state.discoveredObstacles.some(obstacle => obstacle.x === cell.x && obstacle.y === cell.y)) {
                const obstacle = state.obstacles.find(obstacle => obstacle.x === cell.x && obstacle.y === cell.y);
                state.discoveredObstacles.push(obstacle);
                drawObstacle(cell.x, cell.y);
            }
        });
    }
	
	function moveAgent() {
        agent.move();
    }

    function drawGrid() {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        for (let x = 0; x <= width; x += config.stepSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += config.stepSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    function redrawAll() {
        ctx.clearRect(0, 0, width, height);
        drawGrid();
        state.discoveredObstacles.forEach(obstacle => drawObstacle(obstacle.x, obstacle.y));
        state.discoveredRewards.forEach(reward => drawReward(reward.x, reward.y));
        drawAgent(agent.x, agent.y);
    }

    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }

    canvas.addEventListener('mousemove', (event) => {
        const mousePos = getMousePos(canvas, event);
        const gridX = Math.floor(mousePos.x / config.stepSize);
        const gridY = Math.floor(mousePos.y / config.stepSize);

        if (gridX >= 0 && gridX < width / config.stepSize && gridY >= 0 && gridY < height / config.stepSize) {
            const stateValue = state.stateValues[gridX][gridY];
            let displayValue;
            if (stateValue === Infinity) {
                displayValue = "∞ (Récompense)";
            } else {
                displayValue = stateValue.toFixed(2);
            }
            elements.tooltip.textContent = `Valeur d'état: ${displayValue}`;
            elements.tooltip.style.left = `${event.pageX + 10}px`;
            elements.tooltip.style.top = `${event.pageY + 10}px`;
            elements.tooltip.style.display = 'block';
        } else {
            elements.tooltip.style.display = 'none';
        }
    });

    canvas.addEventListener('mouseout', () => {
        elements.tooltip.style.display = 'none';
    });

    generateObstaclesAndRewards();
    drawGrid();
    drawAgent(agent.x, agent.y);

    moveInterval = setInterval(() => {
        moveAgent();
        redrawAll();
    }, 100);
});