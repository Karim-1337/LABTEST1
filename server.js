require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const GroupMessage = require('./models/GroupMessage');
const PrivateMessage = require('./models/PrivateMessage');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ROOMS = ['devops', 'cloud computing', 'covid19', 'sports', 'nodeJS'];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'view')));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat_app';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'index.html'));
});

app.post('/api/signup', async (req, res) => {
  try {
    const { username, firstname, lastname, password } = req.body;
    if (!username || !firstname || !lastname || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username: username.trim(),
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      password: hashedPassword,
    });
    await user.save();
    res.json({ success: true, message: 'Account created successfully' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }
    res.status(500).json({ success: false, message: err.message || 'Signup failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }
    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
    res.json({
      success: true,
      user: {
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Login failed' });
  }
});

app.get('/api/rooms', (req, res) => {
  res.json({ rooms: ROOMS });
});

const roomUsers = {};
const socketToUser = new Map();

io.on('connection', (socket) => {
  socket.on('join', async (data) => {
    var username = data.username;
    var room = data.room;
    if (!username || !room) return;
    var r = room.trim();
    if (ROOMS.indexOf(r) === -1) return;

    socket.username = username;
    socket.room = r;
    socketToUser.set(socket.id, { username: username, room: r });

    if (!roomUsers[r]) roomUsers[r] = new Set();
    roomUsers[r].add(username);
    socket.join(r);

    io.to(r).emit('user_joined', { username: username, members: Array.from(roomUsers[r]) });
    socket.emit('room_joined', { room: r, members: Array.from(roomUsers[r]) });

    const recent = await GroupMessage.find({ room: r }).sort({ _id: -1 }).limit(50).lean();
    socket.emit('message_history', recent.reverse());
  });

  socket.on('leave_room', () => {
    const data = socketToUser.get(socket.id);
    if (!data) return;
    const username = data.username;
    const room = data.room;
    if (roomUsers[room]) {
      roomUsers[room].delete(username);
      if (roomUsers[room].size === 0) delete roomUsers[room];
    }
    socket.leave(room);
    socketToUser.delete(socket.id);
    var membersLeft = roomUsers[room] ? Array.from(roomUsers[room]) : [];
    io.to(room).emit('user_left', { username: username, members: membersLeft });
    socket.username = null;
    socket.room = null;
  });

  socket.on('send_message', async (msg) => {
    const data = socketToUser.get(socket.id);
    if (!data || !msg || !msg.trim()) return;
    const username = data.username;
    const room = data.room;
    const doc = new GroupMessage({
      from_user: username,
      room: room,
      message: msg.trim(),
    });
    await doc.save();
    io.to(room).emit('new_message', {
      _id: doc._id.toString(),
      from_user: doc.from_user,
      room: doc.room,
      message: doc.message,
      date_sent: doc.date_sent,
    });
  });

  socket.on('typing', () => {
    const data = socketToUser.get(socket.id);
    if (!data) return;
    socket.to(data.room).emit('user_typing', { username: data.username });
  });

  socket.on('stop_typing', () => {
    const data = socketToUser.get(socket.id);
    if (!data) return;
    socket.to(data.room).emit('user_stop_typing', { username: data.username });
  });

  socket.on('disconnect', () => {
    const data = socketToUser.get(socket.id);
    if (data) {
      const username = data.username;
      const room = data.room;
      if (roomUsers[room]) {
        roomUsers[room].delete(username);
        if (roomUsers[room].size === 0) delete roomUsers[room];
      }
      var membersLeft = roomUsers[room] ? Array.from(roomUsers[room]) : [];
      socket.to(room).emit('user_left', { username: username, members: membersLeft });
      socketToUser.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
