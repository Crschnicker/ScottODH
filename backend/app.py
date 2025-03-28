from flask import Flask, request, jsonify, render_template, send_from_directory, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime, date
import os
import uuid
import json
import calendar
from flask import send_file
from io import BytesIO
import tempfile

# ReportLab imports
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///scott_overhead_doors.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Database Models
class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(200))
    lockbox_location = db.Column(db.String(200))
    contact_name = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))  # Added email field
    created_at = db.Column(db.DateTime, default=datetime.utcnow())
    estimates = db.relationship('Estimate', backref='customer', lazy=True)
    
class Estimate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    created_at = db.Column(db.DateTime, default=datetime.utcnow())
    bids = db.relationship('Bid', backref='estimate', lazy=True)
    audio_recordings = db.relationship('AudioRecording', backref='estimate', lazy=True)

class AudioRecording(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    estimate_id = db.Column(db.Integer, db.ForeignKey('estimate.id'), nullable=False)
    file_path = db.Column(db.String(200), nullable=False)
    transcript = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Bid(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    estimate_id = db.Column(db.Integer, db.ForeignKey('estimate.id'), nullable=False)
    status = db.Column(db.String(20), default='draft')  # draft, completed, approved
    total_cost = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow())
    doors = db.relationship('Door', backref='bid', lazy=True)
    
class Door(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    bid_id = db.Column(db.Integer, db.ForeignKey('bid.id'), nullable=False)
    door_number = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow())
    line_items = db.relationship('LineItem', backref='door', lazy=True)
    
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
    job_number = db.Column(db.String(10), unique=True)  # Format: MR2525
    bid_id = db.Column(db.Integer, db.ForeignKey('bid.id'), nullable=False)
    status = db.Column(db.String(20), default='unscheduled')  # unscheduled, scheduled, waiting_for_parts, on_hold, completed
    scheduled_date = db.Column(db.Date, nullable=True)
    material_ready = db.Column(db.Boolean, default=False)
    material_location = db.Column(db.String(1))  # S for Shop, C for Client
    region = db.Column(db.String(2))  # OC, LA, IE
    job_scope = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow())
    completed_doors = db.relationship('CompletedDoor', backref='job', lazy=True)
    
    # Add this relationship
    bid = db.relationship('Bid', backref='jobs', lazy=True)
    
class CompletedDoor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('job.id'), nullable=False)
    door_id = db.Column(db.Integer, db.ForeignKey('door.id'), nullable=False)
    signature = db.Column(db.Text)  # Base64 encoded signature
    photo_path = db.Column(db.String(200))
    video_path = db.Column(db.String(200))
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

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


# API Routes - Customers
@app.route('/api/customers', methods=['GET'])
def get_customers():
    customers = Customer.query.all()
    result = []
    for customer in customers:
        result.append({
            'id': customer.id,
            'name': customer.name,
            'address': customer.address,
            'lockbox_location': customer.lockbox_location,
            'contact_name': customer.contact_name,
            'phone': customer.phone,
            'email': customer.email,  # Added email
            'created_at': customer.created_at
        })
    return jsonify(result)

@app.route('/api/customers', methods=['POST'])
def create_customer():
    data = request.json
    customer = Customer(
        name=data['name'],
        address=data.get('address', ''),
        lockbox_location=data.get('lockbox_location', ''),
        contact_name=data.get('contact_name', ''),
        phone=data.get('phone', ''),
        email=data.get('email', '')  # Added email
    )
    db.session.add(customer)
    db.session.commit()
    return jsonify({
        'id': customer.id,
        'name': customer.name,
        'address': customer.address,
        'lockbox_location': customer.lockbox_location,
        'contact_name': customer.contact_name,
        'phone': customer.phone,
        'email': customer.email,  # Added email
        'created_at': customer.created_at
    }), 201

@app.route('/api/customers/<int:customer_id>', methods=['GET'])
def get_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    return jsonify({
        'id': customer.id,
        'name': customer.name,
        'address': customer.address,
        'lockbox_location': customer.lockbox_location,
        'contact_name': customer.contact_name,
        'phone': customer.phone,
        'email': customer.email,  # Added email
        'created_at': customer.created_at
    })

# API Routes - Estimates
@app.route('/api/estimates', methods=['GET'])
def get_estimates():
    estimates = Estimate.query.all()
    result = []
    for estimate in estimates:
        result.append({
            'id': estimate.id,
            'customer_id': estimate.customer_id,
            'customer_name': estimate.customer.name,
            'status': estimate.status,
            'created_at': estimate.created_at
        })
    return jsonify(result)

@app.route('/api/estimates', methods=['POST'])
def create_estimate():
    data = request.json
    
    # Create customer if needed
    customer_id = data.get('customer_id')
    if not customer_id:
        customer = Customer(
            name=data['customer_name'],
            address=data.get('address', ''),
            lockbox_location=data.get('lockbox_location', ''),
            contact_name=data.get('contact_name', ''),
            phone=data.get('phone', ''),
            email=data.get('email', '')  # Added email
        )
        db.session.add(customer)
        db.session.flush()
        customer_id = customer.id
    
    # Create estimate
    estimate = Estimate(
        customer_id=customer_id,
        status='pending'
    )
    db.session.add(estimate)
    db.session.commit()
    
    return jsonify({
        'id': estimate.id,
        'customer_id': estimate.customer_id,
        'customer_name': estimate.customer.name,
        'status': estimate.status,
        'created_at': estimate.created_at
    }), 201

@app.route('/api/estimates/<int:estimate_id>', methods=['GET'])
def get_estimate(estimate_id):
    estimate = Estimate.query.get_or_404(estimate_id)
    return jsonify({
        'id': estimate.id,
        'customer_id': estimate.customer_id,
        'customer_name': estimate.customer.name,
        'status': estimate.status,
        'created_at': estimate.created_at
    })

# API Routes - Bids
@app.route('/api/bids', methods=['GET'])
def get_bids():
    bids = Bid.query.all()
    result = []
    for bid in bids:
        result.append({
            'id': bid.id,
            'estimate_id': bid.estimate_id,
            'customer_name': bid.estimate.customer.name,
            'status': bid.status,
            'total_cost': bid.total_cost,
            'created_at': bid.created_at
        })
    return jsonify(result)

@app.route('/api/estimates/<int:estimate_id>/bids', methods=['POST'])
def create_bid(estimate_id):
    estimate = Estimate.query.get_or_404(estimate_id)
    
    # Create the bid
    bid = Bid(
        estimate_id=estimate_id,
        status='draft',
        total_cost=0.0
    )
    db.session.add(bid)
    
    # Update the estimate status to indicate it's been converted to a bid
    estimate.status = 'converted'  # Add this line
    
    db.session.commit()
    
    return jsonify({
        'id': bid.id,
        'estimate_id': bid.estimate_id,
        'customer_name': bid.estimate.customer.name,
        'status': bid.status,
        'total_cost': bid.total_cost,
        'created_at': bid.created_at
    }), 201
@app.route('/api/bids/<int:bid_id>', methods=['GET'])
def get_bid(bid_id):
    bid = Bid.query.get_or_404(bid_id)
    
    # Collect all doors and their line items
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
            door_labor_cost += item.labor_hours * 47.02  # $47.02 per hour labor rate
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
        
        doors_data.append({
            'id': door.id,
            'door_number': door.door_number,
            'line_items': line_items,
            'parts_cost': door_parts_cost,
            'labor_cost': door_labor_cost,
            'hardware_cost': door_hardware_cost,
            'total': door_total
        })
        
        total_parts_cost += door_parts_cost
        total_labor_cost += door_labor_cost
        total_hardware_cost += door_hardware_cost
    
    # Calculate tax (8.75%)
    tax_rate = 0.0875
    tax_amount = (total_parts_cost + total_hardware_cost) * tax_rate
    total_cost = total_parts_cost + total_labor_cost + total_hardware_cost + tax_amount
    
    # Update bid total cost
    bid.total_cost = total_cost
    db.session.commit()
    
    return jsonify({
        'id': bid.id,
        'estimate_id': bid.estimate_id,
        'customer_name': bid.estimate.customer.name,
        'customer_address': bid.estimate.customer.address,
        'customer_contact': bid.estimate.customer.contact_name,
        'customer_phone': bid.estimate.customer.phone,
        'customer_email': bid.estimate.customer.email,  # Added email
        'status': bid.status,
        'doors': doors_data,
        'total_parts_cost': total_parts_cost,
        'total_labor_cost': total_labor_cost,
        'total_hardware_cost': total_hardware_cost,
        'tax': tax_amount,
        'total_cost': total_cost,
        'created_at': bid.created_at
    })

@app.route('/api/bids/<int:bid_id>/doors', methods=['POST'])
def add_door(bid_id):
    bid = Bid.query.get_or_404(bid_id)
    data = request.json
    
    # Find the highest door number to assign next
    highest_door = Door.query.filter_by(bid_id=bid_id).order_by(Door.door_number.desc()).first()
    next_door_number = 1
    if highest_door:
        next_door_number = highest_door.door_number + 1
    
    # Override with provided door number if specified
    door_number = data.get('door_number', next_door_number)
    
    door = Door(
        bid_id=bid_id,
        door_number=door_number
    )
    db.session.add(door)
    db.session.commit()
    
    return jsonify({
        'id': door.id,
        'bid_id': door.bid_id,
        'door_number': door.door_number,
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
        # Create new door
        new_door = Door(
            bid_id=source_door.bid_id,
            door_number=door_number
        )
        db.session.add(new_door)
        db.session.flush()  # Get new door ID
        
        # Duplicate all line items
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
        
        created_doors.append({
            'id': new_door.id,
            'door_number': new_door.door_number
        })
    
    db.session.commit()
    
    return jsonify({
        'source_door_id': door_id,
        'created_doors': created_doors
    }), 201

@app.route('/api/bids/<int:bid_id>/approve', methods=['POST'])
def approve_bid(bid_id):
    bid = Bid.query.get_or_404(bid_id)
    bid.status = 'approved'
    db.session.commit()
    
    # Generate job number
    job_number = generate_job_number()
    
    # Create job
    job = Job(
        job_number=job_number,
        bid_id=bid_id,
        status='unscheduled',
        material_ready=False,
        material_location='S',  # Default to Shop
        region=request.json.get('region', 'OC'),  # Default to Orange County
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

# API Routes - Jobs
@app.route('/api/jobs', methods=['GET'])
def get_jobs():
    region = request.args.get('region')
    status = request.args.get('status')
    search = request.args.get('search', '')
    
    query = Job.query
    
    if region:
        query = query.filter_by(region=region)
    
    if status:
        query = query.filter_by(status=status)
    
    if search:
        query = query.join(Bid).join(Estimate).join(Customer).filter(
            (Job.job_number.like(f'%{search}%')) |
            (Customer.name.like(f'%{search}%')) |
            (Job.job_scope.like(f'%{search}%'))
        )
    
    jobs = query.all()
    result = []
    
    for job in jobs:
        result.append({
            'id': job.id,
            'job_number': job.job_number,
            'customer_name': job.bid.estimate.customer.name,
            'address': job.bid.estimate.customer.address,
            'job_scope': job.job_scope,
            'scheduled_date': job.scheduled_date,
            'status': job.status,
            'material_ready': job.material_ready,
            'material_location': job.material_location,
            'region': job.region
        })
    
    return jsonify(result)

@app.route('/api/jobs/<int:job_id>', methods=['GET'])
def get_job(job_id):
    job = Job.query.get_or_404(job_id)
    
    # Get doors from the bid
    doors = []
    for door in job.bid.doors:
        # Check if this door has been completed
        completed = CompletedDoor.query.filter_by(job_id=job.id, door_id=door.id).first()
        
        doors.append({
            'id': door.id,
            'door_number': door.door_number,
            'completed': completed is not None,
            'completed_at': completed.completed_at if completed else None
        })
    
    return jsonify({
        'id': job.id,
        'job_number': job.job_number,
        'customer_name': job.bid.estimate.customer.name,
        'address': job.bid.estimate.customer.address,
        'contact_name': job.bid.estimate.customer.contact_name,
        'phone': job.bid.estimate.customer.phone,
        'email': job.bid.estimate.customer.email,  # Added email
        'job_scope': job.job_scope,
        'scheduled_date': job.scheduled_date,
        'status': job.status,
        'material_ready': job.material_ready,
        'material_location': job.material_location,
        'region': job.region,
        'doors': doors
    })

@app.route('/api/jobs/<int:job_id>/schedule', methods=['POST'])
def schedule_job(job_id):
    job = Job.query.get_or_404(job_id)
    data = request.json
    
    scheduled_date = data.get('scheduled_date')
    if scheduled_date:
        job.scheduled_date = datetime.strptime(scheduled_date, '%Y-%m-%d').date()
        job.status = 'scheduled'
    
    job.material_ready = data.get('material_ready', job.material_ready)
    job.material_location = data.get('material_location', job.material_location)
    job.region = data.get('region', job.region)
    job.job_scope = data.get('job_scope', job.job_scope)
    
    db.session.commit()
    
    return jsonify({
        'id': job.id,
        'job_number': job.job_number,
        'scheduled_date': job.scheduled_date,
        'status': job.status,
        'material_ready': job.material_ready,
        'material_location': job.material_location,
        'region': job.region,
        'job_scope': job.job_scope
    }), 200

@app.route('/api/jobs/<int:job_id>/status', methods=['PUT'])
def update_job_status(job_id):
    job = Job.query.get_or_404(job_id)
    data = request.json
    
    job.status = data.get('status', job.status)
    db.session.commit()
    
    return jsonify({
        'id': job.id,
        'job_number': job.job_number,
        'status': job.status
    }), 200

@app.route('/api/jobs/<int:job_id>/doors/<int:door_id>/complete', methods=['POST'])
def complete_door(job_id, door_id):
    job = Job.query.get_or_404(job_id)
    door = Door.query.get_or_404(door_id)
    data = request.json
    
    # Handle file uploads (in a real app, this would save files to disk or cloud storage)
    # Here we're just storing the file paths for demonstration
    photo_path = f"uploads/{job.job_number}/door_{door.door_number}_photo.jpg"
    video_path = f"uploads/{job.job_number}/door_{door.door_number}_video.mp4"
    
    completed_door = CompletedDoor(
        job_id=job_id,
        door_id=door_id,
        signature=data.get('signature', ''),
        photo_path=photo_path,
        video_path=video_path
    )
    
    db.session.add(completed_door)
    db.session.commit()
    
    # Check if all doors are completed
    total_doors = len(job.bid.doors)
    completed_doors = CompletedDoor.query.filter_by(job_id=job_id).count()
    
    if completed_doors == total_doors:
        job.status = 'completed'
        db.session.commit()
    
    return jsonify({
        'id': completed_door.id,
        'job_id': completed_door.job_id,
        'door_id': completed_door.door_id,
        'completed_at': completed_door.completed_at,
        'all_completed': completed_doors == total_doors
    }), 201

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

@app.route('/api/audio/upload', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    
    audio_file = request.files['audio']
    estimate_id = request.form.get('estimate_id')
    
    if not estimate_id:
        return jsonify({'error': 'Estimate ID is required'}), 400
    
    # Check if estimate exists
    estimate = Estimate.query.get(estimate_id)
    if not estimate:
        return jsonify({'error': 'Estimate not found'}), 404
    
    # Generate a filename and save the audio file
    filename = f"{uuid.uuid4()}.wav"
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    audio_file.save(file_path)
    
    # Create a record in the database
    recording = AudioRecording(
        estimate_id=estimate_id,
        file_path=file_path,
        created_at=datetime.utcnow()
    )
    db.session.add(recording)
    db.session.commit()
    
    return jsonify({
        'id': recording.id,
        'estimate_id': recording.estimate_id,
        'file_path': recording.file_path,
        'created_at': recording.created_at
    }), 201

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

@app.route('/api/audio/<int:recording_id>/transcribe', methods=['POST'])
def transcribe_audio(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    if not os.path.exists(recording.file_path):
        return jsonify({'error': 'Audio file not found'}), 404
    
    try:
        # Note: In a real application, you would implement speech-to-text here
        # For demo purposes, we'll just set a dummy transcript
        # You would use a library like SpeechRecognition or a service like Google Speech-to-Text
        
        # Dummy transcript for demonstration
        transcript = """Door number 1 is a 10 by 8 standard steel door with windows on the top section. 
        Door number 2 needs to be replaced completely, it's 12 by 10 insulated with a keypad entry.
        Door number 3 is 8 by 7 with a new opener and two remotes."""
        
        # Save transcript to database
        recording.transcript = transcript
        db.session.commit()
        
        return jsonify({
            'id': recording.id,
            'transcript': transcript
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)