import {
  createPushSubscription,
  deletePushSubscription,
  getPushConfig
} from "./services/api";

export const PUSH_SERVICE_WORKER_URL = "/memory-timeline-sw.js";
const PUSH_SERVICE_WORKER_SCOPE = "/";

const getTimeZone = () => {
  try{
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }catch{
    return "UTC";
  }
};

const isIosDevice = () => {
  if(typeof navigator === "undefined"){
    return false;
  }

  return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
};

const isStandaloneApp = () => (
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true)
);

const getSupportState = () => {
  if(typeof window === "undefined" || typeof navigator === "undefined"){
    return "unsupported";
  }

  if(!window.isSecureContext){
    return "insecure";
  }

  if(isIosDevice() && !isStandaloneApp()){
    return "install-required";
  }

  if(!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)){
    return "unsupported";
  }

  return "supported";
};

const urlBase64ToUint8Array = (value) => {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const decoded = window.atob(base64);

  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};

const getExistingSubscription = async() => {
  const registration = await navigator.serviceWorker.getRegistration(PUSH_SERVICE_WORKER_SCOPE);

  if(!registration){
    return null;
  }

  return registration.pushManager.getSubscription();
};

const serializeSubscription = (subscription) => {
  const serialized = subscription.toJSON();

  return {
    endpoint:serialized.endpoint,
    expirationTime:serialized.expirationTime ?? null,
    keys:{
      p256dh:serialized.keys?.p256dh || "",
      auth:serialized.keys?.auth || ""
    }
  };
};

export const registerPushServiceWorker = async() => {
  if(getSupportState() !== "supported"){
    return null;
  }

  const registration = await navigator.serviceWorker.register(PUSH_SERVICE_WORKER_URL, {
    scope:PUSH_SERVICE_WORKER_SCOPE
  });

  return navigator.serviceWorker.ready.then(() => registration);
};

export const getPushNotificationStatus = async() => {
  const supportState = getSupportState();

  if(supportState !== "supported"){
    return {
      state:supportState,
      subscribed:false,
      permission:"default",
      publicKey:""
    };
  }

  const permission = Notification.permission;
  const subscription = await getExistingSubscription();
  const localState = {
    subscribed:Boolean(subscription),
    permission,
    publicKey:""
  };

  if(permission === "denied"){
    return {...localState, state:"denied"};
  }

  try{
    const {data} = await getPushConfig();
    const publicKey = typeof data.publicKey === "string" ? data.publicKey.trim() : "";

    if(!data.enabled || !publicKey){
      return {...localState, state:"unconfigured"};
    }

    return {
      ...localState,
      state:subscription ? "subscribed" : "available",
      publicKey
    };
  }catch(error){
    return {...localState, state:"error", error};
  }
};

export const subscribeToPushNotifications = async(publicKey) => {
  if(getSupportState() !== "supported"){
    const error = new Error("Push notifications are not supported on this browser.");
    error.code = "PUSH_UNSUPPORTED";
    throw error;
  }

  if(!publicKey){
    const error = new Error("Push notifications are not configured.");
    error.code = "PUSH_UNCONFIGURED";
    throw error;
  }

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();

  if(permission !== "granted"){
    const error = new Error(permission === "denied"
      ? "Notifications are blocked in this browser."
      : "Notification permission was not granted.");
    error.code = permission === "denied" ? "PUSH_DENIED" : "PUSH_DISMISSED";
    throw error;
  }

  const registration = await registerPushServiceWorker();
  let subscription = await registration.pushManager.getSubscription();
  const createdSubscription = !subscription;

  if(!subscription){
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:urlBase64ToUint8Array(publicKey)
    });
  }

  try{
    await createPushSubscription(serializeSubscription(subscription), getTimeZone());
  }catch(error){
    if(createdSubscription){
      await subscription.unsubscribe().catch(()=>{});
    }

    throw error;
  }

  return subscription;
};

export const reconcilePushSubscription = async() => {
  if(getSupportState() !== "supported" || Notification.permission !== "granted"){
    return false;
  }

  const subscription = await getExistingSubscription();

  if(!subscription){
    return false;
  }

  await createPushSubscription(serializeSubscription(subscription), getTimeZone());
  return true;
};

export const unsubscribeFromPushNotifications = async({notifyServer = true} = {}) => {
  if(getSupportState() !== "supported"){
    return {hadSubscription:false, unsubscribed:true, serverSynced:true};
  }

  const subscription = await getExistingSubscription();

  if(!subscription){
    return {hadSubscription:false, unsubscribed:true, serverSynced:true};
  }

  let serverSynced = !notifyServer;

  if(notifyServer){
    try{
      await deletePushSubscription(subscription.endpoint);
      serverSynced = true;
    }catch{
      serverSynced = false;
    }
  }

  const unsubscribed = await subscription.unsubscribe();
  return {hadSubscription:true, unsubscribed, serverSynced};
};
