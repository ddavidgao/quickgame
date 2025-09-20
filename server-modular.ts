// =====================================================
// QUICKGAME SERVER - THE ONLY SERVER FILE YOU NEED
// =====================================================
// IMPORTANT: This is the ONLY server file that matters!
// All other server*.js files in dist/ are just compiled versions
// If you see multiple server files, ignore them - THIS IS THE ONE!
//
// This is the main server file that handles:
// 1. Express web server setup for serving frontend files
// 2. Socket.IO real-time communication for multiplayer games
// 3. Player matchmaking and queue management
// 4. Game instance creation and lifecycle management
// 5. Tournament system (3 games per match between players)
//
// For detailed architecture docs, see: SERVER_ARCHITECTURE.md
// To add new games, see: games/game-registry.ts

// Import required modules for server functionality
import express from "express";          // Web server framework
import http from "http";               // HTTP server creation
import { Server, Socket } from "socket.io";  // Real-time bidirectional communication
import path from "path";               // File path utilities
import { GameRegistry } from "./games/game-registry";  // Game management system
import { BaseGame, Player } from "./games/game-interface";  // Game base classes and interfaces

// =====================================================
// SERVER SETUP SECTION
// =====================================================
// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Set up Socket.IO with CORS enabled for real-time communication
const io = new Server(server, {
  cors: {
    origin: "*",        // Allow connections from any origin (for development)
    methods: ["GET", "POST"]  // Allow these HTTP methods
  }
});

// Server configuration
const PORT = process.env.PORT || 3000;  // Use environment port or default to 3000

// Serve static files (HTML, CSS, JS) from the public directory
app.use(express.static(path.join(__dirname, "..", "public")));

// =====================================================
// DATA STRUCTURES & INTERFACES
// =====================================================
// Define the structure of tournaments and game instances

// Match interface: Represents a tournament between 2 players (3 games)
interface Match {
  id: string;                           // Unique identifier for this match
  players: Player[];                    // Array of 2 players in this match
  gameQueue: string[];                  // Queue of 3 random game types to play
  currentGameIndex: number;             // Which game we're currently on (0, 1, or 2)
  matchScores: Map<string, number>;     // Overall tournament scores per player
  readyStatus: Map<string, boolean>;    // Ready status for next game
  state: "waiting" | "countdown" | "playing" | "finished" | "ready-up";  // Match state
}

// GameInstance interface: Represents a single game being played
interface GameInstance {
  id: string;                           // Unique identifier for this game instance
  matchId: string;                      // Which match this game belongs to
  game: BaseGame;                       // The actual game logic instance
  state: "waiting" | "countdown" | "playing" | "finished";  // Current game state
  startTime?: number;                   // When the game started (timestamp)
  endTime?: number;                     // When the game ended (timestamp)
}

// =====================================================
// IN-MEMORY DATA STORAGE
// =====================================================
// All game state is stored in memory using Maps and Sets for fast lookups
// Note: In production, you'd want to use a database for persistence

const waitingQueue: Player[] = [];                    // Players waiting for a match (array for FIFO behavior)
const activeMatches: Map<string, Match> = new Map();   // Currently running tournaments
const activeGames: Map<string, GameInstance> = new Map(); // Individual games in progress
const connectedPlayers: Map<string, Player> = new Map(); // All connected players
const playerToMatch: Map<string, string> = new Map();  // Maps player ID to their match ID

// =====================================================
// UTILITY HELPER FUNCTIONS
// =====================================================
// These functions help with game and match management

// Generate a random unique ID for games
function generateGameId(): string {
  return Math.random().toString(36).substr(2, 9);  // Creates random 9-character string
}

// Find which game instance a specific player is currently in
function findGameInstance(playerId: string): GameInstance | undefined {
  // Loop through all active games to find this player
  for (const gameInstance of activeGames.values()) {
    if (gameInstance.game.players.some(p => p.id === playerId)) {
      return gameInstance;
    }
  }
  return undefined;  // Player not found in any active game
}

// Remove a player from the waiting queue when they get matched or disconnect
function removePlayerFromQueue(playerId: string): void {
  const index = waitingQueue.findIndex(player => player.id === playerId);
  if (index !== -1) {
    waitingQueue.splice(index, 1);  // Remove player from array
  }
}

// Generate a random unique ID for matches (tournaments)
function generateMatchId(): string {
  return Math.random().toString(36).substr(2, 9);  // Creates random 9-character string
}

// =====================================================
// MATCH CREATION FUNCTIONS
// =====================================================
// Functions to create and manage tournaments between players

// Create a new tournament match between two players
function createMatch(player1: Player, player2: Player): Match {
  const matchId = generateMatchId();
  // Get 3 random different games for this tournament
  const gameQueue = GameRegistry.getRandomUniqueGameIds(3);

  const match: Match = {
    id: matchId,
    players: [player1, player2],
    gameQueue,                    // The 3 games they'll play
    currentGameIndex: 0,          // Start with the first game
    matchScores: new Map([        // Initialize tournament scores to 0
      [player1.id, 0],
      [player2.id, 0]
    ]),
    readyStatus: new Map([        // Track if players are ready for next game
      [player1.id, false],
      [player2.id, false]
    ]),
    state: "countdown"            // Start in countdown mode
  };

  // Store the match and map players to it
  activeMatches.set(matchId, match);
  playerToMatch.set(player1.id, matchId);
  playerToMatch.set(player2.id, matchId);

  return match;
}

// Create a single game instance within a tournament match
function createGameInstanceForMatch(match: Match): GameInstance {
  const gameId = generateGameId();
  // Get the current game type from the match's game queue
  const gameType = match.gameQueue[match.currentGameIndex];

  // Use the GameRegistry to create the actual game logic instance
  const game = GameRegistry.createGame(gameType, match.players);
  if (!game) {
    throw new Error(`Failed to create game of type: ${gameType}`);
  }

  const gameInstance: GameInstance = {
    id: gameId,
    matchId: match.id,
    game,                         // The actual game logic
    state: "countdown"            // Start with countdown
  };

  // Store this game instance
  activeGames.set(gameId, gameInstance);
  return gameInstance;
}

// =====================================================
// SOCKET.IO EVENT HANDLING
// =====================================================
// This section handles all real-time communication with players
// Each connected player gets their own socket for bidirectional communication

io.on("connection", (socket: Socket) => {
  console.log(`Player connected: ${socket.id}`);

  // ===== MATCHMAKING EVENTS =====

  // Event: Player wants to join the matchmaking queue
  socket.on("join-queue", (playerName: string) => {
    // Create player object with socket connection and name
    const player: Player = {
      id: socket.id,  // Use socket ID as unique player identifier
      socket,         // Store socket reference for communication
      name: playerName || `Player${Math.floor(Math.random() * 1000)}`,  // Use provided name or generate one
      score: 0        // Initialize score to 0
    };

    // Add player to our connected players registry
    connectedPlayers.set(socket.id, player);

    // Check if there's someone already waiting for a match
    if (waitingQueue.length > 0) {
      // Match found! Get the first player from queue
      const opponent = waitingQueue.shift()!;  // Remove opponent from queue
      removePlayerFromQueue(socket.id);        // Make sure current player isn't also in queue

      try {
        // Create a tournament match between these two players
        const match = createMatch(opponent, player);
        // Create the first game in their tournament
        const gameInstance = createGameInstanceForMatch(match);
        const gameConfig = GameRegistry.getGameConfig(gameInstance.game.config.id);

        // Tell both players they found a match and what game they're playing
        opponent.socket.emit("game-found", {
          gameId: gameInstance.id,
          opponent: player.name,
          gameType: gameInstance.game.config.id,
          gameName: gameConfig?.name,
          description: gameConfig?.description
        });

        socket.emit("game-found", {
          gameId: gameInstance.id,
          opponent: opponent.name,
          gameType: gameInstance.game.config.id,
          gameName: gameConfig?.name,
          description: gameConfig?.description
        });

        // Start the countdown before the game begins
        startCountdown(gameInstance);
      } catch (error) {
        console.error("Failed to create game:", error);
        // If game creation fails, put both players back in queue
        waitingQueue.push(opponent, player);
        opponent.socket.emit("matchmaking-error", { message: "Failed to create game" });
        socket.emit("matchmaking-error", { message: "Failed to create game" });
      }
    } else {
      // No one else waiting, add this player to the queue
      waitingQueue.push(player);
      socket.emit("waiting-for-opponent", { queuePosition: waitingQueue.length });
    }
  });

  // Event: Player wants to leave the matchmaking queue
  socket.on("leave-queue", () => {
    removePlayerFromQueue(socket.id);  // Remove them from queue
    socket.emit("left-queue");         // Confirm they left
  });

  // ===== GAMEPLAY EVENTS =====

  // Event: Player performs an action in their current game (click, move, choice, etc.)
  socket.on("game-action", (data) => {
    // Find which game this player is currently in
    const gameInstance = findGameInstance(socket.id);

    // Only process actions if player is in a game and the game is actively running
    if (!gameInstance || gameInstance.state !== "playing") return;

    try {
      // Forward the action to the game logic to handle
      gameInstance.game.handlePlayerAction(socket.id, data);
    } catch (error) {
      console.error("Game action error:", error);
      // Tell the player their action was invalid
      socket.emit("game-error", { message: "Invalid game action" });
    }
  });

  // ===== CONNECTION MANAGEMENT =====

  // Event: Player disconnects from the server
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);

    // Remove from queue if they were waiting
    removePlayerFromQueue(socket.id);

    // If they were in a game, handle the disconnection
    const gameInstance = findGameInstance(socket.id);
    if (gameInstance) {
      // Find their opponent and notify them
      const opponent = gameInstance.game.players.find(p => p.id !== socket.id);
      if (opponent) {
        opponent.socket.emit("opponent-disconnected");
      }

      // Clean up the game resources
      if (gameInstance.game.cleanup) {
        gameInstance.game.cleanup();  // Let the game clean up any timers/intervals
      }
      activeGames.delete(gameInstance.id);  // Remove the game from active games
    }

    // Remove from connected players registry
    connectedPlayers.delete(socket.id);
  });
});

// =====================================================
// GAME LIFECYCLE MANAGEMENT FUNCTIONS
// =====================================================
// These functions handle the progression of games from start to finish

// Start a countdown before a game begins (3-2-1-GO!)
function startCountdown(gameInstance: GameInstance): void {
  let countdown = 3;  // Start countdown from 3

  // Send countdown numbers to both players every second
  const countdownInterval = setInterval(() => {
    // Emit current countdown number to both players
    gameInstance.game.players.forEach(player => {
      player.socket.emit("countdown", countdown);
    });

    countdown--;  // Decrease the countdown

    // When countdown reaches 0, stop and start the actual game
    if (countdown < 0) {
      clearInterval(countdownInterval);  // Stop the countdown timer
      startGame(gameInstance);           // Begin the game
    }
  }, 1000);  // Update every 1 second
}

// Actually start the game after countdown finishes
function startGame(gameInstance: GameInstance): void {
  gameInstance.state = "playing";         // Mark game as actively playing
  gameInstance.startTime = Date.now();    // Record when game started

  try {
    // Tell the game logic to start (this varies per game type)
    gameInstance.game.startGame();

    // Set up automatic game ending based on the game's duration
    const duration = gameInstance.game.config.duration;  // Get game duration (e.g., 30 seconds)
    setTimeout(() => {
      // Only end if game is still playing (might have ended early)
      if (gameInstance.state === "playing") {
        endGame(gameInstance);
      }
    }, duration);
  } catch (error) {
    console.error("Failed to start game:", error);
    // If game fails to start, notify both players
    gameInstance.game.players.forEach(player => {
      player.socket.emit("game-error", { message: "Failed to start game" });
    });
  }
}

// End the game and send results to players
function endGame(gameInstance: GameInstance): void {
  gameInstance.state = "finished";        // Mark game as finished
  gameInstance.endTime = Date.now();      // Record when game ended

  try {
    // Ask the game to calculate final results (winner, scores, etc.)
    const result = gameInstance.game.endGame();

    // Send customized results to each player
    gameInstance.game.players.forEach(player => {
      const isWinner = player.id === result.winnerId;  // Is this player the winner?
      const isDraw = result.isDraw;                     // Was it a tie?

      // Send results with personalized perspective ("you" vs "opponent")
      player.socket.emit("game-end", {
        winner: isWinner,
        draw: isDraw,
        finalScores: {
          you: result.scores[player.id] || 0,  // This player's score
          // Find opponent's score
          opponent: result.scores[gameInstance.game.players.find(p => p.id !== player.id)?.id || ""] || 0
        },
        gameData: result.gameData  // Any additional game-specific data
      });
    });

    // Clean up the game after players have seen results
    setTimeout(() => {
      if (gameInstance.game.cleanup) {
        gameInstance.game.cleanup();  // Let game clean up resources
      }
      activeGames.delete(gameInstance.id);  // Remove from active games
    }, 5000);  // Wait 5 seconds before cleanup
  } catch (error) {
    console.error("Failed to end game:", error);
    // If ending fails, notify players of the error
    gameInstance.game.players.forEach(player => {
      player.socket.emit("game-error", { message: "Game ended unexpectedly" });
    });
  }
}

// =====================================================
// HTTP REST API ENDPOINTS
// =====================================================
// These endpoints provide information about the server and games

// Health check endpoint - shows current server status and statistics
app.get("/health", (req, res) => {
  res.json({
    status: "ok",                               // Server is running
    games: activeGames.size,                    // How many games are currently active
    queue: waitingQueue.length,                 // How many players are waiting for matches
    players: connectedPlayers.size,             // Total connected players
    registeredGames: GameRegistry.getAllGames().map(game => ({  // List all available games
      id: game.id,
      name: game.name,
      category: game.category
    }))
  });
});

// Games endpoint - returns detailed information about all available games
app.get("/games", (req, res) => {
  res.json({
    games: GameRegistry.getAllGames()  // Full game configurations including descriptions, durations, etc.
  });
});

// =====================================================
// SERVER STARTUP
// =====================================================
// Start the HTTP server and display startup information

server.listen(PORT, () => {
  console.log(`QuickGame server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Available games: ${GameRegistry.getAllGames().length}`);

  // Log all registered games for debugging
  GameRegistry.getAllGames().forEach(game => {
    console.log(`  - ${game.name} (${game.id}): ${game.description}`);
  });
});