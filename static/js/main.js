(() => {
  "use strict";

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
  const canvas = document.getElementById("cosmos-canvas");
  const context = canvas ? canvas.getContext("2d", { alpha: true }) : null;

  // ---------------------------------------------------------
  // ---------------------------------------------------------
  // ---------------------------------------------------------
  // GRAVITATIONAL COSMOS
  // Instead of drawing a graphic ring around the cursor, this
  // projects the actual starfield through a simple gravitational
  // lens equation. Nearby stars form warped primary/secondary
  // images around a soft, dark event horizon.
  // ---------------------------------------------------------
  const cosmos = {
    width: 0, height: 0, dpr: 1, stars: [], frame: 0, previousTime: 0,
    active: false, target: { x: 0, y: 0 }, hole: { x: 0, y: 0, vx: 0, vy: 0 },
    pointerType: "mouse"
  };

  const random = (min, max) => min + Math.random() * (max - min);

  function lensScale() {
    return coarsePointerQuery.matches
      ? Math.max(23, Math.min(38, cosmos.height * 0.06))
      : Math.max(38, Math.min(62, cosmos.height * 0.07));
  }

  function horizonSize() {
    return coarsePointerQuery.matches
      ? Math.max(12, Math.min(17, cosmos.height * 0.024))
      : Math.max(18, Math.min(25, cosmos.height * 0.028));
  }

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
    // The delayed position gives the gravitational lens a sense of mass.
    const stiffness = 38;
    const damping = 12.8;
    hole.vx += ((cosmos.target.x - hole.x) * stiffness - hole.vx * damping) * dt;
    hole.vy += ((cosmos.target.y - hole.y) * stiffness - hole.vy * damping) * dt;
    hole.x += hole.vx * dt;
    hole.y += hole.vy * dt;
  }

  function bendStars(dt) {
    const hole = cosmos.hole;
    const pointerScale = coarsePointerQuery.matches ? 0.52 : 0.78;
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
      const pull = (26000 * pointerScale) / (distanceSquared + 2200);
      const inverseDistance = 1 / Math.sqrt(distanceSquared + 1);
      const orbit = pull * 0.82;
      const accelerationX = dx * inverseDistance * pull - dy * inverseDistance * orbit;
      const accelerationY = dy * inverseDistance * pull + dx * inverseDistance * orbit;
      const returnSpring = 1.2;
      const drag = 2.1;
      star.vx += (accelerationX - (star.x - star.baseX) * returnSpring - star.vx * drag) * dt;
      star.vy += (accelerationY - (star.y - star.baseY) * returnSpring - star.vy * drag) * dt;
      star.x += star.vx * dt;
      star.y += star.vy * dt;
    }
  }

  // Thin-lens mapping: a background star can appear as a primary image
  // and a fainter, mirrored secondary image. Nothing is drawn as an ellipse
  // or stroked ring; the visual "ring" is made only from lensed star points.
  function projectStar(star, lensRadius) {
    const hole = cosmos.hole;
    const dx = star.x - hole.x;
    const dy = star.y - hole.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const safeDistance = Math.max(distance, 0.001);
    const root = Math.sqrt(distance * distance + 4 * lensRadius * lensRadius);
    const primaryRadius = 0.5 * (distance + root);
    const secondaryRadius = 0.5 * (root - distance);
    const primaryScale = primaryRadius / safeDistance;
    const secondaryScale = secondaryRadius / safeDistance;
    const maxDist = lensRadius * 4.2;
    const influence = Math.max(0, 1 - distance / maxDist);
    return {
      x: cosmos.active ? hole.x + dx * primaryScale : star.x,
      y: cosmos.active ? hole.y + dy * primaryScale : star.y,
      secondX: hole.x - dx * secondaryScale,
      secondY: hole.y - dy * secondaryScale,
      secondRadius: secondaryRadius,
      secondAlpha: influence * 0.29,
      influence,
      distance
    };
  }

  function drawDeepSpace(time) {
    const ctx = context;
    const w = cosmos.width;
    const h = cosmos.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#020307";
    ctx.fillRect(0, 0, w, h);

    // Very restrained interstellar dust gives depth without a tiled/grid look.
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

    const lensRadius = lensScale();
    const horizon = horizonSize();

    for (const star of cosmos.stars) {
      const twinkle = reducedMotionQuery.matches
        ? 0.88
        : 0.60 + 0.40 * (0.5 + 0.5 * Math.sin(time * 0.001 * star.twinkleSpeed + star.phase));
      const alpha = Math.max(0.09, Math.min(1, star.alpha * twinkle));
      const projection = cosmos.active ? projectStar(star, lensRadius) : null;
      const drawX = projection ? projection.x : star.x;
      const drawY = projection ? projection.y : star.y;

      // Hide background light inside the horizon; the central void is drawn last.
      if (cosmos.active && Math.hypot(drawX - cosmos.hole.x, drawY - cosmos.hole.y) < horizon * 1.03) continue;

      let color;
      if (star.tint === "warm") color = "255,205,158";
      else if (star.tint === "blue") color = "174,211,255";
      else color = "231,240,255";

      // The primary image is brightest. This is the lensed star itself, not a graphic ring.
      const starAlpha = alpha * (projection ? 1 + projection.influence * 0.12 : 1);
      if (star.radius > 1.15) {
        const bloomRadius = star.radius * (4.4 + star.pulse * twinkle * 2.0);
        const bloom = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, bloomRadius);
        bloom.addColorStop(0, "rgba(" + color + "," + (starAlpha * 0.36).toFixed(3) + ")");
        bloom.addColorStop(0.28, "rgba(" + color + "," + (starAlpha * 0.12).toFixed(3) + ")");
        bloom.addColorStop(1, "rgba(" + color + ",0)");
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(drawX, drawY, bloomRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(" + color + "," + Math.min(1, starAlpha).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(drawX, drawY, star.radius, 0, Math.PI * 2);
      ctx.fill();

      // Small mirrored images appear only within the lensing region and outside the horizon.
      if (projection && projection.distance < lensRadius * 4.2 &&
          projection.secondRadius > horizon * 1.03) {
        const ghostAlpha = alpha * projection.secondAlpha;
        if (ghostAlpha > 0.025) {
          const ghostRadius = Math.max(0.3, star.radius * (0.72 + projection.influence * 0.12));
          ctx.fillStyle = "rgba(" + color + "," + ghostAlpha.toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(projection.secondX, projection.secondY, ghostRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Sparse natural diffraction glints, moved with the star's lensed image.
      if (star.flare && twinkle > 0.76 && alpha > 0.56) {
        const ray = star.radius * (3.8 + twinkle * 3.8);
        ctx.strokeStyle = "rgba(" + color + "," + (alpha * 0.45).toFixed(3) + ")";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(drawX - ray, drawY);
        ctx.lineTo(drawX + ray, drawY);
        ctx.moveTo(drawX, drawY - ray * 1.3);
        ctx.lineTo(drawX, drawY + ray * 1.3);
        ctx.stroke();
      }
    }
  }

  function drawBlackHole(time) {
    if (!context || !cosmos.active) return;
    const ctx = context;
    const x = cosmos.hole.x;
    const y = cosmos.hole.y;
    const speed = Math.min(1, Math.hypot(cosmos.hole.vx, cosmos.hole.vy) / 460);
    const horizon = horizonSize();
    const breathe = reducedMotionQuery.matches ? 0 : (0.5 + 0.5 * Math.sin(time * 0.0008)) * 0.025;

    // Soft gravitational shadow. The star field itself supplies the lensing;
    // this layer only gives the black hole some depth.
    const shadowRadius = lensScale() * 2.25;
    const shadow = ctx.createRadialGradient(x, y, horizon * 0.55, x, y, shadowRadius);
    shadow.addColorStop(0, "rgba(0,0,0,1)");
    shadow.addColorStop(0.17, "rgba(0,0,0,0.98)");
    shadow.addColorStop(0.29, "rgba(2,3,7,0.92)");
    shadow.addColorStop(0.43, "rgba(5,6,13,0.54)");
    shadow.addColorStop(0.63, "rgba(10,11,20,0.16)");
    shadow.addColorStop(0.82, "rgba(10,12,22,0.045)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(x, y, shadowRadius, 0, Math.PI * 2);
    ctx.fill();

    // A dim, warm photon corona: a raster gradient rather than a stroked ring.
    // The offset centre keeps one side cream-white and the opposite side smoky amber.
    const coronaRadius = horizon * 2.35;
    const corona = ctx.createRadialGradient(
      x - horizon * 0.11, y - horizon * 0.14, horizon * 0.48,
      x, y, coronaRadius
    );
    corona.addColorStop(0, "rgba(0,0,0,0)");
    corona.addColorStop(0.50, "rgba(0,0,0,0)");
    corona.addColorStop(0.68, "rgba(51,40,34,0.025)");
    corona.addColorStop(0.77, "rgba(139,104,78," + (0.045 + breathe).toFixed(3) + ")");
    corona.addColorStop(0.84, "rgba(208,175,137," + (0.072 + breathe).toFixed(3) + ")");
    corona.addColorStop(0.90, "rgba(248,227,199," + (0.105 + breathe).toFixed(3) + ")");
    corona.addColorStop(0.945, "rgba(231,231,225,0.10)");
    corona.addColorStop(0.98, "rgba(149,167,207,0.045)");
    corona.addColorStop(1, "rgba(60,73,101,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(x, y, coronaRadius, 0, Math.PI * 2);
    ctx.fill();

    // A second, extremely soft cool bounce light keeps the edge integrated
    // with the blue-white stars, rather than looking like a gold neon border.
    const coolRadius = horizon * 1.72;
    const coolGlow = ctx.createRadialGradient(
      x + horizon * 0.18, y + horizon * 0.14, horizon * 0.72,
      x, y, coolRadius
    );
    coolGlow.addColorStop(0, "rgba(0,0,0,0)");
    coolGlow.addColorStop(0.75, "rgba(0,0,0,0)");
    coolGlow.addColorStop(0.88, "rgba(132,155,207,0.075)");
    coolGlow.addColorStop(0.96, "rgba(190,202,227,0.09)");
    coolGlow.addColorStop(1, "rgba(95,116,166,0)");
    ctx.fillStyle = coolGlow;
    ctx.beginPath();
    ctx.arc(x, y, coolRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // Dark event horizon with a fine edge-light, gently brighter while moving.
    const edgeRadius = horizon * (1.045 + speed * 0.025);
    const edge = ctx.createRadialGradient(
      x - horizon * 0.16, y - horizon * 0.18, horizon * 0.10,
      x, y, edgeRadius
    );
    edge.addColorStop(0, "#000");
    edge.addColorStop(0.77, "#010104");
    edge.addColorStop(0.87, "rgba(2,2,5,0.997)");
    edge.addColorStop(0.92, "rgba(17,15,17,0.99)");
    edge.addColorStop(0.955, "rgba(75,65,61,0.92)");
    edge.addColorStop(0.978, "rgba(171,149,130,0.48)");
    edge.addColorStop(0.993, "rgba(215,211,201,0.22)");
    edge.addColorStop(1, "rgba(87,102,140,0.015)");
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.arc(x, y, edgeRadius, 0, Math.PI * 2);
    ctx.fill();
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