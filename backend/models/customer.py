# backend/models/customer.py

from .base import db
from datetime import datetime

class Customer(db.Model):
    __tablename__ = 'customers'  # Explicitly define the table name as plural

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    contact_name = db.Column(db.String(100))
    email = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    address = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sites = db.relationship('Site', backref='customer', lazy='dynamic', cascade="all, delete-orphan")

class Site(db.Model):
    __tablename__ = 'sites'  # Explicitly define the table name as plural

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False) # Points to 'customers' table
    name = db.Column(db.String(100))
    address = db.Column(db.String(200), nullable=False)
    contact_name = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    lockbox_location = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)