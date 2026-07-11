(function () {
  function relativesFor(state, personId) {
    const parents = [];
    const children = [];
    const partners = [];
    const siblings = [];

    for (const link of state.links || []) {
      if (link.type === "parent") {
        if (link.to === personId) parents.push(link.from);
        if (link.from === personId) children.push(link.to);
      } else if (link.type === "partner" && (link.from === personId || link.to === personId)) {
        partners.push({ id: link.from === personId ? link.to : link.from, side: link.side || "left" });
      } else if (link.type === "sibling" && (link.from === personId || link.to === personId)) {
        siblings.push({ id: link.from === personId ? link.to : link.from, side: link.side || "right" });
      }
    }

    return { parents, children, partners, siblings };
  }

  function distribute(count, gap) {
    if (count <= 1) return [0];
    const start = -((count - 1) * gap) / 2;
    return Array.from({ length: count }, (_, index) => start + index * gap);
  }

  function sortBySavedPosition(ids, existingPositions) {
    return [...ids].sort((a, b) => {
      const ax = existingPositions[a]?.x ?? 0;
      const bx = existingPositions[b]?.x ?? 0;
      return ax - bx || String(a).localeCompare(String(b));
    });
  }

  function addGroupToQueue({ state, result, queue, sourceId, entries, direction, config }) {
    const source = result.get(sourceId);
    if (!source) return;

    const sortedEntries = [...entries].sort((a, b) => {
      const aId = typeof a === "string" ? a : a.id;
      const bId = typeof b === "string" ? b : b.id;
      const ax = config.existingPositions[aId]?.x ?? 0;
      const bx = config.existingPositions[bId]?.x ?? 0;
      return ax - bx || String(aId).localeCompare(String(bId));
    });
    const offsets = distribute(sortedEntries.length, direction === "side" ? config.sideStackGap : config.columnGap);

    sortedEntries.forEach((entry, index) => {
      const targetId = typeof entry === "string" ? entry : entry.id;
      const side = typeof entry === "string" ? "right" : entry.side;
      if (!state.people[targetId] || result.has(targetId)) return;

      if (config.pinnedIds.has(targetId) && config.existingPositions[targetId]) {
        result.set(targetId, { ...config.existingPositions[targetId] });
      } else if (direction === "up") {
        result.set(targetId, { x: source.x + offsets[index], y: source.y - config.levelGap });
      } else if (direction === "down") {
        result.set(targetId, { x: source.x + offsets[index], y: source.y + config.levelGap });
      } else {
        const sign = side === "left" ? -1 : 1;
        result.set(targetId, { x: source.x + sign * config.sideGap, y: source.y + offsets[index] });
      }
      queue.push(targetId);
    });
  }

  function resolveCollisions(result, config) {
    const ids = Array.from(result.keys());
    for (let pass = 0; pass < 28; pass += 1) {
      let moved = false;
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const idA = ids[i];
          const idB = ids[j];
          const a = result.get(idA);
          const b = result.get(idB);
          const overlapX = config.cardWidth + config.minGapX - Math.abs(a.x - b.x);
          const overlapY = config.cardHeight + config.minGapY - Math.abs(a.y - b.y);
          if (overlapX <= 0 || overlapY <= 0) continue;

          const aPinned = config.pinnedIds.has(idA);
          const bPinned = config.pinnedIds.has(idB);
          if (aPinned && bPinned) continue;

          const direction = a.x <= b.x ? -1 : 1;
          const push = overlapX / (aPinned || bPinned ? 1 : 2) + config.grid / 2;
          if (!aPinned) a.x += direction * push;
          if (!bPinned) b.x -= direction * push;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  function clampAndSnap(result, config) {
    const snapped = new Map();
    for (const [id, pos] of result) {
      const x = Math.round(pos.x / config.grid) * config.grid;
      const y = Math.round(pos.y / config.grid) * config.grid;
      snapped.set(id, {
        x: Math.min(config.surfaceWidth - config.cardWidth, Math.max(0, x)),
        y: Math.min(config.surfaceHeight - config.cardHeight, Math.max(0, y)),
      });
    }
    return snapped;
  }

  function calculate(state, options = {}) {
    const config = {
      grid: options.grid || 40,
      cardWidth: options.cardWidth || 280,
      cardHeight: options.cardHeight || 120,
      surfaceWidth: options.surfaceWidth || 24000,
      surfaceHeight: options.surfaceHeight || 6000,
      columnGap: options.columnGap || 340,
      levelGap: options.levelGap || 300,
      sideGap: options.sideGap || 340,
      sideStackGap: options.sideStackGap || 160,
      minGapX: options.minGapX || 64,
      minGapY: options.minGapY || 56,
      existingPositions: options.existingPositions || {},
      pinnedIds: new Set(options.pinnedIds || []),
    };

    const ids = Object.keys(state.people || {});
    const rootId = state.people?.[options.rootId] ? options.rootId : ids[0];
    const result = new Map();
    if (!rootId) return result;

    const rootPosition =
      config.pinnedIds.has(rootId) && config.existingPositions[rootId]
        ? config.existingPositions[rootId]
        : { x: config.surfaceWidth / 2, y: config.surfaceHeight / 2 };
    result.set(rootId, { ...rootPosition });

    const queue = [rootId];
    const seen = new Set();

    while (queue.length) {
      const current = queue.shift();
      if (seen.has(current)) continue;
      seen.add(current);
      const relatives = relativesFor(state, current);
      addGroupToQueue({
        state,
        result,
        queue,
        sourceId: current,
        entries: sortBySavedPosition(relatives.parents, config.existingPositions),
        direction: "up",
        config,
      });
      addGroupToQueue({
        state,
        result,
        queue,
        sourceId: current,
        entries: sortBySavedPosition(relatives.children, config.existingPositions),
        direction: "down",
        config,
      });
      addGroupToQueue({ state, result, queue, sourceId: current, entries: relatives.partners, direction: "side", config });
      addGroupToQueue({ state, result, queue, sourceId: current, entries: relatives.siblings, direction: "side", config });
    }

    ids.forEach((id, index) => {
      if (result.has(id)) return;
      if (config.pinnedIds.has(id) && config.existingPositions[id]) {
        result.set(id, { ...config.existingPositions[id] });
        return;
      }
      result.set(id, {
        x: config.surfaceWidth / 2 + (index % 5) * config.columnGap,
        y: config.surfaceHeight / 2 + config.levelGap * 2 + Math.floor(index / 5) * (config.cardHeight + config.minGapY),
      });
    });

    resolveCollisions(result, config);
    return clampAndSnap(result, config);
  }

  window.FamilyTreeLayout = { calculate };
})();
