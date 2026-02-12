const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [1, 'Username must be at least 1 character'],
  },
  firstname: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
  },
  lastname: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [1, 'Password must be at least 1 character'],
  },
  createon: {
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

module.exports = mongoose.model('User', userSchema);
