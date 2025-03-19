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

    game.usedWords.add(word);
    nextTurn(gameCode);
}

function handleTimeOut(data) {
    const { gameCode } = data;
    if (!games[gameCode]) return;

    let game = games[gameCode];
    let currentPlayer = game.players[game.turnIndex];
    currentPlayer.lives--;

    if (currentPlayer.lives <= 0) {
        removePlayer(gameCode, currentPlayer);
    }

    nextTurn(gameCode);
}

function nextTurn(gameCode) {
    let game = games[gameCode];
    do {
        game.turnIndex = (game.turnIndex + 1) % game.players.length;
    } while (game.players[game.turnIndex].lives <= 0);

    broadcastGameState(gameCode);
}

function removePlayer(gameCode, player) {
    let game = games[gameCode];
    game.players = game.players.filter(p => p !== player);
    if (game.players.length <= 1) {
        endGame(gameCode);
    }
}

function endGame(gameCode) {
    let winner = games[gameCode].players[0];
    broadcastToGame(gameCode, { type: "gameOver", winner: winner.name });
    delete games[gameCode];
}
