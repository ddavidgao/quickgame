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
        this.currentGameNumber = 1;             // Track current game number in match
        this.totalGames = 3;                    // Total games per match (hardcoded default)
        this.playerFinalScore = 0;              // Player's wins across all games in match
        this.opponentFinalScore = 0;            // Opponent's wins across all games in match

        // ===== INITIALIZATION =====
        this.initializeElements();              // Cache DOM element references
        this.bindEvents();                      // Set up button click handlers
        this.bindSocketEvents();                // Set up server communication

        // Set initial game progress display after DOM is fully loaded
        setTimeout(() => {
            this.updateGameProgress();
        }, 100);
    }

    // ===== DOM ELEMENT CACHING =====
    // Cache references to DOM elements for better performance
    initializeElements() {
        this.elements = {
            // Screen containers
            menuScreen: document.getElementById('menu-screen'),
            matchFoundScreen: document.getElementById('match-found-screen'),
            gameDescriptionScreen: document.getElementById('game-description-screen'),
            gameScreen: document.getElementById('game-screen'),
            resultsScreen: document.getElementById('results-screen'),
            disconnectScreen: document.getElementById('disconnect-screen'),

            // Menu screen elements
            playerNameInput: document.getElementById('player-name'),
            findMatchBtn: document.getElementById('find-match-btn'),
            queueStatus: document.getElementById('queue-status'),
            queueCount: document.getElementById('queue-count'),
            cancelQueueBtn: document.getElementById('cancel-queue-btn'),

            // Final score elements
            finalScoreDisplay: document.getElementById('final-score-display'),
            playerFinalScoreSpan: document.getElementById('player-final-score'),
            opponentFinalScoreSpan: document.getElementById('opponent-final-score'),

            // Game screen elements
            playerNameDisplay: document.getElementById('player-name-display'),
            opponentNameDisplay: document.getElementById('opponent-name-display'),
            playerScore: document.getElementById('player-match-score'),
            opponentScore: document.getElementById('opponent-match-score'),
            gameTimer: document.getElementById('game-timer'),
            gameStatus: document.getElementById('game-status'),
            countdownDisplay: document.getElementById('countdown-display'),

            // Dynamic game area where game-specific UI is loaded
            gameArea: document.getElementById('game-area'),

            // Match Found screen elements
            yourNameDisplay: document.getElementById('your-name-display'),
            opponentNameMatch: document.getElementById('opponent-name-match'),

            // Game Description screen elements
            gameNameDisplay: document.getElementById('game-name-display'),
            gameDescriptionText: document.getElementById('game-description-text'),

            // Game progress elements
            currentGameSpan: document.getElementById('current-game'),

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
        this.elements.mainMenuBtn.addEventListener('click', () => {
            // If this is after a complete match, reset everything for a new match
            this.resetFinalScores();
            this.resetGame();
            this.showScreen('menu');
        });
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
            this.hideSearchingState();

            console.log(`Game found: ${data.gameName} (${data.gameType})`);
            console.log(`Description: ${data.description}`);

            // NEW FLOW: Show Match Found screen first
            this.showMatchFoundScreen(data);
        });

        this.socket.on('countdown', (count) => {
            this.showCountdown(count);
        });

        this.socket.on('timer-update', (timeLeft) => {
            this.updateGameTimer(timeLeft);
        });

        this.socket.on('game-start', (data) => {
            this.hideCountdown();
            this.startGame(data.gameType, data);
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
            console.log(`Both players ready - incrementing game from ${this.currentGameNumber} to ${this.currentGameNumber + 1}`);
            this.currentGameNumber++;
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
        } else if (screenName === 'results') {
            // Clear game area when transitioning to results screen
            this.elements.gameArea.innerHTML = '';
            // Reset game status
            if (this.elements.gameStatus) {
                this.elements.gameStatus.textContent = 'Game Complete!';
            }
        }
    }

    showCountdown(count) {
        this.elements.countdownDisplay.classList.remove('hidden');
        this.elements.countdownDisplay.querySelector('.countdown-number').textContent = count;
    }

    hideCountdown() {
        this.elements.countdownDisplay.classList.add('hidden');
    }

    updateGameTimer(timeLeft) {
        console.log(`Timer update received: ${timeLeft} seconds`);

        // Ensure we have a valid number
        if (typeof timeLeft !== 'number' || timeLeft < 0) {
            console.warn(`Invalid timer value: ${timeLeft}`);
            return;
        }

        this.elements.gameTimer.textContent = timeLeft;

        // Add visual warning when time is running low
        if (timeLeft <= 5) {
            this.elements.gameTimer.style.color = '#ff4444';
            this.elements.gameTimer.style.animation = 'pulse 0.5s infinite';
            this.elements.gameTimer.style.fontWeight = 'bold';
            this.elements.gameTimer.style.transform = 'scale(1.1)';
        } else if (timeLeft <= 10) {
            this.elements.gameTimer.style.color = '#ffaa00';
            this.elements.gameTimer.style.animation = '';
            this.elements.gameTimer.style.fontWeight = 'bold';
            this.elements.gameTimer.style.transform = 'scale(1.05)';
        } else {
            this.elements.gameTimer.style.color = '#FFF8DC';
            this.elements.gameTimer.style.animation = '';
            this.elements.gameTimer.style.fontWeight = 'bold';
            this.elements.gameTimer.style.transform = 'scale(1)';
        }
    }

    startGame(gameType, gameData) {
        this.gameState = 'playing';

        // Update game progress display
        this.updateGameProgress();

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

    updateGameProgress() {
        // Ensure totalGames is always 3 (hardcoded)
        this.totalGames = 3;

        console.log(`[DEBUG] updateGameProgress called: currentGameNumber=${this.currentGameNumber}, totalGames=${this.totalGames}`);

        // Update the entire game progress display to ensure totalGames is correct
        const gameProgress = document.getElementById('game-progress');

        if (gameProgress) {
            // Just update the current game number, keep /3 hardcoded in HTML
            const currentGameSpan = document.getElementById('current-game');
            if (currentGameSpan) {
                currentGameSpan.textContent = this.currentGameNumber;
                console.log(`[FIXED] Updated current game number to: ${this.currentGameNumber}`);
            }
        } else {
            console.error('[FIXED] game-progress element not found!');
        }
    }

    updateFinalScoreDisplay() {
        console.log(`[DEBUG] updateFinalScoreDisplay: player=${this.playerFinalScore}, opponent=${this.opponentFinalScore}`);
        console.log(`[DEBUG] playerFinalScoreSpan exists:`, !!this.elements.playerFinalScoreSpan);
        console.log(`[DEBUG] opponentFinalScoreSpan exists:`, !!this.elements.opponentFinalScoreSpan);
        console.log(`[DEBUG] finalScoreDisplay exists:`, !!this.elements.finalScoreDisplay);

        if (this.elements.playerFinalScoreSpan) {
            this.elements.playerFinalScoreSpan.textContent = this.playerFinalScore;
            console.log(`[DEBUG] Set player final score span to: ${this.playerFinalScore}`);
        }
        if (this.elements.opponentFinalScoreSpan) {
            this.elements.opponentFinalScoreSpan.textContent = this.opponentFinalScore;
            console.log(`[DEBUG] Set opponent final score span to: ${this.opponentFinalScore}`);
        }

        // Show the final score display once we're in a game (even with 0-0 scores)
        if (this.gameState !== 'menu') {
            if (this.elements.finalScoreDisplay) {
                this.elements.finalScoreDisplay.classList.remove('hidden');
                console.log(`[DEBUG] Showing final score display - game state: ${this.gameState}`);
            }
        }
    }

    showFinalMatchResults() {
        console.log(`[FINAL MATCH] Showing final results: ${this.playerFinalScore} - ${this.opponentFinalScore}`);

        // Determine the overall match winner
        let matchWinner = '';
        let matchResult = '';

        if (this.playerFinalScore > this.opponentFinalScore) {
            matchWinner = 'YOU WIN THE MATCH!';
            matchResult = '';
        } else if (this.opponentFinalScore > this.playerFinalScore) {
            matchWinner = 'YOU LOSE THE MATCH!';
            matchResult = 'lose';
        } else {
            matchWinner = 'MATCH TIED!';
            matchResult = 'draw';
        }

        // Update the results screen with final match information
        if (this.elements.resultTitle) {
            this.elements.resultTitle.textContent = matchWinner;
            this.elements.resultTitle.className = matchResult;
        }

        // Show the final match scores instead of individual game scores
        if (this.elements.finalYourScore) {
            this.elements.finalYourScore.textContent = this.playerFinalScore;
        }
        if (this.elements.finalOpponentScore) {
            this.elements.finalOpponentScore.textContent = this.opponentFinalScore;
        }

        // Hide ready up button and show main menu button instead
        if (this.elements.readyUpBtn) {
            this.elements.readyUpBtn.classList.add('hidden');
        }
        if (this.elements.rageQuitBtn) {
            this.elements.rageQuitBtn.classList.add('hidden');
        }
        if (this.elements.mainMenuBtn) {
            this.elements.mainMenuBtn.classList.remove('hidden');
            this.elements.mainMenuBtn.textContent = 'New Match';
        }

        // Show the results screen
        this.showScreen('results');
    }

    endGame(data) {
        this.gameState = 'finished';

        let titleText = '';
        let titleClass = '';

        // Use match scores from server instead of local tracking
        if (data.matchScores) {
            this.playerFinalScore = data.matchScores.you;
            this.opponentFinalScore = data.matchScores.opponent;
            console.log(`[FINAL SCORE] Server match scores: ${this.playerFinalScore}-${this.opponentFinalScore}`);
            console.log(`[FINAL SCORE] Full match scores data:`, data.matchScores);
        } else {
            console.log(`[FINAL SCORE] No matchScores in data:`, data);
        }

        // Update game progress from server data
        if (data.currentGame && data.totalGames) {
            this.currentGameNumber = data.currentGame;
            this.totalGames = data.totalGames;
            console.log(`[GAME PROGRESS] Game ${this.currentGameNumber}/${this.totalGames}`);
        }

        // Set result title based on who won this individual game
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

        // Update final score display
        this.updateFinalScoreDisplay();

        if (this.elements.resultTitle) {
            this.elements.resultTitle.textContent = titleText;
            this.elements.resultTitle.className = titleClass;
        }
        if (this.elements.finalYourScore) {
            this.elements.finalYourScore.textContent = this.playerFinalScore;
            console.log(`[DEBUG] Set finalYourScore to: ${this.playerFinalScore}`);
        } else {
            console.log(`[DEBUG] finalYourScore element not found!`);
        }
        if (this.elements.finalOpponentScore) {
            this.elements.finalOpponentScore.textContent = this.opponentFinalScore;
            console.log(`[DEBUG] Set finalOpponentScore to: ${this.opponentFinalScore}`);
        } else {
            console.log(`[DEBUG] finalOpponentScore element not found!`);
        }

        // Check if this was the final game (3 games completed)
        if (this.currentGameNumber >= this.totalGames) {
            console.log(`[FINAL MATCH] All ${this.totalGames} games completed!`);
            this.showFinalMatchResults();
        } else {
            this.showScreen('results');
        }
    }

    resetGame() {
        this.gameState = 'menu';
        this.currentGame = null;
        this.currentGameNumber = 1;

        // Cleanup current game component
        if (this.currentGameComponent && this.currentGameComponent.cleanup) {
            this.currentGameComponent.cleanup();
        }
        this.currentGameComponent = null;

        this.hideCountdown();
        this.hideSearchingState();
        this.resetFindMatchButton();
        this.updateScores(0, 0);
        this.updateGameProgress();

        // Reset game status
        if (this.elements.gameStatus) {
            this.elements.gameStatus.textContent = 'Get Ready!';
        }

        // Clear game area
        this.elements.gameArea.innerHTML = '';
    }

    resetFinalScores() {
        console.log('[FINAL SCORE] Resetting final scores for new match');
        this.playerFinalScore = 0;
        this.opponentFinalScore = 0;
        this.updateFinalScoreDisplay();

        // Hide the final score display when starting fresh
        if (this.elements.finalScoreDisplay) {
            this.elements.finalScoreDisplay.classList.add('hidden');
        }
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

    // NEW: Show the "Match Found!" screen with player names
    showMatchFoundScreen(gameData) {
        // Set player names
        this.elements.yourNameDisplay.textContent = this.playerName;
        this.elements.opponentNameMatch.textContent = gameData.opponent;

        // Show the match found screen
        this.showScreen('match-found');

        // After 3 seconds, show game description
        setTimeout(() => {
            this.showGameDescriptionScreen(gameData);
        }, 3000);
    }

    // NEW: Show the game description screen
    showGameDescriptionScreen(gameData) {
        // Set game information
        this.elements.gameNameDisplay.textContent = gameData.gameName;
        this.elements.gameDescriptionText.textContent = gameData.description;

        // Set game-specific icon
        const gameIcon = document.querySelector('.game-icon');
        if (gameIcon) {
            gameIcon.textContent = this.getGameIcon(gameData.gameType);
        }

        // Show the game description screen
        this.showScreen('game-description');

        // After 3 seconds, proceed to game screen
        setTimeout(() => {
            this.proceedToGameScreen(gameData);
        }, 3000);
    }

    // NEW: Get appropriate icon for each game type
    getGameIcon(gameType) {
        const icons = {
            'tic-tac-toe': 'TTT',
            'rock-paper-scissors': 'RPS',
            'reaction-time': 'RT',
            'whack-a-mole': 'WAM'
        };
        return icons[gameType] || 'GAME';
    }

    // NEW: Proceed to the actual game screen
    proceedToGameScreen(gameData) {
        // Set opponent name for game screen
        this.elements.opponentNameDisplay.textContent = gameData.opponent;

        // Show game screen
        this.showScreen('game');

        // Update game progress when game is found
        this.updateGameProgress();
    }

    resetFindMatchButton() {
        this.elements.findMatchBtn.disabled = false;
        this.elements.findMatchBtn.textContent = 'Find Match';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOM fully loaded, creating ModularQuickGame');
    const game = new ModularQuickGame();

    // Force update after a short delay to ensure DOM is ready
    setTimeout(() => {
        console.log('[DEBUG] Forcing game progress update after DOM load');
        game.updateGameProgress();
    }, 500);
});