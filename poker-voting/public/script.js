// script.js
const socket = io();

// Elementos del DOM
const setupSection = document.getElementById('setup-section');
const roomSection = document.getElementById('room-section');

const nameInput = document.getElementById('name-input');
const roomIdInput = document.getElementById('room-id-input');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const setupError = document.getElementById('setup-error');

const roomIdLabel = document.getElementById('room-id-label');
const shareLinkEl = document.getElementById('share-link');

const revealBtn = document.getElementById('reveal-btn');
const resetBtn = document.getElementById('reset-btn');

const voteButtons = document.querySelectorAll('.vote-btn');
const yourVoteLabel = document.getElementById('your-vote-label');

const participantsList = document.getElementById('participants-list');

let currentRoomId = null;
let currentVote = null;

// Si hay ?room= en la URL, lo ponemos en el input
const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');
if (roomFromUrl) {
  roomIdInput.value = roomFromUrl.toUpperCase();
}

// Helpers
function setError(msg) {
  setupError.textContent = msg || '';
}

function switchToRoomView(roomId) {
  currentRoomId = roomId;
  roomIdLabel.textContent = roomId;
  const link = `${window.location.origin}?room=${roomId}`;
  shareLinkEl.textContent = link;

  // Actualizamos la URL del navegador sin recargar
  const newUrl = `${window.location.pathname}?room=${roomId}`;
  window.history.replaceState({}, '', newUrl);

  setupSection.classList.add('hidden');
  roomSection.classList.remove('hidden');
}

function updateVoteButtonsSelection() {
  voteButtons.forEach((btn) => {
    const value = btn.getAttribute('data-value');
    btn.classList.toggle('selected', value === String(currentVote));
  });
}

// Eventos de UI
createRoomBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) {
    setError('Escribe tu nombre para crear la sala.');
    return;
  }
  setError('');

  socket.emit('createRoom', ({ roomId }) => {
    // Una vez creada la sala, nos unimos a ella
    socket.emit('joinRoom', { roomId, name }, (res) => {
      if (res.error) {
        setError(res.error);
        return;
      }
      switchToRoomView(roomId);
    });
  });
});

joinRoomBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  const roomId = roomIdInput.value.trim().toUpperCase();

  if (!name) {
    setError('Escribe tu nombre para unirte a la sala.');
    return;
  }
  if (!roomId) {
    setError('Escribe el ID de la sala.');
    return;
  }
  setError('');

  socket.emit('joinRoom', { roomId, name }, (res) => {
    if (res.error) {
      setError(res.error);
      return;
    }
    switchToRoomView(roomId);
  });
});

voteButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!currentRoomId) return;
    const value = parseInt(btn.getAttribute('data-value'), 10);
    currentVote = value;
    updateVoteButtonsSelection();
    yourVoteLabel.textContent = `Tu voto: ${value}`;

    socket.emit('vote', { roomId: currentRoomId, value });
  });
});

revealBtn.addEventListener('click', () => {
  if (!currentRoomId) return;
  socket.emit('revealVotes', currentRoomId);
});

resetBtn.addEventListener('click', () => {
  if (!currentRoomId) return;
  currentVote = null;
  updateVoteButtonsSelection();
  yourVoteLabel.textContent = 'Aún no has votado.';
  socket.emit('resetVotes', currentRoomId);
});

// Eventos de Socket.IO
socket.on('roomState', ({ revealed, participants }) => {
  // Actualizar lista de participantes
  participantsList.innerHTML = '';
  participants.forEach((p) => {
    const li = document.createElement('li');

    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    nameSpan.className = 'participant-name';

    const voteSpan = document.createElement('span');
    voteSpan.className = 'participant-vote';

    if (revealed) {
      voteSpan.textContent = p.vote !== null ? p.vote : '-';
      voteSpan.classList.add('revealed');
    } else {
      // Votos ocultos: mostramos solo si ha votado o no
      voteSpan.textContent = p.hasVoted ? '✔ votó' : '…';
      voteSpan.classList.add('hidden-vote');
    }

    li.appendChild(nameSpan);
    li.appendChild(voteSpan);
    participantsList.appendChild(li);
  });
});
