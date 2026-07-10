const nodemailer = require("nodemailer");
const net = require("net");
const dns = require("dns");
const mongoose = require("mongoose");
const Memory = require("./models/Memory");
const User = require("./models/User");
const { securityInfo, securityWarn, securityError } = require("./securityLogger");

const HIDDEN_IMAGE_MEMORY_TITLE = "app/hide-image/";
const DEFAULT_REMINDER_LEAD_DAYS = 2;
const MAX_REMINDER_LEAD_DAYS = 30;
const DEFAULT_SCAN_INTERVAL_MS = 15 * 60 * 1000;
const MAX_BATCH_EMAILS = 100;
let schedulerId = null;
let scanInProgress = false;
let transporter = null;
let emailConfigured = false;
let emailProvider = null;

try {
  dns.setDefaultResultOrder("ipv4first");
} catch (error) {
  // Older Node versions may not support this; the transport also sets family.
}

const getTodayKey = (date = new Date()) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
};

const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

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

const hasEmailRemindersEnabled = (user) => {
  const profiles = user?.settingsProfiles || {};
  return [profiles.mobile, profiles.desktop]
    .filter(Boolean)
    .every((settings)=>settings.backgroundNotificationsEnabled !== false);
};

const getReminderEmailKey = (memory) => {
  if(!memory?.reminderDate){
    return "";
  }

  return `${memory._id}:${getTodayKey(new Date(memory.reminderDate))}`;
};

const DEFAULT_RESEND_FROM = "Memory Timeline <onboarding@resend.dev>";

const getSmtpFromAddress = () => process.env.SMTP_FROM || process.env.SMTP_USER;
const getResendFromAddress = () => process.env.RESEND_FROM || DEFAULT_RESEND_FROM;
const getFromAddress = () => emailProvider === "resend" ? getResendFromAddress() : getSmtpFromAddress();

const createIpv4SmtpSocket = (host, port, timeoutMs = 30 * 1000) => (options, callback) => {
  const socket = net.connect({
    host,
    port,
    family:4,
    timeout:timeoutMs
  });
  let settled = false;

  const finish = (error, socketOptions) => {
    if(settled){
      return;
    }
    settled = true;
    callback(error, socketOptions);
  };

  socket.once("connect", () => finish(null, {connection:socket}));
  socket.once("timeout", () => {
    socket.destroy();
    finish(new Error("SMTP IPv4 connection timeout"));
  });
  socket.once("error", finish);
};

const configureReminderEmail = () => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = getResendFromAddress();

  if(resendApiKey && resendFrom){
    emailConfigured = true;
    emailProvider = "resend";
    transporter = null;
    securityInfo("reminder_email_configured", {
      provider:"resend",
      from:resendFrom
    });
    return true;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = getSmtpFromAddress();

  if(!host || !user || !pass || !from){
    emailConfigured = false;
    emailProvider = null;
    transporter = null;
    securityWarn("reminder_email_disabled", {reason:"missing_smtp_config"});
    return false;
  }

  transporter = nodemailer.createTransport({
    host,
    port:Number.isFinite(port) ? port : 587,
    secure:process.env.SMTP_SECURE === "true" || port === 465,
    family:4,
    connectionTimeout:30 * 1000,
    greetingTimeout:30 * 1000,
    socketTimeout:60 * 1000,
    getSocket:createIpv4SmtpSocket(host, Number.isFinite(port) ? port : 587),
    auth:{user, pass}
  });
  emailConfigured = true;
  emailProvider = "smtp";
  securityInfo("reminder_email_configured", {
    provider:"smtp",
    host,
    port:Number.isFinite(port) ? port : 587,
    secure:process.env.SMTP_SECURE === "true" || port === 465,
    from
  });
  return true;
};

const isReminderEmailConfigured = () => emailConfigured;

const buildReminderEmail = (user, memory, leadDays) => {
  const title = memory.title || "A memory";
  const reminderDate = new Date(memory.reminderDate);
  const reminderDateText = reminderDate.toLocaleDateString("en-GB", {
    day:"2-digit",
    month:"short",
    year:"numeric"
  });
  const leadText = leadDays > 0
    ? `Reminder emails start ${leadDays} day${leadDays === 1 ? "" : "s"} before the reminder date.`
    : "This reminder is scheduled for today.";
  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  const openAppText = appUrl ? `\n\nOpen Memory Timeline: ${appUrl}/timeline` : "";
  const openAppHtml = appUrl
    ? `<p><a href="${escapeHtml(`${appUrl}/timeline`)}">Open Memory Timeline</a></p>`
    : "";

  return {
    from:getFromAddress(),
    to:user.email,
    subject:`Memory reminder: ${title}`,
    text:[
      `Hi${user.name ? ` ${user.name}` : ""},`,
      "",
      `This is a reminder for \"${title}\" scheduled on ${reminderDateText}.`,
      leadText,
      openAppText,
      "",
      "Memory Timeline"
    ].filter(Boolean).join("\n"),
    html:`
      <p>Hi${user.name ? ` ${escapeHtml(user.name)}` : ""},</p>
      <p>This is a reminder for <strong>${escapeHtml(title)}</strong> scheduled on <strong>${escapeHtml(reminderDateText)}</strong>.</p>
      <p>${escapeHtml(leadText)}</p>
      ${openAppHtml}
      <p>Memory Timeline</p>
    `
  };
};

const sendWithResend = async (email) => {
  const response = await fetch("https://api.resend.com/emails", {
    method:"POST",
    headers:{
      Authorization:`Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      from:email.from,
      to:[email.to],
      subject:email.subject,
      text:email.text,
      html:email.html
    })
  });

  if(response.ok){
    return response.json();
  }

  let errorBody = "";
  try{
    errorBody = await response.text();
  }catch(error){
    errorBody = "Unable to read Resend error response";
  }

  const error = new Error(`Resend API failed with status ${response.status}`);
  error.code = `RESEND_${response.status}`;
  error.response = errorBody;
  throw error;
};
const sendReminderEmail = async (user, memory, leadDays) => {
  if(!emailConfigured || !user?.email || !memory?.reminderDate){
    return false;
  }

  const email = buildReminderEmail(user, memory, leadDays);
  if(emailProvider === "resend"){
    await sendWithResend(email);
  }else if(transporter){
    await transporter.sendMail(email);
  }else{
    return false;
  }

  memory.reminderEmailSentKey = getReminderEmailKey(memory);
  await memory.save();
  securityInfo("reminder_email_sent", {
    provider:emailProvider,
    userId:String(user._id),
    memoryId:String(memory._id)
  });
  return true;
};

const sendDueReminderEmails = async () => {
  if(!emailConfigured || scanInProgress){
    if(!emailConfigured){
      securityWarn("reminder_email_scan_skipped", {reason:"email_not_configured"});
    }
    return;
  }

  scanInProgress = true;

  try{
    const today = startOfDay();
    let sentCount = 0;
    securityInfo("reminder_email_scan_started", {
      today:getTodayKey(today)
    });

    const users = (await User.find({}).select("email name settingsProfiles").lean())
      .filter((user)=>String(user.email || "").trim());
    securityInfo("reminder_email_users_loaded", {userCount:users.length});

    for(const user of users){
      if(sentCount >= MAX_BATCH_EMAILS){
        break;
      }

      if(!hasEmailRemindersEnabled(user)){
        securityInfo("reminder_email_user_skipped", {
          userId:String(user._id),
          reason:"email_reminders_disabled"
        });
        continue;
      }

      const leadDays = getReminderLeadDays(user);
      const reminderWindowEnd = new Date(today);
      reminderWindowEnd.setDate(today.getDate() + leadDays);

      const memories = await Memory.find({
        userId:user._id,
        deletedAt:null,
        hiddenAt:null,
        title:mongoose.trusted({$ne:HIDDEN_IMAGE_MEMORY_TITLE}),
        reminderDate:mongoose.trusted({
          $gte:today,
          $lte:reminderWindowEnd
        })
      }).sort({reminderDate:1}).limit(MAX_BATCH_EMAILS - sentCount);

      securityInfo("reminder_email_due_memories_checked", {
        userId:String(user._id),
        leadDays,
        windowStart:getTodayKey(today),
        windowEnd:getTodayKey(reminderWindowEnd),
        memoryCount:memories.length
      });

      for(const memory of memories){
        if(memory.reminderEmailSentKey === getReminderEmailKey(memory)){
          securityInfo("reminder_email_memory_skipped", {
            userId:String(user._id),
            memoryId:String(memory._id),
            reason:"already_sent_for_reminder_date"
          });
          continue;
        }

        try{
          await sendReminderEmail(user, memory, leadDays);
          sentCount += 1;
        }catch(error){
          securityWarn("reminder_email_send_failed", {
            userId:String(user._id),
            memoryId:String(memory._id),
            errorCode:error?.code,
            errorMessage:error?.message,
            smtpResponse:error?.response
          });
        }
      }
    }

    securityInfo("reminder_email_scan_completed", {sentCount});
  }catch(error){
    securityError("reminder_email_scan_failed", {
      errorCode:error?.code,
      errorMessage:error?.message
    });
  }finally{
    scanInProgress = false;
  }
};

const startReminderEmailScheduler = () => {
  if(schedulerId || !emailConfigured){
    return;
  }

  const intervalMs = Number(process.env.REMINDER_EMAIL_SCAN_INTERVAL_MS || DEFAULT_SCAN_INTERVAL_MS);
  const safeIntervalMs = Number.isFinite(intervalMs) && intervalMs >= 60 * 1000 ? intervalMs : DEFAULT_SCAN_INTERVAL_MS;

  schedulerId = setInterval(()=>{
    void sendDueReminderEmails();
  }, safeIntervalMs);

  securityInfo("reminder_email_scheduler_started", {intervalMs:safeIntervalMs});
  void sendDueReminderEmails();
};

module.exports = {
  configureReminderEmail,
  isReminderEmailConfigured,
  sendDueReminderEmails,
  startReminderEmailScheduler
};

