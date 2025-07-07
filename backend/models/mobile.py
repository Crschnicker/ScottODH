# backend/models/mobile.py
from datetime import datetime
from .base import db

class DoorMedia(db.Model):
    """Store media files for door completions"""
    id = db.Column(db.Integer, primary_key=True)
    door_id = db.Column(db.Integer, db.ForeignKey('door.id'), nullable=False)
    job_id = db.Column(db.Integer, db.ForeignKey('job.id'), nullable=False)
    media_type = db.Column(db.String(10), nullable=False)  # photo, video
    file_path = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer, nullable=True)
    mime_type = db.Column(db.String(50), nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    door = db.relationship('Door', backref=db.backref('media', lazy=True))
    job = db.relationship('Job', backref=db.backref('door_media', lazy=True))

class MobileJobLineItem(db.Model):
    """Track line item completion status for mobile workers"""
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('job.id'), nullable=False)
    line_item_id = db.Column(db.Integer, db.ForeignKey('line_item.id'), nullable=False)
    completed = db.Column(db.Boolean, default=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    completed_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    # Relationships
    job = db.relationship('Job', backref=db.backref('mobile_line_items', lazy=True))
    line_item = db.relationship('LineItem', backref=db.backref('mobile_completions', lazy=True))
    user = db.relationship('User', backref=db.backref('completed_items', lazy=True))