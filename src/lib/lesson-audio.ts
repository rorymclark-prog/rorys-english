export type LessonAudioMode = "room" | "online";

const releases = new WeakMap<MediaStream, (notify: boolean) => void>();
type SignalMeters = { microphone: () => number; call: () => number };

/** Observe an existing source without changing its gain or capturing more audio. */
function signalMeter(context: AudioContext, source: MediaStreamAudioSourceNode) {
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  return () => {
    analyser.getFloatTimeDomainData(samples);
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    return Math.min(1, peak);
  };
}

/** Each recorder/listener owns its stream. Releasing one never stops the other. */
export function releaseLessonAudio(stream: MediaStream | null | undefined, notify = false) {
  if (!stream) return;
  const release = releases.get(stream);
  if (release) { releases.delete(stream); release(notify); }
  else for (const track of stream.getTracks()) track.stop();
}

/** The call tab is selected explicitly; its video is never rendered or sent. */
export class LessonAudioInput {
  private call: MediaStream | null = null;
  private removeCallListeners: (() => void) | null = null;
  private clients = new Set<MediaStream>();
  private meters = new Map<MediaStream, SignalMeters>();
  private generation = 0;

  hasCallAudio() { return !!this.call?.getAudioTracks().some(track => track.readyState === "live"); }

  /** Raw 0–1 input peaks, not a speaker detector. Never opens a device. */
  levels() {
    for (const [stream, meters] of [...this.meters].reverse()) {
      if (stream.getAudioTracks().some(track => track.readyState === "live")) {
        return { microphone: meters.microphone(), call: meters.call() };
      }
    }
    return { microphone: 0, call: 0 };
  }

  async connectCall(onEnded: () => void) {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("This browser cannot capture call audio. Use a browser with tab-audio sharing, or record an in-person lesson with the microphone.");
    const generation = this.generation;
    let call: MediaStream;
    try {
      call = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (error) {
      const name = error && typeof error === "object" && "name" in error ? error.name : "";
      if (name === "InvalidStateError") throw new Error("Bring this lesson page to the front, then click Connect call audio again. Your browser needs a direct click on the page to open audio sharing.");
      if (name === "NotAllowedError") throw new Error("Call audio sharing was cancelled or not allowed. Check your browser's sharing permission, then click Connect call audio again and choose your call tab with Share tab audio ticked.");
      if (name === "NotReadableError") throw new Error("Your device could not start call audio capture. Check the browser's screen-recording permission in system settings and any other active screen sharing, then click Connect call audio again.");
      throw error;
    }
    if (generation !== this.generation) { call.getTracks().forEach(track => track.stop()); return false; }
    if (!call.getAudioTracks().some(track => track.readyState === "live")) {
      call.getTracks().forEach(track => track.stop());
      throw new Error("No call audio was shared. Choose your call's browser tab and tick Share tab audio. A window without audio cannot record the learner.");
    }
    this.disconnectCall();
    this.call = call;
    const ended = () => { this.disconnectCall(true); onEnded(); };
    for (const track of call.getTracks()) track.addEventListener("ended", ended);
    this.removeCallListeners = () => { for (const track of call.getTracks()) track.removeEventListener("ended", ended); };
    return true;
  }

  async acquire(mode: LessonAudioMode): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access needs a secure browser window.");
    if (mode === "online" && !this.hasCallAudio()) throw new Error("Connect your call tab audio before listening or recording an online lesson.");
    const generation = this.generation, selectedCall = this.call;
    const microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    if (generation !== this.generation || (mode === "online" && (selectedCall !== this.call || !this.hasCallAudio()))) {
      microphone.getTracks().forEach(track => track.stop());
      throw new Error("The lesson audio source changed. Connect it again before starting.");
    }
    let context: AudioContext | undefined;
    let remote: MediaStream | undefined;
    let meters: SignalMeters | undefined;
    let output = microphone;
    try {
      if (mode === "online") {
        context = new AudioContext();
        const destination = context.createMediaStreamDestination();
        output = destination.stream;
        remote = new MediaStream(selectedCall!.getAudioTracks().map(track => track.clone()));
        const microphoneSource = context.createMediaStreamSource(microphone);
        const callSource = context.createMediaStreamSource(remote);
        microphoneSource.connect(destination);
        callSource.connect(destination);
        meters = { microphone: signalMeter(context, microphoneSource), call: signalMeter(context, callSource) };
        await context.resume();
        if (generation !== this.generation || selectedCall !== this.call || !this.hasCallAudio()) throw new Error("Call audio sharing ended. Connect the call tab again.");
      }
      const result = output;
      let closed = false;
      const ended = () => releaseLessonAudio(result, true);
      microphone.getAudioTracks().forEach(track => track.addEventListener("ended", ended));
      releases.set(result, notify => {
        if (closed) return; closed = true; this.clients.delete(result); this.meters.delete(result);
        microphone.getAudioTracks().forEach(track => track.removeEventListener("ended", ended));
        for (const track of new Set([...microphone.getTracks(), ...(remote?.getTracks() || []), ...result.getTracks()])) track.stop();
        void context?.close().catch(() => {});
        // Native stop() does not emit ended. Tell consumers when capture was
        // interrupted so neither can silently continue with half the lesson.
        if (notify) result.getAudioTracks().forEach(track => track.dispatchEvent(new Event("ended")));
      });
      this.clients.add(result);
      if (meters) this.meters.set(result, meters);
      return result;
    } catch (error) {
      microphone.getTracks().forEach(track => track.stop());
      remote?.getTracks().forEach(track => track.stop());
      output.getTracks().forEach(track => track.stop());
      void context?.close().catch(() => {});
      throw error;
    }
  }

  disconnectCall(notify = false) {
    this.generation++;
    this.removeCallListeners?.(); this.removeCallListeners = null;
    this.call?.getTracks().forEach(track => track.stop()); this.call = null;
    for (const client of [...this.clients]) releaseLessonAudio(client, notify);
  }

  close() { this.disconnectCall(); }
}
