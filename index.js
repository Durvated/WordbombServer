const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const server = new WebSocket.Server({ port: process.env.PORT || 3000 });

let games = {}; // Stores active games and players

server.on("connection", (ws) => {
    console.log("A player connected");

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            console.log("Received message:", data);

            switch (data.type) {
                case "createGame":
                    handleCreateGame(ws, data);
                    break;
                case "joinGame":
                    handleJoinGame(ws, data);
                    break;
                case "submitWord":
                    handleSubmitWord(ws, data);
                    break;
                case "timeOut":
                    handleTimeOut(data);
                    break;
                default:
                    console.log("Unknown message type:", data.type);
            }
        } catch (error) {
            console.error("Error handling message:", error);
        }
    });

    ws.on("close", () => {
        handlePlayerDisconnect(ws);
    });
});

function handleCreateGame(ws, data) {
    const gameCode = uuidv4().slice(0, 6).toUpperCase();
    games[gameCode] = {
        players: [],
        turnIndex: 0,
        usedWords: new Set()
    };
    ws.send(JSON.stringify({ type: "game-created", gameCode }));
    console.log(`Game created with code: ${gameCode}`);
}

function handleJoinGame(ws, data) {
    const { gameCode, playerName } = data;
    if (games[gameCode]) {
        games[gameCode].players.push({ name: playerName, ws, lives: 3 });
        broadcastGameState(gameCode);
        console.log(`${playerName} joined game ${gameCode}`);
    } else {
        ws.send(JSON.stringify({ type: "error", message: "Game not found" }));
    }
}

function handleSubmitWord(ws, data) {
    const { gameCode, word } = data;
    if (!games[gameCode]) return;

    let game = games[gameCode];
    if (game.usedWords.has(word)) {
        ws.send(JSON.stringify({ type: "error", message: "Word already used!" }));
        return;
    }

    game.usedWords.add(word);
    game.turnIndex = (game.turnIndex + 1) % game.players.length;

    broadcastToGame(gameCode, {
        type: "turnUpdate",
        currentIndex: game.turnIndex
    });

    console.log(`Word '${word}' submitted in game ${gameCode}`);
}

function handleTimeOut(data) {
    const { gameCode } = data;
    if (!games[gameCode]) return;

    let game = games[gameCode];
    game.turnIndex = (game.turnIndex + 1) % game.players.length;

    broadcastToGame(gameCode, {
        type: "turnUpdate",
        currentIndex: game.turnIndex
    });

    console.log(`Time out in game ${gameCode}`);
}

function handlePlayerDisconnect(ws) {
    Object.keys(games).forEach(gameCode => {
        games[gameCode].players = games[gameCode].players.filter(p => p.ws !== ws);
        if (games[gameCode].players.length === 0) {
            delete games[gameCode];
            console.log(`Game ${gameCode} removed due to no players`);
        } else {
            broadcastGameState(gameCode);
        }
    });
}

function broadcastGameState(gameCode) {
    if (!games[gameCode]) return;
    broadcastToGame(gameCode, {
        type: "gameState",
        players: games[gameCode].players.map(p => ({ name: p.name, lives: p.lives })),
        currentIndex: games[gameCode].turnIndex
    });
}

function broadcastToGame(gameCode, message) {
    if (!games[gameCode]) return;
    games[gameCode].players.forEach(p => {
        try {
            p.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    });
}

console.log("WebSocket server running on port", process.env.PORT || 3000);
