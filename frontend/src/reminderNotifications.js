import { deletePushSubscription, getPushPublicKey, savePushSubscription } from "./services/api";

const REMINDER_NOTIFICATION_PREFIX = "memory-reminder-browser-notified";
const SERVICE_WORKER_PATH = "/memory-push-sw.js";

export function getTodayKey(date = new Date()){
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

export function supportsReminderNotifications(){
  return typeof window !== "undefined" && "Notification" in window;
}

export function supportsReminderPush(){
  return (
    supportsReminderNotifications() &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function urlBase64ToUint8Array(base64String){
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for(let index = 0; index < rawData.length; index += 1){
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export async function ensureReminderPushSubscription(){
  if(!supportsReminderPush() || window.Notification.permission !== "granted"){
    return false;
  }

  try{
    const keyResponse = await getPushPublicKey();
    const {enabled, publicKey} = keyResponse.data || {};

    if(!enabled || !publicKey){
      return false;
    }

    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
    let subscription = await registration.pushManager.getSubscription();

    if(!subscription){
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:urlBase64ToUint8Array(publicKey)
      });
    }

    await savePushSubscription(subscription.toJSON());
    return true;
  }catch{
    return false;
  }
}

export async function unsubscribeReminderPush(){
  if(!supportsReminderPush()){
    return false;
  }

  try{
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();

    if(!subscription){
      return false;
    }

    await deletePushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
    return true;
  }catch{
    return false;
  }
}

export async function requestReminderNotificationPermission(){
  if(!supportsReminderNotifications()){
    return "unsupported";
  }

  let permission = window.Notification.permission;

  if(permission === "default"){
    try{
      permission = await window.Notification.requestPermission();
    }catch{
      permission = window.Notification.permission;
    }
  }

  if(permission === "granted"){
    void ensureReminderPushSubscription();
  }

  return permission;
}

function formatReminderDate(value){
  const date = value ? new Date(value) : null;

  if(!date || Number.isNaN(date.getTime())){
    return "the scheduled date";
  }

  return date.toLocaleDateString("en-GB", {
    day:"2-digit",
    month:"short",
    year:"numeric"
  });
}

function canUseStorage(){
  try{
    const key = "memory-reminder-storage-test";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  }catch{
    return false;
  }
}

export function maybeShowReminderNotification(memory, options = {}){
  if(!memory || !supportsReminderNotifications() || window.Notification.permission !== "granted"){
    return false;
  }

  const onlyWhenBackground = options.onlyWhenBackground !== false;

  if(onlyWhenBackground && document.visibilityState === "visible" && document.hasFocus()){
    return false;
  }

  const reminderKey = options.reminderKey || `memory-reminder-${memory._id || "unknown"}-${memory.reminderDate?.split("T")[0] || ""}`;
  const todayKey = getTodayKey();
  const storageKey = `${REMINDER_NOTIFICATION_PREFIX}-${reminderKey}-${todayKey}`;
  const storageAvailable = canUseStorage();

  if(storageAvailable && localStorage.getItem(storageKey)){
    return false;
  }

  const leadDays = Number(options.leadDays || 0);
  const leadLabel = leadDays > 0
    ? ` Reminder messages start ${leadDays} day${leadDays === 1 ? "" : "s"} before.`
    : "";
  const notification = new window.Notification("Memory reminder", {
    body:`${memory.title || "A memory"} is scheduled for ${formatReminderDate(memory.reminderDate)}.${leadLabel}`,
    icon:"/memory-timeline-icon.svg",
    badge:"/memory-timeline-icon.svg",
    tag:storageKey,
    renotify:false
  });

  notification.onclick = () => {
    window.focus();
    options.onClick?.();
    notification.close();
  };

  if(storageAvailable){
    localStorage.setItem(storageKey, new Date().toISOString());
  }

  return true;
}
