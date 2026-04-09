import { io } from "socket.io-client";

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username');
const serverUrlInput = document.getElementById('server-url');
const roleSelect = document.getElementById('role');
const joinBtn = document.getElementById('join-btn');
const leaveBtn = document.getElementById('leave-btn');

const myRoleBadge = document.getElementById('my-role-badge');
const sidebar = document.getElementById('sidebar');
const usersList = document.getElementById('users-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const replyingToSpan = document.getElementById('replying-to');
const cancelReplyBtn = document.getElementById('cancel-reply');

// State
let socket = null;
let currentRole = null;
let currentName = null;
let targetUserId = null; // Para que el admin sepa a quién responde
let connectedUsers = []; // [{ id, name, role }]

// Conectar mediante click
joinBtn.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  const serverUrl = serverUrlInput.value.trim();
  const role = roleSelect.value;

  if (!name) {
    alert("Por favor ingresa tu nombre.");
    return;
  }
  
  if (!serverUrl) {
    alert("Por favor ingresa la URL del servidor.");
    return;
  }

  currentName = name;
  currentRole = role;

  // Modificar UI
  loginScreen.style.display = 'none';
  chatScreen.style.display = 'flex';
  myRoleBadge.textContent = role === 'admin' ? `Admin: ${name}` : `Usuario: ${name}`;

  if (role === 'admin') {
    sidebar.classList.remove('hidden');
    myRoleBadge.style.color = "#10b981";
    myRoleBadge.style.borderColor = "#10b981";
    myRoleBadge.style.background = "rgba(16, 185, 129, 0.2)";
  } else {
    sidebar.classList.add('hidden');
  }

  // Inicializar Socket.io
  initSocket(name, role, serverUrl);
});

leaveBtn.addEventListener('click', () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  // Reset UI
  loginScreen.style.display = 'block';
  chatScreen.style.display = 'none';
  messagesContainer.innerHTML = '';
  usersList.innerHTML = '';
  usernameInput.value = '';
  targetUserId = null;
  replyingToSpan.classList.add('hidden');
});

function initSocket(name, role, serverUrl) {
  // Conectar al backend usando la URL brindada por el usuario en el formulario
  socket = io(serverUrl);

  socket.on('connect', () => {
    console.log("Conectado al servidor WebSocket.");
    socket.emit('register', { name, role });
  });

  socket.on('active_users', (users) => {
    connectedUsers = users;
    renderUserList();
  });

  socket.on('user_joined', (user) => {
    connectedUsers.push(user);
    renderUserList();
    if(currentRole === 'admin') {
      appendSystemMessage(`${user.name} se ha unido.`);
    }
  });

  socket.on('user_left', (userId) => {
    const u = connectedUsers.find(x => x.id === userId);
    if(u) {
      connectedUsers = connectedUsers.filter(x => x.id !== userId);
      renderUserList();
      if(currentRole === 'admin') {
        appendSystemMessage(`${u.name} se ha desconectado.`);
      }
      if (targetUserId === userId) {
        cancelReply();
      }
    }
  });

  socket.on('new_message', (payload) => {
    // payload = { from, name, role, content, timestamp, targetId? }
    const isSelf = payload.from === socket.id;
    appendMessage(payload.name, payload.content, isSelf, payload.role);
  });
}

function renderUserList() {
  usersList.innerHTML = '';
  connectedUsers.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u.name;
    li.dataset.id = u.id;
    
    if (targetUserId === u.id) {
      li.classList.add('selected');
    }

    li.addEventListener('click', () => {
      document.querySelectorAll('#users-list li').forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');
      targetUserId = u.id;
      replyingToSpan.classList.remove('hidden');
      replyingToSpan.querySelector('b').textContent = u.name;
    });

    usersList.appendChild(li);
  });
}

// Logic para enviar mensaje
function sendMessage() {
  const content = messageInput.value.trim();
  if (!content) return;

  if (currentRole === 'admin' && !targetUserId) {
    alert("Por favor selecciona un usuario al cual responderle desde el panel izquierdo.");
    return;
  }

  const payload = {
    content,
    targetId: currentRole === 'admin' ? targetUserId : null 
  };

  socket.emit('send_message', payload);
  messageInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// Cancelar repuesta a un user (Admin)
cancelReplyBtn.addEventListener('click', cancelReply);

function cancelReply() {
  targetUserId = null;
  replyingToSpan.classList.add('hidden');
  document.querySelectorAll('#users-list li').forEach(el => el.classList.remove('selected'));
}

// Renderizar mensajes en el DOM
function appendMessage(senderName, content, isSelf, role) {
  const div = document.createElement('div');
  div.classList.add('msg-bubble');
  div.classList.add(isSelf ? 'self' : 'other');

  const senderSpan = document.createElement('span');
  senderSpan.classList.add('msg-sender');
  senderSpan.textContent = isSelf ? 'Tú' : `${senderName} (${role})`;

  const textNode = document.createTextNode(content);

  div.appendChild(senderSpan);
  div.appendChild(textNode);

  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function appendSystemMessage(content) {
  const div = document.createElement('div');
  div.style.textAlign = 'center';
  div.style.color = 'var(--text-muted)';
  div.style.fontSize = '0.8rem';
  div.style.margin = '10px 0';
  div.textContent = content;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
