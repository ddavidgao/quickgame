// =====================================================
// GAME INTERFACE DEFINITIONS
// =====================================================
// This file defines the core interfaces and base class that ALL games must implement
// It provides the foundation for the modular game system

import { Socket } from "socket.io";

// =====================================================
// CORE INTERFACES
// =====================================================

// Player interface: Represents a connected user in the game system
export interface Player {
  id: string;        // Unique identifier (usually socket.id)
  socket: Socket;    // Socket.IO connection for real-time communication
  name: string;      // Display name chosen by the player
  score: number;     // Current score in the active game
}

// GameData interface: Flexible container for game-specific state
// Each game can store whatever data it needs here
export interface GameData {
  [key: string]: any;  // Allows games to store any type of data with string keys
}

// GameConfig interface: Metadata that describes a game type
export interface GameConfig {
  id: string;          // Unique identifier for this game type (e.g., "tic-tac-toe")
  name: string;        // Human-readable name (e.g., "Tic Tac Toe")
  description: string; // Brief description of how to play
  minPlayers: number;  // Minimum number of players required (usually 2)
  maxPlayers: number;  // Maximum number of players allowed (usually 2)
  duration: number;    // How long the game lasts in milliseconds (e.g., 30000 = 30 seconds)
  category: string;    // Game category for grouping (e.g., "strategy", "reaction", "chance")
}

// GameResult interface: Standardized way games report their final results
export interface GameResult {
  winnerId?: string;                           // ID of winning player (undefined if draw)
  isDraw: boolean;                            // True if the game ended in a tie
  scores: { [playerId: string]: number };     // Final scores for each player
  gameData?: any;                             // Any additional game-specific result data
}

// =====================================================
// BASE GAME CLASS
// =====================================================
// Abstract base class that all specific games must extend
// Provides common functionality and enforces a standard interface

export abstract class BaseGame {
  // Each game must define its configuration (name, duration, etc.)
  abstract config: GameConfig;

  // ===== GAME STATE PROPERTIES =====
  players: Player[] = [];      // Array of players in this game (usually 2)
  gameData: GameData = {};     // Game-specific state data
  state: "waiting" | "countdown" | "playing" | "finished" = "waiting";  // Current game state
  startTime?: number;          // Timestamp when game started
  endTime?: number;            // Timestamp when game ended

  // Constructor: Initialize the game with players
  constructor(players: Player[]) {
    this.players = players;
    this.gameData = this.initializeGameData();  // Let each game set up its initial state
  }

  // ===== ABSTRACT METHODS =====
  // These methods MUST be implemented by each specific game

  // Initialize game-specific data (board state, scores, etc.)
  abstract initializeGameData(): GameData;

  // Handle a player action (move, click, choice, etc.)
  abstract handlePlayerAction(playerId: string, action: any): void;

  // Check if the game has ended and return results
  abstract checkGameEnd(): GameResult | null;

  // Get game state data to send to clients (may hide server-only info)
  abstract getClientGameData(): any;

  // ===== GAME LIFECYCLE METHODS =====

  // Start the game (called by server after countdown)
  startGame(): void {
    this.state = "playing";              // Mark as actively playing
    this.startTime = Date.now();         // Record start time
    this.onGameStart();                  // Let specific games do custom startup
  }

  // End the game and return final results
  endGame(): GameResult {
    this.state = "finished";             // Mark as completed
    this.endTime = Date.now();           // Record end time
    // Return game results, or default to draw if game doesn't provide results
    return this.checkGameEnd() || { isDraw: true, scores: {} };
  }

  // ===== PROTECTED HELPER METHODS =====
  // These methods are available to all games that extend this class

  // Override this method if your game needs custom startup logic
  protected onGameStart(): void {
    // Default: do nothing. Individual games can override this.
  }

  // Send an event to ALL players in this game
  protected emitToPlayers(event: string, data: any): void {
    this.players.forEach(player => {
      player.socket.emit(event, data);
    });
  }

  // Send an event to a SPECIFIC player by their ID
  protected emitToPlayer(playerId: string, event: string, data: any): void {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.socket.emit(event, data);
    }
  }

  // ===== OPTIONAL CLEANUP METHOD =====
  // Games can implement this to clean up timers, intervals, etc.
  cleanup?(): void {
    // Optional method - games that use timers/intervals should implement this
  }
}