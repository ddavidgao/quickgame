import { BaseGame, GameConfig, Player } from "./game-interface";
import { ReactionTimeGame } from "./server/reaction-time";
import { TicTacToeGame } from "./server/tic-tac-toe";
import { RockPaperScissorsGame } from "./server/rock-paper-scissors";
import { WhackAMoleGame } from "./server/whack-a-mole";

type GameConstructor = new (players: Player[]) => BaseGame;

interface RegisteredGame {
  constructor: GameConstructor;
  config: GameConfig;
}

export class GameRegistry {
  private static games: Map<string, RegisteredGame> = new Map();

  static {
    // Register all games
    this.registerGame(ReactionTimeGame);
    this.registerGame(TicTacToeGame);
    this.registerGame(RockPaperScissorsGame);
    this.registerGame(WhackAMoleGame);
  }

  private static registerGame(GameClass: GameConstructor): void {
    const tempInstance = new GameClass([]);
    const config = tempInstance.config;

    this.games.set(config.id, {
      constructor: GameClass,
      config
    });

    console.log(`Registered game: ${config.name} (${config.id})`);
  }

  static getAllGames(): GameConfig[] {
    return Array.from(this.games.values()).map(game => game.config);
  }

  static getGameConfig(gameId: string): GameConfig | undefined {
    return this.games.get(gameId)?.config;
  }

  static createGame(gameId: string, players: Player[]): BaseGame | null {
    const registeredGame = this.games.get(gameId);

    if (!registeredGame) {
      console.error(`Game ${gameId} not found in registry`);
      return null;
    }

    const { config, constructor } = registeredGame;

    // Validate player count
    if (players.length < config.minPlayers || players.length > config.maxPlayers) {
      console.error(`Invalid player count for ${gameId}: ${players.length} (expected ${config.minPlayers}-${config.maxPlayers})`);
      return null;
    }

    try {
      return new constructor(players);
    } catch (error) {
      console.error(`Failed to create game ${gameId}:`, error);
      return null;
    }
  }

  static getRandomGameId(): string {
    const gameIds = Array.from(this.games.keys());
    return gameIds[Math.floor(Math.random() * gameIds.length)];
  }

  static getGamesByCategory(category: string): GameConfig[] {
    return Array.from(this.games.values())
      .map(game => game.config)
      .filter(config => config.category === category);
  }

  static isGameRegistered(gameId: string): boolean {
    return this.games.has(gameId);
  }
}