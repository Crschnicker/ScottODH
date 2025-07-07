# backend/models/bid.py

from datetime import datetime
from .base import db

class Bid(db.Model):
    __tablename__ = 'bids' # Explicit table name

    id = db.Column(db.Integer, primary_key=True)
    estimate_id = db.Column(db.Integer, db.ForeignKey('estimates.id'), nullable=False)
    status = db.Column(db.String(20), default='draft')
    total_cost = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    doors = db.relationship('Door', backref='bid', lazy='dynamic', cascade="all, delete-orphan")
    estimate = db.relationship('Estimate', backref=db.backref('bid', uselist=False))