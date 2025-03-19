const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const server = new WebSocket.Server({ port: process.env.PORT || 3000 });

let games = {}; // Stores active games and players
let clients = {}; // Stores WebSocket connections by player ID

server.on("connection", (ws) => {
    console.log("A player connected");

    ws.on("message", (message) => {
        const data = JSON.parse(message);
        console.log("Received message:", data); // Debugging log

        if (data.type === "createGame") {
            const gameCode = uuidv4().slice(0, 6).toUpperCase();
            games[gameCode] = { players: [], turnIndex: 0, usedWords: new Set() };
            ws.send(JSON.stringify({ type: "gameCreated", gameCode }));
            console.log(`Game created with code: ${gameCode}`);
        }

        else if (data.type === "joinGame") {
            let { gameCode, playerName } = data;
            gameCode = gameCode.trim().toUpperCase();

            console.log(`Player "${playerName}" attempting to join game "${gameCode}"`);

            if (games[gameCode]) {
                const playerId = uuidv4(); // Generate a unique player ID
                games[gameCode].players.push({ id: playerId, name: playerName, lives: 3 });
                clients[playerId] = ws; // Store WebSocket separately

                broadcast(gameCode, {
                    type: "gameState",
                    players: games[gameCode].players.map(p => ({ name: p.name, lives: p.lives }))
                });

                console.log(`${playerName} joined game ${gameCode}`);
            } else {
                ws.send(JSON.stringify({ type: "error", message: "Game not found" }));
                console.log(`Join attempt failed: Game "${gameCode}" does not exist.`);
            }
        }

        else if (data.type === "submitWord") {
            let { gameCode, word } = data;
            gameCode = gameCode.trim().toUpperCase();

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
            let game = games[gameCode];
            game.players = game.players.filter(p => clients[p.id] !== ws);
        });
        console.log("A player disconnected");
    });
});

// **Broadcast function** - sends updates to all players in a game
function broadcast(gameCode, message) {
    if (!games[gameCode]) return;
    games[gameCode].players.forEach(player => {
        const playerSocket = clients[player.id];
        if (playerSocket) {
            playerSocket.send(JSON.stringify(message));
        }
    });
}

console.log("WebSocket server running...");
//kyse