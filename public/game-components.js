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
        this.playerIndex = 0; // Will be set by game logic
    }

    render() {
        // FIXED: Moved status to header, removed from game area
        this.container.innerHTML = `
            <div class="tic-tac-toe-container">
                <div class="tic-tac-toe-board" id="tic-tac-toe-board">
                    ${Array(9).fill(0).map((_, i) => `<div class="cell" data-index="${i}"></div>`).join('')}
                </div>
            </div>
        `;

        this.elements.board = this.container.querySelector('#tic-tac-toe-board');
        this.elements.status = document.getElementById('game-status'); // FIXED: Use global status in header
        this.elements.cells = this.container.querySelectorAll('.cell');

        console.log('FIXED: TTT render called, status element:', this.elements.status);

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

            // Add appropriate CSS class for background images AND fallback text
            if (board[index] === 'X') {
                cell.classList.add('x'); // Uses images/x.png
                cell.textContent = 'X'; // Fallback if image doesn't load
                cell.style.color = 'white';
                cell.style.fontSize = '2rem';
                cell.style.fontWeight = 'bold';
                cell.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
            } else if (board[index] === 'O') {
                cell.classList.add('o'); // Uses images/y.png
                cell.textContent = 'O'; // Fallback if image doesn't load
                cell.style.color = 'white';
                cell.style.fontSize = '2rem';
                cell.style.fontWeight = 'bold';
                cell.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
            } else {
                cell.textContent = ''; // Empty cell
                cell.style.color = '';
                cell.style.fontSize = '';
                cell.style.fontWeight = '';
                cell.style.textShadow = '';
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
        console.log('FIXED: Setting status element:', this.elements.status, 'to:', statusText);

        if (this.elements.status) {
            this.elements.status.textContent = statusText;
            console.log('FIXED: Status updated successfully to:', this.elements.status.textContent);
        } else {
            console.error('FIXED: Status element not found!');
        }
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