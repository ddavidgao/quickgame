import { BaseGame, GameConfig, GameData, GameResult, Player } from "../game-interface";

export class TicTacToeGame extends BaseGame {
  config: GameConfig = {
    id: "tic-tac-toe",
    name: "Tic Tac Toe",
    description: "Classic 3x3 grid game - get three in a row!",
    minPlayers: 2,
    maxPlayers: 2,
    duration: 60000,
    category: "strategy"
  };

  initializeGameData(): GameData {
    return {
      board: Array(9).fill(null),
      currentPlayer: 0,
      moves: 0,
      playerSymbols: ["X", "O"]
    };
  }

  protected onGameStart(): void {
    this.emitToPlayers("game-start", {
      gameType: this.config.id,
      gameData: this.getClientGameData()
    });
  }

  handlePlayerAction(playerId: string, action: any): void {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    const { position } = action;

    // Validate move
    if (
      playerIndex !== this.gameData.currentPlayer ||
      position < 0 ||
      position >= 9 ||
      this.gameData.board[position] !== null
    ) {
      return;
    }

    // Make move
    this.gameData.board[position] = this.gameData.playerSymbols[playerIndex];
    this.gameData.currentPlayer = 1 - this.gameData.currentPlayer;
    this.gameData.moves++;

    // Broadcast update
    this.emitToPlayers("game-update", {
      board: this.gameData.board,
      currentPlayer: this.gameData.currentPlayer
    });

    // Check for game end
    const result = this.checkGameEnd();
    if (result) {
      setTimeout(() => this.endGame(), 100);
    }
  }

  checkGameEnd(): GameResult | null {
    const board = this.gameData.board;
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6] // diagonals
    ];

    // Check for winner
    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        const symbol = board[a];
        const playerIndex = this.gameData.playerSymbols.indexOf(symbol);
        const winnerId = this.players[playerIndex].id;

        const scores: { [playerId: string]: number } = {};
        this.players.forEach((player, idx) => {
          scores[player.id] = idx === playerIndex ? 1 : 0;
        });

        return {
          winnerId,
          isDraw: false,
          scores,
          gameData: {
            winningPattern: pattern,
            winningSymbol: symbol
          }
        };
      }
    }

    // Check for draw
    if (this.gameData.moves === 9) {
      const scores: { [playerId: string]: number } = {};
      this.players.forEach(player => {
        scores[player.id] = 0;
      });

      return {
        isDraw: true,
        scores
      };
    }

    return null;
  }

  getClientGameData(): any {
    return {
      board: this.gameData.board,
      currentPlayer: this.gameData.currentPlayer,
      playerSymbols: this.gameData.playerSymbols
    };
  }
}