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
      ? Math.max(20, Math.min(33, cosmos.height * 0.054))
      : Math.max(30, Math.min(54, cosmos.height * 0.062));
  }

  function horizonSize() {
    return coarsePointerQuery.matches
      ? Math.max(10, Math.min(15, cosmos.height * 0.021))
      : Math.max(15, Math.min(22, cosmos.height * 0.025));
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

  let blackHoleTexture = null;

  function createBlackHoleTexture() {
    const size = 320;
    const canvasTexture = document.createElement("canvas");
    canvasTexture.width = size;
    canvasTexture.height = size;
    const textureContext = canvasTexture.getContext("2d", { alpha: true });
    if (!textureContext) return null;

    const image = textureContext.createImageData(size, size);
    const pixels = image.data;
    const centre = (size - 1) / 2;
    const scale = centre;

    // Build a photographic-looking, irregular ring as a raster texture.
    // Its edge is turbulent and uneven, with muted amber, ivory and cool starlight.
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const dx = (px - centre) / scale;
        const dy = (py - centre) / scale;
        const radius = Math.sqrt(dx * dx + dy * dy);
        if (radius > 1.02) continue;

        const angle = Math.atan2(dy, dx);
        const edgeNoise =
          0.004 * Math.sin(angle * 4.0 + 0.6) +
          0.002 * Math.sin(angle * 9.0 - 1.1) +
          0.001 * Math.sin(angle * 17.0 + radius * 22.0);
        const horizonEdge = 0.478 + edgeNoise * 0.55;

        const index = (py * size + px) * 4;

        // The event horizon is opaque, deep black; no inner highlight ring.
        if (radius <= horizonEdge) {
          pixels[index] = 0;
          pixels[index + 1] = 0;
          pixels[index + 2] = 1;
          pixels[index + 3] = 255;
          continue;
        }

        const ringCentre =
          0.615 +
          0.009 * Math.sin(angle * 2.0 + 0.7) +
          0.005 * Math.sin(angle * 5.0 - 1.6) +
          0.002 * Math.sin(angle * 11.0 + radius * 20.0);
        const ringWidth = 0.043 + 0.006 * (0.5 + 0.5 * Math.sin(angle * 4.0 + 0.9));
        const distanceFromRing = (radius - ringCentre) / ringWidth;
        const ringProfile = Math.exp(-0.5 * distanceFromRing * distanceFromRing);

        // Fine turbulence breaks up the ring so it does not look mechanically circular.
        const turbulence =
          0.88 +
          0.04 * Math.sin(angle * 23.0 + radius * 97.0) +
          0.025 * Math.sin(angle * 37.0 - radius * 61.0) +
          0.015 * Math.sin(angle * 71.0 + radius * 131.0);
        const angularBrightness = Math.max(
          0.28,
          Math.min(0.82, 0.56 + 0.12 * Math.sin(angle * 1.7 - 0.8) + 0.08 * Math.cos(angle * 3.0 + 0.5))
        );
        const outerHaze = Math.exp(-Math.pow((radius - (ringCentre + 0.055)) / 0.16, 2));
        const alpha = Math.max(
          0,
          Math.min(0.72, ringProfile * (0.25 + angularBrightness * 0.46) * turbulence + outerHaze * 0.055)
        );

        // The light is mostly warm ivory with a little amber on one side
        // and cool blue-grey on the far side, never a neon white outline.
        const warmMix = Math.max(0, Math.min(1, 0.58 + 0.32 * Math.sin(angle * 1.45 + 0.45)));
        const highlight = Math.min(0.56, Math.pow(angularBrightness, 2.0) * ringProfile * 0.56);
        const warm = [192, 143, 105];
        const cool = [132, 151, 190];
        const baseR = cool[0] * (1 - warmMix) + warm[0] * warmMix;
        const baseG = cool[1] * (1 - warmMix) + warm[1] * warmMix;
        const baseB = cool[2] * (1 - warmMix) + warm[2] * warmMix;
        const outAlpha = Math.round(alpha * 255);

        pixels[index] = Math.round(baseR + (245 - baseR) * highlight);
        pixels[index + 1] = Math.round(baseG + (235 - baseG) * highlight);
        pixels[index + 2] = Math.round(baseB + (221 - baseB) * highlight);
        pixels[index + 3] = outAlpha;
      }
    }

    textureContext.putImageData(image, 0, 0);
    return canvasTexture;
  }

  function drawBlackHole(time) {
    if (!context || !cosmos.active) return;
    const ctx = context;
    const x = cosmos.hole.x;
    const y = cosmos.hole.y;
    const speed = Math.min(1, Math.hypot(cosmos.hole.vx, cosmos.hole.vy) / 460);
    const horizon = horizonSize();

    if (!blackHoleTexture) blackHoleTexture = createBlackHoleTexture();
    if (!blackHoleTexture) return;

    // Keep the event horizon slightly smaller. Slow texture rotation and a tiny
    // scale/luminance drift animate the turbulent rim without a pulsing vector ring.
    const textureRadius = horizon * 2.03;
    const motion = reducedMotionQuery.matches ? 0 : time * 0.000018;
    const breathing = reducedMotionQuery.matches ? 1 : 1 + Math.sin(time * 0.00075) * 0.006;
    const opacity = 0.97 + speed * 0.025;

    // Gently darken the immediate space around the horizon, with no concentric bands.
    const shadowRadius = lensScale() * 1.85;
    const shadow = ctx.createRadialGradient(x, y, horizon * 0.68, x, y, shadowRadius);
    shadow.addColorStop(0, "rgba(0,0,0,0.98)");
    shadow.addColorStop(0.32, "rgba(1,2,5,0.72)");
    shadow.addColorStop(0.66, "rgba(3,4,10,0.18)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(x, y, shadowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(motion);
    ctx.scale(breathing, breathing);
    ctx.globalAlpha = opacity;
    ctx.drawImage(
      blackHoleTexture,
      -textureRadius,
      -textureRadius,
      textureRadius * 2,
      textureRadius * 2
    );
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