const REMINDER_NOTIFICATION_PREFIX = "memory-reminder-browser-notified";

export function getTodayKey(date = new Date()){
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

export function supportsReminderNotifications(){
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestReminderNotificationPermission(){
  if(!supportsReminderNotifications()){
    return "unsupported";
  }

  if(window.Notification.permission !== "default"){
    return window.Notification.permission;
  }

  try{
    return await window.Notification.requestPermission();
  }catch{
    return window.Notification.permission;
  }
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
