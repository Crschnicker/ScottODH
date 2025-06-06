from flask import Flask, request, jsonify, render_template, send_from_directory, make_response, Blueprint
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime, date, timezone
import os
import uuid
import json
import calendar
import re # Added for process_audio
import pytz
from flask_migrate import Migrate

# For AI functionalities
from openai import OpenAI

# For PDF generation
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from config import Config
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from functools import wraps
import jwt
from datetime import timedelta

import logging


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('date_handling')
file_handler = logging.FileHandler('date_handling.log')
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)


# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)

SERVER_TIMEZONE = pytz.timezone('America/Los_Angeles')  # Adjust as needed
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Configure database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///scott_overhead_doors.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['TIMEZONE'] = 'America/Los_Angeles'  # Or your local timezone
db = SQLAlchemy(app)

CORS(app, 
     origins=[
         "http://localhost:3000",      # React development server
         "http://127.0.0.1:3000",     # Alternative localhost
         "https://*.ngrok.io",         # Ngrok tunnels (wildcard)
         "https://scottohd-api.ngrok.io"  # Your specific ngrok URL
     ],
     allow_headers=[
         "Content-Type",
         "Accept", 
         "Authorization",
         "Cache-Control",
         "X-Request-ID",               # Custom header causing CORS issues
         "X-Retry-Attempt",           # Custom header from retry logic
         "X-Client-Timestamp",        # Custom header with timestamps
         "X-Ngrok-Request",           # Ngrok-specific header
         "X-Test-Request",            # Testing header
         "User-Agent"                 # Browser user agent
     ],
     supports_credentials=True,       # Required for withCredentials: true
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
     max_age=86400
)

@app.route('/api/health', methods=['GET', 'HEAD'])
def health_check():
    """Health check endpoint for connection testing"""
    return {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'cors_enabled': True
    }

@app.after_request
def emergency_cors_fix(response):
    origin = request.headers.get('Origin')
    if origin and ('ngrok' in origin or 'localhost' in origin):
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

@login_manager.unauthorized_handler
def unauthorized_api_handler():
    # Check if the request path starts with your API prefix
    # (e.g., '/api/'). This helps distinguish API calls from regular web page navigations.
    api_prefix = app.config.get("API_PREFIX", "/api/") # You can make API_PREFIX configurable

    if request.path.startswith(api_prefix):
        # For API requests, return a JSON 401 response
        return jsonify(error="Authentication required", message="Please log in to access this resource."), 401
    else:
        # For non-API requests (e.g., browser navigating to a protected page),
        # perform the default redirect to the login view.
        if login_manager.login_view:
            login_url = url_for(login_manager.login_view)
            # Preserve the 'next' URL if it was part of the original request
            if 'next' in request.args:
                login_url = url_for(login_manager.login_view, next=request.args.get('next'))
            return redirect(login_url)
        else:
            # If no login view is configured (should not happen if login_view is set),
            # abort with 401. This is Flask-Login's fallback.
            from flask import abort
            abort(401)

# Add this User model to your existing models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'admin' or 'field'
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    
    def set_password(self, password):
        """Hash and set the user's password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check if the provided password matches the stored hash"""
        return check_password_hash(self.password_hash, password)
    
    def get_full_name(self):
        """Return the user's full name"""
        return f"{self.first_name} {self.last_name}"
    
    def to_dict(self):
        """Convert user object to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': self.get_full_name(),
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }

class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    contact_name = db.Column(db.String(100), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    address = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    sites = db.relationship('Site', backref='customer', lazy=True, cascade="all, delete-orphan")
    estimates = db.relationship('Estimate', backref='customer_direct_link', lazy=True, foreign_keys='Estimate.customer_id', cascade="all, delete-orphan")

class Site(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    name = db.Column(db.String(100), nullable=True) # e.g., "Main Warehouse", "Building A"
    address = db.Column(db.String(200))
    lockbox_location = db.Column(db.String(200))
    contact_name = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100), nullable=True) # Added email field
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    estimates = db.relationship('Estimate', backref='site', lazy=True, foreign_keys='Estimate.site_id', cascade="all, delete-orphan")
    
class Estimate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False) 
    site_id = db.Column(db.Integer, db.ForeignKey('site.id'), nullable=False) 
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected, converted
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    bids = db.relationship('Bid', backref='estimate', lazy=True, cascade="all, delete-orphan")
    doors_data = db.Column(db.Text, default='[]')  # Store doors as JSON text
    
    # Add these fields for estimate details
    title = db.Column(db.String(200), nullable=True)
    description = db.Column(db.Text, nullable=True)
    reference_number = db.Column(db.String(50), nullable=True)
    estimated_hours = db.Column(db.Float, nullable=True)
    estimated_cost = db.Column(db.Float, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    # Scheduling fields
    scheduled_date = db.Column(db.DateTime, nullable=True)
    estimator_id = db.Column(db.Integer, default=1, nullable=True)
    estimator_name = db.Column(db.String(50), default='Brett', nullable=True)
    duration = db.Column(db.Integer, default=60, nullable=True)
    schedule_notes = db.Column(db.Text, nullable=True)
    
class Bid(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    estimate_id = db.Column(db.Integer, db.ForeignKey('estimate.id'), nullable=False)
    status = db.Column(db.String(20), default='draft')  # draft, completed, approved
    total_cost = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    doors = db.relationship('Door', backref='bid', lazy=True, cascade="all, delete-orphan")
    # jobs relationship will be added by backref from Job model

class Door(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    bid_id = db.Column(db.Integer, db.ForeignKey('bid.id'), nullable=False)
    door_number = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Add new fields for rich door information
    location = db.Column(db.String(200), nullable=True)  # "Front door", "Back warehouse door"
    door_type = db.Column(db.String(50), nullable=True)  # "entry", "roll up", "overhead"
    width = db.Column(db.Float, nullable=True)  # Width dimension
    height = db.Column(db.Float, nullable=True)  # Height dimension
    dimension_unit = db.Column(db.String(10), nullable=True)  # "inches", "feet"
    labor_description = db.Column(db.Text, nullable=True)  # "full replacement", "repair"
    notes = db.Column(db.Text, nullable=True)  # Additional notes
    
    line_items = db.relationship('LineItem', backref='door', lazy=True, cascade="all, delete-orphan")
    
class LineItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    door_id = db.Column(db.Integer, db.ForeignKey('door.id'), nullable=False)
    part_number = db.Column(db.String(50))
    description = db.Column(db.String(200))
    quantity = db.Column(db.Integer, default=1)
    price = db.Column(db.Float, default=0.0)
    labor_hours = db.Column(db.Float, default=0.0)
    hardware = db.Column(db.Float, default=0.0)
    
class Job(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    job_number = db.Column(db.String(10), unique=True) 
    bid_id = db.Column(db.Integer, db.ForeignKey('bid.id'), nullable=False)
    status = db.Column(db.String(20), default='unscheduled')  
    scheduled_date = db.Column(db.Date, nullable=True)
    material_ready = db.Column(db.Boolean, default=False)
    material_location = db.Column(db.String(1))  # S for Shop, C for Client
    region = db.Column(db.String(2))  # OC, LA, IE
    job_scope = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Add the following line
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_doors = db.relationship('CompletedDoor', backref='job', lazy=True, cascade="all, delete-orphan")
    bid = db.relationship('Bid', backref=db.backref('jobs', lazy=True, cascade="all, delete-orphan"))
    
class CompletedDoor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('job.id'), nullable=False)
    door_id = db.Column(db.Integer, db.ForeignKey('door.id'), nullable=False)
    signature = db.Column(db.Text) 
    photo_path = db.Column(db.String(200))
    video_path = db.Column(db.String(200))
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

# Define AudioRecording model (FIX for NameError)
class AudioRecording(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    estimate_id = db.Column(db.Integer, db.ForeignKey('estimate.id'), nullable=False)
    file_path = db.Column(db.String(200), nullable=False)
    transcript = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # This relationship adds 'audio_recordings' attribute to Estimate model
    estimate = db.relationship('Estimate', backref=db.backref('audio_recordings', lazy=True, cascade="all, delete-orphan"))

class JobTimeTracking(db.Model):
    """Track time spent on jobs by field workers"""
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('job.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=True)
    total_minutes = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(20), default='active')  # active, paused, completed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    job = db.relationship('Job', backref=db.backref('time_tracking', lazy=True))
    user = db.relationship('User', backref=db.backref('time_entries', lazy=True))

class JobSignature(db.Model):
    """Store signatures for job processes"""
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('job.id'), nullable=False)
    door_id = db.Column(db.Integer, db.ForeignKey('door.id'), nullable=True)
    signature_type = db.Column(db.String(20), nullable=False)  # start, door_complete, final
    signature_data = db.Column(db.Text, nullable=False)  # Base64 encoded signature
    signer_name = db.Column(db.String(100), nullable=True)
    signer_title = db.Column(db.String(100), nullable=True)
    signed_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    job = db.relationship('Job', backref=db.backref('signatures', lazy=True))
    door = db.relationship('Door', backref=db.backref('signatures', lazy=True))

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

# Configuration for file uploads
MOBILE_UPLOAD_FOLDER = 'mobile_uploads'
ALLOWED_PHOTO_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'webm', 'mov', 'avi'}
MAX_PHOTO_SIZE = 10 * 1024 * 1024  # 10MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB

@login_manager.user_loader
def load_user(user_id):
    """Load user by ID for Flask-Login"""
    return User.query.get(int(user_id))

def admin_required(f):
    """Decorator to require admin role for route access"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        if current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

def create_default_users():
    """Create default users if they don't exist"""
    # Check if users already exist
    if User.query.count() > 0:
        return
    
    # Office Admin Accounts
    admin_users = [
        {'username': 'taylor', 'email': 'taylor@scottoverheaddoors.com', 'first_name': 'Taylor', 'last_name': 'Admin', 'role': 'admin'},
        {'username': 'kelly', 'email': 'kelly@scottoverheaddoors.com', 'first_name': 'Kelly', 'last_name': 'Admin', 'role': 'admin'},
        {'username': 'scott', 'email': 'scott@scottoverheaddoors.com', 'first_name': 'Scott', 'last_name': 'Owner', 'role': 'admin'},
        {'username': 'brett', 'email': 'brett@scottoverheaddoors.com', 'first_name': 'Brett', 'last_name': 'Admin', 'role': 'admin'},
    ]
    
    # Field Accounts for Installers
    field_users = [
        {'username': 'tech1', 'email': 'tech1@scottoverheaddoors.com', 'first_name': 'Tech', 'last_name': 'One', 'role': 'field'},
        {'username': 'tech2', 'email': 'tech2@scottoverheaddoors.com', 'first_name': 'Tech', 'last_name': 'Two', 'role': 'field'},
        {'username': 'tech3', 'email': 'tech3@scottoverheaddoors.com', 'first_name': 'Tech', 'last_name': 'Three', 'role': 'field'},
    ]
    
    all_users = admin_users + field_users
    
    for user_data in all_users:
        user = User(
            username=user_data['username'],
            email=user_data['email'],
            first_name=user_data['first_name'],
            last_name=user_data['last_name'],
            role=user_data['role']
        )
        # Set default password as username (should be changed on first login)
        user.set_password(user_data['username'])
        db.session.add(user)
    
    db.session.commit()
    print("Default users created successfully")

# Authentication Routes
@app.route('/api/auth/login', methods=['POST'])
def login():
    """Handle user login"""
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        # Find user by username
        user = User.query.filter_by(username=username).first()
        
        if not user:
            return jsonify({'error': 'Invalid username or password'}), 401
        
        if not user.is_active:
            return jsonify({'error': 'Account is disabled'}), 401
        
        if not user.check_password(password):
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Log the user in
        login_user(user, remember=True)
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Login failed'}), 500

@app.route('/api/auth/logout', methods=['POST'])
@login_required
def logout():
    """Handle user logout"""
    logout_user()
    return jsonify({'message': 'Logout successful'}), 200

@app.route('/api/auth/me', methods=['GET'])
@login_required
def get_current_user():
    """Get current user information"""
    return jsonify(current_user.to_dict()), 200

@app.route('/api/auth/change-password', methods=['POST'])
@login_required
def change_password():
    """Allow user to change their password"""
    try:
        data = request.json
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        if not current_password or not new_password:
            return jsonify({'error': 'Current password and new password are required'}), 400
        
        if len(new_password) < 6:
            return jsonify({'error': 'New password must be at least 6 characters long'}), 400
        
        if not current_user.check_password(current_password):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        current_user.set_password(new_password)
        db.session.commit()
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        logger.error(f"Password change error: {str(e)}")
        return jsonify({'error': 'Failed to change password'}), 500

# User Management Routes (Admin Only)
@app.route('/api/users', methods=['GET'])
@login_required
@admin_required
def get_users():
    """Get all users (admin only)"""
    try:
        users = User.query.order_by(User.role, User.first_name).all()
        return jsonify([user.to_dict() for user in users]), 200
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        return jsonify({'error': 'Failed to fetch users'}), 500


# ============================================================================
# MOBILE JOB WORKER ROUTES
# ============================================================================

@app.route('/api/mobile/jobs/<int:job_id>', methods=['GET'])
@login_required
def get_mobile_job_data(job_id):
    """
    Enhanced mobile job data endpoint with comprehensive media tracking and validation.
    Returns complete job information including door media status for mobile worker interface.
    """
    if request.method == 'OPTIONS': # For CORS preflight
        return jsonify({'status': 'ok'}), 200
        
    try:
        # Comprehensive authentication validation
        if not current_user.is_authenticated:
            logging.warning(f"Unauthenticated request to mobile job {job_id}")
            return jsonify({
                'error': 'Authentication required', 
                'code': 'NOT_AUTHENTICATED'
            }), 401
            
        user = User.query.get(current_user.id)
        if not user or not user.is_active:
            logging.warning(f"Inactive user {current_user.id} attempted to access job {job_id}")
            logout_user() # Log out inactive user
            return jsonify({
                'error': 'User account is no longer active', 
                'code': 'ACCOUNT_INACTIVE'
            }), 401
        
        if not job_id or job_id <= 0:
            return jsonify({'error': 'Invalid job ID provided'}), 400
            
        job = Job.query.get(job_id)
        if not job:
            logging.warning(f"Job {job_id} not found for user {current_user.username}")
            return jsonify({'error': f'Job #{job_id} not found'}), 404

        if not job.bid or not job.bid.estimate or not job.bid.estimate.customer_direct_link:
            missing_data = []
            if not job.bid: missing_data.append("bid data")
            elif not job.bid.estimate: missing_data.append("estimate data")
            elif not job.bid.estimate.customer_direct_link: missing_data.append("customer data")
            logging.error(f"Job {job_id} missing associated data: {', '.join(missing_data)}")
            return jsonify({'error': f'Job is missing critical associated data: {", ".join(missing_data)}'}), 500

        # Enhanced time tracking logic
        mobile_status = 'not_started'
        start_time_iso = None
        total_job_minutes = 0
        current_session_start = None
        job_timing_status = 'not_started'

        # Get all time tracking for this job
        all_time_tracking = JobTimeTracking.query.filter_by(job_id=job.id).order_by(JobTimeTracking.start_time.desc()).all()
        active_time_tracking = None

        # Calculate total time and find active session
        for tracking in all_time_tracking:
            if tracking.status == 'active':
                active_time_tracking = tracking
                current_session_start = tracking.start_time
                # Add current session time
                if tracking.start_time:
                    current_delta = datetime.utcnow() - tracking.start_time
                    current_minutes = int(current_delta.total_seconds() / 60)
                    total_job_minutes += current_minutes
            elif tracking.total_minutes:
                total_job_minutes += tracking.total_minutes

        # Get signatures for status determination
        start_signature = JobSignature.query.filter_by(job_id=job.id, signature_type='start').first()
        final_signature = JobSignature.query.filter_by(job_id=job.id, signature_type='final').first()

        # Determine mobile status and timing status
        if final_signature or job.status == 'completed':
            mobile_status = 'completed'
            job_timing_status = 'completed'
            if current_session_start:
                start_time_iso = current_session_start.isoformat()
            elif all_time_tracking and all_time_tracking[0].start_time:
                start_time_iso = all_time_tracking[0].start_time.isoformat()
        elif active_time_tracking or start_signature or all_time_tracking:
            mobile_status = 'started'
            if active_time_tracking:
                job_timing_status = 'active'
                start_time_iso = current_session_start.isoformat()
            elif all_time_tracking:
                job_timing_status = 'paused'
                # Use the most recent session start time
                if all_time_tracking[0].start_time:
                    start_time_iso = all_time_tracking[0].start_time.isoformat()
            else:
                job_timing_status = 'started'
        elif job.status == 'cancelled':
            mobile_status = 'cancelled'
            job_timing_status = 'cancelled'

        doors_details = []
        mobile_completed_doors_count = 0
        job_doors = job.bid.doors if job.bid and job.bid.doors else []
        
        for door_model in job_doors:
            line_items_details = []
            for line_item in door_model.line_items:
                mobile_line_completion = MobileJobLineItem.query.filter_by(
                    job_id=job.id, line_item_id=line_item.id
                ).first()
                is_completed = mobile_line_completion.completed if mobile_line_completion else False
                line_items_details.append({
                    'id': line_item.id,
                    'description': line_item.description or f'Work item {line_item.id}',
                    'part_number': line_item.part_number or '',
                    'quantity': line_item.quantity or 1,
                    'completed': is_completed,
                    'completed_at': mobile_line_completion.completed_at.isoformat() if mobile_line_completion and mobile_line_completion.completed_at else None,
                    'completed_by': mobile_line_completion.completed_by if mobile_line_completion else None
                })

            latest_photo = DoorMedia.query.filter_by(
                job_id=job.id, door_id=door_model.id, media_type='photo'
            ).order_by(DoorMedia.uploaded_at.desc()).first()

            latest_video = DoorMedia.query.filter_by(
                job_id=job.id, door_id=door_model.id, media_type='video'
            ).order_by(DoorMedia.uploaded_at.desc()).first()

            photo_info_data = None
            if latest_photo:
                photo_info_data = {
                    'id': latest_photo.id,
                    'url': f'/api/mobile/media/{latest_photo.id}/photo',
                    'thumbnail_url': f'/api/mobile/media/{latest_photo.id}/thumbnail',
                    'uploaded_at': latest_photo.uploaded_at.isoformat() if latest_photo.uploaded_at else None
                }
            
            video_info_data = None
            if latest_video:
                video_info_data = {
                    'id': latest_video.id,
                    'url': f'/api/mobile/media/{latest_video.id}/video',
                    'thumbnail_url': None, # Frontend can attempt to generate or use a placeholder
                    'uploaded_at': latest_video.uploaded_at.isoformat() if latest_video.uploaded_at else None
                }

            door_completion_signature = JobSignature.query.filter_by(
                job_id=job.id, door_id=door_model.id, signature_type='door_complete'
            ).first()
            is_door_completed = door_completion_signature is not None
            if is_door_completed:
                mobile_completed_doors_count += 1

            total_line_items = len(line_items_details)
            completed_line_items = sum(1 for item in line_items_details if item['completed'])
            door_progress = (completed_line_items / total_line_items * 100) if total_line_items > 0 else 0

            door_detail = {
                'id': door_model.id,
                'door_number': door_model.door_number or (job_doors.index(door_model) + 1),
                'location': door_model.location or f'Door #{door_model.door_number or (job_doors.index(door_model) + 1)}',
                'labor_description': door_model.labor_description or 'Standard door work',
                'door_type': door_model.door_type or 'Standard',
                'width': door_model.width,
                'height': door_model.height,
                'dimension_unit': door_model.dimension_unit or 'ft',
                'notes': door_model.notes,
                'line_items': line_items_details,
                'completed': is_door_completed,
                'completion_percentage': round(door_progress, 1),
                'has_photo': bool(latest_photo),
                'has_video': bool(latest_video),
                'has_signature': is_door_completed,
                'photo_info': photo_info_data,
                'video_info': video_info_data,
                'media_count': {
                    'photos': DoorMedia.query.filter_by(job_id=job.id, door_id=door_model.id, media_type='photo').count(), # Count all historical
                    'videos': DoorMedia.query.filter_by(job_id=job.id, door_id=door_model.id, media_type='video').count(), # Count all historical
                    'total': DoorMedia.query.filter_by(job_id=job.id, door_id=door_model.id).count()
                },
                'ready_for_completion': (
                    completed_line_items == total_line_items and 
                    bool(latest_photo) and 
                    bool(latest_video) and 
                    not is_door_completed
                )
            }
            doors_details.append(door_detail)

        site_info = job.bid.estimate.site if job.bid.estimate.site else None
        total_doors_count = len(job_doors)
        job_completion_percentage = (mobile_completed_doors_count / total_doors_count * 100) if total_doors_count > 0 else 0
        
        # Build sessions data for frontend
        sessions_data = []
        for entry in all_time_tracking:
            session_data = {
                'id': entry.id,
                'user_id': entry.user_id,
                'user_name': entry.user.get_full_name() if entry.user else 'Unknown',
                'start_time': entry.start_time.isoformat() if entry.start_time else None,
                'end_time': entry.end_time.isoformat() if entry.end_time else None,
                'status': entry.status,
                'minutes': entry.total_minutes or 0
            }
            
            # Add current session minutes for active sessions
            if entry.status == 'active' and entry.start_time:
                current_delta = datetime.utcnow() - entry.start_time
                session_data['current_minutes'] = int(current_delta.total_seconds() / 60)
            
            sessions_data.append(session_data)
        
        response_data = {
            'id': job.id,
            'job_number': job.job_number,
            'customer_name': job.bid.estimate.customer_direct_link.name,
            'address': site_info.address if site_info else 'Address not specified',
            'contact_name': site_info.contact_name if site_info else None,
            'phone': site_info.phone if site_info else None,
            'email': site_info.email if site_info else None,
            'job_scope': job.job_scope or 'Work scope not specified',
            'mobile_status': mobile_status,
            'start_time': start_time_iso,
            'doors': doors_details,
            'total_doors': total_doors_count,
            'completed_doors': mobile_completed_doors_count,
            'completion_percentage': round(job_completion_percentage, 1),
            'scheduled_date': job.scheduled_date.isoformat() if job.scheduled_date else None,
            'job_status': job.status, # Original system status
            'material_ready': job.material_ready,
            'material_location': job.material_location,
            'region': job.region,
            'has_start_signature': start_signature is not None,
            'has_final_signature': final_signature is not None,
            'start_signature_at': start_signature.signed_at.isoformat() if start_signature else None,
            'final_signature_at': final_signature.signed_at.isoformat() if final_signature else None,
            'has_active_tracking': active_time_tracking is not None,
            'tracking_user': current_user.get_full_name() if active_time_tracking else None,
            'tracking_start_time': active_time_tracking.start_time.isoformat() if active_time_tracking else None,
            
            # Enhanced time tracking data
            'time_tracking': {
                'total_minutes': total_job_minutes,
                'total_hours': round(total_job_minutes / 60, 2),
                'current_session_start': current_session_start.isoformat() if current_session_start else None,
                'has_active_session': active_time_tracking is not None,
                'job_timing_status': job_timing_status,
                'session_count': len(all_time_tracking),
                'sessions': sessions_data
            },
            
            'media_summary': { # Reflects latest photo/video for each door for completion status
                'total_photos': sum(1 for door in doors_details if door['has_photo']),
                'total_videos': sum(1 for door in doors_details if door['has_video']),
                'doors_with_media': sum(1 for door in doors_details if door['has_photo'] or door['has_video']),
                'doors_with_complete_media': sum(1 for door in doors_details if door['has_photo'] and door['has_video'])
            },
            'job_readiness': {
                'can_start': mobile_status == 'not_started',
                'can_complete': mobile_status == 'started' and mobile_completed_doors_count == total_doors_count,
                'all_doors_ready': all(door['ready_for_completion'] or door['completed'] for door in doors_details),
                'missing_requirements': [] # Populated below
            },
            'response_metadata': {
                'generated_at': datetime.utcnow().isoformat(),
                'user_id': current_user.id,
                'username': current_user.username,
                'api_version': '1.0.2' # Version increment
            }
        }
        
        missing_reqs = []
        for door in doors_details:
            if not door['completed']: # Only check non-completed doors
                if not all(item['completed'] for item in door['line_items']):
                    missing_reqs.append(f"Door #{door['door_number']}: Complete all work items")
                if not door['has_photo']:
                    missing_reqs.append(f"Door #{door['door_number']}: Capture completion photo")
                if not door['has_video']:
                    missing_reqs.append(f"Door #{door['door_number']}: Record operation video")
        response_data['job_readiness']['missing_requirements'] = missing_reqs
        
        logging.info(f"Successfully retrieved mobile job data for job {job_id} by user {current_user.username} - Status: {mobile_status}, Timing: {job_timing_status}, Total Time: {total_job_minutes}min, Doors: {total_doors_count}, Completed: {mobile_completed_doors_count}")
        return jsonify(response_data), 200

    except Exception as e:
        logging.error(f"Error retrieving mobile job data for job_id {job_id} by user "
                     f"{current_user.username if current_user.is_authenticated else 'anonymous'}: {str(e)}", 
                     exc_info=True)
        error_message = 'Failed to retrieve job data'
        error_code = 'INTERNAL_ERROR'
        if 'not found' in str(e).lower():
            error_message = f'Job #{job_id} not found'
            error_code = 'JOB_NOT_FOUND'
        # ... (other specific error codes)
        return jsonify({
            'error': error_message, 'job_id': job_id, 'error_type': type(e).__name__,
            'code': error_code, 'timestamp': datetime.utcnow().isoformat(),
            'user_id': current_user.id if current_user.is_authenticated else None
        }), 500

@app.route('/api/doors/<int:door_id>/actions', methods=['GET'])
@login_required
def get_door_actions(door_id):
    """
    Get all actions/activities for a specific door within a job context.
    Returns time tracking, signatures, media uploads, and line item completions.
    
    Args:
        door_id (int): The ID of the door to get actions for
        
    Query Parameters:
        job_id (int): Required. The job ID for context
        
    Returns:
        JSON response with all door-related actions chronologically ordered
    """
    try:
        # Get job_id from query parameters - this is required for context
        job_id = request.args.get('job_id')
        if not job_id:
            return jsonify({
                'error': 'job_id parameter is required',
                'code': 'MISSING_JOB_ID'
            }), 400
        
        try:
            job_id = int(job_id)
        except ValueError:
            return jsonify({
                'error': 'job_id must be a valid integer',
                'code': 'INVALID_JOB_ID'
            }), 400
        
        # Validate door exists
        door = Door.query.get_or_404(door_id)
        
        # Validate job exists
        job = Job.query.get_or_404(job_id)
        
        # Validate door belongs to the job's bid to ensure data integrity
        if door.bid_id != job.bid_id:
            return jsonify({
                'error': 'Door does not belong to the specified job',
                'code': 'INVALID_DOOR_JOB_RELATIONSHIP',
                'door_id': door_id,
                'job_id': job_id
            }), 400
        
        # Collect all actions for this door in chronological order
        actions = []
        
        # 1. Job-level time tracking entries (affects all doors in the job)
        time_entries = JobTimeTracking.query.filter_by(job_id=job_id).order_by(JobTimeTracking.start_time.desc()).all()
        for entry in time_entries:
            # Calculate duration for active sessions
            duration_minutes = entry.total_minutes
            if entry.status == 'active' and entry.start_time:
                current_delta = datetime.utcnow() - entry.start_time
                duration_minutes = int(current_delta.total_seconds() / 60)
            
            actions.append({
                'type': 'time_tracking',
                'id': entry.id,
                'timestamp': entry.start_time.isoformat() if entry.start_time else None,
                'end_timestamp': entry.end_time.isoformat() if entry.end_time else None,
                'user_id': entry.user_id,
                'user_name': entry.user.get_full_name() if entry.user else 'Unknown User',
                'status': entry.status,
                'duration_minutes': duration_minutes,
                'description': f"Time tracking {entry.status}",
                'details': {
                    'session_id': entry.id,
                    'is_current_user': entry.user_id == current_user.id if current_user.is_authenticated else False
                }
            })
        
        # 2. Door-specific signatures
        door_signatures = JobSignature.query.filter_by(
            job_id=job_id, 
            door_id=door_id
        ).order_by(JobSignature.signed_at.desc()).all()
        
        for signature in door_signatures:
            signature_type_display = signature.signature_type.replace('_', ' ').title()
            actions.append({
                'type': 'signature',
                'id': signature.id,
                'timestamp': signature.signed_at.isoformat() if signature.signed_at else None,
                'signature_type': signature.signature_type,
                'signer_name': signature.signer_name,
                'signer_title': signature.signer_title,
                'description': f"{signature_type_display} signature captured",
                'details': {
                    'has_signature_data': bool(signature.signature_data),
                    'signature_length': len(signature.signature_data) if signature.signature_data else 0
                }
            })
        
        # 3. Door media uploads (photos and videos)
        door_media = DoorMedia.query.filter_by(
            door_id=door_id, 
            job_id=job_id
        ).order_by(DoorMedia.uploaded_at.desc()).all()
        
        for media in door_media:
            file_size_mb = round(media.file_size / (1024 * 1024), 2) if media.file_size else 0
            actions.append({
                'type': 'media_upload',
                'id': media.id,
                'timestamp': media.uploaded_at.isoformat() if media.uploaded_at else None,
                'media_type': media.media_type,
                'file_size': media.file_size,
                'file_size_mb': file_size_mb,
                'mime_type': media.mime_type,
                'description': f"{media.media_type.title()} uploaded ({file_size_mb}MB)",
                'details': {
                    'file_path': os.path.basename(media.file_path) if media.file_path else None,
                    'media_url': f"/api/mobile/media/{media.id}/{media.media_type}",
                    'thumbnail_url': f"/api/mobile/media/{media.id}/thumbnail" if media.media_type == 'photo' else None
                }
            })
        
        # 4. Line item completions for this specific door
        line_items = LineItem.query.filter_by(door_id=door_id).all()
        for line_item in line_items:
            mobile_completion = MobileJobLineItem.query.filter_by(
                job_id=job_id, 
                line_item_id=line_item.id
            ).first()
            
            if mobile_completion:
                # Include both completed and uncompleted items for full audit trail
                status = "completed" if mobile_completion.completed else "marked incomplete"
                timestamp = mobile_completion.completed_at if mobile_completion.completed else mobile_completion.created_at if hasattr(mobile_completion, 'created_at') else None
                
                actions.append({
                    'type': 'line_item_completion',
                    'id': mobile_completion.id,
                    'timestamp': timestamp.isoformat() if timestamp else None,
                    'line_item_id': line_item.id,
                    'line_item_description': line_item.description or f"Line item {line_item.id}",
                    'part_number': line_item.part_number,
                    'quantity': line_item.quantity,
                    'completed': mobile_completion.completed,
                    'completed_by_id': mobile_completion.completed_by,
                    'completed_by_name': mobile_completion.user.get_full_name() if mobile_completion.user else 'Unknown User',
                    'description': f"Line item {status}: {line_item.description or 'Unnamed item'}",
                    'details': {
                        'is_current_user': mobile_completion.completed_by == current_user.id if current_user.is_authenticated else False,
                        'notes': mobile_completion.notes
                    }
                })
        
        # 5. Job-level signatures that affect all doors (start and final signatures)
        job_signatures = JobSignature.query.filter_by(
            job_id=job_id, 
            door_id=None  # Job-level signatures have no specific door
        ).order_by(JobSignature.signed_at.desc()).all()
        
        for signature in job_signatures:
            signature_type_display = signature.signature_type.replace('_', ' ').title()
            actions.append({
                'type': 'job_signature',
                'id': signature.id,
                'timestamp': signature.signed_at.isoformat() if signature.signed_at else None,
                'signature_type': signature.signature_type,
                'signer_name': signature.signer_name,
                'signer_title': signature.signer_title,
                'description': f"Job {signature_type_display} signature captured",
                'details': {
                    'affects_all_doors': True,
                    'has_signature_data': bool(signature.signature_data)
                }
            })
        
        # Sort all actions by timestamp (most recent first), handling None timestamps
        actions.sort(key=lambda x: x['timestamp'] or '1970-01-01T00:00:00', reverse=True)
        
        # Calculate summary statistics
        summary = {
            'total_actions': len(actions),
            'time_tracking_entries': len([a for a in actions if a['type'] == 'time_tracking']),
            'signatures': len([a for a in actions if a['type'] in ['signature', 'job_signature']]),
            'media_uploads': len([a for a in actions if a['type'] == 'media_upload']),
            'line_item_completions': len([a for a in actions if a['type'] == 'line_item_completion']),
            'photos_uploaded': len([a for a in actions if a['type'] == 'media_upload' and a.get('media_type') == 'photo']),
            'videos_uploaded': len([a for a in actions if a['type'] == 'media_upload' and a.get('media_type') == 'video']),
            'completed_line_items': len([a for a in actions if a['type'] == 'line_item_completion' and a.get('completed', False)])
        }
        
        # Build comprehensive response
        response_data = {
            'door_id': door_id,
            'job_id': job_id,
            'door_info': {
                'door_number': door.door_number,
                'location': door.location,
                'door_type': door.door_type,
                'labor_description': door.labor_description
            },
            'job_info': {
                'job_number': job.job_number,
                'status': job.status,
                'customer_name': job.bid.estimate.customer_direct_link.name if job.bid and job.bid.estimate and job.bid.estimate.customer_direct_link else 'Unknown Customer'
            },
            'actions': actions,
            'summary': summary,
            'generated_at': datetime.utcnow().isoformat(),
            'generated_by': {
                'user_id': current_user.id if current_user.is_authenticated else None,
                'username': current_user.username if current_user.is_authenticated else None
            }
        }
        
        # Log successful request for debugging
        logging.info(f"Successfully retrieved {len(actions)} actions for door {door_id} in job {job_id} "
                    f"by user {current_user.username if current_user.is_authenticated else 'anonymous'}")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        # Comprehensive error handling with detailed logging
        logging.error(f"Error retrieving actions for door {door_id} in job {job_id}: {str(e)}", exc_info=True)
        
        # Determine error type for better user experience
        error_code = 'INTERNAL_ERROR'
        if 'not found' in str(e).lower():
            error_code = 'RESOURCE_NOT_FOUND'
        elif 'permission' in str(e).lower() or 'access' in str(e).lower():
            error_code = 'ACCESS_DENIED'
        elif 'database' in str(e).lower() or 'connection' in str(e).lower():
            error_code = 'DATABASE_ERROR'
        
        return jsonify({
            'error': f'Failed to retrieve door actions: {str(e)}',
            'code': error_code,
            'door_id': door_id,
            'job_id': job_id,
            'timestamp': datetime.utcnow().isoformat(),
            'user_id': current_user.id if current_user.is_authenticated else None
        }), 500


@app.route('/api/mobile/jobs/<int:job_id>/pause', methods=['POST'])
@login_required
def pause_mobile_job(job_id):
    """Pause time tracking for a job (for multi-day jobs)"""
    try:
        job = Job.query.get_or_404(job_id)
        
        # Find active time tracking for current user
        active_tracking = JobTimeTracking.query.filter_by(
            job_id=job_id,
            user_id=current_user.id,
            status='active'
        ).first()
        
        if not active_tracking:
            return jsonify({'error': 'No active time tracking found for this job'}), 400
        
        # End the current session
        active_tracking.end_time = datetime.utcnow()
        active_tracking.status = 'paused'
        
        if active_tracking.start_time:
            delta = active_tracking.end_time - active_tracking.start_time
            active_tracking.total_minutes = int(delta.total_seconds() / 60)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'job_id': job_id,
            'session_minutes': active_tracking.total_minutes,
            'message': 'Job paused successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error pausing mobile job {job_id}: {str(e)}")
        return jsonify({'error': f'Failed to pause job: {str(e)}'}), 500

@app.route('/api/mobile/jobs/<int:job_id>/resume', methods=['POST'])
@login_required
def resume_mobile_job(job_id):
    """Resume time tracking for a job"""
    try:
        job = Job.query.get_or_404(job_id)
        
        # Check if there's already an active session
        existing_active = JobTimeTracking.query.filter_by(
            job_id=job_id,
            user_id=current_user.id,
            status='active'
        ).first()
        
        if existing_active:
            return jsonify({'error': 'Job is already active'}), 400
        
        # Create new time tracking session
        time_tracking = JobTimeTracking(
            job_id=job_id,
            user_id=current_user.id,
            start_time=datetime.utcnow(),
            status='active'
        )
        db.session.add(time_tracking)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'job_id': job_id,
            'time_tracking_id': time_tracking.id,
            'message': 'Job resumed successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error resuming mobile job {job_id}: {str(e)}")
        return jsonify({'error': f'Failed to resume job: {str(e)}'}), 500

@app.route('/api/mobile/jobs/<int:job_id>/time-tracking', methods=['GET'])
@login_required
def get_job_time_tracking(job_id):
    """Get comprehensive time tracking data for a job"""
    try:
        job = Job.query.get_or_404(job_id)
        
        # Get all time tracking entries for this job
        time_entries = JobTimeTracking.query.filter_by(job_id=job_id).order_by(JobTimeTracking.start_time.desc()).all()
        
        # Calculate total time across all sessions
        total_minutes = 0
        current_session_start = None
        sessions = []
        
        for entry in time_entries:
            session_data = {
                'id': entry.id,
                'user_id': entry.user_id,
                'user_name': entry.user.get_full_name() if entry.user else 'Unknown',
                'start_time': entry.start_time.isoformat() if entry.start_time else None,
                'end_time': entry.end_time.isoformat() if entry.end_time else None,
                'status': entry.status,
                'minutes': entry.total_minutes or 0
            }
            
            if entry.status == 'active' and entry.user_id == current_user.id:
                current_session_start = entry.start_time
                # Calculate current session time
                if entry.start_time:
                    current_delta = datetime.utcnow() - entry.start_time
                    session_data['current_minutes'] = int(current_delta.total_seconds() / 60)
                    total_minutes += session_data['current_minutes']
            elif entry.total_minutes:
                total_minutes += entry.total_minutes
            
            sessions.append(session_data)
        
        # Determine job timing status
        has_active_session = current_session_start is not None
        job_timing_status = 'not_started'
        
        if time_entries:
            if has_active_session:
                job_timing_status = 'active'
            elif any(entry.status in ['completed', 'paused'] for entry in time_entries):
                job_timing_status = 'paused'
        
        return jsonify({
            'job_id': job_id,
            'total_minutes': total_minutes,
            'total_hours': round(total_minutes / 60, 2),
            'current_session_start': current_session_start.isoformat() if current_session_start else None,
            'has_active_session': has_active_session,
            'job_timing_status': job_timing_status,
            'sessions': sessions,
            'session_count': len(sessions)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting time tracking for job {job_id}: {str(e)}")
        return jsonify({'error': f'Failed to get time tracking: {str(e)}'}), 500

@app.route('/api/mobile/jobs/<int:job_id>/start', methods=['POST'])
@login_required
def start_mobile_job(job_id):
    """Start a job with signature for mobile workers"""
    try:
        job = Job.query.get_or_404(job_id)
        data = request.json
        
        # Validate job can be started
        if job.status == 'completed':
            return jsonify({'error': 'Job is already completed'}), 400
            
        # Check if job is already started by current user
        existing_time_tracking = JobTimeTracking.query.filter_by(
            job_id=job_id, 
            user_id=current_user.id,
            status='active'
        ).first()
        
        if existing_time_tracking:
            return jsonify({'error': 'Job is already started by this user'}), 400
        
        # Start time tracking
        time_tracking = JobTimeTracking(
            job_id=job_id,
            user_id=current_user.id,
            start_time=datetime.utcnow(),
            status='active'
        )
        db.session.add(time_tracking)
        
        # Save start signature if provided
        signature = data.get('signature', '')
        if signature:
            job_signature = JobSignature(
                job_id=job_id,
                signature_type='start',
                signature_data=signature,
                signer_name=data.get('signer_name', ''),
                signer_title=data.get('signer_title', '')
            )
            db.session.add(job_signature)
        
        # Update job status if currently scheduled
        if job.status == 'scheduled':
            job.status = 'in_progress'
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Job started successfully',
            'job_id': job_id,
            'time_tracking_id': time_tracking.id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error starting mobile job {job_id}: {str(e)}")
        return jsonify({'error': f'Failed to start job: {str(e)}'}), 500

@app.route('/api/mobile/jobs/<int:job_id>/complete', methods=['POST'])
@login_required
def complete_mobile_job(job_id):
    """Complete a job with final signature for mobile workers"""
    try:
        job = Job.query.get_or_404(job_id)
        data = request.json
        
        # Validate job can be completed
        if job.status == 'completed':
            return jsonify({'error': 'Job is already completed'}), 400
        
        # Check if all doors are completed
        total_doors = len(job.bid.doors)
        completed_doors = JobSignature.query.filter_by(
            job_id=job_id,
            signature_type='door_complete'
        ).count()
        
        if completed_doors < total_doors:
            return jsonify({'error': 'All doors must be completed before finishing the job'}), 400
        
        # Save final signature
        signature = data.get('signature', '')
        if signature:
            job_signature = JobSignature(
                job_id=job_id,
                signature_type='final',
                signature_data=signature,
                signer_name=data.get('signer_name', ''),
                signer_title=data.get('signer_title', '')
            )
            db.session.add(job_signature)
        
        # End time tracking for current user
        time_tracking = JobTimeTracking.query.filter_by(
            job_id=job_id,
            user_id=current_user.id,
            status='active'
        ).first()
        
        if time_tracking:
            time_tracking.end_time = datetime.utcnow()
            time_tracking.status = 'completed'
            # Calculate total minutes
            if time_tracking.start_time:
                delta = time_tracking.end_time - time_tracking.start_time
                time_tracking.total_minutes = int(delta.total_seconds() / 60)
        
        # Update job status
        job.status = 'completed'
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Job completed successfully',
            'job_id': job_id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error completing mobile job {job_id}: {str(e)}")
        return jsonify({'error': f'Failed to complete job: {str(e)}'}), 500

@app.route('/api/mobile/doors/<int:door_id>/complete', methods=['POST'])
@login_required
def complete_mobile_door(door_id):
    """Complete a door with signature for mobile workers"""
    try:
        door = Door.query.get_or_404(door_id)
        data = request.json
        job_id = data.get('job_id')
        
        if not job_id:
            return jsonify({'error': 'job_id is required'}), 400
        
        # Validate door belongs to the job
        job = Job.query.get_or_404(job_id)
        if door.bid_id != job.bid_id:
            return jsonify({'error': 'Door does not belong to the specified job'}), 400
        
        # Check if door is already completed
        existing_signature = JobSignature.query.filter_by(
            job_id=job_id,
            door_id=door_id,
            signature_type='door_complete'
        ).first()
        
        if existing_signature:
            return jsonify({'error': 'Door is already completed'}), 400
        
        # Save door completion signature
        signature = data.get('signature', '')
        if signature:
            job_signature = JobSignature(
                job_id=job_id,
                door_id=door_id,
                signature_type='door_complete',
                signature_data=signature,
                signer_name=data.get('signer_name', ''),
                signer_title=data.get('signer_title', '')
            )
            db.session.add(job_signature)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Door completed successfully',
            'door_id': door_id,
            'job_id': job_id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error completing mobile door {door_id}: {str(e)}")
        return jsonify({'error': f'Failed to complete door: {str(e)}'}), 500


@app.route('/api/mobile/doors/<int:door_id>/media/upload', methods=['POST'])
@login_required
def upload_door_media(door_id):
    """
    Enhanced media upload endpoint for door completion with comprehensive validation,
    file processing, and thumbnail generation for optimal mobile viewing experience
    """
    try:
        # Validate door exists and user has access
        door = Door.query.get_or_404(door_id)
        
        # Validate required form data
        if 'file' not in request.files:
            return jsonify({
                'error': 'No file provided in request',
                'code': 'NO_FILE'
            }), 400
        
        file = request.files['file']
        job_id = request.form.get('job_id')
        media_type = request.form.get('media_type', 'photo')
        
        # Comprehensive input validation
        if not job_id:
            return jsonify({
                'error': 'job_id is required',
                'code': 'MISSING_JOB_ID'
            }), 400
        
        if file.filename == '':
            return jsonify({
                'error': 'No file selected',
                'code': 'EMPTY_FILENAME'
            }), 400
        
        # Validate media type
        valid_media_types = ['photo', 'video']
        if media_type not in valid_media_types:
            return jsonify({
                'error': f'Invalid media type. Must be one of: {valid_media_types}',
                'code': 'INVALID_MEDIA_TYPE'
            }), 400
        
        # Validate job exists and door belongs to job
        job = Job.query.get_or_404(job_id)
        if door.bid_id != job.bid_id:
            return jsonify({
                'error': 'Door does not belong to the specified job',
                'code': 'INVALID_DOOR_JOB_RELATIONSHIP'
            }), 400
        
        # Validate job status allows media upload
        if job.status == 'completed':
            return jsonify({
                'error': 'Cannot upload media for completed job',
                'code': 'JOB_COMPLETED'
            }), 400
        
        if job.status == 'cancelled':
            return jsonify({
                'error': 'Cannot upload media for cancelled job',
                'code': 'JOB_CANCELLED'
            }), 400
        
        # Check if job has actually been started (more flexible than just status)
        # A job is considered "started" if it has:
        # 1. Active time tracking, OR
        # 2. Any time tracking history, OR  
        # 3. A start signature, OR
        # 4. Status is in_progress or scheduled
        active_time_tracking = JobTimeTracking.query.filter_by(
            job_id=job_id,
            status='active'
        ).first()
        
        any_time_tracking = JobTimeTracking.query.filter_by(
            job_id=job_id
        ).first()
        
        start_signature = JobSignature.query.filter_by(
            job_id=job_id,
            signature_type='start'
        ).first()
        
        job_is_started = (
            active_time_tracking is not None or
            any_time_tracking is not None or
            start_signature is not None or
            job.status in ['in_progress', 'scheduled']
        )
        
        if not job_is_started:
            return jsonify({
                'error': 'Job must be started before uploading media',
                'code': 'JOB_NOT_STARTED',
                'debug_info': {
                    'job_status': job.status,
                    'has_active_tracking': active_time_tracking is not None,
                    'has_any_tracking': any_time_tracking is not None,
                    'has_start_signature': start_signature is not None
                }
            }), 400
        
        # Validate file type and extension
        allowed_extensions = {
            'photo': ALLOWED_PHOTO_EXTENSIONS,
            'video': ALLOWED_VIDEO_EXTENSIONS
        }
        
        if not allowed_file(file.filename, allowed_extensions[media_type]):
            return jsonify({
                'error': f'Invalid {media_type} file type. Allowed extensions: {list(allowed_extensions[media_type])}',
                'code': 'INVALID_FILE_TYPE'
            }), 400
        
        # Check file size constraints
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)  # Reset file pointer
        
        max_sizes = {
            'photo': MAX_PHOTO_SIZE,
            'video': MAX_VIDEO_SIZE
        }
        
        if file_size > max_sizes[media_type]:
            max_size_mb = max_sizes[media_type] / (1024 * 1024)
            return jsonify({
                'error': f'{media_type.capitalize()} file too large. Maximum size: {max_size_mb}MB',
                'code': 'FILE_TOO_LARGE',
                'max_size_mb': max_size_mb,
                'file_size_mb': round(file_size / (1024 * 1024), 2)
            }), 400
        
        if file_size == 0:
            return jsonify({
                'error': f'{media_type.capitalize()} file is empty',
                'code': 'EMPTY_FILE'
            }), 400
        
        # Create upload folder structure for this job
        upload_folder = create_upload_folder(job_id)
        
        # Generate secure, descriptive filename with timestamp
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')[:-3]  # Include microseconds for uniqueness
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        filename = f"door_{door_id}_{media_type}_{timestamp}.{file_extension}"
        file_path = os.path.join(upload_folder, filename)
        
        # Ensure unique filename in case of collision
        counter = 1
        original_file_path = file_path
        while os.path.exists(file_path):
            base_path, ext = os.path.splitext(original_file_path)
            file_path = f"{base_path}_{counter}{ext}"
            counter += 1
        
        # Save file to disk with error handling
        try:
            file.save(file_path)
            
            # Verify file was saved correctly
            if not os.path.exists(file_path):
                raise Exception("File was not saved to disk")
            
            saved_file_size = os.path.getsize(file_path)
            if saved_file_size != file_size:
                os.remove(file_path)  # Clean up partial file
                raise Exception(f"File size mismatch: expected {file_size}, got {saved_file_size}")
            
        except Exception as save_error:
            logging.error(f"Error saving uploaded file: {str(save_error)}")
            return jsonify({
                'error': f'Failed to save {media_type} file to server',
                'code': 'FILE_SAVE_ERROR',
                'details': str(save_error)
            }), 500
        
        # Determine MIME type
        mime_type = file.content_type
        if not mime_type:
            # Fallback MIME type detection
            extension_mime_map = {
                'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp',
                'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo'
            }
            mime_type = extension_mime_map.get(file_extension, 'application/octet-stream')
        
        # Generate thumbnail for photos
        thumbnail_path = None
        if media_type == 'photo':
            try:
                base_path, ext = os.path.splitext(file_path)
                thumbnail_path = f"{base_path}_thumb.jpg"
                thumbnail_path = generate_thumbnail(file_path, thumbnail_path)
                if thumbnail_path != file_path:  # Thumbnail was successfully created
                    logging.info(f"Generated thumbnail for photo: {thumbnail_path}")
            except Exception as thumb_error:
                logging.warning(f"Failed to generate thumbnail for {file_path}: {str(thumb_error)}")
                # Continue without thumbnail - not critical for functionality
        
        # Create database record with comprehensive metadata
        try:
            door_media = DoorMedia(
                door_id=door_id,
                job_id=job_id,
                media_type=media_type,
                file_path=file_path,
                file_size=saved_file_size,
                mime_type=mime_type,
                uploaded_at=datetime.utcnow()
            )
            db.session.add(door_media)
            db.session.commit()
            
            # Refresh to get the assigned ID
            db.session.refresh(door_media)
            
        except Exception as db_error:
            # Clean up uploaded file if database operation fails
            try:
                os.remove(file_path)
                if thumbnail_path and os.path.exists(thumbnail_path):
                    os.remove(thumbnail_path)
            except:
                pass
            
            logging.error(f"Database error during media upload: {str(db_error)}")
            return jsonify({
                'error': 'Failed to save media record to database',
                'code': 'DATABASE_ERROR',
                'details': str(db_error)
            }), 500
        
        # Calculate additional metadata for response
        upload_duration = (datetime.utcnow() - datetime.utcnow()).total_seconds()  # Placeholder
        file_size_mb = round(saved_file_size / (1024 * 1024), 2)
        
        # Check current media count for this door
        current_media_count = DoorMedia.query.filter_by(
            door_id=door_id,
            job_id=job_id
        ).count()
        
        current_photos = DoorMedia.query.filter_by(
            door_id=door_id,
            job_id=job_id,
            media_type='photo'
        ).count()
        
        current_videos = DoorMedia.query.filter_by(
            door_id=door_id,
            job_id=job_id,
            media_type='video'
        ).count()
        
        # Generate URLs for immediate access
        media_url = f"/api/mobile/media/{door_media.id}/{media_type}"
        thumbnail_url = f"/api/mobile/media/{door_media.id}/thumbnail" if thumbnail_path else None
        
        # Log successful upload
        logging.info(f"Successfully uploaded {media_type} for door {door_id} in job {job_id}: "
                    f"{filename} ({file_size_mb}MB) by user {current_user.username}")
        
        # Build comprehensive response
        response_data = {
            'success': True,
            'message': f'{media_type.capitalize()} uploaded successfully',
            
            # Media record information
            'media': {
                'id': door_media.id,
                'door_id': door_id,
                'job_id': job_id,
                'media_type': media_type,
                'filename': filename,
                'file_size': saved_file_size,
                'file_size_mb': file_size_mb,
                'mime_type': mime_type,
                'uploaded_at': door_media.uploaded_at.isoformat(),
                'url': media_url,
                'thumbnail_url': thumbnail_url
            },
            
            # Door media summary
            'door_media_summary': {
                'total_count': current_media_count,
                'photos': current_photos,
                'videos': current_videos,
                'has_photo': current_photos > 0,
                'has_video': current_videos > 0
            },
            
            # Upload metadata
            'upload_info': {
                'user_id': current_user.id,
                'username': current_user.username,
                'timestamp': datetime.utcnow().isoformat(),
                'file_path': file_path,
                'thumbnail_generated': thumbnail_path is not None and thumbnail_path != file_path
            }
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        # Comprehensive error handling and cleanup
        logging.error(f"Error uploading door media for door {door_id}: {str(e)}", exc_info=True)
        
        # Clean up any partially uploaded files
        try:
            if 'file_path' in locals() and os.path.exists(file_path):
                os.remove(file_path)
            if 'thumbnail_path' in locals() and thumbnail_path and os.path.exists(thumbnail_path):
                os.remove(thumbnail_path)
        except:
            pass
        
        # Rollback database changes
        db.session.rollback()
        
        # Determine error type and provide appropriate response
        error_code = 'INTERNAL_ERROR'
        error_message = f'Failed to upload {media_type}: {str(e)}'
        
        if 'permission' in str(e).lower() or 'access' in str(e).lower():
            error_code = 'ACCESS_DENIED'
            error_message = 'Permission denied for media upload'
        elif 'disk' in str(e).lower() or 'space' in str(e).lower():
            error_code = 'STORAGE_ERROR'
            error_message = 'Insufficient storage space for media upload'
        elif 'timeout' in str(e).lower():
            error_code = 'TIMEOUT_ERROR'
            error_message = 'Upload timeout - please try again with a smaller file'
        
        return jsonify({
            'success': False,
            'error': error_message,
            'code': error_code,
            'door_id': door_id,
            'job_id': request.form.get('job_id'),
            'media_type': request.form.get('media_type', 'unknown'),
            'user_id': current_user.id,
            'timestamp': datetime.utcnow().isoformat(),
            'error_type': type(e).__name__
        }), 500


def create_upload_folder(job_id):
    """
    Create upload folder structure for job media with proper permissions
    Returns the absolute path to the job's upload folder
    """
    try:
        # Create base upload folder if it doesn't exist
        if not os.path.exists(MOBILE_UPLOAD_FOLDER):
            os.makedirs(MOBILE_UPLOAD_FOLDER, mode=0o755)
        
        # Create job-specific folder
        job_folder = os.path.join(MOBILE_UPLOAD_FOLDER, f"job_{job_id}")
        if not os.path.exists(job_folder):
            os.makedirs(job_folder, mode=0o755)
        
        # Create media type subfolders
        for media_type in ['photos', 'videos', 'thumbnails']:
            subfolder = os.path.join(job_folder, media_type)
            if not os.path.exists(subfolder):
                os.makedirs(subfolder, mode=0o755)
        
        return job_folder
        
    except Exception as e:
        logging.error(f"Error creating upload folder for job {job_id}: {str(e)}")
        raise Exception(f"Failed to create upload directory: {str(e)}")


def allowed_file(filename, allowed_extensions):
    """
    Enhanced file extension validation with case-insensitive checking
    """
    if not filename or '.' not in filename:
        return False
    
    extension = filename.rsplit('.', 1)[1].lower()
    return extension in allowed_extensions


def generate_thumbnail(original_path, thumbnail_path, size=(300, 300)):
    """
    Enhanced thumbnail generation with better error handling and optimization
    Returns the path to the thumbnail (original path if generation fails)
    """
    try:
        from PIL import Image, ImageOps
        
        # Open image and handle EXIF orientation
        with Image.open(original_path) as img:
            # Auto-rotate based on EXIF data
            img = ImageOps.exif_transpose(img)
            
            # Convert to RGB if necessary (handles PNG with transparency, etc.)
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create white background for transparency
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Calculate thumbnail size maintaining aspect ratio
            img.thumbnail(size, Image.Resampling.LANCZOS)
            
            # Save thumbnail with optimization
            img.save(thumbnail_path, 'JPEG', quality=85, optimize=True, progressive=True)
            
        logging.info(f"Generated optimized thumbnail: {thumbnail_path}")
        return thumbnail_path
        
    except ImportError:
        logging.warning("PIL/Pillow not available for thumbnail generation")
        return original_path
    except Exception as e:
        logging.error(f"Error generating thumbnail for {original_path}: {str(e)}")
        return original_path

def create_upload_folder(job_id):
    """
    Create upload folder structure for job media with proper permissions
    Returns the absolute path to the job's upload folder
    """
    try:
        # Create base upload folder if it doesn't exist
        if not os.path.exists(MOBILE_UPLOAD_FOLDER):
            os.makedirs(MOBILE_UPLOAD_FOLDER, mode=0o755)
        
        # Create job-specific folder
        job_folder = os.path.join(MOBILE_UPLOAD_FOLDER, f"job_{job_id}")
        if not os.path.exists(job_folder):
            os.makedirs(job_folder, mode=0o755)
        
        # Create media type subfolders
        for media_type in ['photos', 'videos', 'thumbnails']:
            subfolder = os.path.join(job_folder, media_type)
            if not os.path.exists(subfolder):
                os.makedirs(subfolder, mode=0o755)
        
        return job_folder
        
    except Exception as e:
        logging.error(f"Error creating upload folder for job {job_id}: {str(e)}")
        raise Exception(f"Failed to create upload directory: {str(e)}")


def allowed_file(filename, allowed_extensions):
    """
    Enhanced file extension validation with case-insensitive checking
    """
    if not filename or '.' not in filename:
        return False
    
    extension = filename.rsplit('.', 1)[1].lower()
    return extension in allowed_extensions


def generate_thumbnail(original_path, thumbnail_path, size=(300, 300)):
    """
    Enhanced thumbnail generation with better error handling and optimization
    Returns the path to the thumbnail (original path if generation fails)
    """
    try:
        from PIL import Image, ImageOps
        
        # Open image and handle EXIF orientation
        with Image.open(original_path) as img:
            # Auto-rotate based on EXIF data
            img = ImageOps.exif_transpose(img)
            
            # Convert to RGB if necessary (handles PNG with transparency, etc.)
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create white background for transparency
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Calculate thumbnail size maintaining aspect ratio
            img.thumbnail(size, Image.Resampling.LANCZOS)
            
            # Save thumbnail with optimization
            img.save(thumbnail_path, 'JPEG', quality=85, optimize=True, progressive=True)
            
        logging.info(f"Generated optimized thumbnail: {thumbnail_path}")
        return thumbnail_path
        
    except ImportError:
        logging.warning("PIL/Pillow not available for thumbnail generation")
        return original_path
    except Exception as e:
        logging.error(f"Error generating thumbnail for {original_path}: {str(e)}")
        return original_path
    
    
    
# Also add the missing route for job completion signature that was referenced:
@app.route('/api/mobile/jobs/signature', methods=['POST'])
@login_required 
def save_job_signature():
    """Save job signature (alternative endpoint for compatibility)"""
    try:
        data = request.json
        job_id = data.get('job_id')
        door_id = data.get('door_id')
        signature_type = data.get('signature_type')
        signature_data = data.get('signature_data')
        signer_name = data.get('signer_name', '')
        signer_title = data.get('signer_title', '')
        
        if not job_id or not signature_type or not signature_data:
            return jsonify({'error': 'job_id, signature_type, and signature_data are required'}), 400
        
        job = Job.query.get_or_404(job_id)
        
        # Create signature record
        job_signature = JobSignature(
            job_id=job_id,
            door_id=door_id,
            signature_type=signature_type,
            signature_data=signature_data,
            signer_name=signer_name,
            signer_title=signer_title
        )
        db.session.add(job_signature)
        
        # Handle specific signature types
        if signature_type == 'start':
            # Start time tracking if not already started
            existing_tracking = JobTimeTracking.query.filter_by(
                job_id=job_id,
                user_id=current_user.id,
                status='active'
            ).first()
            
            if not existing_tracking:
                time_tracking = JobTimeTracking(
                    job_id=job_id,
                    user_id=current_user.id,
                    start_time=datetime.utcnow(),
                    status='active'
                )
                db.session.add(time_tracking)
                
            if job.status == 'scheduled':
                job.status = 'in_progress'
                
        elif signature_type == 'final':
            # End time tracking
            active_tracking = JobTimeTracking.query.filter_by(
                job_id=job_id,
                user_id=current_user.id,
                status='active'
            ).first()
            
            if active_tracking:
                active_tracking.end_time = datetime.utcnow()
                active_tracking.status = 'completed'
                if active_tracking.start_time:
                    delta = active_tracking.end_time - active_tracking.start_time
                    active_tracking.total_minutes = int(delta.total_seconds() / 60)
            
            job.status = 'completed'
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'signature_id': job_signature.id,
            'message': f'{signature_type} signature saved successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error saving job signature: {str(e)}")
        return jsonify({'error': f'Failed to save signature: {str(e)}'}), 500

@app.route('/api/jobs/<int:job_id>/status', methods=['PUT'])
@login_required  # <-- FIX 1: Added the required authentication decorator
def update_job_status(job_id):
    """Update job status"""
    try:
        # The OPTIONS request is handled by CORS configuration, this check is not strictly necessary but harmless.
        if request.method == 'OPTIONS':
            return '', 200

        # FIX 2: The manual authentication check below is no longer needed because of @login_required
        # if not hasattr(current_user, 'is_authenticated') or not current_user.is_authenticated:
        #    app.logger.warning(f"Unauthorized access attempt to update job {job_id} status")
        #    return jsonify({'error': 'Authentication required'}), 401
        
        job = Job.query.get_or_404(job_id)
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
            
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({'error': 'status is required'}), 400
        
        valid_statuses = ['unscheduled', 'scheduled', 'in_progress', 'completed', 'cancelled', 'waiting_for_parts', 'on_hold']
        if new_status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {valid_statuses}'}), 400
        
        old_status = job.status
        job.status = new_status
        
        # The 'updated_at' field is now handled automatically by the model's onupdate trigger.
        # job.updated_at = datetime.utcnow() # This line is no longer necessary.
        
        db.session.commit()
        
        app.logger.info(f"Job {job_id} status updated from '{old_status}' to '{new_status}' by user {current_user.username}")
        
        # FIX 3: Correctly serialize the response object by accessing related models.
        # This returns a complete and accurate job object, consistent with get_job.
        db.session.refresh(job) # Refresh to get the latest data from the DB, including updated_at.

        job_data = {
            'id': job.id,
            'job_number': job.job_number,
            'customer_name': job.bid.estimate.customer_direct_link.name,
            'status': job.status,
            'scheduled_date': job.scheduled_date.isoformat() if job.scheduled_date else None,
            'address': job.bid.estimate.site.address,
            'contact_name': job.bid.estimate.site.contact_name,
            'phone': job.bid.estimate.site.phone,
            'region': job.region,
            'job_scope': job.job_scope,
            'material_ready': job.material_ready,
            'material_location': job.material_location,
            'created_at': job.created_at.isoformat() if job.created_at else None,
            'updated_at': job.updated_at.isoformat() if job.updated_at else None,
            'doors': []
        }
        
        if job.bid and job.bid.doors:
            for door in job.bid.doors:
                completed_door = CompletedDoor.query.filter_by(job_id=job.id, door_id=door.id).first()
                door_data = {
                    'id': door.id,
                    'door_number': door.door_number,
                    'location': door.location,
                    'door_type': door.door_type,
                    'completed': completed_door is not None,
                    'completed_at': completed_door.completed_at.isoformat() if completed_door and completed_door.completed_at else None,
                }
                job_data['doors'].append(door_data)
        
        return jsonify(job_data), 200
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error updating job status for job {job_id}: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update job status: {str(e)}'}), 500
    
# Add missing endpoint for ending job time tracking:
@app.route('/api/mobile/jobs/end', methods=['POST'])
@login_required
def end_mobile_job_tracking():
    """End time tracking for a job"""
    try:
        data = request.json
        job_id = data.get('job_id')
        
        if not job_id:
            return jsonify({'error': 'job_id is required'}), 400
        
        # Find active time tracking for this job and user
        active_tracking = JobTimeTracking.query.filter_by(
            job_id=job_id,
            user_id=current_user.id,
            status='active'
        ).first()
        
        if not active_tracking:
            return jsonify({'error': 'No active time tracking found for this job'}), 400
        
        # End the time tracking
        active_tracking.end_time = datetime.utcnow()
        active_tracking.status = 'completed'
        
        if active_tracking.start_time:
            delta = active_tracking.end_time - active_tracking.start_time
            active_tracking.total_minutes = int(delta.total_seconds() / 60)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'job_id': job_id,
            'total_minutes': active_tracking.total_minutes,
            'message': 'Time tracking ended successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error ending job time tracking: {str(e)}")
        return jsonify({'error': f'Failed to end time tracking: {str(e)}'}), 500


@app.route('/api/mobile/doors/<int:door_id>/media', methods=['GET'])
@login_required
def get_door_media(door_id):
    """
    Get all media (photos and videos) for a specific door
    Returns organized arrays of photos and videos with metadata
    """
    try:
        # Validate door exists
        door = Door.query.get_or_404(door_id)
        
        # Get job_id from query parameters for additional validation
        job_id = request.args.get('job_id')
        if job_id:
            job = Job.query.get_or_404(job_id)
            # Validate door belongs to the job's bid
            if door.bid_id != job.bid_id:
                return jsonify({'error': 'Door does not belong to the specified job'}), 400
        
        # Get all media for this door, ordered by upload time (newest first)
        door_media = DoorMedia.query.filter_by(door_id=door_id).order_by(DoorMedia.uploaded_at.desc()).all()
        
        # Separate photos and videos
        photos = []
        videos = []
        
        for media in door_media:
            # Build media object with all necessary information
            media_obj = {
                'id': media.id,
                'door_id': media.door_id,
                'job_id': media.job_id,
                'media_type': media.media_type,
                'file_path': media.file_path,
                'file_size': media.file_size,
                'mime_type': media.mime_type,
                'uploaded_at': media.uploaded_at.isoformat() if media.uploaded_at else None,
                'filename': os.path.basename(media.file_path) if media.file_path else None
            }
            
            # Add duration for videos if available (you might want to extract this during upload)
            if media.media_type == 'video':
                # You could store duration in the database or calculate it here
                # For now, we'll leave it as None
                media_obj['duration'] = None
                videos.append(media_obj)
            else:
                photos.append(media_obj)
        
        logging.info(f"Retrieved media for door {door_id}: {len(photos)} photos, {len(videos)} videos")
        
        return jsonify({
            'door_id': door_id,
            'job_id': job_id,
            'photos': photos,
            'videos': videos,
            'total_count': len(door_media)
        }), 200
        
    except Exception as e:
        logging.error(f"Error retrieving media for door {door_id}: {str(e)}")
        return jsonify({'error': f'Failed to retrieve door media: {str(e)}'}), 500


@app.route('/api/mobile/media/<int:media_id>/<media_type>', methods=['GET'])
@login_required
def serve_mobile_media(media_id, media_type):
    """
    Serve media files (photos, videos, thumbnails) for mobile app
    Supports different media types: photo, video, thumbnail
    """
    try:
        # Validate media type
        valid_types = ['photo', 'video', 'thumbnail']
        if media_type not in valid_types:
            return jsonify({'error': f'Invalid media type. Must be one of: {valid_types}'}), 400
        
        # Get media record from database
        media = DoorMedia.query.get_or_404(media_id)
        
        # Verify user has access to this media (through job access)
        if media.job_id:
            job = Job.query.get(media.job_id)
            if not job:
                return jsonify({'error': 'Associated job not found'}), 404
            
            # You might want to add additional authorization checks here
            # For example, checking if the current user is assigned to this job
        
        # Determine file path based on media type
        if media_type == 'thumbnail':
            # Generate thumbnail path
            file_path = media.file_path
            if file_path:
                # Create thumbnail path by adding _thumb before extension
                base_path, extension = os.path.splitext(file_path)
                thumbnail_path = f"{base_path}_thumb{extension}"
                
                # If thumbnail doesn't exist, create it or use original
                if not os.path.exists(thumbnail_path):
                    if media.media_type == 'photo':
                        # For photos, try to create thumbnail or use original
                        thumbnail_path = generate_thumbnail(file_path, thumbnail_path)
                    else:
                        # For videos, you might want to extract a frame
                        # For now, use a default video thumbnail or return original
                        thumbnail_path = file_path
                
                file_path = thumbnail_path
        else:
            # Use original file path
            file_path = media.file_path
        
        # Verify file exists
        if not file_path or not os.path.exists(file_path):
            logging.warning(f"Media file not found: {file_path}")
            return jsonify({'error': 'Media file not found on server'}), 404
        
        # Get file info
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            return jsonify({'error': 'Media file is empty'}), 404
        
        # Determine MIME type
        mime_type = media.mime_type
        if not mime_type:
            # Fallback MIME type detection based on file extension
            extension = os.path.splitext(file_path)[1].lower()
            mime_types = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.mov': 'video/quicktime',
                '.avi': 'video/x-msvideo'
            }
            mime_type = mime_types.get(extension, 'application/octet-stream')
        
        # Log media access for debugging
        logging.info(f"Serving media {media_id} ({media_type}): {os.path.basename(file_path)} ({file_size} bytes)")
        
        # Serve the file with proper headers
        try:
            return send_from_directory(
                os.path.dirname(file_path),
                os.path.basename(file_path),
                mimetype=mime_type,
                as_attachment=False,  # Display inline in browser
                download_name=f"door_{media.door_id}_{media_type}_{media_id}{os.path.splitext(file_path)[1]}"
            )
        except Exception as send_error:
            logging.error(f"Error sending file {file_path}: {str(send_error)}")
            return jsonify({'error': 'Failed to serve media file'}), 500
            
    except Exception as e:
        logging.error(f"Error serving media {media_id} ({media_type}): {str(e)}")
        return jsonify({'error': f'Failed to serve media: {str(e)}'}), 500


@app.route('/api/mobile/jobs/<int:job_id>/line-items/<int:line_item_id>/toggle', methods=['PUT'])
@login_required
def toggle_mobile_line_item(job_id, line_item_id):
    """
    Toggle completion status of a line item for mobile workers with comprehensive validation
    Handles optimistic updates and provides detailed response for UI synchronization
    """
    try:
        # Validate job exists and user has access
        job = Job.query.get_or_404(job_id)
        
        # Validate job state allows modifications
        if job.status == 'completed':
            return jsonify({
                'error': 'Cannot modify line items for completed job',
                'code': 'JOB_COMPLETED'
            }), 400
        
        if job.status == 'cancelled':
            return jsonify({
                'error': 'Cannot modify line items for cancelled job',
                'code': 'JOB_CANCELLED'
            }), 400
        
        # Validate line item exists
        line_item = LineItem.query.get_or_404(line_item_id)
        
        # Validate line item belongs to this job through door relationship
        door_ids = [door.id for door in job.bid.doors] if job.bid and job.bid.doors else []
        if line_item.door_id not in door_ids:
            return jsonify({
                'error': 'Line item does not belong to this job',
                'code': 'INVALID_RELATIONSHIP'
            }), 400
        
        # Get the door for additional context
        door = Door.query.get(line_item.door_id)
        if not door:
            return jsonify({
                'error': 'Associated door not found',
                'code': 'DOOR_NOT_FOUND'
            }), 404
        
        # Check if door is already completed (has completion signature)
        door_completion_signature = JobSignature.query.filter_by(
            job_id=job_id,
            door_id=door.id,
            signature_type='door_complete'
        ).first()
        
        if door_completion_signature:
            return jsonify({
                'error': f'Cannot modify line items for completed Door #{door.door_number}',
                'code': 'DOOR_COMPLETED',
                'door_number': door.door_number
            }), 400
        
        # Find or create mobile line item completion record
        mobile_completion = MobileJobLineItem.query.filter_by(
            job_id=job_id,
            line_item_id=line_item_id
        ).first()
        
        # Store previous state for response
        previous_completed = False
        if mobile_completion:
            previous_completed = mobile_completion.completed
        
        # Determine new completion state
        new_completed = not previous_completed
        
        # Create or update the mobile completion record
        if not mobile_completion:
            mobile_completion = MobileJobLineItem(
                job_id=job_id,
                line_item_id=line_item_id,
                completed=new_completed,
                completed_at=datetime.utcnow() if new_completed else None,
                completed_by=current_user.id if new_completed else None
            )
            db.session.add(mobile_completion)
        else:
            mobile_completion.completed = new_completed
            if new_completed:
                mobile_completion.completed_at = datetime.utcnow()
                mobile_completion.completed_by = current_user.id
            else:
                mobile_completion.completed_at = None
                mobile_completion.completed_by = None
        
        # Commit the changes
        db.session.commit()
        
        # Calculate door completion progress for response
        door_line_items = LineItem.query.filter_by(door_id=door.id).all()
        completed_items_count = 0
        total_items_count = len(door_line_items)
        
        for item in door_line_items:
            item_completion = MobileJobLineItem.query.filter_by(
                job_id=job_id,
                line_item_id=item.id
            ).first()
            if item_completion and item_completion.completed:
                completed_items_count += 1
        
        door_completion_percentage = (completed_items_count / total_items_count * 100) if total_items_count > 0 else 0
        
        # Log the action for audit trail
        action_verb = "completed" if new_completed else "uncompleted"
        logging.info(f"User {current_user.username} {action_verb} line item {line_item_id} "
                    f"('{line_item.description}') for door {door.door_number} in job {job.job_number}")
        
        # Build comprehensive response
        response_data = {
            'success': True,
            'line_item_id': line_item_id,
            'job_id': job_id,
            'door_id': door.id,
            'door_number': door.door_number,
            
            # Line item completion details
            'completed': new_completed,
            'completed_at': mobile_completion.completed_at.isoformat() if mobile_completion.completed_at else None,
            'completed_by': {
                'id': current_user.id,
                'username': current_user.username,
                'full_name': current_user.get_full_name()
            } if new_completed else None,
            
            # State change information
            'previous_completed': previous_completed,
            'action': action_verb,
            
            # Door progress information
            'door_progress': {
                'completed_items': completed_items_count,
                'total_items': total_items_count,
                'percentage': round(door_completion_percentage, 1),
                'all_items_completed': completed_items_count == total_items_count
            },
            
            # Line item context
            'line_item': {
                'description': line_item.description,
                'part_number': line_item.part_number,
                'quantity': line_item.quantity
            },
            
            # Timestamp for client synchronization
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        # Rollback any partial changes
        db.session.rollback()
        
        # Log the error with context
        logging.error(f"Error toggling line item {line_item_id} for job {job_id} by user {current_user.username}: {str(e)}", exc_info=True)
        
        # Provide detailed error response
        error_response = {
            'success': False,
            'error': 'Failed to toggle line item completion status',
            'details': str(e),
            'line_item_id': line_item_id,
            'job_id': job_id,
            'user_id': current_user.id,
            'timestamp': datetime.utcnow().isoformat(),
            'code': 'INTERNAL_ERROR'
        }
        
        # Add specific error codes for common issues
        if 'not found' in str(e).lower():
            error_response['code'] = 'RESOURCE_NOT_FOUND'
        elif 'constraint' in str(e).lower() or 'foreign key' in str(e).lower():
            error_response['code'] = 'DATA_INTEGRITY_ERROR'
        elif 'permission' in str(e).lower() or 'access' in str(e).lower():
            error_response['code'] = 'ACCESS_DENIED'
        
        return jsonify(error_response), 500
    
    
@app.route('/api/mobile/test', methods=['GET'])
def test_mobile_endpoint():
    """
    Test endpoint to verify mobile API connectivity and configuration
    Provides comprehensive system status and connectivity information for debugging
    """
    try:
        # Get current timestamp for response timing
        current_time = datetime.utcnow()
        
        # Test database connectivity
        db_status = 'connected'
        db_error = None
        try:
            # Simple query to test database connection
            db.session.execute('SELECT 1')
            db.session.commit()
        except Exception as db_err:
            db_status = 'error'
            db_error = str(db_err)
        
        # Get authentication status
        auth_status = {
            'authenticated': current_user.is_authenticated if 'current_user' in globals() else False,
            'user_info': None
        }
        
        if current_user.is_authenticated:
            auth_status['user_info'] = {
                'id': current_user.id,
                'username': current_user.username,
                'full_name': current_user.get_full_name(),
                'role': current_user.role,
                'last_login': current_user.last_login.isoformat() if current_user.last_login else None
            }
        
        # Get request information for debugging network issues
        request_info = {
            'method': request.method,
            'endpoint': request.endpoint,
            'url': request.url,
            'remote_addr': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', 'Unknown'),
            'origin': request.headers.get('Origin'),
            'referer': request.headers.get('Referer'),
            'host': request.headers.get('Host'),
            'content_type': request.headers.get('Content-Type'),
            'accept': request.headers.get('Accept')
        }
        
        # Check CORS configuration
        cors_info = {
            'allowed_origins': app.config.get('CORS_ORIGINS', []),
            'origin_allowed': request.headers.get('Origin') in app.config.get('CORS_ORIGINS', []),
            'supports_credentials': True
        }
        
        # System information
        system_info = {
            'server_time': current_time.isoformat(),
            'timezone': str(SERVER_TIMEZONE) if 'SERVER_TIMEZONE' in globals() else 'UTC',
            'flask_env': app.config.get('ENV', 'production'),
            'debug_mode': app.config.get('DEBUG', False),
            'api_version': '1.0.0'  # You can track your API version here
        }
        
        # Mobile API specific endpoints status
        mobile_endpoints = [
            '/api/mobile/jobs/<int:job_id>',
            '/api/mobile/jobs/<int:job_id>/start',
            '/api/mobile/jobs/<int:job_id>/complete',
            '/api/mobile/doors/<int:door_id>/complete',
            '/api/mobile/doors/<int:door_id>/media/upload',
            '/api/mobile/doors/<int:door_id>/media',
            '/api/mobile/media/<int:media_id>/<media_type>',
            '/api/mobile/jobs/<int:job_id>/line-items/<int:line_item_id>/toggle'
        ]
        
        # Count available jobs for authenticated users
        available_jobs_count = 0
        if current_user.is_authenticated:
            try:
                available_jobs_count = Job.query.filter(
                    Job.status.in_(['scheduled', 'in_progress'])
                ).count()
            except Exception:
                available_jobs_count = 'error'
        
        # Build comprehensive response
        response_data = {
            'status': 'success',
            'message': 'Mobile API is operational',
            'timestamp': current_time.isoformat(),
            
            # Database status
            'database': {
                'status': db_status,
                'error': db_error
            },
            
            # Authentication information
            'authentication': auth_status,
            
            # Request details for debugging
            'request': request_info,
            
            # CORS configuration
            'cors': cors_info,
            
            # System information
            'system': system_info,
            
            # Mobile API endpoints
            'mobile_endpoints': {
                'available': mobile_endpoints,
                'count': len(mobile_endpoints)
            },
            
            # Job data summary
            'job_summary': {
                'available_jobs': available_jobs_count,
                'note': 'Available jobs include scheduled and in-progress jobs'
            },
            
            # API capabilities
            'capabilities': [
                'job_data_retrieval',
                'job_start_stop',
                'door_completion',
                'media_upload',
                'media_viewing',
                'line_item_tracking',
                'signature_capture',
                'offline_sync'
            ],
            
            # Health check details
            'health': {
                'api_responsive': True,
                'database_accessible': db_status == 'connected',
                'authentication_working': True,
                'file_upload_ready': os.path.exists(MOBILE_UPLOAD_FOLDER) if 'MOBILE_UPLOAD_FOLDER' in globals() else False
            }
        }
        
        # Add warnings for common configuration issues
        warnings = []
        
        if not cors_info['origin_allowed'] and request.headers.get('Origin'):
            warnings.append(f"Origin '{request.headers.get('Origin')}' is not in CORS_ORIGINS")
        
        if db_status != 'connected':
            warnings.append("Database connection failed")
        
        if not current_user.is_authenticated:
            warnings.append("No user authenticated - some endpoints will require login")
        
        if warnings:
            response_data['warnings'] = warnings
        
        # Log successful test for monitoring
        logging.info(f"Mobile API test successful - User: {current_user.username if current_user.is_authenticated else 'anonymous'}, "
                    f"Origin: {request.headers.get('Origin', 'none')}")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        # Log the error
        logging.error(f"Mobile API test endpoint failed: {str(e)}", exc_info=True)
        
        # Return error response with debugging information
        error_response = {
            'status': 'error',
            'message': 'Mobile API test failed',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat(),
            'error_type': type(e).__name__,
            
            # Basic request info even in error state
            'request': {
                'method': request.method,
                'url': request.url,
                'remote_addr': request.remote_addr
            }
        }
        
        return jsonify(error_response), 500
    
    
@app.route('/api/mobile/media/<int:media_id>/serve', methods=['GET'])
@login_required
def serve_door_media(media_id):
    """Serve door media files"""
    try:
        media = DoorMedia.query.get_or_404(media_id)
        
        if not os.path.exists(media.file_path):
            return jsonify({'error': 'Media file not found'}), 404
        
        return send_from_directory(
            os.path.dirname(media.file_path),
            os.path.basename(media.file_path),
            mimetype=media.mime_type
        )
        
    except Exception as e:
        logger.error(f"Error serving media {media_id}: {str(e)}")
        return jsonify({'error': 'Failed to serve media'}), 500

# Debug and test routes (remove these in production)
@app.route('/api/debug/routes', methods=['GET'])
def debug_routes():
    """Debug endpoint to see all registered routes"""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'rule': str(rule)
        })
    
    # Filter for mobile routes specifically
    mobile_routes = [r for r in routes if 'mobile' in r['rule']]
    
    return jsonify({
        'all_routes_count': len(routes),
        'mobile_routes': mobile_routes,
        'looking_for': '/api/mobile/jobs/<int:job_id>'
    })


@login_required
@admin_required
def create_user():
    """Create a new user (admin only)"""
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['username', 'email', 'first_name', 'last_name', 'role', 'password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if username or email already exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Validate role
        if data['role'] not in ['admin', 'field']:
            return jsonify({'error': 'Role must be either admin or field'}), 400
        
        # Create new user
        user = User(
            username=data['username'],
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            role=data['role'],
            is_active=data.get('is_active', True)
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'User created successfully',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating user: {str(e)}")
        return jsonify({'error': 'Failed to create user'}), 500

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@login_required
@admin_required
def update_user(user_id):
    """Update a user (admin only)"""
    try:
        user = User.query.get_or_404(user_id)
        data = request.json
        
        # Update allowed fields
        if 'email' in data:
            # Check if email is already taken by another user
            existing_user = User.query.filter_by(email=data['email']).first()
            if existing_user and existing_user.id != user_id:
                return jsonify({'error': 'Email already exists'}), 400
            user.email = data['email']
        
        if 'first_name' in data:
            user.first_name = data['first_name']
        
        if 'last_name' in data:
            user.last_name = data['last_name']
        
        if 'role' in data:
            if data['role'] not in ['admin', 'field']:
                return jsonify({'error': 'Role must be either admin or field'}), 400
            user.role = data['role']
        
        if 'is_active' in data:
            user.is_active = data['is_active']
        
        # Handle password change
        if 'password' in data and data['password']:
            if len(data['password']) < 6:
                return jsonify({'error': 'Password must be at least 6 characters long'}), 400
            user.set_password(data['password'])
        
        db.session.commit()
        
        return jsonify({
            'message': 'User updated successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating user: {str(e)}")
        return jsonify({'error': 'Failed to update user'}), 500

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_user(user_id):
    """Delete a user (admin only)"""
    try:
        user = User.query.get_or_404(user_id)
        
        # Prevent deletion of the current user
        if user.id == current_user.id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({'message': 'User deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting user: {str(e)}")
        return jsonify({'error': 'Failed to delete user'}), 500

@app.route('/api/users/<int:user_id>/reset-password', methods=['POST'])
@login_required
@admin_required
def reset_user_password(user_id):
    """Reset a user's password (admin only)"""
    try:
        user = User.query.get_or_404(user_id)
        data = request.json
        
        new_password = data.get('new_password')
        if not new_password:
            return jsonify({'error': 'New password is required'}), 400
        
        if len(new_password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters long'}), 400
        
        user.set_password(new_password)
        db.session.commit()
        
        return jsonify({'message': 'Password reset successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error resetting password: {str(e)}")
        return jsonify({'error': 'Failed to reset password'}), 500

def format_date_for_response(date_obj):
    """
    Format a date object for consistent API responses.
    For job scheduling, we want to preserve the exact date (without time) to
    prevent timezone conversion issues.
    
    Args:
        date_obj (date or datetime): The date to format
        
    Returns:
        str: Formatted date string in ISO format
    """
    if not date_obj:
        return None
        
    if isinstance(date_obj, datetime):
        # Make datetime timezone-aware if it isn't already
        if date_obj.tzinfo is None:
            date_obj = SERVER_TIMEZONE.localize(date_obj)
        # For jobs, we just want the date part in YYYY-MM-DD format
        return date_obj.date().isoformat()
    elif isinstance(date_obj, date):
        # Already just a date
        return date_obj.isoformat()
    
    # Fallback - shouldn't reach here
    return str(date_obj)

def parse_job_date(date_str):
    """
    Parse a date string for job scheduling, returning a date object
    without time component to prevent timezone issues.
    
    Args:
        date_str (str): Date string to parse
        
    Returns:
        date: Parsed date object (without time)
    """
    logger.info(f"Parsing job date: '{date_str}'")
    
    if not date_str:
        return None
    
    try:
        # Case 1: ISO format with timezone
        if 'T' in date_str and (date_str.endswith('Z') or '+' in date_str or '-' in date_str.split('T')[1]):
            logger.info(f"Parsing job date with timezone: {date_str}")
            # Parse the date and extract just the date part
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            # Convert to server timezone
            dt = dt.astimezone(SERVER_TIMEZONE)
            logger.info(f"Extracted date part: {dt.date()}")
            return dt.date()
            
        # Case 2: ISO format without timezone (2023-05-21T10:00:00)
        elif 'T' in date_str:
            logger.info(f"Parsing job date with time but no timezone: {date_str}")
            # Just parse the date part
            date_part = date_str.split('T')[0]
            year, month, day = map(int, date_part.split('-'))
            return date(year, month, day)
            
        # Case 3: Simple date format (2023-05-21)
        elif date_str.count('-') == 2:
            logger.info(f"Parsing simple YYYY-MM-DD format: {date_str}")
            year, month, day = map(int, date_str.split('-'))
            return date(year, month, day)
            
        # Case 4: Other date formats
        else:
            logger.info(f"Attempting to parse with datetime: {date_str}")
            # Try standard parsing but extract just the date part
            dt = datetime.fromisoformat(date_str)
            return dt.date()
            
    except Exception as e:
        logger.error(f"Error parsing job date '{date_str}': {str(e)}")
        raise ValueError(f"Invalid date format: {str(e)}")

def parse_datetime_with_logging(date_str, hour=None, minute=None):
    """
    Parse date string with detailed logging to diagnose timezone issues.
    
    Args:
        date_str (str): Date string to parse
        hour (int, optional): Hour value if provided separately
        minute (int, optional): Minute value if provided separately
        
    Returns:
        datetime: Parsed datetime object preserving the intended time
    """
    logger.info(f"Parsing date string: '{date_str}', hour: {hour}, minute: {minute}")
    
    if not date_str:
        logger.warning("Empty date string provided")
        return None
    
    try:
        # Case 1: ISO format with timezone information (2023-05-21T10:00:00Z or 2023-05-21T10:00:00+00:00)
        if ('T' in date_str and 
            (date_str.endswith('Z') or '+' in date_str or '-' in date_str.split('T')[1])):
            
            logger.info(f"Detected ISO format with timezone: {date_str}")
            
            # Replace Z with +00:00 for ISO format compatibility
            if date_str.endswith('Z'):
                date_str = date_str[:-1] + '+00:00'
                logger.info(f"Replaced Z with +00:00: {date_str}")
            
            # Parse ISO format with timezone
            dt = datetime.fromisoformat(date_str)
            logger.info(f"Parsed with timezone: {dt} (UTC)")
            
            # Convert to server timezone to preserve the time
            local_dt = dt.astimezone(SERVER_TIMEZONE)
            logger.info(f"Converted to server timezone: {local_dt} ({SERVER_TIMEZONE})")
            
            return local_dt
        
        # Case 2: ISO format without timezone (2023-05-21T10:00:00)
        elif 'T' in date_str:
            logger.info(f"Detected ISO format without timezone: {date_str}")
            
            # Parse the datetime components
            date_part, time_part = date_str.split('T')
            year, month, day = map(int, date_part.split('-'))
            
            # Parse time with proper handling of seconds/milliseconds
            time_parts = time_part.split(':')
            hour_val = int(time_parts[0])
            minute_val = int(time_parts[1])
            
            # Handle seconds if present
            second_val = 0
            if len(time_parts) > 2:
                # Remove milliseconds if present
                seconds_part = time_parts[2].split('.')[0]
                second_val = int(seconds_part)
            
            # Create datetime with the exact time specified - crucial to preserve
            naive_dt = datetime(year, month, day, hour_val, minute_val, second_val)
            logger.info(f"Created naive datetime: {naive_dt}")
            
            # Localize to server timezone (treating the input as local time)
            local_dt = SERVER_TIMEZONE.localize(naive_dt)
            logger.info(f"Localized to server timezone: {local_dt}")
            
            return local_dt
        
        # Case 3: Simple date format (2023-05-21) with explicit time parameters
        elif re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
            logger.info(f"Detected date-only format: {date_str}")
            
            year, month, day = map(int, date_str.split('-'))
            
            # Use provided hour/minute or default to noon
            hour_val = hour if hour is not None else 12
            minute_val = minute if minute is not None else 0
            
            logger.info(f"Using time components: hour={hour_val}, minute={minute_val}")
            
            # Create datetime with specified or default time
            naive_dt = datetime(year, month, day, hour_val, minute_val, 0)
            logger.info(f"Created naive datetime with specified time: {naive_dt}")
            
            # Localize to server timezone
            local_dt = SERVER_TIMEZONE.localize(naive_dt)
            logger.info(f"Localized to server timezone: {local_dt}")
            
            return local_dt
            
        # Case 4: Any other format - try standard parsing
        else:
            logger.warning(f"Unrecognized date format: {date_str}, attempting standard parsing")
            dt = datetime.fromisoformat(date_str)
            logger.info(f"Parsed with standard method: {dt}")
            return dt
            
    except Exception as e:
        logger.error(f"Error parsing date '{date_str}': {str(e)}")
        raise ValueError(f"Invalid date format: {str(e)}")

def format_datetime_for_response(dt):
    """
    Format datetime for consistent API responses.
    
    Args:
        dt (datetime): Datetime object to format
        
    Returns:
        str: Formatted datetime string
    """
    if not dt:
        return None
        
    # Ensure timezone awareness
    if dt.tzinfo is None:
        dt = SERVER_TIMEZONE.localize(dt)
        
    # ISO format with timezone information
    iso_format = dt.isoformat()
    logger.info(f"Formatted datetime for response: {iso_format}")
    return iso_format

def generate_job_number():
    today = date.today()
    
    # Use the specific 2-letter month codes
    month_codes = {
        1: "JA", 2: "FB", 3: "MR", 4: "AP", 5: "MY", 6: "JU",
        7: "JL", 8: "AG", 9: "SP", 10: "OT", 11: "NV", 12: "DC"
    }
    month_code = month_codes[today.month]
    
    # Get count of jobs created this month (INCLUDING today)
    month_start = date(today.year, today.month, 1)
    month_end = date(today.year, today.month + 1, 1) if today.month < 12 else date(today.year + 1, 1, 1)
    
    # Count ALL jobs in current month, including today
    month_jobs = Job.query.filter(
        Job.created_at >= month_start,
        Job.created_at < month_end
    ).count()
    
    # Add 1 to the count for the new job number
    job_number = f"{month_code}{month_jobs + 1}{str(today.year)[2:]}"
    return job_number

@app.route('/api/estimates/<int:estimate_id>/schedule', methods=['POST'])
def schedule_estimate(estimate_id):
    try:
        estimate = Estimate.query.get_or_404(estimate_id)
        data = request.json
        
        # Log the incoming data for debugging
        logger.info(f"Received scheduling data for estimate {estimate_id}: {data}")
        
        # Validate required field
        if not data.get('scheduled_date'):
            return jsonify({'error': 'scheduled_date is required'}), 400
            
        # Parse scheduled date string with consistent timezone handling
        try:
            date_str = data['scheduled_date']
            
            # Extract hour and minute from data if available
            hour = data.get('hour')
            minute = data.get('minute')
            
            # Parse the date with extra logging
            scheduled_date = parse_datetime_with_logging(date_str, hour, minute)
            
            # Log the result of parsing
            logger.info(f"Parsed date for estimate {estimate_id}: {scheduled_date}")
            
        except ValueError as e:
            logger.error(f"Date parsing error for estimate {estimate_id}: {str(e)}")
            return jsonify({'error': f'Invalid date format: {str(e)}'}), 400
            
        # Update estimate with scheduling information
        estimate.scheduled_date = scheduled_date
        estimate.estimator_id = data.get('estimator_id', 1)
        estimate.estimator_name = data.get('estimator_name', 'Brett')
        estimate.duration = data.get('duration', 60)
        estimate.schedule_notes = data.get('schedule_notes', '')
        
        db.session.commit()
        
        # Format the response with consistent datetime format
        result = {
            'id': estimate.id,
            'customer_id': estimate.customer_id,
            'customer_name': estimate.customer_direct_link.name,
            'site_id': estimate.site_id,
            'site_address': estimate.site.address if estimate.site else None,
            'site_name': estimate.site.name if estimate.site else None,
            'status': estimate.status,
            'created_at': format_datetime_for_response(estimate.created_at),
            'scheduled_date': format_datetime_for_response(estimate.scheduled_date),
            'estimator_id': estimate.estimator_id,
            'estimator_name': estimate.estimator_name,
            'duration': estimate.duration,
            'schedule_notes': estimate.schedule_notes
        }
        
        logger.info(f"Successfully scheduled estimate {estimate_id} for {result['scheduled_date']}")
        
        return jsonify(result), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error scheduling estimate {estimate_id}: {str(e)}")
        return jsonify({'error': f'Failed to schedule estimate: {str(e)}'}), 500

@app.route('/api/bids/<int:bid_id>/doors/<int:door_id>', methods=['DELETE'])
def delete_door(bid_id, door_id):
    """
    Delete a door and all its line items from a bid
    
    Args:
        bid_id (int): The ID of the bid
        door_id (int): The ID of the door to delete
        
    Returns:
        JSON response confirming deletion
    """
    try:
        # Verify bid exists
        bid = Bid.query.get_or_404(bid_id)
        
        # Verify door exists and belongs to the specified bid
        door = Door.query.get_or_404(door_id)
        if door.bid_id != bid_id:
            return jsonify({'error': 'Door does not belong to the specified bid'}), 400
            
        # Check if this is the last door in the bid (optional validation)
        doors_count = Door.query.filter_by(bid_id=bid_id).count()
        if doors_count <= 1:
            return jsonify({'error': 'Cannot delete the last door in a bid. A bid must have at least one door.'}), 400
            
        # First, delete all line items for this door
        LineItem.query.filter_by(door_id=door_id).delete()
        
        # Then delete the door itself
        db.session.delete(door)
        db.session.commit()
        
        # Update the bid's total cost (you may need to recalculate)
        # This could be handled by a trigger or by a separate function
        
        return jsonify({
            'success': True,
            'message': f'Door {door_id} and all its line items deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting door: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to delete door: {str(e)}'}), 500

@app.route('/api/bids/<int:bid_id>/save-changes', methods=['PUT'])
def save_bid_changes(bid_id):
    """
    Save bulk changes to a bid including multiple doors and their line items.
    
    Expected JSON format:
    {
        "doors": [
            {
                "door_id": 123,
                "line_items": [
                    {
                        "id": 456,
                        "description": "...",
                        "quantity": 1,
                        "price": 100.0,
                        "labor_hours": 2.0,
                        "hardware": 50.0
                    }
                ]
            }
        ]
    }
    
    Args:
        bid_id (int): The ID of the bid to save changes for
        
    Returns:
        JSON response confirming the save operation
    """
    try:
        # Verify bid exists
        bid = Bid.query.get_or_404(bid_id)
        
        # Get the request data
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        doors_data = data.get('doors', [])
        if not doors_data:
            return jsonify({'error': 'No doors data provided'}), 400
            
        updated_items = []
        errors = []
        
        # Process each door's changes
        for door_change in doors_data:
            door_id = door_change.get('door_id')
            line_items_data = door_change.get('line_items', [])
            
            if not door_id:
                errors.append('Missing door_id in door data')
                continue
                
            # Verify door exists and belongs to this bid
            door = Door.query.get(door_id)
            if not door:
                errors.append(f'Door {door_id} not found')
                continue
                
            if door.bid_id != bid_id:
                errors.append(f'Door {door_id} does not belong to bid {bid_id}')
                continue
                
            # Process each line item update
            for item_data in line_items_data:
                item_id = item_data.get('id')
                if not item_id:
                    errors.append('Missing line item ID')
                    continue
                    
                # Find the line item
                line_item = LineItem.query.get(item_id)
                if not line_item:
                    errors.append(f'Line item {item_id} not found')
                    continue
                    
                if line_item.door_id != door_id:
                    errors.append(f'Line item {item_id} does not belong to door {door_id}')
                    continue
                    
                # Update the line item with validated data
                try:
                    if 'description' in item_data:
                        line_item.description = str(item_data['description']).strip()
                        
                    if 'quantity' in item_data:
                        quantity = float(item_data['quantity'])
                        if quantity <= 0:
                            errors.append(f'Invalid quantity {quantity} for item {item_id}')
                            continue
                        line_item.quantity = quantity
                        
                    if 'price' in item_data:
                        price = float(item_data['price'])
                        if price < 0:
                            errors.append(f'Invalid price {price} for item {item_id}')
                            continue
                        line_item.price = price
                        
                    if 'labor_hours' in item_data:
                        labor_hours = float(item_data['labor_hours'])
                        if labor_hours < 0:
                            errors.append(f'Invalid labor_hours {labor_hours} for item {item_id}')
                            continue
                        line_item.labor_hours = labor_hours
                        
                    if 'hardware' in item_data:
                        hardware = float(item_data['hardware'])
                        if hardware < 0:
                            errors.append(f'Invalid hardware cost {hardware} for item {item_id}')
                            continue
                        line_item.hardware = hardware
                        
                    updated_items.append({
                        'item_id': item_id,
                        'door_id': door_id,
                        'description': line_item.description
                    })
                    
                except (ValueError, TypeError) as e:
                    errors.append(f'Invalid data for item {item_id}: {str(e)}')
                    continue
        
        # If there were validation errors, return them without saving
        if errors:
            return jsonify({
                'success': False,
                'errors': errors,
                'message': 'Validation errors occurred. No changes were saved.'
            }), 400
            
        # If no errors, commit all changes
        db.session.commit()
        
        # Recalculate bid totals after saving
        total_parts_cost = 0
        total_labor_cost = 0
        total_hardware_cost = 0
        
        for door in bid.doors:
            for item in door.line_items:
                item_total = item.price * item.quantity
                total_parts_cost += item_total
                total_labor_cost += item.labor_hours * 47.02  # $47.02 per hour
                total_hardware_cost += item.hardware
        
        # Calculate tax and total
        tax_rate = 0.0875
        tax_amount = (total_parts_cost + total_hardware_cost) * tax_rate
        total_cost = total_parts_cost + total_labor_cost + total_hardware_cost + tax_amount
        
        # Update bid total
        bid.total_cost = total_cost
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Successfully updated {len(updated_items)} line items',
            'updated_items': updated_items,
            'bid_totals': {
                'total_parts_cost': total_parts_cost,
                'total_labor_cost': total_labor_cost,
                'total_hardware_cost': total_hardware_cost,
                'tax_amount': tax_amount,
                'total_cost': total_cost
            }
        }), 200
        
    except Exception as e:
        # Roll back any changes if an error occurs
        db.session.rollback()
        
        # Log the error for debugging
        print(f"Error saving bid changes for bid {bid_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': f'Failed to save bid changes: {str(e)}',
            'error_type': type(e).__name__
        }), 500

@app.route('/api/bids/<int:bid_id>/save-complete', methods=['PUT'])
def save_complete_bid(bid_id):
    """
    Save complete bid data including metadata and all doors/line items.
    This is a more comprehensive save operation for full bid updates.
    
    Expected JSON format:
    {
        "bid_metadata": {
            "status": "draft",
            "notes": "..."
        },
        "doors": [
            {
                "id": 123,
                "door_number": 1,
                "location": "Front Entrance",
                "description": "...",
                "line_items": [
                    {
                        "id": 456,
                        "description": "...",
                        "quantity": 1,
                        "price": 100.0,
                        "labor_hours": 2.0,
                        "hardware": 50.0,
                        "part_number": "..."
                    }
                ]
            }
        ],
        "totals": {
            "totalQuantity": 10,
            "totalPartsPrice": 1000.0,
            "totalLaborHours": 20.0,
            "totalLaborCost": 940.4,
            "totalHardwareCost": 500.0,
            "totalBeforeTax": 2440.4,
            "taxAmount": 131.25,
            "totalWithTax": 2571.65,
            "doorCount": 3
        }
    }
    
    Args:
        bid_id (int): The ID of the bid to save
        
    Returns:
        JSON response confirming the save operation
    """
    try:
        # Verify bid exists
        bid = Bid.query.get_or_404(bid_id)
        
        # Get the request data
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Update bid metadata if provided
        bid_metadata = data.get('bid_metadata', {})
        if bid_metadata:
            if 'status' in bid_metadata:
                bid.status = bid_metadata['status']
            # Add other bid fields as needed
            
        # Process doors data if provided
        doors_data = data.get('doors', [])
        updated_doors = []
        updated_items = []
        
        for door_data in doors_data:
            door_id = door_data.get('id')
            if not door_id:
                continue
                
            # Find the door
            door = Door.query.get(door_id)
            if not door or door.bid_id != bid_id:
                continue
                
            # Update door properties if provided
            if 'door_number' in door_data:
                door.door_number = door_data['door_number']
            if 'location' in door_data:
                # Note: You may need to add a location field to the Door model
                pass
            if 'description' in door_data:
                # Note: You may need to add a description field to the Door model
                pass
                
            updated_doors.append(door_id)
            
            # Process line items for this door
            line_items_data = door_data.get('line_items', [])
            for item_data in line_items_data:
                item_id = item_data.get('id')
                if not item_id:
                    continue
                    
                line_item = LineItem.query.get(item_id)
                if not line_item or line_item.door_id != door_id:
                    continue
                    
                # Update line item fields with validation
                try:
                    if 'description' in item_data:
                        line_item.description = str(item_data['description']).strip()
                    if 'quantity' in item_data:
                        line_item.quantity = max(0, float(item_data['quantity']))
                    if 'price' in item_data:
                        line_item.price = max(0, float(item_data['price']))
                    if 'labor_hours' in item_data:
                        line_item.labor_hours = max(0, float(item_data['labor_hours']))
                    if 'hardware' in item_data:
                        line_item.hardware = max(0, float(item_data['hardware']))
                    if 'part_number' in item_data:
                        line_item.part_number = str(item_data['part_number']).strip()
                        
                    updated_items.append(item_id)
                    
                except (ValueError, TypeError) as e:
                    print(f"Error updating line item {item_id}: {str(e)}")
                    continue
        
        # Save all changes
        db.session.commit()
        
        # Recalculate and update bid totals
        total_parts_cost = 0
        total_labor_cost = 0
        total_hardware_cost = 0
        
        for door in bid.doors:
            for item in door.line_items:
                item_total = item.price * item.quantity
                total_parts_cost += item_total
                total_labor_cost += item.labor_hours * 47.02
                total_hardware_cost += item.hardware
        
        tax_rate = 0.0875
        tax_amount = (total_parts_cost + total_hardware_cost) * tax_rate
        total_cost = total_parts_cost + total_labor_cost + total_hardware_cost + tax_amount
        
        bid.total_cost = total_cost
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Complete bid save successful',
            'updated_doors': len(updated_doors),
            'updated_items': len(updated_items),
            'calculated_totals': {
                'total_parts_cost': total_parts_cost,
                'total_labor_cost': total_labor_cost,
                'total_hardware_cost': total_hardware_cost,
                'tax_amount': tax_amount,
                'total_cost': total_cost
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error saving complete bid {bid_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': f'Failed to save complete bid: {str(e)}',
            'error_type': type(e).__name__
        }), 500
               
@app.route('/api/bids/<int:bid_id>/auto-save', methods=['PUT'])
def auto_save_bid(bid_id):
    """
    Lightweight auto-save endpoint for automatic periodic saves.
    Only saves essential changes without heavy validation or recalculation.
    
    Args:
        bid_id (int): The ID of the bid to auto-save
        
    Returns:
        JSON response confirming the auto-save operation
    """
    try:
        # Verify bid exists
        bid = Bid.query.get_or_404(bid_id)
        
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
            
        # Update last modified timestamp
        if 'last_modified' in data:
            # You may need to add a last_modified field to the Bid model
            pass
            
        # Process minimal door/line item updates
        doors_data = data.get('doors', [])
        for door_data in doors_data:
            door_id = door_data.get('id')
            if not door_id:
                continue
                
            line_items_data = door_data.get('line_items', [])
            for item_data in line_items_data:
                item_id = item_data.get('id')
                if not item_id:
                    continue
                    
                line_item = LineItem.query.get(item_id)
                if not line_item:
                    continue
                    
                # Update only the essential fields for auto-save
                try:
                    if 'description' in item_data:
                        line_item.description = str(item_data['description'])
                    if 'quantity' in item_data:
                        line_item.quantity = float(item_data['quantity'])
                    if 'price' in item_data:
                        line_item.price = float(item_data['price'])
                    if 'labor_hours' in item_data:
                        line_item.labor_hours = float(item_data['labor_hours'])
                    if 'hardware' in item_data:
                        line_item.hardware = float(item_data['hardware'])
                except (ValueError, TypeError):
                    # Silently skip invalid data in auto-save
                    continue
        
        # Commit the auto-save changes
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Auto-save completed',
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        # Auto-save failures should be silent
        print(f"Auto-save failed for bid {bid_id}: {str(e)}")
        
        return jsonify({
            'success': False,
            'error': 'Auto-save failed',
            'timestamp': datetime.utcnow().isoformat()
        }), 200  # Return 200 to avoid disrupting user workflow

@app.route('/api/estimates/<int:estimate_id>/unschedule', methods=['POST'])
def unschedule_estimate(estimate_id):
    """
    Cancel scheduling for an estimate (removes scheduled_date)
    """
    try:
        estimate = Estimate.query.get_or_404(estimate_id)
        
        # Remove scheduling information
        estimate.scheduled_date = None
        estimate.schedule_notes = None
        # Keep estimator information for reference
        
        db.session.commit()
        
        # Format the response
        result = {
            'id': estimate.id,
            'customer_id': estimate.customer_id,
            'customer_name': estimate.customer_direct_link.name,
            'site_id': estimate.site_id,
            'site_address': estimate.site.address if estimate.site else None,
            'site_name': estimate.site.name if estimate.site else None,
            'status': estimate.status,
            'created_at': estimate.created_at,
            'scheduled_date': None,
            'estimator_id': estimate.estimator_id,
            'estimator_name': estimate.estimator_name,
            'duration': estimate.duration,
            'schedule_notes': None
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error unscheduling estimate: {str(e)}")
        return jsonify({'error': 'Failed to unschedule estimate'}), 500

@app.route('/api/audio/<int:recording_id>/transcribe', methods=['POST'])
def transcribe_audio(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    if not os.path.exists(recording.file_path):
        return jsonify({'error': 'Audio file not found'}), 404
    
    try:
        # Set up the OpenAI client
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

        
        print(f"Processing audio file: {recording.file_path}")
        file_size = os.path.getsize(recording.file_path)
        file_ext = os.path.splitext(recording.file_path)[1].lower()
        print(f"File size: {file_size} bytes, extension: {file_ext}")
        
        # Convert the file to a supported format using pydub if possible
        try:
            import tempfile
            from pydub import AudioSegment
            
            # Create a temporary WAV file (most compatible format)
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
            
            print(f"Converting audio to WAV format: {temp_path}")
            sound = AudioSegment.from_file(recording.file_path)
            sound.export(temp_path, format="wav")
            
            print(f"Conversion successful. File size: {os.path.getsize(temp_path)} bytes")
            
            # Open the temporary WAV file for transcription
            with open(temp_path, "rb") as audio_file:
                # Call the OpenAI API to transcribe the audio
                print(f"Sending file to OpenAI API for transcription")
                response = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file
                )
                
                # Extract the transcript text
                transcript = response.text
                
                # Save transcript to database
                recording.transcript = transcript
                db.session.commit()
                
                # Clean up the temporary file
                try:
                    os.remove(temp_path)
                except:
                    pass
                
                return jsonify({
                    'id': recording.id,
                    'transcript': transcript
                }), 200
                
        except ImportError:
            print("pydub not available, trying direct transcription")
            # Fallback to direct transcription if pydub is not available
            with open(recording.file_path, "rb") as audio_file:
                # Call the OpenAI API to transcribe the audio
                print(f"Sending file directly to OpenAI API for transcription")
                response = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file
                )
                
                # Extract the transcript text
                transcript = response.text
                
                # Save transcript to database
                recording.transcript = transcript
                db.session.commit()
                
                return jsonify({
                    'id': recording.id,
                    'transcript': transcript
                }), 200
                
    except Exception as e:
        # Log the detailed error
        print(f"Transcription error for recording {recording_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({'error': str(e)}), 500

@app.route('/api/audio/<int:recording_id>/process-with-ai', methods=['POST'])
def process_audio_with_ai(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    if not recording.transcript:
        return jsonify({'error': 'No transcript available. Please transcribe the audio first.'}), 400
    
    try:
        # Increase timeout for client
        client = OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY"),
            timeout=120.0  # Increase timeout to 120 seconds (2 minutes)
        )
        
        # Extract the transcript
        transcript = recording.transcript
        
        # More robust prompt for multiple doors
        prompt = """
        Analyze this transcript about door installations, repairs, or related work. Extract information about EACH door or door component mentioned.
        
        Transcript: {}
        
        IMPORTANT: Create a SEPARATE JSON object for EACH door mentioned in the transcript. If multiple doors are described (e.g. "front door", "garage door", "kitchen door"), each should have its own object.
        
        Return a JSON array where each object represents a distinct door with these properties:
        - door_number (number, default to sequence number if not explicitly mentioned)
        - location (string, EXACT location mentioned like "Front door", "Kitchen door", "Garage bay 2", etc.)
        - dimensions (object with width, height, unit if mentioned)
        - type (string, like entry, garage, interior, etc.)
        - material (string)
        - components (array of strings - parts mentioned like tracks, springs, hardware, etc.)
        - labor_description (string - description of work being done)
        - notes (string - any other relevant details)
        
        Only include properties that are explicitly mentioned in the transcript.
        CRITICAL: Identify each distinct door as a separate object, even if door numbers aren't explicitly mentioned.
        """.format(transcript)
        
        # Log the prompt for debugging
        print(f"Sending prompt to OpenAI with increased timeout:\n{prompt}")
        
        # Call the OpenAI API with increased timeout
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts structured information about door installations and repairs from audio transcripts. Always return valid JSON with an array of door objects. Each distinct door (by location or number) should be a separate object in the array."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
            timeout=90  # Set a 90 second timeout for the API call
        )
        
        # Extract and log the content
        content = response.choices[0].message.content
        print(f"OpenAI response: {content}")
        
        # Parse the JSON response
        try:
            response_data = json.loads(content)
            
            # Handle different response formats to ensure we always have an array of doors
            doors_data = []
            
            if isinstance(response_data, dict):
                # Check if the response is a dict with an array
                for key, value in response_data.items():
                    if isinstance(value, list):
                        doors_data = value
                        break
                else:
                    # If no array found in the dict, check if it's a single door object
                    if 'door_number' in response_data or 'location' in response_data:
                        doors_data = [response_data]  # Convert single object to array
                    else:
                        # Create a generic door
                        doors_data = [{
                            "door_number": 1,
                            "location": "Unspecified location",
                            "labor_description": "Work described in recording",
                            "notes": transcript
                        }]
            elif isinstance(response_data, list):
                doors_data = response_data
            else:
                # Fallback for unexpected data
                doors_data = [{
                    "door_number": 1,
                    "location": "Unspecified location",
                    "labor_description": "Work described in recording",
                    "notes": transcript
                }]
                
            print(f"Parsed doors_data: {doors_data}")
            
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {str(e)}")
            print(f"Content that failed to parse: {content}")
            
            # Create a fallback structure
            doors_data = [{
                "door_number": 1,
                "location": "Error parsing transcript",
                "labor_description": "Door work described in recording",
                "notes": transcript
            }]
        
        # Process the doors data to match the frontend format
        doors = []
        for i, door_data in enumerate(doors_data):
            # Defensive programming - make sure door_data is a dict
            if not isinstance(door_data, dict):
                print(f"Warning: Expected dict but got {type(door_data)}: {door_data}")
                continue
                
            # Get door number from the data, or use index+1 as fallback
            door_number = door_data.get('door_number', i+1)
            
            # Create a list of details
            details = []
            
            # Add location if available
            location = door_data.get('location', f"Door {door_number}")
            if location:
                details.append(f"Location: {location}")
            
            # Add dimensions if available
            dimensions = door_data.get('dimensions')
            if dimensions and isinstance(dimensions, dict):
                width = dimensions.get('width')
                height = dimensions.get('height')
                unit = dimensions.get('unit', 'inches')
                if width and height:
                    details.append(f"Dimensions: {width} x {height} {unit}")
            
            # Add type if available, but only if different from location
            door_type = door_data.get('type')
            if door_type and ((not location) or door_type.lower() != location.lower()):
                details.append(f"Type: {door_type}")
            
            # Add material if available
            material = door_data.get('material')
            if material:
                details.append(f"Material: {material}")
            
            # Add components if available
            components = door_data.get('components', [])
            if components and isinstance(components, list):
                details.append(f"Components: {', '.join(components)}")
            
            # Add labor description if available
            labor_desc = door_data.get('labor_description')
            if labor_desc:
                details.append(f"Work Description: {labor_desc}")
            
            # Add notes if available
            notes = door_data.get('notes')
            if notes:
                details.append(f"Notes: {notes}")
            
            # Create the door object with location-based description
            description = f"Door #{door_number}"
            if location:
                description = f"{location} (Door #{door_number})"
                
            door = {
                'door_number': door_number,
                'description': description,
                'details': details,
                'id': str(uuid.uuid4())
            }
            
            doors.append(door)
        
        # If no doors were identified or all entries were invalid, create a generic one
        if not doors:
            doors = [{
                'door_number': 1,
                'description': f"Door work from recording {recording_id}",
                'details': [f"Work description: {transcript}"],
                'id': str(uuid.uuid4())
            }]
        
        return jsonify({
            'recording_id': recording.id,
            'doors': doors
        }), 200
        
    except Exception as e:
        print(f"AI processing error: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()
        
        # Always return a valid response even on error
        doors = [{
            'door_number': 1,
            'description': f"Door work from recording {recording_id}",
            'details': [f"Work description: {transcript}"],
            'id': str(uuid.uuid4())
        }]
        
        return jsonify({
            'recording_id': recording.id,
            'doors': doors,
            'error': str(e)  # Include the error for debugging
        }), 200  # Return 200 even on error to prevent frontend crashes

@app.route('/uploads/<path:filename>', methods=['GET'])
def serve_audio(filename):
    """
    Serve uploaded audio files
    """
    return send_from_directory(UPLOAD_FOLDER, filename)
    
# You may also need to add a route to handle the path generated by the frontend
@app.route('/api/uploads/<path:filename>', methods=['GET'])
def serve_audio_api(filename):
    """
    Serve uploaded audio files through the API path
    """
    return send_from_directory(UPLOAD_FOLDER, filename)
       
# API Routes - Customers
@app.route('/api/customers/<int:customer_id>/sites', methods=['POST'])
def create_site(customer_id):
    """
    Create a new site for a given customer.
    Expects JSON body with at least 'name' field, and optionally address, lockbox_location, contact_name, phone, email.
    """
    customer = Customer.query.get_or_404(customer_id)
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Site name is required'}), 400
    site = Site(
        customer_id=customer_id,
        name=name,
        address=data.get('address', ''),
        lockbox_location=data.get('lockbox_location', ''),
        contact_name=data.get('contact_name', ''),
        phone=data.get('phone', ''),
        email=data.get('email', '')
    )
    db.session.add(site)
    db.session.commit()
    return jsonify({
        'id': site.id,
        'customer_id': site.customer_id,
        'name': site.name,
        'address': site.address,
        'lockbox_location': site.lockbox_location,
        'contact_name': site.contact_name,
        'phone': site.phone,
        'email': site.email,
        'created_at': site.created_at
    }), 201

@app.route('/api/customers', methods=['POST'])
def create_customer():
    try:
        data = request.json
        
        # Validate required fields
        if 'name' not in data or not data['name'].strip():
            return jsonify({'error': 'Customer name is required'}), 400
        
        # Validate email format if provided
        email = data.get('email', '').strip()
        if email:
            import re
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, email):
                return jsonify({'error': 'Please enter a valid email address'}), 400
        
        # Create customer with all fields
        customer = Customer(
            name=data['name'].strip(),
            contact_name=data.get('contact_name', '').strip() or None,
            phone=data.get('phone', '').strip() or None,
            email=email or None,
            address=data.get('address', '').strip() or None
        )
        
        db.session.add(customer)
        db.session.commit()
        
        # Return complete customer data
        return jsonify({
            'id': customer.id,
            'name': customer.name,
            'contact_name': customer.contact_name,
            'phone': customer.phone,
            'email': customer.email,
            'address': customer.address,
            'created_at': customer.created_at.isoformat() if customer.created_at else None
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating customer: {str(e)}")
        return jsonify({'error': f'Failed to create customer: {str(e)}'}), 500

# Updated get_customers route - Replace the existing route
@app.route('/api/customers', methods=['GET'])
def get_customers():
    try:
        customers = Customer.query.all()
        result = []
        for customer in customers:
            result.append({
                'id': customer.id,
                'name': customer.name,
                'contact_name': customer.contact_name,
                'phone': customer.phone,
                'email': customer.email,
                'address': customer.address,
                'created_at': customer.created_at.isoformat() if customer.created_at else None
            })
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error retrieving customers: {str(e)}")
        return jsonify({'error': 'Failed to retrieve customers'}), 500

# Updated get_customer route - Replace the existing route
@app.route('/api/customers/<int:customer_id>', methods=['GET'])
def get_customer(customer_id):
    try:
        customer = Customer.query.get_or_404(customer_id)
        return jsonify({
            'id': customer.id,
            'name': customer.name,
            'contact_name': customer.contact_name,
            'phone': customer.phone,
            'email': customer.email,
            'address': customer.address,
            'created_at': customer.created_at.isoformat() if customer.created_at else None
        })
    except Exception as e:
        logger.error(f"Error retrieving customer {customer_id}: {str(e)}")
        return jsonify({'error': 'Failed to retrieve customer'}), 500

# Updated update_customer route - Replace the existing route
@app.route('/api/customers/<int:customer_id>', methods=['PUT'])
def update_customer(customer_id):
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.json
        
        # Validate email format if provided
        if 'email' in data and data['email']:
            email = data['email'].strip()
            if email:
                import re
                email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                if not re.match(email_pattern, email):
                    return jsonify({'error': 'Please enter a valid email address'}), 400
                customer.email = email
            else:
                customer.email = None
        
        # Update other fields
        if 'name' in data:
            if not data['name'].strip():
                return jsonify({'error': 'Customer name is required'}), 400
            customer.name = data['name'].strip()
        
        if 'contact_name' in data:
            customer.contact_name = data['contact_name'].strip() or None
        
        if 'phone' in data:
            customer.phone = data['phone'].strip() or None
        
        if 'address' in data:
            customer.address = data['address'].strip() or None
        
        db.session.commit()
        
        return jsonify({
            'id': customer.id,
            'name': customer.name,
            'contact_name': customer.contact_name,
            'phone': customer.phone,
            'email': customer.email,
            'address': customer.address,
            'created_at': customer.created_at.isoformat() if customer.created_at else None
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating customer {customer_id}: {str(e)}")
        return jsonify({'error': f'Failed to update customer: {str(e)}'}), 500

# API Routes - Sites
@app.route('/api/customers/<int:customer_id>/sites', methods=['GET'])
def get_customer_sites(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    sites = Site.query.filter_by(customer_id=customer.id).all()
    result = []
    for site in sites:
        result.append({
            'id': site.id,
            'customer_id': site.customer_id,
            'name': site.name,
            'address': site.address,
            'lockbox_location': site.lockbox_location,
            'contact_name': site.contact_name,
            'phone': site.phone,
            'created_at': site.created_at
        })
    return jsonify(result)

@app.route('/api/estimates', methods=['GET'])
def get_estimates():
    """
    Get all estimates with optional filtering
    Now includes scheduling information with proper timezone handling
    """
    try:
        # Join with Customer and Site to get necessary details
        estimates = Estimate.query.join(Site, Estimate.site_id == Site.id)\
                                .join(Customer, Estimate.customer_id == Customer.id)\
                                .all()
        
        result = []
        for estimate in estimates:
            # Format datetimes consistently for the response
            result.append({
                'id': estimate.id,
                'customer_id': estimate.customer_id,
                'customer_name': estimate.customer_direct_link.name, 
                'site_id': estimate.site_id,
                'site_address': estimate.site.address if estimate.site else None,
                'site_name': estimate.site.name if estimate.site else None,
                'status': estimate.status,
                'created_at': format_datetime_for_response(estimate.created_at),
                # Include properly formatted scheduling information
                'scheduled_date': format_datetime_for_response(estimate.scheduled_date),
                'estimator_id': estimate.estimator_id,
                'estimator_name': estimate.estimator_name or 'Brett',
                'duration': estimate.duration or 60,
                'schedule_notes': estimate.schedule_notes
            })
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error retrieving estimates: {str(e)}")
        return jsonify({'error': f'Failed to retrieve estimates: {str(e)}'}), 500

@app.route('/api/estimates', methods=['POST'])
def create_estimate():
    try:
        data = request.json
        
        # Log the incoming data
        logger.info(f"Creating estimate with data: {data}")
        
        customer_id = data.get('customer_id')
        site_id = data.get('site_id')

        if not customer_id:
            return jsonify({'error': 'customer_id is required'}), 400
        if not site_id:
            return jsonify({'error': 'site_id is required'}), 400

        # Check if customer and site exist
        customer = Customer.query.get(customer_id)
        if not customer:
            return jsonify({'error': f'Customer with id {customer_id} not found'}), 404
        
        site = Site.query.get(site_id)
        if not site:
            return jsonify({'error': f'Site with id {site_id} not found'}), 404
        
        if site.customer_id != customer.id:
            return jsonify({'error': f'Site {site_id} does not belong to customer {customer_id}'}), 400
        
        # Process scheduling data if provided
        scheduled_date = None
        if data.get('scheduled_date'):
            try:
                # Extract hour and minute from separate fields if they exist
                hour = data.get('hour')
                minute = data.get('minute')
                
                # Also check for time in schedule_time field
                if data.get('schedule_time'):
                    parsed_hour, parsed_minute = parse_time_string(data.get('schedule_time'))
                    # Use parsed values if available
                    if parsed_hour is not None:
                        hour = parsed_hour
                    if parsed_minute is not None:
                        minute = parsed_minute
                
                # Parse the date with the extracted hour and minute
                scheduled_date = parse_datetime_with_logging(data['scheduled_date'], hour, minute)
                logger.info(f"Parsed scheduled_date for new estimate: {scheduled_date}")
            except ValueError as e:
                logger.error(f"Failed to parse scheduled_date: {str(e)}")
                # Continue without scheduling if date parsing fails
        
        # Create the estimate with all provided fields
        estimate = Estimate(
            customer_id=customer_id,
            site_id=site_id,
            status='pending',
            # Estimate details fields
            title=data.get('title'),
            description=data.get('description'),
            reference_number=data.get('reference_number'),
            estimated_hours=float(data.get('estimated_hours', 0)) if data.get('estimated_hours') else None,
            estimated_cost=float(data.get('estimated_cost', 0)) if data.get('estimated_cost') else None,
            notes=data.get('notes'),
            # Scheduling fields
            scheduled_date=scheduled_date,
            estimator_id=int(data.get('estimator_id', 1)) if data.get('estimator_id') else 1,
            estimator_name=data.get('estimator_name', 'Brett'),
            duration=int(data.get('duration', 60)) if data.get('duration') else 60,
            schedule_notes=data.get('schedule_notes')
        )
        
        db.session.add(estimate)
        db.session.commit()
        
        # Fetch related data for response
        db.session.refresh(estimate)

        # Format the response
        result = {
            'id': estimate.id,
            'customer_id': estimate.customer_id,
            'customer_name': estimate.customer_direct_link.name,
            'site_id': estimate.site_id,
            'site_address': estimate.site.address if estimate.site else None,
            'site_name': estimate.site.name if estimate.site else None,
            'status': estimate.status,
            'created_at': format_datetime_for_response(estimate.created_at),
            'title': estimate.title,
            'description': estimate.description,
            'reference_number': estimate.reference_number,
            'estimated_hours': estimate.estimated_hours,
            'estimated_cost': estimate.estimated_cost,
            'notes': estimate.notes,
            'scheduled_date': format_datetime_for_response(estimate.scheduled_date),
            'estimator_id': estimate.estimator_id,
            'estimator_name': estimate.estimator_name,
            'duration': estimate.duration,
            'schedule_notes': estimate.schedule_notes
        }
        
        logger.info(f"Created estimate {estimate.id}")
        if estimate.scheduled_date:
            logger.info(f"Estimate {estimate.id} scheduled for {format_datetime_for_response(estimate.scheduled_date)}")
        
        return jsonify(result), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating estimate: {str(e)}")
        return jsonify({'error': f'Failed to create estimate: {str(e)}'}), 500
    
@app.route('/api/estimates/<int:estimate_id>/doors', methods=['GET', 'PUT', 'OPTIONS'])
def handle_estimate_doors(estimate_id):
    """
    Enhanced endpoint to handle estimate doors with improved ngrok tunnel support
    GET: Retrieve all doors for an estimate
    PUT: Update the doors for an estimate with comprehensive error handling
    OPTIONS: Handle CORS preflight for ngrok tunnels
    """
    
    # Handle CORS preflight requests for ngrok compatibility
    if request.method == 'OPTIONS':
        response = make_response()
        origin = request.headers.get('Origin')
        
        # Be more permissive with ngrok origins
        if origin and ('ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Methods'] = 'GET, PUT, POST, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Max-Age'] = '86400'
        
        return response, 200
    
    # Verify estimate exists first
    estimate = Estimate.query.get_or_404(estimate_id)
    
    # Add comprehensive logging for debugging ngrok issues
    logger.info(f"[DOORS ENDPOINT] {request.method} request for estimate {estimate_id}")
    logger.info(f"[DOORS ENDPOINT] Origin: {request.headers.get('Origin', 'None')}")
    logger.info(f"[DOORS ENDPOINT] User-Agent: {request.headers.get('User-Agent', 'None')}")
    logger.info(f"[DOORS ENDPOINT] Content-Type: {request.headers.get('Content-Type', 'None')}")
    
    if request.method == 'GET':
        try:
            # Return the stored doors data
            doors = json.loads(estimate.doors_data) if estimate.doors_data else []
            
            response_data = {
                'estimate_id': estimate_id,
                'doors': doors,
                'success': True,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            logger.info(f"[DOORS ENDPOINT] GET successful - returned {len(doors)} doors")
            return jsonify(response_data), 200
            
        except json.JSONDecodeError as e:
            logger.error(f"[DOORS ENDPOINT] JSON decode error: {str(e)}")
            return jsonify({
                'estimate_id': estimate_id,
                'doors': [],
                'success': True,
                'error': 'Invalid doors data, returning empty array',
                'timestamp': datetime.utcnow().isoformat()
            }), 200
        except Exception as e:
            logger.error(f"[DOORS ENDPOINT] GET error: {str(e)}")
            return jsonify({
                'error': f'Failed to retrieve doors: {str(e)}',
                'success': False,
                'timestamp': datetime.utcnow().isoformat()
            }), 500
    
    elif request.method == 'PUT':
        try:
            # Get request data with comprehensive validation
            if not request.is_json:
                logger.error(f"[DOORS ENDPOINT] Invalid content type: {request.headers.get('Content-Type')}")
                return jsonify({
                    'error': 'Request must be JSON',
                    'success': False,
                    'received_content_type': request.headers.get('Content-Type'),
                    'timestamp': datetime.utcnow().isoformat()
                }), 400
            
            data = request.get_json()
            if not data:
                logger.error("[DOORS ENDPOINT] No JSON data received")
                return jsonify({
                    'error': 'No data provided',
                    'success': False,
                    'timestamp': datetime.utcnow().isoformat()
                }), 400
            
            if 'doors' not in data:
                logger.error("[DOORS ENDPOINT] Missing doors field in request")
                return jsonify({
                    'error': 'Doors data is required',
                    'success': False,
                    'received_keys': list(data.keys()),
                    'timestamp': datetime.utcnow().isoformat()
                }), 400
            
            doors = data['doors']
            
            # Enhanced validation for doors data
            if not isinstance(doors, list):
                logger.error(f"[DOORS ENDPOINT] Doors must be array, got: {type(doors)}")
                return jsonify({
                    'error': 'Doors must be an array',
                    'success': False,
                    'received_type': str(type(doors)),
                    'timestamp': datetime.utcnow().isoformat()
                }), 400
            
            # Log the doors data for debugging
            logger.info(f"[DOORS ENDPOINT] Processing {len(doors)} doors for estimate {estimate_id}")
            
            # Validate and process each door object
            processed_doors = []
            for i, door in enumerate(doors):
                if not isinstance(door, dict):
                    logger.error(f"[DOORS ENDPOINT] Door {i} must be object, got: {type(door)}")
                    return jsonify({
                        'error': f'Door {i} must be an object',
                        'success': False,
                        'door_index': i,
                        'received_type': str(type(door)),
                        'timestamp': datetime.utcnow().isoformat()
                    }), 400
                
                # Ensure each door has required properties with defaults
                processed_door = {
                    'id': door.get('id', str(uuid.uuid4())),
                    'door_number': door.get('door_number', i + 1),
                    'description': door.get('description', f"Door #{door.get('door_number', i + 1)}"),
                    'details': door.get('details', []) if isinstance(door.get('details'), list) else []
                }
                
                processed_doors.append(processed_door)
                logger.info(f"[DOORS ENDPOINT] Processed door {i}: {processed_door['description']}")
            
            # Convert to JSON string for storage with error handling
            try:
                doors_json = json.dumps(processed_doors, ensure_ascii=False)
                logger.info(f"[DOORS ENDPOINT] Serialized doors data: {len(doors_json)} bytes")
            except (TypeError, ValueError) as e:
                logger.error(f"[DOORS ENDPOINT] JSON serialization error: {str(e)}")
                return jsonify({
                    'error': f'Failed to serialize doors data: {str(e)}',
                    'success': False,
                    'timestamp': datetime.utcnow().isoformat()
                }), 400
            
            # Database operation with proper transaction handling
            try:
                # Store the doors data as JSON
                estimate.doors_data = doors_json
                
                # Commit with explicit flush first to catch DB errors early
                db.session.flush()
                db.session.commit()
                
                logger.info(f"[DOORS ENDPOINT] Successfully saved {len(processed_doors)} doors to estimate {estimate_id}")
                
            except Exception as db_error:
                db.session.rollback()
                logger.error(f"[DOORS ENDPOINT] Database error: {str(db_error)}")
                return jsonify({
                    'error': f'Database error: {str(db_error)}',
                    'success': False,
                    'timestamp': datetime.utcnow().isoformat()
                }), 500
            
            # Return success response with comprehensive data
            response_data = {
                'estimate_id': estimate_id,
                'doors': processed_doors,
                'doors_count': len(processed_doors),
                'updated_at': datetime.utcnow().isoformat(),
                'success': True,
                'message': f'Successfully saved {len(processed_doors)} doors'
            }
            
            # Create response with explicit headers for ngrok compatibility
            response = make_response(jsonify(response_data))
            response.headers['Content-Type'] = 'application/json'
            
            # Add ngrok-friendly headers
            origin = request.headers.get('Origin')
            if origin and ('ngrok' in origin or 'localhost' in origin):
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
            
            logger.info(f"[DOORS ENDPOINT] PUT successful - saved {len(processed_doors)} doors")
            return response, 200
            
        except json.JSONDecodeError as e:
            logger.error(f"[DOORS ENDPOINT] JSON decode error: {str(e)}")
            return jsonify({
                'error': f'Invalid JSON data: {str(e)}',
                'success': False,
                'timestamp': datetime.utcnow().isoformat()
            }), 400
            
        except Exception as e:
            # Rollback transaction on any error
            db.session.rollback()
            
            # Log comprehensive error information
            logger.error(f"[DOORS ENDPOINT] Unexpected error: {str(e)}")
            logger.error(f"[DOORS ENDPOINT] Error type: {type(e).__name__}")
            
            # Import traceback for detailed error logging
            import traceback
            logger.error(f"[DOORS ENDPOINT] Traceback: {traceback.format_exc()}")
            
            return jsonify({
                'error': f'Server error: {str(e)}',
                'success': False,
                'error_type': type(e).__name__,
                'estimate_id': estimate_id,
                'timestamp': datetime.utcnow().isoformat()
            }), 500 
    
    
@app.route('/api/estimates/<int:estimate_id>/doors/test', methods=['GET', 'POST', 'OPTIONS'])
@login_required
def test_doors_connectivity(estimate_id):
    """
    Simple test endpoint to verify connectivity for doors operations
    Useful for debugging ngrok tunnel issues
    """
    
    if request.method == 'OPTIONS':
        response = make_response()
        origin = request.headers.get('Origin')
        if origin and ('ngrok' in origin or 'localhost' in origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response, 200
    
    # Verify estimate exists
    estimate = Estimate.query.get_or_404(estimate_id)
    
    test_data = {
        'estimate_id': estimate_id,
        'test_successful': True,
        'method': request.method,
        'timestamp': datetime.utcnow().isoformat(),
        'user_authenticated': current_user.is_authenticated,
        'user_id': current_user.id if current_user.is_authenticated else None,
        'origin': request.headers.get('Origin'),
        'user_agent': request.headers.get('User-Agent', '')[:100],  # Truncate for logs
        'content_type': request.headers.get('Content-Type'),
        'server_timezone': str(SERVER_TIMEZONE) if 'SERVER_TIMEZONE' in globals() else 'UTC'
    }
    
    if request.method == 'POST':
        # Test JSON parsing
        try:
            data = request.get_json()
            test_data['json_parsing'] = 'success'
            test_data['received_data_keys'] = list(data.keys()) if data else []
        except Exception as e:
            test_data['json_parsing'] = f'failed: {str(e)}'
    
    # Test database connectivity
    try:
        db.session.execute('SELECT 1')
        test_data['database_connectivity'] = 'success'
    except Exception as e:
        test_data['database_connectivity'] = f'failed: {str(e)}'
    
    logger.info(f"[DOORS TEST] Connectivity test for estimate {estimate_id}: {test_data}")
    
    response = make_response(jsonify(test_data))
    
    # Add ngrok-friendly headers
    origin = request.headers.get('Origin')
    if origin and ('ngrok' in origin or 'localhost' in origin):
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    
    return response, 200


@app.after_request
def enhance_cors_for_ngrok(response):
    """Enhanced CORS headers specifically for ngrok tunnel compatibility"""
    origin = request.headers.get('Origin')
    
    # More aggressive CORS handling for ngrok and local development
    if origin and any(domain in origin for domain in ['ngrok.io', 'ngrok.app', 'ngrok-free.app', 'localhost', '127.0.0.1']):
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-File-Name'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Range, X-Content-Range'
        response.headers['Access-Control-Max-Age'] = '86400'
        
        # Add headers that help with ngrok tunnel stability
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    
    return response    
    
    
@app.route('/api/estimates/<int:estimate_id>', methods=['GET'])
def get_estimate(estimate_id):
    """
    Get a single estimate by ID
    Now includes scheduling information
    """
    estimate = Estimate.query.get_or_404(estimate_id)
    
    # Parse the doors data from JSON
    try:
        doors = json.loads(estimate.doors_data) if estimate.doors_data else []
    except (json.JSONDecodeError, AttributeError):
        doors = []
    
    return jsonify({
        'id': estimate.id,
        'customer_id': estimate.customer_id,
        'customer_name': estimate.customer_direct_link.name,
        'site_id': estimate.site_id,
        'site_address': estimate.site.address if estimate.site else None,
        'site_name': estimate.site.name if estimate.site else None,
        'site_lockbox_location': estimate.site.lockbox_location if estimate.site else None,
        'site_contact_name': estimate.site.contact_name if estimate.site else None,
        'site_phone': estimate.site.phone if estimate.site else None,
        'status': estimate.status,
        'created_at': estimate.created_at,
        'doors': doors,  # Include doors in the response
        # Include scheduling information
        'scheduled_date': estimate.scheduled_date,
        'estimator_id': estimate.estimator_id,
        'estimator_name': estimate.estimator_name or 'Brett',
        'duration': estimate.duration or 60,
        'schedule_notes': estimate.schedule_notes
    })
    
    
@app.route('/api/bids', methods=['GET'])
def get_bids():
    """
    Get all bids with customer information and site details including site name.
    Returns a JSON array of bid objects with complete customer and site information.
    """
    bids = Bid.query.all()
    result = []
    
    for bid in bids:
        # Build comprehensive bid information including site name
        bid_data = {
            'id': bid.id,
            'estimate_id': bid.estimate_id,
            'customer_name': bid.estimate.customer_direct_link.name,
            'site_address': bid.estimate.site.address if bid.estimate.site else None,
            'site_name': bid.estimate.site.name if bid.estimate.site else None,  # Added site name
            'status': bid.status,
            'total_cost': bid.total_cost,
            'created_at': bid.created_at
        }
        
        result.append(bid_data)
    
    return jsonify(result)

@app.route('/api/estimates/<int:estimate_id>/bids', methods=['POST'])
def create_bid(estimate_id):
    """
    Create a new bid from an estimate.
    The frontend will handle adding doors and line items separately to avoid duplication.
    """
    estimate = Estimate.query.get_or_404(estimate_id)
    
    # Create the bid without automatically adding doors
    bid = Bid(
        estimate_id=estimate_id,
        status='draft',
        total_cost=0.0
    )
    db.session.add(bid)
    db.session.flush()  # Get the bid ID
    
    # Update estimate status to converted
    estimate.status = 'converted'
    
    # Get the doors count from estimate for response info
    doors_count = 0
    try:
        doors_data = json.loads(estimate.doors_data) if estimate.doors_data else []
        doors_count = len(doors_data)
    except (json.JSONDecodeError, Exception) as e:
        print(f"Error reading doors data from estimate: {str(e)}")
        doors_count = 0
    
    db.session.commit()
    
    return jsonify({
        'id': bid.id,
        'estimate_id': bid.estimate_id,
        'customer_name': bid.estimate.customer_direct_link.name,
        'site_address': bid.estimate.site.address if bid.estimate.site else None,
        'status': bid.status,
        'total_cost': bid.total_cost,
        'created_at': bid.created_at,
        'doors_available_for_transfer': doors_count,
        'message': 'Bid created successfully. Doors will be added by frontend.'
    }), 201
@app.route('/api/bids/<int:bid_id>', methods=['GET'])
def get_bid(bid_id):
    bid = Bid.query.get_or_404(bid_id)
    
    doors_data = []
    total_parts_cost = 0
    total_labor_cost = 0
    total_hardware_cost = 0
    
    for door in bid.doors:
        line_items = []
        door_parts_cost = 0
        door_labor_cost = 0
        door_hardware_cost = 0
        
        for item in door.line_items:
            item_total = item.price * item.quantity
            door_parts_cost += item_total
            door_labor_cost += item.labor_hours * 47.02
            door_hardware_cost += item.hardware
            
            line_items.append({
                'id': item.id,
                'part_number': item.part_number,
                'description': item.description,
                'quantity': item.quantity,
                'price': item.price,
                'labor_hours': item.labor_hours,
                'hardware': item.hardware,
                'total': item_total
            })
        
        door_total = door_parts_cost + door_labor_cost + door_hardware_cost
        
        # Build door display name with location info
        door_display_name = f"Door #{door.door_number}"
        if door.location:
            door_display_name = f"Door #{door.door_number} ({door.location})"
        
        # Build door info summary
        door_info = []
        if door.location:
            door_info.append(f"Location: {door.location}")
        if door.width and door.height:
            door_info.append(f"Size: {door.width}x{door.height} {door.dimension_unit or 'inches'}")
        if door.door_type:
            door_info.append(f"Type: {door.door_type}")
        if door.labor_description:
            door_info.append(f"Work: {door.labor_description}")
        
        doors_data.append({
            'id': door.id,
            'door_number': door.door_number,
            'display_name': door_display_name,
            'location': door.location,
            'door_type': door.door_type,
            'width': door.width,
            'height': door.height,
            'dimension_unit': door.dimension_unit,
            'labor_description': door.labor_description,
            'notes': door.notes,
            'door_info': door_info,  # Summary for display
            'line_items': line_items,
            'parts_cost': door_parts_cost,
            'labor_cost': door_labor_cost,
            'hardware_cost': door_hardware_cost,
            'total': door_total
        })
        
        total_parts_cost += door_parts_cost
        total_labor_cost += door_labor_cost
        total_hardware_cost += door_hardware_cost
    
    tax_rate = 0.0875
    tax_amount = (total_parts_cost + total_hardware_cost) * tax_rate
    total_cost_val = total_parts_cost + total_labor_cost + total_hardware_cost + tax_amount
    
    bid.total_cost = total_cost_val
    db.session.commit()
    
    return jsonify({
        'id': bid.id,
        'estimate_id': bid.estimate_id,
        'customer_name': bid.estimate.customer_direct_link.name,
        'customer_address': bid.estimate.site.address if bid.estimate.site else None,
        'customer_contact': bid.estimate.site.contact_name if bid.estimate.site else None,
        'customer_phone': bid.estimate.site.phone if bid.estimate.site else None,
        'status': bid.status,
        'doors': doors_data,
        'total_parts_cost': total_parts_cost,
        'total_labor_cost': total_labor_cost,
        'total_hardware_cost': total_hardware_cost,
        'tax': tax_amount,
        'total_cost': total_cost_val,
        'created_at': bid.created_at
    })


def serialize_site(site):
    """
    Serialize a Site model object to a dictionary for JSON response
    
    Args:
        site (Site): The site model instance to serialize
        
    Returns:
        dict: A dictionary of site properties ready for JSON serialization
    """
    return {
        'id': site.id,
        'customer_id': site.customer_id,
        'name': site.name,
        'address': site.address or '',
        'lockbox_location': site.lockbox_location or '',
        'contact_name': site.contact_name or '',
        'phone': site.phone or '',
        'email': site.email or '',
        'created_at': site.created_at.isoformat() if site.created_at else None
    }
    
    
@app.after_request
def add_cors_headers(response):
    """Add CORS headers to all responses"""
    origin = request.headers.get('Origin')
    
    # Only set CORS headers if the origin is in our allowed list
    if origin in app.config['CORS_ORIGINS']:
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Origin,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
    
    return response
    
@app.route('/api/bids/<int:bid_id>/doors', methods=['POST'])
def add_door(bid_id):
    bid = Bid.query.get_or_404(bid_id)
    data = request.json
    
    # Get the next door number
    highest_door = Door.query.filter_by(bid_id=bid_id).order_by(Door.door_number.desc()).first()
    next_door_number = 1
    if highest_door:
        next_door_number = highest_door.door_number + 1
    
    door_number = data.get('door_number', next_door_number)
    
    # Create door with rich information if provided
    door = Door(
        bid_id=bid_id, 
        door_number=door_number,
        location=data.get('location'),
        door_type=data.get('door_type'),
        width=data.get('width'),
        height=data.get('height'),
        dimension_unit=data.get('dimension_unit'),
        labor_description=data.get('labor_description'),
        notes=data.get('notes')
    )
    db.session.add(door)
    db.session.commit()
    
    return jsonify({
        'id': door.id,
        'bid_id': door.bid_id,
        'door_number': door.door_number,
        'location': door.location,
        'door_type': door.door_type,
        'width': door.width,
        'height': door.height,
        'dimension_unit': door.dimension_unit,
        'labor_description': door.labor_description,
        'notes': door.notes,
        'created_at': door.created_at
    }), 201
    
    
@app.route('/api/doors/<int:door_id>/line-items', methods=['POST'])
def add_line_item(door_id):
    door = Door.query.get_or_404(door_id)
    data = request.json
    
    line_item = LineItem(
        door_id=door_id,
        part_number=data.get('part_number', ''),
        description=data.get('description', ''),
        quantity=data.get('quantity', 1),
        price=data.get('price', 0.0),
        labor_hours=data.get('labor_hours', 0.0),
        hardware=data.get('hardware', 0.0)
    )
    db.session.add(line_item)
    db.session.commit()
    
    return jsonify({
        'id': line_item.id,
        'door_id': line_item.door_id,
        'part_number': line_item.part_number,
        'description': line_item.description,
        'quantity': line_item.quantity,
        'price': line_item.price,
        'labor_hours': line_item.labor_hours,
        'hardware': line_item.hardware
    }), 201

@app.route('/api/doors/<int:door_id>/duplicate', methods=['POST'])
def duplicate_door(door_id):
    data = request.json
    source_door = Door.query.get_or_404(door_id)
    target_door_numbers = data.get('target_door_numbers', [])
    
    created_doors = []
    
    for door_number in target_door_numbers:
        new_door = Door(bid_id=source_door.bid_id, door_number=door_number)
        db.session.add(new_door)
        db.session.flush()
        
        for item in source_door.line_items:
            new_item = LineItem(
                door_id=new_door.id,
                part_number=item.part_number,
                description=item.description,
                quantity=item.quantity,
                price=item.price,
                labor_hours=item.labor_hours,
                hardware=item.hardware
            )
            db.session.add(new_item)
        
        created_doors.append({'id': new_door.id, 'door_number': new_door.door_number})
    
    db.session.commit()
    return jsonify({'source_door_id': door_id, 'created_doors': created_doors}), 201

@app.route('/api/bids/<int:bid_id>/approve', methods=['POST'])
def approve_bid(bid_id):
    bid = Bid.query.get_or_404(bid_id)
    bid.status = 'approved'
    job_number = generate_job_number()
    
    job = Job(
        job_number=job_number,
        bid_id=bid_id,
        status='unscheduled',
        material_ready=False,
        material_location='S',
        region=request.json.get('region', 'OC'),
        job_scope=request.json.get('job_scope', '')
    )
    db.session.add(job)
    db.session.commit()
    
    return jsonify({
        'bid_id': bid_id,
        'status': bid.status,
        'job_id': job.id,
        'job_number': job.job_number
    }), 200

@app.route('/api/jobs', methods=['GET'])
def get_jobs():
    """
    Get all jobs with optional filtering and consistent date formatting.
    """
    try:
        region = request.args.get('region')
        status = request.args.get('status')
        search = request.args.get('search', '')
        scheduled_date = request.args.get('scheduled_date')
        
        # Build query with filters
        query = Job.query
        
        if region: 
            query = query.filter_by(region=region)
        
        if status: 
            query = query.filter_by(status=status)
        
        if search:
            query = query.join(Bid).join(Estimate).join(Customer, Estimate.customer_id == Customer.id).filter(
                (Job.job_number.like(f'%{search}%')) |
                (Customer.name.like(f'%{search}%')) |
                (Job.job_scope.like(f'%{search}%'))
            )
        
        # Handle date filtering specifically
        if scheduled_date:
            try:
                # Parse the date string to ensure proper format
                parsed_date = parse_job_date(scheduled_date)
                query = query.filter(Job.scheduled_date == parsed_date)
                logger.info(f"Filtering jobs by scheduled_date: {parsed_date}")
            except ValueError as e:
                logger.error(f"Invalid date format for scheduled_date filter: {e}")
                # Continue without date filtering
        
        jobs = query.all()
        
        # Format response with consistent date handling
        result = []
        for job in jobs:
            result.append({
                'id': job.id,
                'job_number': job.job_number,
                'customer_name': job.bid.estimate.customer_direct_link.name,
                'address': job.bid.estimate.site.address if job.bid.estimate.site else None,
                'job_scope': job.job_scope,
                # Format date consistently as YYYY-MM-DD
                'scheduled_date': format_date_for_response(job.scheduled_date),
                'status': job.status,
                'material_ready': job.material_ready,
                'material_location': job.material_location,
                'region': job.region
            })
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error retrieving jobs: {str(e)}")
        return jsonify({'error': f'Failed to retrieve jobs: {str(e)}'}), 500
    
    
def parse_time_string(time_str):
    """
    Parse a time string in various formats and return hour and minute.
    
    Args:
        time_str (str): Time string in formats like "1:30 PM", "13:30", "1 PM"
        
    Returns:
        tuple: (hour, minute) as integers
    """
    if not time_str:
        return None, None
        
    try:
        # Normalize and clean the string
        time_str = time_str.strip().upper()
        is_pm = 'PM' in time_str
        is_am = 'AM' in time_str
        
        # Remove AM/PM indicators
        time_str = time_str.replace('AM', '').replace('PM', '').strip()
        
        # Parse hour and minute
        if ':' in time_str:
            # Format with hours and minutes (e.g., "1:30")
            hour_str, minute_str = time_str.split(':')
            hour = int(hour_str)
            minute = int(minute_str)
        else:
            # Format with just hours (e.g., "1")
            hour = int(time_str)
            minute = 0
            
        # Convert from 12-hour to 24-hour format if needed
        if is_pm and hour < 12:
            hour += 12
        if is_am and hour == 12:
            hour = 0
            
        logger.info(f"Parsed time string '{time_str}' to hour={hour}, minute={minute}")
        return hour, minute
    
    except Exception as e:
        logger.error(f"Error parsing time string '{time_str}': {str(e)}")
        return None, None

@app.route('/api/jobs/<int:job_id>', methods=['GET'])
def get_job(job_id):
    """
    Get a job by ID with consistent date formatting.
    """
    try:
        job = Job.query.get_or_404(job_id)
        
        # Build the response with consistent date format
        result = {
            'id': job.id,
            'job_number': job.job_number,
            'customer_name': job.bid.estimate.customer_direct_link.name,
            'address': job.bid.estimate.site.address if job.bid.estimate.site else None,
            'contact_name': job.bid.estimate.site.contact_name if job.bid.estimate.site else None,
            'phone': job.bid.estimate.site.phone if job.bid.estimate.site else None,
            'job_scope': job.job_scope,
            # Format date consistently as YYYY-MM-DD
            'scheduled_date': format_date_for_response(job.scheduled_date),
            'status': job.status,
            'material_ready': job.material_ready,
            'material_location': job.material_location,
            'region': job.region
        }
        
        # Get doors information
        doors = []
        for door_model in job.bid.doors:
            completed = CompletedDoor.query.filter_by(job_id=job.id, door_id=door_model.id).first()
            doors.append({
                'id': door_model.id,
                'door_number': door_model.door_number,
                'completed': completed is not None,
                'completed_at': completed.completed_at.isoformat() if completed and completed.completed_at else None
            })
        
        result['doors'] = doors
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error retrieving job {job_id}: {str(e)}")
        return jsonify({'error': f'Failed to retrieve job: {str(e)}'}), 500
    
    # Add this route to your Flask application (paste.txt)
# Place it near the other job-related routes

@app.route('/api/jobs/<int:job_id>/cancel', methods=['POST'])
def cancel_job(job_id):
    """
    Cancel a job by setting its status to 'cancelled' and recording cancellation details.
    
    Args:
        job_id (int): The ID of the job to cancel
        
    Returns:
        JSON response with updated job details
    """
    try:
        # Find the job to cancel
        job = Job.query.get_or_404(job_id)
        
        # Check if the job is already cancelled to prevent redundant operations
        if job.status == 'cancelled':
            return jsonify({
                'id': job.id, 
                'job_number': job.job_number, 
                'status': job.status,
                'message': 'Job was already cancelled'
            }), 200
        
        # Get optional cancellation reason from request data
        data = request.json or {}
        cancellation_reason = data.get('reason', '')
        
        # Update job status to cancelled
        job.status = 'cancelled'
        
        # Optional: Record cancellation details in job_scope or add a dedicated field
        # This could be enhanced by adding a cancellation_reason field to the Job model
        if cancellation_reason:
            if job.job_scope:
                job.job_scope = f"{job.job_scope}\n\nCANCELLATION NOTE: {cancellation_reason}"
            else:
                job.job_scope = f"CANCELLATION NOTE: {cancellation_reason}"
        
        # Optional: Record cancellation timestamp
        # This could be enhanced by adding a cancelled_at field to the Job model
        job.cancelled_at = datetime.utcnow()
        
        # Commit changes to the database
        db.session.commit()
        
        # Log the cancellation for audit purposes
        logger.info(f"Job {job_id} (Job #{job.job_number}) cancelled successfully.")
        
        # Return success response
        return jsonify({
            'id': job.id,
            'job_number': job.job_number,
            'status': job.status,
            'message': 'Job cancelled successfully'
        }), 200
        
    except Exception as e:
        # Roll back in case of error
        db.session.rollback()
        
        # Log the error
        logger.error(f"Error cancelling job {job_id}: {str(e)}")
        
        # Return error response
        return jsonify({
            'error': f'Failed to cancel job: {str(e)}',
            'error_type': type(e).__name__
        }), 500
    
@app.route('/api/doors/<int:door_id>/line-items/<int:line_item_id>', methods=['PUT'])
def update_line_item(door_id, line_item_id):
    """
    Update an existing line item for a door
    
    Args:
        door_id (int): The ID of the door
        line_item_id (int): The ID of the line item to update
        
    Returns:
        JSON response with updated line item data
    """
    try:
        # Verify door exists
        door = Door.query.get_or_404(door_id)
        
        # Verify line item exists and belongs to the specified door
        line_item = LineItem.query.get_or_404(line_item_id)
        if line_item.door_id != door_id:
            return jsonify({'error': 'Line item does not belong to the specified door'}), 400
        
        # Get and validate data
        data = request.json
        
        # Update line item fields
        if 'description' in data:
            line_item.description = data['description']
        if 'part_number' in data:
            line_item.part_number = data['part_number']
        if 'quantity' in data:
            line_item.quantity = data.get('quantity', 1)
        if 'price' in data:
            line_item.price = data.get('price', 0.0)
        if 'labor_hours' in data:
            line_item.labor_hours = data.get('labor_hours', 0.0)
        if 'hardware' in data:
            line_item.hardware = data.get('hardware', 0.0)
        
        # Save to database
        db.session.commit()
        
        # Calculate total for the response
        item_total = line_item.price * line_item.quantity
        
        return jsonify({
            'id': line_item.id,
            'door_id': line_item.door_id,
            'part_number': line_item.part_number,
            'description': line_item.description,
            'quantity': line_item.quantity,
            'price': line_item.price,
            'labor_hours': line_item.labor_hours,
            'hardware': line_item.hardware,
            'total': item_total
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating line item: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to update line item: {str(e)}'}), 500    
    
    
@app.route('/api/doors/<int:door_id>/line-items/<int:line_item_id>', methods=['DELETE'])
def delete_line_item(door_id, line_item_id):
    """
    Delete a line item from a door
    
    Args:
        door_id (int): The ID of the door
        line_item_id (int): The ID of the line item to delete
        
    Returns:
        JSON response confirming deletion
    """
    try:
        # Verify door exists
        door = Door.query.get_or_404(door_id)
        
        # Verify line item exists and belongs to the specified door
        line_item = LineItem.query.get_or_404(line_item_id)
        if line_item.door_id != door_id:
            return jsonify({'error': 'Line item does not belong to the specified door'}), 400
        
        # Delete the line item
        db.session.delete(line_item)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Line item {line_item_id} deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting line item: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to delete line item: {str(e)}'}), 500
    
@app.route('/api/jobs/<int:job_id>/schedule', methods=['POST'])
def schedule_job(job_id):
    """
    Schedule a job with proper date handling to prevent timezone issues.
    """
    try:
        job = Job.query.get_or_404(job_id)
        data = request.json
        
        # Log the incoming data
        logger.info(f"Received job scheduling data for job {job_id}: {data}")
        
        scheduled_date_str = data.get('scheduled_date')
        
        if scheduled_date_str:
            try:
                # Parse the date - extract just the date part to prevent timezone issues
                parsed_date = parse_job_date(scheduled_date_str)
                
                # Store just the date (without time) in the database
                job.scheduled_date = parsed_date
                job.status = 'scheduled'
                
                logger.info(f"Scheduled job {job_id} for date: {job.scheduled_date}")
            except ValueError as e:
                logger.error(f"Date parsing error for job {job_id}: {str(e)}")
                return jsonify({'error': f'Invalid date format: {str(e)}'}), 400
        
        # Update other job fields
        job.material_ready = data.get('material_ready', job.material_ready)
        job.material_location = data.get('material_location', job.material_location)
        job.region = data.get('region', job.region)
        job.job_scope = data.get('job_scope', job.job_scope)
        
        db.session.commit()
        
        # Format the response with ISO date format
        result = {
            'id': job.id,
            'job_number': job.job_number,
            # Format date as ISO without time component
            'scheduled_date': format_date_for_response(job.scheduled_date),
            'status': job.status,
            'material_ready': job.material_ready,
            'material_location': job.material_location,
            'region': job.region,
            'job_scope': job.job_scope
        }
        
        logger.info(f"Job scheduling response: {result}")
        
        return jsonify(result), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error scheduling job {job_id}: {str(e)}")
        return jsonify({'error': f'Failed to schedule job: {str(e)}'}), 500
    
    

@app.route('/api/jobs/<int:job_id>/doors/<int:door_id>/complete', methods=['POST'])
def complete_door(job_id, door_id):
    job = Job.query.get_or_404(job_id)
    # door = Door.query.get_or_404(door_id) # 'door' is a reserved keyword or variable name here
    door_instance = Door.query.get_or_404(door_id) # Renamed to avoid conflict
    data = request.json
    
    photo_path = f"uploads/{job.job_number}/door_{door_instance.door_number}_photo.jpg"
    video_path = f"uploads/{job.job_number}/door_{door_instance.door_number}_video.mp4"
    
    completed_door = CompletedDoor(
        job_id=job_id,
        door_id=door_id,
        signature=data.get('signature', ''),
        photo_path=photo_path,
        video_path=video_path
    )
    db.session.add(completed_door)
    total_doors = len(job.bid.doors)
    completed_doors_count = CompletedDoor.query.filter_by(job_id=job_id).count() + 1 # +1 for the current one being added
    
    if completed_doors_count >= total_doors: # Use >= in case of race condition or re-completion
        job.status = 'completed'
    db.session.commit()
    
    return jsonify({
        'id': completed_door.id,
        'job_id': completed_door.job_id,
        'door_id': completed_door.door_id,
        'completed_at': completed_door.completed_at,
        'all_completed': completed_doors_count >= total_doors
    }), 201
# Add these routes to handle site updates and deletions

@app.route('/api/sites/<int:site_id>', methods=['PUT'])
def update_site(site_id):
    """
    Update an existing site
    
    Args:
        site_id (int): The ID of the site to update
        
    Returns:
        JSON of the updated site
    """
    site = Site.query.get_or_404(site_id)
    data = request.json
    
    if 'name' in data:
        site.name = data['name']
    if 'address' in data:
        site.address = data['address']
    if 'lockbox_location' in data:
        site.lockbox_location = data['lockbox_location']
    if 'contact_name' in data:
        site.contact_name = data['contact_name']
    if 'phone' in data:
        site.phone = data['phone']
    if 'email' in data:
        site.email = data['email']
    
    db.session.commit()
    return jsonify(serialize_site(site))


@app.route('/api/sites/<int:site_id>', methods=['DELETE'])
def delete_site(site_id):
    """
    Delete a site
    
    Args:
        site_id (int): The ID of the site to delete
        
    Returns:
        JSON confirmation of deletion
    """
    site = Site.query.get_or_404(site_id)
    db.session.delete(site)
    db.session.commit()
    return jsonify({'success': True, 'message': f'Site {site_id} deleted successfully'})



@app.route('/api/customers/<int:customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    """
    Delete a customer and all related records
    
    Args:
        customer_id (int): The ID of the customer to delete
        
    Returns:
        JSON confirmation of deletion
    """
    try:
        # Get the customer to delete
        customer = Customer.query.get_or_404(customer_id)
        
        # First, delete records that depend on estimates 
        # We need to go through the dependency chain from bottom to top
        
        # 1. Get all estimates for this customer
        estimates = Estimate.query.filter_by(customer_id=customer_id).all()
        
        for estimate in estimates:
            # 2. Delete audio recordings related to each estimate
            AudioRecording.query.filter_by(estimate_id=estimate.id).delete()
            
            # 3. Get all bids for this estimate
            bids = Bid.query.filter_by(estimate_id=estimate.id).all()
            
            for bid in bids:
                # 4. Get all doors for this bid
                doors = Door.query.filter_by(bid_id=bid.id).all()
                
                for door in doors:
                    # 5. Delete line items for each door
                    LineItem.query.filter_by(door_id=door.id).delete()
                
                # 6. Delete all doors for this bid
                Door.query.filter_by(bid_id=bid.id).delete()
                
                # 7. Delete any jobs related to this bid
                jobs = Job.query.filter_by(bid_id=bid.id).all()
                
                for job in jobs:
                    # 8. Delete completed doors for each job
                    CompletedDoor.query.filter_by(job_id=job.id).delete()
                
                # 9. Delete all jobs for this bid
                Job.query.filter_by(bid_id=bid.id).delete()
            
            # 10. Delete all bids for this estimate
            Bid.query.filter_by(estimate_id=estimate.id).delete()
        
        # 11. Delete all estimates for this customer
        Estimate.query.filter_by(customer_id=customer_id).delete()
        
        # 12. Delete all sites for this customer
        Site.query.filter_by(customer_id=customer_id).delete()
        
        # 13. Finally, delete the customer
        db.session.delete(customer)
        
        # Commit all changes
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Customer {customer_id} and all related records deleted successfully'
        })
        
    except Exception as e:
        # Roll back the transaction in case of error
        db.session.rollback()
        
        # Log the error for debugging
        import traceback
        error_msg = str(e)
        error_traceback = traceback.format_exc()
        print(f"Error deleting customer {customer_id}: {error_msg}")
        print(error_traceback)
        
        # Return a more helpful error message
        return jsonify({
            'success': False,
            'message': f'Failed to delete customer: {error_msg}',
            'error_type': type(e).__name__
        }), 500


# Replace the existing bid report route
@app.route('/api/bids/<int:bid_id>/report', methods=['GET'])
def generate_bid_report(bid_id):
    bid = Bid.query.get_or_404(bid_id)
    
    # Get all necessary data
    customer = bid.estimate.customer
    doors = bid.doors
    
    # Calculate all the necessary values
    total_parts_cost = 0
    total_labor_cost = 0
    total_hardware_cost = 0
    
    for door in doors:
        door_parts_cost = 0
        door_labor_cost = 0
        door_hardware_cost = 0
        
        for item in door.line_items:
            item_total = item.price * item.quantity
            door_parts_cost += item_total
            door_labor_cost += item.labor_hours * 47.02  # $47.02 per hour labor rate
            door_hardware_cost += item.hardware
            
        total_parts_cost += door_parts_cost
        total_labor_cost += door_labor_cost
        total_hardware_cost += door_hardware_cost
    
    # Calculate tax (8.75%)
    tax_rate = 0.0875
    tax_amount = (total_parts_cost + total_hardware_cost) * tax_rate
    total_cost = total_parts_cost + total_labor_cost + total_hardware_cost + tax_amount
    
    # Create a PDF buffer
    buffer = BytesIO()
    
    # Create the PDF document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )
    
    # Container for the 'Flowable' objects
    elements = []
    
    # Define styles
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    heading2_style = styles['Heading2']
    heading3_style = styles['Heading3']
    normal_style = styles['Normal']
    
    # Add the report title
    elements.append(Paragraph(f"Bid Report #{bid.id}", title_style))
    elements.append(Spacer(1, 0.25*inch))
    
    # Add the date
    current_date = datetime.now().strftime("%B %d, %Y")
    elements.append(Paragraph(f"Date: {current_date}", normal_style))
    elements.append(Spacer(1, 0.25*inch))
    
    # Add company info
    elements.append(Paragraph("Scott Overhead Doors", heading2_style))
    elements.append(Paragraph("123 Main Street", normal_style))
    elements.append(Paragraph("Anytown, CA 92000", normal_style))
    elements.append(Paragraph("Phone: (555) 555-5555", normal_style))
    elements.append(Spacer(1, 0.25*inch))
    
    # Add customer info
    elements.append(Paragraph("Customer Information", heading2_style))
    elements.append(Paragraph(f"Name: {customer.name}", normal_style))
    elements.append(Paragraph(f"Address: {customer.address or 'N/A'}", normal_style))
    elements.append(Paragraph(f"Contact: {customer.contact_name or 'N/A'}", normal_style))
    elements.append(Paragraph(f"Phone: {customer.phone or 'N/A'}", normal_style))
    elements.append(Paragraph(f"Email: {customer.email or 'N/A'}", normal_style))  # Added email
    elements.append(Spacer(1, 0.25*inch))
    
    # Add cost summary
    elements.append(Paragraph("Cost Summary", heading2_style))
    
    summary_data = [
        ["Description", "Amount"],
        ["Total Parts Cost", f"${total_parts_cost:.2f}"],
        ["Total Labor Cost", f"${total_labor_cost:.2f}"],
        ["Total Hardware Cost", f"${total_hardware_cost:.2f}"],
        ["Tax (8.75%)", f"${tax_amount:.2f}"],
        ["Total Cost", f"${total_cost:.2f}"]
    ]
    
    summary_table = Table(summary_data)
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (1, 0), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.black),
        ('ALIGN', (0, 0), (1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (1, 0), 12),
        ('BACKGROUND', (0, -1), (1, -1), colors.lightgrey),
        ('FONTNAME', (0, -1), (1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(summary_table)
    elements.append(Spacer(1, 0.25*inch))
    
    # Add door details
    elements.append(Paragraph("Door Details", heading2_style))
    
    for door in doors:
        elements.append(Paragraph(f"Door #{door.door_number}", heading3_style))
        
        # Calculate door totals
        door_parts_cost = 0
        door_labor_cost = 0
        door_hardware_cost = 0
        
        door_data = [["Part Number", "Description", "Quantity", "Price", "Labor Hours", "Hardware", "Total"]]
        
        for item in door.line_items:
            item_total = item.price * item.quantity
            door_parts_cost += item_total
            door_labor_cost += item.labor_hours * 47.02
            door_hardware_cost += item.hardware
            
            door_data.append([
                item.part_number or 'N/A',
                item.description or 'N/A',
                str(item.quantity),
                f"${item.price:.2f}",
                str(item.labor_hours),
                f"${item.hardware:.2f}",
                f"${item_total:.2f}"
            ])
        
        door_total = door_parts_cost + door_labor_cost + door_hardware_cost
        door_data.append(["", "", "", "", "", "Door Total:", f"${door_total:.2f}"])
        
        door_table = Table(door_data)
        door_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(door_table)
        elements.append(Spacer(1, 0.25*inch))
    
    # Add footer
    elements.append(Paragraph(f"Report generated on {current_date}", normal_style))
    elements.append(Paragraph("Scott Overhead Doors - Confidential", normal_style))
    
    # Build the PDF
    doc.build(elements)
    
    # Set the file pointer to the beginning of the buffer
    buffer.seek(0)
    
    # Create a response with the PDF
    response = make_response(buffer.getvalue())
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = f'attachment; filename=bid_report_{bid.id}.pdf'
    
    return response

@app.route('/api/bids/<int:bid_id>/proposal', methods=['GET'])
def generate_bid_proposal(bid_id):
    bid = Bid.query.get_or_404(bid_id)
    
    # Get all necessary data
    customer = bid.estimate.customer
    doors = bid.doors
    
    # Calculate all the necessary values
    total_parts_cost = 0
    total_labor_cost = 0
    total_hardware_cost = 0
    
    for door in doors:
        door_parts_cost = 0
        door_labor_cost = 0
        door_hardware_cost = 0
        
        for item in door.line_items:
            item_total = item.price * item.quantity
            door_parts_cost += item_total
            door_labor_cost += item.labor_hours * 47.02
            door_hardware_cost += item.hardware
            
        total_parts_cost += door_parts_cost
        total_labor_cost += door_labor_cost
        total_hardware_cost += door_hardware_cost
    
    # Calculate tax (8.75%)
    tax_rate = 0.0875
    tax_amount = (total_parts_cost + total_hardware_cost) * tax_rate
    total_cost = total_parts_cost + total_labor_cost + total_hardware_cost + tax_amount
    
    # Create a PDF buffer
    buffer = BytesIO()
    
    # Create the PDF document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )
    
    # Container for the 'Flowable' objects
    elements = []
    
    # Define styles
    styles = getSampleStyleSheet()
    
    # Custom styles for a more professional look
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=24,
        leading=30,
        alignment=1,  # Center alignment
        spaceAfter=24
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=14,
        leading=18,
        spaceBefore=12,
        spaceAfter=6,
        textColor=colors.darkblue
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        spaceAfter=3
    )
    
    bold_style = ParagraphStyle(
        'BoldText',
        parent=normal_style,
        fontName='Helvetica-Bold'
    )
    
    header_info_style = ParagraphStyle(
        'HeaderInfo',
        parent=normal_style,
        alignment=2  # Right align
    )
    
    # Add company logo placeholder (uncomment if you have a logo file)
    # logo = Image('path/to/logo.png', width=2*inch, height=0.75*inch)
    # elements.append(logo)
    
    # Add the proposal title
    elements.append(Paragraph("PROPOSAL", title_style))
    
    # Create a table for header information (right-aligned)
    current_date = datetime.now().strftime("%B %d, %Y")
    header_data = [
        [Paragraph(f"Proposal #: P-{bid.id}", header_info_style)],
        [Paragraph(f"Date: {current_date}", header_info_style)]
    ]
    
    header_table = Table(header_data, colWidths=[450])
    header_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    
    elements.append(header_table)
    elements.append(Spacer(1, 0.1*inch))
    
    # Company and Customer info in a two-column layout
    company_data = [
        [Paragraph("<b>Scott Overhead Doors</b>", bold_style), 
         Paragraph("<b>Prepared For:</b>", bold_style)],
        [Paragraph("123 Main Street", normal_style), 
         Paragraph(f"{customer.name}", bold_style)],
        [Paragraph("Anytown, CA 92000", normal_style), 
         Paragraph(f"{customer.address or 'Address on file'}", normal_style)],
        [Paragraph("Phone: (555) 555-5555", normal_style), 
         Paragraph(f"Contact: {customer.contact_name or 'N/A'}", normal_style)],
        [Paragraph("License #: 123456", normal_style), 
         Paragraph(f"Phone: {customer.phone or 'N/A'}", normal_style)],
        [Paragraph("", normal_style), 
         Paragraph(f"Email: {customer.email or 'N/A'}", normal_style)]  # Added email
    ]
    
    company_table = Table(company_data, colWidths=[225, 225])
    company_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    
    elements.append(company_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Add horizontal line
    elements.append(Table([['']], colWidths=[450], style=[
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.darkblue),
    ]))
    elements.append(Spacer(1, 0.2*inch))
    
    # Add scope of work
    elements.append(Paragraph("Scope of Work", section_title_style))
    elements.append(Paragraph("Scott Overhead Doors proposes to furnish all labor, materials, equipment, and services necessary to complete the following work:", normal_style))
    
    # Create bullet points for scope items
    scope_items = [
        "Supply and install all specified overhead door components as detailed below",
        "Remove and dispose of existing materials as necessary",
        "Provide testing and final adjustment of all installations",
        "Clean up of work area upon completion"
    ]
    
    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=normal_style,
        leftIndent=20,
        firstLineIndent=-15
    )
    
    for item in scope_items:
        elements.append(Paragraph(f"• {item}", bullet_style))
    
    elements.append(Spacer(1, 0.2*inch))
    
    # Add horizontal line
    elements.append(Table([['']], colWidths=[450], style=[
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.darkblue),
    ]))
    elements.append(Spacer(1, 0.2*inch))
    
    # Add pricing details with improved table design
    elements.append(Paragraph("Pricing Details", section_title_style))
    
    price_data = [
        ["Description", "Quantity", "Amount"]
    ]
    
    for door in doors:
        # Calculate door total
        door_parts_cost = 0
        door_labor_cost = 0
        door_hardware_cost = 0
        
        for item in door.line_items:
            item_total = item.price * item.quantity
            door_parts_cost += item_total
            door_labor_cost += item.labor_hours * 47.02
            door_hardware_cost += item.hardware
        
        door_total = door_parts_cost + door_labor_cost + door_hardware_cost
        
        price_data.append([
            f"Door #{door.door_number} - Complete installation and materials",
            "1",
            f"${door_total:.2f}"
        ])
    
    subtotal = total_parts_cost + total_labor_cost + total_hardware_cost
    
    price_data.append(["", "", ""])  # Empty row for spacing
    price_data.append(["Subtotal:", "", f"${subtotal:.2f}"])
    price_data.append(["Tax (8.75%):", "", f"${tax_amount:.2f}"])
    price_data.append(["Total Investment:", "", f"${total_cost:.2f}"])
    
    # Calculate column widths - make description wider
    price_table = Table(price_data, colWidths=[250, 75, 125])
    price_table.setStyle(TableStyle([
        # Header row styling
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6),
        
        # Borders
        ('GRID', (0, 0), (-1, 0), 1, colors.darkblue),  # Header grid
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.darkblue),  # Header bottom line
        ('LINEABOVE', (0, 1), (-1, 1), 1, colors.lightgrey),  # Line above first row
        ('LINEBELOW', (0, -4), (-1, -4), 1, colors.lightgrey),  # Line above subtotal
        
        # Number alignments
        ('ALIGN', (1, 1), (1, -1), 'CENTER'),  # Center quantity
        ('ALIGN', (2, 1), (2, -1), 'RIGHT'),  # Right align amount
        
        # Totals section styling
        ('LINEBELOW', (0, -2), (-1, -2), 1, colors.black),  # Line above Total
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),  # Bold Total row
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.darkblue),  # Color Total row
    ]))
    
    elements.append(price_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Add horizontal line
    elements.append(Table([['']], colWidths=[450], style=[
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.darkblue),
    ]))
    elements.append(Spacer(1, 0.2*inch))
    
    # Add terms and conditions
    elements.append(Paragraph("Terms and Conditions", section_title_style))
    
    terms_style = ParagraphStyle(
        'TermsStyle',
        parent=normal_style,
        leftIndent=10,
        firstLineIndent=-10
    )
    
    elements.append(Paragraph("1. Payment Terms: 50% deposit required to schedule work. Remaining balance due upon completion.", terms_style))
    elements.append(Paragraph("2. Warranty: All work is guaranteed for one year from the date of installation.", terms_style))
    elements.append(Paragraph("3. Timeline: Work to be completed within 4-6 weeks of approval, subject to material availability.", terms_style))
    elements.append(Paragraph("4. This proposal is valid for 30 days from the date issued.", terms_style))
    elements.append(Spacer(1, 0.4*inch))
    
    # Add signature section
    signature_data = [
        ["Approved By:", "Date:"],
        ["", ""],
        [customer.name, ""]
    ]
    
    signature_table = Table(signature_data, colWidths=[225, 225])
    signature_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
        ('LINEBELOW', (0, 1), (0, 1), 1, colors.black),
        ('LINEBELOW', (1, 1), (1, 1), 1, colors.black),
        ('TOPPADDING', (0, 1), (1, 1), 36),
        ('BOTTOMPADDING', (0, 1), (1, 1), 6),
    ]))
    
    elements.append(signature_table)
    elements.append(Spacer(1, 0.5*inch))
    
    # Add footer with a horizontal line
    elements.append(Table([['']], colWidths=[450], style=[
        ('LINEABOVE', (0, 0), (-1, 0), 0.5, colors.grey),
    ]))
    
    footer_style = ParagraphStyle(
        'FooterStyle',
        parent=normal_style,
        alignment=1,  # Center
        textColor=colors.darkgrey,
        fontSize=9
    )
    
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph("Thank you for the opportunity to earn your business!", footer_style))
    elements.append(Paragraph("Scott Overhead Doors - Quality Service Since 1985", footer_style))
    
    # Build the PDF
    doc.build(elements)
    
    # Set the file pointer to the beginning of the buffer
    buffer.seek(0)
    
    # Create a response with the PDF
    response = make_response(buffer.getvalue())
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = f'inline; filename=proposal_{bid.id}.pdf'
    
    return response

# Audio API Routes
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Fixed audio upload route in Flask server

@app.route('/api/audio/upload', methods=['POST'])
def upload_audio():
    print("Request received for audio upload")
    print("Form data:", request.form)
    print("Files:", request.files)
    
    if 'audio' not in request.files:
        print("Error: No audio file found in request.files")
        return jsonify({'error': 'No audio file provided'}), 400
    
    audio_file = request.files['audio']
    estimate_id = request.form.get('estimate_id')
    
    print(f"Audio file: {audio_file.filename}, Content Type: {audio_file.content_type}")
    
    # Check if the file is empty - use seek/tell to properly check content length
    audio_file.seek(0, os.SEEK_END)
    file_length = audio_file.tell()
    audio_file.seek(0)  # Reset the file pointer
    
    print(f"File size calculated: {file_length} bytes")
    
    if file_length == 0:
        return jsonify({'error': 'Audio file is empty. Please try recording again.'}), 400
    
    if not estimate_id:
        return jsonify({'error': 'Estimate ID is required'}), 400
    
    # Check if estimate exists
    estimate = Estimate.query.get(estimate_id)
    if not estimate:
        return jsonify({'error': 'Estimate not found'}), 404
    
    # Make sure the upload directory exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # Determine the correct file extension based on content type
    file_ext = 'wav'  # Default
    content_type = audio_file.content_type.lower()
    
    if 'mp4' in content_type or 'aac' in content_type or 'm4a' in content_type:
        file_ext = 'mp4'
    elif 'webm' in content_type:
        file_ext = 'webm'
    elif 'ogg' in content_type:
        file_ext = 'ogg'
    
    # Use the file extension from the original filename if it exists
    if audio_file.filename and '.' in audio_file.filename:
        original_ext = audio_file.filename.split('.')[-1].lower()
        if original_ext in ['mp4', 'm4a', 'aac', 'webm', 'ogg', 'wav']:
            file_ext = original_ext
    
    # Generate a filename with the correct extension
    filename = f"{uuid.uuid4()}.{file_ext}"
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    
    try:
        # Save the audio file
        audio_file.save(file_path)
        
        # Verify the file was saved and is not empty
        if os.path.getsize(file_path) < 100:  # Check if file is less than 100 bytes
            os.remove(file_path)  # Delete the empty file
            return jsonify({'error': 'Saved audio file is too small. Please try recording again.'}), 400
            
        print(f"Audio file saved to {file_path} with size {os.path.getsize(file_path)} bytes")
        
        # Create a record in the database
        recording = AudioRecording(
            estimate_id=estimate_id,
            file_path=file_path,
            created_at=datetime.utcnow()
        )
        db.session.add(recording)
        db.session.commit()
        
        # Make the file_path relative to be used in URLs
        relative_path = file_path.replace('\\', '/')
        if not relative_path.startswith('/'):
            relative_path = '/' + relative_path
        
        return jsonify({
            'id': recording.id,
            'estimate_id': recording.estimate_id,
            'file_path': relative_path,
            'created_at': recording.created_at
        }), 201
        
    except Exception as e:
        print(f"Error saving file: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error saving file: {str(e)}'}), 500
    
@app.route('/api/audio/<int:recording_id>', methods=['GET'])
def get_audio(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    return jsonify({
        'id': recording.id,
        'estimate_id': recording.estimate_id,
        'file_path': recording.file_path,
        'created_at': recording.created_at,
        'transcript': recording.transcript
    })

@app.route('/api/audio/<int:recording_id>/delete', methods=['DELETE'])
def delete_audio(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    # Delete the file
    if os.path.exists(recording.file_path):
        os.remove(recording.file_path)
    
    # Delete the database record
    db.session.delete(recording)
    db.session.commit()
    
    return jsonify({'status': 'success', 'message': 'Recording deleted'}), 200

# Fix the routes for handling sites
@app.route('/api/customers/<int:customer_id>/sites', methods=['GET'])
def get_sites_for_customer(customer_id):
    """
    Get all sites for a customer
    
    Args:
        customer_id (int): The ID of the customer
        
    Returns:
        JSON array of sites belonging to the customer
    """
    customer = Customer.query.get_or_404(customer_id)
    sites = Site.query.filter_by(customer_id=customer_id).all()
    return jsonify([serialize_site(site) for site in sites])


@app.route('/api/audio/<int:recording_id>/process', methods=['POST'])
def process_audio(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    if not recording.transcript:
        return jsonify({'error': 'No transcript available. Please transcribe the audio first.'}), 400
    
    try:
        # Process the transcript to identify doors and details
        # This would be more sophisticated in a real application
        doors = []
        transcript = recording.transcript.lower()
        
        # Simple pattern matching for demonstration
        door_matches = re.findall(r'door(?:\s+number|\s+#)?\s+(\d+)', transcript, re.IGNORECASE)
        
        for i, door_num in enumerate(door_matches):
            door_number = int(door_num)
            
            # Find the text specific to this door
            start_pos = transcript.find(f"door number {door_num}")
            if start_pos == -1:
                start_pos = transcript.find(f"door #{door_num}")
            if start_pos == -1:
                start_pos = transcript.find(f"door {door_num}")
                
            # Find the start of the next door or end of text
            next_start = -1
            if i < len(door_matches) - 1:
                next_door = door_matches[i + 1]
                next_start = transcript.find(f"door number {next_door}")
                if next_start == -1:
                    next_start = transcript.find(f"door #{next_door}")
                if next_start == -1:
                    next_start = transcript.find(f"door {next_door}")
            
            end_pos = next_start if next_start != -1 else len(transcript)
            door_text = transcript[start_pos:end_pos].strip()
            
            # Extract details
            details = []
            
            # Check for dimensions (e.g., "10 by 8" or "10x8")
            dim_match = re.search(r'(\d+)(?:\s*by\s*|\s*x\s*)(\d+)', door_text)
            if dim_match:
                width, height = dim_match.groups()
                details.append(f"Dimensions: {width} x {height}")
            
            # Check for common door features
            if "steel" in door_text:
                details.append("Material: Steel")
            if "insulated" in door_text:
                details.append("Feature: Insulated")
            if "windows" in door_text:
                details.append("Feature: Windows")
            if "opener" in door_text:
                details.append("Accessory: Opener")
            if "remote" in door_text or "remotes" in door_text:
                details.append("Accessory: Remote(s)")
            if "keypad" in door_text:
                details.append("Accessory: Keypad")
            
            # Add to doors list
            doors.append({
                'door_number': door_number,
                'description': f"Door #{door_number} extracted from audio recording.",
                'details': details
            })
        
        return jsonify({
            'recording_id': recording.id,
            'doors': doors
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audio/estimate/<int:estimate_id>/recordings', methods=['GET'])
def get_recordings(estimate_id):
    recordings = AudioRecording.query.filter_by(estimate_id=estimate_id).all()
    
    result = []
    for recording in recordings:
        result.append({
            'id': recording.id,
            'file_path': recording.file_path,
            'created_at': recording.created_at,
            'transcript': recording.transcript
        })
    
    return jsonify(result)


with app.app_context():
    db.create_all()
    create_default_users()  # Add this line

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)