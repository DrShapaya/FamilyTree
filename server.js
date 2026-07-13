const crypto = require("crypto");
const fs = require("fs/promises");
const http = require("http");
const path = require("path");
const express = require("express");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = Number(process.env.PORT || 8765);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "server-data");
const TREES_DIR = path.join(DATA_DIR, "trees");
const SECRET_FILE = path.join(DATA_DIR, "secret.txt");
const PBKDF2_ITERATIONS = 210000;
const MAX_OPERATIONS = 5000;

const app = express();
app.use(express.json({ limit: "50mb" }));
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const treeSockets = new Map();

function slugifyTreeName(value) {
  const raw = String(value || "").trim().toLowerCase();
  const slug = raw
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug || slug.length < 2) throw new Error("Tree name is too short");
  return slug.slice(0, 80);
}

function treePath(treeId) {
  return path.join(TREES_DIR, `${treeId}.json`);
}

async function ensureStorage() {
  await fs.mkdir(TREES_DIR, { recursive: true });
  if (process.env.SERVER_SECRET) return process.env.SERVER_SECRET;
  try {
    return (await fs.readFile(SECRET_FILE, "utf8")).trim();
  } catch {
    const secret = crypto.randomBytes(48).toString("base64url");
    await fs.writeFile(SECRET_FILE, secret, "utf8");
    return secret;
  }
}

let serverSecretPromise = ensureStorage();

function hashPassword(password, salt = crypto.randomBytes(16).toString("base64url")) {
  const hash = crypto.pbkdf2Sync(String(password || ""), salt, PBKDF2_ITERATIONS, 32, "sha256").toString("base64url");
  return { salt, hash };
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash?.salt || !passwordHash?.hash) return false;
  const next = hashPassword(password, passwordHash.salt);
  return crypto.timingSafeEqual(Buffer.from(next.hash), Buffer.from(passwordHash.hash));
}

async function readTree(treeId) {
  try {
    return JSON.parse(await fs.readFile(treePath(treeId), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeTree(tree) {
  const tempPath = `${treePath(tree.id)}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, treePath(tree.id));
}

async function signToken(payload) {
  const secret = await serverSecretPromise;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

async function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const secret = await serverSecretPromise;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload.treeId || payload.exp < Date.now()) return null;
  return payload;
}

async function authRequired(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const payload = await verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Unauthorized" });
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

function publicTree(tree, sinceVersion = 0) {
  return {
    treeId: tree.id,
    treeName: tree.name,
    version: tree.version,
    state: tree.state,
    operations: tree.operations.filter((operation) => operation.version > sinceVersion),
  };
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value || {}));
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function mergeObjectMap(currentMap = {}, baseMap = {}, nextMap = {}) {
  const merged = cloneJson(currentMap);
  const ids = new Set([...Object.keys(baseMap || {}), ...Object.keys(currentMap || {}), ...Object.keys(nextMap || {})]);
  ids.forEach((id) => {
    const baseHas = Object.prototype.hasOwnProperty.call(baseMap, id);
    const currentHas = Object.prototype.hasOwnProperty.call(currentMap, id);
    const nextHas = Object.prototype.hasOwnProperty.call(nextMap, id);
    if (!baseHas && nextHas) {
      merged[id] = cloneJson(nextMap[id]);
    } else if (baseHas && !nextHas) {
      if (!currentHas || sameJson(currentMap[id], baseMap[id])) delete merged[id];
    } else if (baseHas && nextHas && !sameJson(nextMap[id], baseMap[id])) {
      merged[id] = cloneJson(nextMap[id]);
    }
  });
  return merged;
}

function mergeArrayById(currentItems = [], baseItems = [], nextItems = []) {
  const toMap = (items) =>
    new Map(
      (Array.isArray(items) ? items : [])
        .filter((item) => item && item.id)
        .map((item) => [String(item.id), item]),
    );
  const currentMap = toMap(currentItems);
  const baseMap = toMap(baseItems);
  const nextMap = toMap(nextItems);
  const mergedMap = new Map([...currentMap].map(([id, item]) => [id, cloneJson(item)]));
  const ids = new Set([...baseMap.keys(), ...currentMap.keys(), ...nextMap.keys()]);
  ids.forEach((id) => {
    const baseHas = baseMap.has(id);
    const currentHas = currentMap.has(id);
    const nextHas = nextMap.has(id);
    if (!baseHas && nextHas) {
      mergedMap.set(id, cloneJson(nextMap.get(id)));
    } else if (baseHas && !nextHas) {
      if (!currentHas || sameJson(currentMap.get(id), baseMap.get(id))) mergedMap.delete(id);
    } else if (baseHas && nextHas && !sameJson(nextMap.get(id), baseMap.get(id))) {
      mergedMap.set(id, cloneJson(nextMap.get(id)));
    }
  });
  return [...mergedMap.values()];
}

function mergeSettings(currentSettings = {}, baseSettings = {}, nextSettings = {}) {
  const merged = cloneJson(currentSettings);
  const keys = new Set([...Object.keys(baseSettings || {}), ...Object.keys(nextSettings || {})]);
  keys.forEach((key) => {
    if (!sameJson(nextSettings?.[key], baseSettings?.[key])) merged[key] = cloneJson(nextSettings[key]);
  });
  return merged;
}

function mergeHistory(currentHistory = [], nextHistory = []) {
  const seen = new Set();
  return [...(Array.isArray(nextHistory) ? nextHistory : []), ...(Array.isArray(currentHistory) ? currentHistory : [])]
    .filter((item) => {
      const id = String(item?.id || "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 30)
    .map(cloneJson);
}

function mergeStateChanges(currentState, baseState, nextState) {
  const current = cloneJson(currentState);
  const base = cloneJson(baseState);
  const next = cloneJson(nextState);
  const merged = cloneJson(current);
  merged.people = mergeObjectMap(current.people, base.people, next.people);
  merged.positions = mergeObjectMap(current.positions, base.positions, next.positions);
  merged.links = mergeArrayById(current.links, base.links, next.links).filter((link) => merged.people?.[link.from] && merged.people?.[link.to]);
  merged.guides = mergeArrayById(current.guides, base.guides, next.guides);
  merged.settings = mergeSettings(current.settings, base.settings, next.settings);
  merged.history = mergeHistory(current.history, next.history);
  Object.keys(merged.positions || {}).forEach((id) => {
    if (!merged.people?.[id]) delete merged.positions[id];
  });
  if (!sameJson(next.rootId, base.rootId)) merged.rootId = next.rootId;
  if (!sameJson(next.selectedId, base.selectedId)) merged.selectedId = next.selectedId;
  if (!merged.people?.[merged.rootId]) merged.rootId = Object.keys(merged.people || {})[0] || "";
  if (!merged.people?.[merged.selectedId]) merged.selectedId = merged.rootId;
  return merged;
}

function cleanStateReferences(nextState) {
  const state = cloneJson(nextState);
  state.people ||= {};
  state.links = (Array.isArray(state.links) ? state.links : []).filter((link) => state.people?.[link.from] && state.people?.[link.to]);
  state.positions ||= {};
  Object.keys(state.positions).forEach((id) => {
    if (!state.people?.[id]) delete state.positions[id];
  });
  if (!state.people?.[state.rootId]) state.rootId = Object.keys(state.people)[0] || "";
  if (!state.people?.[state.selectedId]) state.selectedId = state.rootId;
  state.guides = Array.isArray(state.guides) ? state.guides : [];
  state.settings ||= {};
  state.history = Array.isArray(state.history) ? state.history.slice(0, 30) : [];
  return state;
}

function upsertById(items = [], value) {
  const id = String(value?.id || "");
  if (!id) return Array.isArray(items) ? items : [];
  const next = Array.isArray(items) ? [...items] : [];
  const index = next.findIndex((item) => String(item?.id || "") === id);
  if (index >= 0) next[index] = cloneJson(value);
  else next.push(cloneJson(value));
  return next;
}

function removeById(items = [], id) {
  return (Array.isArray(items) ? items : []).filter((item) => String(item?.id || "") !== String(id || ""));
}

function applySyncOperations(currentState, operations = []) {
  const nextState = cleanStateReferences(currentState);
  for (const operation of Array.isArray(operations) ? operations : []) {
    const kind = String(operation?.kind || "");
    const id = String(operation?.id || operation?.value?.id || "");
    if (kind === "person.upsert" && id && operation.value) {
      nextState.people[id] = cloneJson(operation.value);
    } else if (kind === "person.delete" && id) {
      delete nextState.people[id];
      delete nextState.positions[id];
      nextState.links = removeById(nextState.links, "").filter((link) => link.from !== id && link.to !== id);
    } else if (kind === "position.set" && id && operation.value) {
      nextState.positions[id] = cloneJson(operation.value);
    } else if (kind === "position.delete" && id) {
      delete nextState.positions[id];
    } else if (kind === "link.upsert" && id && operation.value) {
      nextState.links = upsertById(nextState.links, operation.value);
    } else if (kind === "link.delete" && id) {
      nextState.links = removeById(nextState.links, id);
    } else if (kind === "guide.upsert" && id && operation.value) {
      nextState.guides = upsertById(nextState.guides, operation.value);
    } else if (kind === "guide.delete" && id) {
      nextState.guides = removeById(nextState.guides, id);
    } else if (kind === "settings.patch" && operation.value && typeof operation.value === "object") {
      nextState.settings = { ...(nextState.settings || {}), ...cloneJson(operation.value) };
    } else if (kind === "root.set" && operation.value) {
      nextState.rootId = String(operation.value);
    } else if (kind === "selected.set" && operation.value) {
      nextState.selectedId = String(operation.value);
    } else if (kind === "history.prepend" && operation.value) {
      nextState.history = mergeHistory(nextState.history, [operation.value]);
    } else if (kind === "state.replace" && operation.value && typeof operation.value === "object") {
      return cleanStateReferences(operation.value);
    }
  }
  return cleanStateReferences(nextState);
}

function compactSyncOperations(operations = []) {
  return (Array.isArray(operations) ? operations : [])
    .slice(0, 500)
    .map((operation) => ({
      kind: String(operation?.kind || "").slice(0, 80),
      id: String(operation?.id || operation?.value?.id || "").slice(0, 120),
      value: cloneJson(operation?.value),
    }))
    .filter((operation) => operation.kind);
}

function socketsForTree(treeId) {
  if (!treeSockets.has(treeId)) treeSockets.set(treeId, new Set());
  return treeSockets.get(treeId);
}

function broadcastTree(treeId, message) {
  const payload = JSON.stringify(message);
  for (const socket of socketsForTree(treeId)) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
}

server.on("upgrade", async (req, socket, head) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    if (requestUrl.pathname !== "/api/sync/ws") {
      socket.destroy();
      return;
    }
    const payload = await verifyToken(requestUrl.searchParams.get("token") || "");
    if (!payload) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.auth = payload;
      socketsForTree(payload.treeId).add(ws);
      ws.send(JSON.stringify({ type: "sync.ready", treeId: payload.treeId }));
      ws.on("close", () => socketsForTree(payload.treeId).delete(ws));
      ws.on("error", () => socketsForTree(payload.treeId).delete(ws));
    });
  } catch {
    socket.destroy();
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, sync: true });
});

app.post("/api/trees/login", async (req, res) => {
  try {
    const treeName = String(req.body.treeName || "").trim();
    const password = String(req.body.password || "");
    const initialState = req.body.initialState && typeof req.body.initialState === "object" ? req.body.initialState : null;
    if (!treeName || password.length < 4) {
      return res.status(400).json({ error: "Введите имя дерева и пароль от 4 символов" });
    }

    const treeId = slugifyTreeName(treeName);
    let tree = await readTree(treeId);
    const now = new Date().toISOString();
    if (!tree) {
      tree = {
        id: treeId,
        name: treeName,
        password: hashPassword(password),
        state: initialState,
        version: 0,
        operations: [],
        createdAt: now,
        updatedAt: now,
      };
      await writeTree(tree);
    } else if (!verifyPassword(password, tree.password)) {
      return res.status(403).json({ error: "Неверный пароль дерева" });
    }

    const token = await signToken({
      treeId,
      treeName: tree.name,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
    });

    res.json({ token, ...publicTree(tree) });
  } catch (error) {
    res.status(500).json({ error: error.message || "Sync login failed" });
  }
});

app.get("/api/sync/pull", authRequired, async (req, res) => {
  const tree = await readTree(req.auth.treeId);
  if (!tree) return res.status(404).json({ error: "Tree not found" });
  const since = Number(req.query.since || 0);
  res.json(publicTree(tree, since));
});

app.post("/api/sync/push", authRequired, async (req, res) => {
  const tree = await readTree(req.auth.treeId);
  if (!tree) return res.status(404).json({ error: "Tree not found" });

  const operation = req.body.operation || {};
  if (!operation.id || !operation.state) return res.status(400).json({ error: "Invalid operation" });

  const alreadyApplied = tree.operations.find((item) => item.id === operation.id);
  if (!alreadyApplied) {
    const baseVersion = Number(operation.baseVersion || 0);
    const hasMergeBase = operation.baseState && typeof operation.baseState === "object";
    const syncOperations = compactSyncOperations(operation.ops);
    const nextState =
      syncOperations.length
        ? applySyncOperations(tree.state, syncOperations)
        : hasMergeBase && baseVersion < Number(tree.version || 0)
        ? mergeStateChanges(tree.state, operation.baseState, operation.state)
        : operation.state;
    tree.version += 1;
    tree.state = nextState;
    tree.updatedAt = new Date().toISOString();
    tree.operations.push({
      id: String(operation.id).slice(0, 120),
      version: tree.version,
      clientId: String(operation.clientId || "").slice(0, 120),
      type: String(operation.type || "state-change").slice(0, 80),
      label: String(operation.label || "Изменение").slice(0, 200),
      detail: String(operation.detail || "").slice(0, 400),
      baseVersion,
      ops: syncOperations,
      merged: hasMergeBase && baseVersion < Number(tree.version - 1),
      createdAt: operation.createdAt || new Date().toISOString(),
    });
    if (tree.operations.length > MAX_OPERATIONS) {
      tree.operations = tree.operations.slice(-MAX_OPERATIONS);
    }
    await writeTree(tree);
    broadcastTree(tree.id, {
      type: "sync.operation",
      treeId: tree.id,
      version: tree.version,
      state: tree.state,
      operation: tree.operations[tree.operations.length - 1],
    });
  }

  res.json(publicTree(tree));
});

app.post("/api/trees/logout", authRequired, (req, res) => {
  res.json({ ok: true });
});

app.use((req, res, next) => {
  if (/^\/(\.git|server-data|node_modules)(\/|$)/i.test(req.path)) {
    return res.status(404).send("Not found");
  }
  next();
});

app.use(express.static(ROOT, {
  extensions: ["html"],
  index: "index.html",
}));

server.listen(PORT, HOST, () => {
  console.log(`FamilyTree server: http://127.0.0.1:${PORT}`);
  console.log(`LAN access: use this computer's local IP on port ${PORT}`);
  console.log(`Storage directory: ${DATA_DIR}`);
});
