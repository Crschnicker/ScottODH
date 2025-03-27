
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

# Add AudioRecording model - keep all other existing models

class AudioRecording(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    estimate_id = db.Column(db.Integer, db.ForeignKey('estimate.id'), nullable=False)
    file_path = db.Column(db.String(200), nullable=False)
    transcript = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Add relationship to Estimate
    estimate = db.relationship('Estimate', backref='audio_recordings', lazy=True)

# Add new fields to LineItem model
class LineItem(db.Model):
    # Existing fields remain 
    description = db.Column(db.String(200))  # Updated field
