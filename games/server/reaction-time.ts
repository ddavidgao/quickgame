// =====================================================
// REACTION TIME GAME - Speed & Reflex Challenge
// =====================================================
// Game Logic: Players wait for a red light to turn green, then click as fast as possible
// The first player to click after the green light wins
// Tests reaction time and creates exciting competitive moments

import { BaseGame, GameConfig, GameData, GameResult, Player } from "../game-interface";

export class ReactionTimeGame extends BaseGame {
  // Game configuration - defines how this game behaves
  config: GameConfig = {
    id: "reaction-time",                                      // Unique identifier
    name: "Reaction Time",                                    // Display name
    description: "Click as fast as you can when the light turns green!",  // Instructions
    minPlayers: 2,                                           // Exactly 2 players required
    maxPlayers: 2,
    duration: 10000,                                         // 10 seconds max (usually ends much faster)
    category: "reaction"                                     // Game category for grouping
  };

  // Private timer for the signal delay
  private reactionTimeout?: NodeJS.Timeout;

  // ===== GAME INITIALIZATION =====

  // Set up the initial game state
  initializeGameData(): GameData {
    return {
      startSignal: false,                                   // Whether the green light is showing
      reactionDelay: Math.random() * 3000 + 2000,         // Random delay: 2-5 seconds before green light
      playerClicks: {}                                     // Store when each player clicked
    };
  }

  // ===== GAME START LOGIC =====

  // Called when the game begins (after countdown)
  protected onGameStart(): void {
    // Tell both players the game started and they should wait for green
    this.emitToPlayers("game-start", {
      gameType: this.config.id,
      gameData: this.getClientGameData()
    });

    // Set up the green light signal after the random delay
    this.reactionTimeout = setTimeout(() => {
      // Only trigger if game is still running (player might have disconnected)
      if (this.state === "playing") {
        this.gameData.startSignal = true;        // Mark that green light is now on
        this.emitToPlayers("start-signal", {});  // Tell clients to show green light
      }
    }, this.gameData.reactionDelay);  // Wait the random delay before showing green
  }

  // ===== PLAYER ACTION HANDLING =====

  // Handle player clicks
  handlePlayerAction(playerId: string, action: any): void {
    // Ignore clicks if:
    // 1. Green light hasn't appeared yet, OR
    // 2. This player already clicked
    if (!this.gameData.startSignal || this.gameData.playerClicks[playerId]) {
      return;
    }

    // Record exactly when this player clicked
    this.gameData.playerClicks[playerId] = Date.now();

    // Give this player 1 point for clicking
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.score = 1;
    }

    // End the game immediately - first click wins
    this.endGame();
  }

  // ===== GAME END LOGIC =====

  // Determine who won when the game ends
  checkGameEnd(): GameResult | null {
    const clickedPlayers = Object.keys(this.gameData.playerClicks);

    // If anyone clicked after the green light
    if (clickedPlayers.length > 0) {
      // Find the fastest player (earliest timestamp)
      let fastestPlayerId = clickedPlayers[0];
      let fastestTime = this.gameData.playerClicks[fastestPlayerId];

      // Check all players who clicked to find the fastest
      for (const playerId of clickedPlayers) {
        if (this.gameData.playerClicks[playerId] < fastestTime) {
          fastestTime = this.gameData.playerClicks[playerId];
          fastestPlayerId = playerId;
        }
      }

      // Create score object: winner gets 1, loser gets 0
      const scores: { [playerId: string]: number } = {};
      this.players.forEach(player => {
        scores[player.id] = player.id === fastestPlayerId ? 1 : 0;
      });

      return {
        winnerId: fastestPlayerId,
        isDraw: false,
        scores,
        gameData: {
          reactionTimes: this.gameData.playerClicks  // Include reaction time data
        }
      };
    }

    // No one clicked after green light appeared - it's a draw
    const scores: { [playerId: string]: number } = {};
    this.players.forEach(player => {
      scores[player.id] = 0;  // Both players get 0 points
    });

    return {
      isDraw: true,
      scores
    };
  }

  // ===== CLIENT DATA =====

  // Get data to send to players (instructions and current state)
  getClientGameData(): any {
    return {
      instruction: this.gameData.startSignal ? "CLICK NOW!" : "Wait for GREEN..."
    };
  }

  // ===== CLEANUP =====

  // Clean up any timers when game ends or player disconnects
  cleanup(): void {
    if (this.reactionTimeout) {
      clearTimeout(this.reactionTimeout);  // Cancel the green light timer
    }
  }
}