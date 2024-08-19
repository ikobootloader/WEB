/**

1. Dans la fonction `propagateValues()` :
   - Nous définissons la valeur d'état de la position exacte de chaque récompense comme infinie :
     ```javascript
     stateValues[reward.x / stepSize][reward.y / stepSize] = Infinity;
     ```
   - Nous excluons la position exacte de la récompense du calcul de propagation normal :
     ```javascript
     if (i * stepSize !== reward.x || j * stepSize !== reward.y) {
         // ... (calcul normal de la valeur d'état)
     }
     ```

2. Dans le gestionnaire d'événement `mousemove` pour l'infobulle :
   - Nous ajoutons une vérification pour afficher "∞ (Récompense)" si la valeur d'état est infinie :
     ```javascript
     let displayValue;
     if (stateValue === Infinity) {
         displayValue = "∞ (Récompense)";
     } else {
         displayValue = stateValue.toFixed(2);
     }
     ```

Ces modifications garantissent que :
1. Les positions exactes des récompenses ont une valeur d'état infinie.
2. L'infobulle affiche "∞ (Récompense)" lorsque l'utilisateur survole une position de récompense.
3. Le calcul de propagation des valeurs d'état pour les autres cellules reste inchangé, utilisant toujours la valeur 1 pour les récompenses.

Cette approche permet à l'agent de toujours considérer les positions de récompenses comme infiniment désirables, tout en maintenant un calcul réaliste des valeurs d'état pour les cellules environnantes.

La valeur d'état est calculée dans la fonction `propagateValues()`. Voici une explication détaillée du processus :

1. Initialisation :
   Tout d'abord, toutes les valeurs d'état sont initialisées à zéro :

   ```javascript
   stateValues.forEach(row => row.fill(0));
   ```

2. Propagation des valeurs des récompenses :
   Pour chaque récompense découverte, le code calcule son influence sur chaque cellule de la grille :

   ```javascript
   discoveredRewards.forEach(reward => {
       for (let i = 0; i < gridWidth; i++) {
           for (let j = 0; j < gridHeight; j++) {
               const distance = Math.abs(i * stepSize - reward.x) + Math.abs(j * stepSize - reward.y);
               stateValues[i][j] += Math.pow(gamma, distance / stepSize) * reward.value;
           }
       }
   });
   ```

   - Pour chaque cellule, on calcule la distance de Manhattan à la récompense.
   - La valeur ajoutée à la cellule est calculée comme : `gamma^(distance/stepSize) * reward.value`
   - `gamma` est un facteur de décroissance (0.9 dans ce code) qui fait diminuer l'influence de la récompense avec la distance.
   - Plus une cellule est proche de la récompense, plus sa valeur d'état augmente.

3. Propagation des valeurs des obstacles :
   De manière similaire, pour chaque obstacle découvert, le code calcule son influence négative :

   ```javascript
   discoveredObstacles.forEach(obstacle => {
       for (let i = 0; i < gridWidth; i++) {
           for (let j = 0; j < gridHeight; j++) {
               const distance = Math.abs(i * stepSize - obstacle.x) + Math.abs(j * stepSize - obstacle.y);
               stateValues[i][j] += Math.pow(gamma, distance / stepSize) * -1;
           }
       }
   });
   ```

   - Le processus est similaire à celui des récompenses, mais avec une valeur négative (-1).
   - Plus une cellule est proche d'un obstacle, plus sa valeur d'état diminue.

En résumé :
- Chaque cellule de la grille a une valeur d'état qui représente sa désirabilité pour l'agent.
- Les récompenses augmentent la valeur des cellules autour d'elles, avec une influence qui décroît avec la distance.
- Les obstacles diminuent la valeur des cellules autour d'eux, également avec une influence qui décroît avec la distance.
- Le facteur gamma (0.9) contrôle la rapidité de cette décroissance : plus gamma est proche de 1, plus l'influence s'étend loin.
- La valeur finale d'une cellule est la somme des influences de toutes les récompenses et obstacles découverts.

Cette méthode de calcul crée un "paysage" de valeurs où :
- Les zones proches des récompenses ont des valeurs élevées, attirant l'agent.
- Les zones proches des obstacles ont des valeurs basses, repoussant l'agent.
- Les zones entre récompenses et obstacles ont des valeurs intermédiaires, créant des "chemins" que l'agent peut suivre.

C'est ce paysage de valeurs qui guide les décisions de l'agent, l'aidant à naviguer vers les récompenses tout en évitant les obstacles.
**/

//Bug sur la valeur des états récompense vs obstacle : les obstacles camouflent les récompenses !
//=> Faut-il conserver l'idée d'une récompense négative ??
//Il faut que l'agent ne s'éloigne pas trop de son point de recharge le plus proche lorsqu'il explore la map

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

    const numObstacles = 300;
    const numRewards = 100;
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

    function drawObstacle(x, y) {
        ctx.fillStyle = 'red';
        ctx.fillRect(x, y, stepSize, stepSize);
    }

    function drawReward(x, y) {
        ctx.fillStyle = 'green';
        ctx.fillRect(x, y, stepSize, stepSize);
    }

    function generateObstaclesAndRewards() {
        for (let i = 0; i < numObstacles; i++) {
            let x = Math.floor(Math.random() * gridWidth) * stepSize;
            let y = Math.floor(Math.random() * gridHeight) * stepSize;
            obstacles.push({ x, y });
        }

        for (let i = 0; i < numRewards; i++) {
            let x = Math.floor(Math.random() * gridWidth) * stepSize;
            let y = Math.floor(Math.random() * gridHeight) * stepSize;
            rewards.push({ x, y, value: 1 });
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
            // Définir la valeur d'état de la position exacte de la récompense comme infinie
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
            for (let i = 0; i < gridWidth; i++) {
                for (let j = 0; j < gridHeight; j++) {
                    const distance = Math.abs(i * stepSize - obstacle.x) + Math.abs(j * stepSize - obstacle.y);
                    stateValues[i][j] += Math.pow(gamma, distance / stepSize) * -1;
                }
            }
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

    function findBestDirection() {
        const directions = [
            { x: 0, y: -stepSize, name: 'Haut' },
            { x: 0, y: stepSize, name: 'Bas' },
            { x: -stepSize, y: 0, name: 'Gauche' },
            { x: stepSize, y: 0, name: 'Droite' }
        ];

        let bestValue = -Infinity;
        let bestDirection = null;

        directions.forEach(direction => {
            const newX = agentX + direction.x;
            const newY = agentY + direction.y;

            if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
                const value = stateValues[newX / stepSize][newY / stepSize];
                if (value > bestValue) {
                    bestValue = value;
                    bestDirection = direction;
                }
            }
        });

        return bestDirection;
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

    // ... (le reste du code existant)

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