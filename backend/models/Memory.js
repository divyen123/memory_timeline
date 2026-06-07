const mongoose = require("mongoose");

const memorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  title: {
    type: String,
    required: true
  },

  description: {
    type: String,
    required: true
  },

  date: {
    type: Date,
    required: true
  },

  image: {
    type: String
  },

  images: {
    type: [String],
    default: []
  },

  category: {
    type: String,
    default: "Personal"
  },

  reminderDate: {
    type: Date
  },

  favorite: {
    type: Boolean,
    default: false
  },

  publicToken: {
    type: String
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Memory",memorySchema);
