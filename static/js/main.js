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
    en: { about: "whoami", projects: "Projects", social: "Social & contact", lab: "Tools", games: "Games", resume: "Curriculum Vitae" },
    de: { about: "Über mich", projects: "Projekte", social: "Kontakt", lab: "Werkzeuge", games: "Spiele", resume: "Lebenslauf" }
  };
  const icons = { about: "⌘", projects: "▣", social: "⌁", lab: "⌬", games: "🎮", resume: "↓" };
  const viewNumbers = { about: "01", projects: "02", social: "03", lab: "04", games: "05", resume: "CV" };
  let currentView = "about";
  let currentLanguage = "en";
  let panelTransitionId = 0;
  let panelAnimation = null;
  let transitionTargetView = null;

  const viewElements = Array.from(document.querySelectorAll(".view[data-view]"));
  const windowTitle = document.getElementById("window-title");
  const windowTitleIcon = document.getElementById("window-title-icon");
  const viewStatus = document.getElementById("view-status");
  const windowBody = document.getElementById("window-body");
  const appWindow = document.getElementById("app-window");
  const desktopShell = document.querySelector(".desktop-shell");
  const windowClose = document.getElementById("window-close");
  const appBrowser = document.getElementById("app-browser");
  const detailIcon = document.getElementById("app-detail-icon");
  const detailType = document.getElementById("app-detail-type");
  const detailStatus = document.querySelector(".app-detail-status span");
  const detailTitle = document.getElementById("app-detail-title");
  const detailSubtitle = document.getElementById("app-detail-subtitle");
  const detailDescription = document.getElementById("app-detail-description");
  const detailFacts = document.getElementById("app-detail-facts");
  const detailTags = document.getElementById("app-detail-tags");
  const detailLaunch = document.getElementById("app-detail-launch");
  const detailRepo = document.getElementById("app-detail-repo");
  const childWindow = document.getElementById("lab-child-window");
  // Keep a marker at the child's original DOM position so closing the child
  // restores the exact Tools list and its selected item.
  const childHomeMarker = childWindow ? document.createComment("lab-child-window-home") : null;
  if (childWindow && childWindow.parentNode && childHomeMarker) {
    childWindow.parentNode.insertBefore(childHomeMarker, childWindow);
  }
  const childClose = document.getElementById("lab-child-close");
  const childMaximize = document.getElementById("lab-child-maximize");
  const childTitle = document.getElementById("lab-child-title");
  let childIsMaximized = false;
  const childIcon = document.getElementById("lab-child-icon");
  const shooterFrame = document.getElementById("space-shooter-frame");
  const spatialMapsFrame = document.getElementById("spatialmaps-frame");
  let selectedLabApp = "space-shooter";

  const gameCatalog = {
  "space-shooter": {
    "title": "Space Shooter",
    "subtitle": {
      "en": "Arcade · browser game",
      "de": "Arcade · Browserspiel"
    },
    "description": {
      "en": "Pilot through waves of incoming objects, avoid collisions and try to beat your high score. Use the on-screen controls on desktop and mobile.",
      "de": "Steuere dein Schiff durch Wellen ankommender Objekte, weiche Kollisionen aus und versuche, deinen Highscore zu schlagen. Nutze die Bildschirmsteuerung auf Desktop und Mobilgeräten."
    },
    "type": {
      "en": "ARCADE / WEB APP",
      "de": "ARCADE / WEB-APP"
    },
    "status": {
      "en": "Ready to play",
      "de": "Spielbereit"
    },
    "factLabel1": {
      "en": "GENRE",
      "de": "GENRE"
    },
    "genre": {
      "en": "Arcade / survival",
      "de": "Arcade / Überleben"
    },
    "factLabel2": {
      "en": "BUILT WITH",
      "de": "TECHNOLOGIE"
    },
    "stack": "Angular · TypeScript",
    "factLabel3": {
      "en": "RUNS IN",
      "de": "LÄUFT IN"
    },
    "runsIn": {
      "en": "This portfolio window",
      "de": "Dieses Portfolio-Fenster"
    },
    "tags": [
      "Angular",
      "TypeScript",
      "Arcade"
    ],
    "action": {
      "en": "Play now",
      "de": "Jetzt spielen"
    },
    "source": "https://github.com/sheldon5006/Space_shooter_ng",
    "sourceLabel": {
      "en": "View source",
      "de": "Quellcode ansehen"
    },
    "art": "space"
  },
  "spatialmaps": {
    "title": "SpatialMaps",
    "subtitle": {
      "en": "Interactive map workspace",
      "de": "Interaktive Kartenumgebung"
    },
    "description": {
      "en": "Explore a live mapping app with location editing, dynamic map data and smooth camera movement. Launch the hosted demo inside this portfolio window.",
      "de": "Erkunde eine Karten-App mit Standortbearbeitung, dynamischen Kartendaten und flüssiger Kamerabewegung. Starte die gehostete Demo direkt in diesem Portfolio-Fenster."
    },
    "type": {
      "en": "LIVE WEB APP",
      "de": "LIVE-WEB-APP"
    },
    "status": {
      "en": "Hosted demo available",
      "de": "Gehostete Demo verfügbar"
    },
    "factLabel1": {
      "en": "CATEGORY",
      "de": "KATEGORIE"
    },
    "genre": {
      "en": "Interactive maps",
      "de": "Interaktive Karten"
    },
    "factLabel2": {
      "en": "BUILT WITH",
      "de": "TECHNOLOGIE"
    },
    "stack": "Angular · TypeScript · PixiJS",
    "factLabel3": {
      "en": "RUNS IN",
      "de": "LÄUFT IN"
    },
    "runsIn": {
      "en": "Hosted web app",
      "de": "Gehostete Web-App"
    },
    "tags": [
      "Angular",
      "PixiJS",
      "Maps UI"
    ],
    "action": {
      "en": "Open SpatialMaps",
      "de": "SpatialMaps öffnen"
    },
    "source": "https://github.com/sheldon5006/SpatialMaps",
    "sourceLabel": {
      "en": "View source",
      "de": "Quellcode ansehen"
    },
    "art": "maps"
  },
  "asciibar": {
    "title": "asciibar",
    "subtitle": {
      "en": "Terminal chart utility",
      "de": "Terminal-Diagramm-Tool"
    },
    "description": {
      "en": "Turn numbers into a readable terminal bar chart. This utility runs through the portfolio Flask API in its own app window.",
      "de": "Wandle Zahlen in ein lesbares Terminal-Balkendiagramm um. Das Tool läuft über die Flask-API dieses Portfolios in einem eigenen App-Fenster."
    },
    "type": {
      "en": "LOCAL UTILITY",
      "de": "LOKALES TOOL"
    },
    "status": {
      "en": "Ready to launch",
      "de": "Startbereit"
    },
    "factLabel1": {
      "en": "CATEGORY",
      "de": "KATEGORIE"
    },
    "genre": {
      "en": "Terminal visualization",
      "de": "Terminal-Visualisierung"
    },
    "factLabel2": {
      "en": "BUILT WITH",
      "de": "TECHNOLOGIE"
    },
    "stack": "Python · Flask",
    "factLabel3": {
      "en": "RUNS IN",
      "de": "LÄUFT IN"
    },
    "runsIn": {
      "en": "Portfolio API",
      "de": "Portfolio-API"
    },
    "tags": [
      "Python",
      "CLI",
      "Flask API"
    ],
    "action": {
      "en": "Launch utility",
      "de": "Tool starten"
    },
    "source": "https://github.com/sheldon5006/asciibar",
    "sourceLabel": {
      "en": "View source",
      "de": "Quellcode ansehen"
    },
    "art": "terminal"
  },
  "emojify": {
    "title": "emojify",
    "subtitle": {
      "en": "Emoji shortcode utility",
      "de": "Emoji-Shortcode-Tool"
    },
    "description": {
      "en": "Convert familiar :shortcodes: into emoji without external API calls. Try a sample message in the terminal-style app window.",
      "de": "Wandle bekannte :Shortcodes: ohne externe API-Aufrufe in Emoji um. Probiere eine Beispielnachricht im Terminalfenster."
    },
    "type": {
      "en": "LOCAL UTILITY",
      "de": "LOKALES TOOL"
    },
    "status": {
      "en": "Ready to launch",
      "de": "Startbereit"
    },
    "factLabel1": {
      "en": "CATEGORY",
      "de": "KATEGORIE"
    },
    "genre": {
      "en": "Text transformation",
      "de": "Textumwandlung"
    },
    "factLabel2": {
      "en": "BUILT WITH",
      "de": "TECHNOLOGIE"
    },
    "stack": "Python · Text parsing",
    "factLabel3": {
      "en": "RUNS IN",
      "de": "LÄUFT IN"
    },
    "runsIn": {
      "en": "Portfolio API",
      "de": "Portfolio-API"
    },
    "tags": [
      "Python",
      "Shortcodes",
      "Emoji"
    ],
    "action": {
      "en": "Launch utility",
      "de": "Tool starten"
    },
    "source": "https://github.com/sheldon5006/emojify",
    "sourceLabel": {
      "en": "View source",
      "de": "Quellcode ansehen"
    },
    "art": "emoji"
  }
};

  const appCatalog = {
    asciibar: {
      title:"asciibar", icon:"app-icon-terminal", glyph:"▥", child:"asciibar", playable:true,
      url:"https://github.com/sheldon5006/asciibar",
      subtitle:{en:"Numbers to terminal bars",de:"Zahlen als Terminal-Balken"},
      type:{en:"LOCAL UTILITY",de:"LOKALES TOOL"}, status:{en:"Available locally",de:"Lokal verfügbar"},
      description:{en:"Turn numbers into a readable terminal bar chart. This demo runs through the portfolio's Flask API and needs no plotting library.",de:"Wandle Zahlen in ein lesbares Terminal-Balkendiagramm um. Die Demo läuft über die Flask-API dieses Portfolios und benötigt keine Plot-Bibliothek."},
      facts:{en:[["TYPE","Python utility"],["RUNS IN","This portfolio"],["DEPENDENCIES","No plotting library"]],de:[["TYP","Python-Tool"],["LÄUFT IN","Dieses Portfolio"],["ABHÄNGIGKEITEN","Keine Plot-Bibliothek"]]},
      tags:["Python","CLI","Flask API"], action:{en:"Launch utility",de:"Tool starten"}
    },
    emojify: {
      title:"emojify",icon:"app-icon-emoji",glyph:"✳",child:"emojify",playable:true,
      url:"https://github.com/sheldon5006/emojify",
      subtitle:{en:"Turn shortcodes into emoji",de:"Shortcodes in Emoji umwandeln"},
      type:{en:"LOCAL UTILITY",de:"LOKALES TOOL"},status:{en:"Available locally",de:"Lokal verfügbar"},
      description:{en:"Convert familiar :shortcodes: into emoji without external API calls. Try a message and inspect the output in a terminal-style app window.",de:"Wandle bekannte :Shortcodes: ohne externe API-Aufrufe in Emoji um. Probiere eine Nachricht und prüfe die Ausgabe im Terminalfenster."},
      facts:{en:[["TYPE","Python text utility"],["RUNS IN","This portfolio"],["NETWORK","No external API needed"]],de:[["TYP","Python-Text-Tool"],["LÄUFT IN","Dieses Portfolio"],["NETZWERK","Keine externe API nötig"]]},
      tags:["Python","Text parsing","CLI"],action:{en:"Launch utility",de:"Tool starten"}
    },
    "space-shooter": {
      title:"Space Shooter",icon:"app-icon-game",glyph:"🎮",child:"space-shooter",playable:true,
      url:"https://github.com/sheldon5006/Space_shooter_ng",
      subtitle:{en:"Arcade game",de:"Arcade-Spiel"},
      type:{en:"BROWSER GAME",de:"BROWSER-SPIEL"},status:{en:"Hosted demo",de:"Gehostete Demo"},
      description:{en:"A browser-based space shooter from my Angular project. Launch it here, or open the hosted game separately if its server blocks embedding.",de:"Ein browserbasiertes Space-Shooter-Spiel aus meinem Angular-Projekt. Starte es hier oder öffne das gehostete Spiel separat, falls der Server das Einbetten blockiert."},
      facts:{en:[["TYPE","Web game"],["STACK","Angular · TypeScript"],["ACCESS","Hosted demo + source"]],de:[["TYP","Web-Spiel"],["STACK","Angular · TypeScript"],["ZUGRIFF","Demo + Quellcode"]]},
      tags:["Angular","TypeScript","Game"],action:{en:"Play game",de:"Spiel starten"}
    },
    spatialmaps: {
      title:"SpatialMaps",icon:"app-icon-maps",glyph:"⌖",child:"spatialmaps",playable:true,url:"https://github.com/sheldon5006/SpatialMaps",
      subtitle:{en:"Interactive mapping UI",de:"Interaktive Kartenoberfläche"},
      type:{en:"LIVE WEB DEMO",de:"LIVE-WEB-DEMO"},status:{en:"Hosted demo available",de:"Gehostete Demo verfügbar"},
      description:{en:"Explore SpatialMaps in a live embedded demo. The project experiments with developer-friendly interactive maps, dynamic map data, location editing and smooth camera movement.",de:"Erkunde SpatialMaps in einer live eingebetteten Demo. Das Projekt untersucht entwicklerfreundliche interaktive Karten, dynamische Kartendaten, Standortbearbeitung und flüssige Kamerabewegungen."},
      facts:{en:[["TYPE","Interactive web app"],["STACK","Angular · TypeScript · PixiJS"],["DEMO","spatialmaps.onrender.com"]],de:[["TYP","Interaktive Web-App"],["STACK","Angular · TypeScript · PixiJS"],["DEMO","spatialmaps.onrender.com"]]},
      tags:["Angular","TypeScript","PixiJS","Maps UI"],action:{en:"Launch SpatialMaps",de:"SpatialMaps starten"}
    },
    "flowdesk-ai": {
      title:"FlowDesk AI",icon:"app-icon-ai",glyph:"✳",playable:false,url:"https://github.com/sheldon5006/FlowDeskAi",
      subtitle:{en:"RAG and knowledge APIs",de:"RAG- und Wissens-APIs"},
      type:{en:"AI PROJECT",de:"KI-PROJEKT"},status:{en:"Active development",de:"In aktiver Entwicklung"},
      description:{en:"A reusable AI capability layer for business applications. The current foundation focuses on document ingestion, embeddings, PostgreSQL with pgvector, retrieval and API-based integration.",de:"Eine wiederverwendbare KI-Schicht für Business-Anwendungen mit Dokumentaufnahme, Embeddings, PostgreSQL/pgvector, Retrieval und API-Integration."},
      facts:{en:[["TYPE","RAG platform foundation"],["STACK",".NET · PostgreSQL · pgvector"],["DESIGN","Layered API architecture"]],de:[["TYP","RAG-Plattform-Grundlage"],["STACK",".NET · PostgreSQL · pgvector"],["DESIGN","Geschichtete API-Architektur"]]},
      tags:[".NET","RAG","PostgreSQL","pgvector"],action:{en:"View repository",de:"Repository ansehen"}
    },
    jobpilot: {
      title:"JobPilot AI",icon:"app-icon-jobs",glyph:"▤",playable:false,url:"https://github.com/sheldon5006/jobpilot-ai",
      subtitle:{en:"AI-assisted job search",de:"KI-gestützte Jobsuche"},
      type:{en:"AI PROJECT",de:"KI-PROJEKT"},status:{en:"Prototype in progress",de:"Prototyp in Entwicklung"},
      description:{en:"A personal job-search assistant for job description analysis, candidate-fit recommendations, tailored application materials and application tracking.",de:"Ein persönlicher Bewerbungsassistent für Stellenanzeigenanalyse, Profilabgleich, angepasste Bewerbungsunterlagen und Bewerbungsnachverfolgung."},
      facts:{en:[["TYPE","Job-search workflow"],["STACK","ASP.NET Core · TypeScript"],["AI","Configurable model integration"]],de:[["TYP","Bewerbungsablauf"],["STACK","ASP.NET Core · TypeScript"],["KI","Konfigurierbare Modellintegration"]]},
      tags:["ASP.NET Core","TypeScript","Gemini","PostgreSQL"],action:{en:"View repository",de:"Repository ansehen"}
    },
    flowdesk: {
      title:"FlowDesk",icon:"app-icon-flow",glyph:"⌘",playable:false,url:"https://github.com/sheldon5006/FlowDesk",
      subtitle:{en:"Modular workforce operations",de:"Modulare Personalabläufe"},
      type:{en:"ENGINEERING PROJECT",de:"ENGINEERING-PROJEKT"},status:{en:"In development",de:"In Entwicklung"},
      description:{en:"A modular workforce operations concept for exploring clean architecture, clear module boundaries, scheduling workflows and future warehouse capabilities.",de:"Ein modulares Konzept für Personalabläufe mit Clean Architecture, klaren Modulgrenzen, Planungsabläufen und künftigen Lagerfunktionen."},
      facts:{en:[["TYPE","Modular business application"],["FOCUS","Workforce + scheduling"],["DESIGN","Clean architecture boundaries"]],de:[["TYP","Modulare Business-Anwendung"],["FOKUS","Personal + Planung"],["DESIGN","Clean-Architecture-Modulgrenzen"]]},
      tags:[".NET","Angular","Clean Architecture"],action:{en:"View repository",de:"Repository ansehen"}
    },
    nifty50: {
      title:"NIFTY50 Sentinel",icon:"app-icon-market",glyph:"⌁",playable:false,url:"https://github.com/sheldon5006/nifty50-sentinel",
      subtitle:{en:"Market data & forecast research",de:"Marktdaten und Prognoseforschung"},
      type:{en:"RESEARCH PROJECT",de:"FORSCHUNGSPROJEKT"},status:{en:"Experimental research",de:"Experimentelle Forschung"},
      description:{en:"Research into one-minute NIFTY 50 data and short-horizon forecasts, with emphasis on data quality, baseline comparisons, walk-forward evaluation and uncertainty.",de:"Forschung zu NIFTY-50-Minutedaten und kurzfristigen Prognosen mit Fokus auf Datenqualität, Baseline-Vergleiche, Walk-forward-Evaluation und Unsicherheit."},
      facts:{en:[["TYPE","Market-data research"],["FOCUS","1-minute candles · 1–5 min forecast"],["SAFETY","No automated order placement"]],de:[["TYP","Marktdatenforschung"],["FOKUS","1-Minuten-Kerzen · 1–5-Minuten-Prognose"],["SICHERHEIT","Keine automatischen Orders"]]},
      tags:["Python","Market data","Forecast evaluation"],action:{en:"View repository",de:"Repository ansehen"}
    },
    "credit-prediction": {
      title:"Credit Default Prediction",icon:"app-icon-data",glyph:"▤",playable:false,url:"https://github.com/sheldon5006/Credit_Card_Default_Prediction",
      subtitle:{en:"Credit risk classification",de:"Kreditrisiko-Klassifizierung"},
      type:{en:"MACHINE LEARNING",de:"MACHINE LEARNING"},status:{en:"Source repository",de:"Quellcode-Repository"},
      description:{en:"A machine-learning project focused on predicting credit-card default risk. Open the repository for the implementation and project artefacts.",de:"Ein Machine-Learning-Projekt zur Vorhersage von Kreditkartenausfällen. Die Implementierung und Projektdateien findest du im Repository."},
      facts:{en:[["TYPE","Classification project"],["DOMAIN","Credit risk"],["SOURCE","GitHub repository"]],de:[["TYP","Klassifizierungsprojekt"],["BEREICH","Kreditrisiko"],["QUELLE","GitHub-Repository"]]},
      tags:["Machine learning","Classification","Credit risk"],action:{en:"View repository",de:"Repository ansehen"}
    }
  };

  function renderGameDetails(gameId) {
    const game = gameCatalog[gameId];
    if (!game) return;
    document.querySelectorAll("[data-game-select]").forEach((button) => {
      const selected = button.dataset.gameSelect === gameId;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    const fields = {
      "game-detail-title": game.title,
      "game-detail-subtitle": game.subtitle[currentLanguage],
      "game-detail-description": game.description[currentLanguage],
      "game-detail-type": game.type[currentLanguage],
      "game-detail-status": game.status[currentLanguage],
      "game-detail-fact-label-1": game.factLabel1[currentLanguage],
      "game-detail-genre": game.genre[currentLanguage],
      "game-detail-fact-label-2": game.factLabel2[currentLanguage],
      "game-detail-stack": game.stack,
      "game-detail-fact-label-3": game.factLabel3[currentLanguage],
      "game-detail-runs-in": game.runsIn[currentLanguage],
      "game-detail-launch-label": game.action[currentLanguage],
      "game-detail-source-label": game.sourceLabel[currentLanguage]
    };
    Object.entries(fields).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    });
    const art = document.querySelector(".game-detail-art");
    if (art) art.setAttribute("data-game-art", game.art);
    const tags = document.getElementById("game-detail-tags");
    if (tags) {
      tags.replaceChildren();
      game.tags.forEach((tag) => {
        const chip = document.createElement("span");
        chip.textContent = tag;
        tags.appendChild(chip);
      });
    }
    const launchButton = document.querySelector(".game-detail-actions [data-game-play]");
    if (launchButton) launchButton.dataset.gamePlay = gameId;
    const source = document.getElementById("game-detail-source");
    if (source) source.href = game.source;
  }

  document.querySelectorAll("[data-game-select]").forEach((button) => {
    const previewGame = () => renderGameDetails(button.dataset.gameSelect);
    button.addEventListener("pointerenter", previewGame);
    button.addEventListener("focus", previewGame);
  });
  document.querySelectorAll("[data-game-play]").forEach((button) => {
    button.addEventListener("click", () => {
      const gameId = button.dataset.gamePlay;
      renderGameDetails(gameId);
      launchLabApp(gameId);
    });
  });

    function closeLabChild(restoreFocus = true) {
    if (!childWindow || childWindow.hidden) return;
    if (childIsMaximized) setChildMaximized(false);
    childWindow.hidden = true;
    childWindow.classList.remove("is-game-child", "is-map-child", "is-utility-child");
    childWindow.removeAttribute("data-active-app");
    if (appWindow) appWindow.classList.remove("is-child-app-open");
    // Return the child panel to the Tools view before making that view visible again.
    if (childHomeMarker && childHomeMarker.parentNode && childWindow.parentNode !== childHomeMarker.parentNode) {
      childHomeMarker.parentNode.insertBefore(childWindow, childHomeMarker);
    }
    document.querySelectorAll("[data-child-app]").forEach((panel) => { panel.hidden = true; });
    if (shooterFrame) {
      shooterFrame.src = "about:blank";
      shooterFrame.removeAttribute("src");
    }
    if (spatialMapsFrame) {
      spatialMapsFrame.src = "about:blank";
      spatialMapsFrame.removeAttribute("src");
    }
    if (restoreFocus) {
      const opener = currentView === "games"
        ? document.querySelector('[data-game-select="' + selectedLabApp + '"]')
        : document.querySelector('[data-launch-app="' + selectedLabApp + '"]');
      if (opener && typeof opener.focus === "function") opener.focus({ preventScroll: true });
    }
  }

  function setChildMaximized(expanded) {
    if (!appWindow || !childWindow || childWindow.hidden) return;
    childIsMaximized = Boolean(expanded);

    if (!childIsMaximized) {
      appWindow.classList.remove("is-child-maximized");
      document.body.classList.remove("child-app-maximized");
      appWindow.style.removeProperty("top");
      appWindow.style.removeProperty("left");
      appWindow.style.removeProperty("width");
      appWindow.style.removeProperty("height");
      if (childMaximize) {
        childMaximize.setAttribute("aria-pressed", "false");
        childMaximize.setAttribute("aria-label", "Expand app window");
        childMaximize.title = "Expand to workspace";
      }
      return;
    }

    // Measure the central workspace, preserving the website's system header
    // and the left navigation. The window grows only into its own workspace.
    const workspace = appWindow.parentElement;
    const topBar = document.querySelector(".system-bar");
    const rail = document.querySelector(".app-rail");
    const footer = document.querySelector(".desktop-footer");
    const workspaceRect = workspace ? workspace.getBoundingClientRect() : appWindow.getBoundingClientRect();
    const headerRect = topBar ? topBar.getBoundingClientRect() : { bottom: 0 };
    const railRect = rail ? rail.getBoundingClientRect() : null;
    const footerRect = footer ? footer.getBoundingClientRect() : null;
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    // The navigation also becomes a bottom dock on compact landscape screens.
    const compactLandscape = window.innerWidth <= 900 && window.innerHeight <= 520;
    const compactDock = mobile || compactLandscape;
    const edgeGap = compactDock ? 7 : 8;

    const top = Math.max(edgeGap, headerRect.bottom + edgeGap);
    let left;
    let right;
    let bottom;

    if (compactDock) {
      // The compact dock stays visible; the expanded app fits above it.
      left = 7;
      right = window.innerWidth - 7;
      bottom = railRect && railRect.top > top
        ? railRect.top - 8
        : window.innerHeight - 8;
    } else {
      left = Math.max(workspaceRect.left, railRect ? railRect.right + 10 : workspaceRect.left);
      right = Math.max(left + 280, workspaceRect.right);
      bottom = window.innerHeight - 8;
      if (footerRect && footerRect.top > top + 150 && footerRect.top < window.innerHeight) {
        bottom = Math.min(bottom, footerRect.top - 7);
      }
    }

    // In short viewports, retain all the available space rather than forcing
    // the app window's normal desktop min-height on top of the header.
    const width = Math.max(260, Math.min(window.innerWidth - left - 7, right - left));
    const height = Math.max(230, bottom - top);
    appWindow.style.left = left + "px";
    appWindow.style.top = top + "px";
    appWindow.style.width = width + "px";
    appWindow.style.height = height + "px";
    appWindow.classList.add("is-child-maximized");
    document.body.classList.add("child-app-maximized");

    if (childMaximize) {
      childMaximize.setAttribute("aria-pressed", "true");
      childMaximize.setAttribute("aria-label", "Restore app window size");
      childMaximize.title = "Restore window";
    }
  }

    function renderLabApp(appId) {
    const app = appCatalog[appId];
    if (!app) return;
    selectedLabApp = appId;
    document.querySelectorAll(".app-entry[data-app-id]").forEach((row) => {
      const selected = row.dataset.appId === appId;
      row.classList.toggle("is-selected", selected);
      const selectButton = row.querySelector(".app-entry-select");
      if (selectButton) selectButton.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    const rowIcon = document.querySelector('[data-app-id="' + appId + '"] .app-entry-icon');
    if (detailIcon && rowIcon) {
      detailIcon.className = "app-detail-icon " + app.icon;
      detailIcon.innerHTML = rowIcon.innerHTML;
    }
    const language = currentLanguage;
    if (detailType) detailType.textContent = app.type[language];
    if (detailStatus) detailStatus.textContent = app.status[language];
    if (detailTitle) detailTitle.textContent = app.title;
    if (detailSubtitle) detailSubtitle.textContent = app.subtitle[language];
    if (detailDescription) detailDescription.textContent = app.description[language];
    if (detailFacts) {
      detailFacts.replaceChildren();
      app.facts[language].forEach(([label, value]) => {
        const row = document.createElement("div");
        const key = document.createElement("span");
        const valueNode = document.createElement("strong");
        key.textContent = label;
        valueNode.textContent = value;
        row.append(key, valueNode);
        detailFacts.appendChild(row);
      });
    }
    if (detailTags) {
      detailTags.replaceChildren();
      app.tags.forEach((tag) => {
        const node = document.createElement("span");
        node.textContent = tag;
        detailTags.appendChild(node);
      });
    }
    if (detailLaunch) {
      detailLaunch.hidden = !app.playable;
      detailLaunch.dataset.launchApp = appId;
      const label = detailLaunch.querySelector("[data-copy]");
      if (label) label.textContent = app.action[language];
      detailLaunch.setAttribute("aria-label", app.action[language] + ": " + app.title);
    }
    if (detailRepo) {
      detailRepo.href = app.url;
      const label = detailRepo.querySelector("[data-copy]");
      if (label) label.textContent = app.playable
        ? (language === "de" ? "Quellcode ansehen" : "View source")
        : app.action[language];
    }
    if (childTitle) childTitle.textContent = app.title;
    if (childIcon) childIcon.textContent = app.glyph || "⌘";
  }

  function launchLabApp(appId) {
    const app = appCatalog[appId];
    if (!app || !app.playable || !childWindow) return;
    renderLabApp(appId);
    document.querySelectorAll("[data-child-app]").forEach((panel) => {
      panel.hidden = panel.dataset.childApp !== app.child;
    });
    // Move the child out of the split-pane DOM and overlay the entire parent OS window.
    // The outer title bar, list, details and status bar are fully covered while it runs.
    if (appWindow && childWindow.parentNode !== appWindow) appWindow.appendChild(childWindow);
    if (appWindow) appWindow.classList.add("is-child-app-open");
    childWindow.classList.toggle("is-game-child", app.child === "space-shooter");
    childWindow.classList.toggle("is-map-child", app.child === "spatialmaps");
    childWindow.classList.toggle("is-utility-child", app.child !== "space-shooter" && app.child !== "spatialmaps");
    childWindow.dataset.activeApp = appId;
    childWindow.hidden = false;
    if (app.child === "space-shooter" && shooterFrame) {
      const src = shooterFrame.dataset.src;
      if (src && shooterFrame.getAttribute("src") !== src) shooterFrame.src = src;
    }
    if (app.child === "spatialmaps" && spatialMapsFrame) {
      const src = spatialMapsFrame.dataset.src;
      if (src && spatialMapsFrame.getAttribute("src") !== src) spatialMapsFrame.src = src;
    }
    const body = childWindow.querySelector(".lab-child-body");
    if (body) body.scrollTop = 0;
    if (childClose) childClose.focus({ preventScroll: true });
  }

  document.querySelectorAll("[data-select-app]").forEach((button) => {
    button.addEventListener("click", () => renderLabApp(button.dataset.selectApp));
  });
  document.querySelectorAll("[data-launch-app]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      launchLabApp(button.dataset.launchApp);
    });
  });
  if (childClose) childClose.addEventListener("click", () => closeLabChild(true));
  if (childMaximize) {
    childMaximize.addEventListener("click", () => setChildMaximized(!childIsMaximized));
  }
  window.addEventListener("resize", () => {
    if (childIsMaximized && childWindow && !childWindow.hidden) setChildMaximized(true);
  }, { passive: true });

  function railItemForView(name) {
    return document.querySelector('.rail-item[data-open-view="' + name + '"]');
  }

  // The whole app window expands from or collapses into the selected dock icon.
  // A circular reveal plus a fast scale gives the panel a brief "gravity well" effect.
  async function animatePanelSuction(anchor, direction) {
    if (!appWindow || !anchor || reducedMotionQuery.matches || typeof appWindow.animate !== "function") return;
    if (panelAnimation) {
      panelAnimation.cancel();
      panelAnimation = null;
    }

    const panelRect = appWindow.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    if (!panelRect.width || !panelRect.height || !anchorRect.width || !anchorRect.height) return;

    const x = anchorRect.left + anchorRect.width / 2 - panelRect.left;
    const y = anchorRect.top + anchorRect.height / 2 - panelRect.top;
    const corners = [
      Math.hypot(x, y),
      Math.hypot(panelRect.width - x, y),
      Math.hypot(x, panelRect.height - y),
      Math.hypot(panelRect.width - x, panelRect.height - y)
    ];
    const radius = Math.ceil(Math.max.apply(Math, corners) + 24);
    const origin = x + "px " + y + "px";
    const collapsed = {
      transformOrigin: origin,
      transform: "scale(.035)",
      opacity: 0.16,
      filter: "blur(3px)"
    };
    const expanded = {
      transformOrigin: origin,
      transform: "scale(1)",
      opacity: 1,
      filter: "blur(0px)"
    };
    const supportsClip = window.CSS && window.CSS.supports &&
      window.CSS.supports("clip-path", "circle(0px at 0px 0px)");
    if (supportsClip) {
      collapsed.clipPath = "circle(0px at " + x + "px " + y + "px)";
      expanded.clipPath = "circle(" + radius + "px at " + x + "px " + y + "px)";
    }

    const keyframes = direction === "out" ? [collapsed, expanded] : [expanded, collapsed];
    const animation = appWindow.animate(keyframes, {
      duration: direction === "out" ? 220 : 165,
      easing: direction === "out" ? "cubic-bezier(.16,1,.3,1)" : "cubic-bezier(.7,0,.84,0.1)",
      fill: "both"
    });
    panelAnimation = animation;
    try {
      await animation.finished;
    } catch (_) {
      // A newer navigation action intentionally cancels the previous animation.
    }
    if (panelAnimation === animation) panelAnimation = null;
    animation.cancel();
  }

  function applyViewState(name, shouldFocus) {
    currentView = name;
    if (appWindow) {
      appWindow.classList.toggle("is-tools-view", name === "lab");
      appWindow.classList.toggle("is-games-view", name === "games");
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
  }

  function cancelPanelAnimation() {
    if (panelAnimation) {
      panelAnimation.cancel();
      panelAnimation = null;
    }
  }

  function showView(name, shouldFocus) {
    if (!labels.en[name]) return;
    const wasClosed = Boolean(
      (appWindow && appWindow.classList.contains("window-is-closed")) ||
      (desktopShell && desktopShell.classList.contains("window-closed"))
    );
    const anchor = railItemForView(name);
    closePalette(false);

    // Repeated taps on the destination should not restart its reveal.
    if (!wasClosed && transitionTargetView === name) {
      if (shouldFocus && windowBody) windowBody.focus({ preventScroll: true });
      return;
    }

    // A tap back on the currently displayed section cancels an in-flight
    // move before it commits the next view, instead of being ignored.
    if (!wasClosed && transitionTargetView && currentView === name) {
      ++panelTransitionId;
      transitionTargetView = null;
      cancelPanelAnimation();
      if (shouldFocus && windowBody) windowBody.focus({ preventScroll: true });
      return;
    }

    if (!wasClosed && !transitionTargetView && currentView === name) {
      if (shouldFocus && windowBody) windowBody.focus({ preventScroll: true });
      return;
    }

    const transitionId = ++panelTransitionId;
    transitionTargetView = name;

    if (wasClosed) {
      if (currentView === "lab" || currentView === "games") closeLabChild(false);
      applyViewState(name, shouldFocus);
      animatePanelSuction(anchor, "out").then(() => {
        if (transitionId === panelTransitionId && transitionTargetView === name) {
          transitionTargetView = null;
        }
      });
      return;
    }

    // For a view change, pull the existing window into the destination menu
    // icon, switch the panel contents, and expand back out of the same icon.
    animatePanelSuction(anchor, "into").then(() => {
      if (transitionId !== panelTransitionId || transitionTargetView !== name) return;
      if ((currentView === "lab" || currentView === "games") && name !== currentView) closeLabChild(false);
      applyViewState(name, shouldFocus);
      return animatePanelSuction(anchor, "out");
    }).then(() => {
      if (transitionId === panelTransitionId && transitionTargetView === name) {
        transitionTargetView = null;
      }
    });
  }

  document.querySelectorAll("[data-open-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.openView, false));
  });

  // Close the panel by pulling it back into the currently selected dock icon.
  // The wallpaper and navigation remain in place after the window disappears.
  if (windowClose && appWindow && desktopShell) {
    windowClose.addEventListener("click", async () => {
      const transitionId = ++panelTransitionId;
      const opener = railItemForView(currentView);
      transitionTargetView = "__closed__";
      await animatePanelSuction(opener, "into");
      if (transitionId !== panelTransitionId) return;
      transitionTargetView = null;
      closeLabChild(false);
      appWindow.classList.add("window-is-closed");
      appWindow.setAttribute("aria-hidden", "true");
      desktopShell.classList.add("window-closed");
      document.querySelectorAll(".rail-item[data-open-view]").forEach((item) => {
        item.classList.remove("is-active");
        item.removeAttribute("aria-current");
      });
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
    renderLabApp(selectedLabApp);
    const selectedGame = document.querySelector(".game-library-item.is-selected");
    if (selectedGame) renderGameDetails(selectedGame.dataset.gameSelect);
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
  // Local clock, current Berlin weather and footer year.
  // Weather is served by Open-Meteo (CC BY 4.0; linked in the top bar).
  // ---------------------------------------------------------
  const clock = document.getElementById("system-clock");
  const weather = document.getElementById("system-weather");
  const weatherIcon = document.getElementById("system-weather-icon");
  const weatherTemp = document.getElementById("system-weather-temp");
  const year = document.getElementById("year-now");

  function weatherPresentation(code, isDay) {
    if (code === 0) return { icon: isDay ? "☀" : "☾", label: isDay ? "Clear sky" : "Clear night", className: "is-clear" };
    if (code === 1) return { icon: isDay ? "☀" : "☾", label: "Mainly clear", className: "is-clear" };
    if (code === 2) return { icon: isDay ? "◐" : "☾", label: "Partly cloudy", className: "is-cloudy" };
    if (code === 3) return { icon: "☁", label: "Overcast", className: "is-cloudy" };
    if (code === 45 || code === 48) return { icon: "≋", label: "Fog", className: "is-foggy" };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { icon: "☂", label: "Rain or drizzle", className: "is-rainy" };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: "❄", label: "Snow", className: "is-snowy" };
    if (code === 95 || code === 96 || code === 99) return { icon: "ϟ", label: "Thunderstorm", className: "is-stormy" };
    return { icon: "☁", label: "Current conditions", className: "is-cloudy" };
  }

  async function updateWeather() {
    if (!weather || !weatherIcon || !weatherTemp) return;
    try {
      const response = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.405&current=temperature_2m,weather_code,is_day&timezone=Europe%2FBerlin",
        { cache: "no-store", signal: AbortSignal.timeout(8000) }
      );
      if (!response.ok) throw new Error("Weather request failed");
      const data = await response.json();
      const current = data.current || {};
      const temperature = Number(current.temperature_2m);
      const code = Number(current.weather_code ?? current.weathercode);
      const isDay = Number(current.is_day) !== 0;
      if (!Number.isFinite(temperature) || !Number.isFinite(code)) throw new Error("Weather response was incomplete");

      const condition = weatherPresentation(code, isDay);
      const roundedTemperature = Math.round(temperature);
      weatherIcon.textContent = condition.icon;
      weatherIcon.className = "system-weather-icon " + condition.className;
      weatherTemp.textContent = roundedTemperature + "°";
      const description = "Current weather in Berlin, Germany: " + condition.label + ", " + roundedTemperature + "°C. Weather data by Open-Meteo.com.";
      weather.title = description;
      weather.setAttribute("aria-label", description);
    } catch (_) {
      weatherIcon.textContent = "·";
      weatherIcon.className = "system-weather-icon is-cloudy";
      weatherTemp.textContent = "--°";
      weather.title = "Weather is currently unavailable. Weather data by Open-Meteo.com.";
      weather.setAttribute("aria-label", "Current weather in Berlin is unavailable. Weather data by Open-Meteo.com.");
    }
  }

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
  updateWeather();
  window.setInterval(updateWeather, 15 * 60 * 1000);

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
    if (event.key === "Escape" && childWindow && !childWindow.hidden) {
      closeLabChild(true);
      return;
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
  renderLabApp(selectedLabApp);
  renderGameDetails("space-shooter");

})();