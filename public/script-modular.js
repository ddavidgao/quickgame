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
            // Stop game music when returning to menu
            if (window.soundManager) {
                window.soundManager.stopGameMusic();
            }
            this.resetGame();
        } else if (screenName === 'disconnect') {
            // Stop game music when showing disconnect screen
            if (window.soundManager) {
                window.soundManager.stopGameMusic();
            }
        } else if (screenName === 'results') {
            // Clear game area when transitioning to results screen (unless skipGameAreaClear is set)
            console.log('[SHOW SCREEN] Results screen - skipGameAreaClear:', this.skipGameAreaClear);
            if (!this.skipGameAreaClear) {
                console.log('[SHOW SCREEN] Clearing game area');
                this.elements.gameArea.innerHTML = '';
            } else {
                console.log('[SHOW SCREEN] Skipping game area clear - preserving reaction time display');
            }
            // Reset game status
            if (this.elements.gameStatus) {
                this.elements.gameStatus.textContent = 'Game Complete!';
            }
        }
    }

    showCountdown(count) {
        console.log(`[COUNTDOWN] Showing countdown: ${count}`);

        // Play intense music when countdown starts (at 3)
        console.log(`[COUNTDOWN DEBUG] count === 3: ${count === 3}, window.soundManager exists: ${!!window.soundManager}`);
        if (count === 3) {
            if (window.soundManager) {
                console.log(`[COUNTDOWN] Triggering game music for countdown 3`);
                window.soundManager.playGameMusic();
            } else {
                console.error(`[COUNTDOWN] window.soundManager not available!`);
            }
        }

        if (this.elements.countdownDisplay) {
            this.elements.countdownDisplay.classList.remove('hidden');
            const numberElement = this.elements.countdownDisplay.querySelector('.countdown-number');
            if (numberElement) {
                numberElement.textContent = count;
                console.log(`[COUNTDOWN] Set countdown number to: ${count}`);
            } else {
                console.error('[COUNTDOWN] countdown-number element not found!');
            }
        } else {
            console.error('[COUNTDOWN] countdownDisplay element not found!');
        }
    }

    hideCountdown() {
        console.log('[COUNTDOWN] Hiding countdown');
        if (this.elements.countdownDisplay) {
            this.elements.countdownDisplay.classList.add('hidden');
        }
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

        // Determine the overall match winner with more dramatic text
        let matchWinner = '';
        let matchResult = '';

        if (this.playerFinalScore > this.opponentFinalScore) {
            if (this.playerFinalScore === 2 && this.opponentFinalScore === 0) {
                matchWinner = 'PERFECT VICTORY!';
            } else {
                matchWinner = 'MATCH VICTORY!';
            }
            matchResult = 'victory';
        } else if (this.opponentFinalScore > this.playerFinalScore) {
            if (this.opponentFinalScore === 2 && this.playerFinalScore === 0) {
                matchWinner = 'CRUSHING DEFEAT!';
            } else {
                matchWinner = 'MATCH DEFEAT!';
            }
            matchResult = 'lose';
        } else {
            // This happens when sudden death ends in a draw
            matchWinner = 'EPIC DRAW!';
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

        // Hide ready up and rage quit buttons
        if (this.elements.readyUpBtn) {
            this.elements.readyUpBtn.classList.add('hidden');
        }
        if (this.elements.rageQuitBtn) {
            this.elements.rageQuitBtn.classList.add('hidden');
        }

        // Show the return home button
        if (this.elements.mainMenuBtn) {
            this.elements.mainMenuBtn.classList.remove('hidden');
            this.elements.mainMenuBtn.textContent = 'Return Home';
            this.elements.mainMenuBtn.style.fontSize = '1.2rem';
            this.elements.mainMenuBtn.style.backgroundColor = '#4CAF50';
        }

        console.log(`[FINAL MATCH] ${matchWinner} Final score: ${this.playerFinalScore}-${this.opponentFinalScore}`);

        // Show the results screen
        this.showScreen('results');
    }

    endGame(data) {
        // Stop the intense game music when game ends
        if (window.soundManager) {
            window.soundManager.stopGameMusic();
        }

        this.gameState = 'finished';

        // Use match scores from server instead of local tracking
        if (data.matchScores) {
            this.playerFinalScore = data.matchScores.you;
            this.opponentFinalScore = data.matchScores.opponent;
            console.log(`[FINAL SCORE] Server match scores: ${this.playerFinalScore}-${this.opponentFinalScore}`);
            console.log(`[FINAL SCORE] Full match scores data:`, data.matchScores);

            // CHECK FOR 1-1 SUDDEN DEATH TRIGGER!
            if (this.playerFinalScore === 1 && this.opponentFinalScore === 1 && data.currentGame === 2) {
                console.log('[SUDDEN DEATH TRIGGER] Score is 1-1 after game 2! Next game is sudden death!');

                // Show sudden death animation immediately
                setTimeout(() => {
                    this.showSuddenDeathAnimation();
                }, 1000); // Show after results screen appears
            }
        } else {
            console.log(`[FINAL SCORE] No matchScores in data:`, data);
        }

        // Update game progress from server data
        if (data.currentGame && data.totalGames) {
            this.currentGameNumber = data.currentGame;
            this.totalGames = data.totalGames;
            console.log(`[GAME PROGRESS] Game ${this.currentGameNumber}/${this.totalGames}`);
        }

        // Check for reaction time data FIRST and handle completely separately
        console.log('[DEBUG] endGame data received:', data);
        console.log('[DEBUG] Full data structure:', JSON.stringify(data, null, 2));
        console.log('[DEBUG] gameData exists:', !!data.gameData);
        console.log('[DEBUG] gameData content:', data.gameData);
        console.log('[DEBUG] reactionTimes exists:', !!(data.gameData && data.gameData.reactionTimes));
        console.log('[DEBUG] reactionTimes content:', data.gameData ? data.gameData.reactionTimes : 'no gameData');

        if (data.gameData && data.gameData.reactionTimes) {
            console.log('[DEBUG] Showing custom reaction time results - bypassing normal flow');
            this.handleReactionTimeResults(data);
            return; // Completely exit - no normal results
        } else {
            console.log('[DEBUG] No reaction time data found, showing normal results');
            console.log('[DEBUG] data.gameData exists:', !!data.gameData);
            if (data.gameData) {
                console.log('[DEBUG] gameData keys:', Object.keys(data.gameData));
            }
        }

        // NORMAL RESULTS FLOW (non-reaction time games)
        console.log('[DEBUG] Showing normal results - no reaction time data');

        let titleText = '';
        let titleClass = '';

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

        // Update final score display for non-reaction games
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

    // NEW: Handle reaction time results completely separately
    handleReactionTimeResults(data) {
        console.log('[REACTION TIME HANDLER] Data received:', data);
        console.log('[REACTION TIME HANDLER] Game data:', data.gameData);

        // Extract reaction times from the game data
        const reactionTimes = data.gameData.reactionTimes || {};
        const playerIds = Object.keys(reactionTimes);
        console.log('[REACTION TIME HANDLER] Reaction times:', reactionTimes);
        console.log('[REACTION TIME HANDLER] Player IDs:', playerIds);

        // Set result title
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

        // Create custom reaction time display FIRST before showing screen
        this.createReactionTimeDisplay(reactionTimes, data);

        // Set a flag to prevent game area from being cleared in showScreen
        this.skipGameAreaClear = true;

        // Check if this was the final game and show the appropriate screen
        if (this.currentGameNumber >= this.totalGames) {
            console.log(`[FINAL MATCH] All ${this.totalGames} games completed!`);
            this.showFinalMatchResults();
        } else {
            this.showScreen('results');
        }

        // Reset the flag
        this.skipGameAreaClear = false;

        // Update the main result title
        if (this.elements.resultTitle) {
            this.elements.resultTitle.textContent = titleText;
            this.elements.resultTitle.className = titleClass;
        }

        // Update the current game scores at the top (YOUR SCORE: X, OPPONENT SCORE: Y)
        if (data.scores) {
            const yourScore = data.scores[this.socket.id] || 0;
            const opponentScore = Object.keys(data.scores).find(id => id !== this.socket.id);
            const opponentScoreValue = opponentScore ? data.scores[opponentScore] : 0;

            console.log('[REACTION SCORES] Your score:', yourScore, 'Opponent score:', opponentScoreValue);

            // Update the score display elements
            if (this.elements.playerScore) {
                this.elements.playerScore.textContent = yourScore;
            }
            if (this.elements.opponentScore) {
                this.elements.opponentScore.textContent = opponentScoreValue;
            }
        }

        // Hide the normal final score display - we don't want it for reaction time
        if (this.elements.finalScoreDisplay) {
            this.elements.finalScoreDisplay.classList.add('hidden');
        }
    }

    // Create custom reaction time display showing individual times
    createReactionTimeDisplay(reactionTimes, data) {
        console.log('[REACTION DISPLAY] Creating display with times:', reactionTimes);

        const gameArea = this.elements.gameArea;
        console.log('[REACTION DISPLAY] gameArea element:', gameArea);
        console.log('[REACTION DISPLAY] gameArea exists:', !!gameArea);
        if (!gameArea) {
            console.log('[REACTION DISPLAY] ERROR: gameArea not found!');
            return;
        }

        // Get your reaction time and opponent's reaction time
        const yourTime = reactionTimes[this.socket.id];
        const opponentId = Object.keys(reactionTimes).find(id => id !== this.socket.id);
        const opponentTime = opponentId ? reactionTimes[opponentId] : null;

        console.log('[REACTION DISPLAY] Your time:', yourTime, 'Opponent time:', opponentTime);

        // Calculate difference and create analysis
        let analysisText = '';
        let yourTimeText = yourTime ? `${yourTime}ms` : 'Did not click';
        let opponentTimeText = opponentTime ? `${opponentTime}ms` : 'Did not click';

        if (yourTime && opponentTime) {
            const difference = Math.abs(yourTime - opponentTime);
            if (difference < 10) {
                analysisText = `INSANELY CLOSE! Only ${difference}ms difference!`;
            } else if (difference < 25) {
                analysisText = `EXTREMELY CLOSE! ${difference}ms difference!`;
            } else if (difference < 50) {
                analysisText = `CLOSE RACE! ${difference}ms difference`;
            } else {
                analysisText = `${difference}ms difference`;
            }
        } else if (yourTime && !opponentTime) {
            analysisText = 'You clicked, opponent did not!';
        } else if (!yourTime && opponentTime) {
            analysisText = 'Opponent clicked, you did not!';
        } else {
            analysisText = 'Nobody clicked!';
        }

        // Create the custom reaction time display
        console.log('[REACTION DISPLAY] About to set innerHTML...');
        gameArea.innerHTML = `
            <div class="reaction-time-results">
                <div class="reaction-stats">
                    <div class="time-display">
                        <div class="your-time">
                            <div class="label">YOUR TIME</div>
                            <div class="time-value">${yourTimeText}</div>
                        </div>
                        <div class="vs">VS</div>
                        <div class="opponent-time">
                            <div class="label">OPPONENT TIME</div>
                            <div class="time-value">${opponentTimeText}</div>
                        </div>
                    </div>
                    <div class="analysis">
                        ${analysisText}
                    </div>
                </div>
            </div>
        `;
        console.log('[REACTION DISPLAY] innerHTML set! Content now:', gameArea.innerHTML);
        console.log('[REACTION DISPLAY] gameArea children count:', gameArea.children.length);
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
        // Set game information - modify for sudden death
        if (gameData.isSuddenDeath) {
            this.elements.gameNameDisplay.textContent = `${gameData.gameName} - SUDDEN DEATH!`;
            this.elements.gameDescriptionText.textContent = `TIEBREAKER ROUND! Score is 1-1. ${gameData.description} Winner takes the match!`;

            // Update the "Get Ready" text for sudden death
            const getReadyText = document.querySelector('.get-ready-text');
            if (getReadyText) {
                getReadyText.textContent = 'PREPARE FOR SUDDEN DEATH!';
                getReadyText.style.color = '#ff6b6b'; // Red color for urgency
            }
        } else {
            this.elements.gameNameDisplay.textContent = gameData.gameName;
            this.elements.gameDescriptionText.textContent = gameData.description;

            // Reset get ready text
            const getReadyText = document.querySelector('.get-ready-text');
            if (getReadyText) {
                getReadyText.textContent = 'Get Ready!';
                getReadyText.style.color = '#FFD700'; // Reset to gold
            }
        }

        // Set game-specific icon
        const gameIcon = document.querySelector('.game-icon');
        if (gameIcon) {
            gameIcon.textContent = this.getGameIcon(gameData.gameType);
        }

        // Show the game description screen
        this.showScreen('game-description');

        // Check for SUDDEN DEATH and show epic animation!
        if (gameData.isSuddenDeath) {
            console.log('[SUDDEN DEATH] This is the tiebreaker! Showing epic animation!');
            this.showSuddenDeathAnimation();
        }

        // After 6 seconds, proceed to game screen (doubled)
        setTimeout(() => {
            this.proceedToGameScreen(gameData);
        }, 6000);
    }

    // NEW: SUDDEN DEATH Animation - Epic entrance for the tiebreaker!
    showSuddenDeathAnimation() {
        console.log('[SUDDEN DEATH] Starting animation! Image path: images/suddendeath.png');

        // Create the overlay
        const overlay = document.createElement('div');
        overlay.className = 'sudden-death-overlay';

        // Create the image
        const img = document.createElement('img');
        img.src = 'images/suddendeath.png';
        img.className = 'sudden-death-image';
        img.alt = 'SUDDEN DEATH';

        // Add error handling for the image
        img.onload = () => {
            console.log('[SUDDEN DEATH] Image loaded successfully!');
        };
        img.onerror = () => {
            console.error('[SUDDEN DEATH] Failed to load image: images/suddendeath.png');
            console.log('[SUDDEN DEATH] Trying fallback text...');
            img.style.display = 'none';
            overlay.innerHTML = '<div style="color: red; font-size: 4rem; font-weight: bold; text-shadow: 0 0 20px red;">SUDDEN DEATH!</div>';
        };

        overlay.appendChild(img);
        document.body.appendChild(overlay);

        console.log('[SUDDEN DEATH] Overlay added to DOM, animation should start');

        // Remove the overlay after animation completes
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
                console.log('[SUDDEN DEATH] Animation overlay removed');
            }
        }, 4000); // Match the animation duration

        console.log('[SUDDEN DEATH] Epic animation displayed! The stakes are HIGH!');
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
        // RESET ALL GAME STATE BEFORE NEW GAME
        this.resetGameState();

        // Set opponent name for game screen
        this.elements.opponentNameDisplay.textContent = gameData.opponent;

        // Show game screen
        this.showScreen('game');

        // Update game progress when game is found
        this.updateGameProgress();

        // Tell server we're ready for countdown (after game screen is fully loaded)
        console.log('[CLIENT READY] Game screen loaded, telling server ready for countdown');
        this.socket.emit('ready-for-countdown');
    }

    // NEW: Reset all game state between games
    resetGameState() {
        console.log('[GAME RESET] Resetting all game state for new game');

        // Reset timer display to default
        if (this.elements.gameTimer) {
            this.elements.gameTimer.textContent = '30';
            this.elements.gameTimer.style.color = '#ffffff';
            this.elements.gameTimer.style.animation = '';
            this.elements.gameTimer.style.fontWeight = '';
            this.elements.gameTimer.style.transform = '';
        }

        // Reset game status
        if (this.elements.gameStatus) {
            this.elements.gameStatus.textContent = 'Get Ready!';
            this.elements.gameStatus.style.color = '#ffffff';
        }

        // Clear game area completely
        if (this.elements.gameArea) {
            this.elements.gameArea.innerHTML = '';
        }

        // Cleanup current game component if exists
        if (this.currentGameComponent && this.currentGameComponent.cleanup) {
            this.currentGameComponent.cleanup();
        }
        this.currentGameComponent = null;

        // Ensure countdown is ready (hidden but available)
        this.hideCountdown();

        // Ensure countdown display element is properly initialized
        if (this.elements.countdownDisplay) {
            const numberElement = this.elements.countdownDisplay.querySelector('.countdown-number');
            if (numberElement) {
                numberElement.textContent = '3'; // Reset to initial state
            }
        }

        console.log('[GAME RESET] Game state reset complete - ready for countdown');
    }

    resetFindMatchButton() {
        this.elements.findMatchBtn.disabled = false;
        this.elements.findMatchBtn.textContent = 'Find Match';
    }

    // NEW: Show engaging reaction time results with large, non-pixel fonts
    showReactionTimeResults(data) {
        console.log('[REACTION TIME] Showing detailed reaction time results');
        console.log('[REACTION TIME] Data received:', data);

        const reactionTimes = data.gameData.reactionTimes || {};
        const playerIds = Object.keys(reactionTimes);
        const fastestTime = data.gameData.fastestTime;
        const onlyOneClicked = data.gameData.onlyOneClicked;
        const noClicks = data.gameData.noClicks;

        let titleText = '';
        let titleClass = '';

        // Determine the title based on results
        if (noClicks) {
            titleText = 'Nobody Clicked!';
            titleClass = 'draw';
        } else if (onlyOneClicked) {
            titleText = data.winner ? 'You Win!' : 'You Lose!';
            titleClass = data.winner ? '' : 'lose';
        } else {
            titleText = data.winner ? 'You Win!' : 'You Lose!';
            titleClass = data.winner ? '' : 'lose';
        }

        // Update the main result title for reaction time results
        if (this.elements.resultTitle) {
            this.elements.resultTitle.textContent = titleText;
            this.elements.resultTitle.className = titleClass;
        }

        // Create detailed reaction time display
        const gameArea = this.elements.gameArea;
        if (gameArea) {
            const yourTime = reactionTimes[this.socket.id];
            const opponentTime = this.getOpponentReactionTime(reactionTimes, this.socket.id);
            const difference = yourTime && opponentTime ? Math.abs(yourTime - opponentTime) : 0;

            // Create dramatic messages based on how close it was
            let closenessMessage = '';
            let closenessClass = '';
            if (difference > 0) {
                if (difference < 10) {
                    closenessMessage = 'INSANELY CLOSE!';
                    closenessClass = 'ultra-close';
                } else if (difference < 25) {
                    closenessMessage = 'EXTREMELY CLOSE!';
                    closenessClass = 'very-close';
                } else if (difference < 50) {
                    closenessMessage = 'CLOSE RACE!';
                    closenessClass = 'close';
                } else if (difference < 100) {
                    closenessMessage = 'Good reaction!';
                    closenessClass = 'good';
                } else {
                    closenessMessage = 'Wide margin...';
                    closenessClass = 'wide';
                }
            }

            gameArea.innerHTML = `
                <div class="reaction-results-container">
                    <h2 class="reaction-results-title">REACTION SHOWDOWN</h2>

                    ${!noClicks ? `
                        <div class="competition-message ${closenessClass}">
                            ${closenessMessage}
                        </div>

                        <div class="reaction-times-display">
                            <div class="reaction-time-player ${yourTime === fastestTime ? 'winner' : 'loser'}">
                                <div class="player-label">YOU</div>
                                <div class="reaction-time-number">${yourTime ? yourTime + 'ms' : 'NO CLICK'}</div>
                                <div class="performance-rating">${this.getPerformanceRating(yourTime)}</div>
                                ${yourTime === fastestTime ? '<div class="fastest-indicator">CHAMPION!</div>' : ''}
                            </div>

                            <div class="vs-divider">
                                <div class="margin-display">${difference > 0 ? `${difference}ms` : ''}</div>
                                <div class="vs-text">VS</div>
                            </div>

                            <div class="reaction-time-player ${opponentTime === fastestTime ? 'winner' : 'loser'}">
                                <div class="player-label">OPPONENT</div>
                                <div class="reaction-time-number">${opponentTime ? opponentTime + 'ms' : 'NO CLICK'}</div>
                                <div class="performance-rating">${this.getPerformanceRating(opponentTime)}</div>
                                ${opponentTime === fastestTime ? '<div class="fastest-indicator">CHAMPION!</div>' : ''}
                            </div>
                        </div>

                        ${fastestTime && !onlyOneClicked ? `
                            <div class="victory-stats">
                                <div class="winning-time-label">Lightning Fast Time:</div>
                                <div class="winning-time-number">${fastestTime}ms</div>
                                ${difference > 0 ? `<div class="margin-of-victory">Won by ${difference}ms!</div>` : ''}
                            </div>
                        ` : ''}
                    ` : `
                        <div class="no-clicks-message">
                            <div class="no-clicks-text">Nobody clicked after GREEN!</div>
                            <div class="no-clicks-subtext">Were you both asleep?</div>
                        </div>
                    `}
                </div>
            `;
        }

        // Update final scores as normal
        this.updateFinalScoreDisplay();

        // Show results screen
        this.showScreen('results');

        // Hide the normal scores section for reaction time since we have detailed display
        if (this.elements.finalYourScore) {
            this.elements.finalYourScore.parentElement.style.display = 'none';
        }
    }

    // Helper function to get opponent's reaction time
    getOpponentReactionTime(reactionTimes, yourSocketId) {
        const opponentTime = Object.entries(reactionTimes).find(([id, time]) => id !== yourSocketId);
        return opponentTime ? opponentTime[1] : null;
    }

    // Helper function to calculate and display time difference
    calculateTimeDifference(reactionTimes, fastestTime) {
        const times = Object.values(reactionTimes);
        if (times.length === 2) {
            const difference = Math.abs(times[0] - times[1]);
            return `<div class="time-difference">Difference: ${difference}ms</div>`;
        }
        return '';
    }

    // Helper function to get performance rating based on reaction time
    getPerformanceRating(reactionTime) {
        if (!reactionTime) return '';

        if (reactionTime < 150) return 'LIGHTNING!';
        if (reactionTime < 200) return 'SUPERFAST!';
        if (reactionTime < 250) return 'EXCELLENT!';
        if (reactionTime < 300) return 'GREAT!';
        if (reactionTime < 400) return 'GOOD!';
        if (reactionTime < 500) return 'AVERAGE';
        if (reactionTime < 600) return 'SLOW...';
        return 'SLEEPY...';
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