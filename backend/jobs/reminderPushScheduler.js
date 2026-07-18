const crypto = require("crypto");
const mongoose = require("mongoose");
const Memory = require("../models/Memory");
const User = require("../models/User");
const PushSubscription = require("../models/PushSubscription");
const PushDelivery = require("../models/PushDelivery");
const {
  deletePushSubscriptionById,
  isPushConfigured,
  sendPushNotification
} = require("../services/pushNotificationService");
const { securityInfo, securityWarn, securityError } = require("../securityLogger");

const HIDDEN_IMAGE_MEMORY_TITLE = "app/hide-image/";
const DEFAULT_REMINDER_LEAD_DAYS = 2;
const MAX_REMINDER_LEAD_DAYS = 30;
const DEFAULT_SCAN_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_PUSHES_PER_SCAN = 100;
const DEFAULT_MAX_SUBSCRIPTIONS_PER_SCAN = 500;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LEASE_MS = 2 * 60 * 1000;
const DEFAULT_RETRY_BASE_MS = 5 * 60 * 1000;
const DEFAULT_DELIVERY_RETENTION_DAYS = 90;
const DEFAULT_GRACE_DAYS = 1;
const MAX_DUE_MEMORIES_PER_SUBSCRIPTION = 1000;
const dateFormatters = new Map();

let schedulerId = null;
let scanInProgress = false;

const getBoundedInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  if(!Number.isInteger(parsed)){
    return fallback;
  }
  return Math.min(Math.max(parsed, minimum), maximum);
};

const MAX_PUSHES_PER_SCAN = getBoundedInteger(
  process.env.MAX_REMINDER_PUSHES_PER_SCAN,
  DEFAULT_MAX_PUSHES_PER_SCAN,
  1,
  1000
);
const MAX_SUBSCRIPTIONS_PER_SCAN = getBoundedInteger(
  process.env.MAX_PUSH_SUBSCRIPTIONS_PER_SCAN,
  DEFAULT_MAX_SUBSCRIPTIONS_PER_SCAN,
  1,
  5000
);
const MAX_DELIVERY_ATTEMPTS = getBoundedInteger(
  process.env.MAX_PUSH_DELIVERY_ATTEMPTS,
  DEFAULT_MAX_ATTEMPTS,
  1,
  10
);
const REMINDER_GRACE_DAYS = getBoundedInteger(
  process.env.REMINDER_PUSH_GRACE_DAYS,
  DEFAULT_GRACE_DAYS,
  0,
  7
);
const PUSH_TTL_SECONDS = getBoundedInteger(
  process.env.REMINDER_PUSH_TTL_SECONDS,
  24 * 60 * 60,
  60,
  7 * 24 * 60 * 60
);

const getReminderLeadDays = (user) => {
  const profiles = user?.settingsProfiles || {};
  const candidates = [
    profiles.mobile?.reminderLeadDays,
    profiles.desktop?.reminderLeadDays
  ]
    .map((value)=>Number(value))
    .filter((value)=>Number.isFinite(value));
  const leadDays = candidates.length ? Math.max(...candidates) : DEFAULT_REMINDER_LEAD_DAYS;

  return Math.min(Math.max(Math.trunc(leadDays), 0), MAX_REMINDER_LEAD_DAYS);
};

const getDateFormatter = (timeZone) => {
  if(!dateFormatters.has(timeZone)){
    dateFormatters.set(timeZone, new Intl.DateTimeFormat("en-US", {
      timeZone,
      year:"numeric",
      month:"2-digit",
      day:"2-digit"
    }));
  }
  return dateFormatters.get(timeZone);
};

const getDateKeyInTimeZone = (date, timeZone) => {
  const parts = Object.fromEntries(
    getDateFormatter(timeZone)
      .formatToParts(date)
      .filter((part)=>part.type !== "literal")
      .map((part)=>[part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
};

const shiftDateKey = (dateKey, days) => {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const getReminderDateKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const getDeliveryExpiry = (now = new Date()) => new Date(
  now.getTime() + DEFAULT_DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000
);

const buildEventTopic = (subscriptionId, memoryId, reminderDateKey) => crypto
  .createHash("sha256")
  .update(`${subscriptionId}:${memoryId}:${reminderDateKey}`)
  .digest("hex")
  .slice(0, 32);

const createDelivery = async (subscription, memory, reminderDateKey, now) => {
  const deliveryKey = {
    subscriptionId:subscription._id,
    memoryId:memory._id,
    reminderDateKey
  };

  try{
    await PushDelivery.updateOne(deliveryKey, {
      $setOnInsert:{
        ...deliveryKey,
        userId:subscription.userId,
        status:"pending",
        attempts:0,
        nextAttemptAt:now,
        expiresAt:getDeliveryExpiry(now)
      }
    }, {upsert:true});
  }catch(error){
    if(error?.code !== 11000){
      throw error;
    }
  }

  const leaseMs = getBoundedInteger(
    process.env.PUSH_DELIVERY_LEASE_MS,
    DEFAULT_LEASE_MS,
    30 * 1000,
    15 * 60 * 1000
  );

  return PushDelivery.findOneAndUpdate({
    ...deliveryKey,
    attempts:mongoose.trusted({$lt:MAX_DELIVERY_ATTEMPTS}),
    $or:[
      {status:"pending"},
      {
        status:"retry",
        nextAttemptAt:mongoose.trusted({$lte:now})
      },
      {
        status:"processing",
        leaseUntil:mongoose.trusted({$lte:now})
      }
    ]
  }, {
    $set:{
      status:"processing",
      leaseUntil:new Date(now.getTime() + leaseMs),
      failureReason:""
    },
    $inc:{attempts:1}
  }, {new:true});
};

const getStatusCode = (error) => {
  const statusCode = Number(error?.statusCode);
  return Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599
    ? statusCode
    : null;
};

const isTransientFailure = (statusCode) => (
  statusCode === null ||
  [401, 403, 408, 425, 429].includes(statusCode) ||
  statusCode >= 500
);

const getRetryDelay = (attempts) => {
  const baseMs = getBoundedInteger(
    process.env.PUSH_RETRY_BASE_MS,
    DEFAULT_RETRY_BASE_MS,
    60 * 1000,
    60 * 60 * 1000
  );
  return Math.min(baseMs * (2 ** Math.max(attempts - 1, 0)), 6 * 60 * 60 * 1000);
};

const deliverReminder = async (subscription, memory, reminderDateKey) => {
  const now = new Date();
  const delivery = await createDelivery(subscription, memory, reminderDateKey, now);

  if(!delivery){
    return {attempted:false, sent:false};
  }

  const [activeSubscription, activeMemory] = await Promise.all([
    PushSubscription.exists({
      _id:subscription._id,
      userId:subscription.userId,
      enabled:true
    }),
    Memory.findOne({
      _id:memory._id,
      userId:subscription.userId,
      deletedAt:null,
      hiddenAt:null,
      title:mongoose.trusted({$ne:HIDDEN_IMAGE_MEMORY_TITLE})
    }).select("_id reminderDate").lean()
  ]);

  if(
    !activeSubscription ||
    !activeMemory ||
    getReminderDateKey(activeMemory.reminderDate) !== reminderDateKey
  ){
    await PushDelivery.deleteOne({_id:delivery._id});
    return {attempted:false, sent:false};
  }

  const topic = buildEventTopic(subscription._id, memory._id, reminderDateKey);
  const payload = {
    type:"memory-reminder",
    title:"Memory reminder",
    body:"A memory reminder is ready.",
    url:"/timeline",
    tag:topic
  };

  try{
    await sendPushNotification(subscription, payload, {
      TTL:PUSH_TTL_SECONDS,
      urgency:"normal",
      topic,
      timeout:30 * 1000
    });

    await PushDelivery.updateOne({_id:delivery._id, status:"processing"}, {$set:{
      status:"sent",
      sentAt:new Date(),
      leaseUntil:null,
      nextAttemptAt:null,
      lastStatusCode:null,
      failureReason:"",
      expiresAt:getDeliveryExpiry()
    }});
    await PushSubscription.updateOne({_id:subscription._id}, {$set:{
        lastSuccessAt:new Date(),
        lastFailureAt:null,
        failureCount:0
      }})
      .catch(()=>securityWarn("push_subscription_metadata_update_failed", {
        subscriptionId:String(subscription._id)
      }));

    securityInfo("reminder_push_sent", {
      userId:String(subscription.userId),
      memoryId:String(memory._id),
      subscriptionId:String(subscription._id)
    });
    return {attempted:true, sent:true};
  }catch(error){
    const statusCode = getStatusCode(error);

    if(statusCode === 404 || statusCode === 410){
      await deletePushSubscriptionById(subscription._id);
      securityInfo("push_subscription_expired", {
        userId:String(subscription.userId),
        subscriptionId:String(subscription._id),
        statusCode
      });
      return {attempted:true, sent:false, removed:true};
    }

    const shouldRetry = isTransientFailure(statusCode) && delivery.attempts < MAX_DELIVERY_ATTEMPTS;
    const nextAttemptAt = shouldRetry
      ? new Date(Date.now() + getRetryDelay(delivery.attempts))
      : null;

    await PushDelivery.updateOne({_id:delivery._id, status:"processing"}, {$set:{
      status:shouldRetry ? "retry" : "failed",
      nextAttemptAt,
      leaseUntil:null,
      lastStatusCode:statusCode,
      failureReason:shouldRetry ? "transient" : "permanent",
      expiresAt:getDeliveryExpiry()
    }});
    await PushSubscription.updateOne({_id:subscription._id}, {
      $set:{lastFailureAt:new Date()},
      $inc:{failureCount:1}
    }).catch(()=>securityWarn("push_subscription_metadata_update_failed", {
      subscriptionId:String(subscription._id)
    }));

    securityWarn("reminder_push_send_failed", {
      userId:String(subscription.userId),
      memoryId:String(memory._id),
      subscriptionId:String(subscription._id),
      statusCode,
      willRetry:shouldRetry
    });
    return {attempted:true, sent:false};
  }
};

const getDueMemories = async (subscription, user, now) => {
  const todayKey = getDateKeyInTimeZone(now, subscription.timeZone);
  const leadDays = getReminderLeadDays(user);
  const rangeStartKey = shiftDateKey(todayKey, -REMINDER_GRACE_DAYS);
  const rangeEndKey = shiftDateKey(todayKey, leadDays);
  const rangeStart = new Date(`${rangeStartKey}T00:00:00.000Z`);
  const rangeEndExclusive = new Date(`${shiftDateKey(rangeEndKey, 1)}T00:00:00.000Z`);
  const memories = await Memory.find({
    userId:subscription.userId,
    deletedAt:null,
    hiddenAt:null,
    title:mongoose.trusted({$ne:HIDDEN_IMAGE_MEMORY_TITLE}),
    reminderDate:mongoose.trusted({$gte:rangeStart, $lt:rangeEndExclusive})
  })
    .select("_id reminderDate")
    .sort({reminderDate:1})
    .limit(MAX_DUE_MEMORIES_PER_SUBSCRIPTION)
    .lean();

  return memories.filter((memory)=>{
    const reminderDateKey = getReminderDateKey(memory.reminderDate);
    if(!reminderDateKey){
      return false;
    }

    const notificationStartKey = shiftDateKey(reminderDateKey, -leadDays);
    const graceEndKey = shiftDateKey(reminderDateKey, REMINDER_GRACE_DAYS);
    return todayKey >= notificationStartKey && todayKey <= graceEndKey;
  });
};

const sendDueReminderPushes = async () => {
  if(!isPushConfigured() || scanInProgress){
    return;
  }

  scanInProgress = true;
  const now = new Date();
  let attemptedCount = 0;
  let sentCount = 0;
  let removedCount = 0;

  try{
    const subscriptions = await PushSubscription.find({enabled:true})
      .select("+endpoint +keys.p256dh +keys.auth")
      .sort({lastSeenAt:-1})
      .limit(MAX_SUBSCRIPTIONS_PER_SCAN)
      .lean();
    const activeSubscriptions = [];

    for(const subscription of subscriptions){
      if(subscription.expirationTime && subscription.expirationTime <= now){
        await deletePushSubscriptionById(subscription._id);
        removedCount += 1;
      }else{
        activeSubscriptions.push(subscription);
      }
    }

    const userIds = [...new Set(activeSubscriptions.map((subscription)=>String(subscription.userId)))];
    const users = userIds.length
      ? await User.find({_id:mongoose.trusted({$in:userIds})}).select("settingsProfiles").lean()
      : [];
    const usersById = new Map(users.map((user)=>[String(user._id), user]));

    for(const subscription of activeSubscriptions){
      if(attemptedCount >= MAX_PUSHES_PER_SCAN){
        break;
      }

      const user = usersById.get(String(subscription.userId));
      if(!user){
        await deletePushSubscriptionById(subscription._id);
        removedCount += 1;
        continue;
      }

      let memories;
      try{
        memories = await getDueMemories(subscription, user, now);
      }catch{
        securityWarn("reminder_push_subscription_scan_failed", {
          userId:String(subscription.userId),
          subscriptionId:String(subscription._id)
        });
        continue;
      }

      for(const memory of memories){
        if(attemptedCount >= MAX_PUSHES_PER_SCAN){
          break;
        }

        const result = await deliverReminder(
          subscription,
          memory,
          getReminderDateKey(memory.reminderDate)
        );

        if(result.attempted){
          attemptedCount += 1;
        }
        if(result.sent){
          sentCount += 1;
        }
        if(result.removed){
          break;
        }
      }
    }

    securityInfo("reminder_push_scan_completed", {
      subscriptionCount:activeSubscriptions.length,
      attemptedCount,
      sentCount,
      removedCount
    });
  }catch{
    securityError("reminder_push_scan_failed");
  }finally{
    scanInProgress = false;
  }
};

const startReminderPushScheduler = () => {
  if(schedulerId || !isPushConfigured()){
    return;
  }

  const configuredInterval = Number(process.env.REMINDER_PUSH_SCAN_INTERVAL_MS || DEFAULT_SCAN_INTERVAL_MS);
  const intervalMs = Number.isFinite(configuredInterval) && configuredInterval >= 60 * 1000
    ? configuredInterval
    : DEFAULT_SCAN_INTERVAL_MS;

  schedulerId = setInterval(()=>{
    void sendDueReminderPushes();
  }, intervalMs);

  securityInfo("reminder_push_scheduler_started", {intervalMs});
  void sendDueReminderPushes();
};

module.exports = {
  getDateKeyInTimeZone,
  getReminderDateKey,
  sendDueReminderPushes,
  shiftDateKey,
  startReminderPushScheduler
};
