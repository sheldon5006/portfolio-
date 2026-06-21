from flask import Flask, render_template, request, jsonify, send_from_directory
import smtplib
import os
from email.mime.text import MIMEText

app = Flask(__name__)

EMOJI_MAP = {
    "fire": "🔥", "smile": "😄", "heart": "❤️", "rocket": "🚀",
    "tada": "🎉", "wave": "👋", "star": "⭐", "bug": "🐛",
    "check": "✅", "brain": "🧠",
}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/resume")
def resume():
    return send_from_directory("static/resume", "Sheldon_DSouza_CV.pdf", as_attachment=True)


@app.route("/api/asciibar", methods=["POST"])
def api_asciibar():
    """Powers the live asciibar demo in the Projects section."""
    raw = request.json.get("numbers", "")
    try:
        numbers = [int(x.strip()) for x in raw.split(",") if x.strip()][:10]
        if not numbers:
            return jsonify({"error": "Enter at least one number."})
        lines = [f"{n:>3} │ " + "█" * min(n, 40) for n in numbers]
        return jsonify({"result": "\n".join(lines)})
    except ValueError:
        return jsonify({"error": "Numbers only, separated by commas."})


@app.route("/api/emojify", methods=["POST"])
def api_emojify():
    """Powers the live emojify demo in the Projects section."""
    text = request.json.get("text", "")
    for word, emoji in EMOJI_MAP.items():
        text = text.replace(f":{word}:", emoji)
    return jsonify({"result": text, "words": list(EMOJI_MAP.keys())})


@app.route("/api/contact", methods=["POST"])
def api_contact():
    """Sends the contact form submission to your Gmail via SMTP."""
    data = request.json or {}
    name = data.get("name", "").strip()
    sender_email = data.get("email", "").strip()
    message_body = data.get("message", "").strip()

    if not name or not sender_email or not message_body:
        return jsonify({"ok": False, "error": "All fields are required."}), 400

    gmail_user = os.environ.get("GMAIL_USER")
    gmail_app_password = os.environ.get("GMAIL_APP_PASSWORD")

    if not gmail_user or not gmail_app_password:
        print("[contact] Missing GMAIL_USER / GMAIL_APP_PASSWORD env vars.")
        return jsonify({"ok": False, "error": "Email is not configured yet."}), 500

    msg = MIMEText(f"From: {name} <{sender_email}>\n\n{message_body}")
    msg["Subject"] = f"Portfolio contact form: {name}"
    msg["From"] = gmail_user
    msg["To"] = gmail_user
    msg["Reply-To"] = sender_email

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_user, gmail_app_password)
            server.sendmail(gmail_user, gmail_user, msg.as_string())
        return jsonify({"ok": True})
    except Exception as e:
        print(f"[contact] Failed to send email: {e}")
        return jsonify({"ok": False, "error": "Couldn't send the message right now."}), 500


if __name__ == "__main__":
    app.run(debug=True)