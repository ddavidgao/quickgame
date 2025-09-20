// =====================================================
// WHACK A MOLE GAME - Fast-Clicking Competition
// =====================================================
// Game Logic: Moles appear randomly in a 3x3 grid for 1.5 seconds each
// Players compete to click the most moles within the time limit
// Requires quick reflexes and mouse accuracy

import { BaseGame, GameConfig, GameData, GameResult, Player } from "../game-interface";

export class WhackAMoleGame extends BaseGame {
  // Game configuration - defines how this game behaves
  config: GameConfig = {
    id: "whack-a-mole",                                     // Unique identifier
    name: "Whack a Mole",                                   // Display name
    description: "Click the moles as fast as you can! Most hits wins!",  // Instructions
    minPlayers: 2,                                          // Exactly 2 players required
    maxPlayers: 2,
    duration: 10000,                                        // 10 seconds of gameplay
    category: "reaction"                                    // Reaction-based game category
  };

  private moleInterval?: NodeJS.Timeout;
  private gameTimeout?: NodeJS.Timeout;

  initializeGameData(): GameData {
    return {
      moles: Array(9).fill(false),
      activeMole: -1,
      scores: [0, 0],
      hits: []
    };
  }

  protected onGameStart(): void {
    this.emitToPlayers("game-start", {
      gameType: this.config.id,
      gameData: this.getClientGameData()
    });

    this.startMoleSequence();
  }

  private startMoleSequence(): void {
    this.moleInterval = setInterval(() => {
      if (this.state !== "playing") {
        return;
      }

      // Hide current mole
      if (this.gameData.activeMole !== -1) {
        this.gameData.moles[this.gameData.activeMole] = false;
      }

      // Show new mole
      const randomMole = Math.floor(Math.random() * 9);
      this.gameData.activeMole = randomMole;
      this.gameData.moles[randomMole] = true;

      this.emitToPlayers("mole-appears", { position: randomMole });

      // Hide mole after 1.5 seconds
      setTimeout(() => {
        if (this.gameData.activeMole === randomMole) {
          this.gameData.moles[randomMole] = false;
          this.gameData.activeMole = -1;
          this.emitToPlayers("mole-disappears", { position: randomMole });
        }
      }, 1500);
    }, 2000);

    // End game after duration
    this.gameTimeout = setTimeout(() => {
      this.cleanup();
      this.endGame();
    }, this.config.duration);
  }

  handlePlayerAction(playerId: string, action: any): void {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    const { position } = action;

    // Check if hit is valid
    if (
      position === this.gameData.activeMole &&
      this.gameData.moles[position]
    ) {
      // Valid hit
      this.gameData.scores[playerIndex]++;
      this.players[playerIndex].score = this.gameData.scores[playerIndex];

      // Hide the mole immediately
      this.gameData.moles[position] = false;
      this.gameData.activeMole = -1;

      // Record the hit
      this.gameData.hits.push({
        playerId,
        position,
        timestamp: Date.now()
      });

      // Broadcast score update
      this.emitToPlayers("score-update", {
        scores: this.gameData.scores,
        hitBy: playerIndex
      });

      this.emitToPlayers("mole-hit", { position, playerId });
    }
  }

  checkGameEnd(): GameResult | null {
    const scores: { [playerId: string]: number } = {};
    let winnerId: string | undefined;

    if (this.gameData.scores[0] > this.gameData.scores[1]) {
      winnerId = this.players[0].id;
    } else if (this.gameData.scores[1] > this.gameData.scores[0]) {
      winnerId = this.players[1].id;
    }

    this.players.forEach((player, idx) => {
      scores[player.id] = this.gameData.scores[idx];
    });

    return {
      winnerId,
      isDraw: !winnerId,
      scores,
      gameData: {
        finalScores: this.gameData.scores,
        totalHits: this.gameData.hits.length,
        hits: this.gameData.hits
      }
    };
  }

  getClientGameData(): any {
    return {
      scores: this.gameData.scores,
      duration: this.config.duration
    };
  }

  cleanup(): void {
    if (this.moleInterval) {
      clearInterval(this.moleInterval);
    }
    if (this.gameTimeout) {
      clearTimeout(this.gameTimeout);
    }
  }
}