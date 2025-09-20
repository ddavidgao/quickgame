import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import { GameRegistry } from "./games/game-registry";
import { BaseGame, Player } from "./games/game-interface";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "..", "public")));

interface GameInstance {
  id: string;
  game: BaseGame;
  state: "waiting" | "countdown" | "playing" | "finished";
  startTime?: number;
  endTime?: number;
}

// In-memory storage
const waitingQueue: Player[] = [];
const activeGames: Map<string, GameInstance> = new Map();
const connectedPlayers: Map<string, Player> = new Map();

// Helper functions
function generateGameId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function findGameInstance(playerId: string): GameInstance | undefined {
  for (const gameInstance of activeGames.values()) {
    if (gameInstance.game.players.some(p => p.id === playerId)) {
      return gameInstance;
    }
  }
  return undefined;
}

function removePlayerFromQueue(playerId: string): void {
  const index = waitingQueue.findIndex(p => p.id === playerId);
  if (index !== -1) {
    waitingQueue.splice(index, 1);
  }
}

function createGameInstance(player1: Player, player2: Player): GameInstance {
  const gameId = generateGameId();
  const gameType = GameRegistry.getRandomGameId();

  const game = GameRegistry.createGame(gameType, [player1, player2]);
  if (!game) {
    throw new Error(`Failed to create game of type: ${gameType}`);
  }

  const gameInstance: GameInstance = {
    id: gameId,
    game,
    state: "countdown"
  };

  activeGames.set(gameId, gameInstance);
  return gameInstance;
}

// Socket.io connection handling
io.on("connection", (socket: Socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on("join-queue", (playerName: string) => {
    const player: Player = {
      id: socket.id,
      socket,
      name: playerName || `Player${Math.floor(Math.random() * 1000)}`,
      score: 0
    };

    connectedPlayers.set(socket.id, player);

    if (waitingQueue.length > 0) {
      const opponent = waitingQueue.shift()!;
      removePlayerFromQueue(socket.id);

      try {
        const gameInstance = createGameInstance(opponent, player);
        const gameConfig = GameRegistry.getGameConfig(gameInstance.game.config.id);

        // Notify both players
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

        startCountdown(gameInstance);
      } catch (error) {
        console.error("Failed to create game:", error);
        // Put players back in queue
        waitingQueue.push(opponent, player);
        opponent.socket.emit("matchmaking-error", { message: "Failed to create game" });
        socket.emit("matchmaking-error", { message: "Failed to create game" });
      }
    } else {
      waitingQueue.push(player);
      socket.emit("waiting-for-opponent", { queuePosition: waitingQueue.length });
    }
  });

  socket.on("leave-queue", () => {
    removePlayerFromQueue(socket.id);
    socket.emit("left-queue");
  });

  socket.on("game-action", (data) => {
    const gameInstance = findGameInstance(socket.id);
    if (!gameInstance || gameInstance.state !== "playing") return;

    try {
      gameInstance.game.handlePlayerAction(socket.id, data);
    } catch (error) {
      console.error("Game action error:", error);
      socket.emit("game-error", { message: "Invalid game action" });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    removePlayerFromQueue(socket.id);

    const gameInstance = findGameInstance(socket.id);
    if (gameInstance) {
      const opponent = gameInstance.game.players.find(p => p.id !== socket.id);
      if (opponent) {
        opponent.socket.emit("opponent-disconnected");
      }

      // Cleanup game
      if (gameInstance.game.cleanup) {
        gameInstance.game.cleanup();
      }
      activeGames.delete(gameInstance.id);
    }

    connectedPlayers.delete(socket.id);
  });
});

function startCountdown(gameInstance: GameInstance): void {
  let countdown = 3;

  const countdownInterval = setInterval(() => {
    gameInstance.game.players.forEach(player => {
      player.socket.emit("countdown", countdown);
    });

    countdown--;

    if (countdown < 0) {
      clearInterval(countdownInterval);
      startGame(gameInstance);
    }
  }, 1000);
}

function startGame(gameInstance: GameInstance): void {
  gameInstance.state = "playing";
  gameInstance.startTime = Date.now();

  try {
    gameInstance.game.startGame();

    // Set game timer
    const duration = gameInstance.game.config.duration;
    setTimeout(() => {
      if (gameInstance.state === "playing") {
        endGame(gameInstance);
      }
    }, duration);
  } catch (error) {
    console.error("Failed to start game:", error);
    gameInstance.game.players.forEach(player => {
      player.socket.emit("game-error", { message: "Failed to start game" });
    });
  }
}

function endGame(gameInstance: GameInstance): void {
  gameInstance.state = "finished";
  gameInstance.endTime = Date.now();

  try {
    const result = gameInstance.game.endGame();

    // Notify players of results
    gameInstance.game.players.forEach(player => {
      const isWinner = player.id === result.winnerId;
      const isDraw = result.isDraw;

      player.socket.emit("game-end", {
        winner: isWinner,
        draw: isDraw,
        finalScores: {
          you: result.scores[player.id] || 0,
          opponent: result.scores[gameInstance.game.players.find(p => p.id !== player.id)?.id || ""] || 0
        },
        gameData: result.gameData
      });
    });

    // Clean up game after 5 seconds
    setTimeout(() => {
      if (gameInstance.game.cleanup) {
        gameInstance.game.cleanup();
      }
      activeGames.delete(gameInstance.id);
    }, 5000);
  } catch (error) {
    console.error("Failed to end game:", error);
    gameInstance.game.players.forEach(player => {
      player.socket.emit("game-error", { message: "Game ended unexpectedly" });
    });
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    games: activeGames.size,
    queue: waitingQueue.length,
    players: connectedPlayers.size,
    registeredGames: GameRegistry.getAllGames().map(game => ({
      id: game.id,
      name: game.name,
      category: game.category
    }))
  });
});

// Games endpoint
app.get("/games", (req, res) => {
  res.json({
    games: GameRegistry.getAllGames()
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`QuickGame server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Available games: ${GameRegistry.getAllGames().length}`);

  GameRegistry.getAllGames().forEach(game => {
    console.log(`  - ${game.name} (${game.id}): ${game.description}`);
  });
});