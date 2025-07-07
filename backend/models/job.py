# backend/models/job.py

from datetime import datetime
from .base import db

class Job(db.Model):
    __tablename__ = 'jobs'

    id = db.Column(db.Integer, primary_key=True)
    job_number = db.Column(db.String(10), unique=True)
    bid_id = db.Column(db.Integer, db.ForeignKey('bids.id'), nullable=False)
    status = db.Column(db.String(20), default='unscheduled')
    scheduled_date = db.Column(db.Date, nullable=True)
    truck_assignment = db.Column(db.String(100), nullable=True)
    material_ready = db.Column(db.Boolean, default=False)
    material_location = db.Column(db.String(1))
    region = db.Column(db.String(2))
    job_scope = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # === ADD THESE TWO LINES ===
    is_visible = db.Column(db.Boolean, default=False, nullable=False)
    job_order = db.Column(db.Integer, default=0)
    # ===========================

    # Relationships
    bid = db.relationship('Bid', backref=db.backref('job', uselist=False))
    # You can likely remove the DispatchAssignment model if you are storing assignment info directly on the job
    dispatch_assignments = db.relationship('DispatchAssignment', backref='job', cascade="all, delete-orphan")
    media = db.relationship('DoorMedia', backref='job', lazy='dynamic', cascade="all, delete-orphan")
    signatures = db.relationship('JobSignature', backref='job', lazy='dynamic', cascade="all, delete-orphan")
    time_tracking = db.relationship('JobTimeTracking', backref='job', lazy='dynamic', cascade="all, delete-orphan")
    mobile_line_items = db.relationship('MobileJobLineItem', backref='job', lazy='dynamic', cascade="all, delete-orphan")

# =========================================================================
# === ADD THIS CLASS DEFINITION BACK INTO THE FILE ===
# =========================================================================
class CompletedDoor(db.Model):
    __tablename__ = 'completed_doors'

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    door_id = db.Column(db.Integer, db.ForeignKey('doors.id'), nullable=False)
    signature = db.Column(db.Text) 
    photo_path = db.Column(db.String(200))
    video_path = db.Column(db.String(200))
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)
# =========================================================================

class JobTimeTracking(db.Model):
    __tablename__ = 'job_time_tracking'

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=True)
    total_minutes = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('time_entries', lazy=True))


class JobSignature(db.Model):
    __tablename__ = 'job_signatures'

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    door_id = db.Column(db.Integer, db.ForeignKey('doors.id'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    signature_type = db.Column(db.String(50), nullable=False)
    signature_data = db.Column(db.Text, nullable=False)
    signer_name = db.Column(db.String(100), nullable=True)
    signer_title = db.Column(db.String(100), nullable=True)
    signed_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('job_signatures', lazy=True))


class DispatchAssignment(db.Model):
    __tablename__ = 'dispatch_assignments'

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    assignment_date = db.Column(db.Date, nullable=False)
    truck_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    job_order = db.Column(db.Integer, nullable=False)
    
    # ========================================================
    # === ADD THIS LINE TO YOUR MODEL ===
    # ========================================================
    is_visible = db.Column(db.Boolean, default=True, nullable=False)
    # ========================================================
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    truck = db.relationship('User')
    __table_args__ = (db.UniqueConstraint('job_id', 'assignment_date', name='_job_date_uc'),)

class MobileJobLineItem(db.Model):
    __tablename__ = 'mobile_job_line_items'

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    line_item_id = db.Column(db.Integer, db.ForeignKey('line_items.id'), nullable=False)
    completed = db.Column(db.Boolean, default=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    completed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    user = db.relationship('User', backref=db.backref('completed_items', lazy=True))