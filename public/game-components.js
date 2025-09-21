class GameComponentRegistry {
    static components = new Map();

    static registerComponent(gameId, component) {
        this.components.set(gameId, component);
    }

    static getComponent(gameId) {
        return this.components.get(gameId);
    }

    static getAllComponents() {
        return Array.from(this.components.entries());
    }
}

class ReactionTimeComponent {
    static gameId = "reaction-time";

    constructor(gameContainer, socket) {
        this.container = gameContainer;
        this.socket = socket;
        this.elements = {};
        this.playerIndex = 0; // Will be set by initializeWithData
        this.reactionStartTime = 0;
        this.counterInterval = null;
        this.hasClicked = false;
    }

    render() {
        // Use existing HTML structure instead of creating new one
        const existingReactionGame = document.getElementById('reaction-game');
        if (existingReactionGame) {
            existingReactionGame.classList.remove('hidden');

            this.elements.zone = document.getElementById('reaction-zone');
            this.elements.light = document.getElementById('signal-light');
            this.elements.instruction = document.getElementById('reaction-instruction');
            this.elements.counter = document.getElementById('reaction-counter');

            if (this.elements.zone) {
                this.elements.zone.addEventListener('click', () => this.handleClick());
            }
        } else {
            // Fallback: create our own structure if static HTML not found
            this.container.innerHTML = `
                <div class="reaction-zone" id="reaction-zone">
                    <div class="signal-light red" id="signal-light"></div>
                    <p id="reaction-instruction">Wait for GREEN...</p>
                    <div id="reaction-counter" class="reaction-counter hidden">0ms</div>
                </div>
            `;

            this.elements.zone = this.container.querySelector('#reaction-zone');
            this.elements.light = this.container.querySelector('#signal-light');
            this.elements.instruction = this.container.querySelector('#reaction-instruction');
            this.elements.counter = this.container.querySelector('#reaction-counter');

            this.elements.zone.addEventListener('click', () => this.handleClick());
        }
    }

    handleClick() {
        if (this.elements.light.classList.contains('green') && !this.hasClicked) {
            this.hasClicked = true;
            this.socket.emit('game-action', { type: 'click' });
            this.elements.instruction.textContent = 'Clicked!';

            // Stop the counter and show final time
            this.stopCounter();
            const finalTime = Date.now() - this.reactionStartTime;
            this.elements.counter.textContent = `${finalTime}ms`;
            this.elements.counter.style.color = '#FFD700';
            this.elements.counter.style.borderColor = '#FFD700';
        }
    }

    onStartSignal() {
        this.elements.light.classList.remove('red');
        this.elements.light.classList.add('green');
        this.elements.instruction.textContent = 'CLICK NOW!';

        // Start the real-time counter
        this.startCounter();
    }

    startCounter() {
        this.reactionStartTime = Date.now();
        this.elements.counter.classList.remove('hidden');
        this.elements.counter.style.color = '#00FF88';
        this.elements.counter.style.borderColor = '#00FF88';

        this.counterInterval = setInterval(() => {
            if (!this.hasClicked) {
                const elapsed = Date.now() - this.reactionStartTime;
                this.elements.counter.textContent = `${elapsed}ms`;
            }
        }, 10); // Update every 10ms for smooth counter
    }

    stopCounter() {
        if (this.counterInterval) {
            clearInterval(this.counterInterval);
            this.counterInterval = null;
        }
    }

    initializeWithData(gameData) {
        if (gameData && gameData.hasOwnProperty('playerIndex')) {
            this.playerIndex = gameData.playerIndex;
            console.log(`ReactionTime: Player index set to ${this.playerIndex}`);
        }
    }

    cleanup() {
        // Stop counter and hide the reaction game when switching games
        this.stopCounter();
        this.hasClicked = false;

        const existingReactionGame = document.getElementById('reaction-game');
        if (existingReactionGame) {
            existingReactionGame.classList.add('hidden');
        }

        // Hide counter
        if (this.elements.counter) {
            this.elements.counter.classList.add('hidden');
        }
    }
}

class TicTacToeComponent {
    static gameId = "tic-tac-toe";

    constructor(gameContainer, socket) {
        this.container = gameContainer;
        this.socket = socket;
        this.elements = {};
        this.playerIndex = 0; // Will be set by initializeWithData
    }

    render() {
        this.container.innerHTML = `
            <div class="tic-tac-toe-container">
                <div class="tic-tac-toe-board" id="tic-tac-toe-board">
                    ${Array(9).fill(0).map((_, i) => `<div class="cell" data-index="${i}"></div>`).join('')}
                </div>
            </div>
        `;

        this.elements.board = this.container.querySelector('#tic-tac-toe-board');
        this.elements.status = document.getElementById('game-status'); // Use global status
        this.elements.cells = this.container.querySelectorAll('.cell');

        this.elements.cells.forEach((cell, index) => {
            cell.addEventListener('click', () => this.handleCellClick(index));
        });
    }

    handleCellClick(position) {
        const cell = this.elements.cells[position];
        if (!cell.classList.contains('disabled')) {
            this.socket.emit('game-action', { position });
        }
    }

    initializeWithData(gameData) {
        console.log('TicTacToe initializeWithData called with:', gameData);

        // CRITICAL: Set player index first, before any other logic
        if (gameData && gameData.hasOwnProperty('playerIndex')) {
            this.playerIndex = gameData.playerIndex;
            console.log(`TicTacToe: Player index set to ${this.playerIndex}`);
        } else {
            console.error('TicTacToe: No playerIndex found in gameData!');
            return; // Don't proceed without player index
        }

        // Update the board with initial game state from server
        if (gameData && gameData.gameData) {
            console.log(`TicTacToe: Calling updateBoard with currentPlayer=${gameData.gameData.currentPlayer}, myPlayerIndex=${this.playerIndex}`);
            this.updateBoard(gameData.gameData.board, gameData.gameData.currentPlayer);
        } else {
            console.log('TicTacToe: Waiting for initial game state from server');
            // Keep the "Waiting for game to start..." status - no fallback logic
        }
    }

    updateBoard(board, currentPlayer) {
        this.elements.cells.forEach((cell, index) => {
            // Clear previous classes and content
            cell.classList.remove('x', 'o');
            cell.textContent = '';

            // Add appropriate class for X or O (images will show via CSS)
            if (board[index] === 'X') {
                cell.classList.add('x');
            } else if (board[index] === 'O') {
                cell.classList.add('o');
            }

            cell.classList.toggle('disabled', !!board[index]);
        });

        const currentPlayerSymbol = currentPlayer === 0 ? 'X' : 'O';
        const mySymbol = this.playerIndex === 0 ? 'X' : 'O';
        const isYourTurn = currentPlayer === this.playerIndex;

        const statusText = isYourTurn
            ? `Your turn (${mySymbol})`
            : `Opponent's turn (${currentPlayerSymbol})`;

        console.log(`TicTacToe updateBoard: currentPlayer=${currentPlayer}, myPlayerIndex=${this.playerIndex}, isYourTurn=${isYourTurn}, statusText="${statusText}"`);

        this.elements.status.textContent = statusText;
    }

    cleanup() {
        // Cleanup if needed
    }
}

class RockPaperScissorsComponent {
    static gameId = "rock-paper-scissors";

    constructor(gameContainer, socket) {
        this.container = gameContainer;
        this.socket = socket;
        this.elements = {};
        this.playerIndex = 0; // Will be set by initializeWithData
    }

    render() {
        this.container.innerHTML = `
            <div class="rps-choices">
                <button class="rps-choice" data-choice="rock">ROCK</button>
                <button class="rps-choice" data-choice="paper">PAPER</button>
                <button class="rps-choice" data-choice="scissors">SCISSORS</button>
            </div>
            <div id="rps-status">Choose your weapon!</div>
            <div id="rps-results" class="hidden">
                <div class="rps-battle-arena">
                    <div class="battle-choice your-battle-choice">
                        <div class="choice-label">You</div>
                        <div class="choice-image" id="your-choice-img"></div>
                    </div>
                    <div class="battle-vs">VS</div>
                    <div class="battle-choice opponent-battle-choice">
                        <div class="choice-label">Opponent</div>
                        <div class="choice-image" id="opponent-choice-img"></div>
                    </div>
                </div>
                <div id="battle-result-text"></div>
            </div>
        `;

        this.elements.choices = this.container.querySelectorAll('.rps-choice');
        this.elements.status = this.container.querySelector('#rps-status');
        this.elements.results = this.container.querySelector('#rps-results');
        this.elements.yourChoiceImg = this.container.querySelector('#your-choice-img');
        this.elements.opponentChoiceImg = this.container.querySelector('#opponent-choice-img');
        this.elements.battleResultText = this.container.querySelector('#battle-result-text');

        this.elements.choices.forEach(button => {
            button.addEventListener('click', () => this.handleChoice(button.dataset.choice));
        });
    }

    handleChoice(choice) {
        this.socket.emit('game-action', { choice });
        this.disableChoices();
        this.elements.status.textContent = 'Waiting for opponent...';
    }

    disableChoices() {
        this.elements.choices.forEach(button => {
            button.disabled = true;
        });
    }

    enableChoices() {
        this.elements.choices.forEach(button => {
            button.disabled = false;
        });
    }

    initializeWithData(gameData) {
        if (gameData && gameData.hasOwnProperty('playerIndex')) {
            this.playerIndex = gameData.playerIndex;
            console.log(`RockPaperScissors: Player index set to ${this.playerIndex}`);
        }
    }

    showRoundResult(data) {
        // Set up the battle arena with choice images
        this.elements.yourChoiceImg.className = `choice-image ${data.yourChoice}`;
        this.elements.opponentChoiceImg.className = `choice-image ${data.opponentChoice}`;

        this.elements.results.classList.remove('hidden');

        // Animate the battle sequence
        this.animateBattle(data.yourChoice, data.opponentChoice, data.winner);

        let resultText = '';
        let explanation = '';

        if (data.winner === 'you') {
            resultText = '🎉 You won this round! 🎉';
            explanation = this.getWinExplanation(data.yourChoice, data.opponentChoice);
        } else if (data.winner === 'opponent') {
            resultText = '😔 Opponent won this round!';
            explanation = this.getWinExplanation(data.opponentChoice, data.yourChoice);
        } else {
            resultText = '🤝 This round is a draw!';
            explanation = 'Same choice - try again!';
        }

        // Show initial result
        this.elements.status.textContent = resultText;

        // Show explanation after a brief delay
        setTimeout(() => {
            this.elements.battleResultText.textContent = explanation;
        }, 1000);

        setTimeout(() => {
            this.enableChoices();
            this.elements.status.textContent = 'Choose your weapon!';
            this.elements.results.classList.add('hidden');
            this.elements.battleResultText.textContent = '';
        }, 3000);
    }

    animateBattle(yourChoice, opponentChoice, winner) {
        const yourChoiceEl = this.elements.yourChoiceImg;
        const opponentChoiceEl = this.elements.opponentChoiceImg;

        // Reset animations
        yourChoiceEl.classList.remove('battle-winner', 'battle-loser', 'battle-clash');
        opponentChoiceEl.classList.remove('battle-winner', 'battle-loser', 'battle-clash');

        // Add entrance animations
        yourChoiceEl.classList.add('battle-enter-left');
        opponentChoiceEl.classList.add('battle-enter-right');

        setTimeout(() => {
            // Remove entrance animations
            yourChoiceEl.classList.remove('battle-enter-left');
            opponentChoiceEl.classList.remove('battle-enter-right');

            // Add result animations
            if (winner === 'you') {
                yourChoiceEl.classList.add('battle-winner');
                opponentChoiceEl.classList.add('battle-loser');
            } else if (winner === 'opponent') {
                yourChoiceEl.classList.add('battle-loser');
                opponentChoiceEl.classList.add('battle-winner');
            } else {
                yourChoiceEl.classList.add('battle-clash');
                opponentChoiceEl.classList.add('battle-clash');
            }
        }, 800);
    }

    getWinExplanation(winnerChoice, loserChoice) {
        const explanations = {
            'rock-scissors': 'Rock crushes Scissors!',
            'paper-rock': 'Paper covers Rock!',
            'scissors-paper': 'Scissors cuts Paper!'
        };
        return explanations[`${winnerChoice}-${loserChoice}`] || '';
    }

    cleanup() {
        // Cleanup if needed
    }
}

class WhackAMoleComponent {
    static gameId = "whack-a-mole";

    constructor(gameContainer, socket) {
        this.container = gameContainer;
        this.socket = socket;
        this.elements = {};
        this.playerIndex = 0; // Will be set by initializeWithData
    }

    render() {
        this.container.innerHTML = `
            <div class="mole-grid">
                ${Array(9).fill(0).map((_, i) => `<div class="mole-hole" data-position="${i}"></div>`).join('')}
            </div>
        `;

        this.elements.holes = this.container.querySelectorAll('.mole-hole');

        this.elements.holes.forEach((hole, index) => {
            hole.addEventListener('click', () => this.handleHoleClick(index));
        });
    }

    handleHoleClick(position) {
        const hole = this.elements.holes[position];
        if (hole.classList.contains('active')) {
            this.socket.emit('game-action', { position });
            hole.classList.remove('active');
        }
    }

    showMole(position) {
        this.clearMoles();
        const hole = this.elements.holes[position];
        if (hole) {
            hole.classList.add('active');
        }
    }

    hideMole(position) {
        const hole = this.elements.holes[position];
        if (hole) {
            hole.classList.remove('active');
        }
    }

    clearMoles() {
        this.elements.holes.forEach(hole => {
            hole.classList.remove('active');
        });
    }

    initializeWithData(gameData) {
        if (gameData && gameData.hasOwnProperty('playerIndex')) {
            this.playerIndex = gameData.playerIndex;
            console.log(`WhackAMole: Player index set to ${this.playerIndex}`);
        }
    }

    cleanup() {
        this.clearMoles();
    }
}

// Register all components
GameComponentRegistry.registerComponent('reaction-time', ReactionTimeComponent);
GameComponentRegistry.registerComponent('tic-tac-toe', TicTacToeComponent);
GameComponentRegistry.registerComponent('rock-paper-scissors', RockPaperScissorsComponent);
GameComponentRegistry.registerComponent('whack-a-mole', WhackAMoleComponent);

// Export for use in main script
window.GameComponentRegistry = GameComponentRegistry;