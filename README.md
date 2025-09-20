# QuickGame

Real-time 1v1 mini-game battles built with Node.js and Socket.IO.

**Built for the Purdue HelloWorld Hackathon**

**Live Demo:** https://quickgame.onrender.com

## Quick Start

```bash
npm install
npm run dev    # Development
npm start      # Production
```

## Architecture

**Server:** `server-modular.ts` - Main server file (TypeScript)
**Games:** `games/server/` - Individual game implementations
**Frontend:** `public/` - HTML, CSS, JavaScript

## How It Works

Players join a queue and get matched for 3-game tournaments. Games include:
- Reaction Time
- Tic Tac Toe
- Rock Paper Scissors
- Whack a Mole

## Adding Games

1. Create `games/server/my-game.ts` extending `BaseGame`
2. Register in `games/game-registry.ts`
3. Add frontend component in `public/game-components.js`

## Development

- `npm run dev` - Run with auto-restart
- `npm run build` - Compile TypeScript
- `npm run clean` - Clean rebuild

Server runs on port 3000 by default.