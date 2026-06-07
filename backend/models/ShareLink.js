const mongoose = require("mongoose");

const shareLinkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  type: {
    type: String,
    enum: ["memory","category"],
    required: true
  },

  memoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Memory"
  },

  category: {
    type: String
  },

  token: {
    type: String,
    required: true,
    unique: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("ShareLink",shareLinkSchema);
