/**
 * AGENT AUTONOME SANS ETAT TERMINAL - APPROCHE HEURISTIQUE - 2024
 **/
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('territory');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const config = {
        stepSize: 5,
        numObstacles: 1000,
        numRewards: 30,
        gamma: 0.9,
        maxHealth: 500,
        criticalHealthThreshold: 0.2,
    };

    const state = {
        agentX: Math.floor((width / config.stepSize) / 2) * config.stepSize,
        agentY: Math.floor((height / config.stepSize) / 2) * config.stepSize,
        agentHealth: config.maxHealth,
        modeSurvival: false,
        agentColor: 'blue',
        obstacles: [],
        rewards: [],
        discoveredObstacles: [],
        discoveredRewards: [],
        stateValues: Array(width / config.stepSize).fill().map(() => Array(height / config.stepSize).fill(0)),
        visitedPositions: new Map(),
        lastPosition: null,
    };

    const elements = {
        healthDisplay: document.getElementById('health'),
        directionDisplay: document.getElementById('direction'),
        stateValueDisplay: document.getElementById('stateValue'),
        tooltip: createTooltip(),
    };

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
        ctx.fillStyle = 'red';
        ctx.fillRect(x, y, config.stepSize, config.stepSize);
    }

    function drawReward(x, y) {
        ctx.fillStyle = 'green';
        ctx.fillRect(x, y, config.stepSize, config.stepSize);
    }

    function drawAgent(x, y) {
        ctx.fillStyle = state.agentColor;
        ctx.fillRect(x, y, config.stepSize, config.stepSize);
    }

    function clearAgent(x, y) {
        ctx.clearRect(x, y, config.stepSize, config.stepSize);
    }

    function generateObstaclesAndRewards() {
        const occupiedCells = new Set();

        for (let i = 0; i < config.numObstacles; i++) {
            let x, y;
            do {
                x = Math.floor(Math.random() * (width / config.stepSize)) * config.stepSize;
                y = Math.floor(Math.random() * (height / config.stepSize)) * config.stepSize;
            } while (occupiedCells.has(`${x},${y}`));

            state.obstacles.push({ x, y });
            occupiedCells.add(`${x},${y}`);
        }

        for (let i = 0; i < config.numRewards; i++) {
            let x, y;
            do {
                x = Math.floor(Math.random() * (width / config.stepSize)) * config.stepSize;
                y = Math.floor(Math.random() * (height / config.stepSize)) * config.stepSize;
            } while (occupiedCells.has(`${x},${y}`));

            state.rewards.push({ x, y, value: 1 });
            occupiedCells.add(`${x},${y}`);
        }
    }

    function isObstacle(x, y) {
        return state.obstacles.some(obstacle => obstacle.x === x && obstacle.y === y);
    }

    function isReward(x, y) {
        return state.rewards.some(reward => reward.x === x && reward.y === y);
    }

    function propagateValues() {
        state.stateValues.forEach(row => row.fill(0));

        state.discoveredRewards.forEach(reward => {
            state.stateValues[reward.x / config.stepSize][reward.y / config.stepSize] = Infinity;

            for (let i = 0; i < width / config.stepSize; i++) {
                for (let j = 0; j < height / config.stepSize; j++) {
                    if (i * config.stepSize !== reward.x || j * config.stepSize !== reward.y) {
                        const distance = Math.abs(i * config.stepSize - reward.x) + Math.abs(j * config.stepSize - reward.y);
                        const value = Math.pow(config.gamma, distance / config.stepSize) * reward.value;
                        state.stateValues[i][j] = Math.max(state.stateValues[i][j], value);
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
            { x: state.agentX, y: state.agentY },
            { x: state.agentX + config.stepSize, y: state.agentY },
            { x: state.agentX - config.stepSize, y: state.agentY },
            { x: state.agentX, y: state.agentY + config.stepSize },
            { x: state.agentX, y: state.agentY - config.stepSize }
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

    function findBestDirection() {
        const directions = [
            { x: 0, y: -config.stepSize, name: 'Haut' },
            { x: 0, y: config.stepSize, name: 'Bas' },
            { x: -config.stepSize, y: 0, name: 'Gauche' },
            { x: config.stepSize, y: 0, name: 'Droite' }
        ];

        const validDirections = directions.filter(direction => {
            const newX = state.agentX + direction.x;
            const newY = state.agentY + direction.y;
            return newX >= 0 && newX < width && newY >= 0 && newY < height &&
                   !state.discoveredObstacles.some(obstacle => obstacle.x === newX && obstacle.y === newY);
        });

        if (state.modeSurvival) {
            const currentValue = state.stateValues[state.agentX / config.stepSize][state.agentY / config.stepSize];

            const sortedDirections = validDirections.map(direction => {
                const newX = state.agentX + direction.x;
                const newY = state.agentY + direction.y;
                const posKey = `${newX},${newY}`;
                const value = state.stateValues[newX / config.stepSize][newY / config.stepSize];
                const visitCount = state.visitedPositions.get(posKey) || 0;
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
        } else {
            let bestValue = -Infinity;
            let bestDirection = null;

            validDirections.forEach(direction => {
                const newX = state.agentX + direction.x;
                const newY = state.agentY + direction.y;
                const value = state.stateValues[newX / config.stepSize][newY / config.stepSize];
                if (value > bestValue) {
                    bestValue = value;
                    bestDirection = direction;
                }
            });

            return bestDirection;
        }
    }

    function findExplorationDirection() {
        const directions = [
            { x: 0, y: -config.stepSize, name: 'Haut' },
            { x: 0, y: config.stepSize, name: 'Bas' },
            { x: -config.stepSize, y: 0, name: 'Gauche' },
            { x: config.stepSize, y: 0, name: 'Droite' }
        ];

        const unexploredDirections = directions.filter(direction => {
            const newX = state.agentX + direction.x;
            const newY = state.agentY + direction.y;

            return (newX >= 0 && newX < width && newY >= 0 && newY < height &&
                !state.discoveredObstacles.some(obstacle => obstacle.x === newX && obstacle.y === newY) &&
                !state.discoveredRewards.some(reward => reward.x === newX && reward.y === newY));
        });

        if (unexploredDirections.length > 0) {
            return unexploredDirections[Math.floor(Math.random() * unexploredDirections.length)];
        } else {
            return findBestDirection();
        }
    }

    function moveAgent() {
        if (state.agentHealth <= 0) {
            console.log("L'agent est mort...");
            clearInterval(moveInterval);
            return;
        }

        state.agentHealth -= 1;
        elements.healthDisplay.textContent = state.agentHealth;

        clearAgent(state.agentX, state.agentY);

        discoverSurroundings();
        propagateValues();

        if (state.agentHealth <= config.criticalHealthThreshold * config.maxHealth) {
            state.modeSurvival = true;
            elements.directionDisplay.textContent = "Survie";
            state.agentColor = 'black'; 
        } else {
            state.modeSurvival = false;
            elements.directionDisplay.textContent = "Exploration";
            state.agentColor = 'blue';
        }

        let direction;

        if (state.modeSurvival) {
            direction = findBestDirection();
        } else {
            direction = findExplorationDirection();
        }

        if (direction) {
            state.agentX += direction.x;
            state.agentY += direction.y;
            elements.directionDisplay.textContent = direction.name;
            updateVisitedPositions(state.agentX, state.agentY);
        }

        if (isReward(state.agentX, state.agentY)) {
            state.agentHealth = config.maxHealth;
            elements.healthDisplay.textContent = state.agentHealth;
            console.log("Récompense collectée! Points de vie restaurés.");
            state.modeSurvival = false;
            elements.directionDisplay.textContent = "Exploration";
        }

        const stateValue = state.stateValues[state.agentX / config.stepSize][state.agentY / config.stepSize];
        elements.stateValueDisplay.textContent = stateValue.toFixed(2);

        drawAgent(state.agentX, state.agentY);
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
        drawAgent(state.agentX, state.agentY);
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
        drawAgent(state.agentX, state.agentY);

        const moveInterval = setInterval(() => {
            moveAgent();
            redrawAll();
        }, 100);
    });