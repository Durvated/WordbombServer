const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
let players = [];
let currentTurn = 0;
let gameStarted = false;

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'join') {
            if (players.length < 6) {
                players.push({ ws, name: data.name, lives: 3 });
                broadcast({ type: 'players', players: players.map(p => ({ name: p.name, lives: p.lives })) });
                if (players.length > 1 && !gameStarted) startGame();
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Game is full!' }));
            }
        } else if (data.type === 'word') {
            handleWordSubmission(data.word);
        }
    });

    ws.on('close', () => {
        players = players.filter(p => p.ws !== ws);
        broadcast({ type: 'players', players: players.map(p => ({ name: p.name, lives: p.lives })) });
    });
});

function startGame() {
    gameStarted = true;
    broadcast({ type: 'start' });
    nextTurn();
}

function nextTurn() {
    if (players.length === 0) return;
    currentTurn = (currentTurn + 1) % players.length;
    broadcast({ type: 'turn', name: players[currentTurn].name });
}

function handleWordSubmission(word) {
    broadcast({ type: 'word', word });
    nextTurn();
}

function broadcast(data) {
    players.forEach(player => player.ws.send(JSON.stringify(data)));
}

console.log('WebSocket server running on ws://localhost:8080');
