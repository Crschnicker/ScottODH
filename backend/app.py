from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime, date
import os
import uuid
import json
import calendar

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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    estimates = db.relationship('Estimate', backref='customer', lazy=True)
    
class Estimate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    bids = db.relationship('Bid', backref='estimate', lazy=True)

class Bid(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    estimate_id = db.Column(db.Integer, db.ForeignKey('estimate.id'), nullable=False)
    status = db.Column(db.String(20), default='draft')  # draft, completed, approved
    total_cost = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    doors = db.relationship('Door', backref='bid', lazy=True)
    
class Door(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    bid_id = db.Column(db.Integer, db.ForeignKey('bid.id'), nullable=False)
    door_number = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
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
    month_letter = calendar.month_name[today.month][0]
    
    # Get count of jobs created this month (INCLUDING today)
    month_start = date(today.year, today.month, 1)
    month_end = date(today.year, today.month + 1, 1) if today.month < 12 else date(today.year + 1, 1, 1)
    
    # Count ALL jobs in current month, including today
    month_jobs = Job.query.filter(
        Job.created_at >= month_start,
        Job.created_at < month_end  # This changed from < today to < month_end
    ).count()
    
    # Add 1 to the count for the new job number
    job_number = f"{month_letter}{today.month}{month_jobs + 1}{str(today.year)[2:]}"
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
        phone=data.get('phone', '')
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
            phone=data.get('phone', '')
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

# API Routes - Reports
@app.route('/api/bids/<int:bid_id>/report', methods=['GET'])
def generate_bid_report(bid_id):
    # In a real application, this would generate a PDF report
    # For now, we'll just return the bid data
    bid = Bid.query.get_or_404(bid_id)
    return get_bid(bid_id)

@app.route('/api/bids/<int:bid_id>/proposal', methods=['GET'])
def generate_bid_proposal(bid_id):
    # In a real application, this would generate a PDF proposal
    # For now, we'll just return the bid data
    bid = Bid.query.get_or_404(bid_id)
    return get_bid(bid_id)

# Initialize database and run app
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)