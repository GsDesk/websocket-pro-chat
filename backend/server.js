const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // En producción se debe restringir al dominio correcto
    methods: ["GET", "POST"]
  }
});

// Estructura para tener seguimiento de los usuarios y administradores online
const activeUsers = new Map(); // socket.id -> { id, name, role }

io.on('connection', (socket) => {
  console.log(`Nuevo cliente conectado: ${socket.id}`);

  // Evento para registrar el usuario/admin
  socket.on('register', (data) => {
    const { name, role } = data; // role: 'user' o 'admin'
    
    const userObj = { id: socket.id, name, role };
    activeUsers.set(socket.id, userObj);

    if (role === 'admin') {
      socket.join('adminGroup');
      console.log(`Admin registrado: ${name} (${socket.id})`);
      // Enviar la lista de usuarios activos para que el admin pueda verlos
      const usersList = Array.from(activeUsers.values()).filter(u => u.role === 'user');
      socket.emit('active_users', usersList);
    } else {
      // Es un usuario normal, su propia sala es su ID por defecto en socket.io
      console.log(`Usuario registrado: ${name} (${socket.id})`);
      // Notificar a los administradores que hay un nuevo usuario
      io.to('adminGroup').emit('user_joined', userObj);
    }
  });

  // Manejo de mensajes
  socket.on('send_message', (data) => {
    const sender = activeUsers.get(socket.id);
    if (!sender) return;

    // data = { targetId, content }
    // Si targetId es null, es un usuario enviando un mensaje al soporte (admins)
    // Si targetId tiene un valor, es el admin enviándole a un usuario específico.
    
    const messagePayload = {
      from: sender.id,
      name: sender.name,
      role: sender.role,
      content: data.content,
      timestamp: new Date().toISOString()
    };

    if (sender.role === 'user') {
      // El usuario envía un mensaje
      // Se lo reenviamos a la sala de admins y también de vuelta al propio usuario (para su historial visual)
      io.to('adminGroup').emit('new_message', messagePayload);
      socket.emit('new_message', messagePayload);
    } else if (sender.role === 'admin') {
      // El admin envía un mensaje a un usuario específico
      if (data.targetId) {
        // Enviar al usuario específico
        io.to(data.targetId).emit('new_message', messagePayload);
        // También notificar a los demás admins (o a él mismo) para que el chat en grupo esté sincrónico
        io.to('adminGroup').emit('new_message', { ...messagePayload, targetId: data.targetId });
      }
    }
  });

  // Manejo de desconexión
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      console.log(`${user.role} desconectado: ${user.name} (${socket.id})`);
      if (user.role === 'user') {
        io.to('adminGroup').emit('user_left', user.id);
      }
      activeUsers.delete(socket.id);
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor de WebSocket corriendo en http://localhost:${PORT}`);
});
