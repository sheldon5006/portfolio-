(() => {
  "use strict";

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
  const canvas = document.getElementById("cosmos-canvas");
  const context = canvas ? canvas.getContext("2d", { alpha: true }) : null;

  // ---------------------------------------------------------
  // COSMOS: constellation field + a lagged, gravity-like lens.
  // Stars are gently deflected by the moving black hole, then
  // spring back toward their home coordinates.
  // ---------------------------------------------------------
  const cosmos = {
    width: 0,
    height: 0,
    dpr: 1,
    stars: [],
    links: [],
    frame: 0,
    previousTime: 0,
    active: false,
    target: { x: 0, y: 0 },
    hole: { x: 0, y: 0, vx: 0, vy: 0 },
    pointerType: "mouse",
    lastPointerTime: 0
  };

  const random = (min, max) => min + Math.random() * (max - min);

  function seedStars() {
    const area = cosmos.width * cosmos.height;
    const targetCount = Math.round(area / (window.innerWidth < 700 ? 3000 : 2200));
    const count = Math.max(window.innerWidth < 700 ? 120 : 190, Math.min(670, targetCount));
    cosmos.stars = Array.from({ length: count }, () => {
      const x = Math.random() * cosmos.width;
      const y = Math.random() * cosmos.height;
      const depth = random(0.35, 1);
      return {
        baseX: x,
        baseY: y,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: depth > 0.84 ? random(1.0, 1.7) : random(0.35, 1.15),
        alpha: random(0.22, 0.88) * depth,
        phase: random(0, Math.PI * 2),
        twinkleSpeed: random(0.45, 1.9),
        tint: Math.random()
      };
    });

    cosmos.links = [];
    const limit = window.innerWidth < 700 ? 100 : 126;
    const neighborCount = new Uint8Array(cosmos.stars.length);
    // Build a stable constellation map once per resize; points move each frame.
    for (let i = 0; i < cosmos.stars.length; i++) {
      for (let j = i + 1; j < cosmos.stars.length; j++) {
        const a = cosmos.stars[i];
        const b = cosmos.stars[j];
        const dx = a.baseX - b.baseX;
        const dy = a.baseY - b.baseY;
        const dist = dx * dx + dy * dy;
        if (dist < limit * limit && neighborCount[i] < 3 && neighborCount[j] < 3) {
          cosmos.links.push({ a: i, b: j, baseDistance: Math.sqrt(dist) });
          neighborCount[i]++;
          neighborCount[j]++;
        }
      }
    }
  }

  function resizeCosmos() {
    if (!canvas || !context) return;
    cosmos.width = window.innerWidth;
    cosmos.height = window.innerHeight;
    cosmos.dpr = Math.min(window.devicePixelRatio || 1, 1.7);
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
    // Critically damped spring gives the cursor a subtle orbital lag.
    const stiffness = 52;
    const damping = 14.5;
    hole.vx += ((cosmos.target.x - hole.x) * stiffness - hole.vx * damping) * dt;
    hole.vy += ((cosmos.target.y - hole.y) * stiffness - hole.vy * damping) * dt;
    hole.x += hole.vx * dt;
    hole.y += hole.vy * dt;
  }

  function bendStars(dt, time) {
    const hole = cosmos.hole;
    const gravityScale = coarsePointerQuery.matches ? 0.56 : 1;
    for (const star of cosmos.stars) {
      if (!cosmos.active || reducedMotionQuery.matches) {
        star.x = star.baseX;
        star.y = star.baseY;
        star.vx = 0;
        star.vy = 0;
        continue;
      }
      const dx = hole.x - star.x;
      const dy = hole.y - star.y;
      const d2 = dx * dx + dy * dy;
      const softening = 1250;
      const influence = 100000 * gravityScale / (d2 + softening);
      const invD = 1 / Math.sqrt(d2 + 1);
      // A small tangential component makes nearby stars arc around the horizon.
      const orbit = influence * 0.32;
      const ax = dx * invD * influence - dy * invD * orbit;
      const ay = dy * invD * influence + dx * invD * orbit;
      // The restoring spring prevents the constellation field from collapsing.
      const restore = 1.8;
      const drag = 2.5;
      star.vx += (ax - (star.x - star.baseX) * restore - star.vx * drag) * dt;
      star.vy += (ay - (star.y - star.baseY) * restore - star.vy * drag) * dt;
      star.x += star.vx * dt;
      star.y += star.vy * dt;
      // Safety rail for a star dragged too close to the event horizon.
      const offsetX = star.x - hole.x;
      const offsetY = star.y - hole.y;
      const distance = Math.hypot(offsetX, offsetY);
      if (distance < 13) {
        const angle = Math.atan2(offsetY || 0.001, offsetX || 0.001);
        star.x = hole.x + Math.cos(angle) * 13;
        star.y = hole.y + Math.sin(angle) * 13;
        star.vx *= -0.2;
        star.vy *= -0.2;
      }
      // Keep the twinkle phase deterministic, with just a tiny time drift.
      star.phase += dt * 0.035 * star.twinkleSpeed;
    }
  }

  function drawConstellations(time) {
    if (!context) return;
    const ctx = context;
    ctx.clearRect(0, 0, cosmos.width, cosmos.height);

    // Faint deep-space nebulae keep the field from feeling flat.
    const nebulaA = ctx.createRadialGradient(cosmos.width * 0.23, cosmos.height * 0.36, 0, cosmos.width * 0.23, cosmos.height * 0.36, cosmos.width * 0.38);
    nebulaA.addColorStop(0, "rgba(60,88,156,0.075)");
    nebulaA.addColorStop(1, "rgba(60,88,156,0)");
    ctx.fillStyle = nebulaA;
    ctx.fillRect(0, 0, cosmos.width, cosmos.height);

    const nebulaB = ctx.createRadialGradient(cosmos.width * 0.78, cosmos.height * 0.68, 0, cosmos.width * 0.78, cosmos.height * 0.68, cosmos.width * 0.34);
    nebulaB.addColorStop(0, "rgba(95,67,155,0.055)");
    nebulaB.addColorStop(1, "rgba(95,67,155,0)");
    ctx.fillStyle = nebulaB;
    ctx.fillRect(0, 0, cosmos.width, cosmos.height);

    for (const link of cosmos.links) {
      const a = cosmos.stars[link.a];
      const b = cosmos.stars[link.b];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 150) continue;
      const alpha = Math.max(0, (1 - distance / 150) * 0.16);
      ctx.strokeStyle = "rgba(139,173,236," + alpha.toFixed(3) + ")";
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (const star of cosmos.stars) {
      const twinkle = reducedMotionQuery.matches ? 0.85 : 0.68 + 0.32 * Math.sin(time * 0.001 * star.twinkleSpeed + star.phase);
      const alpha = Math.max(0.08, Math.min(1, star.alpha * twinkle));
      const nearHole = cosmos.active ? Math.hypot(star.x - cosmos.hole.x, star.y - cosmos.hole.y) : 9999;
      if (cosmos.active && nearHole < 9) continue;
      ctx.fillStyle = star.tint > 0.82
        ? "rgba(211,202,255," + alpha.toFixed(3) + ")"
        : "rgba(183,211,255," + alpha.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
      if (star.radius > 1.3) {
        ctx.strokeStyle = "rgba(184,210,255," + (alpha * 0.3).toFixed(3) + ")";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(star.x - 3.5, star.y);
        ctx.lineTo(star.x + 3.5, star.y);
        ctx.moveTo(star.x, star.y - 3.5);
        ctx.lineTo(star.x, star.y + 3.5);
        ctx.stroke();
      }
    }
  }

  function drawBlackHole(time) {
    if (!context || !cosmos.active) return;
    const ctx = context;
    const x = cosmos.hole.x;
    const y = cosmos.hole.y;
    const speed = Math.min(1, Math.hypot(cosmos.hole.vx, cosmos.hole.vy) / 520);
    const angle = time * 0.00018;
    const radius = coarsePointerQuery.matches ? 25 : 31;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const halo = ctx.createRadialGradient(x, y, 3, x, y, radius * 2.25);
    halo.addColorStop(0, "rgba(12,16,35,0.02)");
    halo.addColorStop(0.24, "rgba(11,14,30,0.34)");
    halo.addColorStop(0.44, "rgba(100,133,231,0.11)");
    halo.addColorStop(0.57, "rgba(169,147,255,0.14)");
    halo.addColorStop(0.72, "rgba(81,163,226,0.055)");
    halo.addColorStop(1, "rgba(76,117,226,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(1, 0.43);
    const ring = ctx.createLinearGradient(-radius * 1.5, 0, radius * 1.5, 0);
    ring.addColorStop(0, "rgba(99,168,255,0.05)");
    ring.addColorStop(0.2, "rgba(128,187,255,0.83)");
    ring.addColorStop(0.43, "rgba(207,195,255,0.93)");
    ring.addColorStop(0.62, "rgba(128,177,255,0.82)");
    ring.addColorStop(1, "rgba(103,163,255,0.08)");
    ctx.strokeStyle = ring;
    ctx.lineWidth = 2.6 + speed * 1.2;
    ctx.shadowBlur = 14 + speed * 14;
    ctx.shadowColor = "rgba(147,171,255,0.8)";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.28, radius * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(-angle * 2.2);
    ctx.strokeStyle = "rgba(124,185,255,0.32)";
    ctx.lineWidth = 1;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.62, radius * 1.06, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // The event horizon is almost black, with a thin optical edge.
    const edge = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, radius * 0.52);
    edge.addColorStop(0, "rgba(0,0,4,1)");
    edge.addColorStop(0.72, "rgba(1,3,9,1)");
    edge.addColorStop(0.9, "rgba(10,13,27,0.98)");
    edge.addColorStop(1, "rgba(148,167,255,0.16)");
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(180,198,255,0.25)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.52, 0, Math.PI * 2);
    ctx.stroke();

    // A faint directional flare communicates momentum without obscuring controls.
    if (speed > 0.08) {
      const vx = cosmos.hole.vx;
      const vy = cosmos.hole.vy;
      const angleTrail = Math.atan2(vy, vx) + Math.PI;
      const startX = x + Math.cos(angleTrail) * radius * 0.48;
      const startY = y + Math.sin(angleTrail) * radius * 0.48;
      const endX = x + Math.cos(angleTrail) * (radius * 1.75 + speed * 14);
      const endY = y + Math.sin(angleTrail) * (radius * 1.75 + speed * 14);
      const flare = ctx.createLinearGradient(startX, startY, endX, endY);
      flare.addColorStop(0, "rgba(177,194,255,0.28)");
      flare.addColorStop(1, "rgba(144,175,255,0)");
      ctx.strokeStyle = flare;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  function renderCosmos(timestamp) {
    if (!context) return;
    const rawDelta = cosmos.previousTime ? (timestamp - cosmos.previousTime) / 1000 : 0.016;
    const dt = Math.min(0.032, Math.max(0.001, rawDelta));
    cosmos.previousTime = timestamp;

    advanceBlackHole(dt);
    bendStars(dt, timestamp);
    drawConstellations(timestamp);
    drawBlackHole(timestamp);
    cosmos.frame = window.requestAnimationFrame(renderCosmos);
  }

  if (canvas && context) {
    resizeCosmos();
    window.addEventListener("resize", resizeCosmos, { passive: true });
    window.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      cosmos.pointerType = event.pointerType || "mouse";
      cosmos.target.x = event.clientX;
      cosmos.target.y = event.clientY;
      cosmos.active = true;
      cosmos.lastPointerTime = performance.now();
    }, { passive: true });
    window.addEventListener("pointerleave", () => {
      // Keep a tiny afterglow as the lens fades out off-screen.
      cosmos.active = false;
      for (const star of cosmos.stars) {
        star.vx *= 0.45;
        star.vy *= 0.45;
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
    en: { about: "Who am I", projects: "Projects", social: "Social & contact", lab: "Engineering lab", resume: "Curriculum Vitae" },
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

  function showView(name, shouldFocus) {
    if (!labels.en[name]) return;
    currentView = name;
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