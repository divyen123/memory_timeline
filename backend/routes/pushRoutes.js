const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const PushSubscription = require("../models/PushSubscription");
const PushDelivery = require("../models/PushDelivery");
const {
  getEndpointHashForRemoval,
  getVapidPublicKey,
  isPushConfigured,
  sanitizeUserAgent,
  validatePushSubscription
} = require("../services/pushNotificationService");
const { securityInfo, securityWarn } = require("../securityLogger");

const router = express.Router();
const configuredMaxSubscriptions = Number(process.env.MAX_PUSH_SUBSCRIPTIONS_PER_USER || 20);
const MAX_PUSH_SUBSCRIPTIONS_PER_USER = Number.isInteger(configuredMaxSubscriptions)
  ? Math.min(Math.max(configuredMaxSubscriptions, 1), 100)
  : 20;

router.use(authMiddleware);

router.get("/config", (req, res) => {
  res.json({
    enabled:isPushConfigured(),
    publicKey:getVapidPublicKey()
  });
});

router.post("/subscriptions", async(req, res) => {
  try{
    if(!isPushConfigured()){
      return res.status(503).json({message:"Push notifications are not configured"});
    }

    const normalized = validatePushSubscription(req.body?.subscription, req.body?.timeZone);
    const existingSubscription = await PushSubscription.findOne({
      endpointHash:normalized.endpointHash
    }).select("userId").lean();
    const endpointAlreadyBelongsToUser = existingSubscription &&
      String(existingSubscription.userId) === String(req.user.userId);

    if(!endpointAlreadyBelongsToUser){
      const activeSubscriptionCount = await PushSubscription.countDocuments({
        userId:req.user.userId,
        enabled:true
      });

      if(activeSubscriptionCount >= MAX_PUSH_SUBSCRIPTIONS_PER_USER){
        return res.status(409).json({message:"Push notification device limit reached"});
      }
    }

    const now = new Date();
    const savedSubscription = await PushSubscription.findOneAndUpdate(
      {endpointHash:normalized.endpointHash},
      {$set:{
        userId:req.user.userId,
        endpoint:normalized.endpoint,
        keys:normalized.keys,
        expirationTime:normalized.expirationTime,
        enabled:true,
        timeZone:normalized.timeZone,
        userAgent:sanitizeUserAgent(req.get("user-agent")),
        lastSeenAt:now,
        failureCount:0,
        lastSuccessAt:null,
        lastFailureAt:null
      }},
      {new:true, upsert:true, setDefaultsOnInsert:true}
    ).select("_id userId enabled timeZone");

    await PushDelivery.deleteMany({
      subscriptionId:savedSubscription._id,
      userId:mongoose.trusted({$ne:req.user.userId})
    });

    securityInfo("push_subscription_registered", {
      userId:String(req.user.userId),
      subscriptionId:String(savedSubscription._id)
    });

    return res.status(201).json({
      subscribed:true,
      subscriptionId:String(savedSubscription._id),
      timeZone:savedSubscription.timeZone
    });
  }catch(error){
    if(error.status){
      return res.status(error.status).json({message:error.message});
    }

    securityWarn("push_subscription_registration_failed", {
      userId:String(req.user.userId)
    });
    return res.status(500).json({message:"Unable to register push notifications"});
  }
});

router.delete("/subscriptions", async(req, res) => {
  try{
    const endpointHash = getEndpointHashForRemoval(req.body?.endpoint);
    const subscription = await PushSubscription.findOneAndDelete({
      userId:req.user.userId,
      endpointHash
    }).select("_id");

    if(subscription){
      await PushDelivery.deleteMany({subscriptionId:subscription._id});
      securityInfo("push_subscription_removed", {
        userId:String(req.user.userId),
        subscriptionId:String(subscription._id)
      });
    }

    return res.status(204).end();
  }catch(error){
    if(error.status){
      return res.status(error.status).json({message:error.message});
    }

    securityWarn("push_subscription_removal_failed", {
      userId:String(req.user.userId)
    });
    return res.status(500).json({message:"Unable to remove push notifications"});
  }
});

module.exports = router;
