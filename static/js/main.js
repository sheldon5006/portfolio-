// =====================================================
// Language toggle: EN / DE
// =====================================================
let en, de;

async function initLanguage() {
  en = await fetch("/static/i18n/en.json").then((r) => r.json());
  de = await fetch("/static/i18n/de.json").then((r) => r.json());

  const saved = localStorage.getItem("lang") || "en";
  setLanguage(saved);
}

function setLanguage(lang) {
  const dict = lang === "de" ? de : en;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) el.placeholder = dict[key];
  });

  document.documentElement.lang = lang;
  localStorage.setItem("lang", lang);

  const slider = document.getElementById("lang-slider");
  const enBtns = [document.getElementById("lang-en"), document.getElementById("lang-en-mobile")];
  const deBtns = [document.getElementById("lang-de"), document.getElementById("lang-de-mobile")];

  if (lang === "de") {
    if (slider) {
      slider.style.transform = "translateX(100%)";
      slider.classList.add("is-de");
    }
    deBtns.forEach((b) => b && b.classList.add("active"));
    enBtns.forEach((b) => b && b.classList.remove("active"));
  } else {
    if (slider) {
      slider.style.transform = "translateX(0)";
      slider.classList.remove("is-de");
    }
    enBtns.forEach((b) => b && b.classList.add("active"));
    deBtns.forEach((b) => b && b.classList.remove("active"));
  }
}

["lang-en", "lang-en-mobile"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", () => setLanguage("en"));
});
["lang-de", "lang-de-mobile"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", () => setLanguage("de"));
});

initLanguage();

// =====================================================
// Ambient hero canvas — vertical bars that breathe gently
// and drift toward the mouse. A quiet nod to the asciibar
// project: the whole site's "atmosphere" is made of bars.
// =====================================================
(function ambientBars() {
  const canvas = document.getElementById("ambient-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w, h, bars = [];
  let mouseX = 0.5;

  function resize() {
    w = canvas.width = canvas.offsetWidth * devicePixelRatio;
    h = canvas.height = canvas.offsetHeight * devicePixelRatio;
    const count = Math.floor(canvas.offsetWidth / 26);
    bars = Array.from({ length: count }, (_, i) => ({
      x: (i + 0.5) * (w / count),
      baseHeight: 0.15 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.5,
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    bars.forEach((bar, i) => {
      const wobble = Math.sin(t * 0.0006 * bar.speed + bar.phase) * 0.12;
      const distFromMouse = Math.abs(bar.x / w - mouseX);
      const lift = Math.max(0, 0.18 - distFromMouse) * 1.4;
      const heightRatio = Math.min(0.85, bar.baseHeight + wobble + lift);
      const barH = heightRatio * h;
      const grad = ctx.createLinearGradient(0, h, 0, h - barH);
      grad.addColorStop(0, "rgba(91,141,239,0.05)");
      grad.addColorStop(1, "rgba(139,124,246,0.55)");
      ctx.fillStyle = grad;
      const barW = (w / bars.length) * 0.4;
      ctx.fillRect(bar.x - barW / 2, h - barH, barW, barH);
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (e) => {
    mouseX = e.clientX / window.innerWidth;
  });
  resize();
  requestAnimationFrame(draw);
})();

// =====================================================
// Magnetic hover — buttons subtly track the cursor
// =====================================================
document.querySelectorAll(".magnetic").forEach((el) => {
  el.addEventListener("mousemove", (e) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--mx", `${x}px`);
    el.style.setProperty("--my", `${y}px`);
    el.style.transform = `translate(${(x / rect.width - 0.5) * 6}px, ${(y / rect.height - 0.5) * 6}px)`;
  });
  el.addEventListener("mouseleave", () => {
    el.style.transform = "translate(0, 0)";
  });
});

// =====================================================
// Scroll reveal via IntersectionObserver
// =====================================================
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal, .skill-fill").forEach((el) => revealObserver.observe(el));

// =====================================================
// Mobile nav toggle
// =====================================================
const navToggle = document.getElementById("nav-toggle");
const mobileMenu = document.getElementById("mobile-menu");
if (navToggle && mobileMenu) {
  navToggle.addEventListener("click", () => {
    mobileMenu.classList.toggle("hidden");
  });
  mobileMenu.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", () => mobileMenu.classList.add("hidden"))
  );
}

// =====================================================
// Sticky nav background on scroll
// =====================================================
const nav = document.getElementById("site-nav");
window.addEventListener("scroll", () => {
  if (window.scrollY > 40) {
    nav.classList.add("bg-[#0D0E10]/80", "backdrop-blur-lg", "border-white/10");
  } else {
    nav.classList.remove("bg-[#0D0E10]/80", "backdrop-blur-lg", "border-white/10");
  }
});

// =====================================================
// Live demo: asciibar
// =====================================================
const barForm = document.getElementById("asciibar-form");
if (barForm) {
  barForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("asciibar-input");
    const output = document.getElementById("asciibar-output");
    output.textContent = "running…";
    try {
      const res = await fetch("/api/asciibar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: input.value }),
      });
      const data = await res.json();
      output.textContent = data.result || data.error;
    } catch {
      output.textContent = "Something went wrong. Try again.";
    }
  });
}

// =====================================================
// Live demo: emojify
// =====================================================
const emojiForm = document.getElementById("emojify-form");
if (emojiForm) {
  emojiForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("emojify-input");
    const output = document.getElementById("emojify-output");
    output.textContent = "running…";
    try {
      const res = await fetch("/api/emojify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.value }),
      });
      const data = await res.json();
      output.textContent = data.result;
    } catch {
      output.textContent = "Something went wrong. Try again.";
    }
  });
}

// =====================================================
// Contact form
// =====================================================
const contactForm = document.getElementById("contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = document.getElementById("contact-status");
    const payload = {
      name: document.getElementById("contact-name").value,
      email: document.getElementById("contact-email").value,
      message: document.getElementById("contact-message").value,
    };
    status.textContent = "Sending…";
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      status.textContent = "Message sent — thank you. I'll get back to you soon.";
      contactForm.reset();
    } catch {
      status.textContent = "Couldn't send right now — please email me directly instead.";
    }
  });
}
