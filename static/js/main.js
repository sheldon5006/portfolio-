(() => {
  "use strict";

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
  const canvas = document.getElementById("cosmos-canvas");
  const context = canvas ? canvas.getContext("2d", { alpha: true }) : null;

  // ---------------------------------------------------------
  // ---------------------------------------------------------
  // CINEMATIC COSMOS
  // Dense, twinkling stars and a cursor-tracked black hole with
  // an accretion disk, photon ring, and gentle gravitational lensing.
  // ---------------------------------------------------------
  const cosmos = {
    width: 0, height: 0, dpr: 1, stars: [], frame: 0, previousTime: 0,
    active: false, target: { x: 0, y: 0 }, hole: { x: 0, y: 0, vx: 0, vy: 0 },
    pointerType: "mouse"
  };

  const random = (min, max) => min + Math.random() * (max - min);

  function seedStars() {
    const area = cosmos.width * cosmos.height;
    const density = window.innerWidth < 700 ? 820 : 720;
    const count = Math.max(
      window.innerWidth < 700 ? 320 : 620,
      Math.min(2700, Math.round(area / density))
    );
    cosmos.stars = Array.from({ length: count }, () => {
      const x = Math.random() * cosmos.width;
      const y = Math.random() * cosmos.height;
      const roll = Math.random();
      const size = roll > 0.992 ? random(1.45, 2.25) : roll > 0.92 ? random(0.85, 1.35) : random(0.28, 0.85);
      const tintRoll = Math.random();
      const tint = tintRoll > 0.955 ? "warm" : tintRoll > 0.80 ? "blue" : "white";
      return {
        baseX: x, baseY: y, x, y, vx: 0, vy: 0, radius: size,
        alpha: random(0.26, 0.92), phase: random(0, Math.PI * 2),
        twinkleSpeed: random(0.55, 2.1), tint, flare: roll > 0.991,
        pulse: random(0.15, 0.5)
      };
    });
  }

  function resizeCosmos() {
    if (!canvas || !context) return;
    cosmos.width = window.innerWidth;
    cosmos.height = window.innerHeight;
    cosmos.dpr = Math.min(window.devicePixelRatio || 1, 1.65);
    canvas.width = Math.round(cosmos.width * cosmos.dpr);
    canvas.height = Math.round(cosmos.height * cosmos.dpr);
    canvas.style.width = cosmos.width + "px";
    canvas.style.height = cosmos.height + "px";
    context.setTransform(cosmos.dpr, 0, 0, cosmos.dpr, 0, 0);
    if (!cosmos.active) {
      cosmos.hole.x = cosmos.width * 0.5;
      cosmos.hole.y = cosmos.height * 0.48;
      cosmos.target.x = cosmos.hole.x;
      cosmos.target.y = cosmos.hole.y;
    }
    seedStars();
  }

  function advanceBlackHole(dt) {
    if (!cosmos.active) return;
    const hole = cosmos.hole;
    if (reducedMotionQuery.matches) {
      hole.x = cosmos.target.x;
      hole.y = cosmos.target.y;
      hole.vx = 0;
      hole.vy = 0;
      return;
    }
    // A weighty spring makes the lens feel massive rather than cursor-like.
    const stiffness = 38;
    const damping = 12.8;
    hole.vx += ((cosmos.target.x - hole.x) * stiffness - hole.vx * damping) * dt;
    hole.vy += ((cosmos.target.y - hole.y) * stiffness - hole.vy * damping) * dt;
    hole.x += hole.vx * dt;
    hole.y += hole.vy * dt;
  }

  function bendStars(dt) {
    const hole = cosmos.hole;
    const pointerScale = coarsePointerQuery.matches ? 0.68 : 1;
    for (const star of cosmos.stars) {
      if (!cosmos.active || reducedMotionQuery.matches) {
        star.x = star.baseX;
        star.y = star.baseY;
        star.vx *= 0.8;
        star.vy *= 0.8;
        continue;
      }
      const dx = hole.x - star.x;
      const dy = hole.y - star.y;
      const distanceSquared = dx * dx + dy * dy;
      const pull = (65000 * pointerScale) / (distanceSquared + 1750);
      const inverseDistance = 1 / Math.sqrt(distanceSquared + 1);
      const orbit = pull * 0.72;
      const accelerationX = dx * inverseDistance * pull - dy * inverseDistance * orbit;
      const accelerationY = dy * inverseDistance * pull + dx * inverseDistance * orbit;
      const returnSpring = 1.15;
      const drag = 2.0;
      star.vx += (accelerationX - (star.x - star.baseX) * returnSpring - star.vx * drag) * dt;
      star.vy += (accelerationY - (star.y - star.baseY) * returnSpring - star.vy * drag) * dt;
      star.x += star.vx * dt;
      star.y += star.vy * dt;
      // Stars skim around, rather than disappear into, the event horizon.
      const offsetX = star.x - hole.x;
      const offsetY = star.y - hole.y;
      const distance = Math.hypot(offsetX, offsetY);
      if (distance < 30) {
        const angle = Math.atan2(offsetY || 0.001, offsetX || 0.001);
        star.x = hole.x + Math.cos(angle) * 30;
        star.y = hole.y + Math.sin(angle) * 30;
        star.vx += -Math.sin(angle) * 5;
        star.vy += Math.cos(angle) * 5;
      }
    }
  }

  function drawDeepSpace(time) {
    const ctx = context;
    const w = cosmos.width;
    const h = cosmos.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#020307";
    ctx.fillRect(0, 0, w, h);

    // Very soft interstellar dust: mostly black, with subtle color and depth.
    const nebulae = [
      { x: 0.15, y: 0.19, r: 0.42, color: "rgba(52,83,137,0.105)" },
      { x: 0.78, y: 0.24, r: 0.35, color: "rgba(110,89,145,0.065)" },
      { x: 0.54, y: 0.82, r: 0.4, color: "rgba(57,105,130,0.06)" }
    ];
    for (const cloud of nebulae) {
      const cx = w * cloud.x;
      const cy = h * cloud.y;
      const radius = Math.max(w, h) * cloud.r;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      glow.addColorStop(0, cloud.color);
      glow.addColorStop(0.52, cloud.color.replace(/[\d.]+\)$/, "0.025)"));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }

    const dustBand = ctx.createLinearGradient(0, h * 0.12, w, h * 0.88);
    dustBand.addColorStop(0, "rgba(30,42,65,0)");
    dustBand.addColorStop(0.42, "rgba(65,65,95,0.028)");
    dustBand.addColorStop(0.56, "rgba(125,100,92,0.035)");
    dustBand.addColorStop(0.72, "rgba(56,77,111,0.018)");
    dustBand.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = dustBand;
    ctx.fillRect(0, 0, w, h);

    for (const star of cosmos.stars) {
      const twinkle = reducedMotionQuery.matches
        ? 0.88
        : 0.60 + 0.40 * (0.5 + 0.5 * Math.sin(time * 0.001 * star.twinkleSpeed + star.phase));
      const alpha = Math.max(0.09, Math.min(1, star.alpha * twinkle));
      const distanceToHole = cosmos.active ? Math.hypot(star.x - cosmos.hole.x, star.y - cosmos.hole.y) : Infinity;
      if (cosmos.active && distanceToHole < 16) continue;

      let color;
      if (star.tint === "warm") color = "255,205,158";
      else if (star.tint === "blue") color = "174,211,255";
      else color = "231,240,255";

      if (star.radius > 1.15) {
        const bloomRadius = star.radius * (4.4 + star.pulse * twinkle * 2.0);
        const bloom = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, bloomRadius);
        bloom.addColorStop(0, "rgba(" + color + "," + (alpha * 0.36).toFixed(3) + ")");
        bloom.addColorStop(0.28, "rgba(" + color + "," + (alpha * 0.12).toFixed(3) + ")");
        bloom.addColorStop(1, "rgba(" + color + ",0)");
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(star.x, star.y, bloomRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(" + color + "," + alpha.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();

      // Occasional diffraction glints: sparse rays instead of a repeating grid.
      if (star.flare && twinkle > 0.76 && alpha > 0.56) {
        const ray = star.radius * (3.8 + twinkle * 3.8);
        ctx.strokeStyle = "rgba(" + color + "," + (alpha * 0.52).toFixed(3) + ")";
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        ctx.moveTo(star.x - ray, star.y);
        ctx.lineTo(star.x + ray, star.y);
        ctx.moveTo(star.x, star.y - ray * 1.45);
        ctx.lineTo(star.x, star.y + ray * 1.45);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255," + (alpha * 0.78).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(star.x, star.y, Math.max(0.8, star.radius * 0.58), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBlackHole(time) {
    if (!context || !cosmos.active) return;
    const ctx = context;
    const x = cosmos.hole.x;
    const y = cosmos.hole.y;
    const speed = Math.min(1, Math.hypot(cosmos.hole.vx, cosmos.hole.vy) / 460);
    const radius = coarsePointerQuery.matches
      ? Math.max(18, Math.min(24, cosmos.height * 0.028))
      : Math.max(30, Math.min(48, cosmos.height * 0.047));
    const driftAngle = Math.atan2(cosmos.hole.vy, cosmos.hole.vx || 0.001);
    const rotation = time * 0.00012 + (speed > 0.05 ? driftAngle * 0.12 : 0);

    ctx.save();

    const shadow = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius * 4.9);
    shadow.addColorStop(0, "rgba(0,0,0,0.95)");
    shadow.addColorStop(0.19, "rgba(1,2,7,0.72)");
    shadow.addColorStop(0.42, "rgba(5,8,19,0.25)");
    shadow.addColorStop(0.68, "rgba(14,19,38,0.08)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 4.9, 0, Math.PI * 2);
    ctx.fill();

    // A broad, flattened accretion disk; the near side is brighter and warmer.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(1, 0.29);
    const diskX = radius * 2.55;
    const diskY = radius * 1.10;
    const diskGradient = ctx.createLinearGradient(-diskX, 0, diskX, 0);
    diskGradient.addColorStop(0, "rgba(72,100,153,0.02)");
    diskGradient.addColorStop(0.16, "rgba(123,161,226,0.32)");
    diskGradient.addColorStop(0.32, "rgba(221,204,184,0.62)");
    diskGradient.addColorStop(0.45, "rgba(255,246,225,0.93)");
    diskGradient.addColorStop(0.54, "rgba(246,210,169,0.84)");
    diskGradient.addColorStop(0.69, "rgba(143,169,225,0.48)");
    diskGradient.addColorStop(0.87, "rgba(94,132,204,0.13)");
    diskGradient.addColorStop(1, "rgba(69,107,185,0.01)");

    ctx.globalCompositeOperation = "screen";
    ctx.shadowColor = "rgba(185,198,255,0.72)";
    ctx.shadowBlur = 25 + speed * 19;
    ctx.strokeStyle = diskGradient;
    ctx.lineWidth = 8.5 + speed * 2.3;
    ctx.beginPath();
    ctx.ellipse(0, 0, diskX, diskY, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 13;
    ctx.strokeStyle = "rgba(224,231,255,0.48)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, diskX * 0.92, diskY * 0.84, 0, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.34 - i * 0.075;
      ctx.strokeStyle = i === 1 ? "rgba(255,209,165,0.8)" : "rgba(165,197,255,0.7)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(0, (i - 1) * 5.5, diskX * (0.79 + i * 0.075), diskY * (0.72 + i * 0.06), 0, 0.07, Math.PI * 1.93);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Lensed light from the far side of the disk arcs above and below the hole.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation * 0.38);
    ctx.globalCompositeOperation = "screen";
    const arcGradient = ctx.createLinearGradient(-radius * 1.6, -radius, radius * 1.6, radius);
    arcGradient.addColorStop(0, "rgba(98,147,226,0.04)");
    arcGradient.addColorStop(0.24, "rgba(162,197,255,0.72)");
    arcGradient.addColorStop(0.49, "rgba(255,239,219,0.88)");
    arcGradient.addColorStop(0.68, "rgba(181,167,239,0.62)");
    arcGradient.addColorStop(1, "rgba(101,154,226,0.04)");
    ctx.strokeStyle = arcGradient;
    ctx.lineWidth = 2.8 + speed * 0.9;
    ctx.shadowColor = "rgba(148,185,255,0.8)";
    ctx.shadowBlur = 13;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.22, radius * 0.92, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    ctx.strokeStyle = "rgba(207,220,255,0.42)";
    ctx.lineWidth = 1.3;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.13, radius * 0.84, 0, 0.10, Math.PI * 0.90);
    ctx.stroke();
    ctx.restore();

    // Almost-black event horizon edged by a small photon ring.
    const horizonRadius = radius * 0.53;
    const photonGlow = ctx.createRadialGradient(x, y, horizonRadius * 0.86, x, y, horizonRadius * 1.32);
    photonGlow.addColorStop(0, "rgba(0,0,0,1)");
    photonGlow.addColorStop(0.65, "rgba(0,0,0,1)");
    photonGlow.addColorStop(0.83, "rgba(11,14,27,0.98)");
    photonGlow.addColorStop(0.94, "rgba(180,198,255,0.65)");
    photonGlow.addColorStop(1, "rgba(205,182,255,0.02)");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = photonGlow;
    ctx.beginPath();
    ctx.arc(x, y, horizonRadius * 1.32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#010205";
    ctx.beginPath();
    ctx.arc(x, y, horizonRadius * 0.88, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation * 1.7);
    ctx.strokeStyle = "rgba(227,233,255,0.72)";
    ctx.lineWidth = 1.1;
    ctx.shadowBlur = 7;
    ctx.shadowColor = "rgba(169,193,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(0, 0, horizonRadius * 1.04, horizonRadius * 0.97, 0, Math.PI * 1.08, Math.PI * 1.84);
    ctx.stroke();
    ctx.restore();

    if (speed > 0.1) {
      const angle = Math.atan2(cosmos.hole.vy, cosmos.hole.vx || 0.001) + Math.PI;
      const startX = x + Math.cos(angle) * radius * 0.5;
      const startY = y + Math.sin(angle) * radius * 0.5;
      const endX = x + Math.cos(angle) * (radius * 3.0 + speed * 20);
      const endY = y + Math.sin(angle) * (radius * 3.0 + speed * 20);
      const wake = ctx.createLinearGradient(startX, startY, endX, endY);
      wake.addColorStop(0, "rgba(178,200,255,0.26)");
      wake.addColorStop(1, "rgba(126,154,225,0)");
      ctx.strokeStyle = wake;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    ctx.restore();
  }

  function renderCosmos(timestamp) {
    if (!context) return;
    const rawDelta = cosmos.previousTime ? (timestamp - cosmos.previousTime) / 1000 : 0.016;
    const dt = Math.min(0.032, Math.max(0.001, rawDelta));
    cosmos.previousTime = timestamp;
    advanceBlackHole(dt);
    bendStars(dt);
    drawDeepSpace(timestamp);
    drawBlackHole(timestamp);
    cosmos.frame = window.requestAnimationFrame(renderCosmos);
  }

  if (canvas && context) {
    resizeCosmos();
    window.addEventListener("resize", resizeCosmos, { passive: true });
    window.addEventListener("pointermove", (event) => {
      cosmos.pointerType = event.pointerType || "mouse";
      cosmos.target.x = event.clientX;
      cosmos.target.y = event.clientY;
      cosmos.active = true;
    }, { passive: true });
    window.addEventListener("pointerup", (event) => {
      if (event.pointerType === "touch") cosmos.active = false;
    }, { passive: true });
    window.addEventListener("pointerleave", () => {
      cosmos.active = false;
      for (const star of cosmos.stars) {
        star.vx *= 0.35;
        star.vy *= 0.35;
      }
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        window.cancelAnimationFrame(cosmos.frame);
        cosmos.previousTime = 0;
      } else {
        cosmos.previousTime = 0;
        cosmos.frame = window.requestAnimationFrame(renderCosmos);
      }
    });
    window.requestAnimationFrame(renderCosmos);
  }

  // ---------------------------------------------------------
  // App navigation: desktop-style app rail, real view panels.
  // ---------------------------------------------------------
  const labels = {
    en: { about: "whoami", projects: "Projects", social: "Social & contact", lab: "Engineering lab", resume: "Curriculum Vitae" },
    de: { about: "Über mich", projects: "Projekte", social: "Kontakt", lab: "Technik-Labor", resume: "Lebenslauf" }
  };
  const icons = { about: "⌘", projects: "▣", social: "⌁", lab: "⌬", resume: "↓" };
  const viewNumbers = { about: "01", projects: "02", social: "03", lab: "04", resume: "CV" };
  let currentView = "about";
  let currentLanguage = "en";

  const viewElements = Array.from(document.querySelectorAll(".view[data-view]"));
  const windowTitle = document.getElementById("window-title");
  const windowTitleIcon = document.getElementById("window-title-icon");
  const viewStatus = document.getElementById("view-status");
  const windowBody = document.getElementById("window-body");
  const appWindow = document.getElementById("app-window");
  const desktopShell = document.querySelector(".desktop-shell");
  const windowClose = document.getElementById("window-close");

  function showView(name, shouldFocus) {
    if (!labels.en[name]) return;
    currentView = name;
    // Launching any app from the dock or a CTA restores the window.
    if (appWindow) {
      appWindow.classList.remove("window-is-closed");
      appWindow.removeAttribute("aria-hidden");
    }
    if (desktopShell) desktopShell.classList.remove("window-closed");
    viewElements.forEach((view) => {
      const isCurrent = view.dataset.view === name;
      view.hidden = !isCurrent;
      view.classList.toggle("is-active", isCurrent);
    });
    document.querySelectorAll(".rail-item[data-open-view]").forEach((item) => {
      const isCurrent = item.dataset.openView === name;
      item.classList.toggle("is-active", isCurrent);
      if (isCurrent) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    if (windowTitle) windowTitle.textContent = labels[currentLanguage][name];
    if (windowTitleIcon) windowTitleIcon.textContent = icons[name];
    if (viewStatus) viewStatus.textContent = "VIEW / " + viewNumbers[name];
    if (windowBody) windowBody.scrollTop = 0;
    if (shouldFocus && windowBody) windowBody.focus({ preventScroll: true });
    closePalette(false);
  }

  document.querySelectorAll("[data-open-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.openView, false));
  });

  // Fully close the app window and leave only the wallpaper + OS navigation.
  // Clicking a dock item (or using Quick Open) launches a view again.
  if (windowClose && appWindow && desktopShell) {
    windowClose.addEventListener("click", () => {
      appWindow.classList.add("window-is-closed");
      appWindow.setAttribute("aria-hidden", "true");
      desktopShell.classList.add("window-closed");
      document.querySelectorAll(".rail-item[data-open-view]").forEach((item) => {
        item.classList.remove("is-active");
        item.removeAttribute("aria-current");
      });
      const opener = document.querySelector('.rail-item[data-open-view="' + currentView + '"]');
      if (opener) opener.focus({ preventScroll: true });
    });
  }

  // ---------------------------------------------------------
  // English / German content switching.
  // ---------------------------------------------------------
  function applyLanguage(language) {
    currentLanguage = language === "de" ? "de" : "en";
    document.documentElement.lang = currentLanguage;
    document.querySelectorAll("[data-copy]").forEach((element) => {
      const value = element.dataset[currentLanguage];
      if (typeof value === "string") element.textContent = value;
    });
    document.querySelectorAll("[data-language]").forEach((button) => {
      const selected = button.dataset.language === currentLanguage;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    try {
      localStorage.setItem("portfolio-language", currentLanguage);
    } catch (_) {
      // Browsing in private mode can disable storage; the language still changes.
    }
    if (windowTitle) windowTitle.textContent = labels[currentLanguage][currentView];
    if (windowTitleIcon) windowTitleIcon.textContent = icons[currentView];
    updateCommandFilter();
  }

  document.querySelectorAll("[data-language]").forEach((button) => {
    button.addEventListener("click", () => applyLanguage(button.dataset.language));
  });

  try {
    const savedLanguage = localStorage.getItem("portfolio-language");
    if (savedLanguage === "de" || savedLanguage === "en") currentLanguage = savedLanguage;
  } catch (_) {}
  // Apply the saved language after the command palette elements are initialized.

  // ---------------------------------------------------------
  // Local clock and footer year.
  // ---------------------------------------------------------
  const clock = document.getElementById("system-clock");
  const year = document.getElementById("year-now");
  function updateClock() {
    if (clock) {
      const now = new Date();
      clock.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map((part) => String(part).padStart(2, "0")).join(":");
    }
    if (year) year.textContent = String(new Date().getFullYear());
  }
  updateClock();
  window.setInterval(updateClock, 1000);

  // ---------------------------------------------------------
  // Command palette: Ctrl/Cmd + K, filter, keyboard navigation.
  // ---------------------------------------------------------
  const palette = document.getElementById("command-palette");
  const openPaletteButton = document.getElementById("command-trigger");
  const searchInput = document.getElementById("command-search");
  const commandList = document.getElementById("command-list");
  let lastFocusedElement = null;

  function commandOptions() {
    return commandList ? Array.from(commandList.querySelectorAll("button, a")).filter((item) => !item.hidden) : [];
  }

  function openPalette() {
    if (!palette) return;
    lastFocusedElement = document.activeElement;
    palette.hidden = false;
    if (searchInput) {
      searchInput.value = "";
      updateCommandFilter();
      window.requestAnimationFrame(() => searchInput.focus());
    }
  }

  function closePalette(restoreFocus) {
    if (!palette || palette.hidden) return;
    palette.hidden = true;
    if (restoreFocus !== false && lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus({ preventScroll: true });
    }
  }

  function updateCommandFilter() {
    if (!commandList) return;
    const term = (searchInput ? searchInput.value : "").trim().toLocaleLowerCase();
    commandList.querySelectorAll("button, a").forEach((item) => {
      const localized = currentLanguage === "de" ? item.dataset.commandDe : item.dataset.commandEn;
      const haystack = [localized, item.textContent, item.dataset.commandSearch].filter(Boolean).join(" ").toLocaleLowerCase();
      item.hidden = Boolean(term) && !haystack.includes(term);
    });
  }

  if (openPaletteButton) openPaletteButton.addEventListener("click", openPalette);
  if (searchInput) {
    searchInput.addEventListener("input", updateCommandFilter);
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const items = commandOptions();
        if (items[0]) items[0].focus();
      } else if (event.key === "Enter") {
        event.preventDefault();
        const first = commandOptions()[0];
        if (first) first.click();
      }
    });
  }
  if (commandList) {
    commandList.querySelectorAll("[data-command]").forEach((button) => {
      button.addEventListener("click", () => showView(button.dataset.command, true));
    });
    commandList.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = commandOptions();
      const index = items.indexOf(document.activeElement);
      const next = event.key === "ArrowDown"
        ? Math.min(items.length - 1, index + 1)
        : Math.max(0, index - 1);
      if (items[next]) {
        event.preventDefault();
        items[next].focus();
      }
    });
    commandList.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => closePalette(false)));
  }
  if (palette) {
    palette.addEventListener("click", (event) => {
      if (event.target === palette) closePalette(true);
    });
  }
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (palette && !palette.hidden) closePalette(true);
      else openPalette();
    }
    if (event.key === "Escape" && palette && !palette.hidden) closePalette(true);
    if (palette && !palette.hidden && (event.key === "ArrowUp" || event.key === "ArrowDown") &&
        (document.activeElement === commandList || document.activeElement === palette)) {
      const items = commandOptions();
      if (items.length && event.key === "ArrowDown") items[0].focus();
    }
  });

  // ---------------------------------------------------------
  // Small Flask demos: show server errors instead of false success.
  // ---------------------------------------------------------
  async function postDemo(endpoint, payload) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    let data;
    try {
      data = await response.json();
    } catch (_) {
      throw new Error("The server returned an unreadable response.");
    }
    if (!response.ok || data.error) throw new Error(data.error || "The demo could not run.");
    return data;
  }

  const asciiForm = document.getElementById("asciibar-form");
  if (asciiForm) {
    asciiForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = document.getElementById("asciibar-input");
      const output = document.getElementById("asciibar-output");
      const submit = asciiForm.querySelector('button[type="submit"]');
      if (!input || !output) return;
      output.textContent = currentLanguage === "de" ? "Wird ausgeführt …" : "Running …";
      if (submit) submit.disabled = true;
      try {
        const data = await postDemo("/api/asciibar", { numbers: input.value });
        output.textContent = data.result || data.error || "";
      } catch (error) {
        output.textContent = error.message || "Something went wrong. Please try again.";
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  const emojifyForm = document.getElementById("emojify-form");
  if (emojifyForm) {
    emojifyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = document.getElementById("emojify-input");
      const output = document.getElementById("emojify-output");
      const submit = emojifyForm.querySelector('button[type="submit"]');
      if (!input || !output) return;
      output.textContent = currentLanguage === "de" ? "Wird ausgeführt …" : "Running …";
      if (submit) submit.disabled = true;
      try {
        const data = await postDemo("/api/emojify", { text: input.value });
        output.textContent = data.result || "";
      } catch (error) {
        output.textContent = error.message || "Something went wrong. Please try again.";
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------
  // Contact form: verify HTTP status and report a real result.
  // ---------------------------------------------------------
  const contactForm = document.getElementById("contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = document.getElementById("contact-status");
      const submit = contactForm.querySelector('button[type="submit"]');
      const payload = {
        name: document.getElementById("contact-name").value.trim(),
        email: document.getElementById("contact-email").value.trim(),
        message: document.getElementById("contact-message").value.trim()
      };
      if (!status) return;
      status.dataset.state = "";
      status.textContent = currentLanguage === "de" ? "Wird gesendet …" : "Sending …";
      if (submit) submit.disabled = true;
      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        let data = {};
        try { data = await response.json(); } catch (_) {}
        if (!response.ok || !data.ok) throw new Error(data.error || (currentLanguage === "de" ? "Nachricht konnte nicht gesendet werden." : "The message could not be sent."));
        status.dataset.state = "success";
        status.textContent = currentLanguage === "de" ? "Nachricht gesendet. Danke!" : "Message sent. Thank you!";
        contactForm.reset();
      } catch (error) {
        status.dataset.state = "error";
        status.textContent = error.message || (currentLanguage === "de" ? "Bitte versuche es später erneut." : "Please try again later.");
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  if (currentLanguage === "de") applyLanguage("de");

})();