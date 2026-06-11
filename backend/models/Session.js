const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User",
    required:true,
    index:true
  },
  refreshTokenHash:{
    type:String,
    required:true,
    unique:true
  },
  expiresAt:{
    type:Date,
    required:true,
    index:{expires:0}
  },
  createdAt:{
    type:Date,
    default:Date.now
  },
  lastUsedAt:{
    type:Date,
    default:Date.now
  },
  ip:{
    type:String,
    default:""
  },
  userAgent:{
    type:String,
    default:""
  }
});

module.exports = mongoose.model("Session", sessionSchema);
