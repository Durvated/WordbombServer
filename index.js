// Modified createGame handler
if (data.type === "createGame") {
    const gameCode = uuidv4().slice(0, 6);
    games[gameCode] = {
        players: [],
        turnIndex: 0,
        usedWords: new Set(),
        pendingPlayer: {  // Store creator temporarily
            ws: ws,
            name: data.playerName
        }
    };
    ws.send(JSON.stringify({
        type: "game-created",
        gameCode: gameCode
    }));
}

// New handler for finalizing game creation
socket.on('message', message => {
    const data = JSON.parse(message);
    if (data.type === "confirmGameCreation") {
        const game = games[data.gameCode];
        if (game && game.pendingPlayer) {
            game.players.push({
                name: game.pendingPlayer.name,
                ws: game.pendingPlayer.ws,
                lives: 3
            });
            delete game.pendingPlayer;
        }
    }
});
