# backend/models/door_media.py

from datetime import datetime
from .base import db

class DoorMedia(db.Model):
    __tablename__ = 'door_media' # Explicit table name

    id = db.Column(db.Integer, primary_key=True)
    door_id = db.Column(db.Integer, db.ForeignKey('doors.id'), nullable=False)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    media_type = db.Column(db.String(10), nullable=False)  # 'photo', 'video'
    file_path = db.Column(db.String(512), nullable=False)
    thumbnail_path = db.Column(db.String(512), nullable=True) # Essential for thumbnails
    file_size = db.Column(db.Integer, nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    # Relationships
    uploader = db.relationship('User')