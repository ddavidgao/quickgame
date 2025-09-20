import { BaseGame, GameConfig, GameData, GameResult, Player } from "../game-interface";

export class RockPaperScissorsGame extends BaseGame {
  config: GameConfig = {
    id: "rock-paper-scissors",
    name: "Rock Paper Scissors",
    description: "Best of 3 rounds - rock beats scissors, paper beats rock, scissors beats paper!",
    minPlayers: 2,
    maxPlayers: 2,
    duration: 30000,
    category: "chance"
  };

  initializeGameData(): GameData {
    return {
      rounds: 0,
      maxRounds: 3,
      choices: {},
      scores: [0, 0],
      roundHistory: []
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
    const { choice } = action;

    // Validate choice
    if (!["rock", "paper", "scissors"].includes(choice) || this.gameData.choices[playerIndex]) {
      return;
    }

    this.gameData.choices[playerIndex] = choice;

    // Check if both players have chosen
    if (Object.keys(this.gameData.choices).length === 2) {
      this.resolveRound();
    }
  }

  private resolveRound(): void {
    const choice1 = this.gameData.choices[0];
    const choice2 = this.gameData.choices[1];
    const winner = this.determineRoundWinner(choice1, choice2);

    if (winner !== -1) {
      this.gameData.scores[winner]++;
    }

    // Store round history
    this.gameData.roundHistory.push({
      round: this.gameData.rounds + 1,
      choices: [choice1, choice2],
      winner
    });

    // Broadcast round result
    this.players.forEach((player, idx) => {
      this.emitToPlayer(player.id, "round-result", {
        yourChoice: this.gameData.choices[idx],
        opponentChoice: this.gameData.choices[1 - idx],
        winner: winner === idx ? "you" : winner === -1 ? "draw" : "opponent",
        scores: this.gameData.scores,
        round: this.gameData.rounds + 1
      });
    });

    this.gameData.rounds++;
    this.gameData.choices = {};

    // Check if game is over
    if (this.gameData.rounds >= this.gameData.maxRounds) {
      setTimeout(() => this.endGame(), 2000);
    } else {
      // Start next round after delay
      setTimeout(() => {
        this.emitToPlayers("next-round", {
          round: this.gameData.rounds + 1,
          scores: this.gameData.scores
        });
      }, 2000);
    }
  }

  private determineRoundWinner(choice1: string, choice2: string): number {
    if (choice1 === choice2) return -1; // Draw

    if (
      (choice1 === "rock" && choice2 === "scissors") ||
      (choice1 === "paper" && choice2 === "rock") ||
      (choice1 === "scissors" && choice2 === "paper")
    ) {
      return 0; // Player 1 wins
    }

    return 1; // Player 2 wins
  }

  checkGameEnd(): GameResult | null {
    if (this.gameData.rounds >= this.gameData.maxRounds) {
      const scores: { [playerId: string]: number } = {};
      let winnerId: string | undefined;

      if (this.gameData.scores[0] > this.gameData.scores[1]) {
        winnerId = this.players[0].id;
        this.players[0].score = 1;
      } else if (this.gameData.scores[1] > this.gameData.scores[0]) {
        winnerId = this.players[1].id;
        this.players[1].score = 1;
      }

      this.players.forEach(player => {
        scores[player.id] = player.score;
      });

      return {
        winnerId,
        isDraw: !winnerId,
        scores,
        gameData: {
          finalScores: this.gameData.scores,
          roundHistory: this.gameData.roundHistory
        }
      };
    }

    return null;
  }

  getClientGameData(): any {
    return {
      round: this.gameData.rounds + 1,
      maxRounds: this.gameData.maxRounds,
      scores: this.gameData.scores
    };
  }
}