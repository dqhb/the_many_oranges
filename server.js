const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let players = {};
let platforms = [];

// Generate initial platforms
for (let i = 0; i < 20; i++) {
    platforms.push({ x: i * 300, y: 400 + Math.random() * 200, w: 200 });
}

io.on('connection', (socket) => {
    console.log('Orange joined:', socket.id);
    players[socket.id] = { x: 100, y: 100, color: `hsl(${Math.random() * 360}, 70%, 50%)` };

    // Send world data to new player
    socket.emit('init', { players, platforms });

    // Tell others a new player joined
    socket.broadcast.emit('newPlayer', { id: socket.id, data: players[socket.id] });

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            socket.broadcast.emit('updatePlayer', { id: socket.id, x: data.x, y: data.y });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('removePlayer', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
