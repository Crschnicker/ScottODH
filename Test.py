#!/usr/bin/env python3
"""
Test script to check all imports before running the main app
Run this from the backend directory to diagnose import issues
"""

import sys
import os

print("🔍 Testing imports for Scott Overhead Doors backend...")
print(f"Current working directory: {os.getcwd()}")
print(f"Python path: {sys.path}")

# Test 1: Basic Flask imports
try:
    from flask import Flask
    print("✅ Flask import successful")
except ImportError as e:
    print(f"❌ Flask import failed: {e}")

# Test 2: Config import
try:
    from config import Config
    print("✅ Config import successful")
except ImportError as e:
    print(f"❌ Config import failed: {e}")

# Test 3: Models import
try:
    from models import db
    print("✅ Models.db import successful")
except ImportError as e:
    print(f"❌ Models.db import failed: {e}")

# Test 4: Individual model imports
models_to_test = ['user', 'customer', 'estimate', 'bid', 'job']
for model_name in models_to_test:
    try:
        module = __import__(f'models.{model_name}', fromlist=[model_name])
        print(f"✅ models.{model_name} import successful")
    except ImportError as e:
        print(f"⚠️  models.{model_name} import failed: {e}")

# Test 5: Routes import
routes_to_test = ['auth', 'customers', 'estimates', 'bids', 'jobs', 'mobile', 'audio', 'sites', 'line_items']
for route_name in routes_to_test:
    try:
        module = __import__(f'routes.{route_name}', fromlist=[route_name])
        print(f"✅ routes.{route_name} import successful")
    except ImportError as e:
        print(f"⚠️  routes.{route_name} import failed: {e}")

# Test 6: Check if models have necessary attributes
try:
    from models.user import User
    print(f"✅ User model found with attributes: {[attr for attr in dir(User) if not attr.startswith('_')]}")
except ImportError as e:
    print(f"⚠️  User model import failed: {e}")

print("\n📋 Import test complete. Fix any ❌ errors before running the app.")