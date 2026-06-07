import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProfile, updatePassword, updateProfile } from "../services/api";
import PageTransition from "../components/PageTransition";
import { defaultSettings, loadSettings, previewSettings, saveSettings } from "../settings";
import { playAppSound } from "../sound";

function Profile() {
  const navigate = useNavigate();
  const [name,setName] = useState("");
  const [age,setAge] = useState("");
  const [email,setEmail] = useState("");
  const [memoryCount,setMemoryCount] = useState(0);
  const [favoriteCount,setFavoriteCount] = useState(0);
  const [currentPassword,setCurrentPassword] = useState("");
  const [newPassword,setNewPassword] = useState("");
  const [message,setMessage] = useState("");
  const [appSettings,setAppSettings] = useState(()=>loadSettings());
  const backupFileRef = useRef(null);

  useEffect(()=>{
    const fetchProfile = async () => {
      const res = await getProfile();
      setName(res.data.name || "");
      setAge(res.data.age ?? "");
      setEmail(res.data.email);
      setMemoryCount(res.data.memoryCount);
      setFavoriteCount(res.data.favoriteCount);
    };

    fetchProfile();
  },[]);

  useEffect(()=>{
    return () => {
      previewSettings(loadSettings());
    };
  },[]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try{
      const submittedProfile = {
        name:name.trim(),
        age,
        email
      };
      const res = await updateProfile(submittedProfile);
      setName(Object.hasOwn(res.data, "name") ? res.data.name : submittedProfile.name);
      setAge(Object.hasOwn(res.data, "age") ? res.data.age ?? "" : submittedProfile.age);
      setEmail(res.data.email || submittedProfile.email);
      setMessage("Profile updated");
    }catch(err){
      setMessage(err.response?.data?.message || "Profile update failed");
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    try{
      await updatePassword({currentPassword,newPassword});
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated");
    }catch(err){
      setMessage(err.response?.data?.message || "Password update failed");
    }
  };

  const handleSettingsUpdate = (e) => {
    e.preventDefault();
    const savedSettings = saveSettings(appSettings);
    setAppSettings(savedSettings);
    setMessage("Settings updated");
  };

  const handleSettingsReset = () => {
    const resetSettings = saveSettings(defaultSettings);
    setAppSettings(resetSettings);
    setMessage("Settings reset");
  };

  const updateSetting = (key, value) => {
    setAppSettings(currentSettings => {
      const previewedSettings = previewSettings({
        ...currentSettings,
        [key]:value
      });

      return previewedSettings;
    });
  };

  const createSettingsBackup = () => {
    const reminderState = Object.keys(localStorage)
      .filter((key)=>key.startsWith("memory-reminder-"))
      .reduce((items, key) => ({
        ...items,
        [key]:localStorage.getItem(key)
      }), {});
    const backup = {
      version:1,
      exportedAt:new Date().toISOString(),
      settings:appSettings,
      reminderState
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "memory-app-settings-backup.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage("Backup downloaded");
  };

  const restoreSettingsBackup = async (event) => {
    const file = event.target.files?.[0];

    if(!file){
      return;
    }

    try{
      const backup = JSON.parse(await file.text());
      const restoredSettings = saveSettings(backup.settings || backup);

      Object.entries(backup.reminderState || {}).forEach(([key, value]) => {
        if(key.startsWith("memory-reminder-")){
          localStorage.setItem(key, value);
        }
      });

      setAppSettings(restoredSettings);
      setMessage("Backup restored");
    }catch{
      setMessage("Backup restore failed");
    }finally{
      event.target.value = "";
    }
  };

  const testSound = (type) => {
    playAppSound(type, appSettings);
  };

  return (
    <PageTransition>
      <div className="profile-page">
        {message && <div className="toast">{message}</div>}

        <section className="profile-summary-card">
          <div className="profile-avatar" aria-hidden="true">
            {(name || email || "U").charAt(0).toUpperCase()}
          </div>

          <div className="profile-summary-content">
            <p className="profile-eyebrow">Your profile</p>
            <h1>{name || "Name not set"}</h1>

            <div className="profile-info-list">
              <div>
                <span>Name</span>
                <strong>{name || "Not set"}</strong>
              </div>
              <div>
                <span>Age</span>
                <strong>{age !== "" ? `${age}` : "Not set"}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{email || "Not set"}</strong>
              </div>
            </div>
          </div>
        </section>

        <div className="profile-grid">
          <div className="profile-card settings-card">
            <h2>Settings</h2>
            <form onSubmit={handleSettingsUpdate}>
              <label className="settings-field">
                <span>Reminder starts</span>
                <select
                  value={appSettings.reminderLeadDays}
                  onChange={(e)=>updateSetting("reminderLeadDays", Number(e.target.value))}
                >
                  <option value="1">1 day before</option>
                  <option value="2">2 days before</option>
                  <option value="3">3 days before</option>
                  <option value="5">5 days before</option>
                  <option value="7">1 week before</option>
                </select>
              </label>

              <label className="settings-field">
                <span>Default theme</span>
                <div className="segmented-setting">
                  <button
                    type="button"
                    className={appSettings.defaultTheme === "light" ? "active" : ""}
                    onClick={()=>updateSetting("defaultTheme", "light")}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    className={appSettings.defaultTheme === "dark" ? "active" : ""}
                    onClick={()=>updateSetting("defaultTheme", "dark")}
                  >
                    Dark
                  </button>
                </div>
              </label>

              <label className="settings-field">
                <span>Memory card size</span>
                <select
                  value={appSettings.cardSize}
                  onChange={(e)=>updateSetting("cardSize", e.target.value)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </label>

              <div className="settings-section-title">Appearance</div>

              <div className="settings-row two-column">
                <label className="settings-field">
                  <span>Top buttons placement</span>
                  <select
                    value={appSettings.topButtonsPosition}
                    onChange={(e)=>updateSetting("topButtonsPosition", e.target.value)}
                  >
                    <option value="right">Right</option>
                    <option value="left">Left</option>
                  </select>
                </label>

                <label className="settings-field">
                  <span>Top buttons size</span>
                  <input
                    type="range"
                    min="42"
                    max="78"
                    step="2"
                    value={appSettings.topButtonsSize}
                    onChange={(e)=>updateSetting("topButtonsSize", Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="settings-row">
                <label className="settings-field">
                  <span>Font size</span>
                  <select
                    value={appSettings.fontSize}
                    onChange={(e)=>updateSetting("fontSize", e.target.value)}
                  >
                    <option value="small">Small</option>
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                    <option value="extra">Extra large</option>
                  </select>
                </label>

                <label className="settings-field">
                  <span>Font weight</span>
                  <select
                    value={appSettings.fontWeight}
                    onChange={(e)=>updateSetting("fontWeight", e.target.value)}
                  >
                    <option value="normal">Normal</option>
                    <option value="600">Semi bold</option>
                    <option value="700">Bold</option>
                    <option value="800">Extra bold</option>
                  </select>
                </label>

                <label className="settings-field">
                  <span>Font style</span>
                  <select
                    value={appSettings.fontStyle}
                    onChange={(e)=>updateSetting("fontStyle", e.target.value)}
                  >
                    <option value="normal">Default</option>
                    <option value="modern">Modern</option>
                    <option value="rounded">Rounded</option>
                    <option value="classic">Classic serif</option>
                    <option value="mono">Monospace</option>
                    <option value="handwritten">Handwritten</option>
                    <option value="italic">Italic</option>
                  </select>
                </label>
              </div>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={appSettings.containerGlass}
                  onChange={(e)=>updateSetting("containerGlass", e.target.checked)}
                />
                <span>Container glass effect</span>
              </label>

              <label className="settings-field">
                <span>Container transparency</span>
                <input
                  type="range"
                  min="0.04"
                  max="0.45"
                  step="0.01"
                  value={appSettings.containerGlassAlpha}
                  onChange={(e)=>updateSetting("containerGlassAlpha", Number(e.target.value))}
                />
              </label>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={appSettings.buttonGlass}
                  onChange={(e)=>updateSetting("buttonGlass", e.target.checked)}
                />
                <span>Button glass effect</span>
              </label>

              <label className="settings-color-field">
                <span>Button background color</span>
                <input
                  type="color"
                  value={appSettings.buttonBackgroundColor}
                  onChange={(e)=>updateSetting("buttonBackgroundColor", e.target.value)}
                />
              </label>

              <label className="settings-field">
                <span>Button transparency</span>
                <input
                  type="range"
                  min="0.08"
                  max="0.55"
                  step="0.01"
                  value={appSettings.buttonGlassAlpha}
                  onChange={(e)=>updateSetting("buttonGlassAlpha", Number(e.target.value))}
                />
              </label>

              <label className="settings-field">
                <span>Floating hearts speed</span>
                <select
                  value={appSettings.heartsSpeed}
                  onChange={(e)=>updateSetting("heartsSpeed", e.target.value)}
                >
                  <option value="slow">Slow</option>
                  <option value="normal">Normal</option>
                  <option value="fast">Fast</option>
                  <option value="fixed">Fixed</option>
                </select>
              </label>

              <div className="settings-section-title">Background Colors</div>

              <div className="settings-color-grid">
                <label>
                  <span>Light start</span>
                  <input type="color" value={appSettings.lightGradientStart} onChange={(e)=>updateSetting("lightGradientStart", e.target.value)} />
                </label>
                <label>
                  <span>Light middle</span>
                  <input type="color" value={appSettings.lightGradientMiddle} onChange={(e)=>updateSetting("lightGradientMiddle", e.target.value)} />
                </label>
                <label>
                  <span>Light end</span>
                  <input type="color" value={appSettings.lightGradientEnd} onChange={(e)=>updateSetting("lightGradientEnd", e.target.value)} />
                </label>
                <label>
                  <span>Dark start</span>
                  <input type="color" value={appSettings.darkGradientStart} onChange={(e)=>updateSetting("darkGradientStart", e.target.value)} />
                </label>
                <label>
                  <span>Dark middle</span>
                  <input type="color" value={appSettings.darkGradientMiddle} onChange={(e)=>updateSetting("darkGradientMiddle", e.target.value)} />
                </label>
                <label>
                  <span>Dark end</span>
                  <input type="color" value={appSettings.darkGradientEnd} onChange={(e)=>updateSetting("darkGradientEnd", e.target.value)} />
                </label>
              </div>

              <div className="settings-section-title">Memory Hover</div>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={appSettings.hoverEnabled}
                  onChange={(e)=>updateSetting("hoverEnabled", e.target.checked)}
                />
                <span>Enable memory hover</span>
              </label>

              <label className="settings-field">
                <span>Hover size</span>
                <input
                  type="range"
                  min="1"
                  max="1.14"
                  step="0.01"
                  value={appSettings.hoverScale}
                  onChange={(e)=>updateSetting("hoverScale", Number(e.target.value))}
                />
              </label>

              <div className="settings-section-title">Backup & Sound</div>

              <div className="settings-actions">
                <button type="button" onClick={createSettingsBackup}>Backup Settings</button>
                <button type="button" onClick={()=>backupFileRef.current?.click()}>Restore Settings</button>
              </div>
              <input
                ref={backupFileRef}
                type="file"
                accept="application/json"
                className="settings-backup-input"
                onChange={restoreSettingsBackup}
              />

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={appSettings.soundEnabled}
                  onChange={(e)=>updateSetting("soundEnabled", e.target.checked)}
                />
                <span>Notification sounds</span>
              </label>

              <div className="settings-row">
                <label className="settings-field">
                  <span>New memory</span>
                  <select value={appSettings.createSound} onChange={(e)=>updateSetting("createSound", e.target.value)}>
                    <option value="sparkle">Sparkle</option>
                    <option value="chime">Chime</option>
                    <option value="bell">Bell</option>
                    <option value="pop">Pop</option>
                  </select>
                </label>
                <label className="settings-field">
                  <span>Update memory</span>
                  <select value={appSettings.updateSound} onChange={(e)=>updateSetting("updateSound", e.target.value)}>
                    <option value="chime">Chime</option>
                    <option value="sparkle">Sparkle</option>
                    <option value="bell">Bell</option>
                    <option value="pop">Pop</option>
                  </select>
                </label>
                <label className="settings-field">
                  <span>Reminder popup</span>
                  <select value={appSettings.reminderSound} onChange={(e)=>updateSetting("reminderSound", e.target.value)}>
                    <option value="bell">Bell</option>
                    <option value="chime">Chime</option>
                    <option value="sparkle">Sparkle</option>
                    <option value="pop">Pop</option>
                  </select>
                </label>
              </div>

              <div className="settings-actions">
                <button type="button" onClick={()=>testSound("create")}>Test New</button>
                <button type="button" onClick={()=>testSound("update")}>Test Update</button>
                <button type="button" onClick={()=>testSound("reminder")}>Test Reminder</button>
              </div>

              <div className="settings-save-actions">
                <button type="submit">Save Settings</button>
                <button type="button" className="settings-reset-btn" onClick={handleSettingsReset}>
                  Reset
                </button>
              </div>
            </form>
          </div>

          <div className="profile-card">
            <h2>Profile</h2>
            <div className="profile-stats">
              <span>{memoryCount} memories</span>
              <span>{favoriteCount} favorites</span>
            </div>

            <form onSubmit={handleProfileUpdate}>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e)=>setName(e.target.value)}
              />
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Age"
                value={age}
                onChange={(e)=>setAge(e.target.value)}
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                required
              />
              <button type="submit">Update Profile</button>
            </form>
          </div>

          <div className="profile-card">
            <h2>Password</h2>
            <form onSubmit={handlePasswordUpdate}>
              <input
                type="password"
                placeholder="Current Password"
                value={currentPassword}
                onChange={(e)=>setCurrentPassword(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e)=>setNewPassword(e.target.value)}
                required
              />
              <button type="submit">Change Password</button>
            </form>
          </div>
        </div>

        <button className="profile-back-btn" onClick={()=>navigate("/timeline")}>
          Back to Timeline
        </button>
      </div>
    </PageTransition>
  );
}

export default Profile;
