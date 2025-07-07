# backend/models/estimate.py

from datetime import datetime
from .base import db

class Estimate(db.Model):
    __tablename__ = 'estimates'

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    site_id = db.Column(db.Integer, db.ForeignKey('sites.id'), nullable=False)
    
    # ==========================================================
    # === ALL MISSING FIELDS ADDED HERE ===
    # ==========================================================
    title = db.Column(db.String(200), nullable=True)
    description = db.Column(db.Text, nullable=True)
    reference_number = db.Column(db.String(50), nullable=True)
    estimated_hours = db.Column(db.Float, nullable=True)
    estimated_cost = db.Column(db.Float, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    estimator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    estimator_name = db.Column(db.String(100), nullable=True)
    duration = db.Column(db.Integer, nullable=True) # Duration in minutes
    schedule_notes = db.Column(db.Text, nullable=True)
    # ==========================================================
    
    status = db.Column(db.String(20), default='pending')
    doors_data = db.Column(db.Text, nullable=True)
    scheduled_date = db.Column(db.DateTime, nullable=True) # Changed to DateTime for consistency
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    customer_direct_link = db.relationship('Customer', backref='estimates')
    site = db.relationship('Site', backref='estimates')
    estimator = db.relationship('User')

    def to_dict(self):
        """Serializes the Estimate object to a dictionary."""
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'site_id': self.site_id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'created_at': self.created_at.isoformat(),
            'customer_name': self.customer_direct_link.name if self.customer_direct_link else None,
            'site_address': self.site.address if self.site else None,
        }