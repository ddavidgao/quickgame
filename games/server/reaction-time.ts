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
    duration: 15000,                                         // 15 seconds total for entire game
    category: "reaction"                                     // Game category for grouping
  };

  // Private timer for the signal delay
  private reactionTimeout?: NodeJS.Timeout;

  // ===== GAME INITIALIZATION =====

  // Set up the initial game state
  initializeGameData(): GameData {
    return {
      startSignal: false,                                   // Whether the green light is showing
      reactionDelay: Math.random() * 4000 + 4000,         // Random delay: 4-8 seconds before green light
      playerClicks: {},                                    // Store when each player clicked
      greenLightStartTime: 0,                              // When the green light appeared
      bothPlayersClicked: false,                           // Track if both players have clicked
      resultsDelay: 5000                                   // 5 second delay before showing results
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
        playerIndex: playerIndex  // 0 for first player, 1 for second player
      });
    });

    // Set up the green light signal after the random delay
    this.reactionTimeout = setTimeout(() => {
      // Only trigger if game is still running (player might have disconnected)
      if (this.state === "playing") {
        this.gameData.startSignal = true;                     // Mark that green light is now on
        this.gameData.greenLightStartTime = Date.now();       // Record exactly when green light appeared
        this.emitToPlayers("start-signal", {});               // Tell clients to show green light
        console.log(`[REACTION TIME] Green light appeared at: ${this.gameData.greenLightStartTime}`);
      }
    }, this.gameData.reactionDelay);  // Wait the random delay before showing green
  }

  // ===== PLAYER ACTION HANDLING =====

  // Handle player clicks
  handlePlayerAction(playerId: string, action: any): void {
    // Ignore clicks if:
    // 1. Green light hasn't appeared yet, OR
    // 2. This player already clicked, OR
    // 3. Both players already clicked
    if (!this.gameData.startSignal || this.gameData.playerClicks[playerId] || this.gameData.bothPlayersClicked) {
      return;
    }

    // Record exactly when this player clicked
    const clickTime = Date.now();
    this.gameData.playerClicks[playerId] = clickTime;

    // Calculate reaction time in milliseconds
    const reactionTime = clickTime - this.gameData.greenLightStartTime;
    console.log(`[REACTION TIME] Player ${playerId} clicked after ${reactionTime}ms`);

    // Notify all players of this click
    this.emitToPlayers("player-clicked", {
      playerId,
      reactionTime,
      totalClicks: Object.keys(this.gameData.playerClicks).length
    });

    // Check if both players have now clicked
    if (Object.keys(this.gameData.playerClicks).length === 2) {
      this.gameData.bothPlayersClicked = true;
      console.log(`[REACTION TIME] Both players clicked! Waiting ${this.gameData.resultsDelay}ms before showing results...`);

      // Wait 5 seconds before ending the game
      setTimeout(() => {
        if (this.state === "playing") {
          this.endGame();
        }
      }, this.gameData.resultsDelay);
    }
  }

  // ===== GAME END LOGIC =====

  // Determine who won when the game ends
  checkGameEnd(): GameResult | null {
    const clickedPlayers = Object.keys(this.gameData.playerClicks);

    // Calculate reaction times for all players who clicked
    const reactionTimes: { [playerId: string]: number } = {};
    for (const playerId of clickedPlayers) {
      reactionTimes[playerId] = this.gameData.playerClicks[playerId] - this.gameData.greenLightStartTime;
    }

    console.log(`[REACTION TIME] Final reaction times:`, reactionTimes);

    // If both players clicked
    if (clickedPlayers.length === 2) {
      // Find the fastest player (lowest reaction time)
      let fastestPlayerId = clickedPlayers[0];
      let fastestReactionTime = reactionTimes[fastestPlayerId];

      for (const playerId of clickedPlayers) {
        if (reactionTimes[playerId] < fastestReactionTime) {
          fastestReactionTime = reactionTimes[playerId];
          fastestPlayerId = playerId;
        }
      }

      // Create score object: winner gets 1, loser gets 0
      const scores: { [playerId: string]: number } = {};
      this.players.forEach(player => {
        scores[player.id] = player.id === fastestPlayerId ? 1 : 0;
      });

      console.log(`[REACTION TIME] Winner: ${fastestPlayerId} with ${fastestReactionTime}ms`);

      return {
        winnerId: fastestPlayerId,
        isDraw: false,
        scores,
        gameData: {
          reactionTimes,                    // Reaction times in milliseconds
          fastestTime: fastestReactionTime, // Winner's time
          greenLightStartTime: this.gameData.greenLightStartTime
        }
      };
    }

    // If only one player clicked
    if (clickedPlayers.length === 1) {
      const clickedPlayerId = clickedPlayers[0];
      const scores: { [playerId: string]: number } = {};
      this.players.forEach(player => {
        scores[player.id] = player.id === clickedPlayerId ? 1 : 0;
      });

      console.log(`[REACTION TIME] Only one player clicked: ${clickedPlayerId} with ${reactionTimes[clickedPlayerId]}ms`);

      return {
        winnerId: clickedPlayerId,
        isDraw: false,
        scores,
        gameData: {
          reactionTimes,
          fastestTime: reactionTimes[clickedPlayerId],
          onlyOneClicked: true
        }
      };
    }

    // No one clicked after green light appeared - it's a draw
    const scores: { [playerId: string]: number } = {};
    this.players.forEach(player => {
      scores[player.id] = 0;  // Both players get 0 points
    });

    console.log(`[REACTION TIME] No one clicked - draw`);

    return {
      isDraw: true,
      scores,
      gameData: {
        reactionTimes: {},
        noClicks: true
      }
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