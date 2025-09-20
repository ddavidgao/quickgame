import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";

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

interface Player {
  id: string;
  socket: Socket;
  name: string;
  score: number;
}

interface Game {
  id: string;
  players: Player[];
  gameType: string;
  state: "waiting" | "countdown" | "playing" | "finished";
  startTime?: number;
  endTime?: number;
  winner?: string;
  gameData?: any;
}

const waitingQueue: Player[] = [];
const activeGames: Map<string, Game> = new Map();
const connectedPlayers: Map<string, Player> = new Map();

const GAME_TYPES = [
  "reaction-time",
  "tic-tac-toe",
  "rock-paper-scissors",
  "whack-a-mole"
];

function generateGameId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function findGame(playerId: string): Game | undefined {
  for (const game of activeGames.values()) {
    if (game.players.some(p => p.id === playerId)) {
      return game;
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

function createGame(player1: Player, player2: Player): Game {
  const gameId = generateGameId();
  const gameType = GAME_TYPES[Math.floor(Math.random() * GAME_TYPES.length)];

  const game: Game = {
    id: gameId,
    players: [player1, player2],
    gameType,
    state: "countdown",
    gameData: initializeGameData(gameType)
  };

  activeGames.set(gameId, game);
  return game;
}

function initializeGameData(gameType: string): any {
  switch (gameType) {
    case "reaction-time":
      return {
        startSignal: false,
        reactionTime: Date.now() + Math.random() * 3000 + 2000
      };
    case "tic-tac-toe":
      return {
        board: Array(9).fill(null),
        currentPlayer: 0,
        moves: 0
      };
    case "rock-paper-scissors":
      return {
        rounds: 0,
        maxRounds: 3,
        choices: {},
        scores: [0, 0]
      };
    case "whack-a-mole":
      return {
        moles: Array(9).fill(false),
        activeMole: -1,
        duration: 10000,
        scores: [0, 0]
      };
    default:
      return {};
  }
}

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

      const game = createGame(opponent, player);

      opponent.socket.emit("game-found", {
        gameId: game.id,
        opponent: player.name,
        gameType: game.gameType
      });

      socket.emit("game-found", {
        gameId: game.id,
        opponent: opponent.name,
        gameType: game.gameType
      });

      startCountdown(game);
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
    const game = findGame(socket.id);
    if (!game || game.state !== "playing") return;

    handleGameAction(game, socket.id, data);
  });

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    removePlayerFromQueue(socket.id);

    const game = findGame(socket.id);
    if (game) {
      const opponent = game.players.find(p => p.id !== socket.id);
      if (opponent) {
        opponent.socket.emit("opponent-disconnected");
      }
      activeGames.delete(game.id);
    }

    connectedPlayers.delete(socket.id);
  });
});

function startCountdown(game: Game): void {
  let countdown = 3;

  const countdownInterval = setInterval(() => {
    game.players.forEach(player => {
      player.socket.emit("countdown", countdown);
    });

    countdown--;

    if (countdown < 0) {
      clearInterval(countdownInterval);
      startGame(game);
    }
  }, 1000);
}

function startGame(game: Game): void {
  game.state = "playing";
  game.startTime = Date.now();

  game.players.forEach(player => {
    player.socket.emit("game-start", {
      gameType: game.gameType,
      gameData: game.gameData
    });
  });

  const gameDuration = getGameDuration(game.gameType);
  setTimeout(() => {
    if (game.state === "playing") {
      endGame(game);
    }
  }, gameDuration);

  if (game.gameType === "reaction-time") {
    setTimeout(() => {
      if (game.state === "playing") {
        game.gameData.startSignal = true;
        game.players.forEach(player => {
          player.socket.emit("start-signal");
        });
      }
    }, game.gameData.reactionTime - Date.now());
  }

  if (game.gameType === "whack-a-mole") {
    startWhackAMoleSequence(game);
  }
}

function getGameDuration(gameType: string): number {
  switch (gameType) {
    case "reaction-time": return 10000;
    case "tic-tac-toe": return 60000;
    case "rock-paper-scissors": return 30000;
    case "whack-a-mole": return 10000;
    default: return 30000;
  }
}

function startWhackAMoleSequence(game: Game): void {
  const interval = setInterval(() => {
    if (game.state !== "playing") {
      clearInterval(interval);
      return;
    }

    const randomMole = Math.floor(Math.random() * 9);
    game.gameData.activeMole = randomMole;
    game.gameData.moles[randomMole] = true;

    game.players.forEach(player => {
      player.socket.emit("mole-appears", { position: randomMole });
    });

    setTimeout(() => {
      game.gameData.moles[randomMole] = false;
      game.gameData.activeMole = -1;
    }, 1500);
  }, 2000);

  setTimeout(() => clearInterval(interval), 10000);
}

function handleGameAction(game: Game, playerId: string, data: any): void {
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return;

  switch (game.gameType) {
    case "reaction-time":
      if (game.gameData.startSignal && !game.gameData[`player${playerIndex}Clicked`]) {
        game.gameData[`player${playerIndex}Clicked`] = Date.now();
        game.players[playerIndex].score = 1;
        endGame(game);
      }
      break;

    case "tic-tac-toe":
      if (game.gameData.currentPlayer === playerIndex && data.position >= 0 && data.position < 9 && !game.gameData.board[data.position]) {
        game.gameData.board[data.position] = playerIndex === 0 ? "X" : "O";
        game.gameData.currentPlayer = 1 - game.gameData.currentPlayer;
        game.gameData.moves++;

        game.players.forEach(player => {
          player.socket.emit("game-update", {
            board: game.gameData.board,
            currentPlayer: game.gameData.currentPlayer
          });
        });

        if (checkTicTacToeWin(game.gameData.board, playerIndex === 0 ? "X" : "O")) {
          game.players[playerIndex].score = 1;
          endGame(game);
        } else if (game.gameData.moves === 9) {
          endGame(game);
        }
      }
      break;

    case "rock-paper-scissors":
      if (!game.gameData.choices[playerIndex]) {
        game.gameData.choices[playerIndex] = data.choice;

        if (Object.keys(game.gameData.choices).length === 2) {
          const winner = determineRPSWinner(game.gameData.choices[0], game.gameData.choices[1]);
          if (winner !== -1) {
            game.gameData.scores[winner]++;
          }

          game.players.forEach((player, idx) => {
            player.socket.emit("round-result", {
              yourChoice: game.gameData.choices[idx],
              opponentChoice: game.gameData.choices[1 - idx],
              winner: winner === idx ? "you" : winner === -1 ? "draw" : "opponent",
              scores: game.gameData.scores
            });
          });

          game.gameData.rounds++;
          game.gameData.choices = {};

          if (game.gameData.rounds >= game.gameData.maxRounds) {
            if (game.gameData.scores[0] > game.gameData.scores[1]) {
              game.players[0].score = 1;
            } else if (game.gameData.scores[1] > game.gameData.scores[0]) {
              game.players[1].score = 1;
            }
            endGame(game);
          }
        }
      }
      break;

    case "whack-a-mole":
      if (data.position === game.gameData.activeMole && game.gameData.moles[data.position]) {
        game.gameData.scores[playerIndex]++;
        game.players[playerIndex].score = game.gameData.scores[playerIndex];
        game.gameData.moles[data.position] = false;
        game.gameData.activeMole = -1;

        game.players.forEach(player => {
          player.socket.emit("score-update", {
            scores: game.gameData.scores
          });
        });
      }
      break;
  }
}

function determineRPSWinner(choice1: string, choice2: string): number {
  if (choice1 === choice2) return -1;
  if ((choice1 === "rock" && choice2 === "scissors") ||
      (choice1 === "paper" && choice2 === "rock") ||
      (choice1 === "scissors" && choice2 === "paper")) {
    return 0;
  }
  return 1;
}

function checkTicTacToeWin(board: any[], symbol: string): boolean {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  return winPatterns.some(pattern =>
    pattern.every(index => board[index] === symbol)
  );
}

function endGame(game: Game): void {
  game.state = "finished";
  game.endTime = Date.now();

  if (game.players[0].score > game.players[1].score) {
    game.winner = game.players[0].id;
  } else if (game.players[1].score > game.players[0].score) {
    game.winner = game.players[1].id;
  }

  game.players.forEach(player => {
    const isWinner = player.id === game.winner;
    const isDraw = !game.winner;

    player.socket.emit("game-end", {
      winner: isWinner,
      draw: isDraw,
      finalScores: {
        you: player.score,
        opponent: game.players.find(p => p.id !== player.id)?.score || 0
      }
    });
  });

  setTimeout(() => {
    activeGames.delete(game.id);
  }, 5000);
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    games: activeGames.size,
    queue: waitingQueue.length,
    players: connectedPlayers.size
  });
});

server.listen(PORT, () => {
  console.log(`QuickGame server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});