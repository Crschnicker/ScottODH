"""
Routes package for Scott Overhead Doors API
This package contains all the Flask blueprints for different API endpoints.
Enhanced with comprehensive error handling and logging for Azure deployment.
"""

import logging

# Set up logger for route imports
logger = logging.getLogger(__name__)

# Blueprint import registry - tracks successful and failed imports
blueprint_registry = {
    'successful': [],
    'failed': [],
    'blueprints': {}
}

def safe_import_blueprint(module_name, blueprint_name, description):
    """
    Safely import a blueprint with comprehensive error handling and logging
    
    Args:
        module_name (str): The module to import from (e.g., 'auth')
        blueprint_name (str): The blueprint variable name (e.g., 'auth_bp')
        description (str): Human-readable description for logging
    
    Returns:
        Blueprint or None: The imported blueprint or None if import failed
    """
    try:
        # Import the module
        module = __import__(f'routes.{module_name}', fromlist=[blueprint_name])
        
        # Get the blueprint from the module
        blueprint = getattr(module, blueprint_name)
        
        # Verify it's actually a blueprint
        if hasattr(blueprint, 'name') and hasattr(blueprint, 'url_prefix'):
            blueprint_registry['successful'].append(description)
            blueprint_registry['blueprints'][blueprint_name] = blueprint
            logger.info(f"✓ {description} blueprint imported successfully")
            return blueprint
        else:
            raise AttributeError(f"{blueprint_name} is not a valid Flask Blueprint")
            
    except ImportError as e:
        error_msg = f"Import error for {description}: {str(e)}"
        logger.error(f"❌ {error_msg}")
        blueprint_registry['failed'].append({
            'name': description,
            'error': 'ImportError',
            'details': str(e)
        })
        return None
        
    except AttributeError as e:
        error_msg = f"Blueprint {blueprint_name} not found in {module_name}: {str(e)}"
        logger.error(f"❌ {error_msg}")
        blueprint_registry['failed'].append({
            'name': description,
            'error': 'AttributeError', 
            'details': str(e)
        })
        return None
        
    except Exception as e:
        error_msg = f"Unexpected error importing {description}: {str(e)}"
        logger.error(f"❌ {error_msg}")
        blueprint_registry['failed'].append({
            'name': description,
            'error': 'UnexpectedError',
            'details': str(e)
        })
        return None

# Import all blueprints with comprehensive error handling
logger.info("Starting blueprint imports for Scott Overhead Doors API...")

# Core authentication blueprint - Critical for app functionality
auth_bp = safe_import_blueprint('auth', 'auth_bp', 'Authentication')

# Customer management blueprints
customers_bp = safe_import_blueprint('customers', 'customers_bp', 'Customers')
sites_bp = safe_import_blueprint('sites', 'sites_bp', 'Sites')

# Project management blueprints
estimates_bp = safe_import_blueprint('estimates', 'estimates_bp', 'Estimates')
bids_bp = safe_import_blueprint('bids', 'bids_bp', 'Bids')
jobs_bp = safe_import_blueprint('jobs', 'jobs_bp', 'Jobs')

# Operational blueprints
dispatch_bp = safe_import_blueprint('dispatch', 'dispatch_bp', 'Dispatch')
mobile_bp = safe_import_blueprint('mobile', 'mobile_bp', 'Mobile')

# Content and media blueprints
audio_bp = safe_import_blueprint('audio', 'audio_bp', 'Audio')
doors_bp = safe_import_blueprint('door', 'doors_bp', 'Doors')

# Supporting blueprints
line_items_bp = safe_import_blueprint('line_items', 'line_items_bp', 'Line Items')

# Health check blueprint - Important for monitoring
health_bp = safe_import_blueprint('health', 'health_bp', 'Health Check')

# Summary logging
successful_count = len(blueprint_registry['successful'])
failed_count = len(blueprint_registry['failed'])
total_blueprints = successful_count + failed_count

logger.info(f"Blueprint import summary: {successful_count}/{total_blueprints} successful")

if successful_count > 0:
    logger.info(f"✓ Successfully imported: {', '.join(blueprint_registry['successful'])}")

if failed_count > 0:
    logger.warning(f"❌ Failed imports: {failed_count}")
    for failure in blueprint_registry['failed']:
        logger.warning(f"  - {failure['name']}: {failure['error']} - {failure['details']}")

# Critical blueprint validation
critical_blueprints = ['Authentication', 'Jobs', 'Customers']
missing_critical = [bp for bp in critical_blueprints if bp not in blueprint_registry['successful']]

if missing_critical:
    logger.error(f"🚨 CRITICAL: Missing essential blueprints: {', '.join(missing_critical)}")
    logger.error("The application may not function properly without these blueprints!")
else:
    logger.info("✅ All critical blueprints imported successfully")

# Export all blueprint variables (None if import failed)
# This ensures the app.py can still reference them without causing import errors
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
    'dispatch_bp',
    'health_bp',
    'blueprint_registry'  # Export registry for debugging
]

# Validation function for app.py to check blueprint health
def validate_blueprints():
    """
    Validate blueprint imports and return status information
    
    Returns:
        dict: Blueprint validation results with counts and status
    """
    return {
        'total_blueprints': len(__all__) - 1,  # Exclude blueprint_registry from count
        'successful_imports': successful_count,
        'failed_imports': failed_count,
        'critical_missing': missing_critical,
        'all_critical_present': len(missing_critical) == 0,
        'import_success_rate': (successful_count / total_blueprints * 100) if total_blueprints > 0 else 0,
        'successful_blueprints': blueprint_registry['successful'],
        'failed_blueprints': [f['name'] for f in blueprint_registry['failed']],
        'ready_for_registration': successful_count > 0
    }

# Helper function to get blueprint by name
def get_blueprint(name):
    """
    Get a blueprint by its variable name
    
    Args:
        name (str): Blueprint variable name (e.g., 'auth_bp')
    
    Returns:
        Blueprint or None: The blueprint instance or None if not available
    """
    return blueprint_registry['blueprints'].get(name)

# Helper function to list all available blueprints
def list_available_blueprints():
    """
    Get a list of all successfully imported blueprints
    
    Returns:
        dict: Dictionary of blueprint_name -> blueprint_instance
    """
    return blueprint_registry['blueprints'].copy()

logger.info("Routes package initialization complete")
logger.info(f"Ready to register {successful_count} blueprints with Flask application")