const startsWithBytes = (buffer, bytes, offset = 0) =>
  Buffer.isBuffer(buffer) &&
  buffer.length >= offset + bytes.length &&
  bytes.every((byte, index) => buffer[offset + index] === byte);

const startsWithAscii = (buffer, value, offset = 0) =>
  startsWithBytes(buffer, [...Buffer.from(value, "ascii")], offset);

export const hasPdfSignature = (buffer) =>
  Buffer.isBuffer(buffer) &&
  buffer.subarray(0, Math.min(buffer.length, 1024)).includes(Buffer.from("%PDF-", "ascii"));

export const detectAudioSignature = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return "";
  if (startsWithAscii(buffer, "RIFF") && startsWithAscii(buffer, "WAVE", 8)) return "wav";
  if (startsWithAscii(buffer, "OggS")) return "ogg";
  if (startsWithAscii(buffer, "fLaC")) return "flac";
  if (startsWithAscii(buffer, "ID3")) return "mpeg";
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return "mpeg-or-aac";
  if (startsWithAscii(buffer, "ftyp", 4)) return "mp4-audio";
  if (startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  return "";
};

export const audioSignatureMatchesMimeType = (buffer, mimeType) => {
  const detected = detectAudioSignature(buffer);
  const mime = String(mimeType || "").toLowerCase();

  if (["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"].includes(mime)) {
    return detected === "wav";
  }
  if (mime === "audio/ogg") return detected === "ogg";
  if (mime === "audio/flac") return detected === "flac";
  if (["audio/mpeg", "audio/mp3"].includes(mime)) {
    return detected === "mpeg" || detected === "mpeg-or-aac";
  }
  if (mime === "audio/aac") return detected === "mpeg-or-aac";
  return false;
};