const mongoose = require("mongoose");

const pushDeliverySchema = new mongoose.Schema({
  userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User",
    required:true,
    index:true
  },
  memoryId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Memory",
    required:true,
    index:true
  },
  subscriptionId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"PushSubscription",
    required:true,
    index:true
  },
  reminderDateKey:{
    type:String,
    required:true,
    match:/^\d{4}-\d{2}-\d{2}$/
  },
  status:{
    type:String,
    enum:["pending", "processing", "retry", "sent", "failed"],
    default:"pending",
    index:true
  },
  attempts:{
    type:Number,
    min:0,
    default:0
  },
  nextAttemptAt:{
    type:Date,
    default:Date.now
  },
  leaseUntil:{
    type:Date,
    default:null
  },
  sentAt:{
    type:Date,
    default:null
  },
  lastStatusCode:{
    type:Number,
    default:null
  },
  failureReason:{
    type:String,
    enum:["", "transient", "permanent"],
    default:""
  },
  expiresAt:{
    type:Date,
    required:true
  }
}, {
  timestamps:true
});

pushDeliverySchema.index(
  {subscriptionId:1, memoryId:1, reminderDateKey:1},
  {unique:true}
);
pushDeliverySchema.index({status:1, nextAttemptAt:1, leaseUntil:1});
pushDeliverySchema.index({expiresAt:1}, {expireAfterSeconds:0});

module.exports = mongoose.model("PushDelivery", pushDeliverySchema);
