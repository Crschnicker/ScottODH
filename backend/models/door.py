 # backend/models/door.py

from datetime import datetime
from .base import db

class Door(db.Model):
    __tablename__ = 'doors'  # Explicit table name

    id = db.Column(db.Integer, primary_key=True)
    bid_id = db.Column(db.Integer, db.ForeignKey('bids.id'), nullable=False)
    door_number = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Rich door information fields
    location = db.Column(db.String(200), nullable=True)
    door_type = db.Column(db.String(50), nullable=True)
    width = db.Column(db.Float, nullable=True)
    height = db.Column(db.Float, nullable=True)
    dimension_unit = db.Column(db.String(10), nullable=True)
    labor_description = db.Column(db.Text, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    # Relationships
    line_items = db.relationship('LineItem', backref='door', lazy='dynamic', cascade="all, delete-orphan")
    media = db.relationship('DoorMedia', backref='door', lazy='dynamic', cascade="all, delete-orphan")
    signatures = db.relationship('JobSignature', backref='door', lazy='dynamic', cascade="all, delete-orphan")