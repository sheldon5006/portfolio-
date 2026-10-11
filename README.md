# Sheldon Dsouza — Portfolio

A personal portfolio built with **Flask, HTML, custom CSS, and vanilla JavaScript**.

The redesign lives on the `redesign/stellar-ios-portfolio` branch. It keeps the existing Flask app and endpoints while introducing a space-inspired, iOS-influenced desktop workspace.

## Experience

- **Interactive cosmos:** a responsive starfield with constellation connections and a pointer-tracking black hole. Nearby stars are gently deflected by a spring-damped, gravity-inspired simulation.
- **Glass app workspace:** a responsive navigation rail and app-style content window for the profile, projects, social links, CV and lab demos.
- **English / German:** switch between English and German content from the system bar.
- **Quick open:** press `Ctrl+K` or `Cmd+K` to jump to portfolio sections.
- **OS-style close:** close the active window to reveal the unobstructed starfield wallpaper; use the left dock or Quick Open to launch another view.
- **Live utilities:** the `asciibar` and `emojify` demos use the existing Flask API routes.
- **Reduced motion:** background movement and UI transitions respect `prefers-reduced-motion`.
- **Responsive layout:** desktop workspace becomes a compact navigation dock on smaller screens.

## Run locally

\`\`\`bash
pip install -r requirements.txt
python app.py
\`\`\`

Then open **http://127.0.0.1:5000**.

## Main structure

\`\`\`
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
\`\`\`

## Existing routes

- \`/resume\` — downloadable CV PDF.
- \`/api/asciibar\` — render comma-separated numbers as terminal bars.
- \`/api/emojify\` — replace supported emoji shortcodes.
- \`/api/contact\` — contact form endpoint.

## Contact form configuration

The contact route uses Resend. Configure these server-side environment variables before relying on contact form delivery:

- \`RESEND_API_KEY\`
- \`CONTACT_RECEIVER_EMAIL\`

Never add API keys to frontend JavaScript or commit secrets to the repository.
