import os
import pathlib

def create_project_structure():
    # Create main project directory
    project_dir = "Ace-overhead-doors"
    os.makedirs(project_dir, exist_ok=True)
    
    # Create backend structure
    os.makedirs(f"{project_dir}/backend/static", exist_ok=True)
    os.makedirs(f"{project_dir}/backend/templates", exist_ok=True)
    
    # Create frontend structure
    directories = [
        f"{project_dir}/frontend/public",
        f"{project_dir}/frontend/src/components/common",
        f"{project_dir}/frontend/src/components/customers",
        f"{project_dir}/frontend/src/components/estimates",
        f"{project_dir}/frontend/src/components/bids",
        f"{project_dir}/frontend/src/components/jobs",
        f"{project_dir}/frontend/src/components/scheduling",
        f"{project_dir}/frontend/src/pages",
        f"{project_dir}/frontend/src/services",
        f"{project_dir}/frontend/src/utils"
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
    
    print("Project structure created successfully!")
    
    # Return the project directory for use by the file creation functions
    return project_dir

def populate_files(project_dir):
    # Dictionary to store all file contents
    file_contents = {}
    
    # Backend Files
    file_contents[f"{project_dir}/backend/app.py"] = '''from flask import Flask, request, jsonify, render_template, send_from_directory
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
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///Ace_doors.db'
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
    
class CompletedDoor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('job.id'), nullable=False)
    door_id = db.Column(db.Integer, db.ForeignKey('door.id'), nullable=False)
    signature = db.Column(db.Text)  # Base64 encoded signature
    photo_path = db.Column(db.String(200))
    video_path = db.Column(db.String(200))
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

# Helper Functions
def generate_job_number():
    today = date.today()
    month_letter = calendar.month_name[today.month][0]
    # Get count of jobs created this month
    month_start = date(today.year, today.month, 1)
    month_jobs = Job.query.filter(
        Job.created_at >= month_start,
        Job.created_at < today
    ).count()
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
    
    bid = Bid(
        estimate_id=estimate_id,
        status='draft',
        total_cost=0.0
    )
    db.session.add(bid)
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
    app.run(debug=True, port=5000)
'''

    file_contents[f"{project_dir}/backend/requirements.txt"] = '''Flask==2.3.3
Flask-SQLAlchemy==3.1.1
Flask-Cors==4.0.0
Pillow==10.0.1  # For image processing
python-dotenv==1.0.0
'''

    file_contents[f"{project_dir}/backend/config.py"] = '''import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-for-Ace-overhead-doors'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///Ace_doors.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER') or 'uploads'
'''

    # Frontend Files - Package and Config
    file_contents[f"{project_dir}/frontend/package.json"] = '''{
  "name": "Ace-overhead-doors",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@testing-library/jest-dom": "^5.17.0",
    "@testing-library/react": "^13.4.0",
    "@testing-library/user-event": "^13.5.0",
    "axios": "^1.5.0",
    "bootstrap": "^5.3.1",
    "moment": "^2.29.4",
    "react": "^18.2.0",
    "react-bootstrap": "^2.8.0",
    "react-calendar": "^4.6.0",
    "react-dom": "^18.2.0",
    "react-icons": "^4.10.1",
    "react-router-dom": "^6.15.0",
    "react-scripts": "5.0.1",
    "react-signature-canvas": "^1.0.6",
    "react-tabs": "^6.0.2",
    "react-toastify": "^9.1.3",
    "uuid": "^9.0.0",
    "web-vitals": "^2.1.4"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "proxy": "http://localhost:5000"
}
'''

    file_contents[f"{project_dir}/frontend/public/index.html"] = '''<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="Ace Overhead Doors - Bid, Proposal, and Scheduler System"
    />
    <link rel="apple-touch-icon" href="%PUBLIC_URL%/logo192.png" />
    <title>Ace Overhead Doors</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
'''

    # Frontend - Core Files
    file_contents[f"{project_dir}/frontend/src/index.js"] = '''import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
'''

    file_contents[f"{project_dir}/frontend/src/App.js"] = '''import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';

// Common Components
import Header from './components/common/Header';
import Sidebar from './components/common/Sidebar';
import Footer from './components/common/Footer';

// Pages
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Estimates from './pages/Estimates';
import Bids from './pages/Bids';
import Jobs from './pages/Jobs';
import Schedule from './pages/Schedule';

// CSS
import './App.css';

function App() {
  return (
    <div className="app-container">
      <Header />
      <div className="content-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/estimates" element={<Estimates />} />
            <Route path="/bids" element={<Bids />} />
            <Route path="/bids/:bidId" element={<Bids />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:jobId" element={<Jobs />} />
            <Route path="/schedule" element={<Schedule />} />
          </Routes>
        </main>
      </div>
      <Footer />
      <ToastContainer position="bottom-right" />
    </div>
  );
}

export default App;
'''

    file_contents[f"{project_dir}/frontend/src/App.css"] = '''.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.content-container {
  display: flex;
  flex: 1;
}

.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

/* Common styles */
.section-title {
  margin-bottom: 20px;
  color: #333;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 10px;
}

.card {
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.btn-primary {
  background-color: #0056b3;
  border-color: #0056b3;
}

.btn-success {
  background-color: #28a745;
  border-color: #28a745;
}

.btn-danger {
  background-color: #dc3545;
  border-color: #dc3545;
}

/* Table styles */
.table th {
  background-color: #f8f9fa;
}

.table-hover tbody tr:hover {
  background-color: rgba(0, 123, 255, 0.1);
}

/* Form styles */
.form-control:focus {
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

/* Door tabs */
.door-tabs {
  margin-bottom: 20px;
}

.door-tab {
  padding: 10px 15px;
  margin-right: 5px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px 4px 0 0;
  cursor: pointer;
}

.door-tab.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

/* Mobile styles */
@media (max-width: 768px) {
  .content-container {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    padding: 10px;
  }
}
'''

    # Common Components
    file_contents[f"{project_dir}/frontend/src/components/common/Header.js"] = '''import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar, Container, Nav } from 'react-bootstrap';

const Header = () => {
  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/">
          Ace Overhead Doors
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Link as={Link} to="/">Dashboard</Nav.Link>
            <Nav.Link as={Link} to="/customers">Customers</Nav.Link>
            <Nav.Link as={Link} to="/estimates">Estimates</Nav.Link>
            <Nav.Link as={Link} to="/bids">Bids</Nav.Link>
            <Nav.Link as={Link} to="/jobs">Jobs</Nav.Link>
            <Nav.Link as={Link} to="/schedule">Schedule</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Header;
'''

    file_contents[f"{project_dir}/frontend/src/components/common/Sidebar.js"] = '''import React from 'react';
import { Link } from 'react-router-dom';
import { Nav } from 'react-bootstrap';
import { FaHome, FaUsers, FaClipboardList, FaFileInvoiceDollar, FaTools, FaCalendar } from 'react-icons/fa';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <Nav className="flex-column">
        <Nav.Link as={Link} to="/" className="sidebar-link">
          <FaHome className="sidebar-icon" /> Dashboard
        </Nav.Link>
        <Nav.Link as={Link} to="/customers" className="sidebar-link">
          <FaUsers className="sidebar-icon" /> Customers
        </Nav.Link>
        <Nav.Link as={Link} to="/estimates" className="sidebar-link">
          <FaClipboardList className="sidebar-icon" /> Estimates
        </Nav.Link>
        <Nav.Link as={Link} to="/bids" className="sidebar-link">
          <FaFileInvoiceDollar className="sidebar-icon" /> Bids
        </Nav.Link>
        <Nav.Link as={Link} to="/jobs" className="sidebar-link">
          <FaTools className="sidebar-icon" /> Jobs
        </Nav.Link>
        <Nav.Link as={Link} to="/schedule" className="sidebar-link">
          <FaCalendar className="sidebar-icon" /> Schedule
        </Nav.Link>
      </Nav>
    </div>
  );
};

export default Sidebar;
'''

    file_contents[f"{project_dir}/frontend/src/components/common/Sidebar.css"] = '''.sidebar {
  width: 250px;
  background-color: #343a40;
  color: white;
  padding: 20px 0;
  min-height: calc(100vh - 56px);
}

.sidebar-link {
  color: #f8f9fa !important;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  transition: all 0.3s ease;
}

.sidebar-link:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.sidebar-icon {
  margin-right: 10px;
  font-size: 1.2rem;
}

@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    min-height: auto;
  }
}
'''

    file_contents[f"{project_dir}/frontend/src/components/common/Footer.js"] = '''import React from 'react';
import { Container } from 'react-bootstrap';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer">
      <Container>
        <p className="text-center mb-0">
          &copy; {currentYear} Ace Overhead Doors. All rights reserved.
        </p>
      </Container>
    </footer>
  );
};

export default Footer;
'''

    file_contents[f"{project_dir}/frontend/src/components/common/Footer.css"] = '''.footer {
  padding: 15px 0;
  background-color: #f8f9fa;
  border-top: 1px solid #e9ecef;
  text-align: center;
  margin-top: auto;
}
'''

    # Customer Components
    file_contents[f"{project_dir}/frontend/src/components/customers/CustomerForm.js"] = '''import React, { useState } from 'react';
import { Form, Button, Card } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { createCustomer } from '../../services/customerService';

const CustomerForm = ({ onCustomerCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    lockbox_location: '',
    contact_name: '',
    phone: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Customer name is required');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const newCustomer = await createCustomer(formData);
      toast.success('Customer created successfully');
      setFormData({
        name: '',
        address: '',
        lockbox_location: '',
        contact_name: '',
        phone: ''
      });
      
      if (onCustomerCreated) {
        onCustomerCreated(newCustomer);
      }
    } catch (error) {
      toast.error('Error creating customer');
      console.error('Error creating customer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card className="mb-4">
      <Card.Header>Add New Customer</Card.Header>
      <Card.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Customer Name *</Form.Label>
            <Form.Control
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter company or customer name"
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Address</Form.Label>
            <Form.Control
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter address"
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Lockbox Location</Form.Label>
            <Form.Control
              type="text"
              name="lockbox_location"
              value={formData.lockbox_location}
              onChange={handleChange}
              placeholder="Enter lockbox location"
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Point of Contact</Form.Label>
            <Form.Control
              type="text"
              name="contact_name"
              value={formData.contact_name}
              onChange={handleChange}
              placeholder="Enter contact person's name"
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Phone Number</Form.Label>
            <Form.Control
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter phone number"
            />
          </Form.Group>
          
          <Button 
            variant="primary" 
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Customer'}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default CustomerForm;
'''

    file_contents[f"{project_dir}/frontend/src/components/customers/CustomerList.js"] = '''import React, { useState, useEffect } from 'react';
import { Table, Button, Form, InputGroup } from 'react-bootstrap';
import { FaSearch, FaUserPlus } from 'react-icons/fa';
import { getCustomers } from '../../services/customerService';
import './CustomerList.css';

const CustomerList = ({ onSelectCustomer, onAddNewClick }) => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadCustomers();
  }, []);
  
  useEffect(() => {
    if (searchTerm) {
      const filtered = customers.filter(customer => 
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.contact_name && customer.contact_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (customer.phone && customer.phone.includes(searchTerm))
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchTerm, customers]);
  
  const loadCustomers = async () => {
    try {
      const data = await getCustomers();
      setCustomers(data);
      setFilteredCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  const handleSelect = (customer) => {
    if (onSelectCustomer) {
      onSelectCustomer(customer);
    }
  };
  
  if (loading) {
    return <div>Loading customers...</div>;
  }
  
  return (
    <div className="customer-list-container">
      <div className="customer-list-header">
        <h2>Customers</h2>
        <div className="customer-list-actions">
          <InputGroup className="search-input">
            <InputGroup.Text>
              <FaSearch />
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </InputGroup>
          {onAddNewClick && (
            <Button 
              variant="primary" 
              className="add-customer-btn"
              onClick={onAddNewClick}
            >
              <FaUserPlus /> Add New
            </Button>
          )}
        </div>
      </div>
      
      {filteredCustomers.length === 0 ? (
        <p>No customers found. {searchTerm && 'Try a different search term or '} 
          {onAddNewClick ? (
            <Button 
              variant="link" 
              className="p-0" 
              onClick={onAddNewClick}
            >
              add a new customer
            </Button>
          ) : 'add a new customer'}
        </p>
      ) : (
        <Table striped hover responsive className="customer-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Phone</th>
              <th>Address</th>
              {onSelectCustomer && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map(customer => (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>{customer.contact_name || '-'}</td>
                <td>{customer.phone || '-'}</td>
                <td>{customer.address || '-'}</td>
                {onSelectCustomer && (
                  <td>
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={() => handleSelect(customer)}
                    >
                      Select
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default CustomerList;
'''

    file_contents[f"{project_dir}/frontend/src/components/customers/CustomerList.css"] = '''.customer-list-container {
  margin-bottom: 30px;
}

.customer-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.customer-list-actions {
  display: flex;
  align-items: center;
}

.search-input {
  width: 300px;
  margin-right: 15px;
}

.customer-table th,
.customer-table td {
  vertical-align: middle;
}

@media (max-width: 768px) {
  .customer-list-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .customer-list-actions {
    margin-top: 10px;
    width: 100%;
  }
  
  .search-input {
    width: 100%;
    margin-right: 0;
    margin-bottom: 10px;
  }
  
  .add-customer-btn {
    width: 100%;
  }
}
'''

    # Estimate Components
    file_contents[f"{project_dir}/frontend/src/components/estimates/EstimateForm.js"] = '''import React, { useState } from 'react';
import { Form, Button, Row, Col, Card } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { createEstimate } from '../../services/estimateService';
import CustomerList from '../customers/CustomerList';
import CustomerForm from '../customers/CustomerForm';

const EstimateForm = ({ onEstimateCreated }) => {
  const [formData, setFormData] = useState({
    customer_id: null,
    customer_name: '',
    address: '',
    lockbox_location: '',
    contact_name: '',
    phone: ''
  });
  
  const [showExistingCustomers, setShowExistingCustomers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const toggleCustomerSource = () => {
    setShowExistingCustomers(!showExistingCustomers);
  };
  
  const handleSelectCustomer = (customer) => {
    setFormData({
      ...formData,
      customer_id: customer.id,
      customer_name: customer.name,
      address: customer.address || '',
      lockbox_location: customer.lockbox_location || '',
      contact_name: customer.contact_name || '',
      phone: customer.phone || ''
    });
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleCustomerCreated = (customer) => {
    handleSelectCustomer(customer);
    setShowExistingCustomers(true);
    toast.success('Customer created and selected');
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.customer_id && !formData.customer_name) {
      toast.error('Please select or create a customer');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const newEstimate = await createEstimate(formData);
      toast.success('Estimate created successfully');
      
      // Reset form
      setFormData({
        customer_id: null,
        customer_name: '',
        address: '',
        lockbox_location: '',
        contact_name: '',
        phone: ''
      });
      
      if (onEstimateCreated) {
        onEstimateCreated(newEstimate);
      }
    } catch (error) {
      toast.error('Error creating estimate');
      console.error('Error creating estimate:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card>
      <Card.Header>
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">New Estimate</h4>
          <Button 
            variant="outline-primary"
            onClick={toggleCustomerSource}
          >
            {showExistingCustomers ? 'Create New Customer' : 'Select Existing Customer'}
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        {showExistingCustomers ? (
          <>
            <h5>Select a Customer</h5>
            <CustomerList 
              onSelectCustomer={handleSelectCustomer} 
              onAddNewClick={toggleCustomerSource}
            />
          </>
        ) : (
          <CustomerForm onCustomerCreated={handleCustomerCreated} />
        )}
        
        {formData.customer_id || formData.customer_name ? (
          <Form onSubmit={handleSubmit} className="mt-4">
            <Card>
              <Card.Header>Selected Customer</Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <p><strong>Name:</strong> {formData.customer_name}</p>
                    <p><strong>Address:</strong> {formData.address || 'N/A'}</p>
                    <p><strong>Lockbox Location:</strong> {formData.lockbox_location || 'N/A'}</p>
                  </Col>
                  <Col md={6}>
                    <p><strong>Contact:</strong> {formData.contact_name || 'N/A'}</p>
                    <p><strong>Phone:</strong> {formData.phone || 'N/A'}</p>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
            
            <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-3">
              <Button 
                variant="secondary" 
                onClick={() => setFormData({
                  customer_id: null,
                  customer_name: '',
                  address: '',
                  lockbox_location: '',
                  contact_name: '',
                  phone: ''
                })}
                className="me-md-2"
              >
                Clear Selection
              </Button>
              <Button 
                variant="primary" 
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Estimate'}
              </Button>
            </div>
          </Form>
        ) : null}
      </Card.Body>
    </Card>
  );
};

export default EstimateForm;
'''

    file_contents[f"{project_dir}/frontend/src/components/estimates/EstimateList.js"] = '''import React, { useState, useEffect } from 'react';
import { Table, Button, Badge, Form, InputGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaSearch, FaPlus } from 'react-icons/fa';
import { getEstimates } from '../../services/estimateService';
import './EstimateList.css';

const EstimateList = ({ onCreateClick, onSelectEstimate }) => {
  const [estimates, setEstimates] = useState([]);
  const [filteredEstimates, setFilteredEstimates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadEstimates();
  }, []);
  
  useEffect(() => {
    if (searchTerm) {
      const filtered = estimates.filter(estimate => 
        estimate.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEstimates(filtered);
    } else {
      setFilteredEstimates(estimates);
    }
  }, [searchTerm, estimates]);
  
  const loadEstimates = async () => {
    try {
      const data = await getEstimates();
      setEstimates(data);
      setFilteredEstimates(data);
    } catch (error) {
      console.error('Error loading estimates:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return <Badge bg="warning">Pending</Badge>;
      case 'approved':
        return <Badge bg="success">Approved</Badge>;
      case 'rejected':
        return <Badge bg="danger">Rejected</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };
  
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  if (loading) {
    return <div>Loading estimates...</div>;
  }
  
  return (
    <div className="estimate-list-container">
      <div className="estimate-list-header">
        <h2>Estimates</h2>
        <div className="estimate-list-actions">
          <InputGroup className="search-input">
            <InputGroup.Text>
              <FaSearch />
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search by customer name..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </InputGroup>
          {onCreateClick && (
            <Button 
              variant="primary" 
              className="add-estimate-btn"
              onClick={onCreateClick}
            >
              <FaPlus /> New Estimate
            </Button>
          )}
        </div>
      </div>
      
      {filteredEstimates.length === 0 ? (
        <p>No estimates found. {searchTerm && 'Try a different search term or '} 
          {onCreateClick ? (
            <Button 
              variant="link" 
              className="p-0" 
              onClick={onCreateClick}
            >
              create a new estimate
            </Button>
          ) : 'create a new estimate'}
        </p>
      ) : (
        <Table striped hover responsive className="estimate-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Date Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEstimates.map(estimate => (
              <tr key={estimate.id}>
                <td>EST-{estimate.id}</td>
                <td>{estimate.customer_name}</td>
                <td>{formatDate(estimate.created_at)}</td>
                <td>{getStatusBadge(estimate.status)}</td>
                <td>
                  {onSelectEstimate ? (
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={() => onSelectEstimate(estimate)}
                      className="me-2"
                    >
                      Select
                    </Button>
                  ) : null}
                  
                  <Link to={`/bids?estimateId=${estimate.id}`}>
                    <Button 
                      variant="outline-success" 
                      size="sm"
                    >
                      Create Bid
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default EstimateList;
'''

    file_contents[f"{project_dir}/frontend/src/components/estimates/EstimateList.css"] = '''.estimate-list-container {
  margin-bottom: 30px;
}

.estimate-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.estimate-list-actions {
  display: flex;
  align-items: center;
}

.search-input {
  width: 300px;
  margin-right: 15px;
}

.estimate-table th,
.estimate-table td {
  vertical-align: middle;
}

@media (max-width: 768px) {
  .estimate-list-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .estimate-list-actions {
    margin-top: 10px;
    width: 100%;
  }
  
  .search-input {
    width: 100%;
    margin-right: 0;
    margin-bottom: 10px;
  }
  
  .add-estimate-btn {
    width: 100%;
  }
}
'''

    # Bid Components
    file_contents[f"{project_dir}/frontend/src/components/bids/BidForm.js"] = '''import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Nav, Tab, Form, Button } from 'react-bootstrap';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaPlus, FaSave, FaFileInvoiceDollar, FaFileAlt } from 'react-icons/fa';
import DoorTabs from './DoorTabs';
import LineItemTable from './LineItemTable';
import { createBid, getBid, approveBid } from '../../services/bidService';
import { getEstimate } from '../../services/estimateService';
import './BidForm.css';

const BidForm = () => {
  const [estimate, setEstimate] = useState(null);
  const [bid, setBid] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [activeDoorTab, setActiveDoorTab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingBid, setSavingBid] = useState(false);
  
  const { bidId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const estimateId = queryParams.get('estimateId');
  
  useEffect(() => {
    const loadData = async () => {
      try {
        if (bidId) {
          // Load existing bid
          const bidData = await getBid(bidId);
          setBid(bidData);
          
          // Set first door as active if available
          if (bidData.doors && bidData.doors.length > 0) {
            setActiveDoorTab(bidData.doors[0].id);
          }
          
          // Load estimate info
          const estimateData = await getEstimate(bidData.estimate_id);
          setEstimate(estimateData);
        } else if (estimateId) {
          // Load estimate for new bid
          const estimateData = await getEstimate(estimateId);
          setEstimate(estimateData);
          
          // Create new bid
          const newBid = await createBid(estimateId);
          setBid(newBid);
          
          // Navigate to the bid page to avoid creating multiple bids
          navigate(`/bids/${newBid.id}`, { replace: true });
        } else {
          // No bid or estimate specified
          toast.error('No estimate selected');
          navigate('/estimates');
        }
      } catch (error) {
        console.error('Error loading bid data:', error);
        toast.error('Error loading bid data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [bidId, estimateId, navigate]);
  
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };
  
  const handleDoorTabChange = (doorId) => {
    setActiveDoorTab(doorId);
  };
  
  const handleSaveBid = async () => {
    setSavingBid(true);
    try {
      // In a real app, we would save the entire bid state here
      // For this MVP, we'll rely on the individual save operations in LineItemTable
      const refreshedBid = await getBid(bid.id);
      setBid(refreshedBid);
      toast.success('Bid saved successfully');
    } catch (error) {
      console.error('Error saving bid:', error);
      toast.error('Error saving bid');
    } finally {
      setSavingBid(false);
    }
  };
  
  const handleGenerateReport = () => {
    window.open(`/api/bids/${bid.id}/report`, '_blank');
    toast.info('Report generated');
  };
  
  const handleGenerateProposal = () => {
    window.open(`/api/bids/${bid.id}/proposal`, '_blank');
    toast.info('Proposal generated');
  };
  
  const handleApproveBid = async () => {
    try {
      const result = await approveBid(bid.id, {
        region: 'OC',  // Default to Orange County
        job_scope: `Door work for ${bid.customer_name}`
      });
      
      toast.success(`Bid approved and Job #${result.job_number} created`);
      navigate(`/jobs/${result.job_id}`);
    } catch (error) {
      console.error('Error approving bid:', error);
      toast.error('Error approving bid');
    }
  };
  
  if (loading) {
    return <div>Loading bid data...</div>;
  }
  
  if (!bid || !estimate) {
    return <div>Error: Bid or estimate data not found</div>;
  }
  
  return (
    <div className="bid-form-container">
      <div className="bid-header">
        <h2>Bid for {bid.customer_name}</h2>
        <div className="bid-actions">
          <Button 
            variant="success" 
            className="me-2" 
            onClick={handleSaveBid}
            disabled={savingBid}
          >
            <FaSave /> {savingBid ? 'Saving...' : 'Save Bid'}
          </Button>
          <Button 
            variant="primary" 
            className="me-2" 
            onClick={handleGenerateReport}
          >
            <FaFileAlt /> Report
          </Button>
          <Button 
            variant="info" 
            className="me-2" 
            onClick={handleGenerateProposal}
          >
            <FaFileInvoiceDollar /> Proposal
          </Button>
          <Button 
            variant="warning" 
            onClick={handleApproveBid}
          >
            Approve & Create Job
          </Button>
        </div>
      </div>
      
      <Tab.Container activeKey={activeTab} onSelect={handleTabChange}>
        <Row>
          <Col sm={12}>
            <Nav variant="tabs" className="mb-3">
              <Nav.Item>
                <Nav.Link eventKey="info">Customer Info</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="doors">Doors</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="summary">Summary</Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>
        </Row>
        
        <Row>
          <Col sm={12}>
            <Tab.Content>
              <Tab.Pane eventKey="info">
                <Card>
                  <Card.Header>Customer Information</Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={6}>
                        <p><strong>Customer Name:</strong> {bid.customer_name}</p>
                        <p><strong>Address:</strong> {bid.customer_address || 'N/A'}</p>
                        <p><strong>Estimate ID:</strong> EST-{bid.estimate_id}</p>
                      </Col>
                      <Col md={6}>
                        <p><strong>Contact:</strong> {bid.customer_contact || 'N/A'}</p>
                        <p><strong>Phone:</strong> {bid.customer_phone || 'N/A'}</p>
                        <p><strong>Bid Status:</strong> {bid.status.toUpperCase()}</p>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Tab.Pane>
              
              <Tab.Pane eventKey="doors">
                <DoorTabs 
                  doors={bid.doors || []} 
                  activeDoorId={activeDoorTab}
                  onTabChange={handleDoorTabChange}
                  bidId={bid.id}
                />
                
                {activeDoorTab && (
                  <LineItemTable 
                    doorId={activeDoorTab}
                    door={bid.doors.find(d => d.id === activeDoorTab)}
                    onUpdate={() => getBid(bid.id).then(newBid => setBid(newBid))}
                  />
                )}
              </Tab.Pane>
              
              <Tab.Pane eventKey="summary">
                <Card>
                  <Card.Header>Cost Summary</Card.Header>
                  <Card.Body>
                    <div className="bid-summary">
                      <div className="summary-item">
                        <span>Total Parts Cost:</span>
                        <span>${bid.total_parts_cost?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="summary-item">
                        <span>Total Labor Cost:</span>
                        <span>${bid.total_labor_cost?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="summary-item">
                        <span>Total Hardware Cost:</span>
                        <span>${bid.total_hardware_cost?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="summary-item">
                        <span>Tax (8.75%):</span>
                        <span>${bid.tax?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="summary-item total">
                        <span>Total Cost:</span>
                        <span>${bid.total_cost?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                    
                    <h5 className="mt-4">Door Summary</h5>
                    <Table striped bordered>
                      <thead>
                        <tr>
                          <th>Door #</th>
                          <th>Parts</th>
                          <th>Labor</th>
                          <th>Hardware</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bid.doors?.map(door => (
                          <tr key={door.id}>
                            <td>{door.door_number}</td>
                            <td>${door.parts_cost?.toFixed(2) || '0.00'}</td>
                            <td>${door.labor_cost?.toFixed(2) || '0.00'}</td>
                            <td>${door.hardware_cost?.toFixed(2) || '0.00'}</td>
                            <td>${door.total?.toFixed(2) || '0.00'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </Tab.Pane>
            </Tab.Content>
          </Col>
        </Row>
      </Tab.Container>
    </div>
  );
};

export default BidForm;
'''

    file_contents[f"{project_dir}/frontend/src/components/bids/BidForm.css"] = '''.bid-form-container {
  margin-bottom: 40px;
}

.bid-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .bid-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .bid-actions {
    margin-top: 15px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
}

.bid-summary {
  max-width: 500px;
  margin: 0 auto;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.summary-item.total {
  font-weight: bold;
  font-size: 1.2em;
  margin-top: 10px;
  border-top: 2px solid #333;
  border-bottom: none;
}
'''

    file_contents[f"{project_dir}/frontend/src/components/bids/DoorTabs.js"] = '''import React, { useState } from 'react';
import { Button, InputGroup, FormControl, Modal } from 'react-bootstrap';
import { FaPlus, FaCopy, FaCheck } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { addDoor, duplicateDoor } from '../../services/bidService';
import './DoorTabs.css';

const DoorTabs = ({ doors, activeDoorId, onTabChange, bidId }) => {
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [sourceDoorId, setSourceDoorId] = useState(null);
  const [targetDoors, setTargetDoors] = useState('');
  const [isAddingDoor, setIsAddingDoor] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  
  const handleAddDoor = async () => {
    if (!bidId) return;
    
    setIsAddingDoor(true);
    try {
      const newDoor = await addDoor(bidId);
      toast.success(`Door #${newDoor.door_number} added`);
      
      // Select the new door
      if (onTabChange) {
        onTabChange(newDoor.id);
      }
    } catch (error) {
      console.error('Error adding door:', error);
      toast.error('Error adding door');
    } finally {
      setIsAddingDoor(false);
    }
  };
  
  const openDuplicateModal = (doorId) => {
    setSourceDoorId(doorId);
    setTargetDoors('');
    setShowDuplicateModal(true);
  };
  
  const handleDuplicateDoor = async () => {
    if (!sourceDoorId || !targetDoors.trim()) {
      toast.error('Please enter target door numbers');
      return;
    }
    
    // Parse door numbers
    const doorNumbers = targetDoors
      .split(',')
      .map(num => num.trim())
      .filter(num => num && !isNaN(parseInt(num)))
      .map(num => parseInt(num));
    
    if (doorNumbers.length === 0) {
      toast.error('Please enter valid door numbers (comma-separated)');
      return;
    }
    
    setIsDuplicating(true);
    try {
      const result = await duplicateDoor(sourceDoorId, {
        target_door_numbers: doorNumbers
      });
      
      toast.success(`Door configuration duplicated to ${result.created_doors.length} doors`);
      setShowDuplicateModal(false);
      
      // Refresh doors
      if (onTabChange) {
        // This would typically trigger a refresh in the parent component
        onTabChange(activeDoorId);
      }
    } catch (error) {
      console.error('Error duplicating door:', error);
      toast.error('Error duplicating door');
    } finally {
      setIsDuplicating(false);
    }
  };
  
  return (
    <div className="door-tabs-container">
      <div className="door-tabs">
        {doors.map(door => (
          <div 
            key={door.id}
            className={`door-tab ${door.id === activeDoorId ? 'active' : ''}`}
            onClick={() => onTabChange(door.id)}
          >
            <span>Door #{door.door_number}</span>
            <Button 
              variant="link" 
              size="sm" 
              className="duplicate-btn"
              onClick={(e) => {
                e.stopPropagation();
                openDuplicateModal(door.id);
              }}
            >
              <FaCopy />
            </Button>
          </div>
        ))}
        
        <Button 
          variant="success" 
          size="sm" 
          className="add-door-btn"
          onClick={handleAddDoor}
          disabled={isAddingDoor}
        >
          <FaPlus /> {isAddingDoor ? 'Adding...' : 'Add Door'}
        </Button>
      </div>
      
      {/* Duplicate Door Modal */}
      <Modal show={showDuplicateModal} onHide={() => setShowDuplicateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Duplicate Door Configuration</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Enter the door numbers you want to duplicate this configuration to:</p>
          <InputGroup>
            <FormControl
              placeholder="e.g. 2, 3, 4"
              value={targetDoors}
              onChange={(e) => setTargetDoors(e.target.value)}
            />
          </InputGroup>
          <small className="text-muted">Enter comma-separated door numbers</small>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDuplicateModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleDuplicateDoor}
            disabled={isDuplicating}
          >
            <FaCheck /> {isDuplicating ? 'Duplicating...' : 'Duplicate'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default DoorTabs;
'''

    file_contents[f"{project_dir}/frontend/src/components/bids/DoorTabs.css"] = '''.door-tabs-container {
  margin-bottom: 20px;
}

.door-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
}

.door-tab {
  padding: 8px 15px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
}

.door-tab.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.door-tab.active .duplicate-btn {
  color: white;
}

.duplicate-btn {
  padding: 0;
  color: #6c757d;
}

.duplicate-btn:hover {
  color: #0056b3;
}

.door-tab.active .duplicate-btn:hover {
  color: #f8f9fa;
}

.add-door-btn {
  align-self: center;
}

@media (max-width: 768px) {
  .door-tabs {
    flex-direction: column;
    width: 100%;
  }
  
  .door-tab {
    width: 100%;
    justify-content: space-between;
  }
  
  .add-door-btn {
    width: 100%;
  }
}
'''

    file_contents[f"{project_dir}/frontend/src/components/bids/LineItemTable.js"] = '''import React, { useState } from 'react';
import { Table, Button, Form, InputGroup } from 'react-bootstrap';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { addLineItem } from '../../services/bidService';
import './LineItemTable.css';

const LineItemTable = ({ doorId, door, onUpdate }) => {
  const [newItem, setNewItem] = useState({
    part_number: '',
    description: '',
    quantity: 1,
    price: 0,
    labor_hours: 0,
    hardware: 0
  });
  
  const [isAddingItem, setIsAddingItem] = useState(false);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let parsedValue = value;
    
    // Parse numeric fields
    if (['quantity', 'price', 'labor_hours', 'hardware'].includes(name)) {
      parsedValue = value === '' ? 0 : parseFloat(value);
    }
    
    setNewItem({
      ...newItem,
      [name]: parsedValue
    });
  };
  
  const handleAddItem = async () => {
    if (!doorId) return;
    
    if (!newItem.description) {
      toast.error('Description is required');
      return;
    }
    
    setIsAddingItem(true);
    try {
      await addLineItem(doorId, newItem);
      
      // Reset form
      setNewItem({
        part_number: '',
        description: '',
        quantity: 1,
        price: 0,
        labor_hours: 0,
        hardware: 0
      });
      
      // Update parent component
      if (onUpdate) {
        onUpdate();
      }
      
      toast.success('Item added successfully');
    } catch (error) {
      console.error('Error adding line item:', error);
      toast.error('Error adding line item');
    } finally {
      setIsAddingItem(false);
    }
  };
  
  // Calculate total costs
  const partsCost = door?.parts_cost || 0;
  const laborCost = door?.labor_cost || 0;
  const hardwareCost = door?.hardware_cost || 0;
  const tax = (partsCost + hardwareCost) * 0.0875; // 8.75% tax rate
  const totalCost = partsCost + laborCost + hardwareCost + tax;
  
  return (
    <div className="line-item-table-container">
      <h5>Door #{door?.door_number} Items</h5>
      
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Part #</th>
            <th>Description</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Labor Hours</th>
            <th>Hardware</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {door?.line_items?.map(item => (
            <tr key={item.id}>
              <td>{item.part_number || '-'}</td>
              <td>{item.description}</td>
              <td>{item.quantity}</td>
              <td>${item.price.toFixed(2)}</td>
              <td>{item.labor_hours.toFixed(2)}</td>
              <td>${item.hardware.toFixed(2)}</td>
              <td>${item.total.toFixed(2)}</td>
              <td>
                <Button variant="danger" size="sm">
                  <FaTrash />
                </Button>
              </td>
            </tr>
          ))}
          
          {/* Add new item row */}
          <tr className="new-item-row">
            <td>
              <Form.Control
                type="text"
                name="part_number"
                value={newItem.part_number}
                onChange={handleInputChange}
                placeholder="Part #"
              />
            </td>
            <td>
              <Form.Control
                type="text"
                name="description"
                value={newItem.description}
                onChange={handleInputChange}
                placeholder="Description"
                required
              />
            </td>
            <td>
              <Form.Control
                type="number"
                name="quantity"
                value={newItem.quantity}
                onChange={handleInputChange}
                min="1"
              />
            </td>
            <td>
              <InputGroup>
                <InputGroup.Text>$</InputGroup.Text>
                <Form.Control
                  type="number"
                  name="price"
                  value={newItem.price}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                />
              </InputGroup>
            </td>
            <td>
              <Form.Control
                type="number"
                name="labor_hours"
                value={newItem.labor_hours}
                onChange={handleInputChange}
                min="0"
                step="0.25"
              />
            </td>
            <td>
              <InputGroup>
                <InputGroup.Text>$</InputGroup.Text>
                <Form.Control
                  type="number"
                  name="hardware"
                  value={newItem.hardware}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                />
              </InputGroup>
            </td>
            <td>
              ${((newItem.price * newItem.quantity) + newItem.hardware).toFixed(2)}
            </td>
            <td>
              <Button 
                variant="success" 
                onClick={handleAddItem}
                disabled={isAddingItem}
              >
                <FaPlus /> Add
              </Button>
            </td>
          </tr>
        </tbody>
      </Table>
      
      <div className="cost-summary">
        <div className="summary-row">
          <span>Parts Cost:</span>
          <span>${partsCost.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span>Labor Cost:</span>
          <span>${laborCost.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span>Hardware Cost:</span>
          <span>${hardwareCost.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span>Tax (8.75%):</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        <div className="summary-row total">
          <span>Total Cost:</span>
          <span>${totalCost.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default LineItemTable;
'''

    file_contents[f"{project_dir}/frontend/src/components/bids/LineItemTable.css"] = '''.line-item-table-container {
  margin-bottom: 30px;
}

.cost-summary {
  max-width: 400px;
  margin-left: auto;
  margin-top: 20px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 15px;
  background-color: #f8f9fa;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
}

.summary-row.total {
  border-top: 1px solid #dee2e6;
  margin-top: 10px;
  padding-top: 10px;
  font-weight: bold;
}

.new-item-row input {
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
}

@media (max-width: 768px) {
  .cost-summary {
    max-width: 100%;
  }
}
'''

    # Continue JobList.js component
    file_contents[f"{project_dir}/frontend/src/components/jobs/JobList.js"] = '''import React, { useState, useEffect } from 'react';
import { Table, Button, Badge, Form, InputGroup, Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaSearch, FaCalendarAlt } from 'react-icons/fa';
import { getJobs } from '../../services/jobService';
import './JobList.css';

const JobList = ({ onSelectJob }) => {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadJobs();
  }, [regionFilter, statusFilter]);
  
  useEffect(() => {
    if (searchTerm) {
      const filtered = jobs.filter(job => 
        job.job_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.job_scope && job.job_scope.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (job.address && job.address.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredJobs(filtered);
    } else {
      setFilteredJobs(jobs);
    }
  }, [searchTerm, jobs]);
  
  const loadJobs = async () => {
    try {
      const params = {};
      if (regionFilter) params.region = regionFilter;
      if (statusFilter) params.status = statusFilter;
      
      const data = await getJobs(params);
      setJobs(data);
      setFilteredJobs(data);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  const getStatusBadge = (status) => {
    switch(status) {
      case 'unscheduled':
        return <Badge bg="secondary">Unscheduled</Badge>;
      case 'scheduled':
        return <Badge bg="primary">Scheduled</Badge>;
      case 'waiting_for_parts':
        return <Badge bg="warning">Waiting for Parts</Badge>;
      case 'on_hold':
        return <Badge bg="danger">On Hold</Badge>;
      case 'completed':
        return <Badge bg="success">Completed</Badge>;
      default:
        return <Badge bg="info">{status}</Badge>;
    }
  };
  
  const getMaterialBadge = (ready, location) => {
    if (!ready) {
      return <Badge bg="danger">No</Badge>;
    }
    
    return (
      <Badge bg="success">
        Yes ({location === 'S' ? 'Shop' : location === 'C' ? 'Client' : location})
      </Badge>
    );
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'Not Scheduled';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  if (loading) {
    return <div>Loading jobs...</div>;
  }
  
  return (
    <div className="job-list-container">
      <div className="job-list-header">
        <h2>Jobs</h2>
        <div className="job-list-filters">
          <Dropdown className="filter-dropdown">
            <Dropdown.Toggle variant="outline-secondary" id="region-dropdown">
              {regionFilter ? `Region: ${regionFilter}` : 'All Regions'}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => setRegionFilter('')}>All Regions</Dropdown.Item>
              <Dropdown.Item onClick={() => setRegionFilter('OC')}>Orange County (OC)</Dropdown.Item>
              <Dropdown.Item onClick={() => setRegionFilter('LA')}>Los Angeles (LA)</Dropdown.Item>
              <Dropdown.Item onClick={() => setRegionFilter('IE')}>Inland Empire (IE)</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          
          <Dropdown className="filter-dropdown">
            <Dropdown.Toggle variant="outline-secondary" id="status-dropdown">
              {statusFilter ? `Status: ${statusFilter.replace('_', ' ')}` : 'All Statuses'}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => setStatusFilter('')}>All Statuses</Dropdown.Item>
              <Dropdown.Item onClick={() => setStatusFilter('unscheduled')}>Unscheduled</Dropdown.Item>
              <Dropdown.Item onClick={() => setStatusFilter('scheduled')}>Scheduled</Dropdown.Item>
              <Dropdown.Item onClick={() => setStatusFilter('waiting_for_parts')}>Waiting for Parts</Dropdown.Item>
              <Dropdown.Item onClick={() => setStatusFilter('on_hold')}>On Hold</Dropdown.Item>
              <Dropdown.Item onClick={() => setStatusFilter('completed')}>Completed</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          
          <InputGroup className="search-input">
            <InputGroup.Text>
              <FaSearch />
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </InputGroup>
        </div>
      </div>
      
      {filteredJobs.length === 0 ? (
        <p>No jobs found with the selected filters.</p>
      ) : (
        <Table striped hover responsive className="job-table">
          <thead>
            <tr>
              <th>Job #</th>
              <th>Customer</th>
              <th>Location</th>
              <th>Scope</th>
              <th>Scheduled Date</th>
              <th>Status</th>
              <th>Material</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.map(job => (
              <tr key={job.id}>
                <td>{job.job_number}</td>
                <td>{job.customer_name}</td>
                <td>
                  {job.address ? job.address : 'N/A'}
                  <div className="region-tag">{job.region}</div>
                </td>
                <td>{job.job_scope || 'N/A'}</td>
                <td>{formatDate(job.scheduled_date)}</td>
                <td>{getStatusBadge(job.status)}</td>
                <td>{getMaterialBadge(job.material_ready, job.material_location)}</td>
                <td>
                  {onSelectJob ? (
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={() => onSelectJob(job)}
                      className="me-2"
                    >
                      Select
                    </Button>
                  ) : (
                    <Link to={`/jobs/${job.id}`}>
                      <Button variant="outline-primary" size="sm" className="me-2">
                        Details
                      </Button>
                    </Link>
                  )}
                  
                  <Link to={`/schedule?jobId=${job.id}`}>
                    <Button variant="outline-success" size="sm">
                      <FaCalendarAlt /> Schedule
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default JobList;
'''

    file_contents[f"{project_dir}/frontend/src/components/jobs/JobList.css"] = '''.job-list-container {
  margin-bottom: 30px;
}

.job-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.job-list-filters {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-dropdown {
  min-width: 180px;
}

.search-input {
  width: 300px;
}

.job-table th,
.job-table td {
  vertical-align: middle;
}

.region-tag {
  display: inline-block;
  font-size: 0.8em;
  padding: 0.2em 0.5em;
  background-color: #e9ecef;
  border-radius: 0.25rem;
  margin-top: 0.3em;
}

@media (max-width: 992px) {
  .job-list-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .job-list-filters {
    margin-top: 10px;
    flex-wrap: wrap;
    width: 100%;
  }
  
  .filter-dropdown,
  .search-input {
    width: 100%;
    margin-bottom: 10px;
  }
}
'''

    file_contents[f"{project_dir}/frontend/src/components/jobs/JobDetails.js"] = '''import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Row, Col, Badge, ListGroup, Modal, Form } from 'react-bootstrap';
import { FaEdit, FaCheckCircle } from 'react-icons/fa';
import SignatureCanvas from 'react-signature-canvas';
import { toast } from 'react-toastify';
import { getJob, updateJobStatus, completeDoor } from '../../services/jobService';
import './JobDetails.css';

const JobDetails = () => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedDoor, setSelectedDoor] = useState(null);
  const [signature, setSignature] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [video, setVideo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { jobId } = useParams();
  const navigate = useNavigate();
  let sigCanvas = null;
  
  useEffect(() => {
    loadJob();
  }, [jobId]);
  
  const loadJob = async () => {
    try {
      const data = await getJob(jobId);
      setJob(data);
    } catch (error) {
      console.error('Error loading job:', error);
      toast.error('Error loading job details');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStatusChange = async (newStatus) => {
    try {
      await updateJobStatus(job.id, { status: newStatus });
      toast.success(`Job status updated to ${newStatus.replace('_', ' ')}`);
      loadJob();
    } catch (error) {
      console.error('Error updating job status:', error);
      toast.error('Error updating job status');
    }
  };
  
  const openCompleteModal = (door) => {
    setSelectedDoor(door);
    setShowCompleteModal(true);
    setSignature(null);
    setPhoto(null);
    setVideo(null);
  };
  
  const handleSignatureClear = () => {
    sigCanvas.clear();
    setSignature(null);
  };
  
  const handleSignatureEnd = () => {
    setSignature(sigCanvas.toDataURL());
  };
  
  const handlePhotoChange = (e) => {
    setPhoto(e.target.files[0]);
  };
  
  const handleVideoChange = (e) => {
    setVideo(e.target.files[0]);
  };
  
  const handleCompleteDoor = async (e) => {
    e.preventDefault();
    
    if (!signature) {
      toast.error('Please provide a signature');
      return;
    }
    
    if (!photo) {
      toast.error('Please upload a photo');
      return;
    }
    
    if (!video) {
      toast.error('Please upload a video');
      return;
    }
    
    setIsSubmitting(true);
    try {
      // In a real app, we would upload files to the server
      // Here we'll just simulate a successful submission
      await completeDoor(job.id, selectedDoor.id, {
        signature: signature,
        photo_file: 'simulated_photo.jpg', // Would be actual file in real app
        video_file: 'simulated_video.mp4'  // Would be actual file in real app
      });
      
      toast.success(`Door #${selectedDoor.door_number} marked as completed`);
      setShowCompleteModal(false);
      loadJob();
    } catch (error) {
      console.error('Error completing door:', error);
      toast.error('Error completing door');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const getStatusBadge = (status) => {
    switch(status) {
      case 'unscheduled':
        return <Badge bg="secondary">Unscheduled</Badge>;
      case 'scheduled':
        return <Badge bg="primary">Scheduled</Badge>;
      case 'waiting_for_parts':
        return <Badge bg="warning">Waiting for Parts</Badge>;
      case 'on_hold':
        return <Badge bg="danger">On Hold</Badge>;
      case 'completed':
        return <Badge bg="success">Completed</Badge>;
      default:
        return <Badge bg="info">{status}</Badge>;
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'Not Scheduled';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  if (loading) {
    return <div>Loading job details...</div>;
  }
  
  if (!job) {
    return <div>Job not found</div>;
  }
  
  return (
    <div className="job-details-container">
      <div className="job-details-header">
        <h2>Job #{job.job_number}</h2>
        <div className="job-actions">
          <Button 
            variant="outline-primary" 
            className="me-2"
            onClick={() => navigate(`/schedule?jobId=${job.id}`)}
          >
            Schedule
          </Button>
          <Button 
            variant="outline-secondary" 
            onClick={() => navigate('/jobs')}
          >
            Back to Jobs
          </Button>
        </div>
      </div>
      
      <Row>
        <Col md={6}>
          <Card className="mb-3">
            <Card.Header>Job Information</Card.Header>
            <Card.Body>
              <div className="info-row">
                <span className="info-label">Customer:</span>
                <span className="info-value">{job.customer_name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Address:</span>
                <span className="info-value">{job.address || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Contact:</span>
                <span className="info-value">{job.contact_name || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Phone:</span>
                <span className="info-value">{job.phone || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Region:</span>
                <span className="info-value">{job.region}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Scope:</span>
                <span className="info-value">{job.job_scope || 'N/A'}</span>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card className="mb-3">
            <Card.Header>Status Information</Card.Header>
            <Card.Body>
              <div className="info-row">
                <span className="info-label">Status:</span>
                <span className="info-value status-value">
                  {getStatusBadge(job.status)}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Scheduled Date:</span>
                <span className="info-value">{formatDate(job.scheduled_date)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Material Ready:</span>
                <span className="info-value">
                  {job.material_ready ? 
                    <Badge bg="success">Yes</Badge> : 
                    <Badge bg="danger">No</Badge>
                  }
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Material Location:</span>
                <span className="info-value">
                  {job.material_location === 'S' ? 'Shop' : 
                   job.material_location === 'C' ? 'Client' : 
                   job.material_location || 'N/A'}
                </span>
              </div>
              
              <div className="status-actions mt-3">
                <p><strong>Update Status:</strong></p>
                <div className="status-buttons">
                  <Button 
                    variant={job.status === 'unscheduled' ? 'secondary' : 'outline-secondary'} 
                    size="sm"
                    onClick={() => handleStatusChange('unscheduled')}
                    className="me-2 mb-2"
                  >
                    Unscheduled
                  </Button>
                  <Button 
                    variant={job.status === 'scheduled' ? 'primary' : 'outline-primary'} 
                    size="sm"
                    onClick={() => handleStatusChange('scheduled')}
                    className="me-2 mb-2"
                  >
                    Scheduled
                  </Button>
                  <Button 
                    variant={job.status === 'waiting_for_parts' ? 'warning' : 'outline-warning'} 
                    size="sm"
                    onClick={() => handleStatusChange('waiting_for_parts')}
                    className="me-2 mb-2"
                  >
                    Waiting for Parts
                  </Button>
                  <Button 
                    variant={job.status === 'on_hold' ? 'danger' : 'outline-danger'} 
                    size="sm"
                    onClick={() => handleStatusChange('on_hold')}
                    className="me-2 mb-2"
                  >
                    On Hold
                  </Button>
                  <Button 
                    variant={job.status === 'completed' ? 'success' : 'outline-success'} 
                    size="sm"
                    onClick={() => handleStatusChange('completed')}
                    className="mb-2"
                  >
                    Completed
                  </Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <Card>
        <Card.Header>Doors</Card.Header>
        <Card.Body>
          <ListGroup>
            {job.doors.map(door => (
              <ListGroup.Item 
                key={door.id}
                className="door-list-item"
              >
                <div className="door-info">
                  <span className="door-number">Door #{door.door_number}</span>
                  {door.completed ? (
                    <Badge bg="success" className="door-status">Completed</Badge>
                  ) : (
                    <Badge bg="secondary" className="door-status">Pending</Badge>
                  )}
                </div>
                <div className="door-actions">
                  {!door.completed && (
                    <Button 
                      variant="success" 
                      size="sm"
                      onClick={() => openCompleteModal(door)}
                    >
                      <FaCheckCircle /> Complete
                    </Button>
                  )}
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Card.Body>
      </Card>
      
      {/* Complete Door Modal */}
      <Modal show={showCompleteModal} onHide={() => setShowCompleteModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Complete Door #{selectedDoor?.door_number}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCompleteDoor}>
            <Form.Group className="mb-3">
              <Form.Label>Signature</Form.Label>
              <div className="signature-container">
                <SignatureCanvas
                  ref={(ref) => { sigCanvas = ref; }}
                  penColor="black"
                  canvasProps={{ className: 'signature-canvas' }}
                  onEnd={handleSignatureEnd}
                />
              </div>
              <Button 
                variant="outline-secondary" 
                size="sm"
                onClick={handleSignatureClear}
              >
                Clear
              </Button>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Photo of Completed Door</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Video of Door Operation</Form.Label>
              <Form.Control
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                required
              />
            </Form.Group>
            
            <div className="d-grid gap-2 d-md-flex justify-content-md-end">
              <Button 
                variant="secondary" 
                onClick={() => setShowCompleteModal(false)}
                className="me-md-2"
              >
                Cancel
              </Button>
              <Button 
                variant="success" 
                type="submit"
                disabled={isSubmitting || !signature || !photo || !video}
              >
                {isSubmitting ? 'Submitting...' : 'Mark as Completed'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default JobDetails;
'''

    file_contents[f"{project_dir}/frontend/src/components/jobs/JobDetails.css"] = '''.job-details-container {
  margin-bottom: 40px;
}

.job-details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  margin-bottom: 8px;
}

.info-label {
  font-weight: bold;
  min-width: 120px;
}

.status-value {
  display: inline-block;
}

.door-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.door-number {
  font-weight: bold;
  margin-right: 10px;
}

.signature-container {
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  margin-bottom: 10px;
}

.signature-canvas {
  width: 100%;
  height: 200px;
}

@media (max-width: 768px) {
  .job-details-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .job-actions {
    margin-top: 15px;
    display: flex;
    width: 100%;
  }
  
  .job-actions button {
    flex: 1;
  }
  
  .info-row {
    flex-direction: column;
    margin-bottom: 15px;
  }
  
  .info-label {
    margin-bottom: 5px;
  }
  
  .status-buttons {
    display: flex;
    flex-wrap: wrap;
  }
}
'''

    # Scheduling Components
    file_contents[f"{project_dir}/frontend/src/components/scheduling/Calendar.js"] = '''import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { Card, Badge, Button, ListGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getJobs } from '../../services/jobService';
import 'react-calendar/dist/Calendar.css';
import './Calendar.css';

const JobCalendar = ({ region, onSelectDate }) => {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [scheduledJobs, setScheduledJobs] = useState({});
  const [selectedDateJobs, setSelectedDateJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  
  useEffect(() => {
    loadScheduledJobs();
  }, [region]);
  
  useEffect(() => {
    const dateStr = formatDateKey(calendarDate);
    setSelectedDateJobs(scheduledJobs[dateStr] || []);
  }, [calendarDate, scheduledJobs]);
  
  const loadScheduledJobs = async () => {
    try {
      const params = { status: 'scheduled' };
      if (region && region !== 'ALL') {
        params.region = region;
      }
      
      const jobs = await getJobs(params);
      
      // Group jobs by date
      const grouped = jobs.reduce((acc, job) => {
        if (job.scheduled_date) {
          const dateKey = formatDateKey(new Date(job.scheduled_date));
          
          if (!acc[dateKey]) {
            acc[dateKey] = [];
          }
          
          acc[dateKey].push(job);
        }
        return acc;
      }, {});
      
      setScheduledJobs(grouped);
    } catch (error) {
      console.error('Error loading scheduled jobs:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatDateKey = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  
  const handleDateChange = (date) => {
    setCalendarDate(date);
    
    if (onSelectDate) {
      onSelectDate(date);
    }
  };
  
  const getDateContent = (date) => {
    const dateStr = formatDateKey(date);
    const jobs = scheduledJobs[dateStr] || [];
    
    if (jobs.length === 0) {
      return null;
    }
    
    return (
      <div className="job-count-marker">
        <Badge bg="primary" pill>{jobs.length}</Badge>
      </div>
    );
  };
  
  const formatDisplayDate = (date) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };
  
  if (loading) {
    return <div>Loading calendar...</div>;
  }
  
  return (
    <div className="job-calendar-container">
      <div className="calendar-wrapper">
        <Calendar 
          onChange={handleDateChange}
          value={calendarDate}
          tileContent={({ date }) => getDateContent(date)}
          tileClassName={({ date }) => {
            const dateStr = formatDateKey(date);
            return scheduledJobs[dateStr]?.length > 0 ? 'has-jobs' : null;
          }}
        />
      </div>
      
      <Card className="date-details">
        <Card.Header>
          <h5>{formatDisplayDate(calendarDate)}</h5>
        </Card.Header>
        <Card.Body>
          {selectedDateJobs.length === 0 ? (
            <p className="text-muted">No jobs scheduled for this date.</p>
          ) : (
            <>
              <h6>{selectedDateJobs.length} Jobs Scheduled</h6>
              <ListGroup variant="flush">
                {selectedDateJobs.map(job => (
                  <ListGroup.Item 
                    key={job.id}
                    className="scheduled-job-item"
                  >
                    <div className="job-info">
                      <div className="job-name">
                        <span className="job-number">{job.job_number}</span>
                        {job.customer_name}
                      </div>
                      <div className="job-address">
                        {job.address || 'No address'} 
                        <Badge 
                          bg="secondary" 
                          className="region-badge"
                        >
                          {job.region}
                        </Badge>
                      </div>
                    </div>
                    <div className="job-actions">
                      <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        Details
                      </Button>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </>
          )}
          
          {onSelectDate && (
            <div className="text-center mt-3">
              <Button 
                variant="success"
                onClick={() => onSelectDate(calendarDate)}
              >
                Schedule Job for This Date
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default JobCalendar;
'''

    file_contents[f"{project_dir}/frontend/src/components/scheduling/Calendar.css"] = '''.job-calendar-container {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
}

.calendar-wrapper {
  flex: 1;
}

.date-details {
  flex: 1;
  max-width: 400px;
}

.react-calendar {
  width: 100%;
  border: 1px solid #ddd;
  font-family: inherit;
  border-radius: 0.25rem;
}

.react-calendar__tile--active {
  background: #007bff !important;
  color: white;
}

.react-calendar__tile--now {
  background: #f8f9fa;
}

.react-calendar__tile.has-jobs {
  background-color: rgba(0, 123, 255, 0.1);
  font-weight: bold;
}

.job-count-marker {
  display: flex;
  justify-content: center;
  margin-top: 5px;
}

.scheduled-job-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.job-name {
  font-weight: 500;
}

.job-number {
  font-weight: bold;
  margin-right: 10px;
  color: #0056b3;
}

.job-address {
  font-size: 0.85em;
  color: #6c757d;
}

.region-badge {
  margin-left: 8px;
  font-size: 0.7em;
}

@media (max-width: 768px) {
  .job-calendar-container {
    flex-direction: column;
  }
  
  .date-details {
    max-width: 100%;
  }
}
'''

    file_contents[f"{project_dir}/frontend/src/components/scheduling/ScheduleForm.js"] = '''import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getJob, scheduleJob } from '../../services/jobService';
import JobList from '../jobs/JobList';
import JobCalendar from './Calendar';
import './ScheduleForm.css';

const ScheduleForm = () => {
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [formData, setFormData] = useState({
    scheduled_date: '',
    material_ready: false,
    material_location: 'S',
    region: 'OC',
    job_scope: ''
  });
  const [showJobList, setShowJobList] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const jobId = queryParams.get('jobId');
  
  useEffect(() => {
    if (jobId) {
      loadJob(jobId);
    }
  }, [jobId]);
  
  const loadJob = async (id) => {
    setLoading(true);
    try {
      const job = await getJob(id);
      setSelectedJob(job);
      setShowJobList(false);
      
      // Initialize form with job data
      setFormData({
        scheduled_date: job.scheduled_date || '',
        material_ready: job.material_ready || false,
        material_location: job.material_location || 'S',
        region: job.region || 'OC',
        job_scope: job.job_scope || ''
      });
    } catch (error) {
      console.error('Error loading job:', error);
      toast.error('Error loading job details');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setShowJobList(false);
    setShowCalendar(true);
    
    // Initialize form with job data
    setFormData({
      scheduled_date: job.scheduled_date || '',
      material_ready: job.material_ready || false,
      material_location: job.material_location || 'S',
      region: job.region || 'OC',
      job_scope: job.job_scope || ''
    });
  };
  
  const handleSelectDate = (date) => {
    setSelectedDate(date);
    setShowCalendar(false);
    
    // Format date for form
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    setFormData({
      ...formData,
      scheduled_date: formattedDate
    });
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    
    // If date is manually changed in the form
    setFormData({
      ...formData,
      [name]: value
    });
    
    setSelectedDate(value ? new Date(value) : null);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedJob) {
      toast.error('Please select a job');
      return;
    }
    
    if (!formData.scheduled_date) {
      toast.error('Please select a date');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await scheduleJob(selectedJob.id, formData);
      toast.success('Job scheduled successfully');
      navigate(`/jobs/${selectedJob.id}`);
    } catch (error) {
      console.error('Error scheduling job:', error);
      toast.error('Error scheduling job');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    // If we're editing an existing job, go back to job details
    if (selectedJob) {
      navigate(`/jobs/${selectedJob.id}`);
    } else {
      // Otherwise, go back to jobs list
      navigate('/jobs');
    }
  };
  
  if (loading) {
    return <div>Loading job details...</div>;
  }
  
  return (
    <div className="schedule-form-container">
      <h2>Schedule Job</h2>
      
      {showJobList && (
        <Card className="mb-4">
          <Card.Header>Select a Job to Schedule</Card.Header>
          <Card.Body>
            <JobList onSelectJob={handleSelectJob} />
          </Card.Body>
        </Card>
      )}
      
      {showCalendar && (
        <Card className="mb-4">
          <Card.Header>Select a Date</Card.Header>
          <Card.Body>
            <JobCalendar 
              region={formData.region}
              onSelectDate={handleSelectDate}
            />
          </Card.Body>
        </Card>
      )}
      
      {selectedJob && !showJobList && !showCalendar && (
        <>
          <Card className="mb-4">
            <Card.Header>Selected Job</Card.Header>
            <Card.Body>
              <div className="selected-job-info">
                <div>
                  <span className="job-number">{selectedJob.job_number}</span> 
                  <span className="customer-name">{selectedJob.customer_name}</span>
                </div>
                <div className="job-address">{selectedJob.address || 'No address'}</div>
              </div>
              
              <div className="mt-3">
                <Button 
                  variant="outline-primary" 
                  onClick={() => setShowJobList(true)}
                  className="me-2"
                >
                  Change Job
                </Button>
                <Button 
                  variant="outline-primary" 
                  onClick={() => setShowCalendar(true)}
                >
                  View Calendar
                </Button>
              </div>
            </Card.Body>
          </Card>
          
          <Card>
            <Card.Header>Schedule Details</Card.Header>
            <Card.Body>
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Scheduled Date</Form.Label>
                      <Form.Control
                        type="date"
                        name="scheduled_date"
                        value={formData.scheduled_date}
                        onChange={handleDateChange}
                        required
                      />
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                      <Form.Check 
                        type="checkbox"
                        label="Material Ready"
                        name="material_ready"
                        checked={formData.material_ready}
                        onChange={handleInputChange}
                      />
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                      <Form.Label>Material Location</Form.Label>
                      <Form.Select
                        name="material_location"
                        value={formData.material_location}
                        onChange={handleInputChange}
                      >
                        <option value="S">Shop</option>
                        <option value="C">Client</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Region</Form.Label>
                      <Form.Select
                        name="region"
                        value={formData.region}
                        onChange={handleInputChange}
                      >
                        <option value="OC">Orange County (OC)</option>
                        <option value="LA">Los Angeles (LA)</option>
                        <option value="IE">Inland Empire (IE)</option>
                      </Form.Select>
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                      <Form.Label>Job Scope</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        name="job_scope"
                        value={formData.job_scope}
                        onChange={handleInputChange}
                        placeholder="Enter job scope or special instructions"
                      />
                    </Form.Group>
                  </Col>
                </Row>
                
                <div className="d-flex justify-content-end mt-3">
                  <Button 
                    variant="secondary" 
                    onClick={handleCancel}
                    className="me-2"
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="primary" 
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Scheduling...' : 'Schedule Job'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
};

export default ScheduleForm;
'''

    file_contents[f"{project_dir}/frontend/src/components/scheduling/ScheduleForm.css"] = '''.schedule-form-container {
  margin-bottom: 40px;
}

.selected-job-info {
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  margin-bottom: 15px;
}

.job-number {
  font-weight: bold;
  color: #0056b3;
  margin-right: 10px;
}

.customer-name {
  font-weight: 500;
}

.job-address {
  color: #6c757d;
  font-size: 0.9em;
  margin-top: 5px;
}
'''

    # Pages
    file_contents[f"{project_dir}/frontend/src/pages/Dashboard.js"] = '''import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaClipboardList, FaFileInvoiceDollar, FaTools, FaCalendarAlt } from 'react-icons/fa';
import { getEstimates } from '../services/estimateService';
import { getBids } from '../services/bidService';
import { getJobs } from '../services/jobService';
import './Dashboard.css';

const Dashboard = () => {
  const [estimates, setEstimates] = useState([]);
  const [bids, setBids] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [estimatesData, bidsData, jobsData] = await Promise.all([
          getEstimates(),
          getBids(),
          getJobs()
        ]);
        
        setEstimates(estimatesData);
        setBids(bidsData);
        setJobs(jobsData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const pendingEstimates = estimates.filter(e => e.status === 'pending');
  const draftBids = bids.filter(b => b.status === 'draft');
  const unscheduledJobs = jobs.filter(j => j.status === 'unscheduled');
  const scheduledJobs = jobs.filter(j => j.status === 'scheduled');
  
  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return <Badge bg="warning">Pending</Badge>;
      case 'draft':
        return <Badge bg="secondary">Draft</Badge>;
      case 'unscheduled':
        return <Badge bg="info">Unscheduled</Badge>;
      case 'scheduled':
        return <Badge bg="primary">Scheduled</Badge>;
      case 'completed':
        return <Badge bg="success">Completed</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };
  
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  if (loading) {
    return <div>Loading dashboard data...</div>;
  }
  
  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Ace Overhead Doors</h1>
      <p className="dashboard-subtitle">Bid, Proposal, and Scheduler System</p>
      
      <Row>
        <Col md={3} sm={6}>
          <Card className="dashboard-card">
            <Card.Body>
              <div className="card-icon-container estimates-icon">
                <FaClipboardList className="card-icon" />
              </div>
              <h3 className="metric-value">{pendingEstimates.length}</h3>
              <p className="metric-label">Pending Estimates</p>
            </Card.Body>
            <Card.Footer>
              <Link to="/estimates">View All Estimates</Link>
            </Card.Footer>
          </Card>
        </Col>
        
        <Col md={3} sm={6}>
          <Card className="dashboard-card">
            <Card.Body>
              <div className="card-icon-container bids-icon">
                <FaFileInvoiceDollar className="card-icon" />
              </div>
              <h3 className="metric-value">{draftBids.length}</h3>
              <p className="metric-label">Draft Bids</p>
            </Card.Body>
            <Card.Footer>
              <Link to="/bids">View All Bids</Link>
            </Card.Footer>
          </Card>
        </Col>
        
        <Col md={3} sm={6}>
          <Card className="dashboard-card">
            <Card.Body>
              <div className="card-icon-container jobs-icon">
                <FaTools className="card-icon" />
              </div>
              <h3 className="metric-value">{unscheduledJobs.length}</h3>
              <p className="metric-label">Unscheduled Jobs</p>
            </Card.Body>
            <Card.Footer>
              <Link to="/jobs">View All Jobs</Link>
            </Card.Footer>
          </Card>
        </Col>
        
        <Col md={3} sm={6}>
          <Card className="dashboard-card">
            <Card.Body>
              <div className="card-icon-container schedule-icon">
                <FaCalendarAlt className="card-icon" />
              </div>
              <h3 className="metric-value">{scheduledJobs.length}</h3>
              <p className="metric-label">Scheduled Jobs</p>
            </Card.Body>
            <Card.Footer>
              <Link to="/schedule">View Schedule</Link>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
      
      <Row className="mt-4">
        <Col md={6}>
          <Card>
            <Card.Header>Recent Estimates</Card.Header>
            <Card.Body>
              {estimates.length === 0 ? (
                <p className="text-muted">No estimates found.</p>
              ) : (
                <div className="recent-list">
                  {estimates.slice(0, 5).map(estimate => (
                    <div className="recent-item" key={estimate.id}>
                      <div className="recent-item-header">
                        <span className="recent-item-title">EST-{estimate.id}</span>
                        {getStatusBadge(estimate.status)}
                      </div>
                      <div className="recent-item-details">
                        <span>{estimate.customer_name}</span>
                        <span className="text-muted">{formatDate(estimate.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
            <Card.Footer>
              <Link to="/estimates">View All Estimates</Link>
            </Card.Footer>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card>
            <Card.Header>Upcoming Jobs</Card.Header>
            <Card.Body>
              {scheduledJobs.length === 0 ? (
                <p className="text-muted">No upcoming jobs found.</p>
              ) : (
                <div className="recent-list">
                  {scheduledJobs.slice(0, 5).map(job => (
                    <div className="recent-item" key={job.id}>
                      <div className="recent-item-header">
                        <span className="recent-item-title">{job.job_number}</span>
                        <span className="region-label">{job.region}</span>
                      </div>
                      <div className="recent-item-details">
                        <span>{job.customer_name}</span>
                        <span className="text-muted">
                          {job.scheduled_date ? formatDate(job.scheduled_date) : 'Not scheduled'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
            <Card.Footer>
              <Link to="/jobs">View All Jobs</Link>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
'''

    file_contents[f"{project_dir}/frontend/src/pages/Dashboard.css"] = '''.dashboard-container {
  padding: 20px 0;
}

.dashboard-title {
  text-align: center;
  margin-bottom: 10px;
}

.dashboard-subtitle {
  text-align: center;
  color: #6c757d;
  margin-bottom: 30px;
}

.dashboard-card {
  text-align: center;
  transition: transform 0.2s ease-in-out;
  margin-bottom: 20px;
}

.dashboard-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
}

.card-icon-container {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin: 0 auto 15px;
}

.card-icon {
  font-size: 30px;
  color: white;
}

.estimates-icon {
  background-color: #17a2b8;
}

.bids-icon {
  background-color: #28a745;
}

.jobs-icon {
  background-color: #fd7e14;
}

.schedule-icon {
  background-color: #007bff;
}

.metric-value {
  font-size: 2.5rem;
  font-weight: bold;
  margin-bottom: 5px;
}

.metric-label {
  font-size: 1rem;
  color: #6c757d;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recent-item {
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.recent-item-title {
  font-weight: bold;
}

.recent-item-details {
  display: flex;
  justify-content: space-between;
  font-size: 0.9em;
}

.region-label {
  background-color: #e9ecef;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8em;
}
'''

    file_contents[f"{project_dir}/frontend/src/pages/Customers.js"] = '''import React, { useState } from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { FaUserPlus } from 'react-icons/fa';
import CustomerList from '../components/customers/CustomerList';
import CustomerForm from '../components/customers/CustomerForm';

const Customers = () => {
  const [showForm, setShowForm] = useState(false);
  
  const toggleForm = () => {
    setShowForm(!showForm);
  };
  
  const handleCustomerCreated = () => {
    // Automatically hide the form after customer is created
    setShowForm(false);
  };
  
  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <h2>Customers</h2>
          <p>Manage customer information for Ace Overhead Doors.</p>
        </Col>
        <Col xs="auto">
          <Button 
            variant="primary" 
            onClick={toggleForm}
          >
            <FaUserPlus className="me-2" />
            {showForm ? 'Hide Form' : 'Add New Customer'}
          </Button>
        </Col>
      </Row>
      
      {showForm && (
        <Row className="mb-4">
          <Col>
            <CustomerForm onCustomerCreated={handleCustomerCreated} />
          </Col>
        </Row>
      )}
      
      <Row>
        <Col>
          <Card>
            <Card.Header>Customer List</Card.Header>
            <Card.Body>
              <CustomerList onAddNewClick={() => setShowForm(true)} />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Customers;
'''

    file_contents[f"{project_dir}/frontend/src/pages/Estimates.js"] = '''import React, { useState } from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { FaPlus } from 'react-icons/fa';
import EstimateList from '../components/estimates/EstimateList';
import EstimateForm from '../components/estimates/EstimateForm';

const Estimates = () => {
  const [showForm, setShowForm] = useState(false);
  
  const toggleForm = () => {
    setShowForm(!showForm);
  };
  
  const handleEstimateCreated = () => {
    // Automatically hide the form after estimate is created
    setShowForm(false);
  };
  
  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <h2>Estimates</h2>
          <p>Create and manage estimates for Ace Overhead Doors.</p>
        </Col>
        <Col xs="auto">
          <Button 
            variant="primary" 
            onClick={toggleForm}
          >
            <FaPlus className="me-2" />
            {showForm ? 'Hide Form' : 'New Estimate'}
          </Button>
        </Col>
      </Row>
      
      {showForm && (
        <Row className="mb-4">
          <Col>
            <EstimateForm onEstimateCreated={handleEstimateCreated} />
          </Col>
        </Row>
      )}
      
      <Row>
        <Col>
          <Card>
            <Card.Header>Estimate List</Card.Header>
            <Card.Body>
              <EstimateList onCreateClick={() => setShowForm(true)} />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Estimates;
'''

    file_contents[f"{project_dir}/frontend/src/pages/Bids.js"] = '''import React, { useEffect } from 'react';
import { Container } from 'react-bootstrap';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import BidForm from '../components/bids/BidForm';

const Bids = () => {
  const { bidId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const estimateId = queryParams.get('estimateId');
  
  useEffect(() => {
    // If no bid ID and no estimate ID, redirect to estimates page
    if (!bidId && !estimateId) {
      navigate('/estimates');
    }
  }, [bidId, estimateId, navigate]);
  
  return (
    <Container fluid>
      <BidForm />
    </Container>
  );
};

export default Bids;
'''

    file_contents[f"{project_dir}/frontend/src/pages/Jobs.js"] = '''import React from 'react';
import { Container } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import JobList from '../components/jobs/JobList';
import JobDetails from '../components/jobs/JobDetails';

const Jobs = () => {
  const { jobId } = useParams();
  
  return (
    <Container fluid>
      {jobId ? (
        <JobDetails />
      ) : (
        <>
          <h2>Jobs</h2>
          <p>Manage and track jobs for Ace Overhead Doors.</p>
          <JobList />
        </>
      )}
    </Container>
  );
};

export default Jobs;
'''

    file_contents[f"{project_dir}/frontend/src/pages/Schedule.js"] = '''import React from 'react';
import { Container } from 'react-bootstrap';
import ScheduleForm from '../components/scheduling/ScheduleForm';

const Schedule = () => {
  return (
    <Container fluid>
      <ScheduleForm />
    </Container>
  );
};

export default Schedule;
'''

    # Services
    file_contents[f"{project_dir}/frontend/src/services/api.js"] = '''import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;
    
    // Log errors to console
    console.error('API Error:', error);
    
    // Handle specific error cases
    if (response) {
      // Server responded with error status
      console.error(`Server Error: ${response.status} - ${response.statusText}`);
    } else if (error.request) {
      // Request was made but no response received
      console.error('No response received from server');
    } else {
      // Error in setting up the request
      console.error('Error setting up request:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api;
'''

    file_contents[f"{project_dir}/frontend/src/services/customerService.js"] = '''import api from './api';

// Get all customers
export const getCustomers = async () => {
  try {
    const response = await api.get('/customers');
    return response.data;
  } catch (error) {
    console.error('Error getting customers:', error);
    throw error;
  }
};

// Get customer by ID
export const getCustomer = async (id) => {
  try {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting customer ${id}:`, error);
    throw error;
  }
};

// Create a new customer
export const createCustomer = async (customerData) => {
  try {
    const response = await api.post('/customers', customerData);
    return response.data;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
};

// Update customer
export const updateCustomer = async (id, customerData) => {
  try {
    const response = await api.put(`/customers/${id}`, customerData);
    return response.data;
  } catch (error) {
    console.error(`Error updating customer ${id}:`, error);
    throw error;
  }
};
'''

    file_contents[f"{project_dir}/frontend/src/services/estimateService.js"] = '''import api from './api';

// Get all estimates
export const getEstimates = async () => {
  try {
    const response = await api.get('/estimates');
    return response.data;
  } catch (error) {
    console.error('Error getting estimates:', error);
    throw error;
  }
};

// Get estimate by ID
export const getEstimate = async (id) => {
  try {
    const response = await api.get(`/estimates/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting estimate ${id}:`, error);
    throw error;
  }
};

// Create a new estimate
export const createEstimate = async (estimateData) => {
  try {
    const response = await api.post('/estimates', estimateData);
    return response.data;
  } catch (error) {
    console.error('Error creating estimate:', error);
    throw error;
  }
};

// Update estimate status
export const updateEstimateStatus = async (id, status) => {
  try {
    const response = await api.put(`/estimates/${id}/status`, { status });
    return response.data;
  } catch (error) {
    console.error(`Error updating estimate ${id} status:`, error);
    throw error;
  }
};
'''

    file_contents[f"{project_dir}/frontend/src/services/bidService.js"] = '''import api from './api';

// Get all bids
export const getBids = async () => {
  try {
    const response = await api.get('/bids');
    return response.data;
  } catch (error) {
    console.error('Error getting bids:', error);
    throw error;
  }
};

// Get bid by ID
export const getBid = async (id) => {
  try {
    const response = await api.get(`/bids/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting bid ${id}:`, error);
    throw error;
  }
};

// Create a new bid
export const createBid = async (estimateId) => {
  try {
    const response = await api.post(`/estimates/${estimateId}/bids`);
    return response.data;
  } catch (error) {
    console.error('Error creating bid:', error);
    throw error;
  }
};

// Add a door to a bid
export const addDoor = async (bidId, doorData = {}) => {
  try {
    const response = await api.post(`/bids/${bidId}/doors`, doorData);
    return response.data;
  } catch (error) {
    console.error(`Error adding door to bid ${bidId}:`, error);
    throw error;
  }
};

// Add a line item to a door
export const addLineItem = async (doorId, lineItemData) => {
  try {
    const response = await api.post(`/doors/${doorId}/line-items`, lineItemData);
    return response.data;
  } catch (error) {
    console.error(`Error adding line item to door ${doorId}:`, error);
    throw error;
  }
};

// Duplicate a door
export const duplicateDoor = async (doorId, targetData) => {
  try {
    const response = await api.post(`/doors/${doorId}/duplicate`, targetData);
    return response.data;
  } catch (error) {
    console.error(`Error duplicating door ${doorId}:`, error);
    throw error;
  }
};

// Approve a bid and create a job
export const approveBid = async (bidId, jobData) => {
  try {
    const response = await api.post(`/bids/${bidId}/approve`, jobData);
    return response.data;
  } catch (error) {
    console.error(`Error approving bid ${bidId}:`, error);
    throw error;
  }
};

// Generate bid report
export const generateBidReport = (bidId) => {
  return `/api/bids/${bidId}/report`;
};

// Generate bid proposal
export const generateBidProposal = (bidId) => {
  return `/api/bids/${bidId}/proposal`;
};
'''

    file_contents[f"{project_dir}/frontend/src/services/jobService.js"] = '''import api from './api';

// Get all jobs with optional filters
export const getJobs = async (params = {}) => {
  try {
    const response = await api.get('/jobs', { params });
    return response.data;
  } catch (error) {
    console.error('Error getting jobs:', error);
    throw error;
  }
};

// Get job by ID
export const getJob = async (id) => {
  try {
    const response = await api.get(`/jobs/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting job ${id}:`, error);
    throw error;
  }
};

// Schedule a job
export const scheduleJob = async (jobId, scheduleData) => {
  try {
    const response = await api.post(`/jobs/${jobId}/schedule`, scheduleData);
    return response.data;
  } catch (error) {
    console.error(`Error scheduling job ${jobId}:`, error);
    throw error;
  }
};

// Update job status
export const updateJobStatus = async (jobId, statusData) => {
  try {
    const response = await api.put(`/jobs/${jobId}/status`, statusData);
    return response.data;
  } catch (error) {
    console.error(`Error updating job ${jobId} status:`, error);
    throw error;
  }
};

// Complete a door for a job
export const completeDoor = async (jobId, doorId, completionData) => {
  try {
    const response = await api.post(`/jobs/${jobId}/doors/${doorId}/complete`, completionData);
    return response.data;
  } catch (error) {
    console.error(`Error completing door ${doorId} for job ${jobId}:`, error);
    throw error;
  }
};
'''

    file_contents[f"{project_dir}/frontend/src/services/scheduleService.js"] = '''import api from './api';

// Get scheduled jobs for a date range
export const getScheduledJobs = async (startDate, endDate, region = null) => {
  try {
    const params = {
      start_date: startDate,
      end_date: endDate,
      status: 'scheduled'
    };
    
    if (region) {
      params.region = region;
    }
    
    const response = await api.get('/jobs', { params });
    return response.data;
  } catch (error) {
    console.error('Error getting scheduled jobs:', error);
    throw error;
  }
};

// Get jobs scheduled for a specific date
export const getJobsForDate = async (date, region = null) => {
  try {
    // Format date to YYYY-MM-DD
    const formattedDate = date instanceof Date 
      ? date.toISOString().split('T')[0]
      : date;
    
    const params = {
      scheduled_date: formattedDate,
      status: 'scheduled'
    };
    
    if (region) {
      params.region = region;
    }
    
    const response = await api.get('/jobs', { params });
    return response.data;
  } catch (error) {
    console.error(`Error getting jobs for date ${date}:`, error);
    throw error;
  }
};
'''

    # Utils
    file_contents[f"{project_dir}/frontend/src/utils/formatters.js"] = '''// Format currency values
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value);
};

// Format date values
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

// Format job number
export const formatJobNumber = (date, count) => {
  const month = date.toLocaleString('en-US', { month: 'short' }).substring(0, 1);
  const year = date.getFullYear().toString().substring(2);
  const paddedCount = count.toString().padStart(2, '0');
  
  return `${month}${paddedCount}${year}`;
};

// Calculate total for line items
export const calculateLineItemTotal = (item) => {
  return (item.price * item.quantity) + item.hardware;
};

// Calculate labor cost
export const calculateLaborCost = (hours) => {
  const laborRate = 47.02; // $47.02 per hour
  return hours * laborRate;
};

// Format phone number
export const formatPhoneNumber = (phoneNumberString) => {
  let cleaned = ('' + phoneNumberString).replace(/\\D/g, '');
  
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
  } else if (cleaned.length > 10) {
    return `+${cleaned.substring(0, 1)} (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7, 11)}`;
  }
  
  return phoneNumberString;
};
'''

    file_contents[f"{project_dir}/frontend/src/utils/validators.js"] = '''// Validate required fields
export const validateRequired = (value) => {
  return value && value.trim() !== '';
};

// Validate email format
export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

// Validate phone number format
export const validatePhone = (phone) => {
  const re = /^\\(?([0-9]{3})\\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
  return re.test(String(phone));
};

// Validate numeric value
export const validateNumeric = (value) => {
  return !isNaN(parseFloat(value)) && isFinite(value);
};

// Validate positive numeric value
export const validatePositiveNumber = (value) => {
  const num = parseFloat(value);
  return !isNaN(num) && isFinite(num) && num > 0;
};

// Validate date format (YYYY-MM-DD)
export const validateDateFormat = (date) => {
  const re = /^\\d{4}-\\d{2}-\\d{2}$/;
  if (!re.test(date)) return false;
  
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  
  return d.toISOString().slice(0, 10) === date;
};

// Validate form data
export const validateForm = (data, validations) => {
  const errors = {};
  
  for (const field in validations) {
    if (validations.hasOwnProperty(field)) {
      const value = data[field];
      const validation = validations[field];
      
      if (validation.required && !validateRequired(value)) {
        errors[field] = validation.requiredMessage || 'This field is required';
      } else if (value && validation.validator && !validation.validator(value)) {
        errors[field] = validation.message || 'Invalid value';
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
'''

    # Project Root Files
    file_contents[f"{project_dir}/.gitignore"] = '''# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# production
/build

# misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local
.env

npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Flask
instance/
.webassets-cache

# SQLite
*.db
*.sqlite3

# Virtual environment
venv/
.venv/
ENV/

# IDE
.idea/
.vscode/
*.swp
*.swo
'''

    for filepath, content in file_contents.items():
        # Construct the full file path
        full_path = os.path.join(project_dir, filepath)
        
        # Ensure the directory exists
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        # Write the file content
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"Created file: {filepath}")

# And at the end of the main function:
def main():
    # Create project structure
    project_dir = create_project_structure()
    print(f"Project structure created at {project_dir}")
    
    # Populate files
    populate_files(project_dir)
    
    print("Project generation complete!")

# Ensure the script runs when executed directly
if __name__ == "__main__":
    main()