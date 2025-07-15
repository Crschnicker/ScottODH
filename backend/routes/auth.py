# backend/routes/auth.py

from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from datetime import datetime

# --- Local Imports ---
from models import db, User
from middleware.auth import admin_required, field_or_admin_required

# Create the Blueprint for authentication routes
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """Handle user login."""
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = User.query.filter_by(username=username).first()

    # Check if user exists and password is correct
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid username or password"}), 401

    # Check if the user's account is active
    if not user.is_active:
        return jsonify({"error": "This account has been disabled."}), 403

    # Log the user in, creating a session
    login_user(user, remember=True)
    user.last_login = datetime.utcnow()
    db.session.commit()

    # Return a success message and the user's data
    return jsonify({
        "message": "Login successful",
        "user": user.to_dict()  # Assumes you have a to_dict() method on your User model
    })

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """Handle user logout."""
    logout_user()
    return jsonify({"message": "Logout successful"})

@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    """Get the profile of the currently logged-in user."""
    # The @login_required decorator ensures current_user is available
    return jsonify(current_user.to_dict())

@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """Allow a logged-in user to change their own password."""
    data = request.json
    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if not current_password or not new_password:
        return jsonify({"error": "Both the current and new passwords are required."}), 400
    
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters long."}), 400

    if not current_user.check_password(current_password):
        return jsonify({"error": "The current password you entered is incorrect."}), 401

    current_user.set_password(new_password)
    db.session.commit()

    return jsonify({"message": "Password has been changed successfully."})


# --- Admin-Only User Management Routes ---

@auth_bp.route('/users', methods=['GET'])
@login_required
@admin_required
def get_users():
    """Get a list of all users (Admin Only)."""
    users = User.query.order_by(User.first_name).all()
    return jsonify([user.to_dict() for user in users])

@auth_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@login_required
@admin_required
def reset_user_password(user_id):
    """Reset a specific user's password (Admin Only)."""
    if current_user.id == user_id:
        return jsonify({"error": "Admins cannot reset their own password via this endpoint. Please use 'Change Password' instead."}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    data = request.json
    new_password = data.get('new_password')

    if not new_password or len(new_password) < 6:
        return jsonify({"error": "A new password of at least 6 characters is required."}), 400

    user.set_password(new_password)
    db.session.commit()

    return jsonify({"message": f"Password for user '{user.username}' has been reset successfully."})

@auth_bp.route('/test/protected-route')
@login_required
@field_or_admin_required
def test_protected_route():
    """A test route to verify field or admin access."""
    return jsonify({
        "message": "Access granted!",
        "user": current_user.username,
        "role": current_user.role
    })