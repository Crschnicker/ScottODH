# backend/routes/__init__.py
"""
Routes package for Scott Overhead Doors API
This package contains all the Flask blueprints for different API endpoints.
"""

# Import all blueprints to make them available when the package is imported
try:
    from .auth import auth_bp
    print("✓ Auth blueprint imported successfully")
except ImportError as e:
    print(f"⚠ Auth blueprint import failed: {e}")
    auth_bp = None

try:
    from .customers import customers_bp
    print("✓ Customers blueprint imported successfully")
except ImportError as e:
    print(f"⚠ Customers blueprint import failed: {e}")
    customers_bp = None

try:
    from .estimates import estimates_bp
    print("✓ Estimates blueprint imported successfully")
except ImportError as e:
    print(f"⚠ Estimates blueprint import failed: {e}")
    estimates_bp = None

try:
    from .bids import bids_bp
    print("✓ Bids blueprint imported successfully")
except ImportError as e:
    print(f"⚠ Bids blueprint import failed: {e}")
    bids_bp = None

try:
    from .jobs import jobs_bp
    print("✓ Jobs blueprint imported successfully")
except ImportError as e:
    print(f"⚠ Jobs blueprint import failed: {e}")
    jobs_bp = None

try:
    from .mobile import mobile_bp
    print("✓ Mobile blueprint imported successfully")
except ImportError as e:
    print(f"⚠ Mobile blueprint import failed: {e}")
    mobile_bp = None

try:
    from .audio import audio_bp
    print("✓ Audio blueprint imported successfully")
except ImportError as e:
    print(f"⚠ Audio blueprint import failed: {e}")
    audio_bp = None

try:
    from .sites import sites_bp
    print("✓ Sites blueprint imported successfully")
except ImportError as e:
    print(f"⚠ Sites blueprint import failed: {e}")
    sites_bp = None

try:
    from .line_items import line_items_bp
    print("✓ Line items blueprint imported successfully")
except ImportError as e:
    print(f"⚠ Line items blueprint import failed: {e}")
    line_items_bp = None

try:
    from .door import doors_bp
    print("✓ Doors blueprint imported successfully")
except ImportError as e:
    print(f"⚠ Doors blueprint import failed: {e}")
    doors_bp = None

try:
    from .dispatch import dispatch_bp
    print("✓ Dispatch blueprint imported successfully")
except ImportError as e:
    print(f"⚠ Dispatch blueprint import failed: {e}")
    dispatch_bp = None

# List of all available blueprints
__all__ = [
    'auth_bp',
    'customers_bp', 
    'estimates_bp',
    'bids_bp',
    'jobs_bp',
    'mobile_bp',
    'audio_bp',
    'sites_bp',
    'line_items_bp',
    'doors_bp',
    'dispatch_bp'
]