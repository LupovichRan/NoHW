#!/usr/bin/env node
// Node 18+. No dependencies. The speech key is read from the environment and never written.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "simple", "voice");
const linesPath = path.join(dir, "lines.json");
const hashPath = path.join(dir, "hashes.json");
const key = process.env.AZURE_SPEECH_KEY || "";
const region = process.env.AZURE_SPEECH_REGION || "";

if (!key || !region) {
  console.error("Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION, then run: node tools/gen-voice.mjs");
  process.exit(1);
}
if (!/^[a-z0-9]+$/.test(region)) {
  console.error("AZURE_SPEECH_REGION should be a region name such as northeurope.");
  process.exit(1);
}

const lines = JSON.parse(fs.readFileSync(linesPath, "utf8"));
const hashes = fs.existsSync(hashPath) ? JSON.parse(fs.readFileSync(hashPath, "utf8")) : {};

function sha(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}
function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function safeErr(body) {
  return String(body || "").split(key).join("[key]").slice(0, 180);
}
function saveHashes() {
  fs.writeFileSync(hashPath, JSON.stringify(hashes, null, 2) + "\n");
}

async function synthesize(id, text) {
  const ssml = '<?xml version="1.0" encoding="utf-8"?>' +
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="he-IL">' +
    '<voice name="he-IL-HilaNeural">' + escapeXml(text) + "</voice></speak>";
  const url = "https://" + region + ".tts.speech.microsoft.com/cognitiveservices/v1";
  let res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "nohw-gen-voice"
    },
    body: ssml
  });
  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after")) || 3;
    await new Promise(function (resolve) { setTimeout(resolve, wait * 1000); });
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "nohw-gen-voice"
      },
      body: ssml
    });
  }
  if (!res.ok) {
    console.error(id, res.status, safeErr(await res.text()));
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) {
    console.error(id, "empty audio");
    process.exit(1);
  }
  fs.writeFileSync(path.join(dir, id + ".mp3"), buf);
  hashes[id] = sha(text);
  saveHashes();
}

let wrote = 0;
let skipped = 0;
for (const line of lines) {
  const id = String(line.id || "");
  const text = String(line.text || "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    console.error("bad id", id);
    process.exit(1);
  }
  if (!text) continue;
  const hash = sha(text);
  const file = path.join(dir, id + ".mp3");
  if (hashes[id] === hash && fs.existsSync(file) && fs.statSync(file).size > 100) {
    skipped += 1;
    continue;
  }
  await synthesize(id, text);
  wrote += 1;
  console.log("wrote", id);
  await new Promise(function (resolve) { setTimeout(resolve, 200); });
}
console.log("done", wrote, "new,", skipped, "unchanged");
