# Sheldon D Souza — Portfolio

A premium, single-page portfolio built with **Flask + Tailwind CSS**.

## Run it locally

```bash
pip install -r requirements.txt
python app.py
```

Then open **http://127.0.0.1:5000**

## Structure

```
portfolio/
├── app.py                  <- Flask app: routes + tiny demo APIs
├── requirements.txt
├── templates/
│   └── index.html           <- the whole single-page site
└── static/
    ├── css/style.css        <- custom animations/effects beyond Tailwind
    ├── js/main.js            <- ambient canvas, magnetic buttons, scroll reveals, demo calls
    ├── images/profile.png
    └── resume/Sheldon_DSouza_CV.pdf
```

## What's editable

- **Content** — all text lives directly in `templates/index.html`, grouped by section
  (Hero, About, Skills, Experience, Projects, Education, Contact).
- **Colors / fonts** — defined once in the `tailwind.config` block at the top of `index.html`.
- **Animations** — in `static/css/style.css` (keyframes) and `static/js/main.js` (canvas + interactions).

## Notes

- The contact form currently logs submissions to the console (`/api/contact`).
  Wire it up to a real email service (e.g. SendGrid, SMTP) before going live.
- The `asciibar` and `emojify` demos run real Python logic server-side via
  `/api/asciibar` and `/api/emojify` — when the standalone PyPI packages are
  ready, swap the inline logic in `app.py` for the real imports.
