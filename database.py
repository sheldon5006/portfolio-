import sqlite3

DB_NAME = "score.db"

def get_connection():
    """Open a connection to the SQLite database."""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row  # lets us access columns by name
    return conn

def init_db():
    """Create the scores table if it does not exist yet."""
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            score INTEGER NOT NULL,
            last_comment TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def save_score(username, score):
    """Insert a new score. Returns the new row id."""
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO scores (username, score) VALUES (?, ?)",
        (username, score)
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id

def save_comment(score_id, comment):
    """Attach a comment to a score row."""
    conn = get_connection()
    conn.execute(
        "UPDATE scores SET last_comment = ? WHERE id = ?",
        (comment, score_id)
    )
    conn.commit()
    conn.close()

def get_top_scores(limit=5):
    """Return top N scores highest first."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT username, score FROM scores ORDER BY score DESC LIMIT ?",
        (limit,)
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_latest_comment():
    """Return the most recent non-empty comment."""
    conn = get_connection()
    row = conn.execute(
        """SELECT last_comment FROM scores
           WHERE last_comment IS NOT NULL AND last_comment != ''
           ORDER BY created_at DESC LIMIT 1"""
    ).fetchone()
    conn.close()
    return row["last_comment"] if row else None