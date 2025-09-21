// =====================================================
// GAME REGISTRY - Central Game Management System
// =====================================================
// This file manages all available games in the system
// It uses the Registry pattern to automatically discover and register games
// Making it easy to add new games without modifying server code

import { BaseGame, GameConfig, Player } from "./game-interface";

// Import all available game implementations
import { ReactionTimeGame } from "./server/reaction-time";
import { TicTacToeGame } from "./server/tic-tac-toe";
import { RockPaperScissorsGame } from "./server/rock-paper-scissors";
import { WhackAMoleGame } from "./server/whack-a-mole";

// =====================================================
// TYPE DEFINITIONS
// =====================================================

// Type definition for game class constructors
// This ensures all game classes can be instantiated with a Player array
type GameConstructor = new (players: Player[]) => BaseGame;

// Internal structure for storing registered games
interface RegisteredGame {
  constructor: GameConstructor;  // The game class constructor
  config: GameConfig;           // The game's configuration metadata
}

// =====================================================
// GAME REGISTRY CLASS
// =====================================================
// Static class that manages all game types in the system

export class GameRegistry {
  // Map storing all registered games, keyed by their unique ID
  private static games: Map<string, RegisteredGame> = new Map();

  // Static initialization block - runs when class is first loaded
  // Automatically registers all available games
  static {
    // Register all games here
    // To add a new game: just import it above and add it to this list
    this.registerGame(ReactionTimeGame);
    this.registerGame(TicTacToeGame);
    this.registerGame(RockPaperScissorsGame);
    this.registerGame(WhackAMoleGame);
  }

  // ===== PRIVATE REGISTRATION METHOD =====

  // Register a single game class in the registry
  private static registerGame(GameClass: GameConstructor): void {
    // Create a temporary instance to access the game's configuration
    const tempInstance = new GameClass([]);  // Empty player array for config access
    const config = tempInstance.config;

    // Store the game class and its config in our registry
    this.games.set(config.id, {
      constructor: GameClass,
      config
    });

    console.log(`Registered game: ${config.name} (${config.id})`);
  }

  // ===== PUBLIC QUERY METHODS =====

  // Get configuration info for all registered games
  static getAllGames(): GameConfig[] {
    return Array.from(this.games.values()).map(game => game.config);
  }

  // Get configuration for a specific game by ID
  static getGameConfig(gameId: string): GameConfig | undefined {
    return this.games.get(gameId)?.config;
  }

  // ===== GAME CREATION METHOD =====

  // Create a new instance of a specific game with the given players
  static createGame(gameId: string, players: Player[]): BaseGame | null {
    const registeredGame = this.games.get(gameId);

    // Check if the game exists in our registry
    if (!registeredGame) {
      console.error(`Game ${gameId} not found in registry`);
      return null;
    }

    const { config, constructor } = registeredGame;

    // Validate that we have the correct number of players for this game
    if (players.length < config.minPlayers || players.length > config.maxPlayers) {
      console.error(`Invalid player count for ${gameId}: ${players.length} (expected ${config.minPlayers}-${config.maxPlayers})`);
      return null;
    }

    try {
      // Create and return a new instance of the game
      return new constructor(players);
    } catch (error) {
      console.error(`Failed to create game ${gameId}:`, error);
      return null;
    }
  }

  // ===== RANDOM SELECTION METHODS =====

  // Get a random game ID (for single random game selection)
  static getRandomGameId(): string {
    const gameIds = Array.from(this.games.keys());
    return gameIds[Math.floor(Math.random() * gameIds.length)];
  }

  // Get multiple unique random game IDs (for tournaments)
  // Used to create a sequence of different games for a match
  static getRandomUniqueGameIds(count: number = 3): string[] {
    const gameIds = Array.from(this.games.keys());

    // Make sure we don't request more games than we have
    if (count > gameIds.length) {
      throw new Error(`Cannot select ${count} unique games, only ${gameIds.length} available`);
    }

    // TEMPORARY: Force reaction-time to always be the first game for testing
    const result = ['reaction-time'];
    const otherGames = gameIds.filter(id => id !== 'reaction-time');

    // Shuffle the remaining games and add them
    const shuffledOthers = [...otherGames].sort(() => Math.random() - 0.5);
    result.push(...shuffledOthers.slice(0, count - 1));

    return result.slice(0, count);
  }

  // ===== UTILITY METHODS =====

  // Get all games in a specific category (e.g., "strategy", "reaction")
  static getGamesByCategory(category: string): GameConfig[] {
    return Array.from(this.games.values())
      .map(game => game.config)
      .filter(config => config.category === category);
  }

  // Check if a specific game is registered
  static isGameRegistered(gameId: string): boolean {
    return this.games.has(gameId);
  }
}