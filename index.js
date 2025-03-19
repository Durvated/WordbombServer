const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const server = new WebSocket.Server({ port: process.env.PORT || 3000 });

let games = {}; // Stores active games and players

server.on("connection", (ws) => {
    console.log("A player connected");

    ws.on("message", (message) => {
        const data = JSON.parse(message);

        if (data.type === "createGame") {  // Fix frontend-server mismatch
            const gameCode = uuidv4().slice(0, 6); // Generate a 6-char game code
            games[gameCode] = { players: [], turnIndex: 0, usedWords: new Set() };
            ws.send(JSON.stringify({ type: "game-created", gameCode }));
            console.log(`Game created with code: ${gameCode}`);
        }

        else if (data.type === "joinGame") {  // Fix naming issue
            const { gameCode, playerName } = data;
            if (games[gameCode]) {
                // Store player connection
                games[gameCode].players.push({ name: playerName, ws, lives: 3 });

                // Send updated game state
                broadcast(gameCode, {
                    type: "gameState",
                    players: games[gameCode].players.map(p => ({ name: p.name, lives: p.lives }))
                });

                console.log(`${playerName} joined game ${gameCode}`);
            } else {
                ws.send(JSON.stringify({ type: "error", message: "Game not found" }));
            }
        }

        else if (data.type === "submitWord") {
            const { gameCode, word } = data;
            if (!games[gameCode]) return;

            let game = games[gameCode];
            if (game.usedWords.has(word)) {
                ws.send(JSON.stringify({ type: "error", message: "Word already used!" }));
                return;
            }

            game.usedWords.add(word);
            game.turnIndex = (game.turnIndex + 1) % game.players.length;

            broadcast(gameCode, {
                type: "turnUpdate",
                currentIndex: game.turnIndex
            });

            console.log(`Word '${word}' submitted in game ${gameCode}`);
        }
    });

    ws.on("close", () => {
        Object.keys(games).forEach(gameCode => {
            games[gameCode].players = games[gameCode].players.filter(p => p.ws !== ws);
            broadcast(gameCode, { type: "gameState", players: games[gameCode].players.map(p => ({ name: p.name, lives: p.lives })) });
        });
    });
});

function broadcast(gameCode, message) {
    if (!games[gameCode]) return;
    games[gameCode].players.forEach(p => {
        try {
            p.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    });
}

console.log("WebSocket server running...");
