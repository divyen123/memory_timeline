const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema({
  userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User",
    required:true,
    index:true
  },
  endpoint:{
    type:String,
    required:true,
    unique:true
  },
  keys:{
    p256dh:{type:String, required:true},
    auth:{type:String, required:true}
  },
  userAgent:{
    type:String,
    default:""
  },
  sentReminderKeys:{
    type:[String],
    default:[]
  },
  createdAt:{
    type:Date,
    default:Date.now
  },
  updatedAt:{
    type:Date,
    default:Date.now
  }
});

pushSubscriptionSchema.index({userId:1, endpoint:1});

pushSubscriptionSchema.pre("save", function updateTimestamp(next){
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
