const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const server = new WebSocket.Server({ port: process.env.PORT || 3000 });

let games = {};

const letterCombos = [
    "ab", "br", "ch", "dr", "ex", "fl", "gr", "in", "kn", "li", "mi", "ne", "op", "ph", "qu", "re", "st", "th", "un", "wh",
    "ck", "ed", "er", "es", "ic", "ing", "le", "ly", "nt", "ous", "sh",
    "ai", "ea", "ee", "ie", "oo", "ou", "th", "qu", "zz"
];

function getRandomCombo() {
    return letterCombos[Math.floor(Math.random() * letterCombos.length)];
}

server.on('connection', (ws) => {
    console.log("A player connected");

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log("Received message:", data);

            switch (data.type) {
                case 'createGame':
                    handleCreateGame(ws, data);
                    break;
                case 'joinGame':
                    handleJoinGame(ws, data);
                    break;
                case 'submitWord':
                    handleSubmitWord(ws, data);
                    break;
                case 'timeOut':
                    handleTimeOut(data);
                    break;
                default:
                    console.log("Unknown message type:", data.type);
            }
        } catch (error) {
            console.error("Error handling message:", error);
        }
    });

    ws.on('close', () => {
        handlePlayerDisconnect(ws);
    });
});

function handleCreateGame(ws, data) {
    const gameCode = uuidv4().slice(0, 6).toUpperCase();
    games[gameCode] = {
        players: [],
        turnIndex: 0,
        usedWords: new Set(),
        currentCombo: getRandomCombo()
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
    const { gameCode, word, playerName } = data;
    if (!games[gameCode]) return;

    let game = games[gameCode];
    let currentPlayer = game.players[game.turnIndex];

    if (currentPlayer.name !== playerName) {
        ws.send(JSON.stringify({ type: "error", message: "It's not your turn!" }));
        return;
    }

    if (game.usedWords.has(word)) {
        ws.send(JSON.stringify({ type: "error", message: "Word already used!" }));
        return;
    }

    if (!word.includes(game.currentCombo)) {
        ws.send(JSON.stringify({ type: "error", message: `Word must contain '${game.currentCombo}'!` }));
        return;
    }

    game.usedWords.add(word);
    nextTurn(gameCode);
}

function handleTimeOut(data) {
    const { gameCode } = data;
    if (!games[gameCode]) return;

    let game = games[gameCode];
    let currentPlayer = game.players[game.turnIndex];

    currentPlayer.lives--;
    console.log(`${currentPlayer.name}'s lives reduced to ${currentPlayer.lives}`);

    if (currentPlayer.lives <= 0) {
        game.players = game.players.filter(p => p !== currentPlayer);
        console.log(`${currentPlayer.name} has been eliminated`);
    }

    if (game.players.length <= 1) {
        endGame(gameCode);
    } else {
        nextTurn(gameCode);
    }
}

function nextTurn(gameCode) {
    let game = games[gameCode];
    do {
        game.turnIndex = (game.turnIndex + 1) % game.players.length;
    } while (game.players[game.turnIndex].lives <= 0);

    game.currentCombo = getRandomCombo();
    broadcastGameState(gameCode);
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
        currentIndex: games[gameCode].turnIndex,
        currentCombo: games[gameCode].currentCombo
    });
}

function broadcastToGame(gameCode, message) {
    if (!games[gameCode]) return;
    games[gameCode].players.forEach(player => {
        try {
            player.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error("Error sending message to player:", error);
        }
    });
}

function endGame(gameCode) {
    let winner = games[gameCode].players[0];
    broadcastToGame(gameCode, {
        type: "gameOver",
        winner: winner.name
    });
    delete games[gameCode];
}

console.log("WebSocket server running on port", process.env.PORT || 3000);
