const STORAGE_KEY = "family-tree-app-state-v1";
const DB_NAME = "family-tree-app-db";
const DB_VERSION = 1;
const DB_STATE_STORE = "state";
const DB_BACKUP_STORE = "backups";
const DB_STATE_KEY = "current";
const SYNC_STORAGE_KEY = "family-tree-sync-v1";
const BACKUP_LIMIT = 12;
const BACKUP_INTERVAL_MS = 5 * 60 * 1000;
const SYNC_PULL_INTERVAL_MS = 3500;
const GRID = 40;
const CARD_W = GRID * 7;
const CARD_H = GRID * 3;
const SURFACE_W = 24000;
const SURFACE_H = 6000;

const colors = [
  "#f2d16b",
  "#84c7ae",
  "#83addf",
  "#e99d8f",
  "#bba6de",
  "#f0a85f",
  "#73c0d4",
  "#a5c96f",
  "#df8eb6",
  "#94a8e6",
  "#d0b36f",
  "#7fc7c2",
];

function icon(name) {
  return `<svg class="ui-icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

const els = {
  viewport: document.querySelector("#treeViewport"),
  surface: document.querySelector("#treeSurface"),
  guides: document.querySelector("#guideLayer"),
  selection: document.querySelector("#selectionLayer"),
  links: document.querySelector("#linkLayer"),
  nodes: document.querySelector("#nodeLayer"),
  stats: document.querySelector("#treeStats"),
  search: document.querySelector("#searchInput"),
  searchSuggestions: document.querySelector("#searchSuggestions"),
  undo: document.querySelector("#undoBtn"),
  redo: document.querySelector("#redoBtn"),
  saveTree: document.querySelector("#saveTreeBtn"),
  sync: document.querySelector("#syncBtn"),
  syncStatusLabel: document.querySelector("#syncStatusLabel"),
  autoLayout: document.querySelector("#autoLayoutBtn"),
  selectedTitle: document.querySelector("#selectedTitle"),
  setRoot: document.querySelector("#setRootBtn"),
  form: document.querySelector("#personForm"),
  name: document.querySelector("#nameInput"),
  bornDay: document.querySelector("#bornDayInput"),
  bornMonth: document.querySelector("#bornMonthInput"),
  bornYear: document.querySelector("#bornYearInput"),
  ageSummary: document.querySelector("#ageSummary"),
  birthdayCountdown: document.querySelector("#birthdayCountdown"),
  diedDay: document.querySelector("#diedDayInput"),
  diedMonth: document.querySelector("#diedMonthInput"),
  diedYear: document.querySelector("#diedYearInput"),
  place: document.querySelector("#placeInput"),
  notes: document.querySelector("#notesInput"),
  manualColorMode: document.querySelector("#manualColorModeBtn"),
  cardColorPicker: document.querySelector("#cardColorPicker"),
  colorValueLabel: document.querySelector("#colorValueLabel"),
  pinCard: document.querySelector("#pinCardInput"),
  duplicatePerson: document.querySelector("#duplicatePersonBtn"),
  photoInput: document.querySelector("#photoInput"),
  photoButton: document.querySelector("#photoButton"),
  photoInitials: document.querySelector("#photoInitials"),
  photoImage: document.querySelector("#photoImage"),
  removePhoto: document.querySelector("#removePhotoBtn"),
  deletePerson: document.querySelector("#deletePersonBtn"),
  kinshipSummary: document.querySelector("#kinshipSummary"),
  export: document.querySelector("#exportBtn"),
  exportGedcom: document.querySelector("#exportGedcomBtn"),
  exportImage: document.querySelector("#exportImageBtn"),
  import: document.querySelector("#importInput"),
  editLock: document.querySelector("#editLockInput"),
  toggleHistory: document.querySelector("#toggleHistoryBtn"),
  hideHistory: document.querySelector("#hideHistoryBtn"),
  toggleAdmin: document.querySelector("#toggleAdminBtn"),
  openInspector: document.querySelector("#openInspectorBtn"),
  closeInspector: document.querySelector("#closeInspectorBtn"),
  themeSelect: document.querySelector("#themeSelect"),
  printMode: document.querySelector("#printModeBtn"),
  validationList: document.querySelector("#validationList"),
  historyList: document.querySelector("#historyList"),
  undoRedoHint: document.querySelector("#undoRedoHint"),
  printControls: document.querySelector("#printControls"),
  printScale: document.querySelector("#printScaleInput"),
  exitPrintMode: document.querySelector("#exitPrintModeBtn"),
  syncModal: document.querySelector("#syncModal"),
  syncForm: document.querySelector("#syncForm"),
  syncServer: document.querySelector("#syncServerInput"),
  syncTreeName: document.querySelector("#syncTreeNameInput"),
  syncPassword: document.querySelector("#syncPasswordInput"),
  syncMessage: document.querySelector("#syncMessage"),
  syncLogout: document.querySelector("#syncLogoutBtn"),
  closeSyncModal: document.querySelector("#closeSyncModalBtn"),
  fit: document.querySelector("#fitBtn"),
  zoomIn: document.querySelector("#zoomInBtn"),
  zoomOut: document.querySelector("#zoomOutBtn"),
  quickAdd: document.querySelector("#quickAddBtn"),
  drawLine: document.querySelector("#drawLineBtn"),
  linkType: document.querySelector("#linkTypeSelect"),
  eraseLine: document.querySelector("#eraseLineBtn"),
  rectSelect: document.querySelector("#rectSelectBtn"),
  freeSelect: document.querySelector("#freeSelectBtn"),
  guideLine: document.querySelector("#guideLineBtn"),
  guideErase: document.querySelector("#guideEraseBtn"),
  guideVisible: document.querySelector("#guideVisibleInput"),
  guideAxis: document.querySelector("#guideAxisSelect"),
  guideColor: document.querySelector("#guideColorInput"),
  guideLabel: document.querySelector("#guideLabelInput"),
  parentLineMode: document.querySelector("#parentLineModeSelect"),
  branchMode: document.querySelector("#branchModeSelect"),
  colorByName: document.querySelector("#colorByNameBtn"),
  colorBySurname: document.querySelector("#colorBySurnameBtn"),
  modeStatus: document.querySelector("#modeStatus"),
  photoModal: document.querySelector("#photoModal"),
  photoModalImage: document.querySelector("#photoModalImage"),
  closePhotoModal: document.querySelector("#closePhotoModalBtn"),
};

let state = loadState();
let positions = new Map();
let transform = { x: 0, y: 0, scale: 0.9 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let transformStart = { x: 0, y: 0 };
let mode = "select";
let pendingLineFrom = "";
let selectedLinkId = "";
let cardDrag = null;
let suppressNextClick = false;
let selectedIds = new Set();
let openMenuId = "";
let selectDrag = null;
let undoStack = [];
let redoStack = [];
let lastStateSnapshot = JSON.stringify(state);
let saveStatusTimer = null;
let activeViewMode = "all";
let printModeEnabled = false;
let dbPromise = null;
let persistQueue = Promise.resolve();
let lastBackupAt = 0;
let cardClipboard = null;
let syncSettings = loadSyncSettings();
let syncPullTimer = null;
let syncPushQueue = Promise.resolve();
let applyingRemoteState = false;
let syncDebounceTimer = null;
let pendingSyncReason = "";
let lastSyncedSnapshot = "";
let syncSocket = null;
let syncSocketReconnectTimer = null;
let syncSocketReconnectAttempts = 0;

function makeId(prefix = "p") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createDemoState() {
  const root = makeId("p");
  const parentA = makeId("p");
  const parentB = makeId("p");
  const partner = makeId("p");
  const child = makeId("p");
  const sibling = makeId("p");

  return {
    rootId: root,
    selectedId: root,
    people: {
      [root]: {
        id: root,
        name: "Алексей Иванов",
        born: "1978",
        died: "",
        place: "Красноярск",
        notes: "Выберите карточку и добавляйте родственников кнопками вокруг неё или справа.",
        photo: "",
        colorMode: "auto-name",
        manualColor: "#f2d16b",
      },
      [parentA]: {
        id: parentA,
        name: "Нина Иванова",
        born: "1954",
        died: "",
        place: "Енисейск",
        notes: "",
        photo: "",
        colorMode: "auto-name",
        manualColor: "#84c7ae",
      },
      [parentB]: {
        id: parentB,
        name: "Виктор Иванов",
        born: "1951",
        died: "2019",
        place: "Красноярский край",
        notes: "",
        photo: "",
        colorMode: "auto-name",
        manualColor: "#83addf",
      },
      [partner]: {
        id: partner,
        name: "Мария Иванова",
        born: "1980",
        died: "",
        place: "Красноярск",
        notes: "",
        photo: "",
        colorMode: "auto-name",
        manualColor: "#e99d8f",
      },
      [child]: {
        id: child,
        name: "Анна Иванова",
        born: "2007",
        died: "",
        place: "Красноярск",
        notes: "",
        photo: "",
        colorMode: "auto-name",
        manualColor: "#bba6de",
      },
      [sibling]: {
        id: sibling,
        name: "Ирина Петрова",
        born: "1983",
        died: "",
        place: "Ачинск",
        notes: "",
        photo: "",
        colorMode: "auto-name",
        manualColor: "#84c7ae",
      },
    },
    links: [
      { id: makeId("l"), type: "parent", from: parentA, to: root },
      { id: makeId("l"), type: "parent", from: parentB, to: root },
      { id: makeId("l"), type: "partner", from: root, to: partner, side: "left" },
      { id: makeId("l"), type: "parent", from: root, to: child },
      { id: makeId("l"), type: "sibling", from: root, to: sibling, side: "right" },
    ],
    positions: {
      [root]: { x: 2100, y: 1600 },
      [parentA]: { x: 1640, y: 1320 },
      [parentB]: { x: 2280, y: 1320 },
      [partner]: { x: 1240, y: 1600 },
      [child]: { x: 2100, y: 1880 },
      [sibling]: { x: 2640, y: 1600 },
    },
  };
}

function loadSyncSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY) || "{}");
    return {
      clientId: saved.clientId || makeId("client"),
      serverUrl: saved.serverUrl || defaultSyncServerUrl(),
      treeName: saved.treeName || "",
      token: saved.token || "",
      version: Number(saved.version || 0),
    };
  } catch {
    return {
      clientId: makeId("client"),
      serverUrl: defaultSyncServerUrl(),
      treeName: "",
      token: "",
      version: 0,
    };
  }
}

function saveSyncSettings() {
  localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(syncSettings));
}

function defaultSyncServerUrl() {
  if (location.protocol === "http:" || location.protocol === "https:") return location.origin;
  return "http://127.0.0.1:8765";
}

function syncBaseUrl() {
  return String(syncSettings.serverUrl || defaultSyncServerUrl()).replace(/\/+$/, "");
}

function cloneStateValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value || {}));
}

function sameStateValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function mergeObjectMap(currentMap = {}, baseMap = {}, nextMap = {}) {
  const merged = cloneStateValue(currentMap);
  const ids = new Set([...Object.keys(baseMap || {}), ...Object.keys(currentMap || {}), ...Object.keys(nextMap || {})]);
  ids.forEach((id) => {
    const baseHas = Object.prototype.hasOwnProperty.call(baseMap, id);
    const currentHas = Object.prototype.hasOwnProperty.call(currentMap, id);
    const nextHas = Object.prototype.hasOwnProperty.call(nextMap, id);
    if (!baseHas && nextHas) {
      merged[id] = cloneStateValue(nextMap[id]);
    } else if (baseHas && !nextHas) {
      if (!currentHas || sameStateValue(currentMap[id], baseMap[id])) delete merged[id];
    } else if (baseHas && nextHas && !sameStateValue(nextMap[id], baseMap[id])) {
      merged[id] = cloneStateValue(nextMap[id]);
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
  const mergedMap = new Map([...currentMap].map(([id, item]) => [id, cloneStateValue(item)]));
  const ids = new Set([...baseMap.keys(), ...currentMap.keys(), ...nextMap.keys()]);
  ids.forEach((id) => {
    const baseHas = baseMap.has(id);
    const currentHas = currentMap.has(id);
    const nextHas = nextMap.has(id);
    if (!baseHas && nextHas) {
      mergedMap.set(id, cloneStateValue(nextMap.get(id)));
    } else if (baseHas && !nextHas) {
      if (!currentHas || sameStateValue(currentMap.get(id), baseMap.get(id))) mergedMap.delete(id);
    } else if (baseHas && nextHas && !sameStateValue(nextMap.get(id), baseMap.get(id))) {
      mergedMap.set(id, cloneStateValue(nextMap.get(id)));
    }
  });
  return [...mergedMap.values()];
}

function mergeSettings(currentSettings = {}, baseSettings = {}, nextSettings = {}) {
  const merged = cloneStateValue(currentSettings);
  const keys = new Set([...Object.keys(baseSettings || {}), ...Object.keys(nextSettings || {})]);
  keys.forEach((key) => {
    if (!sameStateValue(nextSettings?.[key], baseSettings?.[key])) merged[key] = cloneStateValue(nextSettings[key]);
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
    .map(cloneStateValue);
}

function mergeStateChanges(currentState, baseState, nextState) {
  const current = cloneStateValue(currentState);
  const base = cloneStateValue(baseState);
  const next = cloneStateValue(nextState);
  const merged = cloneStateValue(current);
  merged.people = mergeObjectMap(current.people, base.people, next.people);
  merged.positions = mergeObjectMap(current.positions, base.positions, next.positions);
  merged.links = mergeArrayById(current.links, base.links, next.links).filter((link) => merged.people?.[link.from] && merged.people?.[link.to]);
  merged.guides = mergeArrayById(current.guides, base.guides, next.guides);
  merged.settings = mergeSettings(current.settings, base.settings, next.settings);
  merged.history = mergeHistory(current.history, next.history);
  Object.keys(merged.positions || {}).forEach((id) => {
    if (!merged.people?.[id]) delete merged.positions[id];
  });
  if (!sameStateValue(next.rootId, base.rootId)) merged.rootId = next.rootId;
  if (!sameStateValue(next.selectedId, base.selectedId)) merged.selectedId = next.selectedId;
  if (!merged.people?.[merged.rootId]) merged.rootId = Object.keys(merged.people || {})[0] || "";
  if (!merged.people?.[merged.selectedId]) merged.selectedId = merged.rootId;
  return merged;
}

function mapById(items = []) {
  return new Map(
    (Array.isArray(items) ? items : [])
      .filter((item) => item && item.id)
      .map((item) => [String(item.id), item]),
  );
}

function diffObjectMapOperations(kindBase, baseMap = {}, nextMap = {}) {
  const operations = [];
  const ids = new Set([...Object.keys(baseMap || {}), ...Object.keys(nextMap || {})]);
  ids.forEach((id) => {
    const baseHas = Object.prototype.hasOwnProperty.call(baseMap, id);
    const nextHas = Object.prototype.hasOwnProperty.call(nextMap, id);
    if (baseHas && !nextHas) operations.push({ kind: `${kindBase}.delete`, id });
    else if (nextHas && !sameStateValue(baseMap?.[id], nextMap?.[id])) operations.push({ kind: `${kindBase}.upsert`, id, value: cloneStateValue(nextMap[id]) });
  });
  return operations;
}

function diffArrayOperations(kindBase, baseItems = [], nextItems = []) {
  const operations = [];
  const baseMap = mapById(baseItems);
  const nextMap = mapById(nextItems);
  const ids = new Set([...baseMap.keys(), ...nextMap.keys()]);
  ids.forEach((id) => {
    const baseHas = baseMap.has(id);
    const nextHas = nextMap.has(id);
    if (baseHas && !nextHas) operations.push({ kind: `${kindBase}.delete`, id });
    else if (nextHas && !sameStateValue(baseMap.get(id), nextMap.get(id))) operations.push({ kind: `${kindBase}.upsert`, id, value: cloneStateValue(nextMap.get(id)) });
  });
  return operations;
}

function diffSettingsOperations(baseSettings = {}, nextSettings = {}) {
  const patch = {};
  const keys = new Set([...Object.keys(baseSettings || {}), ...Object.keys(nextSettings || {})]);
  keys.forEach((key) => {
    if (!sameStateValue(baseSettings?.[key], nextSettings?.[key])) patch[key] = cloneStateValue(nextSettings[key]);
  });
  return Object.keys(patch).length ? [{ kind: "settings.patch", value: patch }] : [];
}

function diffHistoryOperations(baseHistory = [], nextHistory = []) {
  const baseIds = new Set((Array.isArray(baseHistory) ? baseHistory : []).map((item) => String(item?.id || "")));
  return (Array.isArray(nextHistory) ? nextHistory : [])
    .filter((item) => item?.id && !baseIds.has(String(item.id)))
    .slice(0, 10)
    .reverse()
    .map((item) => ({ kind: "history.prepend", id: item.id, value: cloneStateValue(item) }));
}

function buildSyncOperations(baseState, nextState) {
  const base = cloneStateValue(baseState);
  const next = cloneStateValue(nextState);
  const operations = [
    ...diffObjectMapOperations("person", base.people, next.people),
    ...diffObjectMapOperations("position", base.positions, next.positions).map((operation) =>
      operation.kind === "position.upsert" ? { ...operation, kind: "position.set" } : { ...operation, kind: "position.delete" },
    ),
    ...diffArrayOperations("link", base.links, next.links),
    ...diffArrayOperations("guide", base.guides, next.guides),
    ...diffSettingsOperations(base.settings, next.settings),
  ];
  if (!sameStateValue(base.rootId, next.rootId)) operations.push({ kind: "root.set", value: next.rootId });
  if (!sameStateValue(base.selectedId, next.selectedId)) operations.push({ kind: "selected.set", value: next.selectedId });
  operations.push(...diffHistoryOperations(base.history, next.history));
  return operations;
}

function upsertArrayItem(items = [], value) {
  const id = String(value?.id || "");
  if (!id) return Array.isArray(items) ? items : [];
  const next = Array.isArray(items) ? [...items] : [];
  const index = next.findIndex((item) => String(item?.id || "") === id);
  if (index >= 0) next[index] = cloneStateValue(value);
  else next.push(cloneStateValue(value));
  return next;
}

function removeArrayItem(items = [], id) {
  return (Array.isArray(items) ? items : []).filter((item) => String(item?.id || "") !== String(id || ""));
}

function applySyncOperations(currentState, operations = []) {
  const nextState = cloneStateValue(currentState);
  nextState.people ||= {};
  nextState.positions ||= {};
  nextState.links = Array.isArray(nextState.links) ? nextState.links : [];
  nextState.guides = Array.isArray(nextState.guides) ? nextState.guides : [];
  nextState.settings ||= {};
  nextState.history = Array.isArray(nextState.history) ? nextState.history : [];
  for (const operation of Array.isArray(operations) ? operations : []) {
    const kind = String(operation?.kind || "");
    const id = String(operation?.id || operation?.value?.id || "");
    if (kind === "person.upsert" && id && operation.value) {
      nextState.people[id] = cloneStateValue(operation.value);
    } else if (kind === "person.delete" && id) {
      delete nextState.people[id];
      delete nextState.positions[id];
      nextState.links = nextState.links.filter((link) => link.from !== id && link.to !== id);
    } else if (kind === "position.set" && id && operation.value) {
      nextState.positions[id] = cloneStateValue(operation.value);
    } else if (kind === "position.delete" && id) {
      delete nextState.positions[id];
    } else if (kind === "link.upsert" && id && operation.value) {
      nextState.links = upsertArrayItem(nextState.links, operation.value);
    } else if (kind === "link.delete" && id) {
      nextState.links = removeArrayItem(nextState.links, id);
    } else if (kind === "guide.upsert" && id && operation.value) {
      nextState.guides = upsertArrayItem(nextState.guides, operation.value);
    } else if (kind === "guide.delete" && id) {
      nextState.guides = removeArrayItem(nextState.guides, id);
    } else if (kind === "settings.patch" && operation.value && typeof operation.value === "object") {
      nextState.settings = { ...nextState.settings, ...cloneStateValue(operation.value) };
    } else if (kind === "root.set") {
      nextState.rootId = String(operation.value || "");
    } else if (kind === "selected.set") {
      nextState.selectedId = String(operation.value || "");
    } else if (kind === "history.prepend" && operation.value) {
      nextState.history = mergeHistory(nextState.history, [operation.value]);
    } else if (kind === "state.replace" && operation.value && typeof operation.value === "object") {
      return normalizeState(cloneStateValue(operation.value));
    }
  }
  return normalizeState(nextState);
}

function updateSyncStatus(text = "") {
  if (!els.syncStatusLabel) return;
  const label = text || (syncSettings.token ? `Синхр: ${syncSettings.treeName}` : "Локально");
  els.syncStatusLabel.textContent = label;
  els.sync?.classList.toggle("sync-connected", Boolean(syncSettings.token));
}

function setSyncMessage(text, isError = false) {
  if (!els.syncMessage) return;
  els.syncMessage.textContent = text;
  els.syncMessage.classList.toggle("sync-error", isError);
}

function openSyncModal() {
  els.syncServer.value = syncSettings.serverUrl || defaultSyncServerUrl();
  els.syncTreeName.value = syncSettings.treeName || "";
  els.syncPassword.value = "";
  setSyncMessage(
    syncSettings.token
      ? `Подключено к дереву "${syncSettings.treeName}". Можно открыть этот же адрес на телефоне.`
      : "Без сервера приложение продолжает работать локально на этом устройстве.",
  );
  els.syncModal.hidden = false;
}

function closeSyncModal() {
  els.syncModal.hidden = true;
}

async function syncFetch(pathname, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (syncSettings.token) headers.Authorization = `Bearer ${syncSettings.token}`;
  const response = await fetch(`${syncBaseUrl()}${pathname}`, {
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function syncWebSocketUrl() {
  const base = syncBaseUrl();
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/api/sync/ws";
  url.search = "";
  url.searchParams.set("token", syncSettings.token);
  return url.toString();
}

function stopSyncSocket() {
  window.clearTimeout(syncSocketReconnectTimer);
  syncSocketReconnectTimer = null;
  if (syncSocket) {
    syncSocket.onclose = null;
    syncSocket.close();
  }
  syncSocket = null;
}

function scheduleSyncSocketReconnect() {
  if (!syncSettings.token) return;
  window.clearTimeout(syncSocketReconnectTimer);
  const delay = Math.min(15000, 1000 * 2 ** Math.min(syncSocketReconnectAttempts, 4));
  syncSocketReconnectAttempts += 1;
  syncSocketReconnectTimer = window.setTimeout(startSyncSocket, delay);
}

function startSyncSocket() {
  stopSyncSocket();
  if (!syncSettings.token || !("WebSocket" in window)) return;
  try {
    syncSocket = new WebSocket(syncWebSocketUrl());
  } catch (error) {
    console.warn("Не удалось открыть WebSocket", error);
    scheduleSyncSocketReconnect();
    return;
  }
  syncSocket.onopen = () => {
    syncSocketReconnectAttempts = 0;
    updateSyncStatus();
  };
  syncSocket.onmessage = (event) => {
    try {
      handleSyncSocketMessage(JSON.parse(event.data));
    } catch (error) {
      console.warn("Некорректное WebSocket-сообщение", error);
    }
  };
  syncSocket.onerror = () => updateSyncStatus("Офлайн");
  syncSocket.onclose = () => {
    syncSocket = null;
    scheduleSyncSocketReconnect();
  };
}

function applyRemoteStateSnapshot(remoteState, reason = "sync-remote") {
  applyingRemoteState = true;
  state = normalizeState(remoteState);
  lastStateSnapshot = serializeState();
  persistState(lastStateSnapshot, { reason });
  applyingRemoteState = false;
  applyTheme();
  applyPrintScale();
  render();
}

function applyRemoteOperationMessage(message) {
  const nextVersion = Number(message.version || 0);
  if (!nextVersion || nextVersion <= Number(syncSettings.version || 0)) return;
  const operation = message.operation || {};
  const localSnapshot = serializeState();
  const hasLocalChanges = Boolean(lastSyncedSnapshot) && localSnapshot !== lastSyncedSnapshot;
  applyingRemoteState = true;
  if (hasLocalChanges && message.state) {
    state = normalizeState(mergeStateChanges(message.state, JSON.parse(lastSyncedSnapshot), JSON.parse(localSnapshot)));
  } else if (Array.isArray(operation.ops) && operation.ops.length) {
    state = applySyncOperations(state, operation.ops);
  } else if (message.state) {
    state = normalizeState(mergeStateChanges(message.state, lastSyncedSnapshot ? JSON.parse(lastSyncedSnapshot) : state, state));
  }
  lastStateSnapshot = serializeState();
  if (message.state) lastSyncedSnapshot = JSON.stringify(normalizeState(cloneStateValue(message.state)));
  else lastSyncedSnapshot = lastStateSnapshot;
  persistState(lastStateSnapshot, { reason: "sync-ws" });
  applyingRemoteState = false;
  syncSettings.version = nextVersion;
  saveSyncSettings();
  applyTheme();
  applyPrintScale();
  render();
  updateSyncStatus();
  if (hasLocalChanges) queueSyncOperation("sync-merge", "Слияние изменений", true);
}

function handleSyncSocketMessage(message) {
  if (message?.type === "sync.ready") {
    updateSyncStatus();
    return;
  }
  if (message?.type === "sync.operation") {
    applyRemoteOperationMessage(message);
  }
}

async function loginSync(event) {
  event.preventDefault();
  const serverUrl = els.syncServer.value.trim() || defaultSyncServerUrl();
  const treeName = els.syncTreeName.value.trim();
  const password = els.syncPassword.value;
  if (!treeName || password.length < 4) {
    setSyncMessage("Введите имя дерева и пароль от 4 символов.", true);
    return;
  }

  setSyncMessage("Подключаюсь...");
  try {
    syncSettings.serverUrl = serverUrl.replace(/\/+$/, "");
    const data = await syncFetch("/api/trees/login", {
      method: "POST",
      body: JSON.stringify({
        treeName,
        password,
        initialState: state,
      }),
    });
    syncSettings.token = data.token;
    syncSettings.treeName = data.treeName || treeName;
    syncSettings.version = Number(data.version || 0);
    saveSyncSettings();

    if (data.state) {
      applyingRemoteState = true;
      state = normalizeState(data.state);
      lastStateSnapshot = serializeState();
      lastSyncedSnapshot = lastStateSnapshot;
      persistState(lastStateSnapshot, { backup: true, reason: "sync-login" });
      applyingRemoteState = false;
      applyTheme();
      applyPrintScale();
      render();
      fitTree();
    } else {
      queueSyncOperation("sync-initial", "Первичная синхронизация", true);
    }

    updateSyncStatus();
    startSyncPulling();
    setSyncMessage(`Готово. Дерево "${syncSettings.treeName}" синхронизируется.`);
    window.setTimeout(closeSyncModal, 700);
  } catch (error) {
    setSyncMessage(`Не удалось войти: ${error.message}`, true);
    updateSyncStatus("Ошибка");
  }
}

function logoutSync() {
  syncSettings = {
    clientId: syncSettings.clientId || makeId("client"),
    serverUrl: syncSettings.serverUrl || defaultSyncServerUrl(),
    treeName: "",
    token: "",
    version: 0,
  };
  saveSyncSettings();
  stopSyncPulling();
  updateSyncStatus();
  setSyncMessage("Синхронизация отключена. Приложение работает локально.");
}

function startSyncPulling() {
  stopSyncPulling();
  if (!syncSettings.token) return;
  startSyncSocket();
  syncPullTimer = window.setInterval(pullRemoteState, SYNC_PULL_INTERVAL_MS);
  pullRemoteState();
}

function stopSyncPulling() {
  stopSyncSocket();
  if (syncPullTimer) window.clearInterval(syncPullTimer);
  syncPullTimer = null;
}

function queueSyncOperation(type = "state-change", label = "", immediate = false) {
  if (!syncSettings.token || applyingRemoteState) return;
  pendingSyncReason = label || type || pendingSyncReason;
  window.clearTimeout(syncDebounceTimer);
  syncDebounceTimer = window.setTimeout(pushSyncOperation, immediate ? 0 : 700);
}

function pushSyncOperation() {
  if (!syncSettings.token) return;
  const snapshot = JSON.parse(serializeState());
  const sentSnapshot = JSON.stringify(snapshot);
  const baseState = lastSyncedSnapshot ? JSON.parse(lastSyncedSnapshot) : snapshot;
  let ops = buildSyncOperations(baseState, snapshot);
  if (ops.length > 450) ops = [{ kind: "state.replace", value: snapshot }];
  if (!ops.length) {
    updateSyncStatus();
    return;
  }
  const operation = {
    id: makeId("op"),
    clientId: syncSettings.clientId,
    type: "state-change",
    label: pendingSyncReason || "Изменение дерева",
    detail: "",
    baseVersion: syncSettings.version,
    baseState,
    ops,
    createdAt: new Date().toISOString(),
    state: snapshot,
  };
  pendingSyncReason = "";
  updateSyncStatus("Синхр...");
  syncPushQueue = syncPushQueue
    .then(() =>
      syncFetch("/api/sync/push", {
        method: "POST",
        body: JSON.stringify({ operation }),
      }),
    )
    .then((data) => {
      syncSettings.version = Number(data.version || syncSettings.version);
      if (data.state) {
        const remoteState = normalizeState(cloneStateValue(data.state));
        const remoteSnapshot = JSON.stringify(remoteState);
        const currentSnapshot = serializeState();
        applyingRemoteState = true;
        if (currentSnapshot === sentSnapshot) {
          state = remoteState;
          lastStateSnapshot = remoteSnapshot;
          lastSyncedSnapshot = remoteSnapshot;
          persistState(lastStateSnapshot, { reason: "sync-push" });
          render();
        } else {
          state = normalizeState(mergeStateChanges(remoteState, snapshot, JSON.parse(currentSnapshot)));
          lastStateSnapshot = serializeState();
          lastSyncedSnapshot = remoteSnapshot;
          persistState(lastStateSnapshot, { reason: "sync-merge-after-push" });
          render();
          window.setTimeout(() => queueSyncOperation("sync-merge", "Слияние изменений", true), 0);
        }
        applyingRemoteState = false;
      } else {
        lastSyncedSnapshot = sentSnapshot;
      }
      saveSyncSettings();
      updateSyncStatus();
    })
    .catch((error) => {
      console.warn("Не удалось отправить синхронизацию", error);
      updateSyncStatus("Офлайн");
    });
}

async function pullRemoteState() {
  if (!syncSettings.token) return;
  try {
    const data = await syncFetch(`/api/sync/pull?since=${encodeURIComponent(syncSettings.version || 0)}`);
    const nextVersion = Number(data.version || 0);
    if (data.state && nextVersion > Number(syncSettings.version || 0)) {
      const localSnapshot = serializeState();
      const hasLocalChanges = Boolean(lastSyncedSnapshot) && localSnapshot !== lastSyncedSnapshot;
      const remoteState = normalizeState(cloneStateValue(data.state));
      const remoteSnapshot = JSON.stringify(remoteState);
      applyingRemoteState = true;
      if (hasLocalChanges) {
        state = normalizeState(mergeStateChanges(remoteState, JSON.parse(lastSyncedSnapshot), JSON.parse(localSnapshot)));
      } else {
        state = remoteState;
      }
      lastStateSnapshot = serializeState();
      lastSyncedSnapshot = remoteSnapshot;
      persistState(lastStateSnapshot, { reason: "sync-pull" });
      applyingRemoteState = false;
      syncSettings.version = nextVersion;
      saveSyncSettings();
      pendingLineFrom = "";
      selectedLinkId = "";
      openMenuId = "";
      selectedIds.clear();
      applyTheme();
      applyPrintScale();
      render();
      if (hasLocalChanges) queueSyncOperation("sync-merge", "Слияние изменений", true);
    } else {
      syncSettings.version = nextVersion;
      saveSyncSettings();
      if (!lastSyncedSnapshot) lastSyncedSnapshot = serializeState();
    }
    updateSyncStatus();
  } catch (error) {
    console.warn("Не удалось получить синхронизацию", error);
    updateSyncStatus("Офлайн");
  }
}

function openDatabase() {
  if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB недоступен"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STATE_STORE)) db.createObjectStore(DB_STATE_STORE);
      if (!db.objectStoreNames.contains(DB_BACKUP_STORE)) {
        db.createObjectStore(DB_BACKUP_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Не удалось открыть IndexedDB"));
  });
  return dbPromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Операция IndexedDB не выполнена"));
  });
}

async function readStoredState() {
  const db = await openDatabase();
  const current = await requestToPromise(db.transaction(DB_STATE_STORE, "readonly").objectStore(DB_STATE_STORE).get(DB_STATE_KEY));
  if (current?.value) return normalizeState(current.value);

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.people) return normalizeState(parsed);
    }
  } catch (error) {
    console.warn("Не удалось мигрировать старое локальное сохранение", error);
  }
  return null;
}

async function writeStoredState(snapshot, options = {}) {
  const db = await openDatabase();
  const value = JSON.parse(snapshot);
  await requestToPromise(
    db.transaction(DB_STATE_STORE, "readwrite")
      .objectStore(DB_STATE_STORE)
      .put({ value, updatedAt: new Date().toISOString() }, DB_STATE_KEY),
  );

  const shouldBackup = options.backup || Date.now() - lastBackupAt > BACKUP_INTERVAL_MS;
  if (shouldBackup) {
    lastBackupAt = Date.now();
    await writeBackup(value, options.reason || "autosave");
  }
}

async function writeBackup(value, reason) {
  const db = await openDatabase();
  const backup = {
    id: new Date().toISOString(),
    reason,
    value,
  };
  const store = db.transaction(DB_BACKUP_STORE, "readwrite").objectStore(DB_BACKUP_STORE);
  await requestToPromise(store.put(backup));
  const keys = await requestToPromise(db.transaction(DB_BACKUP_STORE, "readonly").objectStore(DB_BACKUP_STORE).getAllKeys());
  const extraKeys = keys.sort().slice(0, Math.max(0, keys.length - BACKUP_LIMIT));
  await Promise.all(
    extraKeys.map((key) =>
      requestToPromise(db.transaction(DB_BACKUP_STORE, "readwrite").objectStore(DB_BACKUP_STORE).delete(key)),
    ),
  );
}

function persistState(snapshot = serializeState(), options = {}) {
  persistQueue = persistQueue
    .then(() => writeStoredState(snapshot, options))
    .catch((error) => {
      console.warn("Не удалось сохранить дерево в IndexedDB", error);
      if (els.modeStatus) els.modeStatus.textContent = "Сохранение недоступно";
    });
  return persistQueue;
}

async function initializeStorage() {
  try {
    const stored = await readStoredState();
    if (stored) {
      state = stored;
      lastStateSnapshot = serializeState();
      applyTheme();
      applyPrintScale();
      render();
      updateHistoryButtons();
      requestAnimationFrame(fitTree);
      persistState(lastStateSnapshot, { backup: true, reason: "migration" });
      return;
    }
    persistState(lastStateSnapshot, { backup: true, reason: "initial" });
  } catch (error) {
    console.warn("Не удалось загрузить IndexedDB", error);
    if (els.modeStatus) els.modeStatus.textContent = "Хранилище недоступно";
  } finally {
    updateSyncStatus();
    startSyncPulling();
  }
}

function loadState() {
  return normalizeState(createDemoState());
}

function safeText(value, maxLength = 4000) {
  return String(value ?? "").slice(0, maxLength);
}

function safeId(value, prefix = "p") {
  const raw = String(value || "").trim();
  return /^[A-Za-z0-9_-]{1,80}$/.test(raw) ? raw : makeId(prefix);
}

function uniqueId(value, used, prefix = "p") {
  let id = safeId(value, prefix);
  while (used.has(id)) id = makeId(prefix);
  used.add(id);
  return id;
}

function safeColor(value, fallback = colors[0]) {
  const raw = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
}

function safeImageSrc(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return "";
}

function safeDatePart(value, max) {
  const number = Number(String(value || "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(number) || number <= 0) return "";
  return String(Math.min(max, number)).padStart(max === 9999 ? 4 : 2, "0").slice(max === 9999 ? -4 : -2);
}

function normalizeState(nextState) {
  nextState = nextState && typeof nextState === "object" ? nextState : {};
  const sourcePeople = nextState.people && typeof nextState.people === "object" ? nextState.people : {};
  const sourcePositions = nextState.positions && typeof nextState.positions === "object" ? nextState.positions : {};
  const idMap = new Map();
  const usedPeopleIds = new Set();
  const people = {};

  Object.entries(sourcePeople).forEach(([key, rawPerson]) => {
    const person = rawPerson && typeof rawPerson === "object" ? { ...rawPerson } : {};
    const originalId = String(person.id || key);
    const id = uniqueId(originalId, usedPeopleIds, "p");
    idMap.set(originalId, id);
    idMap.set(String(key), id);
    person.id = id;
    person.name = safeText(person.name || "Без имени", 160);
    person.born = safeText(person.born, 32);
    person.died = safeText(person.died, 32);
    person.place = safeText(person.place, 240);
    person.notes = safeText(person.notes, 4000);
    person.photo = safeImageSrc(person.photo);
    person.colorMode = ["manual", "auto-name", "auto-surname"].includes(person.colorMode) ? person.colorMode : "auto-name";
    person.manualColor = safeColor(person.manualColor || person.color, colors[0]);
    person.pinned = Boolean(person.pinned);
    migrateDateFields(person, "born");
    migrateDateFields(person, "died");
    person.bornDay = safeDatePart(person.bornDay, 31);
    person.bornMonth = safeDatePart(person.bornMonth, 12);
    person.bornYear = safeDatePart(person.bornYear, 9999);
    person.diedDay = safeDatePart(person.diedDay, 31);
    person.diedMonth = safeDatePart(person.diedMonth, 12);
    person.diedYear = safeDatePart(person.diedYear, 9999);
    delete person.color;
    people[id] = person;
  });

  nextState.people = people;
  nextState.links = Array.isArray(nextState.links)
    ? nextState.links
        .map((rawLink) => {
          const type = rawLink?.type === "manual" ? "family" : rawLink?.type;
          const from = idMap.get(String(rawLink?.from || "")) || rawLink?.from;
          const to = idMap.get(String(rawLink?.to || "")) || rawLink?.to;
          if (!people[from] || !people[to] || from === to) return null;
          if (!["parent", "partner", "sibling", "family"].includes(type)) return null;
          return {
            id: safeId(rawLink?.id, "l"),
            type,
            from,
            to,
            side: rawLink?.side === "left" ? "left" : "right",
          };
        })
        .filter(Boolean)
    : [];

  nextState.positions = {};
  Object.entries(sourcePositions).forEach(([key, rawPos]) => {
    const id = idMap.get(String(key)) || key;
    if (!people[id] || !rawPos) return;
    const x = Number(rawPos.x);
    const y = Number(rawPos.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    nextState.positions[id] = snapPoint({ x, y });
  });

  nextState.guides = Array.isArray(nextState.guides)
    ? nextState.guides
        .map((guide) => ({
          id: safeId(guide?.id, "g"),
          axis: guide?.axis === "v" ? "v" : "h",
          position: Math.max(0, Math.min(guide?.axis === "v" ? SURFACE_W : SURFACE_H, Number(guide?.position) || 0)),
          color: safeColor(guide?.color, "#2f7d75"),
          label: safeText(guide?.label, 32),
        }))
        .filter((guide) => Number.isFinite(guide.position))
    : [];
  nextState.settings ||= {};
  nextState.settings.theme ||= "light";
  if (!["light", "dark", "print"].includes(nextState.settings.theme)) nextState.settings.theme = "light";
  nextState.settings.printScale ||= 100;
  nextState.settings.editLocked = Boolean(nextState.settings.editLocked);
  nextState.settings.historyHidden = Boolean(nextState.settings.historyHidden);
  nextState.settings.inspectorHidden = Boolean(nextState.settings.inspectorHidden);
  nextState.settings.adminCollapsed = Boolean(nextState.settings.adminCollapsed);
  nextState.settings.guidesVisible = nextState.settings.guidesVisible !== false;
  nextState.settings.parentLineMode ||= "smart";
  if (!["smart", "vertical"].includes(nextState.settings.parentLineMode)) nextState.settings.parentLineMode = "smart";
  nextState.history = Array.isArray(nextState.history)
    ? nextState.history.slice(0, 30).map((item) => ({
        id: safeId(item?.id, "h"),
        label: safeText(item?.label || "Действие", 120),
        detail: safeText(item?.detail, 160),
        at: safeText(item?.at || new Date().toISOString(), 40),
      }))
    : [];
  nextState.rootId = idMap.get(String(nextState.rootId || "")) || (nextState.people[nextState.rootId] ? nextState.rootId : Object.keys(nextState.people)[0]);
  nextState.selectedId =
    idMap.get(String(nextState.selectedId || "")) || (nextState.people[nextState.selectedId] ? nextState.selectedId : nextState.rootId);
  for (const id of Object.keys(nextState.positions)) {
    if (!nextState.people[id]) delete nextState.positions[id];
  }
  return nextState;
}

function isEditLocked() {
  return Boolean(state.settings?.editLocked);
}

function guardEdit() {
  if (!isEditLocked()) return true;
  if (els.modeStatus) els.modeStatus.textContent = "Защита включена";
  return false;
}

function migrateDateFields(person, prefix) {
  const dayKey = `${prefix}Day`;
  const monthKey = `${prefix}Month`;
  const yearKey = `${prefix}Year`;
  if (person[dayKey] || person[monthKey] || person[yearKey]) return;

  const raw = String(person[prefix] || "").trim();
  if (!raw) return;
  const parts = raw.match(/\d+/g) || [];
  if (parts.length >= 3) {
    person[dayKey] = parts[0].padStart(2, "0").slice(-2);
    person[monthKey] = parts[1].padStart(2, "0").slice(-2);
    person[yearKey] = parts[2];
  } else if (parts.length === 2) {
    person[monthKey] = parts[0].padStart(2, "0").slice(-2);
    person[yearKey] = parts[1];
  } else if (parts.length === 1) {
    person[yearKey] = parts[0];
  }
}

function serializeState() {
  return JSON.stringify(state);
}

function actionLabelFromSnapshot(snapshot) {
  try {
    const parsed = JSON.parse(snapshot);
    return parsed.history?.[0]?.label || "последнее действие";
  } catch {
    return "последнее действие";
  }
}

function recordAction(label, detail = "") {
  if (!label) return;
  state.history ||= [];
  state.history.unshift({
    id: makeId("h"),
    label,
    detail,
    at: new Date().toISOString(),
  });
  state.history = state.history.slice(0, 30);
}

function updateHistoryButtons() {
  els.undo.disabled = undoStack.length === 0 || isEditLocked();
  els.redo.disabled = redoStack.length === 0 || isEditLocked();
  els.undo.title = undoStack.length ? `Отменить: ${actionLabelFromSnapshot(lastStateSnapshot)}` : "Отменить";
  els.redo.title = redoStack.length ? `Вернуть: ${actionLabelFromSnapshot(redoStack[redoStack.length - 1])}` : "Вернуть";
  if (els.undoRedoHint) {
    const undoText = undoStack.length ? `Undo: ${actionLabelFromSnapshot(lastStateSnapshot)}` : "Undo: нет";
    const redoText = redoStack.length ? `Redo: ${actionLabelFromSnapshot(redoStack[redoStack.length - 1])}` : "Redo: нет";
    els.undoRedoHint.textContent = `${undoText} · ${redoText}`;
  }
}

function saveState(options = {}) {
  const { recordHistory = true, showStatus = false, action = "", detail = "" } = options;
  if (action) recordAction(action, detail);
  const nextSnapshot = serializeState();
  if (recordHistory && nextSnapshot !== lastStateSnapshot) {
    undoStack.push(lastStateSnapshot);
    if (undoStack.length > 80) undoStack.shift();
    redoStack = [];
  }
  lastStateSnapshot = nextSnapshot;
  persistState(nextSnapshot, { reason: action || "autosave" });
  queueSyncOperation("state-change", action || detail || "Изменение дерева");
  updateHistoryButtons();
  if (showStatus) showSaveStatus();
}

function restoreSnapshot(snapshot, targetStack) {
  if (!snapshot) return;
  targetStack.push(lastStateSnapshot);
  state = normalizeState(JSON.parse(snapshot));
  applyTheme();
  applyPrintScale();
  lastStateSnapshot = serializeState();
  persistState(lastStateSnapshot, { reason: "restore" });
  queueSyncOperation("restore", "Восстановление состояния", true);
  pendingLineFrom = "";
  selectedLinkId = "";
  openMenuId = "";
  selectedIds.clear();
  render();
  updateHistoryButtons();
}

function undoAction() {
  if (!guardEdit()) return;
  restoreSnapshot(undoStack.pop(), redoStack);
}

function redoAction() {
  if (!guardEdit()) return;
  restoreSnapshot(redoStack.pop(), undoStack);
}

function showSaveStatus() {
  els.saveTree.innerHTML = `${icon("check")}<span>Сохранено</span>`;
  window.clearTimeout(saveStatusTimer);
  saveStatusTimer = window.setTimeout(() => {
    els.saveTree.innerHTML = `${icon("save")}<span>Сохранить</span>`;
  }, 1200);
}

function manualSave() {
  lastStateSnapshot = serializeState();
  persistState(lastStateSnapshot, { backup: true, reason: "manual" });
  queueSyncOperation("manual-save", "Ручное сохранение", true);
  updateHistoryButtons();
  showSaveStatus();
}

function selectedPerson() {
  return state.people[state.selectedId] || state.people[state.rootId] || Object.values(state.people)[0];
}

function initials(name) {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function formatDateParts(person, prefix) {
  const day = String(person[`${prefix}Day`] || "").trim();
  const month = String(person[`${prefix}Month`] || "").trim();
  const year = String(person[`${prefix}Year`] || "").trim();
  if (day && month && year) return `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
  if (month && year) return `${month.padStart(2, "0")}.${year}`;
  if (year) return year;
  return "";
}

function lifeSpan(person) {
  const born = formatDateParts(person, "born");
  const died = formatDateParts(person, "died");
  if (born && died) return `${born}–${died}`;
  if (born) return `род. ${born}`;
  if (died) return `ум. ${died}`;
  return "";
}

function pluralRu(number, one, few, many) {
  const value = Math.abs(number) % 100;
  const last = value % 10;
  if (value > 10 && value < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

function dateParts(person, prefix) {
  const day = Number(person[`${prefix}Day`] || "");
  const month = Number(person[`${prefix}Month`] || "");
  const year = Number(person[`${prefix}Year`] || "");
  return {
    day: Number.isFinite(day) && day > 0 ? day : 0,
    month: Number.isFinite(month) && month > 0 ? month : 0,
    year: Number.isFinite(year) && year > 0 ? year : 0,
  };
}

function ageAtDate(born, targetDate) {
  if (!born.year) return null;
  let age = targetDate.getFullYear() - born.year;
  if (born.month && born.day) {
    const hadBirthday =
      targetDate.getMonth() + 1 > born.month ||
      (targetDate.getMonth() + 1 === born.month && targetDate.getDate() >= born.day);
    if (!hadBirthday) age -= 1;
  }
  return age >= 0 ? age : null;
}

function ageLabel(person) {
  const born = dateParts(person, "born");
  if (!born.year) return "";
  const died = dateParts(person, "died");
  const target = died.year
    ? new Date(died.year, Math.max((died.month || 1) - 1, 0), died.day || 1)
    : new Date();
  const age = ageAtDate(born, target);
  if (age === null) return "";
  const suffix = pluralRu(age, "год", "года", "лет");
  return `${age} ${suffix}`;
}

function birthdayCountdownLabel(person) {
  const born = dateParts(person, "born");
  if (!born.day || !born.month) return "укажите день и месяц";

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let nextBirthday = new Date(today.getFullYear(), born.month - 1, born.day);
  if (nextBirthday < startOfToday) {
    nextBirthday = new Date(today.getFullYear() + 1, born.month - 1, born.day);
  }
  const days = Math.round((nextBirthday - startOfToday) / 86400000);
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  return `${days} ${pluralRu(days, "день", "дня", "дней")}`;
}

function cardMeta(person) {
  return [lifeSpan(person), ageLabel(person), person.place].filter(Boolean).join(" · ");
}

function searchableText(person) {
  return [
    person.name,
    person.place,
    person.notes,
    formatDateParts(person, "born"),
    formatDateParts(person, "died"),
    person.bornYear,
    person.diedYear,
    lifeSpan(person),
    ageLabel(person),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function searchTokens() {
  return els.search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function personMatchesSearch(person, tokens = searchTokens()) {
  if (!tokens.length) return true;
  const haystack = searchableText(person);
  return tokens.every((token) => haystack.includes(token));
}

function visibleFilteredPersonIds() {
  const visible = visiblePersonIds();
  const tokens = searchTokens();
  return new Set(
    Object.values(state.people)
      .filter((person) => visible.has(person.id) && personMatchesSearch(person, tokens))
      .map((person) => person.id),
  );
}

function hashText(value) {
  return Array.from(String(value || ""))
    .map((char) => char.charCodeAt(0))
    .reduce((hash, code) => (hash * 31 + code) >>> 0, 2166136261);
}

function normalizeSurname(value) {
  let surname = String(value || "?").trim().toLowerCase().replaceAll("ё", "е");
  if (surname.endsWith("ская")) return `${surname.slice(0, -4)}ский`;
  if (surname.endsWith("цкая")) return `${surname.slice(0, -4)}цкий`;
  if (surname.endsWith("ова") || surname.endsWith("ева")) return surname.slice(0, -1);
  if (surname.endsWith("ина") || surname.endsWith("ына")) return surname.slice(0, -1);
  if (surname.endsWith("ая")) return surname.slice(0, -2);
  return surname;
}

function surnameOf(name) {
  const surname = (name || "").trim().split(/\s+/).filter(Boolean)[0] || name || "?";
  return normalizeSurname(surname);
}

function autoColorFrom(value) {
  return colors[hashText(value) % colors.length];
}

function cardColor(person) {
  if (person.colorMode === "manual") return person.manualColor || colors[0];
  if (person.colorMode === "auto-surname") return autoColorFrom(surnameOf(person.name));
  return autoColorFrom(person.name);
}

function linkExists(type, from, to) {
  return state.links.some(
    (link) =>
      link.type === type &&
      ((link.from === from && link.to === to) ||
        (type !== "parent" && link.from === to && link.to === from)),
  );
}

function addLink(type, from, to, side = "right") {
  if (!from || !to || from === to || linkExists(type, from, to)) return null;
  const link = { id: makeId("l"), type, from, to, side };
  state.links.push(link);
  return link;
}

function createPerson(seed = {}) {
  const id = makeId("p");
  state.positions ||= {};
  state.people[id] = {
    id,
    name: seed.name || "Новый человек",
    born: seed.born || "",
    died: seed.died || "",
    bornDay: seed.bornDay || "",
    bornMonth: seed.bornMonth || "",
    bornYear: seed.bornYear || "",
    diedDay: seed.diedDay || "",
    diedMonth: seed.diedMonth || "",
    diedYear: seed.diedYear || "",
    place: seed.place || "",
    notes: seed.notes || "",
    photo: seed.photo || "",
    pinned: Boolean(seed.pinned),
    colorMode: seed.colorMode || "auto-name",
    manualColor: seed.manualColor || seed.color || colors[Object.keys(state.people).length % colors.length],
  };
  state.positions[id] = snapPoint({
    x: Number.isFinite(seed.x) ? seed.x : SURFACE_W / 2,
    y: Number.isFinite(seed.y) ? seed.y : SURFACE_H / 2,
  });
  return id;
}

function snapValue(value) {
  return Math.round(value / GRID) * GRID;
}

function snapPoint(point) {
  return {
    x: Math.min(SURFACE_W - CARD_W, Math.max(0, snapValue(point.x))),
    y: Math.min(SURFACE_H - CARD_H, Math.max(0, snapValue(point.y))),
  };
}

function isValidPosition(pos) {
  return Boolean(pos && Number.isFinite(pos.x) && Number.isFinite(pos.y));
}

function viewportCenterWorld() {
  const rect = els.viewport.getBoundingClientRect();
  return {
    x: (rect.width / 2 - transform.x) / transform.scale - CARD_W / 2,
    y: (rect.height / 2 - transform.y) / transform.scale - CARD_H / 2,
  };
}

function positionNear(personId, dx, dy) {
  const anchor = positions.get(personId) || state.positions?.[personId] || viewportCenterWorld();
  return findOpenSpot({ x: anchor.x + dx, y: anchor.y + dy });
}

function findOpenSpot(preferred) {
  const occupied = new Set(
    Object.values(state.positions || {}).map((pos) => `${snapValue(pos.x)}:${snapValue(pos.y)}`),
  );
  const start = snapPoint(preferred);
  const startKey = `${start.x}:${start.y}`;
  if (!occupied.has(startKey)) return start;

  for (let radius = GRID; radius <= GRID * 14; radius += GRID) {
    const candidates = [
      { x: start.x + radius, y: start.y },
      { x: start.x - radius, y: start.y },
      { x: start.x, y: start.y + radius },
      { x: start.x, y: start.y - radius },
      { x: start.x + radius, y: start.y + radius },
      { x: start.x - radius, y: start.y + radius },
      { x: start.x + radius, y: start.y - radius },
      { x: start.x - radius, y: start.y - radius },
    ];
    const open = candidates.map(snapPoint).find((pos) => !occupied.has(`${pos.x}:${pos.y}`));
    if (open) return open;
  }

  return start;
}

function relativesFor(personId) {
  const parents = [];
  const children = [];
  const partners = [];
  const siblings = [];

  for (const link of state.links) {
    if (link.type === "parent") {
      if (link.to === personId) parents.push(link.from);
      if (link.from === personId) children.push(link.to);
    }
    if (link.type === "partner" && (link.from === personId || link.to === personId)) {
      partners.push({ id: link.from === personId ? link.to : link.from, side: link.side || "left" });
    }
    if (link.type === "sibling" && (link.from === personId || link.to === personId)) {
      siblings.push({ id: link.from === personId ? link.to : link.from, side: link.side || "right" });
    }
  }

  return { parents, children, partners, siblings };
}

function collectAncestors(personId, result = new Set()) {
  for (const parentId of relativesFor(personId).parents) {
    if (result.has(parentId)) continue;
    result.add(parentId);
    collectAncestors(parentId, result);
  }
  return result;
}

function collectDescendants(personId, result = new Set()) {
  for (const childId of relativesFor(personId).children) {
    if (result.has(childId)) continue;
    result.add(childId);
    collectDescendants(childId, result);
  }
  return result;
}

function visiblePersonIds() {
  const anchor = selectedPerson();
  const allIds = Object.keys(state.people);
  if (!anchor || activeViewMode === "all") return new Set(allIds);

  const ids = new Set([anchor.id]);
  if (activeViewMode === "ancestors") {
    collectAncestors(anchor.id, ids);
  } else if (activeViewMode === "descendants") {
    collectDescendants(anchor.id, ids);
  } else if (activeViewMode === "near") {
    const relatives = relativesFor(anchor.id);
    relatives.parents.forEach((id) => ids.add(id));
    relatives.children.forEach((id) => ids.add(id));
    relatives.partners.forEach((item) => ids.add(item.id));
    relatives.siblings.forEach((item) => ids.add(item.id));
  }
  return ids;
}

function isPersonVisible(personId) {
  return visiblePersonIds().has(personId);
}

function childrenForParents(parentIds, excludedId = "") {
  const parentSet = new Set(parentIds.filter(Boolean));
  const childIds = new Set();
  for (const link of state.links) {
    if (link.type !== "parent" || !parentSet.has(link.from) || link.to === excludedId) continue;
    childIds.add(link.to);
  }
  return Array.from(childIds);
}

function linkChildToSiblings(parentIds, childId) {
  childrenForParents(parentIds, childId).forEach((siblingId) => {
    addLink("sibling", siblingId, childId, "right");
  });
}

function distribute(count, gap) {
  if (count <= 1) return [0];
  const start = -((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, index) => start + index * gap);
}

function addGroupToQueue(queue, sourceId, ids, direction) {
  const source = positions.get(sourceId);
  const offsets = distribute(ids.length, direction === "vertical" ? 280 : 150);
  ids.forEach((entry, index) => {
    const targetId = typeof entry === "string" ? entry : entry.id;
    const side = typeof entry === "string" ? "right" : entry.side;
    if (!state.people[targetId] || positions.has(targetId)) return;

    if (direction === "up") {
      positions.set(targetId, { x: source.x + offsets[index], y: source.y - 250 });
    } else if (direction === "down") {
      positions.set(targetId, { x: source.x + offsets[index], y: source.y + 250 });
    } else {
      const sign = side === "left" ? -1 : 1;
      positions.set(targetId, { x: source.x + sign * 300, y: source.y + offsets[index] });
    }
    queue.push(targetId);
  });
}

function resolveCollisions() {
  const ids = Array.from(positions.keys());
  for (let pass = 0; pass < 16; pass += 1) {
    let moved = false;
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = positions.get(ids[i]);
        const b = positions.get(ids[j]);
        const overlapX = CARD_W + 48 - Math.abs(a.x - b.x);
        const overlapY = CARD_H + 42 - Math.abs(a.y - b.y);
        if (overlapX > 0 && overlapY > 0) {
          const push = overlapX / 2 + 8;
          const direction = a.x <= b.x ? -1 : 1;
          a.x += direction * push;
          b.x -= direction * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

function calculateAutoLayout() {
  const rootId = state.people[state.rootId] ? state.rootId : Object.keys(state.people)[0];
  if (!rootId) {
    positions = new Map();
    return positions;
  }
  state.rootId = rootId;
  const pinnedIds = Object.values(state.people)
    .filter((person) => person.pinned)
    .map((person) => person.id);
  positions =
    window.FamilyTreeLayout?.calculate(state, {
      rootId,
      grid: GRID,
      cardWidth: CARD_W,
      cardHeight: CARD_H,
      surfaceWidth: SURFACE_W,
      surfaceHeight: SURFACE_H,
      existingPositions: state.positions,
      pinnedIds,
    }) || new Map();
  return positions;
}

function calculateLayout() {
  state.positions ||= {};
  const ids = Object.keys(state.people);
  if (!ids.length) {
    positions = new Map();
    return positions;
  }

  const hasSavedPositions = ids.some((id) => isValidPosition(state.positions[id]));
  if (!hasSavedPositions) {
    calculateAutoLayout();
    for (const [id, pos] of positions) {
      state.positions[id] = snapPoint(pos);
    }
  }

  for (const id of Object.keys(state.positions)) {
    if (!state.people[id]) delete state.positions[id];
  }

  positions = new Map();
  ids.forEach((id, index) => {
    if (!isValidPosition(state.positions[id])) {
      state.positions[id] = findOpenSpot({
        x: SURFACE_W / 2 + (index % 4) * 280,
        y: SURFACE_H / 2 + 560 + Math.floor(index / 4) * 180,
      });
    }
    positions.set(id, state.positions[id]);
  });

  return positions;
}

function pathBetween(fromId, toId, type) {
  const a = positions.get(fromId);
  const b = positions.get(toId);
  if (!a || !b) return "";
  const ax = a.x + CARD_W / 2;
  const ay = a.y + CARD_H / 2;
  const bx = b.x + CARD_W / 2;
  const by = b.y + CARD_H / 2;

  if (type === "parent" && state.settings.parentLineMode === "vertical") {
    const startY = a.y + CARD_H;
    const endY = b.y;
    const midY = startY + (endY - startY) / 2;
    return `M ${ax} ${startY} C ${ax} ${midY}, ${bx} ${midY}, ${bx} ${endY}`;
  }

  if ((type === "parent" || type === "family") && Math.abs(ax - bx) < Math.abs(ay - by)) {
    const startY = a.y + CARD_H;
    const endY = b.y;
    const midY = startY + (endY - startY) / 2;
    return `M ${ax} ${startY} C ${ax} ${midY}, ${bx} ${midY}, ${bx} ${endY}`;
  }

  const startX = ax < bx ? a.x + CARD_W : a.x;
  const endX = ax < bx ? b.x : b.x + CARD_W;
  const midX = startX + (endX - startX) / 2;
  return `M ${startX} ${ay} C ${midX} ${ay}, ${midX} ${by}, ${endX} ${by}`;
}

function selectOnly(personId) {
  selectedIds = new Set([personId]);
  state.selectedId = personId;
}

function clearSelection() {
  selectedIds.clear();
  openMenuId = "";
}

function selectedPeopleIds(anchorId) {
  if (anchorId && selectedIds.has(anchorId) && selectedIds.size > 1) return Array.from(selectedIds);
  return anchorId ? [anchorId] : [];
}

function selectedVisibleIds() {
  const visible = visibleFilteredPersonIds();
  const ids = Array.from(selectedIds).filter((id) => visible.has(id) && state.people[id]);
  if (ids.length) return ids;
  return state.selectedId && visible.has(state.selectedId) && state.people[state.selectedId] ? [state.selectedId] : [];
}

function isTypingTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
}

function selectAllVisibleCards() {
  const ids = Array.from(visibleFilteredPersonIds()).filter((id) => state.people[id]);
  if (!ids.length) return;
  selectedIds = new Set(ids);
  state.selectedId = ids[0];
  selectedLinkId = "";
  pendingLineFrom = "";
  openMenuId = "";
  mode = "select";
  saveState({ recordHistory: false });
  render();
}

function copySelectedCards() {
  const ids = selectedVisibleIds();
  if (!ids.length) return false;
  const idSet = new Set(ids);
  cardClipboard = {
    people: ids.map((id) => ({
      person: { ...state.people[id], id },
      position: { ...(positions.get(id) || state.positions[id] || viewportCenterWorld()) },
    })),
    links: state.links
      .filter((link) => idSet.has(link.from) && idSet.has(link.to))
      .map((link) => ({ ...link })),
  };
  if (els.modeStatus) els.modeStatus.textContent = `Скопировано: ${ids.length}`;
  return true;
}

function pasteClipboardCards() {
  if (!guardEdit() || !cardClipboard?.people?.length) return false;
  const center = viewportCenterWorld();
  const minX = Math.min(...cardClipboard.people.map((item) => item.position.x));
  const minY = Math.min(...cardClipboard.people.map((item) => item.position.y));
  const idMap = new Map();
  const pastedIds = [];

  cardClipboard.people.forEach((item, index) => {
    const offsetX = item.position.x - minX;
    const offsetY = item.position.y - minY;
    const newId = createPerson({
      ...item.person,
      id: undefined,
      name: index === 0 && cardClipboard.people.length === 1 ? `${item.person.name || "Без имени"} (копия)` : item.person.name,
      pinned: false,
      x: center.x + offsetX,
      y: center.y + offsetY,
    });
    idMap.set(item.person.id, newId);
    pastedIds.push(newId);
  });

  cardClipboard.links.forEach((link) => {
    const from = idMap.get(link.from);
    const to = idMap.get(link.to);
    if (from && to) addLink(link.type, from, to, link.side || "right");
  });

  selectedIds = new Set(pastedIds);
  state.selectedId = pastedIds[0];
  selectedLinkId = "";
  pendingLineFrom = "";
  openMenuId = "";
  mode = "select";
  saveState({ action: `Вставлены карточки: ${pastedIds.length}` });
  render();
  return true;
}

function deletePeopleByIds(ids, action = "Удалены карточки") {
  if (!guardEdit()) return false;
  const existingIds = ids.filter((id) => state.people[id]);
  if (!existingIds.length) return false;
  const allIds = Object.keys(state.people);
  if (existingIds.length >= allIds.length) {
    const keepId = existingIds[0];
    const keepPerson = state.people[keepId];
    state.people = { [keepId]: keepPerson };
    state.links = [];
    state.rootId = keepId;
    state.selectedId = keepId;
    selectedIds = new Set([keepId]);
    Object.keys(state.positions).forEach((id) => {
      if (id !== keepId) delete state.positions[id];
    });
    Object.assign(keepPerson, {
      name: "Первый человек",
      born: "",
      died: "",
      bornDay: "",
      bornMonth: "",
      bornYear: "",
      diedDay: "",
      diedMonth: "",
      diedYear: "",
      place: "",
      notes: "",
      photo: "",
      pinned: false,
      colorMode: "auto-name",
      manualColor: colors[0],
    });
    saveState({ action, detail: String(existingIds.length) });
    render();
    return true;
  }
  existingIds.forEach((id) => {
    delete state.people[id];
    delete state.positions[id];
  });
  const deleted = new Set(existingIds);
  state.links = state.links.filter((link) => !deleted.has(link.from) && !deleted.has(link.to));
  selectedIds.clear();
  state.selectedId = state.people[state.rootId] ? state.rootId : Object.keys(state.people)[0];
  if (!state.people[state.rootId]) state.rootId = state.selectedId;
  selectedLinkId = "";
  openMenuId = "";
  pendingLineFrom = "";
  saveState({ action, detail: String(existingIds.length) });
  render();
  return true;
}

function cutSelectedCards() {
  const ids = selectedVisibleIds();
  if (!ids.length || !copySelectedCards()) return false;
  return deletePeopleByIds(ids, `Вырезаны карточки: ${ids.length}`);
}

function clearSelectionOverlay() {
  els.selection.innerHTML = "";
}

function rectFromPoints(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function nodeIntersectsRect(pos, rect) {
  return (
    pos.x < rect.x + rect.width &&
    pos.x + CARD_W > rect.x &&
    pos.y < rect.y + rect.height &&
    pos.y + CARD_H > rect.y
  );
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function drawSelectionOverlay() {
  clearSelectionOverlay();
  if (!selectDrag) return;

  if (selectDrag.type === "rect") {
    const rect = rectFromPoints(selectDrag.start, selectDrag.current);
    const el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    el.setAttribute("class", "selection-rect");
    el.setAttribute("x", rect.x);
    el.setAttribute("y", rect.y);
    el.setAttribute("width", rect.width);
    el.setAttribute("height", rect.height);
    els.selection.append(el);
    return;
  }

  if (selectDrag.points.length > 1) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    el.setAttribute("class", "selection-lasso");
    el.setAttribute("points", selectDrag.points.map((point) => `${point.x},${point.y}`).join(" "));
    els.selection.append(el);
  }
}

function finishSelection() {
  if (!selectDrag) return;
  const nextSelected = new Set();

  if (selectDrag.type === "rect") {
    const rect = rectFromPoints(selectDrag.start, selectDrag.current);
    for (const [id, pos] of positions) {
      if (nodeIntersectsRect(pos, rect)) nextSelected.add(id);
    }
  } else if (selectDrag.points.length > 2) {
    for (const [id, pos] of positions) {
      const center = { x: pos.x + CARD_W / 2, y: pos.y + CARD_H / 2 };
      if (pointInPolygon(center, selectDrag.points)) nextSelected.add(id);
    }
  }

  selectedIds = nextSelected;
  state.selectedId = selectedIds.values().next().value || state.selectedId;
  selectDrag = null;
  clearSelectionOverlay();
  mode = "select";
  render();
}

function renderLinks() {
  els.links.innerHTML = "";
  const visible = visibleFilteredPersonIds();
  for (const link of state.links) {
    if (!visible.has(link.from) || !visible.has(link.to)) continue;
    if (!positions.has(link.from) || !positions.has(link.to)) continue;
    const pathData = pathBetween(link.from, link.to, link.type);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("class", `link-path ${link.type} ${link.id === selectedLinkId ? "selected-link" : ""}`);
    path.dataset.id = link.id;
    path.dataset.type = link.type;
    attachLinkEvents(path, link);
    els.links.append(path);

    const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitPath.setAttribute("d", pathData);
    hitPath.setAttribute("class", "link-hit");
    hitPath.dataset.id = link.id;
    hitPath.dataset.type = link.type;
    attachLinkEvents(hitPath, link);
    els.links.append(hitPath);
  }
}

function attachLinkEvents(element, link) {
  element.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  element.addEventListener("click", (event) => {
    event.stopPropagation();
    if (mode === "erase-line") return;
    selectedLinkId = link.id;
    pendingLineFrom = "";
    clearSelection();
    render();
  });
}

function renderGuides() {
  els.guides.innerHTML = "";
  if (state.settings.guidesVisible === false) return;
  const guides = state.guides || [];
  guides.forEach((guide) => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "guide-group");

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "guide-line");
    line.setAttribute("stroke", guide.color || "#2f7d75");
    line.setAttribute("stroke-opacity", "0.72");
    line.setAttribute("stroke-width", "5");
    if (guide.axis === "v") {
      line.setAttribute("x1", guide.position);
      line.setAttribute("x2", guide.position);
      line.setAttribute("y1", 0);
      line.setAttribute("y2", SURFACE_H);
    } else {
      line.setAttribute("x1", 0);
      line.setAttribute("x2", SURFACE_W);
      line.setAttribute("y1", guide.position);
      line.setAttribute("y2", guide.position);
    }
    group.append(line);

    if (guide.label) {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("class", "guide-label");
      text.setAttribute("fill", guide.color || "#2f7d75");
      text.textContent = guide.label;
      if (guide.axis === "v") {
        text.setAttribute("x", Number(guide.position) + 10);
        text.setAttribute("y", 32);
        text.setAttribute("transform", `rotate(90 ${Number(guide.position) + 10} 32)`);
      } else {
        text.setAttribute("x", 24);
        text.setAttribute("y", Number(guide.position) - 10);
      }
      group.append(text);
    }
    els.guides.append(group);
  });
}

function removeLink(linkId) {
  if (!guardEdit()) return;
  const link = state.links.find((item) => item.id === linkId);
  state.links = state.links.filter((link) => link.id !== linkId);
  if (selectedLinkId === linkId) selectedLinkId = "";
  const fromName = state.people[link?.from]?.name || "человек";
  const toName = state.people[link?.to]?.name || "человек";
  saveState({ action: `Удалена связь: ${fromName} — ${toName}` });
  render();
}

function removeSelectedLink() {
  if (!selectedLinkId) return;
  removeLink(selectedLinkId);
}

function setMode(nextMode) {
  if (["draw-line", "erase-line", "guide-line", "erase-guide"].includes(nextMode) && !guardEdit()) return;
  mode = mode === nextMode ? "select" : nextMode;
  pendingLineFrom = "";
  selectedLinkId = "";
  openMenuId = "";
  selectDrag = null;
  clearSelectionOverlay();
  updateToolState();
  render();
}

function updateToolState() {
  els.drawLine.classList.toggle("active", mode === "draw-line");
  els.eraseLine.classList.toggle("active", mode === "erase-line");
  els.rectSelect.classList.toggle("active", mode === "rect-select");
  els.freeSelect.classList.toggle("active", mode === "free-select");
  els.guideLine.classList.toggle("active", mode === "guide-line");
  els.guideErase.classList.toggle("active", mode === "erase-guide");
  const labels = {
    select: "Выбор",
    "draw-line": pendingLineFrom ? "Выберите вторую" : "Выберите первую",
    "erase-line": pendingLineFrom ? "Выберите вторую" : "Выберите первую",
    "rect-select": "Рамка",
    "free-select": "Лассо",
    "guide-line": "Клик по сетке",
    "erase-guide": "Клик по линии",
  };
  els.modeStatus.textContent = labels[mode] || "Выбор";
}

function handleLineNodeClick(personId) {
  if (!guardEdit()) return;
  if (!pendingLineFrom) {
    pendingLineFrom = personId;
    state.selectedId = personId;
    updateToolState();
    render();
    return;
  }

  if (pendingLineFrom !== personId) {
    const type = els.linkType.value || "family";
    const link = addLink(type, pendingLineFrom, personId);
    selectedLinkId = link?.id || "";
    const fromName = state.people[pendingLineFrom]?.name || "человек";
    const toName = state.people[personId]?.name || "человек";
    saveState({ action: `Создана связь: ${fromName} — ${toName}` });
  }
  pendingLineFrom = "";
  mode = "select";
  render();
}

function removeLinksBetween(fromId, toId) {
  if (!guardEdit()) return;
  const before = state.links.length;
  state.links = state.links.filter(
    (link) =>
      !((link.from === fromId && link.to === toId) || (link.from === toId && link.to === fromId)),
  );
  if (state.links.length !== before) {
    selectedLinkId = "";
    const fromName = state.people[fromId]?.name || "человек";
    const toName = state.people[toId]?.name || "человек";
    saveState({ action: `Удалена связь: ${fromName} — ${toName}` });
  }
}

function handleEraseNodeClick(personId) {
  if (!pendingLineFrom) {
    pendingLineFrom = personId;
    state.selectedId = personId;
    updateToolState();
    render();
    return;
  }

  if (pendingLineFrom !== personId) {
    removeLinksBetween(pendingLineFrom, personId);
  }
  pendingLineFrom = "";
  mode = "select";
  render();
}

function createNode(person) {
  const pos = positions.get(person.id);
  const node = document.createElement("article");
  node.className = `person-node ${person.id === state.selectedId ? "selected" : ""} ${selectedIds.has(person.id) ? "multi-selected" : ""} ${person.id === pendingLineFrom ? "line-start" : ""} ${person.pinned ? "pinned" : ""} ${openMenuId === person.id ? "menu-open" : ""}`;
  node.style.left = `${pos.x}px`;
  node.style.top = `${pos.y}px`;
  node.style.setProperty("--card-color", cardColor(person));
  node.dataset.id = person.id;

  const meta = cardMeta(person);
  node.innerHTML = `
    <div class="avatar ${person.photo ? "has-photo" : ""}">
      <span>${escapeHtml(initials(person.name))}</span>
      <img alt="" src="${escapeAttribute(safeImageSrc(person.photo))}">
    </div>
    <div>
      <div class="node-name">${escapeHtml(person.name || "Без имени")}</div>
      <div class="node-meta">${escapeHtml(meta || "Добавьте данные")}</div>
    </div>
    <button class="node-menu-button" type="button" title="Действия" aria-label="Действия">${icon("menu")}</button>
    <div class="node-menu ${openMenuId === person.id ? "open" : ""}">
      <details class="node-submenu">
        <summary>${icon("user-plus")}<span>Добавить родителей</span></summary>
        <div class="node-submenu-options">
          <button type="button" data-menu-action="add-parents-1"><span>1 родитель</span></button>
          <button type="button" data-menu-action="add-parents-2"><span>2 родителя</span></button>
        </div>
      </details>
      <details class="node-submenu">
        <summary>${icon("child")}<span>Добавить детей</span></summary>
        <div class="node-submenu-options">
          <button type="button" data-menu-action="add-children-1"><span>1 ребёнок</span></button>
          <button type="button" data-menu-action="add-children-2"><span>2 детей</span></button>
          <button type="button" data-menu-action="add-children-3"><span>3 детей</span></button>
        </div>
      </details>
      <button type="button" data-menu-action="add-partner">${icon("heart")}<span>Добавить партнёра</span></button>
      <button type="button" data-menu-action="add-sibling">${icon("users")}<span>Добавить брата/сестру</span></button>
      <button type="button" data-menu-action="duplicate-card">${icon("copy")}<span>Дублировать карточку</span></button>
      <button type="button" data-menu-action="toggle-pin">${icon("lock")}<span>${person.pinned ? "Открепить" : "Закрепить"}</span></button>
    </div>
  `;

  node.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".node-menu-button, .node-menu") || mode === "draw-line" || mode === "erase-line") return;
    event.stopPropagation();
    selectedLinkId = "";
    if (!selectedIds.has(person.id)) selectOnly(person.id);
    if (isEditLocked()) return;
    const startPos = positions.get(person.id) || state.positions[person.id];
    const dragIds = selectedPeopleIds(person.id);
    cardDrag = {
      id: person.id,
      ids: dragIds,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: startPos.x,
      startY: startPos.y,
      starts: Object.fromEntries(dragIds.map((id) => [id, { ...positions.get(id) }])),
      moved: false,
    };
    node.classList.add("dragging-card");
    node.setPointerCapture(event.pointerId);
  });

  node.addEventListener("pointermove", (event) => {
    if (!cardDrag || cardDrag.id !== person.id) return;
    event.stopPropagation();
    const dx = (event.clientX - cardDrag.startClientX) / transform.scale;
    const dy = (event.clientY - cardDrag.startClientY) / transform.scale;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) cardDrag.moved = true;
    for (const id of cardDrag.ids) {
      const start = cardDrag.starts[id];
      const nextPos = {
        x: Math.min(SURFACE_W - CARD_W, Math.max(0, start.x + dx)),
        y: Math.min(SURFACE_H - CARD_H, Math.max(0, start.y + dy)),
      };
      positions.set(id, nextPos);
      state.positions[id] = nextPos;
      const movedNode = els.nodes.querySelector(`[data-id="${id}"]`);
      if (movedNode) {
        movedNode.style.left = `${nextPos.x}px`;
        movedNode.style.top = `${nextPos.y}px`;
      }
    }
    renderLinks();
  });

  node.addEventListener("pointerup", (event) => {
    if (!cardDrag || cardDrag.id !== person.id) return;
    event.stopPropagation();
    const moved = cardDrag.moved;
    for (const id of cardDrag.ids) {
      const snapped = snapPoint(state.positions[id]);
      state.positions[id] = snapped;
      positions.set(id, snapped);
    }
    cardDrag = null;
    node.classList.remove("dragging-card");
    saveState(moved ? { action: `Перемещена карточка: ${person.name || "Без имени"}` } : { recordHistory: false });
    render();
    if (moved) {
      suppressNextClick = true;
      setTimeout(() => {
        suppressNextClick = false;
      }, 0);
    }
  });

  node.addEventListener("click", (event) => {
    if (suppressNextClick) return;
    const menuButton = event.target.closest(".node-menu-button");
    const menuAction = event.target.closest("[data-menu-action]")?.dataset.menuAction;
    if (menuButton) {
      event.stopPropagation();
      if (!selectedIds.has(person.id)) selectOnly(person.id);
      openMenuId = openMenuId === person.id ? "" : person.id;
      saveState({ recordHistory: false });
      render();
      return;
    }
    if (menuAction) {
      event.stopPropagation();
      if (!selectedIds.has(person.id)) selectOnly(person.id);
      openMenuId = "";
      if (menuAction === "duplicate-card") {
        duplicateSelectedPerson();
        return;
      }
      if (menuAction === "toggle-pin") {
        togglePinForSelected();
        return;
      }
      handleRelationAction(menuAction);
      return;
    }
    if (event.target.closest(".node-menu")) {
      event.stopPropagation();
      return;
    }
    const avatar = event.target.closest(".avatar");
    if (avatar && person.photo) {
      event.stopPropagation();
      openPhotoPreview(person.photo);
      return;
    }
    if (mode === "draw-line") {
      event.stopPropagation();
      handleLineNodeClick(person.id);
      return;
    }
    if (mode === "erase-line") {
      event.stopPropagation();
      handleEraseNodeClick(person.id);
      return;
    }
    selectOnly(person.id);
    openMenuId = "";
    selectedLinkId = "";
    saveState({ recordHistory: false });
    render();
  });

  return node;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function updateSearchSuggestions() {
  if (!els.searchSuggestions) return;
  const query = els.search.value.trim().toLowerCase();
  const terms = new Map();
  Object.values(state.people).forEach((person) => {
    const text = searchableText(person);
    const words = text.match(/[\p{L}\p{N}-]{2,}/gu) || [];
    words.forEach((word) => {
      const key = word.toLowerCase();
      if (!terms.has(key)) terms.set(key, word);
    });
  });

  const suggestions = Array.from(terms.entries())
    .filter(([key]) => !query || key.includes(query))
    .map(([, word]) => word)
    .sort((a, b) => a.localeCompare(b, "ru"))
    .slice(0, 80);

  els.searchSuggestions.innerHTML = suggestions
    .map((word) => `<option value="${escapeHtml(word)}"></option>`)
    .join("");
}

function renderNodes() {
  const visible = visibleFilteredPersonIds();
  els.nodes.innerHTML = "";
  Object.values(state.people).forEach((person) => {
    if (!visible.has(person.id)) return;
    els.nodes.append(createNode(person));
  });
}

function renderInspector() {
  const person = selectedPerson();
  if (!person) return;

  state.selectedId = person.id;
  els.selectedTitle.textContent = person.name || "Без имени";
  els.name.value = person.name || "";
  els.bornDay.value = person.bornDay || "";
  els.bornMonth.value = person.bornMonth || "";
  els.bornYear.value = person.bornYear || "";
  els.diedDay.value = person.diedDay || "";
  els.diedMonth.value = person.diedMonth || "";
  els.diedYear.value = person.diedYear || "";
  els.place.value = person.place || "";
  els.notes.value = person.notes || "";
  els.photoInitials.textContent = initials(person.name);
  els.photoImage.src = safeImageSrc(person.photo);
  els.photoButton.classList.toggle("has-photo", Boolean(person.photo));
  els.cardColorPicker.value = person.manualColor || cardColor(person);
  els.cardColorPicker.disabled = person.colorMode !== "manual";
  els.manualColorMode.textContent = person.colorMode === "manual" ? "Ручной режим включён" : "Включить ручной режим";
  els.colorValueLabel.textContent = cardColor(person).toUpperCase();
  els.pinCard.checked = Boolean(person.pinned);
  els.ageSummary.textContent = ageLabel(person) || "нет даты рождения";
  els.birthdayCountdown.textContent = birthdayCountdownLabel(person);
  renderKinshipSummary(person.id);
}

function kinshipPeople(ids) {
  return ids.map((id) => state.people[id]).filter(Boolean);
}

function renderKinshipSummary(personId) {
  const relatives = relativesFor(personId);
  const groups = [
    { title: "Родители", people: kinshipPeople(relatives.parents) },
    { title: "Дети", people: kinshipPeople(relatives.children) },
    { title: "Братья/сёстры", people: kinshipPeople(relatives.siblings.map((item) => item.id)) },
  ];

  els.kinshipSummary.innerHTML = groups
    .map((group) => {
      const buttons = group.people.length
        ? group.people
            .map(
              (person) =>
                `<button class="kinship-link" type="button" data-person-id="${escapeAttribute(person.id)}">${escapeHtml(person.name || "Без имени")}</button>`,
            )
            .join("")
        : `<span class="kinship-count">Нет связей</span>`;
      return `
        <div class="kinship-row">
          <div class="kinship-row-header">
            <span>${group.title}</span>
            <span class="kinship-count">${group.people.length}</span>
          </div>
          <div class="kinship-list">${buttons}</div>
        </div>
      `;
    })
    .join("");

  els.kinshipSummary.querySelectorAll("[data-person-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.personId;
      if (!state.people[id]) return;
      selectOnly(id);
      selectedLinkId = "";
      pendingLineFrom = "";
      openMenuId = "";
      saveState({ recordHistory: false });
      render();
      focusPerson(id);
    });
  });
}

function renderStats() {
  const count = Object.keys(state.people).length;
  const linkCount = state.links.length;
  const personWord = count === 1 ? "человек" : count > 1 && count < 5 ? "человека" : "человек";
  els.stats.textContent = `${count} ${personWord}, ${linkCount} связей`;
}

function applyUiState() {
  document.body.classList.toggle("history-hidden", Boolean(state.settings.historyHidden));
  document.body.classList.toggle("inspector-collapsed", Boolean(state.settings.inspectorHidden));
  document.body.classList.toggle("admin-collapsed", Boolean(state.settings.adminCollapsed));
  document.body.classList.toggle("edit-locked", isEditLocked());
  els.editLock.checked = isEditLocked();
  els.toggleHistory.classList.toggle("active", !state.settings.historyHidden);
  els.toggleHistory.innerHTML = state.settings.historyHidden ? icon("eye-off") : icon("eye");
  els.toggleHistory.title = state.settings.historyHidden ? "Показать историю" : "Скрыть историю";
  els.toggleHistory.setAttribute("aria-label", els.toggleHistory.title);
  els.openInspector.classList.toggle("active", !state.settings.inspectorHidden);
  els.openInspector.title = state.settings.inspectorHidden ? "Показать боковую панель" : "Скрыть боковую панель";
  els.openInspector.setAttribute("aria-label", els.openInspector.title);
  els.guideVisible.checked = state.settings.guidesVisible !== false;
  els.parentLineMode.value = state.settings.parentLineMode || "smart";
  els.branchMode.value = activeViewMode;
  els.toggleAdmin.innerHTML = state.settings.adminCollapsed ? icon("plus") : icon("minus");
  els.toggleAdmin.title = state.settings.adminCollapsed ? "Развернуть админ-панель" : "Свернуть админ-панель";
  els.toggleAdmin.setAttribute("aria-label", els.toggleAdmin.title);

  const protectedControls = [
    els.autoLayout,
    els.quickAdd,
    els.drawLine,
    els.eraseLine,
    els.guideLine,
    els.guideErase,
    els.colorByName,
    els.colorBySurname,
    els.deletePerson,
    els.duplicatePerson,
    els.pinCard,
    els.manualColorMode,
    els.cardColorPicker,
    els.photoInput,
    els.import,
    els.removePhoto,
  ];
  protectedControls.forEach((control) => {
    if (control) control.disabled = isEditLocked();
  });
  if (!isEditLocked()) {
    const guidesHidden = state.settings.guidesVisible === false;
    els.guideLine.disabled = guidesHidden;
    els.guideErase.disabled = guidesHidden;
  }
  [els.name, els.bornDay, els.bornMonth, els.bornYear, els.diedDay, els.diedMonth, els.diedYear, els.place, els.notes].forEach(
    (control) => {
      if (control) control.disabled = isEditLocked();
    },
  );
}

function addGuideAt(point) {
  if (!guardEdit()) return;
  state.guides ||= [];
  const axis = els.guideAxis.value || "h";
  const position = axis === "v" ? snapValue(point.x) : snapValue(point.y);
  state.guides.push({
    id: makeId("g"),
    axis,
    position,
    color: els.guideColor.value || "#2f7d75",
    label: els.guideLabel.value.trim(),
  });
  saveState({ action: `Добавлена направляющая${els.guideLabel.value.trim() ? `: ${els.guideLabel.value.trim()}` : ""}` });
  render();
}

function eraseGuideAt(point) {
  if (!guardEdit()) return;
  const guides = state.guides || [];
  if (!guides.length) return;
  const threshold = GRID * 0.8;
  let bestIndex = -1;
  let bestDistance = Infinity;
  guides.forEach((guide, index) => {
    const distance = guide.axis === "v" ? Math.abs(point.x - Number(guide.position)) : Math.abs(point.y - Number(guide.position));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  if (bestIndex < 0 || bestDistance > threshold) return;
  const [removed] = guides.splice(bestIndex, 1);
  saveState({ action: `Удалена направляющая${removed?.label ? `: ${removed.label}` : ""}` });
  render();
}

function numericDate(person, prefix) {
  const year = Number(person[`${prefix}Year`] || "");
  if (!year) return null;
  const month = Math.min(12, Math.max(1, Number(person[`${prefix}Month`] || 1)));
  const day = Math.min(31, Math.max(1, Number(person[`${prefix}Day`] || 1)));
  return year * 10000 + month * 100 + day;
}

function isImpossibleDate(person, prefix) {
  const year = Number(person[`${prefix}Year`] || "");
  const monthRaw = person[`${prefix}Month`];
  const dayRaw = person[`${prefix}Day`];
  if (!year || !monthRaw || !dayRaw) return false;
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day;
}

function validationWarnings() {
  const warnings = [];
  Object.values(state.people).forEach((person) => {
    if (isImpossibleDate(person, "born")) warnings.push(`${person.name || "Без имени"}: некорректная дата рождения`);
    if (isImpossibleDate(person, "died")) warnings.push(`${person.name || "Без имени"}: некорректная дата смерти`);
    const born = numericDate(person, "born");
    const died = numericDate(person, "died");
    if (born && died && died < born) warnings.push(`${person.name || "Без имени"}: дата смерти раньше даты рождения`);
  });

  state.links.forEach((link) => {
    if (link.type !== "parent") return;
    const parent = state.people[link.from];
    const child = state.people[link.to];
    if (!parent || !child) return;
    if (link.from === link.to) warnings.push(`${parent.name || "Без имени"} не может быть своим родителем`);
    const parentBorn = numericDate(parent, "born");
    const childBorn = numericDate(child, "born");
    if (parentBorn && childBorn && childBorn < parentBorn) {
      warnings.push(`${child.name || "Ребёнок"} старше родителя: ${parent.name || "родитель"}`);
    }
  });

  return warnings;
}

function renderValidation() {
  if (!els.validationList) return;
  const warnings = validationWarnings();
  els.validationList.innerHTML = warnings.length
    ? warnings.slice(0, 8).map((warning) => `<div class="validation-item">${escapeHtml(warning)}</div>`).join("")
    : `<div class="validation-empty">Предупреждений нет</div>`;
}

function renderHistoryPanel() {
  if (!els.historyList) return;
  const items = state.history || [];
  els.historyList.innerHTML = items.length
    ? items
        .slice(0, 8)
        .map((item) => {
          const time = new Date(item.at);
          const label = escapeHtml(item.label || "Действие");
          const detail = item.detail ? ` · ${escapeHtml(item.detail)}` : "";
          return `<div class="history-item">${label}${detail}<time>${time.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time></div>`;
        })
        .join("")
    : `<div class="validation-empty">Действий пока нет</div>`;
}

function renderBranchControls() {
  if (els.branchMode) els.branchMode.value = activeViewMode;
}

function render() {
  els.surface.style.width = `${SURFACE_W}px`;
  els.surface.style.height = `${SURFACE_H}px`;
  updateSearchSuggestions();
  calculateLayout();
  renderGuides();
  renderLinks();
  renderNodes();
  renderInspector();
  renderStats();
  renderValidation();
  renderHistoryPanel();
  renderBranchControls();
  applyUiState();
  updateToolState();
  applyTransform();
}

function applyTransform() {
  els.surface.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
}

function fitTree() {
  if (!positions.size) return;
  const rect = els.viewport.getBoundingClientRect();
  const visible = visiblePersonIds();
  const values = Array.from(positions.entries())
    .filter(([id]) => visible.has(id))
    .map(([, pos]) => pos);
  if (!values.length) return;
  const minX = Math.min(...values.map((p) => p.x));
  const maxX = Math.max(...values.map((p) => p.x + CARD_W));
  const minY = Math.min(...values.map((p) => p.y));
  const maxY = Math.max(...values.map((p) => p.y + CARD_H));
  const width = Math.max(maxX - minX, CARD_W);
  const height = Math.max(maxY - minY, CARD_H);
  const scale = Math.min(1.8, Math.max(0.12, Math.min((rect.width - 80) / width, (rect.height - 100) / height)));
  transform.scale = scale;
  transform.x = rect.width / 2 - (minX + width / 2) * scale;
  transform.y = rect.height / 2 - (minY + height / 2) * scale;
  applyTransform();
}

function focusPerson(personId) {
  const pos = positions.get(personId);
  if (!pos) return;
  const rect = els.viewport.getBoundingClientRect();
  transform.x = rect.width / 2 - (pos.x + CARD_W / 2) * transform.scale;
  transform.y = rect.height / 2 - (pos.y + CARD_H / 2) * transform.scale;
  applyTransform();
}

function runAutoLayout() {
  if (!guardEdit()) return;
  calculateAutoLayout();
  for (const [id, pos] of positions) {
    state.positions[id] = snapPoint(pos);
  }
  saveState({ action: "Упорядочено дерево" });
  render();
  fitTree();
}

function handleRelationAction(action) {
  if (!guardEdit()) return;
  const current = selectedPerson();
  if (!current) return;
  const newIds = [];
  const parentTemplate = action.match(/^add-parents-(\d)$/);
  const childTemplate = action.match(/^add-children-(\d)$/);

  if (action === "add-parent" || parentTemplate) {
    const count = parentTemplate ? Number(parentTemplate[1]) : 1;
    const offsets = distribute(count, 340);
    for (let index = 0; index < count; index += 1) {
      const newId = createPerson({
        name: count > 1 ? `Новый родитель ${index + 1}` : "Новый родитель",
        ...positionNear(current.id, offsets[index], -300),
      });
      addLink("parent", newId, current.id);
      newIds.push(newId);
    }
    if (count === 2 && newIds.length >= 2) {
      addLink("partner", newIds[0], newIds[1], "right");
    }
  }

  if (action === "add-child" || childTemplate) {
    const count = childTemplate ? Number(childTemplate[1]) : 1;
    const partners = relativesFor(current.id).partners;
    const parentIds = [current.id, partners[0]?.id].filter(Boolean);
    const offsets = distribute(count, 340);
    for (let index = 0; index < count; index += 1) {
      const newId = createPerson({
        name: count > 1 ? `Новый ребёнок ${index + 1}` : "Новый ребёнок",
        ...positionNear(current.id, offsets[index], 300),
      });
      addLink("parent", current.id, newId);
      if (partners[0]) addLink("parent", partners[0].id, newId);
      linkChildToSiblings(parentIds, newId);
      newIds.push(newId);
    }
  }

  if (action === "add-partner") {
    const newId = createPerson({ name: "Новый партнёр", ...positionNear(current.id, -320, 0) });
    addLink("partner", current.id, newId, "left");
    newIds.push(newId);
  }

  if (action === "add-sibling") {
    const newId = createPerson({ name: "Брат или сестра", ...positionNear(current.id, 320, 0) });
    const parents = relativesFor(current.id).parents;
    if (parents.length) {
      parents.forEach((parentId) => addLink("parent", parentId, newId));
      linkChildToSiblings(parents, newId);
    } else {
      addLink("sibling", current.id, newId, "right");
    }
    newIds.push(newId);
  }

  if (newIds.length) {
    const newId = newIds.at(-1);
    state.selectedId = newId;
    const label =
      newIds.length > 1
        ? `Добавлены карточки: ${newIds.length}`
        : `Добавлен: ${state.people[newId]?.name || "новый человек"}`;
    saveState({ action: label, detail: current.name || "" });
    render();
    focusPerson(newId);
  }
}

function addLooseCard() {
  if (!guardEdit()) return;
  const pos = findOpenSpot(viewportCenterWorld());
  const newId = createPerson({ name: "Пустая карточка", ...pos });
  state.selectedId = newId;
  selectedLinkId = "";
  mode = "select";
  pendingLineFrom = "";
  openMenuId = "";
  saveState({ action: "Добавлена пустая карточка" });
  render();
  focusPerson(newId);
}

function updateSelected(field, value) {
  if (!guardEdit()) {
    renderInspector();
    return;
  }
  const person = selectedPerson();
  if (!person) return;
  person[field] = value;
  saveState();
  render();
}

function setColorMode(modeValue) {
  if (!guardEdit()) return;
  const person = selectedPerson();
  if (!person) return;
  person.colorMode = modeValue;
  saveState({ action: `Изменён цветовой режим: ${person.name || "Без имени"}` });
  render();
}

function applyColorModeToCards(modeValue, anchorId) {
  if (!guardEdit()) return;
  const ids = selectedIds.size ? Array.from(selectedIds) : [anchorId || state.selectedId];
  ids.forEach((id) => {
    if (state.people[id]) state.people[id].colorMode = modeValue;
  });
  saveState({ action: `Изменён цвет карточек: ${ids.length}` });
  render();
}

function setManualColor(value) {
  if (!guardEdit()) return;
  const person = selectedPerson();
  if (!person) return;
  person.colorMode = "manual";
  person.manualColor = value;
  saveState({ recordHistory: false });
  render();
}

function togglePinForSelected(value) {
  if (!guardEdit()) return;
  const person = selectedPerson();
  if (!person) return;
  person.pinned = typeof value === "boolean" ? value : !person.pinned;
  saveState({ action: person.pinned ? `Закреплена карточка: ${person.name}` : `Откреплена карточка: ${person.name}` });
  render();
}

function duplicateSelectedPerson() {
  if (!guardEdit()) return;
  const person = selectedPerson();
  if (!person) return;
  const sourcePos = positions.get(person.id) || state.positions[person.id] || viewportCenterWorld();
  const newId = createPerson({
    ...person,
    id: undefined,
    name: `${person.name || "Без имени"} (копия)`,
    photo: "",
    pinned: false,
    ...findOpenSpot({ x: sourcePos.x + 320, y: sourcePos.y + 40 }),
  });
  state.selectedId = newId;
  selectedLinkId = "";
  openMenuId = "";
  saveState({ action: `Дублирована карточка: ${person.name || "Без имени"}` });
  render();
  focusPerson(newId);
}

function deleteSelectedPerson() {
  if (!guardEdit()) return;
  const person = selectedPerson();
  if (!person) return;
  const ids = Object.keys(state.people);
  if (ids.length === 1) {
    Object.assign(person, {
      name: "Первый человек",
      born: "",
      died: "",
      bornDay: "",
      bornMonth: "",
      bornYear: "",
      diedDay: "",
      diedMonth: "",
      diedYear: "",
      place: "",
      notes: "",
      photo: "",
      pinned: false,
      colorMode: "auto-name",
      manualColor: colors[0],
    });
    saveState({ action: "Очищена последняя карточка" });
    render();
    return;
  }

  const deletedName = person.name || "Без имени";
  delete state.people[person.id];
  delete state.positions[person.id];
  state.links = state.links.filter((link) => link.from !== person.id && link.to !== person.id);
  state.selectedId = Object.keys(state.people)[0];
  if (state.rootId === person.id) state.rootId = state.selectedId;
  saveState({ action: `Удалён: ${deletedName}` });
  render();
}

const GEDCOM_MONTHS = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

const GEDCOM_MONTH_NAMES = Object.fromEntries(Object.entries(GEDCOM_MONTHS).map(([key, value]) => [value, key]));

function parseGedcomLine(line) {
  const match = String(line || "").match(/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Z0-9_]+)(?:\s+(.*))?$/i);
  if (!match) return null;
  return {
    level: Number(match[1]),
    pointer: match[2] || "",
    tag: match[3].toUpperCase(),
    value: (match[4] || "").trim(),
  };
}

function cleanGedcomName(value) {
  return safeText(String(value || "").replaceAll("/", "").replace(/\s+/g, " ").trim() || "Без имени", 160);
}

function parseGedcomDate(value) {
  const parts = String(value || "").toUpperCase().match(/[A-ZА-ЯЁ]+|\d+/g) || [];
  const result = { day: "", month: "", year: "" };
  parts.forEach((part) => {
    if (/^\d{4}$/.test(part)) result.year = part;
    else if (/^\d{1,2}$/.test(part) && !result.day) result.day = part.padStart(2, "0");
    else if (GEDCOM_MONTHS[part]) result.month = GEDCOM_MONTHS[part];
  });
  if (!result.year && parts.length === 1 && /^\d+$/.test(parts[0])) result.year = parts[0];
  return result;
}

function gedcomDate(person, prefix) {
  const day = person[`${prefix}Day`];
  const month = person[`${prefix}Month`];
  const year = person[`${prefix}Year`];
  if (day && month && year) return `${Number(day)} ${GEDCOM_MONTH_NAMES[month] || month} ${year}`;
  if (month && year) return `${GEDCOM_MONTH_NAMES[month] || month} ${year}`;
  if (year) return year;
  return "";
}

function gedcomName(person) {
  const name = safeText(person.name || "Без имени", 160).replaceAll("@", "");
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts.slice(1).join(" ")} /${parts[0]}/`;
  return name;
}

function exportGedcom() {
  const idMap = new Map(Object.keys(state.people).map((id, index) => [id, `I${index + 1}`]));
  const childParents = new Map();
  state.links
    .filter((link) => link.type === "parent" && state.people[link.from] && state.people[link.to])
    .forEach((link) => {
      if (!childParents.has(link.to)) childParents.set(link.to, []);
      childParents.get(link.to).push(link.from);
    });

  const families = new Map();
  childParents.forEach((parents, childId) => {
    const uniqueParents = Array.from(new Set(parents)).slice(0, 2);
    const key = uniqueParents.sort().join(":") || `child:${childId}`;
    if (!families.has(key)) families.set(key, { parents: uniqueParents, children: [] });
    families.get(key).children.push(childId);
  });
  state.links
    .filter((link) => link.type === "partner" && state.people[link.from] && state.people[link.to])
    .forEach((link) => {
      const parents = [link.from, link.to].sort();
      const key = parents.join(":");
      if (!families.has(key)) families.set(key, { parents, children: [] });
    });

  const familyEntries = Array.from(families.values()).filter((family) => family.parents.length || family.children.length);
  const familyIdMap = new Map(familyEntries.map((family, index) => [family, `F${index + 1}`]));
  const lines = ["0 HEAD", "1 SOUR FAMILY_TREE_APP", "1 GEDC", "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED", "1 CHAR UTF-8"];

  Object.values(state.people).forEach((person) => {
    lines.push(`0 @${idMap.get(person.id)}@ INDI`, `1 NAME ${gedcomName(person)}`);
    const born = gedcomDate(person, "born");
    if (born || person.place) {
      lines.push("1 BIRT");
      if (born) lines.push(`2 DATE ${born}`);
      if (person.place) lines.push(`2 PLAC ${safeText(person.place, 240)}`);
    }
    const died = gedcomDate(person, "died");
    if (died) {
      lines.push("1 DEAT", `2 DATE ${died}`);
    }
    if (person.notes) lines.push(`1 NOTE ${safeText(person.notes, 4000).replace(/\r?\n/g, " ")}`);
  });

  familyEntries.forEach((family) => {
    lines.push(`0 @${familyIdMap.get(family)}@ FAM`);
    family.parents.slice(0, 2).forEach((parentId, index) => {
      lines.push(`1 ${index === 0 ? "HUSB" : "WIFE"} @${idMap.get(parentId)}@`);
    });
    Array.from(new Set(family.children)).forEach((childId) => lines.push(`1 CHIL @${idMap.get(childId)}@`));
  });

  lines.push("0 TRLR");
  downloadBlob(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }), `family-tree-${new Date().toISOString().slice(0, 10)}.ged`);
}

function importGedcomText(text) {
  const people = {};
  const families = {};
  const pointerToId = new Map();
  let current = null;
  let currentEvent = "";

  String(text || "")
    .split(/\r?\n/)
    .map(parseGedcomLine)
    .filter(Boolean)
    .forEach((line) => {
      if (line.level === 0) {
        currentEvent = "";
        if (line.tag === "INDI") {
          const id = makeId("p");
          pointerToId.set(line.pointer, id);
          people[id] = {
            id,
            name: "Без имени",
            bornDay: "",
            bornMonth: "",
            bornYear: "",
            diedDay: "",
            diedMonth: "",
            diedYear: "",
            place: "",
            notes: "",
            photo: "",
            colorMode: "auto-name",
            manualColor: colors[Object.keys(people).length % colors.length],
          };
          current = { type: "person", id };
        } else if (line.tag === "FAM") {
          const familyId = line.pointer || makeId("f");
          families[familyId] = { parents: [], children: [] };
          current = { type: "family", id: familyId };
        } else {
          current = null;
        }
        return;
      }

      if (!current) return;
      if (current.type === "person") {
        const person = people[current.id];
        if (line.level === 1 && line.tag === "NAME") person.name = cleanGedcomName(line.value);
        if (line.level === 1 && line.tag === "NOTE") person.notes = [person.notes, safeText(line.value, 1000)].filter(Boolean).join("\n");
        if (line.level === 1 && (line.tag === "BIRT" || line.tag === "DEAT")) currentEvent = line.tag === "BIRT" ? "born" : "died";
        if (line.level === 2 && line.tag === "DATE" && currentEvent) {
          const date = parseGedcomDate(line.value);
          person[`${currentEvent}Day`] = date.day;
          person[`${currentEvent}Month`] = date.month;
          person[`${currentEvent}Year`] = date.year;
        }
        if (line.level === 2 && line.tag === "PLAC" && currentEvent === "born") person.place = safeText(line.value, 240);
      }

      if (current.type === "family") {
        const family = families[current.id];
        if (!family) return;
        if (line.tag === "HUSB" || line.tag === "WIFE") family.parents.push(line.value);
        if (line.tag === "CHIL") family.children.push(line.value);
      }
    });

  const links = [];
  Object.values(families).forEach((family) => {
    const parents = family.parents.map((pointer) => pointerToId.get(pointer)).filter(Boolean);
    const children = family.children.map((pointer) => pointerToId.get(pointer)).filter(Boolean);
    if (parents.length >= 2) links.push({ id: makeId("l"), type: "partner", from: parents[0], to: parents[1], side: "right" });
    parents.forEach((parentId) => children.forEach((childId) => links.push({ id: makeId("l"), type: "parent", from: parentId, to: childId })));
  });

  const positions = {};
  Object.keys(people).forEach((id, index) => {
    positions[id] = snapPoint({
      x: SURFACE_W / 2 + (index % 5) * 340,
      y: SURFACE_H / 2 + Math.floor(index / 5) * 220,
    });
  });
  return normalizeState({
    rootId: Object.keys(people)[0],
    selectedId: Object.keys(people)[0],
    people,
    links,
    positions,
    settings: state.settings,
    history: [],
  });
}

function exportTree() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  downloadBlob(blob, `family-tree-${new Date().toISOString().slice(0, 10)}.json`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function visibleBounds(margin = 120) {
  calculateLayout();
  const visible = visiblePersonIds();
  const values = Array.from(positions.entries())
    .filter(([id]) => visible.has(id))
    .map(([, pos]) => pos);
  if (!values.length) return { minX: 0, minY: 0, width: 800, height: 600, margin };
  const minX = Math.min(...values.map((pos) => pos.x)) - margin;
  const minY = Math.min(...values.map((pos) => pos.y)) - margin;
  const maxX = Math.max(...values.map((pos) => pos.x + CARD_W)) + margin;
  const maxY = Math.max(...values.map((pos) => pos.y + CARD_H)) + margin;
  return { minX, minY, width: maxX - minX, height: maxY - minY, margin };
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
}

function drawLinkOnCanvas(ctx, link, offsetX, offsetY) {
  const pathData = pathBetween(link.from, link.to, link.type);
  const numbers = pathData.match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
  if (numbers.length < 8) return;
  ctx.save();
  ctx.translate(-offsetX, -offsetY);
  ctx.lineWidth = link.type === "parent" ? 3 : 2.5;
  ctx.strokeStyle = link.type === "parent" ? "rgba(47, 125, 117, 0.82)" : "rgba(83, 94, 88, 0.62)";
  if (link.type === "sibling") ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(numbers[0], numbers[1]);
  ctx.bezierCurveTo(numbers[2], numbers[3], numbers[4], numbers[5], numbers[6], numbers[7]);
  ctx.stroke();
  ctx.restore();
}

function drawGuideOnCanvas(ctx, guide, offsetX, offsetY, width, height) {
  ctx.save();
  ctx.strokeStyle = guide.color || "#2f7d75";
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 5;
  ctx.beginPath();
  if (guide.axis === "v") {
    const x = Number(guide.position) - offsetX;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  } else {
    const y = Number(guide.position) - offsetY;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  if (guide.label) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = guide.color || "#2f7d75";
    ctx.font = "800 24px Segoe UI, sans-serif";
    if (guide.axis === "v") {
      const x = Number(guide.position) - offsetX + 12;
      ctx.translate(x, 36);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(guide.label, 0, 0);
    } else {
      ctx.fillText(guide.label, 24, Number(guide.position) - offsetY - 12);
    }
  }
  ctx.restore();
}

function loadCanvasImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawAvatarOnCanvas(ctx, person, image, x, y) {
  const cx = x + 46;
  const cy = y + 46;
  const radius = 32;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
  ctx.fill();
  ctx.clip();

  if (image) {
    const side = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
    const sx = ((image.naturalWidth || image.width) - side) / 2;
    const sy = ((image.naturalHeight || image.height) - side) / 2;
    ctx.drawImage(image, sx, sy, side, side, cx - radius, cy - radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.fillStyle = "rgba(34, 37, 39, 0.78)";
    ctx.font = "800 18px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(person.name), cx, cy);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1.5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawCardOnCanvas(ctx, person, pos, offsetX, offsetY, image = null) {
  const x = pos.x - offsetX;
  const y = pos.y - offsetY;
  ctx.save();
  ctx.shadowColor = "rgba(31, 35, 33, 0.18)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  roundedRect(ctx, x, y, CARD_W, CARD_H, 8);
  ctx.fillStyle = cardColor(person);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = person.pinned ? 4 : 2;
  ctx.strokeStyle = person.pinned ? "#1f5e59" : "rgba(255, 255, 255, 0.82)";
  ctx.stroke();

  drawAvatarOnCanvas(ctx, person, image, x, y);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#222527";
  ctx.font = "800 17px Segoe UI, sans-serif";
  drawWrappedText(ctx, person.name || "Без имени", x + 92, y + 34, 168, 19, 2);
  ctx.fillStyle = "rgba(34, 37, 39, 0.72)";
  ctx.font = "600 12px Segoe UI, sans-serif";
  drawWrappedText(ctx, cardMeta(person) || "Добавьте данные", x + 92, y + 82, 168, 15, 2);
  ctx.restore();
}

async function exportTreeImage() {
  const bounds = visibleBounds(140);
  const maxSide = 14000;
  const scale = Math.min(4, Math.max(1, maxSide / Math.max(bounds.width, bounds.height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(bounds.width * scale);
  canvas.height = Math.ceil(bounds.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = state.settings.theme === "dark" ? "#161816" : "#ffffff";
  ctx.fillRect(0, 0, bounds.width, bounds.height);

  if (state.settings.guidesVisible !== false) {
    (state.guides || []).forEach((guide) => drawGuideOnCanvas(ctx, guide, bounds.minX, bounds.minY, bounds.width, bounds.height));
  }
  const visible = visiblePersonIds();
  state.links
    .filter((link) => visible.has(link.from) && visible.has(link.to))
    .forEach((link) => drawLinkOnCanvas(ctx, link, bounds.minX, bounds.minY));
  const peopleToDraw = Object.values(state.people).filter((person) => visible.has(person.id) && positions.has(person.id));
  const imageEntries = await Promise.all(peopleToDraw.map(async (person) => [person.id, await loadCanvasImage(person.photo)]));
  const photoImages = new Map(imageEntries);
  peopleToDraw.forEach((person) => {
    drawCardOnCanvas(ctx, person, positions.get(person.id), bounds.minX, bounds.minY, photoImages.get(person.id));
  });

  canvas.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(blob, `family-tree-${new Date().toISOString().slice(0, 10)}.png`);
  }, "image/png");
}

function setPrintMode(enabled) {
  printModeEnabled = enabled;
  document.body.classList.toggle("print-view", enabled);
  els.printControls.hidden = !enabled;
  if (enabled) {
    activeViewMode ||= "all";
    fitTree();
    applyPrintScale();
  }
}

function importTree(file) {
  if (!guardEdit()) return;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const isGedcom = /\.(ged|gedcom)$/i.test(file.name) || /^\s*0\s+HEAD/im.test(text);
      if (isGedcom) {
        state = importGedcomText(text);
      } else {
        const data = JSON.parse(text);
        if (!data.people || !data.links) throw new Error("Неверный формат файла");
        state = normalizeState(data);
      }
      state.selectedId = state.selectedId || state.rootId || Object.keys(state.people)[0];
      applyTheme();
      applyPrintScale();
      saveState({ action: isGedcom ? "Импортировано GEDCOM-дерево" : "Импортировано дерево" });
      render();
      fitTree();
    } catch (error) {
      alert(`Не удалось импортировать дерево: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

function readPhoto(file) {
  if (!guardEdit()) return;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => updateSelected("photo", reader.result);
  reader.readAsDataURL(file);
}

function openPhotoPreview(src) {
  if (!src) return;
  els.photoModalImage.src = src;
  els.photoModal.hidden = false;
}

function closePhotoPreview() {
  els.photoModal.hidden = true;
  els.photoModalImage.src = "";
}

function applyTheme() {
  const theme = state.settings?.theme || "light";
  document.body.classList.toggle("theme-dark", theme === "dark");
  document.body.classList.toggle("theme-print", theme === "print");
  els.themeSelect.value = theme;
}

function setTheme(theme) {
  state.settings.theme = theme;
  applyTheme();
  saveState({ recordHistory: false });
  render();
}

function applyPrintScale() {
  const scale = Math.max(55, Math.min(130, Number(state.settings.printScale || 100)));
  els.printScale.value = String(scale);
  els.surface.style.setProperty("--print-scale", scale / 100);
  if (printModeEnabled) {
    transform.scale = scale / 100;
    applyTransform();
  }
}

function bindEvents() {
  els.undo.addEventListener("click", undoAction);
  els.redo.addEventListener("click", redoAction);
  els.saveTree.addEventListener("click", manualSave);
  els.sync.addEventListener("click", openSyncModal);
  els.syncForm.addEventListener("submit", loginSync);
  els.syncLogout.addEventListener("click", logoutSync);
  els.closeSyncModal.addEventListener("click", closeSyncModal);
  els.syncModal.addEventListener("click", (event) => {
    if (event.target === els.syncModal) closeSyncModal();
  });
  els.autoLayout.addEventListener("click", runAutoLayout);
  els.editLock.addEventListener("change", (event) => {
    state.settings.editLocked = event.target.checked;
    if (state.settings.editLocked) {
      mode = "select";
      pendingLineFrom = "";
      selectedLinkId = "";
    }
    saveState({ recordHistory: false });
    render();
  });
  els.toggleHistory.addEventListener("click", () => {
    state.settings.historyHidden = !state.settings.historyHidden;
    saveState({ recordHistory: false });
    render();
  });
  els.hideHistory.addEventListener("click", () => {
    state.settings.historyHidden = true;
    saveState({ recordHistory: false });
    render();
  });
  els.toggleAdmin.addEventListener("click", () => {
    state.settings.adminCollapsed = !state.settings.adminCollapsed;
    saveState({ recordHistory: false });
    render();
  });
  els.openInspector.addEventListener("click", () => {
    state.settings.inspectorHidden = !state.settings.inspectorHidden;
    saveState({ recordHistory: false });
    render();
  });
  els.closeInspector.addEventListener("click", () => {
    state.settings.inspectorHidden = true;
    saveState({ recordHistory: false });
    render();
  });
  els.name.addEventListener("input", (event) => updateSelected("name", event.target.value));
  els.bornDay.addEventListener("input", (event) => updateSelected("bornDay", event.target.value));
  els.bornMonth.addEventListener("input", (event) => updateSelected("bornMonth", event.target.value));
  els.bornYear.addEventListener("input", (event) => updateSelected("bornYear", event.target.value));
  els.diedDay.addEventListener("input", (event) => updateSelected("diedDay", event.target.value));
  els.diedMonth.addEventListener("input", (event) => updateSelected("diedMonth", event.target.value));
  els.diedYear.addEventListener("input", (event) => updateSelected("diedYear", event.target.value));
  els.place.addEventListener("input", (event) => updateSelected("place", event.target.value));
  els.notes.addEventListener("input", (event) => updateSelected("notes", event.target.value));
  els.manualColorMode.addEventListener("click", () => setColorMode("manual"));
  els.cardColorPicker.addEventListener("input", (event) => setManualColor(event.target.value));
  els.pinCard.addEventListener("change", (event) => togglePinForSelected(event.target.checked));
  els.duplicatePerson?.addEventListener("click", duplicateSelectedPerson);
  els.search.addEventListener("input", render);
  els.photoInput.addEventListener("change", (event) => readPhoto(event.target.files[0]));
  els.photoButton.addEventListener("click", () => {
    const person = selectedPerson();
    if (person?.photo) {
      openPhotoPreview(person.photo);
      return;
    }
    els.photoInput.click();
  });
  els.removePhoto.addEventListener("click", () => updateSelected("photo", ""));
  els.closePhotoModal.addEventListener("click", closePhotoPreview);
  els.photoModal.addEventListener("click", (event) => {
    if (event.target === els.photoModal) closePhotoPreview();
  });
  els.deletePerson.addEventListener("click", deleteSelectedPerson);

  els.setRoot.addEventListener("click", () => {
    if (!guardEdit()) return;
    const person = selectedPerson();
    if (!person) return;
    state.rootId = person.id;
    saveState({ action: `Центр дерева: ${person.name || "Без имени"}` });
    render();
    focusPerson(person.id);
  });

  els.export.addEventListener("click", exportTree);
  els.exportGedcom.addEventListener("click", exportGedcom);
  els.exportImage.addEventListener("click", exportTreeImage);
  els.import.addEventListener("change", (event) => {
    importTree(event.target.files[0]);
    event.target.value = "";
  });
  els.themeSelect.addEventListener("change", (event) => setTheme(event.target.value));
  els.printMode.addEventListener("click", () => setPrintMode(!printModeEnabled));
  els.exitPrintMode.addEventListener("click", () => setPrintMode(false));
  els.printScale.addEventListener("input", (event) => {
    state.settings.printScale = Number(event.target.value);
    saveState({ recordHistory: false });
    applyPrintScale();
  });
  els.fit.addEventListener("click", fitTree);
  els.zoomIn.addEventListener("click", () => zoomAtCenter(1.15));
  els.zoomOut.addEventListener("click", () => zoomAtCenter(0.87));
  els.quickAdd.addEventListener("click", addLooseCard);
  els.drawLine.addEventListener("click", () => setMode("draw-line"));
  els.eraseLine.addEventListener("click", () => setMode("erase-line"));
  els.rectSelect.addEventListener("click", () => setMode("rect-select"));
  els.freeSelect.addEventListener("click", () => setMode("free-select"));
  els.guideLine.addEventListener("click", () => setMode("guide-line"));
  els.guideErase.addEventListener("click", () => setMode("erase-guide"));
  els.guideVisible.addEventListener("change", (event) => {
    state.settings.guidesVisible = event.target.checked;
    if (!state.settings.guidesVisible && (mode === "guide-line" || mode === "erase-guide")) mode = "select";
    saveState({ recordHistory: false });
    render();
  });
  els.parentLineMode.addEventListener("change", (event) => {
    state.settings.parentLineMode = event.target.value;
    saveState({ recordHistory: false });
    render();
  });
  els.branchMode.addEventListener("change", (event) => {
    activeViewMode = event.target.value || "all";
    render();
    fitTree();
  });
  els.colorByName.addEventListener("click", () => applyColorModeToCards("auto-name"));
  els.colorBySurname.addEventListener("click", () => applyColorModeToCards("auto-surname"));

  window.addEventListener("keydown", (event) => {
    const shortcut = event.ctrlKey || event.metaKey;
    if (shortcut && !event.altKey && !isTypingTarget(event.target)) {
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        undoAction();
        return;
      }
      if (key === "y") {
        event.preventDefault();
        redoAction();
        return;
      }
      if (key === "a") {
        event.preventDefault();
        selectAllVisibleCards();
        return;
      }
      if (key === "c") {
        event.preventDefault();
        copySelectedCards();
        return;
      }
      if (key === "x") {
        event.preventDefault();
        cutSelectedCards();
        return;
      }
      if (key === "v") {
        event.preventDefault();
        pasteClipboardCards();
        return;
      }
    }

    if (event.key === "Escape") {
      if (!els.photoModal.hidden) {
        closePhotoPreview();
        return;
      }
      if (!els.syncModal.hidden) {
        closeSyncModal();
        return;
      }
      if (printModeEnabled) {
        setPrintMode(false);
        return;
      }
      mode = "select";
      pendingLineFrom = "";
      selectedLinkId = "";
      render();
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selectedLinkId) {
      event.preventDefault();
      removeSelectedLink();
    }
  });

  els.viewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".person-node")) return;
    if (mode === "guide-line") {
      event.preventDefault();
      event.stopPropagation();
      addGuideAt(clientToSurfacePoint(event.clientX, event.clientY));
      return;
    }
    if (mode === "erase-guide") {
      event.preventDefault();
      event.stopPropagation();
      eraseGuideAt(clientToSurfacePoint(event.clientX, event.clientY));
      return;
    }
    if (mode === "erase-line") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (mode === "rect-select" || mode === "free-select") {
      event.preventDefault();
      event.stopPropagation();
      const point = clientToSurfacePoint(event.clientX, event.clientY);
      selectDrag = {
        type: mode === "rect-select" ? "rect" : "free",
        start: point,
        current: point,
        points: [point],
        pointerId: event.pointerId,
      };
      els.viewport.setPointerCapture(event.pointerId);
      drawSelectionOverlay();
      return;
    }
    selectedLinkId = "";
    if (mode !== "draw-line") pendingLineFrom = "";
    event.preventDefault();
    clearBrowserSelection();
    isDragging = true;
    els.viewport.classList.add("dragging");
    els.viewport.setPointerCapture(event.pointerId);
    dragStart = { x: event.clientX, y: event.clientY };
    transformStart = { x: transform.x, y: transform.y };
  });

  els.viewport.addEventListener("pointermove", (event) => {
    if (selectDrag) {
      const point = clientToSurfacePoint(event.clientX, event.clientY);
      selectDrag.current = point;
      if (selectDrag.type === "free") selectDrag.points.push(point);
      drawSelectionOverlay();
      return;
    }
    if (!isDragging) return;
    event.preventDefault();
    clearBrowserSelection();
    transform.x = transformStart.x + event.clientX - dragStart.x;
    transform.y = transformStart.y + event.clientY - dragStart.y;
    applyTransform();
  });

  els.viewport.addEventListener("pointerup", () => {
    if (selectDrag) {
      finishSelection();
      return;
    }
    isDragging = false;
    clearBrowserSelection();
    els.viewport.classList.remove("dragging");
  });

  els.viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      zoomAtPoint(factor, event.clientX, event.clientY);
    },
    { passive: false },
  );

  window.addEventListener("resize", () => {
    if (positions.size) fitTree();
  });
}

function zoomAtCenter(factor) {
  const rect = els.viewport.getBoundingClientRect();
  zoomAtPoint(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function clientToSurfacePoint(clientX, clientY) {
  const rect = els.viewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left - transform.x) / transform.scale,
    y: (clientY - rect.top - transform.y) / transform.scale,
  };
}

function clearBrowserSelection() {
  window.getSelection?.()?.removeAllRanges();
}

function zoomAtPoint(factor, clientX, clientY) {
  const rect = els.viewport.getBoundingClientRect();
  const oldScale = transform.scale;
  const nextScale = Math.min(3.2, Math.max(0.08, oldScale * factor));
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const worldX = (px - transform.x) / oldScale;
  const worldY = (py - transform.y) / oldScale;
  transform.scale = nextScale;
  transform.x = px - worldX * nextScale;
  transform.y = py - worldY * nextScale;
  applyTransform();
}

applyTheme();
applyPrintScale();
bindEvents();
render();
updateHistoryButtons();
requestAnimationFrame(fitTree);
initializeStorage();
