from flask import Blueprint, render_template, request, jsonify, send_from_directory
import requests
import os

# Blueprint is like a mini app - groups related routes together
portfolio_bp = Blueprint("portfolio", __name__)

EMOJI_MAP = {
    "fire": "🔥", "smile": "😄", "heart": "❤️", "rocket": "🚀",
    "tada": "🎉", "wave": "👋", "star": "⭐", "bug": "🐛",
    "check": "✅", "brain": "🧠",
}

@portfolio_bp.route("/")
def index():
    return render_template("index.html")

@portfolio_bp.route("/resume")
def resume():
    return send_from_directory("static/resume", "Sheldon_DSouza_CV.pdf", as_attachment=True)

@portfolio_bp.route("/api/asciibar", methods=["POST"])
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

@portfolio_bp.route("/api/emojify", methods=["POST"])
def api_emojify():
    """Powers the live emojify demo in the Projects section."""
    text = request.json.get("text", "")
    for word, emoji in EMOJI_MAP.items():
        text = text.replace(f":{word}:", emoji)
    return jsonify({"result": text, "words": list(EMOJI_MAP.keys())})

@portfolio_bp.route("/api/contact", methods=["POST"])
def api_contact():
    """Sends the contact form submission via Resend API."""
    data = request.json or {}
    name = data.get("name", "").strip()
    sender_email = data.get("email", "").strip()
    message_body = data.get("message", "").strip()

    if not name or not sender_email or not message_body:
        return jsonify({"ok": False, "error": "All fields are required."}), 400

    resend_api_key = os.environ.get("RESEND_API_KEY")
    your_email = os.environ.get("CONTACT_RECEIVER_EMAIL")

    if not resend_api_key or not your_email:
        return jsonify({"ok": False, "error": "Email is not configured yet."}), 500

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {resend_api_key}"},
            json={
                "from": "Portfolio Contact Form <onboarding@resend.dev>",
                "to": [your_email],
                "reply_to": sender_email,
                "subject": f"Portfolio contact form: {name}",
                "text": f"From: {name} <{sender_email}>\n\n{message_body}",
            },
            timeout=10,
        )
        if response.status_code >= 400:
            return jsonify({"ok": False, "error": "Couldn't send the message right now."}), 500
        return jsonify({"ok": True})
    except Exception as e:
        print(f"[contact] Failed: {e}")
        return jsonify({"ok": False, "error": "Couldn't send the message right now."}), 500