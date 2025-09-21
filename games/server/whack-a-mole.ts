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
    duration: 25000,                                        // 25 seconds of gameplay
    category: "reaction"                                    // Reaction-based game category
  };

  private moleInterval?: NodeJS.Timeout;
  private gameTimeout?: NodeJS.Timeout;

  initializeGameData(): GameData {
    return {
      moles: Array(9).fill(false),
      activeMoles: [], // Array of active mole positions
      scores: [0, 0],
      hits: [],
      moleTimers: {} // Track individual mole timers
    };
  }

  protected onGameStart(): void {
    // Tell each player individually what their player index is
    this.players.forEach((player, playerIndex) => {
      this.emitToPlayer(player.id, "game-start", {
        gameType: this.config.id,
        gameData: this.getClientGameData(),
        playerIndex: playerIndex  // 0 for first player, 1 for second player
      });
    });

    this.startMoleSequence();
  }

  private startMoleSequence(): void {
    this.moleInterval = setInterval(() => {
      if (this.state !== "playing") {
        return;
      }

      this.spawnMoleWave();
    }, 1500); // Slower wave spawning to let moles accumulate

    // Game will be ended by server timer - no need for internal timeout
  }

  private spawnMoleWave(): void {
    // Find available positions (not currently active)
    const availablePositions = [];
    for (let i = 0; i < 9; i++) {
      if (!this.gameData.moles[i]) {
        availablePositions.push(i);
      }
    }

    if (availablePositions.length === 0) {
      return;
    }

    // Spawn 2-4 moles simultaneously (challenge mode!) - NO LIMITS!
    const numMolesToSpawn = Math.min(
      2 + Math.floor(Math.random() * 3), // 2-4 moles
      availablePositions.length
      // REMOVED: 4 - this.gameData.activeMoles.length // No more artificial limits!
    );

    // Randomly select positions for this wave
    const selectedPositions = [];
    for (let i = 0; i < numMolesToSpawn; i++) {
      const randomIndex = Math.floor(Math.random() * availablePositions.length);
      selectedPositions.push(availablePositions.splice(randomIndex, 1)[0]);
    }

    // Calculate ONE duration for the entire wave so they all stay the same time
    const waveDuration = Math.random() < 0.6
      ? 5000 + Math.random() * 3000  // 60% chance: 5-8 seconds
      : 4000 + Math.random() * 2000; // 40% chance: 4-6 seconds

    console.log(`[MOLE WAVE] Spawning ${selectedPositions.length} moles for ${waveDuration}ms`);

    // Spawn all moles in this wave with slight delays for more natural feel
    selectedPositions.forEach((position, index) => {
      setTimeout(() => {
        this.spawnSingleMole(position, waveDuration);
      }, index * 100); // 100ms delay between each mole in the wave
    });
  }

  private spawnSingleMole(position: number, waveDuration: number): void {
    if (this.gameData.moles[position] || this.state !== "playing") {
      return; // Position already taken or game ended
    }

    // Show mole
    this.gameData.moles[position] = true;
    this.gameData.activeMoles.push(position);
    this.emitToPlayers("mole-appears", { position });

    console.log(`[MOLE SPAWN] Mole at position ${position} will stay for ${waveDuration}ms`);

    // Hide mole after the wave duration (all moles in wave disappear together)
    this.gameData.moleTimers[position] = setTimeout(() => {
      this.hideMole(position);
    }, waveDuration);
  }

  private hideMole(position: number): void {
    if (this.gameData.moles[position]) {
      this.gameData.moles[position] = false;
      this.gameData.activeMoles = this.gameData.activeMoles.filter((pos: number) => pos !== position);
      this.emitToPlayers("mole-disappears", { position });

      // Clear the timer
      if (this.gameData.moleTimers[position]) {
        clearTimeout(this.gameData.moleTimers[position]);
        delete this.gameData.moleTimers[position];
      }
    }
  }

  handlePlayerAction(playerId: string, action: any): void {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    const { position } = action;

    // Check if hit is valid (mole is active at this position)
    if (this.gameData.moles[position] && this.gameData.activeMoles.includes(position)) {
      // Valid hit
      this.gameData.scores[playerIndex]++;
      this.players[playerIndex].score = this.gameData.scores[playerIndex];

      // Hide the mole immediately
      this.hideMole(position);

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

    // Clear all individual mole timers
    Object.values(this.gameData.moleTimers).forEach((timer: any) => {
      clearTimeout(timer);
    });
    this.gameData.moleTimers = {};
  }
}