const mergeFloat32 = (chunks) => {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return merged;
};

const downsample = (input, inputRate, outputRate = 16000) => {
  if (outputRate >= inputRate) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);
  let inputOffset = 0;

  for (let outputOffset = 0; outputOffset < outputLength; outputOffset += 1) {
    const nextInputOffset = Math.min(input.length, Math.round((outputOffset + 1) * ratio));
    let total = 0;
    let count = 0;
    for (; inputOffset < nextInputOffset; inputOffset += 1) {
      total += input[inputOffset];
      count += 1;
    }
    output[outputOffset] = count ? total / count : 0;
  }
  return output;
};

const encodeWav = (samples, sampleRate = 16000) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
};

const rms = (samples) => {
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
  return Math.sqrt(sum / Math.max(1, samples.length));
};

export const startInterviewAudioRecorder = async ({
  noSpeechTimeoutMs = 15000,
  endSilenceMs = 7000,
  maxAnswerSeconds = 120,
  onLevel,
  onState,
  onFinish,
}) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextClass({ latencyHint: "interactive" });
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const sink = context.createGain();
  sink.gain.value = 0;

  const chunks = [];
  const startedAt = performance.now();
  let noiseFloor = 0.004;
  let calibrationFrames = 0;
  let speechFrames = 0;
  let hasSpeech = false;
  let lastSpeechAt = 0;
  let finished = false;
  let lastUiUpdate = 0;

  const cleanup = async () => {
    try { processor.disconnect(); } catch { /* Already disconnected. */ }
    try { source.disconnect(); } catch { /* Already disconnected. */ }
    try { sink.disconnect(); } catch { /* Already disconnected. */ }
    stream.getTracks().forEach((track) => track.stop());
    try { await context.close(); } catch { /* Already closed. */ }
  };

  const finish = async (reason = "manual_submit") => {
    if (finished) return;
    finished = true;
    const durationMs = Math.max(0, performance.now() - startedAt);
    processor.onaudioprocess = null;
    await cleanup();

    let blob = null;
    if (hasSpeech && reason !== "no_speech") {
      const merged = mergeFloat32(chunks);
      const samples = downsample(merged, context.sampleRate, 16000);
      blob = encodeWav(samples, 16000);
    }

    onFinish?.({ reason: hasSpeech ? reason : "no_speech", durationMs, blob, hasSpeech });
  };

  processor.onaudioprocess = (event) => {
    if (finished) return;
    const input = event.inputBuffer.getChannelData(0);
    const copy = new Float32Array(input.length);
    copy.set(input);
    chunks.push(copy);

    const now = performance.now();
    const elapsedMs = now - startedAt;
    const level = rms(input);

    if (!hasSpeech && elapsedMs < 700 && level < 0.03) {
      calibrationFrames += 1;
      noiseFloor += (level - noiseFloor) / calibrationFrames;
    }

    const speechThreshold = Math.max(0.014, Math.min(0.05, noiseFloor * 2.4 + 0.005));
    if (level >= speechThreshold) {
      speechFrames += 1;
      if (speechFrames >= 2) {
        if (!hasSpeech) onState?.({ hasSpeech: true });
        hasSpeech = true;
        lastSpeechAt = now;
      }
    } else {
      speechFrames = 0;
    }

    if (now - lastUiUpdate >= 90) {
      lastUiUpdate = now;
      onLevel?.({
        level: Math.min(1, level / Math.max(0.025, speechThreshold * 2.4)),
        hasSpeech,
        elapsedMs,
        noSpeechRemainingMs: hasSpeech ? null : Math.max(0, noSpeechTimeoutMs - elapsedMs),
        silenceMs: hasSpeech ? Math.max(0, now - lastSpeechAt) : 0,
        speechThreshold,
      });
    }

    if (!hasSpeech && elapsedMs >= noSpeechTimeoutMs) {
      finish("no_speech");
      return;
    }
    if (hasSpeech && lastSpeechAt && now - lastSpeechAt >= endSilenceMs) {
      finish("silence_auto_submit");
      return;
    }
    if (elapsedMs >= maxAnswerSeconds * 1000) finish("max_duration");
  };

  source.connect(processor);
  processor.connect(sink);
  sink.connect(context.destination);

  onState?.({ hasSpeech: false });

  return {
    stop: (reason = "manual_submit") => finish(reason),
    dispose: () => {
      if (finished) return cleanup();
      finished = true;
      processor.onaudioprocess = null;
      return cleanup();
    },
  };
};
