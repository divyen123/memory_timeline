const crypto = require("crypto");
const net = require("net");
const webPush = require("web-push");
const PushSubscription = require("../models/PushSubscription");
const PushDelivery = require("../models/PushDelivery");
const { securityInfo, securityWarn } = require("../securityLogger");

const MAX_ENDPOINT_LENGTH = 4096;
const MAX_P256DH_LENGTH = 1024;
const MAX_AUTH_LENGTH = 256;
const DEFAULT_ALLOWED_PUSH_HOSTS = Object.freeze([
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "*.push.apple.com",
  "*.notify.windows.com",
  "*.notify.live.net"
]);

let pushConfigured = false;
let vapidPublicKey = "";

const createValidationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  error.code = "INVALID_PUSH_SUBSCRIPTION";
  return error;
};

const getAllowedPushHosts = () => {
  const configuredHosts = String(process.env.PUSH_ENDPOINT_ALLOWED_HOSTS || "")
    .split(",")
    .map((host)=>host.trim().toLowerCase())
    .filter(Boolean);

  return configuredHosts.length ? configuredHosts : DEFAULT_ALLOWED_PUSH_HOSTS;
};

const hostMatchesAllowedEntry = (hostname, entry) => {
  if(entry.startsWith("*.")){
    const suffix = entry.slice(2);
    return Boolean(suffix) && hostname.endsWith(`.${suffix}`);
  }

  return hostname === entry;
};

const parsePushEndpoint = (endpoint, {enforceAllowlist = true} = {}) => {
  if(typeof endpoint !== "string" || !endpoint || endpoint.length > MAX_ENDPOINT_LENGTH){
    throw createValidationError("Push endpoint is invalid");
  }

  let parsed;
  try{
    parsed = new URL(endpoint);
  }catch{
    throw createValidationError("Push endpoint is invalid");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if(
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== "443") ||
    parsed.hash ||
    !hostname ||
    net.isIP(hostname)
  ){
    throw createValidationError("Push endpoint is invalid");
  }

  if(
    enforceAllowlist &&
    !getAllowedPushHosts().some((entry)=>hostMatchesAllowedEntry(hostname, entry))
  ){
    throw createValidationError("Push endpoint provider is not allowed");
  }

  return parsed.toString();
};

const decodeBase64Url = (value, maxLength, label) => {
  if(
    typeof value !== "string" ||
    !value ||
    value.length > maxLength ||
    !/^[A-Za-z0-9_-]+={0,2}$/.test(value)
  ){
    throw createValidationError(`${label} is invalid`);
  }

  try{
    return Buffer.from(value.replace(/=+$/, ""), "base64url");
  }catch{
    throw createValidationError(`${label} is invalid`);
  }
};

const normalizeTimeZone = (timeZone) => {
  if(typeof timeZone !== "string" || !timeZone.trim() || timeZone.length > 100){
    throw createValidationError("A valid device time zone is required");
  }

  try{
    return new Intl.DateTimeFormat("en-US", {timeZone:timeZone.trim()})
      .resolvedOptions()
      .timeZone;
  }catch{
    throw createValidationError("A valid device time zone is required");
  }
};

const normalizeExpirationTime = (expirationTime) => {
  if(expirationTime === null || expirationTime === undefined){
    return null;
  }

  const numericExpiration = Number(expirationTime);
  const date = new Date(numericExpiration);

  if(!Number.isFinite(numericExpiration) || Number.isNaN(date.getTime())){
    throw createValidationError("Push subscription expiration is invalid");
  }

  if(date.getTime() <= Date.now()){
    throw createValidationError("Push subscription has expired");
  }

  return date;
};

const getEndpointHash = (endpoint) => crypto
  .createHash("sha256")
  .update(endpoint)
  .digest("hex");

const validatePushSubscription = (subscription, timeZone) => {
  if(!subscription || typeof subscription !== "object" || Array.isArray(subscription)){
    throw createValidationError("Push subscription is required");
  }

  const endpoint = parsePushEndpoint(subscription.endpoint);
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;
  const p256dhBytes = decodeBase64Url(p256dh, MAX_P256DH_LENGTH, "Push encryption key");
  const authBytes = decodeBase64Url(auth, MAX_AUTH_LENGTH, "Push authentication key");

  if(p256dhBytes.length !== 65 || p256dhBytes[0] !== 4 || authBytes.length !== 16){
    throw createValidationError("Push subscription keys are invalid");
  }

  return {
    endpoint,
    endpointHash:getEndpointHash(endpoint),
    keys:{p256dh, auth},
    expirationTime:normalizeExpirationTime(subscription.expirationTime),
    timeZone:normalizeTimeZone(timeZone)
  };
};

const getEndpointHashForRemoval = (endpoint) => {
  const normalizedEndpoint = parsePushEndpoint(endpoint, {enforceAllowlist:false});
  return getEndpointHash(normalizedEndpoint);
};

const sanitizeUserAgent = (value = "") => String(value)
  .replace(/[\r\n]/g, " ")
  .slice(0, 512);

const configurePushNotifications = () => {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  pushConfigured = false;
  vapidPublicKey = "";

  if(!subject || !publicKey || !privateKey){
    securityWarn("push_notifications_disabled", {reason:"missing_vapid_config"});
    return false;
  }

  try{
    webPush.setVapidDetails(subject, publicKey, privateKey);
    pushConfigured = true;
    vapidPublicKey = publicKey;
    securityInfo("push_notifications_configured");
    return true;
  }catch{
    securityWarn("push_notifications_disabled", {reason:"invalid_vapid_config"});
    return false;
  }
};

const isPushConfigured = () => pushConfigured;
const getVapidPublicKey = () => pushConfigured ? vapidPublicKey : "";

const sendPushNotification = async (subscription, payload, options = {}) => {
  if(!pushConfigured){
    const error = new Error("Push notifications are not configured");
    error.code = "PUSH_NOT_CONFIGURED";
    throw error;
  }

  if(!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth){
    const error = new Error("Push subscription is incomplete");
    error.code = "PUSH_SUBSCRIPTION_INCOMPLETE";
    throw error;
  }

  return webPush.sendNotification({
    endpoint:subscription.endpoint,
    expirationTime:subscription.expirationTime?.getTime?.() || null,
    keys:{
      p256dh:subscription.keys.p256dh,
      auth:subscription.keys.auth
    }
  }, JSON.stringify(payload), options);
};

const deletePushSubscriptionById = async (subscriptionId) => {
  await PushDelivery.deleteMany({subscriptionId});
  await PushSubscription.deleteOne({_id:subscriptionId});
};

const deletePushRecordsForUser = async (userId) => {
  await PushDelivery.deleteMany({userId});
  await PushSubscription.deleteMany({userId});
};

module.exports = {
  configurePushNotifications,
  deletePushRecordsForUser,
  deletePushSubscriptionById,
  getEndpointHashForRemoval,
  getVapidPublicKey,
  isPushConfigured,
  sanitizeUserAgent,
  sendPushNotification,
  validatePushSubscription
};
