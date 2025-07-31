from flask import Blueprint, jsonify, current_app
from sqlalchemy import text
from models import db
import os

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """
    Comprehensive health check endpoint to verify service status
    Tests database connectivity, configuration, and overall system health
    """
    health_status = {
        'status': 'healthy',
        'app': 'Scott Overhead Doors API',
        'version': '1.0.0',
        'timestamp': None,
        'checks': {}
    }
    
    overall_healthy = True
    status_code = 200
    
    try:
        # Import datetime here to avoid potential import issues
        from datetime import datetime
        health_status['timestamp'] = datetime.utcnow().isoformat() + 'Z'
        
        # Test 1: Database Connection
        try:
            # Test basic database connectivity
            db.session.execute(text('SELECT 1'))
            db.session.commit()
            
            # Get database info
            db_url = current_app.config.get('SQLALCHEMY_DATABASE_URI', '')
            if 'sqlite' in db_url.lower():
                db_type = 'SQLite'
            elif 'postgresql' in db_url.lower() or 'postgres' in db_url.lower():
                db_type = 'PostgreSQL'
            else:
                db_type = 'Unknown'
            
            health_status['checks']['database'] = {
                'status': 'healthy',
                'type': db_type,
                'connected': True
            }
            
        except Exception as db_error:
            current_app.logger.error(f"Database health check failed: {db_error}")
            health_status['checks']['database'] = {
                'status': 'unhealthy',
                'connected': False,
                'error': str(db_error)
            }
            overall_healthy = False
        
        # Test 2: Environment Configuration
        try:
            config_issues = []
            
            # Check critical environment variables for production
            if os.environ.get('WEBSITE_SITE_NAME'):  # Azure App Service
                critical_env_vars = ['SECRET_KEY', 'DATABASE_URL']
                for var in critical_env_vars:
                    if not os.environ.get(var):
                        config_issues.append(f'Missing {var}')
            
            health_status['checks']['configuration'] = {
                'status': 'healthy' if not config_issues else 'warning',
                'environment': 'production' if os.environ.get('WEBSITE_SITE_NAME') else 'development',
                'issues': config_issues,
                'azure_app_service': bool(os.environ.get('WEBSITE_SITE_NAME')),
                'cors_configured': bool(current_app.config.get('CORS_ORIGINS'))
            }
            
            if config_issues:
                current_app.logger.warning(f"Configuration issues detected: {config_issues}")
                
        except Exception as config_error:
            current_app.logger.error(f"Configuration health check failed: {config_error}")
            health_status['checks']['configuration'] = {
                'status': 'unhealthy',
                'error': str(config_error)
            }
            overall_healthy = False
        
        # Test 3: Application State
        try:
            # Check if critical blueprints are registered
            registered_blueprints = [bp.name for bp in current_app.blueprints.values()]
            critical_blueprints = ['auth', 'jobs', 'customers']
            missing_blueprints = [bp for bp in critical_blueprints if bp not in registered_blueprints]
            
            # Count total routes
            total_routes = len(list(current_app.url_map.iter_rules()))
            api_routes = len([rule for rule in current_app.url_map.iter_rules() 
                             if rule.rule.startswith('/api/')])
            
            health_status['checks']['application'] = {
                'status': 'healthy' if not missing_blueprints else 'warning',
                'blueprints': {
                    'registered': registered_blueprints,
                    'missing_critical': missing_blueprints,
                    'total_count': len(registered_blueprints)
                },
                'routes': {
                    'total': total_routes,
                    'api_routes': api_routes
                }
            }
            
            if missing_blueprints:
                current_app.logger.warning(f"Missing critical blueprints: {missing_blueprints}")
                
        except Exception as app_error:
            current_app.logger.error(f"Application health check failed: {app_error}")
            health_status['checks']['application'] = {
                'status': 'unhealthy',
                'error': str(app_error)
            }
            overall_healthy = False
        
        # Test 4: External Dependencies (Azure Storage if configured)
        try:
            azure_storage_conn = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
            if azure_storage_conn:
                # Just check if connection string is present and properly formatted
                storage_healthy = 'DefaultEndpointsProtocol' in azure_storage_conn
                health_status['checks']['azure_storage'] = {
                    'status': 'healthy' if storage_healthy else 'warning',
                    'configured': True,
                    'connection_valid': storage_healthy
                }
            else:
                health_status['checks']['azure_storage'] = {
                    'status': 'info',
                    'configured': False,
                    'message': 'Azure Storage not configured (optional)'
                }
                
        except Exception as storage_error:
            current_app.logger.error(f"Azure Storage health check failed: {storage_error}")
            health_status['checks']['azure_storage'] = {
                'status': 'warning',
                'error': str(storage_error)
            }
        
        # Determine overall health status
        if not overall_healthy:
            health_status['status'] = 'unhealthy'
            status_code = 503  # Service Unavailable
        elif any(check.get('status') == 'warning' for check in health_status['checks'].values()):
            health_status['status'] = 'degraded'
            status_code = 200  # Still OK, but with warnings
        
        # Add summary
        health_status['summary'] = {
            'healthy_checks': sum(1 for check in health_status['checks'].values() 
                                if check.get('status') == 'healthy'),
            'warning_checks': sum(1 for check in health_status['checks'].values() 
                                if check.get('status') == 'warning'),
            'unhealthy_checks': sum(1 for check in health_status['checks'].values() 
                                  if check.get('status') == 'unhealthy'),
            'total_checks': len(health_status['checks'])
        }
        
        current_app.logger.info(f"Health check completed: {health_status['status']}")
        
    except Exception as overall_error:
        current_app.logger.error(f"Health check failed with unexpected error: {overall_error}")
        health_status = {
            'status': 'unhealthy',
            'app': 'Scott Overhead Doors API',
            'error': 'Health check system failure',
            'message': str(overall_error),
            'timestamp': datetime.utcnow().isoformat() + 'Z' if 'datetime' in locals() else None
        }
        status_code = 503
    
    return jsonify(health_status), status_code

@health_bp.route('/health/simple', methods=['GET'])
def simple_health_check():
    """
    Simple health check for basic monitoring
    Returns minimal response for load balancers and simple monitoring
    """
    try:
        # Just test database connectivity
        db.session.execute(text('SELECT 1'))
        db.session.commit()
        
        return jsonify({
            'status': 'healthy',
            'message': 'Service is running'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Simple health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'message': 'Database connection failed'
        }), 503