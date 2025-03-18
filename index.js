const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const server = new WebSocket.Server({ port: process.env.PORT || 3000 });

let games = {}; // Stores active games and players

server.on("connection", (ws) => {
    console.log("A player connected");

    ws.on("message", (message) => {
        const data = JSON.parse(message);

        if (data.type === "create-game") {
            const gameCode = uuidv4().slice(0, 6); // Generate a 6-char game code
            games[gameCode] = { players: [], turnIndex: 0, usedWords: new Set() };
            ws.send(JSON.stringify({ type: "game-created", gameCode }));
        }

        else if (data.type === "join-game") {
            const { gameCode, playerName } = data;
            if (games[gameCode]) {
                games[gameCode].players.push({ name: playerName, ws, lives: 3 });
                games[gameCode].players.forEach(p => p.ws.send(JSON.stringify({ type: "player-joined", players: games[gameCode].players.map(p => p.name) })));
            } else {
                ws.send(JSON.stringify({ type: "error", message: "Game not found" }));
            }
        }

        else if (data.type === "submit-word") {
            const { gameCode, word, playerName } = data;
            if (!games[gameCode]) return;

            let game = games[gameCode];
            if (game.usedWords.has(word)) {
                ws.send(JSON.stringify({ type: "error", message: "Word already used!" }));
                return;
            }

            game.usedWords.add(word);
            game.turnIndex = (game.turnIndex + 1) % game.players.length;

            game.players.forEach(p => p.ws.send(JSON.stringify({ type: "next-turn", currentPlayer: game.players[game.turnIndex].name })));
        }
    });
});

console.log("WebSocket server running...");