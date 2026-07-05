const webpush = require("web-push");
const Memory = require("./models/Memory");
const PushSubscription = require("./models/PushSubscription");
const User = require("./models/User");
const { securityInfo, securityWarn, securityError } = require("./securityLogger");

const MAX_SENT_KEYS = 120;
const DEFAULT_REMINDER_LEAD_DAYS = 2;
const MAX_REMINDER_LEAD_DAYS = 30;
const DEFAULT_SCAN_INTERVAL_MS = 15 * 60 * 1000;
let schedulerId = null;
let scanInProgress = false;
let pushConfigured = false;

const getTodayKey = (date = new Date()) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
};

const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getReminderLeadDays = (user) => {
  const profiles = user?.settingsProfiles || {};
  const candidates = [
    profiles.mobile?.reminderLeadDays,
    profiles.desktop?.reminderLeadDays
  ]
    .map((value)=>Number(value))
    .filter((value)=>Number.isFinite(value));
  const leadDays = candidates.length ? Math.max(...candidates) : DEFAULT_REMINDER_LEAD_DAYS;

  return Math.min(Math.max(leadDays, 0), MAX_REMINDER_LEAD_DAYS);
};

const configureWebPush = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if(!publicKey || !privateKey){
    pushConfigured = false;
    securityWarn("push_notifications_disabled", {reason:"missing_vapid_keys"});
    return false;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    publicKey,
    privateKey
  );
  pushConfigured = true;
  return true;
};

const isPushConfigured = () => pushConfigured;
const getVapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || "";

const isValidSubscription = (subscription = {}) => (
  typeof subscription.endpoint === "string" &&
  subscription.endpoint.startsWith("https://") &&
  typeof subscription.keys?.p256dh === "string" &&
  typeof subscription.keys?.auth === "string"
);

const toWebPushSubscription = (subscription) => ({
  endpoint:subscription.endpoint,
  keys:{
    p256dh:subscription.keys.p256dh,
    auth:subscription.keys.auth
  }
});

const savePushSubscription = async (userId, subscription, userAgent = "") => {
  if(!isValidSubscription(subscription)){
    const error = new Error("Invalid push subscription");
    error.status = 400;
    throw error;
  }

  await PushSubscription.findOneAndUpdate(
    {endpoint:subscription.endpoint},
    {
      $set:{
        userId,
        endpoint:subscription.endpoint,
        keys:{
          p256dh:subscription.keys.p256dh,
          auth:subscription.keys.auth
        },
        userAgent:String(userAgent || "").slice(0, 300),
        updatedAt:new Date()
      },
      $setOnInsert:{
        createdAt:new Date(),
        sentReminderKeys:[]
      }
    },
    {upsert:true, new:true, setDefaultsOnInsert:true}
  );
};

const removePushSubscription = async (userId, endpoint) => {
  if(!endpoint){
    return;
  }

  await PushSubscription.deleteOne({userId, endpoint});
};

const markReminderSent = async (subscription, reminderKey) => {
  const sentReminderKeys = Array.from(new Set([...(subscription.sentReminderKeys || []), reminderKey])).slice(-MAX_SENT_KEYS);
  subscription.sentReminderKeys = sentReminderKeys;
  await subscription.save();
};

const sendGenericReminder = async (subscription, reminderKey) => {
  if(subscription.sentReminderKeys?.includes(reminderKey)){
    return;
  }

  const payload = JSON.stringify({
    type:"memory-reminder",
    title:"Memory reminder",
    body:"You have a memory reminder today.",
    url:"/timeline"
  });

  try{
    await webpush.sendNotification(toWebPushSubscription(subscription), payload);
    await markReminderSent(subscription, reminderKey);
  }catch(error){
    if(error.statusCode === 404 || error.statusCode === 410){
      await PushSubscription.deleteOne({_id:subscription._id});
      return;
    }

    securityWarn("push_send_failed", {statusCode:error.statusCode || "unknown"});
  }
};

const sendDueReminderPushes = async () => {
  if(!pushConfigured || scanInProgress){
    return;
  }

  scanInProgress = true;

  try{
    const subscriptions = await PushSubscription.find({}).lean(false);

    if(!subscriptions.length){
      return;
    }

    const userIds = [...new Set(subscriptions.map((subscription)=>String(subscription.userId)))];
    const users = await User.find({_id:{$in:userIds}}).select("settingsProfiles").lean();
    const userMap = new Map(users.map((user)=>[String(user._id), user]));
    const today = startOfDay();
    const todayKey = getTodayKey(today);

    for(const userId of userIds){
      const user = userMap.get(userId);

      if(!user){
        await PushSubscription.deleteMany({userId});
        continue;
      }

      const leadDays = getReminderLeadDays(user);
      const reminderWindowEnd = new Date(today);
      reminderWindowEnd.setDate(today.getDate() + leadDays);

      const hasDueReminder = await Memory.exists({
        userId,
        deletedAt:null,
        hiddenAt:null,
        reminderDate:{
          $gte:today,
          $lte:reminderWindowEnd
        }
      });

      if(!hasDueReminder){
        continue;
      }

      const reminderKey = `memory-reminder-daily-${todayKey}`;
      const userSubscriptions = subscriptions.filter((subscription)=>String(subscription.userId) === userId);

      for(const subscription of userSubscriptions){
        await sendGenericReminder(subscription, reminderKey);
      }
    }
  }catch(error){
    securityError("push_reminder_scan_failed");
  }finally{
    scanInProgress = false;
  }
};

const startPushReminderScheduler = () => {
  if(schedulerId || !pushConfigured){
    return;
  }

  const intervalMs = Number(process.env.PUSH_REMINDER_SCAN_INTERVAL_MS || DEFAULT_SCAN_INTERVAL_MS);
  const safeIntervalMs = Number.isFinite(intervalMs) && intervalMs >= 60 * 1000 ? intervalMs : DEFAULT_SCAN_INTERVAL_MS;

  schedulerId = setInterval(()=>{
    void sendDueReminderPushes();
  }, safeIntervalMs);

  setTimeout(()=>{
    void sendDueReminderPushes();
  }, 10 * 1000);

  securityInfo("push_reminder_scheduler_started", {intervalMs:safeIntervalMs});
};

module.exports = {
  configureWebPush,
  getVapidPublicKey,
  isPushConfigured,
  removePushSubscription,
  savePushSubscription,
  sendDueReminderPushes,
  startPushReminderScheduler
};
