from flask import Blueprint, request, jsonify
import database

# another mini app just for game routes
game_bp = Blueprint("game", __name__)

@game_bp.route("/api/leaderboard")
def leaderboard():
    """Return top 5 scores and latest comment."""
    top_scores = database.get_top_scores(5)
    comment = database.get_latest_comment()
    return jsonify({
        "top_scores": top_scores,
        "last_comment": comment
    })

@game_bp.route("/api/save_score", methods=["POST"])
def save_score():
    """Save a finished game score. Returns the score id."""
    data = request.get_json()
    username = data.get("username", "Anonymous").strip() or "Anonymous"
    score = int(data.get("score", 0))
    score_id = database.save_score(username, score)
    return jsonify({"status": "ok", "score_id": score_id})

@game_bp.route("/api/save_comment", methods=["POST"])
def save_comment():
    """Attach a comment to a score row."""
    data = request.get_json()
    score_id = data.get("score_id")
    comment = data.get("comment", "").strip()
    if score_id and comment:
        database.save_comment(score_id, comment)
    return jsonify({"status": "ok"})