// Read a FleetRunner release archive and say whether it is exactly what release.json records
// (#647, slice 1). Run by verify-release.sh before anything is loaded; prints PASS or FAIL.
//
//   node verify-archive.mjs <archive> <release.json> <tag> <image-id> <manifest-digest-or-empty>
//
// The rule throughout is an exact allowlist, and refuse everything else. Docker and tar clean
// paths, match JSON field names case-insensitively and let the last duplicate win, so anything
// they could read differently from this script is refused rather than reconciled:
//   - tar members: plain ustar headers only, regular files and directories, and only the names a
//     BuildKit docker export contains. Each name appears once.
//   - JSON: parsed by a strict reader that rejects duplicate keys; every object has exactly the
//     expected keys (so `config` or `CONFIG` beside `Config` is refused).
// A different archive cannot pass by sharing a tag the host already has: the single image's config
// blob must hash to the recorded image ID, and its only tag must be the release tag.
import { createHash } from "node:crypto";
import { fstatSync, openSync, readFileSync, readSync } from "node:fs";

const [archive, releaseFile, tag, imageId, manifestDigest] = process.argv.slice(2);
const fail = (why) => {
  console.log(`FAIL ${why}`);
  process.exit(1);
};

// ---- strict JSON: no duplicate keys, no prototype keys, bounded depth --------------------------
function parseStrict(text, what) {
  let i = 0;
  const bad = () => fail(`${what} is not valid JSON`);
  const ws = () => {
    while (i < text.length && " \t\n\r".includes(text[i])) i += 1;
  };
  const string = () => {
    const start = i;
    i += 1;
    while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    if (text[i] !== '"') bad();
    i += 1;
    try {
      return JSON.parse(text.slice(start, i));
    } catch {
      return bad();
    }
  };
  const value = (depth) => {
    if (depth > 12) bad();
    ws();
    const c = text[i];
    if (c === "{") {
      i += 1;
      const object = Object.create(null);
      ws();
      if (text[i] === "}") {
        i += 1;
        return object;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') bad();
        const key = string();
        if (key in object) fail(`${what} repeats the key ${JSON.stringify(key)}`);
        ws();
        if (text[i] !== ":") bad();
        i += 1;
        object[key] = value(depth + 1);
        ws();
        if (text[i] === ",") i += 1;
        else if (text[i] === "}") {
          i += 1;
          return object;
        } else bad();
      }
    }
    if (c === "[") {
      i += 1;
      const array = [];
      ws();
      if (text[i] === "]") {
        i += 1;
        return array;
      }
      for (;;) {
        array.push(value(depth + 1));
        ws();
        if (text[i] === ",") i += 1;
        else if (text[i] === "]") {
          i += 1;
          return array;
        } else bad();
      }
    }
    if (c === '"') return string();
    const literal = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 40));
    if (!literal) bad();
    i += literal[0].length;
    return JSON.parse(literal[0]);
  };
  const result = value(0);
  ws();
  if (i !== text.length) bad();
  return result;
}
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// The object has exactly these keys: no more, no fewer, no differently-cased lookalikes.
const exactKeys = (object, keys, what) => {
  if (!isObject(object)) fail(`${what} is not an object`);
  const have = Object.keys(object).sort().join(",");
  if (have !== [...keys].sort().join(",")) fail(`${what} does not have exactly the expected keys`);
};

// ---- release.json ------------------------------------------------------------------------------
const release = parseStrict(readFileSync(releaseFile, "utf8"), "release.json");
exactKeys(
  release,
  [
    "format", "revision", "short_revision", "source_date_epoch", "tag", "platform", "user", "image_id",
    "manifest_digest", "layers", "archive", "archive_sha256", "inputs", "reproducibility",
  ],
  "release.json",
);
if (release.tag !== tag || release.image_id !== imageId || (release.manifest_digest ?? "") !== manifestDigest) {
  fail("release.json differs between its text and its JSON");
}

// ---- tar: plain ustar, allowlisted names, one parse for names, types and bytes ------------------
const FILES = [/^manifest\.json$/, /^index\.json$/, /^oci-layout$/, /^blobs\/sha256\/[0-9a-f]{64}$/];
const DIRECTORIES = new Set(["blobs/", "blobs/sha256/"]);
const MAX_MEMBER = 1 << 24;
const fd = openSync(archive, "r");
const total = fstatSync(fd).size;
const members = new Map();
let endOfMembers = 0;
const header = Buffer.alloc(512);
const text = (from, length) => header.toString("latin1", from, from + length).replace(/\0.*$/s, "");
for (let pos = 0; ; ) {
  if (pos + 512 > total) fail("archive is truncated");
  readSync(fd, header, 0, 512, pos);
  if (header.every((byte) => byte === 0)) {
    endOfMembers = pos;
    break;
  }
  if (text(257, 6) !== "ustar") fail("archive is not plain ustar");
  const name = text(0, 100);
  const kind = header[156] === 0 ? "0" : String.fromCharCode(header[156]);
  const octal = text(124, 12).trim();
  if (!/^[0-7]+$/.test(octal)) fail("archive member size");
  const size = parseInt(octal, 8);
  if (text(345, 155) !== "") fail("archive member has a name prefix");
  if (kind !== "0" && kind !== "5") fail("archive has a member that is not a plain file or directory");
  // A directory has no payload. One that claims a size would hide the bytes after it from this
  // parse while a tar or Docker reader that does not skip them could read a second manifest.json.
  if (kind === "5" && size !== 0) fail("archive directory member has a nonzero size");
  const allowed = kind === "5" ? DIRECTORIES.has(name) : FILES.some((pattern) => pattern.test(name));
  if (!allowed) fail("archive has a member outside the allowed layout");
  if (members.has(name)) fail("archive has a member that appears twice");
  const dataStart = pos + 512;
  const next = dataStart + Math.ceil(size / 512) * 512;
  if (next > total) fail("archive is truncated");
  members.set(name, { kind, dataStart, size });
  pos = next;
}
// After the end-of-archive block there must be nothing but zeros: a reader that continues past it
// (or rejects it, as Go's does) must not see something this parse never examined.
{
  const chunk = Buffer.alloc(1 << 16);
  for (let at = endOfMembers; at < total; at += chunk.length) {
    const got = readSync(fd, chunk, 0, Math.min(chunk.length, total - at), at);
    if (got <= 0 || !chunk.subarray(0, got).every((byte) => byte === 0)) fail("archive has data after its end marker");
  }
}
const read = (name) => {
  const member = members.get(name);
  if (!member || member.kind !== "0") return null;
  if (member.size > MAX_MEMBER) fail("archive member is too large to check");
  const buffer = Buffer.alloc(member.size);
  readSync(fd, buffer, 0, member.size, member.dataStart);
  return buffer;
};
const readText = (name) => read(name)?.toString("utf8") ?? null;

// ---- manifest.json: one image, its real Config, its only tag -----------------------------------
const manifestText = readText("manifest.json");
if (manifestText === null) fail("archive has no manifest.json");
const manifest = parseStrict(manifestText, "manifest.json");
if (!Array.isArray(manifest) || manifest.length !== 1) fail("archive does not hold exactly one image");
const entry = manifest[0];
exactKeys(entry, ["Config", "RepoTags", "Layers"], "the manifest entry");
if (typeof entry.Config !== "string" || !/^blobs\/sha256\/[0-9a-f]{64}$/.test(entry.Config)) fail("archive config name");
if (!Array.isArray(entry.Layers) || !entry.Layers.every((layer) => typeof layer === "string")) fail("archive layers");
const config = read(entry.Config);
if (config === null) fail("archive has no config blob");
const actualId = `sha256:${createHash("sha256").update(config).digest("hex")}`;
if (actualId !== imageId) fail(`archive image ID is ${actualId}, not the recorded one`);
if (entry.RepoTags.length !== 1 || entry.RepoTags[0] !== tag) fail(`archive tags are not exactly ${tag}`);

// ---- index.json and oci-layout: part of what an engine loads, so held to the same rule ----------
const indexText = readText("index.json");
if (indexText === null) {
  if (manifestDigest !== "") fail("archive has no index.json");
} else {
  if (manifestDigest === "") fail("archive has an index.json but the release records no manifest digest");
  const index = parseStrict(indexText, "index.json");
  exactKeys(index, ["schemaVersion", "mediaType", "manifests"], "index.json");
  if (!Array.isArray(index.manifests) || index.manifests.length !== 1) fail("archive index does not hold exactly one manifest");
  const descriptor = index.manifests[0];
  exactKeys(descriptor, ["mediaType", "digest", "size", "annotations", "platform"], "the index manifest");
  if (descriptor.digest !== manifestDigest) fail("archive manifest digest is not the recorded one");
  exactKeys(
    descriptor.annotations,
    ["io.containerd.image.name", "org.opencontainers.image.created", "org.opencontainers.image.ref.name"],
    "the index annotations",
  );
  // Engines that use the containerd image store name the loaded image from these annotations.
  const annotations = descriptor.annotations;
  if (annotations["io.containerd.image.name"] !== `docker.io/library/${tag}`) fail("archive index names another image");
  if (annotations["org.opencontainers.image.ref.name"] !== tag.slice("fleet-runner:".length)) {
    fail("archive index ref name is not the release revision");
  }
  exactKeys(descriptor.platform, ["architecture", "os"], "the index platform");
  if (descriptor.platform.architecture !== "amd64" || descriptor.platform.os !== "linux") fail("archive index platform");

  // An engine using the containerd image store imports from index.json and ignores manifest.json,
  // so the OCI manifest the index points at must say the same thing: its bytes hash to the digest
  // the index and the release record, its config is the checked image, and its layers are the
  // ones manifest.json lists.
  if (!/^sha256:[0-9a-f]{64}$/.test(manifestDigest)) fail("manifest digest argument");
  const ociBytes = read(`blobs/sha256/${manifestDigest.slice("sha256:".length)}`);
  if (ociBytes === null) fail("archive has no OCI manifest blob");
  if (`sha256:${createHash("sha256").update(ociBytes).digest("hex")}` !== manifestDigest) {
    fail("archive OCI manifest does not hash to the recorded manifest digest");
  }
  const oci = parseStrict(ociBytes.toString("utf8"), "the OCI manifest");
  exactKeys(oci, ["schemaVersion", "mediaType", "config", "layers"], "the OCI manifest");
  if (oci.mediaType !== "application/vnd.oci.image.manifest.v1+json") fail("archive OCI manifest media type");
  exactKeys(oci.config, ["mediaType", "digest", "size"], "the OCI manifest config");
  if (oci.config.digest !== imageId) fail("archive OCI manifest names another config than the recorded image ID");
  if (!Array.isArray(oci.layers)) fail("archive OCI manifest layers");
  oci.layers.forEach((layer) => {
    // BuildKit's timestamp rewrite adds one annotation to the layers it rewrote, and nothing else.
    const annotated = isObject(layer) && "annotations" in layer;
    exactKeys(layer, annotated ? ["mediaType", "digest", "size", "annotations"] : ["mediaType", "digest", "size"], "an OCI manifest layer");
    if (annotated) exactKeys(layer.annotations, ["buildkit/rewritten-timestamp"], "an OCI layer annotation");
  });
  const ociLayers = oci.layers.map((layer) => `blobs/sha256/${String(layer.digest).replace(/^sha256:/, "")}`);
  if (ociLayers.join("\n") !== entry.Layers.join("\n")) fail("archive OCI manifest layers differ from manifest.json");
}
const layoutText = readText("oci-layout");
if (layoutText !== null && indexText === null) fail("archive has an oci-layout but no index.json");
if (layoutText !== null) exactKeys(parseStrict(layoutText, "oci-layout"), ["imageLayoutVersion"], "oci-layout");

console.log(`PASS archive holds ${tag} with image ID ${imageId}`);
