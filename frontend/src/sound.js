import { loadSettings } from "./settings";

const soundNotes = {
  bell:[880, 660, 440],
  chime:[523, 659, 784],
  sparkle:[988, 1175, 1568],
  pop:[392, 523]
};

export const playAppSound = (type, overrideSettings) => {
  const settings = overrideSettings || loadSettings();

  if(!settings.soundEnabled){
    return;
  }

  const soundName = settings[`${type}Sound`] || "chime";
  const notes = soundNotes[soundName] || soundNotes.chime;

  try{
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();

    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startsAt = audioContext.currentTime + index * 0.1;

      oscillator.type = soundName === "pop" ? "square" : "sine";
      oscillator.frequency.setValueAtTime(frequency, startsAt);
      gain.gain.setValueAtTime(0.0001, startsAt);
      gain.gain.exponentialRampToValueAtTime(0.12, startsAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.22);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startsAt);
      oscillator.stop(startsAt + 0.24);
    });

    window.setTimeout(() => audioContext.close(), 900);
  }catch{
    // Sound is optional; browsers may block audio until the user interacts.
  }
};
