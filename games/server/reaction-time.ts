import { BaseGame, GameConfig, GameData, GameResult, Player } from "../game-interface";

export class ReactionTimeGame extends BaseGame {
  config: GameConfig = {
    id: "reaction-time",
    name: "Reaction Time",
    description: "Click as fast as you can when the light turns green!",
    minPlayers: 2,
    maxPlayers: 2,
    duration: 10000,
    category: "reaction"
  };

  private reactionTimeout?: NodeJS.Timeout;

  initializeGameData(): GameData {
    return {
      startSignal: false,
      reactionDelay: Math.random() * 3000 + 2000, // 2-5 seconds
      playerClicks: {}
    };
  }

  protected onGameStart(): void {
    this.emitToPlayers("game-start", {
      gameType: this.config.id,
      gameData: this.getClientGameData()
    });

    // Set up the reaction signal
    this.reactionTimeout = setTimeout(() => {
      if (this.state === "playing") {
        this.gameData.startSignal = true;
        this.emitToPlayers("start-signal", {});
      }
    }, this.gameData.reactionDelay);
  }

  handlePlayerAction(playerId: string, action: any): void {
    if (!this.gameData.startSignal || this.gameData.playerClicks[playerId]) {
      return;
    }

    this.gameData.playerClicks[playerId] = Date.now();

    // Update player score
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.score = 1;
    }

    // End game immediately when first player clicks
    this.endGame();
  }

  checkGameEnd(): GameResult | null {
    const clickedPlayers = Object.keys(this.gameData.playerClicks);

    if (clickedPlayers.length > 0) {
      // Find the fastest player
      let fastestPlayerId = clickedPlayers[0];
      let fastestTime = this.gameData.playerClicks[fastestPlayerId];

      for (const playerId of clickedPlayers) {
        if (this.gameData.playerClicks[playerId] < fastestTime) {
          fastestTime = this.gameData.playerClicks[playerId];
          fastestPlayerId = playerId;
        }
      }

      const scores: { [playerId: string]: number } = {};
      this.players.forEach(player => {
        scores[player.id] = player.id === fastestPlayerId ? 1 : 0;
      });

      return {
        winnerId: fastestPlayerId,
        isDraw: false,
        scores,
        gameData: {
          reactionTimes: this.gameData.playerClicks
        }
      };
    }

    // No one clicked - it's a draw
    const scores: { [playerId: string]: number } = {};
    this.players.forEach(player => {
      scores[player.id] = 0;
    });

    return {
      isDraw: true,
      scores
    };
  }

  getClientGameData(): any {
    return {
      instruction: this.gameData.startSignal ? "CLICK NOW!" : "Wait for GREEN..."
    };
  }

  cleanup(): void {
    if (this.reactionTimeout) {
      clearTimeout(this.reactionTimeout);
    }
  }
}