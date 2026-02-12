const mongoose = require('mongoose');

const groupMessageSchema = new mongoose.Schema({
  from_user: {
    type: String,
    required: [true, 'Sender username is required'],
    trim: true,
  },
  room: {
    type: String,
    required: [true, 'Room name is required'],
    trim: true,
  },
  message: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
  },
  date_sent: {
    type: String,
    default: () => {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const year = now.getFullYear();
      const hours = now.getHours() % 12 || 12;
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
      return `${month}-${day}-${year} ${hours}:${minutes} ${ampm}`;
    },
  },
});

module.exports = mongoose.model('GroupMessage', groupMessageSchema);
