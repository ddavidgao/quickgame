class QuickGame {
    constructor() {
        this.socket = io();
        this.playerName = '';
        this.currentGame = null;
        this.gameState = 'menu';

        this.initializeElements();
        this.bindEvents();
        this.bindSocketEvents();
    }

    initializeElements() {
        this.elements = {
            menuScreen: document.getElementById('menu-screen'),
            gameScreen: document.getElementById('game-screen'),
            resultsScreen: document.getElementById('results-screen'),
            disconnectScreen: document.getElementById('disconnect-screen'),

            playerNameInput: document.getElementById('player-name'),
            findMatchBtn: document.getElementById('find-match-btn'),
            queueStatus: document.getElementById('queue-status'),
            cancelQueueBtn: document.getElementById('cancel-queue-btn'),

            playerNameDisplay: document.getElementById('player-name-display'),
            opponentNameDisplay: document.getElementById('opponent-name-display'),
            playerScore: document.getElementById('player-score'),
            opponentScore: document.getElementById('opponent-score'),
            gameTimer: document.getElementById('game-timer'),
            countdownDisplay: document.getElementById('countdown-display'),

            gameArea: document.getElementById('game-area'),
            reactionGame: document.getElementById('reaction-game'),
            tictactoeGame: document.getElementById('tictactoe-game'),
            rpsGame: document.getElementById('rps-game'),
            whackmoleGame: document.getElementById('whackmole-game'),

            playAgainBtn: document.getElementById('play-again-btn'),
            mainMenuBtn: document.getElementById('main-menu-btn'),
            disconnectMenuBtn: document.getElementById('disconnect-menu-btn'),

            resultTitle: document.getElementById('result-title'),
            finalYourScore: document.getElementById('final-your-score'),
            finalOpponentScore: document.getElementById('final-opponent-score')
        };
    }

    bindEvents() {
        this.elements.findMatchBtn.addEventListener('click', () => this.findMatch());
        this.elements.cancelQueueBtn.addEventListener('click', () => this.cancelQueue());
        this.elements.playAgainBtn.addEventListener('click', () => this.findMatch());
        this.elements.mainMenuBtn.addEventListener('click', () => this.showScreen('menu'));
        this.elements.disconnectMenuBtn.addEventListener('click', () => this.showScreen('menu'));

        this.elements.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.findMatch();
        });

        this.bindGameEvents();
    }

    bindGameEvents() {
        const reactionZone = document.getElementById('reaction-zone');
        reactionZone.addEventListener('click', () => this.handleReactionClick());

        const tttCells = document.querySelectorAll('.cell');
        tttCells.forEach((cell, index) => {
            cell.addEventListener('click', () => this.handleTicTacToeMove(index));
        });

        const rpsChoices = document.querySelectorAll('.rps-choice');
        rpsChoices.forEach(choice => {
            choice.addEventListener('click', () => this.handleRPSChoice(choice.dataset.choice));
        });

        const moleHoles = document.querySelectorAll('.mole-hole');
        moleHoles.forEach((hole, index) => {
            hole.addEventListener('click', () => this.handleWhackMole(index));
        });
    }

    bindSocketEvents() {
        this.socket.on('waiting-for-opponent', (data) => {
            this.elements.queueStatus.classList.remove('hidden');
        });

        this.socket.on('game-found', (data) => {
            this.currentGame = data;
            this.elements.opponentNameDisplay.textContent = data.opponent;
            this.showScreen('game');
            this.elements.queueStatus.classList.add('hidden');
        });

        this.socket.on('countdown', (count) => {
            this.showCountdown(count);
        });

        this.socket.on('game-start', (data) => {
            this.hideCountdown();
            this.startGame(data.gameType, data.gameData);
        });

        this.socket.on('game-update', (data) => {
            this.handleGameUpdate(data);
        });

        this.socket.on('start-signal', () => {
            this.handleStartSignal();
        });

        this.socket.on('mole-appears', (data) => {
            this.showMole(data.position);
        });

        this.socket.on('score-update', (data) => {
            this.updateScores(data.scores[0], data.scores[1]);
        });

        this.socket.on('round-result', (data) => {
            this.showRPSResult(data);
        });

        this.socket.on('game-end', (data) => {
            this.endGame(data);
        });

        this.socket.on('opponent-disconnected', () => {
            this.showScreen('disconnect');
        });

        this.socket.on('left-queue', () => {
            this.elements.queueStatus.classList.add('hidden');
        });
    }

    findMatch() {
        this.playerName = this.elements.playerNameInput.value.trim() || 'Anonymous';
        this.elements.playerNameDisplay.textContent = this.playerName;
        this.socket.emit('join-queue', this.playerName);
    }

    cancelQueue() {
        this.socket.emit('leave-queue');
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
        this.hideAllGames();

        switch (gameType) {
            case 'reaction-time':
                this.startReactionGame();
                break;
            case 'tic-tac-toe':
                this.startTicTacToeGame(gameData);
                break;
            case 'rock-paper-scissors':
                this.startRPSGame();
                break;
            case 'whack-a-mole':
                this.startWhackMoleGame();
                break;
        }
    }

    hideAllGames() {
        document.querySelectorAll('.game-type').forEach(game => {
            game.classList.add('hidden');
        });
    }

    startReactionGame() {
        this.elements.reactionGame.classList.remove('hidden');
        const signalLight = document.getElementById('signal-light');
        const instruction = document.getElementById('reaction-instruction');

        signalLight.classList.remove('green');
        signalLight.classList.add('red');
        instruction.textContent = 'Wait for GREEN...';
    }

    handleReactionClick() {
        if (this.gameState !== 'playing') return;

        const signalLight = document.getElementById('signal-light');
        if (signalLight.classList.contains('green')) {
            this.socket.emit('game-action', { type: 'click' });
            document.getElementById('reaction-instruction').textContent = 'Clicked!';
        }
    }

    handleStartSignal() {
        const signalLight = document.getElementById('signal-light');
        const instruction = document.getElementById('reaction-instruction');

        signalLight.classList.remove('red');
        signalLight.classList.add('green');
        instruction.textContent = 'CLICK NOW!';
    }

    startTicTacToeGame(gameData) {
        this.elements.tictactoeGame.classList.remove('hidden');
        this.updateTicTacToeBoard(gameData.board);
        this.updateTicTacToeStatus(gameData.currentPlayer);
    }

    updateTicTacToeBoard(board) {
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            cell.textContent = board[index] || '';
            cell.classList.toggle('disabled', !!board[index]);
        });
    }

    updateTicTacToeStatus(currentPlayer) {
        const status = document.getElementById('ttt-status');
        const symbol = currentPlayer === 0 ? 'X' : 'O';
        const isYourTurn = currentPlayer === 0; // Assuming player 0 is always the current user

        status.textContent = isYourTurn ? `Your turn (${symbol})` : `Opponent's turn (${symbol})`;
    }

    handleTicTacToeMove(position) {
        if (this.gameState !== 'playing') return;

        const cell = document.querySelector(`.cell[data-index="${position}"]`);
        if (!cell.classList.contains('disabled')) {
            this.socket.emit('game-action', { position });
        }
    }

    handleGameUpdate(data) {
        if (data.board) {
            this.updateTicTacToeBoard(data.board);
            this.updateTicTacToeStatus(data.currentPlayer);
        }
    }

    startRPSGame() {
        this.elements.rpsGame.classList.remove('hidden');
        this.resetRPSChoices();
        document.getElementById('rps-status').textContent = 'Choose your weapon!';
        document.getElementById('rps-results').classList.add('hidden');
    }

    resetRPSChoices() {
        document.querySelectorAll('.rps-choice').forEach(choice => {
            choice.disabled = false;
        });
    }

    handleRPSChoice(choice) {
        if (this.gameState !== 'playing') return;

        this.socket.emit('game-action', { choice });

        document.querySelectorAll('.rps-choice').forEach(btn => {
            btn.disabled = true;
        });

        document.getElementById('rps-status').textContent = 'Waiting for opponent...';
    }

    showRPSResult(data) {
        document.getElementById('your-choice').textContent = data.yourChoice.toUpperCase();
        document.getElementById('opponent-choice').textContent = data.opponentChoice.toUpperCase();
        document.getElementById('rps-results').classList.remove('hidden');

        let resultText = '';
        if (data.winner === 'you') resultText = 'You won this round!';
        else if (data.winner === 'opponent') resultText = 'Opponent won this round!';
        else resultText = 'This round is a draw!';

        document.getElementById('rps-status').textContent = resultText;

        this.updateScores(data.scores[0], data.scores[1]);

        setTimeout(() => {
            if (this.gameState === 'playing') {
                this.resetRPSChoices();
                document.getElementById('rps-status').textContent = 'Choose your weapon!';
                document.getElementById('rps-results').classList.add('hidden');
            }
        }, 2000);
    }

    startWhackMoleGame() {
        this.elements.whackmoleGame.classList.remove('hidden');
        this.clearMoles();
        this.updateScores(0, 0);
    }

    clearMoles() {
        document.querySelectorAll('.mole-hole').forEach(hole => {
            hole.classList.remove('active');
        });
    }

    showMole(position) {
        this.clearMoles();
        const hole = document.querySelector(`.mole-hole[data-position="${position}"]`);
        if (hole) {
            hole.classList.add('active');

            setTimeout(() => {
                hole.classList.remove('active');
            }, 1500);
        }
    }

    handleWhackMole(position) {
        if (this.gameState !== 'playing') return;

        const hole = document.querySelector(`.mole-hole[data-position="${position}"]`);
        if (hole && hole.classList.contains('active')) {
            this.socket.emit('game-action', { position });
            hole.classList.remove('active');
        }
    }

    updateScores(playerScore, opponentScore) {
        this.elements.playerScore.textContent = playerScore;
        this.elements.opponentScore.textContent = opponentScore;
    }

    endGame(data) {
        this.gameState = 'finished';

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

        this.elements.resultTitle.textContent = titleText;
        this.elements.resultTitle.className = titleClass;
        this.elements.finalYourScore.textContent = data.finalScores.you;
        this.elements.finalOpponentScore.textContent = data.finalScores.opponent;

        setTimeout(() => {
            this.showScreen('results');
        }, 2000);
    }

    resetGame() {
        this.gameState = 'menu';
        this.currentGame = null;
        this.hideAllGames();
        this.hideCountdown();
        this.elements.queueStatus.classList.add('hidden');
        this.updateScores(0, 0);

        const tttCells = document.querySelectorAll('.cell');
        tttCells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('disabled');
        });

        this.clearMoles();
        this.resetRPSChoices();

        const signalLight = document.getElementById('signal-light');
        signalLight.classList.remove('green');
        signalLight.classList.add('red');
        document.getElementById('reaction-instruction').textContent = 'Wait for GREEN...';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new QuickGame();
});