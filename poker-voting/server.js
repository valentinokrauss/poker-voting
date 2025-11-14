// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Estructura en memoria: rooms[roomId] = { revealed: bool, participants: { socketId: { name, vote, hasVoted } } }
const rooms = {};

function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  socket.on('createRoom', (callback) => {
    let roomId;
    do {
      roomId = generateRoomId();
    } while (rooms[roomId]);

    rooms[roomId] = {
      revealed: false,
      participants: {}
    };

    callback({ roomId });
  });

  socket.on('joinRoom', ({ roomId, name }, callback) => {
    roomId = (roomId || '').toUpperCase();
    const room = rooms[roomId];

    if (!room) {
      return callback({ error: 'La sala no existe.' });
    }

    socket.join(roomId);
    room.participants[socket.id] = {
      name: name || 'Anónimo',
      vote: null,
      hasVoted: false
    };

    callback({ success: true, roomId });

    // Enviamos el estado actualizado a los clientes de la sala
    io.to(roomId).emit('roomState', {
      revealed: room.revealed,
      participants: formatParticipants(room.participants)
    });
  });

  socket.on('vote', ({ roomId, value }) => {
    const room = rooms[roomId];
    if (!room || !room.participants[socket.id]) return;

    room.participants[socket.id].vote = value;
    room.participants[socket.id].hasVoted = true;

    io.to(roomId).emit('roomState', {
      revealed: room.revealed,
      participants: formatParticipants(room.participants)
    });
  });

  socket.on('revealVotes', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.revealed = true;
    io.to(roomId).emit('roomState', {
      revealed: room.revealed,
      participants: formatParticipants(room.participants)
    });
  });

  socket.on('resetVotes', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.revealed = false;
    Object.values(room.participants).forEach((p) => {
      p.vote = null;
      p.hasVoted = false;
    });

    io.to(roomId).emit('roomState', {
      revealed: room.revealed,
      participants: formatParticipants(room.participants)
    });
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);

    // Eliminar participante de cualquier sala en la que esté
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.participants[socket.id]) {
        delete room.participants[socket.id];

        io.to(roomId).emit('roomState', {
          revealed: room.revealed,
          participants: formatParticipants(room.participants)
        });

        // Si la sala queda vacía, la borramos
        if (Object.keys(room.participants).length === 0) {
          delete rooms[roomId];
        }
        break;
      }
    }
  });
});

function formatParticipants(participantsObj) {
  return Object.entries(participantsObj).map(([id, p]) => ({
    id,
    name: p.name,
    vote: p.vote,
    hasVoted: p.hasVoted
  }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
