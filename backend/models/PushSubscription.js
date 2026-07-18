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
    maxlength:4096,
    select:false
  },
  endpointHash:{
    type:String,
    required:true,
    match:/^[a-f0-9]{64}$/,
    unique:true
  },
  keys:{
    p256dh:{
      type:String,
      required:true,
      maxlength:1024,
      select:false
    },
    auth:{
      type:String,
      required:true,
      maxlength:256,
      select:false
    }
  },
  expirationTime:{
    type:Date,
    default:null
  },
  enabled:{
    type:Boolean,
    default:true,
    index:true
  },
  timeZone:{
    type:String,
    required:true,
    maxlength:100
  },
  userAgent:{
    type:String,
    maxlength:512,
    default:""
  },
  lastSeenAt:{
    type:Date,
    default:Date.now
  },
  lastSuccessAt:{
    type:Date,
    default:null
  },
  lastFailureAt:{
    type:Date,
    default:null
  },
  failureCount:{
    type:Number,
    min:0,
    default:0
  }
}, {
  timestamps:true
});

pushSubscriptionSchema.index({userId:1, enabled:1});
pushSubscriptionSchema.index({expirationTime:1});

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
