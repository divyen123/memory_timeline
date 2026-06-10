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

  thumbnails: {
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

memorySchema.index({userId:1, date:-1});
memorySchema.index({userId:1, category:1, date:-1});
memorySchema.index({userId:1, favorite:1, date:-1});
memorySchema.index({publicToken:1}, {sparse:true});

module.exports = mongoose.model("Memory",memorySchema);
