// =====================================================
// QUICKGAME FRONTEND - Main Game Controller
// =====================================================
// This file handles all client-side game logic:
// 1. Socket.IO communication with server
// 2. Screen transitions (menu -> game -> results)
// 3. Loading game-specific UI components
// 4. Managing player state and game flow

class ModularQuickGame {
    constructor() {
        // ===== CORE PROPERTIES =====
        this.socket = io();                     // Socket.IO connection to server
        this.playerName = '';                   // Player's chosen display name
        this.currentGame = null;                // Current game data from server
        this.gameState = 'menu';                // Current app state (menu/game/results)
        this.currentGameComponent = null;       // Currently loaded game UI component

        // ===== INITIALIZATION =====
        this.initializeElements();              // Cache DOM element references
        this.bindEvents();                      // Set up button click handlers
        this.bindSocketEvents();                // Set up server communication
    }

    // ===== DOM ELEMENT CACHING =====
    // Cache references to DOM elements for better performance
    initializeElements() {
        this.elements = {
            // Screen containers
            menuScreen: document.getElementById('menu-screen'),
            gameScreen: document.getElementById('game-screen'),
            resultsScreen: document.getElementById('results-screen'),
            disconnectScreen: document.getElementById('disconnect-screen'),

            // Menu screen elements
            playerNameInput: document.getElementById('player-name'),
            findMatchBtn: document.getElementById('find-match-btn'),
            queueStatus: document.getElementById('queue-status'),
            queueCount: document.getElementById('queue-count'),
            cancelQueueBtn: document.getElementById('cancel-queue-btn'),

            // Game screen elements
            playerNameDisplay: document.getElementById('player-name-display'),
            opponentNameDisplay: document.getElementById('opponent-name-display'),
            playerScore: document.getElementById('player-match-score'),
            opponentScore: document.getElementById('opponent-match-score'),
            gameTimer: document.getElementById('game-timer'),
            countdownDisplay: document.getElementById('countdown-display'),

            // Dynamic game area where game-specific UI is loaded
            gameArea: document.getElementById('game-area'),

            // Results screen elements
            playAgainBtn: document.getElementById('ready-up-btn'),
            rageQuitBtn: document.getElementById('rage-quit-btn'),
            mainMenuBtn: document.getElementById('main-menu-btn'),
            disconnectMenuBtn: document.getElementById('disconnect-menu-btn'),

            resultTitle: document.getElementById('result-title'),
            finalYourScore: document.getElementById('final-your-score'),
            finalOpponentScore: document.getElementById('final-opponent-score'),

            // Ready status elements
            readyStatus: document.getElementById('ready-status'),
            yourReadyStatus: document.getElementById('your-ready-status'),
            opponentReadyStatus: document.getElementById('opponent-ready-status')
        };
    }

    bindEvents() {
        this.elements.findMatchBtn.addEventListener('click', () => this.findMatch());
        this.elements.cancelQueueBtn.addEventListener('click', () => this.cancelQueue());
        this.elements.playAgainBtn.addEventListener('click', () => this.readyUp());
        this.elements.rageQuitBtn.addEventListener('click', () => this.rageQuit());
        this.elements.mainMenuBtn.addEventListener('click', () => this.showScreen('menu'));
        this.elements.disconnectMenuBtn.addEventListener('click', () => this.showScreen('menu'));

        this.elements.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.findMatch();
        });
    }

    bindSocketEvents() {
        this.socket.on('waiting-for-opponent', (data) => {
            console.log('Received waiting-for-opponent:', data);
            this.showSearchingState();
            // Update queue status with server data
            this.updateQueueStatus(data.queueSize || data.queuePosition || 1, data.queuePosition || 1);
        });

        this.socket.on('queue-status-update', (data) => {
            console.log('Received queue status update:', data);
            this.updateQueueStatus(data.queueSize, data.position);
        });

        this.socket.on('game-found', (data) => {
            this.currentGame = data;
            this.elements.opponentNameDisplay.textContent = data.opponent;
            this.showScreen('game');
            this.hideSearchingState();

            console.log(`Game found: ${data.gameName} (${data.gameType})`);
            console.log(`Description: ${data.description}`);
        });

        this.socket.on('countdown', (count) => {
            this.showCountdown(count);
        });

        this.socket.on('game-start', (data) => {
            this.hideCountdown();
            this.startGame(data.gameType, data.gameData);
        });

        this.socket.on('game-update', (data) => {
            if (this.currentGameComponent && this.currentGameComponent.updateBoard) {
                this.currentGameComponent.updateBoard(data.board, data.currentPlayer);
            }
        });

        this.socket.on('start-signal', () => {
            if (this.currentGameComponent && this.currentGameComponent.onStartSignal) {
                this.currentGameComponent.onStartSignal();
            }
        });

        this.socket.on('mole-appears', (data) => {
            if (this.currentGameComponent && this.currentGameComponent.showMole) {
                this.currentGameComponent.showMole(data.position);
            }
        });

        this.socket.on('mole-disappears', (data) => {
            if (this.currentGameComponent && this.currentGameComponent.hideMole) {
                this.currentGameComponent.hideMole(data.position);
            }
        });

        this.socket.on('score-update', (data) => {
            this.updateScores(data.scores[0] || 0, data.scores[1] || 0);
        });

        this.socket.on('round-result', (data) => {
            if (this.currentGameComponent && this.currentGameComponent.showRoundResult) {
                this.currentGameComponent.showRoundResult(data);
            }
            this.updateScores(data.scores[0] || 0, data.scores[1] || 0);
        });

        this.socket.on('next-round', (data) => {
            console.log(`Next round: ${data.round}`);
        });

        this.socket.on('game-end', (data) => {
            this.endGame(data);
        });

        this.socket.on('opponent-disconnected', () => {
            this.showScreen('disconnect');
        });

        this.socket.on('left-queue', () => {
            this.hideSearchingState();
        });

        this.socket.on('game-error', (data) => {
            console.error('Game error:', data.message);
            alert(`Game error: ${data.message}`);
        });

        this.socket.on('matchmaking-error', (data) => {
            console.error('Matchmaking error:', data.message);
            alert(`Matchmaking error: ${data.message}`);
        });

        this.socket.on('ready-status-update', (data) => {
            console.log('Ready status update:', data);
            this.updateReadyStatus(data.yourReady, data.opponentReady);
        });

        this.socket.on('both-players-ready', () => {
            console.log('Both players ready - starting next game');
            this.hideReadyStatus();
        });

        this.socket.on('opponent-rage-quit', (data) => {
            console.log('Opponent rage quit:', data.message);
            // Show a snarky message about the opponent rage quitting
            alert(data.message);
            // Return to main menu
            this.showScreen('menu');
            this.resetGame();
        });
    }

    findMatch() {
        this.playerName = this.elements.playerNameInput.value.trim() || 'Anonymous';
        this.elements.playerNameDisplay.textContent = this.playerName;

        console.log(`Attempting to find match for player: ${this.playerName}`);

        // Show loading state but don't show fake queue numbers
        this.elements.findMatchBtn.disabled = true;
        this.elements.findMatchBtn.textContent = 'Searching...';

        console.log('Emitting join-queue event...');
        this.socket.emit('join-queue', this.playerName);
        console.log('join-queue event emitted');
    }

    cancelQueue() {
        console.log('Canceling queue search');
        this.socket.emit('leave-queue');
        this.hideSearchingState();
    }

    rageQuit() {
        console.log('Player rage quit - returning to main menu');
        // Emit rage quit event to notify opponent
        this.socket.emit('rage-quit');
        // Also leave queue in case they're still in queue
        this.socket.emit('leave-queue');
        this.showScreen('menu');
        this.resetGame();
    }

    readyUp() {
        console.log('Player ready for next game');
        this.socket.emit('player-ready');

        // Show ready status and disable ready button
        this.showReadyStatus();
        this.elements.playAgainBtn.disabled = true;
        this.elements.playAgainBtn.textContent = 'Ready!';

        // Update own status to ready
        if (this.elements.yourReadyStatus) {
            this.elements.yourReadyStatus.textContent = 'Ready';
            this.elements.yourReadyStatus.style.color = '#4CAF50';
        }
    }

    showReadyStatus() {
        if (this.elements.readyStatus) {
            this.elements.readyStatus.classList.remove('hidden');
        }
    }

    hideReadyStatus() {
        if (this.elements.readyStatus) {
            this.elements.readyStatus.classList.add('hidden');
        }
        // Reset ready button
        this.elements.playAgainBtn.disabled = false;
        this.elements.playAgainBtn.textContent = 'Ready for Next Game';
    }

    updateReadyStatus(yourReady, opponentReady) {
        if (this.elements.yourReadyStatus) {
            this.elements.yourReadyStatus.textContent = yourReady ? 'Ready' : 'Not Ready';
            this.elements.yourReadyStatus.style.color = yourReady ? '#4CAF50' : '#f44336';
        }

        if (this.elements.opponentReadyStatus) {
            this.elements.opponentReadyStatus.textContent = opponentReady ? 'Ready' : 'Not Ready';
            this.elements.opponentReadyStatus.style.color = opponentReady ? '#4CAF50' : '#f44336';
        }
    }

    showScreen(screenName) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        const targetScreen = document.getElementById(`${screenName}-screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        if (screenName === 'menu') {
            this.resetGame();
        }
    }

    showCountdown(count) {
        this.elements.countdownDisplay.classList.remove('hidden');
        this.elements.countdownDisplay.querySelector('.countdown-number').textContent = count;
    }

    hideCountdown() {
        this.elements.countdownDisplay.classList.add('hidden');
    }

    startGame(gameType, gameData) {
        this.gameState = 'playing';

        // Clear previous game component
        if (this.currentGameComponent && this.currentGameComponent.cleanup) {
            this.currentGameComponent.cleanup();
        }

        // Completely clear the game area to remove any remnants
        this.elements.gameArea.innerHTML = '';

        // Get the appropriate game component
        const ComponentClass = GameComponentRegistry.getComponent(gameType);
        if (!ComponentClass) {
            console.error(`No component found for game type: ${gameType}`);
            return;
        }

        // Create new game component
        this.currentGameComponent = new ComponentClass(this.elements.gameArea, this.socket);
        this.currentGameComponent.render();

        // Handle game-specific initialization
        if (gameData && this.currentGameComponent.initializeWithData) {
            this.currentGameComponent.initializeWithData(gameData);
        }
    }

    updateScores(playerScore, opponentScore) {
        if (this.elements.playerScore) {
            this.elements.playerScore.textContent = playerScore;
        }
        if (this.elements.opponentScore) {
            this.elements.opponentScore.textContent = opponentScore;
        }
    }

    endGame(data) {
        this.gameState = 'finished';

        // Immediately clear the game area
        this.elements.gameArea.innerHTML = '';

        let titleText = '';
        let titleClass = '';

        if (data.winner) {
            titleText = 'You Win!';
            titleClass = '';
        } else if (data.draw) {
            titleText = "It's a Draw!";
            titleClass = 'draw';
        } else {
            titleText = 'You Lose!';
            titleClass = 'lose';
        }

        if (this.elements.resultTitle) {
            this.elements.resultTitle.textContent = titleText;
            this.elements.resultTitle.className = titleClass;
        }
        if (this.elements.finalYourScore) {
            this.elements.finalYourScore.textContent = data.finalScores.you;
        }
        if (this.elements.finalOpponentScore) {
            this.elements.finalOpponentScore.textContent = data.finalScores.opponent;
        }

        setTimeout(() => {
            this.showScreen('results');
        }, 2000);
    }

    resetGame() {
        this.gameState = 'menu';
        this.currentGame = null;

        // Cleanup current game component
        if (this.currentGameComponent && this.currentGameComponent.cleanup) {
            this.currentGameComponent.cleanup();
        }
        this.currentGameComponent = null;

        this.hideCountdown();
        this.hideSearchingState();
        this.resetFindMatchButton();
        this.updateScores(0, 0);

        // Clear game area
        this.elements.gameArea.innerHTML = '';
    }

    showSearchingState() {
        console.log('Showing searching state');
        // Show the queue status section
        this.elements.queueStatus.classList.remove('hidden');

        // Update button state
        this.elements.findMatchBtn.disabled = true;
        this.elements.findMatchBtn.textContent = 'Searching...';

        // Ensure the cancel button is visible and functional
        this.elements.cancelQueueBtn.style.display = 'block';

        // Set initial queue message
        const mainStatusText = this.elements.queueStatus.querySelector('p');
        if (mainStatusText) {
            mainStatusText.textContent = 'Searching for opponent...';
        }
    }

    hideSearchingState() {
        this.elements.queueStatus.classList.add('hidden');
        this.resetFindMatchButton();
    }

    updateQueueStatus(queueSize, position) {
        console.log(`Updating queue status: size=${queueSize}, position=${position}`);

        // Update queue count display
        if (this.elements.queueCount) {
            this.elements.queueCount.textContent = queueSize || 1;
        }

        // Update the queue position text
        const queuePositionText = document.getElementById('queue-position-text');
        if (queuePositionText) {
            if (position === 1 || queueSize === 1) {
                queuePositionText.textContent = 'You are next in line!';
                queuePositionText.className = 'queue-position priority';
            } else if (position) {
                queuePositionText.textContent = `Position ${position} in queue`;
                queuePositionText.className = 'queue-position';
            } else {
                queuePositionText.textContent = 'In queue';
                queuePositionText.className = 'queue-position';
            }
            queuePositionText.style.display = 'block';
        }

        // Update the main status message for better feedback
        const mainStatusText = this.elements.queueStatus.querySelector('p');
        if (mainStatusText) {
            if (queueSize > 1) {
                mainStatusText.textContent = 'Searching for opponent...';
            } else {
                mainStatusText.textContent = 'Waiting for another player...';
            }
        }

        // Ensure queue status is visible
        this.elements.queueStatus.classList.remove('hidden');
    }

    resetFindMatchButton() {
        this.elements.findMatchBtn.disabled = false;
        this.elements.findMatchBtn.textContent = 'Find Match';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ModularQuickGame();
});