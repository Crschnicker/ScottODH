# backend/models/line_item.py

from .base import db

class LineItem(db.Model):
    __tablename__ = 'line_items' # Explicit table name

    id = db.Column(db.Integer, primary_key=True)
    door_id = db.Column(db.Integer, db.ForeignKey('doors.id'), nullable=False)
    part_number = db.Column(db.String(50))
    description = db.Column(db.String(200))
    quantity = db.Column(db.Integer, default=1)
    price = db.Column(db.Float, default=0.0)
    labor_hours = db.Column(db.Float, default=0.0)
    hardware = db.Column(db.Float, default=0.0)

    # Relationship back to mobile completion status
    mobile_completions = db.relationship('MobileJobLineItem', backref='line_item', lazy='dynamic')