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
    }

    render() {
        this.container.innerHTML = `
            <div class="reaction-zone" id="reaction-zone">
                <div class="signal-light red" id="signal-light"></div>
                <p id="reaction-instruction">Wait for GREEN...</p>
            </div>
        `;

        this.elements.zone = this.container.querySelector('#reaction-zone');
        this.elements.light = this.container.querySelector('#signal-light');
        this.elements.instruction = this.container.querySelector('#reaction-instruction');

        this.elements.zone.addEventListener('click', () => this.handleClick());
    }

    handleClick() {
        if (this.elements.light.classList.contains('green')) {
            this.socket.emit('game-action', { type: 'click' });
            this.elements.instruction.textContent = 'Clicked!';
        }
    }

    onStartSignal() {
        this.elements.light.classList.remove('red');
        this.elements.light.classList.add('green');
        this.elements.instruction.textContent = 'CLICK NOW!';
    }

    cleanup() {
        // Cleanup if needed
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
            <div class="tic-tac-toe-board" id="tic-tac-toe-board">
                ${Array(9).fill(0).map((_, i) => `<div class="cell" data-index="${i}"></div>`).join('')}
            </div>
            <p id="ttt-status">Your turn (X)</p>
        `;

        this.elements.board = this.container.querySelector('#tic-tac-toe-board');
        this.elements.status = this.container.querySelector('#ttt-status');
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
        if (gameData && gameData.hasOwnProperty('playerIndex')) {
            this.playerIndex = gameData.playerIndex;
            console.log(`TicTacToe: Player index set to ${this.playerIndex}`);
        }
        // Update the board with initial game state
        if (gameData && gameData.gameData) {
            this.updateBoard(gameData.gameData.board, gameData.gameData.currentPlayer);
        }
    }

    updateBoard(board, currentPlayer) {
        this.elements.cells.forEach((cell, index) => {
            cell.textContent = board[index] || '';
            cell.classList.toggle('disabled', !!board[index]);
        });

        const currentPlayerSymbol = currentPlayer === 0 ? 'X' : 'O';
        const mySymbol = this.playerIndex === 0 ? 'X' : 'O';
        const isYourTurn = currentPlayer === this.playerIndex;
        this.elements.status.textContent = isYourTurn
            ? `Your turn (${mySymbol})`
            : `Opponent's turn (${currentPlayerSymbol})`;
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
                <div class="choice-display">
                    <div>You: <span id="your-choice"></span></div>
                    <div>Opponent: <span id="opponent-choice"></span></div>
                </div>
            </div>
        `;

        this.elements.choices = this.container.querySelectorAll('.rps-choice');
        this.elements.status = this.container.querySelector('#rps-status');
        this.elements.results = this.container.querySelector('#rps-results');
        this.elements.yourChoice = this.container.querySelector('#your-choice');
        this.elements.opponentChoice = this.container.querySelector('#opponent-choice');

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

    showRoundResult(data) {
        this.elements.yourChoice.textContent = data.yourChoice.toUpperCase();
        this.elements.opponentChoice.textContent = data.opponentChoice.toUpperCase();
        this.elements.results.classList.remove('hidden');

        let resultText = '';
        if (data.winner === 'you') resultText = 'You won this round!';
        else if (data.winner === 'opponent') resultText = 'Opponent won this round!';
        else resultText = 'This round is a draw!';

        this.elements.status.textContent = resultText;

        setTimeout(() => {
            this.enableChoices();
            this.elements.status.textContent = 'Choose your weapon!';
            this.elements.results.classList.add('hidden');
        }, 2000);
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