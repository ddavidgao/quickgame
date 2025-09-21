// =====================================================
// TIC TAC TOE GAME - Classic Strategy Game
// =====================================================
// Game Logic: Traditional 3x3 grid where players take turns placing X and O
// Goal: Get three of your symbols in a row (horizontal, vertical, or diagonal)
// Turn-based gameplay with win detection and draw handling

import { BaseGame, GameConfig, GameData, GameResult, Player } from "../game-interface";

export class TicTacToeGame extends BaseGame {
  // Game configuration - defines how this game behaves
  config: GameConfig = {
    id: "tic-tac-toe",                                    // Unique identifier
    name: "Tic Tac Toe",                                 // Display name
    description: "Classic 3x3 grid game - get three in a row!",  // Instructions
    minPlayers: 2,                                       // Exactly 2 players required
    maxPlayers: 2,
    duration: 30000,                                     // 30 seconds max
    category: "strategy"                                 // Strategy game category
  };

  // ===== GAME INITIALIZATION =====

  // Set up the initial game state
  initializeGameData(): GameData {
    return {
      board: Array(9).fill(null),      // 3x3 grid represented as array of 9 cells (null = empty)
      currentPlayer: 0,                 // Index of player whose turn it is (0 or 1)
      moves: 0,                         // Total number of moves made (for draw detection)
      playerSymbols: ["X", "O"]         // Player 0 = X, Player 1 = O
    };
  }

  // ===== GAME START LOGIC =====

  // Called when the game begins (after countdown)
  protected onGameStart(): void {
    // Tell each player individually what their player index is
    this.players.forEach((player, playerIndex) => {
      this.emitToPlayer(player.id, "game-start", {
        gameType: this.config.id,
        gameData: this.getClientGameData(),
        playerIndex: playerIndex  // 0 for first player (X), 1 for second player (O)
      });
    });
  }

  // ===== PLAYER ACTION HANDLING =====

  // Handle player moves (placing X or O on the board)
  handlePlayerAction(playerId: string, action: any): void {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    const { position } = action;  // Which cell they want to place their symbol in (0-8)

    // Validate the move - reject if:
    // 1. It's not this player's turn, OR
    // 2. Position is invalid (outside 0-8 range), OR
    // 3. Cell is already occupied
    if (
      playerIndex !== this.gameData.currentPlayer ||  // Not their turn
      position < 0 ||                                  // Invalid position
      position >= 9 ||                                 // Invalid position
      this.gameData.board[position] !== null           // Cell already taken
    ) {
      return;  // Ignore invalid moves
    }

    // Make the move
    this.gameData.board[position] = this.gameData.playerSymbols[playerIndex];  // Place X or O
    this.gameData.currentPlayer = 1 - this.gameData.currentPlayer;            // Switch turns (0->1, 1->0)
    this.gameData.moves++;                                                     // Increment move counter

    // Send updated board state to both players
    this.emitToPlayers("game-update", {
      board: this.gameData.board,
      currentPlayer: this.gameData.currentPlayer
    });

    // Check if the game ended (win or draw)
    const result = this.checkGameEnd();
    if (result) {
      // Mark the game as finished so server can detect it
      this.state = "finished";
    }
  }

  // ===== GAME END LOGIC =====

  // Check if the game has ended (win or draw)
  checkGameEnd(): GameResult | null {
    const board = this.gameData.board;

    // All possible winning combinations on a 3x3 grid
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows (horizontal)
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns (vertical)
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];

    // Check each winning pattern to see if someone won
    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;

      // If all three positions have the same symbol (and it's not empty)
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        const symbol = board[a];  // The winning symbol (X or O)
        const playerIndex = this.gameData.playerSymbols.indexOf(symbol);  // Which player owns this symbol
        const winnerId = this.players[playerIndex].id;

        // Create score object: winner gets 1, loser gets 0
        const scores: { [playerId: string]: number } = {};
        this.players.forEach((player, idx) => {
          scores[player.id] = idx === playerIndex ? 1 : 0;
        });

        return {
          winnerId,
          isDraw: false,
          scores,
          gameData: {
            winningPattern: pattern,    // Which cells formed the winning line
            winningSymbol: symbol       // X or O
          }
        };
      }
    }

    // Check for draw (all 9 cells filled, no winner)
    if (this.gameData.moves === 9) {
      const scores: { [playerId: string]: number } = {};
      this.players.forEach(player => {
        scores[player.id] = 0;  // Both players get 0 points in a draw
      });

      return {
        isDraw: true,
        scores
      };
    }

    return null;  // Game is still ongoing
  }

  // ===== CLIENT DATA =====

  // Get game state data to send to players
  getClientGameData(): any {
    return {
      board: this.gameData.board,                   // Current board state (array of X, O, or null)
      currentPlayer: this.gameData.currentPlayer,   // Whose turn it is (0 or 1)
      playerSymbols: this.gameData.playerSymbols    // Which symbol each player uses ["X", "O"]
    };
  }
}