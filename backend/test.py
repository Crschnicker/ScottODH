# create_tables.py
# Run this script to create all tables from your models

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add current directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

def create_all_tables():
    """Create all tables and verify they exist"""
    try:
        # Import your Flask app setup
        from flask import Flask
        from config import Config
        from models import db
        
        print("Creating Flask app...")
        app = Flask(__name__)
        app.config.from_object(Config)
        
        # Show database URL being used
        db_url = app.config['SQLALCHEMY_DATABASE_URI']
        print(f"Database URL: {db_url[:50]}...")
        
        # Initialize database
        db.init_app(app)
        
        with app.app_context():
            print("Testing database connection...")
            
            # Test connection first
            try:
                result = db.session.execute(db.text("SELECT version(), current_database();"))
                row = result.fetchone()
                print(f"✅ Connected to PostgreSQL: {row[0][:30]}...")
                print(f"✅ Database: {row[1]}")
            except Exception as e:
                print(f"❌ Database connection failed: {e}")
                return False
            
            # Import all your models to register them
            print("\nImporting models...")
            try:
                from models.user import User
                print("  ✅ User model imported")
            except ImportError as e:
                print(f"  ❌ User model import failed: {e}")
                
            try:
                from models.customer import Customer
                print("  ✅ Customer model imported")
            except ImportError as e:
                print(f"  ❌ Customer model import failed: {e}")
                
            try:
                from models.estimate import Estimate
                print("  ✅ Estimate model imported")
            except ImportError as e:
                print(f"  ❌ Estimate model import failed: {e}")
                
            try:
                from models.bid import Bid
                print("  ✅ Bid model imported")
            except ImportError as e:
                print(f"  ❌ Bid model import failed: {e}")
                
            try:
                from models.job import Job
                print("  ✅ Job model imported")
            except ImportError as e:
                print(f"  ❌ Job model import failed: {e}")
                
            try:
                from models.door import Door
                print("  ✅ Door model imported")
            except ImportError as e:
                print(f"  ❌ Door model import failed: {e}")
                
            try:
                from models.line_item import LineItem
                print("  ✅ LineItem model imported")
            except ImportError as e:
                print(f"  ❌ LineItem model import failed: {e}")
            
            # Create all tables
            print("\nCreating database tables...")
            db.create_all()
            print("✅ db.create_all() completed")
            
            # Verify tables were created
            print("\nVerifying tables were created...")
            tables_query = db.text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name;
            """)
            
            result = db.session.execute(tables_query)
            tables = [row[0] for row in result.fetchall()]
            
            if tables:
                print(f"✅ Found {len(tables)} tables:")
                for table in tables:
                    print(f"  - {table}")
                    
                    # Get column info for each table
                    columns_query = db.text("""
                        SELECT column_name, data_type, is_nullable
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = :table_name
                        ORDER BY ordinal_position;
                    """)
                    
                    col_result = db.session.execute(columns_query, {"table_name": table})
                    columns = col_result.fetchall()
                    print(f"    Columns: {len(columns)}")
                    for col in columns[:3]:  # Show first 3 columns
                        print(f"      - {col[0]} ({col[1]})")
                    if len(columns) > 3:
                        print(f"      ... and {len(columns) - 3} more")
                    print()
            else:
                print("❌ No tables found! Check your model imports.")
                return False
            
            # Try to create default users
            print("Creating default users...")
            try:
                from models.user import User
                
                # Check if users already exist
                existing_users = User.query.count()
                if existing_users > 0:
                    print(f"✅ Found {existing_users} existing users")
                else:
                    # Create default users
                    users_to_create = [
                        {'username': 'scott', 'password': 'password', 'email': 'scott@scottoverheaddoors.com', 'first_name': 'Scott', 'last_name': 'Owner', 'role': 'admin'},
                        {'username': 'taylor', 'password': 'password', 'email': 'taylor@scottoverheaddoors.com', 'first_name': 'Taylor', 'last_name': 'Admin', 'role': 'admin'},
                        {'username': 'truck1', 'password': 'password', 'email': 'truck1@scottoverheaddoors.com', 'first_name': 'Truck', 'last_name': 'One', 'role': 'field'},
                    ]
                    
                    for user_data in users_to_create:
                        user = User(
                            username=user_data['username'],
                            email=user_data['email'],
                            first_name=user_data['first_name'],
                            last_name=user_data['last_name'],
                            role=user_data['role']
                        )
                        user.set_password(user_data['password'])
                        db.session.add(user)
                    
                    db.session.commit()
                    print(f"✅ Created {len(users_to_create)} default users")
                    
            except Exception as e:
                print(f"⚠️  User creation failed: {e}")
            
            print("\n🎉 Database setup complete!")
            return True
            
    except Exception as e:
        print(f"❌ Table creation failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_database_schema():
    """Check the current database schema"""
    try:
        from flask import Flask
        from config import Config
        from models import db
        
        app = Flask(__name__)
        app.config.from_object(Config)
        db.init_app(app)
        
        with app.app_context():
            # Get all tables
            tables_query = db.text("""
                SELECT 
                    t.table_name,
                    COUNT(c.column_name) as column_count
                FROM information_schema.tables t
                LEFT JOIN information_schema.columns c 
                    ON t.table_name = c.table_name 
                    AND t.table_schema = c.table_schema
                WHERE t.table_schema = 'public'
                GROUP BY t.table_name
                ORDER BY t.table_name;
            """)
            
            result = db.session.execute(tables_query)
            tables = result.fetchall()
            
            print("Current Database Schema:")
            print("=" * 40)
            
            if tables:
                for table_name, column_count in tables:
                    print(f"📋 {table_name} ({column_count} columns)")
                    
                    # Get detailed column info
                    columns_query = db.text("""
                        SELECT column_name, data_type, is_nullable, column_default
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = :table_name
                        ORDER BY ordinal_position;
                    """)
                    
                    col_result = db.session.execute(columns_query, {"table_name": table_name})
                    columns = col_result.fetchall()
                    
                    for col_name, data_type, nullable, default in columns:
                        null_str = "NULL" if nullable == "YES" else "NOT NULL"
                        default_str = f" DEFAULT {default}" if default else ""
                        print(f"   - {col_name}: {data_type} {null_str}{default_str}")
                    print()
            else:
                print("No tables found in the database.")
                
    except Exception as e:
        print(f"❌ Schema check failed: {e}")

if __name__ == "__main__":
    print("Scott Overhead Doors - Database Table Creation")
    print("=" * 50)
    
    # First create tables
    if create_all_tables():
        # Then show the schema
        print("\n")
        check_database_schema()
    else:
        print("Table creation failed. Check the errors above.")