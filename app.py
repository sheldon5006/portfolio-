from flask import Flask
from flask_cors import CORS
import database
from routes.portfolio import portfolio_bp
from routes.shootergame import game_bp

# create the app
app = Flask(__name__)

# allow Angular (localhost:4200) to call this Flask app
CORS(app)

# create the scores table if it doesn't exist
database.init_db()

# register all routes
app.register_blueprint(portfolio_bp)
app.register_blueprint(game_bp)

if __name__ == "__main__":
    app.run(debug=True)
