/* ------------------------------------------------------------------ *
 * Background music.
 *
 * Browsers refuse to start audio without a user gesture, so playback is
 * armed here and only actually started from the click on the title card --
 * the same gesture that takes the pointer lock.  Tracks stream one at a time
 * rather than being decoded into AudioBuffers: the full playlist is large,
 * and holding it as PCM would waste hundreds of megabytes.
 * ------------------------------------------------------------------ */

/**
 * The playlist.
 *
 * Add your own by dropping files into `public/audio/` and listing the
 * filenames here -- `.gitignore` keeps everything in that folder out of the
 * repository except the one track this project ships with, so a local
 * collection can never be committed by accident.
 *
 * The list may be empty. Everything below tolerates that: `available` comes
 * back false, `main.js` skips the on/off toast, and the HUD's volume control
 * simply does nothing. The world is quiet and nothing else changes.
 *
 * Lives in public/, so it is served from the site root rather than resolved
 * relative to this module. BASE_URL keeps that correct under `base: './'`,
 * where a built page may be opened from a subdirectory.
 */
const TRACKS = [
  // пусто: положите свои треки в public/audio/ и перечислите их здесь
].map((file) => import.meta.env.BASE_URL + `audio/${file}`);

export function createMusic({ volume = 0.34, fadeIn = 2.6 } = {}) {
  let playOrder = [];
  let lastTrackIndex = -1;

  function refillPlayOrder() {
    playOrder = TRACKS.map((_, index) => index);
    for (let i = playOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playOrder[i], playOrder[j]] = [playOrder[j], playOrder[i]];
    }
    if (playOrder.length > 1 && playOrder[0] === lastTrackIndex) {
      const swapIndex = 1 + Math.floor(Math.random() * (playOrder.length - 1));
      [playOrder[0], playOrder[swapIndex]] = [playOrder[swapIndex], playOrder[0]];
    }
  }

  function takeNextTrackIndex() {
    if (playOrder.length === 0) refillPlayOrder();
    lastTrackIndex = playOrder.shift();
    return lastTrackIndex;
  }

  let trackIndex = takeNextTrackIndex();
  const el = new Audio(TRACKS[trackIndex]);
  // Individual tracks do not loop. The ended handler advances through a
  // shuffled round, then reshuffles without repeating the previous last track.
  el.loop = false;
  el.preload = 'auto';
  el.volume = 0;

  let target = volume;
  let lastAudibleVolume = volume > 0.001 ? volume : 0.34;
  let muted = volume <= 0.001;
  let started = false;
  /* An empty playlist is a supported state, not an error to discover at the
   * first click: `available` has to be false straight away or the M key
   * reports music that was never there. */
  let failed = TRACKS.length === 0;
  let rampTimer = null;
  let snapTimer = null;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function advanceTrack() {
    if (!TRACKS.length) return;
    trackIndex = takeNextTrackIndex();
    el.src = TRACKS[trackIndex];
    el.load();
  }

  /**
   * Linear volume ramp.
   *
   * Deliberately on timers rather than requestAnimationFrame: rAF can be
   * suspended outright (hidden tab, embedded view, a pane that isn't
   * compositing), and a stalled envelope would leave the track playing at
   * volume zero. The trailing snap is the guarantee -- however badly the
   * interval is throttled, the volume always lands on `target`.
   */
  function rampTo(to, seconds) {
    target = clamp01(to);
    clearInterval(rampTimer);
    clearTimeout(snapTimer);

    const settle = () => {
      clearInterval(rampTimer);
      clearTimeout(snapTimer);
      rampTimer = snapTimer = null;
      el.volume = target;
      if (target === 0 && muted) el.pause();
    };

    const distance = Math.abs(target - el.volume);
    if (!(seconds > 0) || distance < 0.004) return settle();

    // rate is scaled by the distance actually being covered, so `seconds` is
    // the duration of *this* fade rather than of a full 0..1 sweep
    const STEP_MS = 33;
    const perStep = (STEP_MS / 1000) * (distance / seconds);
    rampTimer = setInterval(() => {
      const d = target - el.volume;
      el.volume = clamp01(el.volume + Math.sign(d) * Math.min(Math.abs(d), perStep));
      if (Math.abs(target - el.volume) < 0.004) settle();
    }, STEP_MS);
    snapTimer = setTimeout(settle, seconds * 1000 + 600);
  }

  const api = {
    el,
    get muted() { return muted; },
    get volume() { return volume; },
    get available() { return !failed; },

    /** Call from a real user gesture (click / keydown), not on load. */
    start() {
      if (started || failed) return;
      started = true;
      el.volume = 0;
      // A saved zero-volume preference is a real mute state. Arm playback
      // without silently streaming a track; the slider or M key can resume it.
      if (muted) return;
      el.play().then(
        () => rampTo(volume, fadeIn),
        () => {
          // autoplay policy or a missing/unsupported file: fail quietly,
          // the scene is the point and it works fine in silence
          failed = true;
          started = false;
        }
      );
    },

    toggle() {
      if (failed) return muted;
      muted = !muted;
      if (muted) {
        rampTo(0, 0.35);
      } else {
        if (volume <= 0.001) volume = lastAudibleVolume;
        if (el.paused) el.play().catch(() => { failed = true; });
        rampTo(volume, 0.5);
      }
      return muted;
    },

    setVolume(v) {
      volume = clamp01(v);
      if (volume > 0.001) {
        lastAudibleVolume = volume;
        muted = false;
        if (started) {
          if (el.paused) el.play().catch(() => { failed = true; });
          rampTo(volume, 0.3);
        }
      } else {
        muted = true;
        if (started) rampTo(0, 0.25);
      }
      return muted;
    },
  };

  el.addEventListener('ended', () => {
    advanceTrack();
    if (!started || failed || muted || document.hidden) return;
    el.play().catch(() => {
      failed = true;
      started = false;
    });
  });

  // Pause while the tab is in the background; resume on return.
  document.addEventListener('visibilitychange', () => {
    if (!started || failed || muted) return;
    if (document.hidden) {
      el.pause();
    } else {
      el.play().catch(() => {});
    }
  });

  return api;
}
