class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('score');
        this.highScoreElement = document.getElementById('high-score');
        this.gameOverElement = document.getElementById('gameOver');
        this.finalScoreElement = document.getElementById('finalScore');
        
        // Taille de la grille
        this.gridSize = 20;
        this.tileCount = this.canvas.width / this.gridSize;
        
        // État du jeu
        this.gameRunning = false;
        this.gamePaused = false;
        this.gameLoopTimeout = null;
        
        // Serpent
        this.snake = [
            {x: 10, y: 10}
        ];
        this.dx = 0;
        this.dy = 0;
        
        // Nourriture
        this.food = this.generateFood();
        
        // Score
        this.score = 0;
        this.highScore = localStorage.getItem('snakeHighScore') || 0;
        this.highScoreElement.textContent = this.highScore;
        
        // Vitesse du jeu
        this.gameSpeed = 250;
        
        this.initializeEventListeners();
        this.drawGame();
    }
    
    initializeEventListeners() {
        // Contrôles clavier
        document.addEventListener('keydown', (e) => {
            // Empêcher le comportement par défaut pour les touches de jeu
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }
            
            if (!this.gameRunning || this.gamePaused) {
                // Permettre la pause même quand le jeu n'est pas en cours
                if (e.key === ' ') {
                    this.togglePause();
                }
                return;
            }
            
            switch(e.key) {
                case 'ArrowUp':
                    if (this.dy !== 1) {
                        this.dx = 0;
                        this.dy = -1;
                    }
                    break;
                case 'ArrowDown':
                    if (this.dy !== -1) {
                        this.dx = 0;
                        this.dy = 1;
                    }
                    break;
                case 'ArrowLeft':
                    if (this.dx !== 1) {
                        this.dx = -1;
                        this.dy = 0;
                    }
                    break;
                case 'ArrowRight':
                    if (this.dx !== -1) {
                        this.dx = 1;
                        this.dy = 0;
                    }
                    break;
                case ' ':
                    this.togglePause();
                    break;
            }
        });
        
        // Boutons de contrôle directionnel
        document.getElementById('upBtn').addEventListener('click', () => {
            if (!this.gameRunning || this.gamePaused) return;
            if (this.dy !== 1) {
                this.dx = 0;
                this.dy = -1;
            }
        });
        
        document.getElementById('downBtn').addEventListener('click', () => {
            if (!this.gameRunning || this.gamePaused) return;
            if (this.dy !== -1) {
                this.dx = 0;
                this.dy = 1;
            }
        });
        
        document.getElementById('leftBtn').addEventListener('click', () => {
            if (!this.gameRunning || this.gamePaused) return;
            if (this.dx !== 1) {
                this.dx = -1;
                this.dy = 0;
            }
        });
        
        document.getElementById('rightBtn').addEventListener('click', () => {
            if (!this.gameRunning || this.gamePaused) return;
            if (this.dx !== -1) {
                this.dx = 1;
                this.dy = 0;
            }
        });
        
        // Boutons de jeu
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.togglePause();
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetGame();
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.resetGame();
            this.startGame();
        });
    }
    
    generateFood() {
        let food;
        do {
            food = {
                x: Math.floor(Math.random() * this.tileCount),
                y: Math.floor(Math.random() * this.tileCount)
            };
        } while (this.snake.some(segment => segment.x === food.x && segment.y === food.y));
        
        return food;
    }
    
    moveSnake() {
        const head = {x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy};
        
        // Vérifier les collisions avec les murs
        if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
            this.gameOver();
            return;
        }
        
        // Vérifier les collisions avec le corps du serpent
        if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            this.gameOver();
            return;
        }
        
        this.snake.unshift(head);
        
        // Vérifier si le serpent a mangé la nourriture
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this.scoreElement.textContent = this.score;
            this.food = this.generateFood();
            
            // Augmenter la vitesse progressivement
            if (this.gameSpeed > 80) {
                this.gameSpeed -= 2;
            }
        } else {
            this.snake.pop();
        }
    }
    
    drawGame() {
        // Effacer le canvas
        this.ctx.fillStyle = '#2d3748';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Dessiner la grille (optionnel)
        this.ctx.strokeStyle = '#4a5568';
        this.ctx.lineWidth = 0.5;
        for (let i = 0; i <= this.tileCount; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.gridSize, 0);
            this.ctx.lineTo(i * this.gridSize, this.canvas.height);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.gridSize);
            this.ctx.lineTo(this.canvas.width, i * this.gridSize);
            this.ctx.stroke();
        }
        
        // Dessiner le serpent
        this.snake.forEach((segment, index) => {
            if (index === 0) {
                // Tête du serpent
                this.ctx.fillStyle = '#48bb78';
                this.ctx.fillRect(segment.x * this.gridSize + 1, segment.y * this.gridSize + 1, 
                                this.gridSize - 2, this.gridSize - 2);
                
                // Yeux du serpent
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(segment.x * this.gridSize + 4, segment.y * this.gridSize + 4, 3, 3);
                this.ctx.fillRect(segment.x * this.gridSize + 13, segment.y * this.gridSize + 4, 3, 3);
                
                this.ctx.fillStyle = '#000000';
                this.ctx.fillRect(segment.x * this.gridSize + 5, segment.y * this.gridSize + 5, 1, 1);
                this.ctx.fillRect(segment.x * this.gridSize + 14, segment.y * this.gridSize + 5, 1, 1);
            } else {
                // Corps du serpent
                this.ctx.fillStyle = '#38a169';
                this.ctx.fillRect(segment.x * this.gridSize + 1, segment.y * this.gridSize + 1, 
                                this.gridSize - 2, this.gridSize - 2);
            }
        });
        
        // Dessiner la nourriture
        this.ctx.fillStyle = '#e53e3e';
        this.ctx.beginPath();
        this.ctx.arc(
            this.food.x * this.gridSize + this.gridSize / 2,
            this.food.y * this.gridSize + this.gridSize / 2,
            this.gridSize / 2 - 2,
            0,
            2 * Math.PI
        );
        this.ctx.fill();
        
        // Ajouter un reflet à la nourriture
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(
            this.food.x * this.gridSize + this.gridSize / 2 - 2,
            this.food.y * this.gridSize + this.gridSize / 2 - 2,
            2,
            0,
            2 * Math.PI
        );
        this.ctx.fill();
    }
    
    gameLoop() {
        if (!this.gameRunning || this.gamePaused) return;
        
        this.moveSnake();
        this.drawGame();
        
        this.gameLoopTimeout = setTimeout(() => {
            this.gameLoop();
        }, this.gameSpeed);
    }
    
    startGame() {
        if (this.gameRunning && !this.gamePaused) return;
        
        if (!this.gameRunning) {
            this.gameRunning = true;
            this.dx = 1;
            this.dy = 0;
        }
        
        this.gamePaused = false;
        this.gameOverElement.style.display = 'none';
        this.gameLoop();
    }
    
    togglePause() {
        if (!this.gameRunning) return;
        
        this.gamePaused = !this.gamePaused;
        
        if (!this.gamePaused) {
            this.gameLoop();
        }
        
        document.getElementById('pauseBtn').textContent = this.gamePaused ? 'Reprendre' : 'Pause';
    }
    
    resetGame() {
        this.gameRunning = false;
        this.gamePaused = false;
        
        // Arrêter la boucle de jeu en cours
        if (this.gameLoopTimeout) {
            clearTimeout(this.gameLoopTimeout);
            this.gameLoopTimeout = null;
        }
        
        this.snake = [{x: 10, y: 10}];
        this.dx = 0;
        this.dy = 0;
        this.score = 0;
        this.gameSpeed = 250;
        this.food = this.generateFood();
        
        this.scoreElement.textContent = this.score;
        this.gameOverElement.style.display = 'none';
        document.getElementById('pauseBtn').textContent = 'Pause';
        
        this.drawGame();
    }
    
    gameOver() {
        this.gameRunning = false;
        this.gamePaused = false;
        
        // Arrêter la boucle de jeu
        if (this.gameLoopTimeout) {
            clearTimeout(this.gameLoopTimeout);
            this.gameLoopTimeout = null;
        }
        
        // Mettre à jour le meilleur score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.highScoreElement.textContent = this.highScore;
            localStorage.setItem('snakeHighScore', this.highScore);
        }
        
        this.finalScoreElement.textContent = this.score;
        this.gameOverElement.style.display = 'block';
        
        document.getElementById('pauseBtn').textContent = 'Pause';
    }
}

// Initialiser le jeu quand la page est chargée
document.addEventListener('DOMContentLoaded', () => {
    new SnakeGame();
});
