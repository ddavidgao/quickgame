import { Socket } from "socket.io";

export interface Player {
  id: string;
  socket: Socket;
  name: string;
  score: number;
}

export interface GameData {
  [key: string]: any;
}

export interface GameConfig {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  duration: number;
  category: string;
}

export interface GameResult {
  winnerId?: string;
  isDraw: boolean;
  scores: { [playerId: string]: number };
  gameData?: any;
}

export abstract class BaseGame {
  abstract config: GameConfig;

  players: Player[] = [];
  gameData: GameData = {};
  state: "waiting" | "countdown" | "playing" | "finished" = "waiting";
  startTime?: number;
  endTime?: number;

  constructor(players: Player[]) {
    this.players = players;
    this.gameData = this.initializeGameData();
  }

  abstract initializeGameData(): GameData;
  abstract handlePlayerAction(playerId: string, action: any): void;
  abstract checkGameEnd(): GameResult | null;
  abstract getClientGameData(): any;

  startGame(): void {
    this.state = "playing";
    this.startTime = Date.now();
    this.onGameStart();
  }

  endGame(): GameResult {
    this.state = "finished";
    this.endTime = Date.now();
    return this.checkGameEnd() || { isDraw: true, scores: {} };
  }

  protected onGameStart(): void {
    // Override in specific games if needed
  }

  protected emitToPlayers(event: string, data: any): void {
    this.players.forEach(player => {
      player.socket.emit(event, data);
    });
  }

  protected emitToPlayer(playerId: string, event: string, data: any): void {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.socket.emit(event, data);
    }
  }

  cleanup?(): void {
    // Optional cleanup method for games that need it
  }
}