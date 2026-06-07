const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  name:{
    type:String,
    trim:true,
    default:""
  },

  age:{
    type:Number,
    min:0,
    default:null
  },

  email:{
    type:String,
    required:true,
    unique:true
  },

  password:{
    type:String,
    required:true
  }

});

module.exports = mongoose.model("User",userSchema);
