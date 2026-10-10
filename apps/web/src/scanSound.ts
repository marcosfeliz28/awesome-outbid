// 05-M2: pitido del lector. Con el lector la cajera mira a la clienta, no a la
// pantalla: un tono corto y agudo dice «agregado» y uno largo y grave,
// «revisa la pantalla». Se puede apagar en la caja; la elección es de este
// equipo (localStorage) y, si el navegador no deja guardarla, queda encendido.
const KEY = "nexora-scan-sound";

export function scanSoundEnabled() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function setScanSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* Sin almacenamiento (modo privado): vale para esta pantalla. */
  }
}

export const TONES = {
  ok: { frequency: 1760, seconds: 0.07 },
  error: { frequency: 220, seconds: 0.35 },
} as const;

let audio: AudioContext | null = null;
export function scanBeep(kind: keyof typeof TONES) {
  if (!scanSoundEnabled()) return;
  try {
    const Context: typeof AudioContext | undefined =
      window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Context) return;
    audio ??= new Context();
    if (audio.state === "suspended") void audio.resume();
    const { frequency, seconds } = TONES[kind];
    const now = audio.currentTime;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    gain.connect(audio.destination);
    const tone = audio.createOscillator();
    tone.type = kind === "ok" ? "sine" : "square";
    tone.frequency.value = frequency;
    tone.connect(gain);
    tone.start(now);
    tone.stop(now + seconds + 0.02);
    // En un celular, además, una vibración corta en el error.
    if (kind === "error") navigator.vibrate?.(200);
  } catch {
    /* Sin audio: el aviso en pantalla sigue ahí. */
  }
}
