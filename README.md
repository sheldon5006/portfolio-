# Sheldon Dsouza — Portfolio

A personal portfolio built with **Flask, HTML, custom CSS, and vanilla JavaScript**.

The site uses the existing Flask app and endpoints, with a space-inspired desktop workspace and an interactive application browser.

## Experience

- **Interactive cosmos:** a dense, responsive starfield with twinkling stars, a pointer-tracking black hole and gravitational-lensing-inspired star distortion.
- **Glass app workspace:** a responsive navigation rail and app-style content window for the profile, projects, social links, CV and lab demos.
- **English / German:** switch between English and German content from the system bar.
- **Quick open:** press `Ctrl+K` or `Cmd+K` to jump to portfolio sections.
- **OS-style close:** close the active window to reveal the unobstructed starfield wallpaper; use the left dock or Quick Open to launch another view.
- **Application browser:** Tools and Games use fixed Explorer-style split panes with independently scrollable lists and details. Tools launches local utilities and hosted apps; Games Explorer includes Space Shooter, SpatialMaps, asciibar, and emojify, with previews and click-to-launch child windows.
- **Berlin weather:** current conditions and temperature appear beside the system clock, refreshed every 15 minutes using Open-Meteo. The small attribution link keeps the provider credit available without a text label.
- **Reduced motion:** background movement and UI transitions respect `prefers-reduced-motion`.
- **Responsive layout:** desktop workspace becomes a compact navigation dock on smaller screens.

## Run locally

```bash
pip install -r requirements.txt
python app.py
```

Then open **http://127.0.0.1:5000**.

## Main structure

```
portfolio/
├── app.py
├── database.py
├── routes/
│   ├── portfolio.py
│   └── shootergame.py
├── templates/
│   └── index.html
└── static/
    ├── css/style.css
    ├── js/main.js
    ├── images/
    └── resume/Sheldon_DSouza_CV.pdf
```

## Existing routes

- `/resume` — downloadable CV PDF.
- `/api/asciibar` — render comma-separated numbers as terminal bars.
- `/api/emojify` — replace supported emoji shortcodes.
- `/api/contact` — contact form endpoint.

## Contact form configuration

The contact route uses Resend. Configure these server-side environment variables before relying on contact form delivery:

- `RESEND_API_KEY`
- `CONTACT_RECEIVER_EMAIL`

Never add API keys to frontend JavaScript or commit secrets to the repository.
