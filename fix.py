from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
import sys

# Import your app or create a minimal version
# If you can import your existing app:
# from app import app, db

# If you need to recreate the app connection:
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///scott_overhead_doors.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

def fix_door_location():
    with app.app_context():
        print("Starting database update...")
        
        # First check if column exists
        try:
            # Try to execute a query that uses the column
            result = db.session.execute(text("SELECT location FROM door LIMIT 1"))
            print("Column 'location' already exists in the door table")
        except Exception as e:
            # Column doesn't exist, so add it
            print("Column 'location' doesn't exist. Adding it...")
            db.session.execute(text("ALTER TABLE door ADD COLUMN location TEXT"))
            db.session.commit()
            print("Column added successfully!")
        
        # Now update all existing records to set location to "Fill"
        result = db.session.execute(text("UPDATE door SET location = 'Fill' WHERE location IS NULL OR location = ''"))
        db.session.commit()
        rows_affected = result.rowcount if hasattr(result, 'rowcount') else -1
        print(f"Updated {rows_affected} door records to have 'Fill' location value")
        
        print("Database update completed successfully!")

if __name__ == "__main__":
    fix_door_location()