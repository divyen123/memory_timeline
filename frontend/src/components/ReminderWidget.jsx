import React, { useEffect, useMemo, useRef, useState } from "react";
import { getMemories } from "../services/api";
import { loadSettings, SETTINGS_PREVIEW_EVENT, SETTINGS_UPDATED_EVENT } from "../settings";
import { playAppSound } from "../sound";
import { AUTH_UPDATED_EVENT, getAuthenticatedUserId } from "../auth";

function ReminderWidget(){
  const [memories,setMemories] = useState([]);
  const [settings,setSettings] = useState(()=>loadSettings());
  const [showReminderPanel,setShowReminderPanel] = useState(false);
  const [reminderPage,setReminderPage] = useState(0);
  const [activeReminder,setActiveReminder] = useState(null);
  const [reminderActionVersion,setReminderActionVersion] = useState(0);
  const lastSoundReminderRef = useRef("");
  const reminderMenuRef = useRef(null);
  const [authenticatedUserId,setAuthenticatedUserId] = useState(()=>getAuthenticatedUserId());

  useEffect(() => {
    if(!authenticatedUserId){
      setMemories([]);
      return;
    }

    const loadReminderMemories = async () => {
      try{
        const res = await getMemories({
          page:1,
          limit:30,
          sort:"oldest"
        });
        setMemories(res.data.memories || []);
      }catch{
        setMemories([]);
      }
    };

    loadReminderMemories();
  }, [authenticatedUserId]);

  useEffect(() => {
    const handleSettingsUpdated = (event) => {
      setSettings(event.detail || loadSettings());
    };
    const handleAuthUpdated = (event) => {
      setAuthenticatedUserId(event.detail?.userId || "");
    };

    window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    window.addEventListener(SETTINGS_PREVIEW_EVENT, handleSettingsUpdated);
    window.addEventListener("storage", handleSettingsUpdated);
    window.addEventListener(AUTH_UPDATED_EVENT, handleAuthUpdated);

    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
      window.removeEventListener(SETTINGS_PREVIEW_EVENT, handleSettingsUpdated);
      window.removeEventListener("storage", handleSettingsUpdated);
      window.removeEventListener(AUTH_UPDATED_EVENT, handleAuthUpdated);
    };
  }, []);

  const getTodayKey = (date = new Date()) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${date.getFullYear()}-${month}-${day}`;
  };

  const getDaysUntilReminder = (reminderDate) => {
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const reminder = new Date(reminderDate);
    const startReminder = new Date(reminder.getFullYear(), reminder.getMonth(), reminder.getDate());

    return Math.round((startReminder - startToday) / (1000 * 60 * 60 * 24));
  };

  const getReminderKey = (memory) => (
    `memory-reminder-${memory._id}-${memory.reminderDate?.split("T")[0] || ""}`
  );

  const upcomingReminders = useMemo(() => {
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const reminderWindowEnd = new Date();
    reminderWindowEnd.setDate(today.getDate() + Number(settings.reminderLeadDays || 2));

    return memories.filter((memory) => {
      if(!memory.reminderDate){
        return false;
      }

      const reminder = new Date(memory.reminderDate);
      const startReminder = new Date(reminder.getFullYear(), reminder.getMonth(), reminder.getDate());
      return startReminder >= startToday && startReminder <= reminderWindowEnd;
    });
  }, [memories, settings.reminderLeadDays]);

  const reminderPageSize = 5;
  const reminderPageCount = Math.max(1, Math.ceil(upcomingReminders.length / reminderPageSize));
  const pagedReminders = upcomingReminders.slice(
    reminderPage * reminderPageSize,
    reminderPage * reminderPageSize + reminderPageSize
  );

  useEffect(() => {
    if(reminderPage >= reminderPageCount){
      setReminderPage(reminderPageCount - 1);
    }
  }, [reminderPage, reminderPageCount]);

  useEffect(() => {
    if(!authenticatedUserId){
      setActiveReminder(null);
      return;
    }

    const reminder = memories.find((memory) => {
      if(!memory.reminderDate){
        return false;
      }

      const reminderKey = getReminderKey(memory);
      const dismissedDate = localStorage.getItem(`${reminderKey}-dismissed-date`);

      if(dismissedDate === getTodayKey()){
        return false;
      }

      const daysUntilReminder = getDaysUntilReminder(memory.reminderDate);

      if(daysUntilReminder < 0){
        return false;
      }

      const snoozedUntil = localStorage.getItem(`${reminderKey}-snoozed-until`);
      const snoozeDue = snoozedUntil && snoozedUntil <= getTodayKey();

      return snoozeDue || (!snoozedUntil && daysUntilReminder <= Number(settings.reminderLeadDays || 2));
    });

    setActiveReminder(reminder || null);
  }, [memories, reminderActionVersion, settings.reminderLeadDays, authenticatedUserId]);

  const dismissReminderToday = () => {
    if(!activeReminder){
      return;
    }

    localStorage.setItem(`${getReminderKey(activeReminder)}-dismissed-date`, getTodayKey());
    setActiveReminder(null);
    setReminderActionVersion(version => version + 1);
  };

  const remindTomorrow = () => {
    if(!activeReminder){
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    localStorage.setItem(`${getReminderKey(activeReminder)}-snoozed-until`, getTodayKey(tomorrow));
    setActiveReminder(null);
    setReminderActionVersion(version => version + 1);
  };

  useEffect(() => {
    if(!showReminderPanel){
      return;
    }

    const closeReminderPanel = (event) => {
      if(reminderMenuRef.current && !reminderMenuRef.current.contains(event.target)){
        setShowReminderPanel(false);
      }
    };

    document.addEventListener("pointerdown", closeReminderPanel);

    return () => {
      document.removeEventListener("pointerdown", closeReminderPanel);
    };
  }, [showReminderPanel]);

  useEffect(() => {
    if(!activeReminder){
      return;
    }

    const reminderKey = getReminderKey(activeReminder);

    if(lastSoundReminderRef.current === reminderKey){
      return;
    }

    lastSoundReminderRef.current = reminderKey;
    playAppSound("reminder");
  }, [activeReminder]);

  return (
    <>
      <div className="reminder-menu" ref={reminderMenuRef}>
        <button
          type="button"
          className="reminder-icon-btn"
          aria-label="Show reminders"
          onClick={()=>{
            setShowReminderPanel(!showReminderPanel);
            setReminderPage(0);
          }}
        >
          &#128276;
          {upcomingReminders.length > 0 && (
            <span>{upcomingReminders.length}</span>
          )}
        </button>

        {showReminderPanel && (
          <div className="reminder-popover">
            <h3>Reminders</h3>
            {!authenticatedUserId ? (
              <p>Log in to see reminders</p>
            ) : upcomingReminders.length > 0 ? (
              <>
                {pagedReminders.map((memory)=>(
                  <button
                    type="button"
                    className="reminder-popover-item"
                    key={memory._id}
                    onClick={()=>setShowReminderPanel(false)}
                  >
                    <strong>{memory.title}</strong>
                    <small>
                      {new Date(memory.reminderDate).toLocaleDateString("en-GB", {
                        day:"2-digit",
                        month:"short",
                        year:"numeric"
                      })}
                    </small>
                  </button>
                ))}

                {reminderPageCount > 1 && (
                  <div className="reminder-pagination">
                    <button
                      type="button"
                      aria-label="Previous reminders"
                      disabled={reminderPage === 0}
                      onClick={()=>setReminderPage(page => Math.max(0, page - 1))}
                    >
                      &#8249;
                    </button>
                    <span>{reminderPage + 1} / {reminderPageCount}</span>
                    <button
                      type="button"
                      aria-label="Next reminders"
                      disabled={reminderPage >= reminderPageCount - 1}
                      onClick={()=>setReminderPage(page => Math.min(reminderPageCount - 1, page + 1))}
                    >
                      &#8250;
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p>No reminders in this window</p>
            )}
          </div>
        )}
      </div>

      {activeReminder && (
        <div className="reminder-alert-overlay">
          <div className="reminder-alert-card" role="dialog" aria-modal="true">
            <span className="reminder-alert-icon" aria-hidden="true">
              &#128276;
            </span>
            <p className="reminder-alert-kicker">Reminder coming up</p>
            <h3>{activeReminder.title}</h3>
            <p>
              This memory is scheduled for{" "}
              <strong>
                {new Date(activeReminder.reminderDate).toLocaleDateString("en-GB", {
                  day:"2-digit",
                  month:"short",
                  year:"numeric"
                })}
              </strong>
              . Reminder messages start {settings.reminderLeadDays} day{Number(settings.reminderLeadDays) === 1 ? "" : "s"} before.
            </p>
            <div className="reminder-alert-actions">
              <button type="button" className="reminder-ignore-btn" onClick={dismissReminderToday}>
                Dismiss today
              </button>
              <button type="button" className="reminder-tomorrow-btn" onClick={remindTomorrow}>
                Remind me tomorrow
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ReminderWidget;
