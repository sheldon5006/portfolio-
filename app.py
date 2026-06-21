from flask import Flask, render_template, request, jsonify, send_from_directory

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
    """Stub contact endpoint — logs the message. Wire up real email later."""
    data = request.json or {}
    print(f"[contact form] {data.get('name')} <{data.get('email')}>: {data.get('message')}")
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True)
