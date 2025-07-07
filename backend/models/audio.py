# backend/models/audio.py

from .base import db
from datetime import datetime

class AudioRecording(db.Model):
    __tablename__ = 'audio_recordings'

    id = db.Column(db.Integer, primary_key=True)
    estimate_id = db.Column(db.Integer, db.ForeignKey('estimates.id'), nullable=False)
    file_path = db.Column(db.String(512), nullable=False)
    transcript = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship back to the estimate
    estimate = db.relationship('Estimate', backref=db.backref('audio_recordings', lazy='dynamic', cascade="all, delete-orphan"))