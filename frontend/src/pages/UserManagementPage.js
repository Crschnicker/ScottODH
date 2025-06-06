import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Key, 
  Eye, 
  EyeOff, 
  Save, 
  X, 
  AlertCircle, 
  CheckCircle,
  UserCheck,
  UserX,
  Search,
  Filter,
  Shield,
  User
} from 'lucide-react';
// Import the updated CSS file
import './UserManagementPage.css';

/**
 * UserManagementPage Component
 * Comprehensive user management interface with enhanced design matching the header style
 * Features: CRUD operations, search/filter, responsive design, accessibility support
 */
const UserManagementPage = ({ currentUser }) => {
  /* ==================== STATE MANAGEMENT ==================== */
  
  // Core data state
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Form data states
  const [newUserData, setNewUserData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'field',
    password: '',
    is_active: true
  });

  const [editUserData, setEditUserData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'field',
    is_active: true,
  });

  const [passwordData, setPasswordData] = useState({
    new_password: '',
    confirm_password: ''
  });

  // UI state for password visibility
  const [showNewPasswordInCreate, setShowNewPasswordInCreate] = useState(false);
  const [showNewPasswordInReset, setShowNewPasswordInReset] = useState(false);
  const [showConfirmPasswordInReset, setShowConfirmPasswordInReset] = useState(false);

  /* ==================== LIFECYCLE HOOKS ==================== */

  // Initial data load
  useEffect(() => {
    fetchUsers();
  }, []);

  // Auto-clear success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Auto-clear error messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  /* ==================== API FUNCTIONS ==================== */

  /**
   * Fetch all users from the API
   * Handles loading states and error management
   */
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/users', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        const errData = await response.json().catch(() => ({ 
          error: 'Failed to fetch users. Server error.' 
        }));
        setError(errData.error || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Network error fetching users. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create a new user
   * Validates input data and handles API response
   */
  const handleCreateUser = async () => {
    // Input validation
    if (!newUserData.username || !newUserData.email || !newUserData.password ||
        !newUserData.first_name || !newUserData.last_name) {
      setError('All fields (Username, Email, First Name, Last Name, Password) are required.');
      return;
    }

    if (newUserData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newUserData)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('User created successfully!');
        setShowCreateModal(false);
        resetNewUserForm();
        fetchUsers();
      } else {
        setError(data.error || 'Failed to create user.');
      }
    } catch (err) {
      setError('Network error creating user.');
    }
  };

  /**
   * Edit an existing user
   * Updates user information excluding password
   */
  const handleEditUser = async () => {
    // Input validation
    if (!editUserData.email || !editUserData.first_name || !editUserData.last_name) {
      setError('Email, First Name, and Last Name are required.');
      return;
    }

    try {
      const payload = {
        email: editUserData.email,
        first_name: editUserData.first_name,
        last_name: editUserData.last_name,
        role: editUserData.role,
        is_active: editUserData.is_active,
      };

      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('User updated successfully!');
        setShowEditModal(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        setError(data.error || 'Failed to update user.');
      }
    } catch (err) {
      setError('Network error updating user.');
    }
  };

  /**
   * Delete a user with confirmation
   * Prevents self-deletion
   */
  const handleDeleteUser = async (userId, username) => {
    // Prevent self-deletion
    if (userId === currentUser?.id) {
      setError("You cannot delete your own account.");
      return;
    }
    
    // Confirmation dialog
    if (!window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setSuccess('User deleted successfully.');
        fetchUsers();
      } else {
        const data = await response.json().catch(() => ({
          error: 'Failed to delete user.'
        }));
        setError(data.error || 'Failed to delete user.');
      }
    } catch (err) {
      setError('Network error deleting user.');
    }
  };

  /**
   * Reset user password
   * Validates password requirements and confirmation
   */
  const handleResetPassword = async () => {
    // Input validation
    if (!passwordData.new_password || !passwordData.confirm_password) {
      setError('Please enter and confirm the new password.');
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    if (passwordData.new_password.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    try {
      const response = await fetch(`/api/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ new_password: passwordData.new_password })
      });

      if (response.ok) {
        setSuccess(`Password reset successfully for ${selectedUser.username}.`);
        setShowPasswordModal(false);
        setSelectedUser(null);
        setPasswordData({ new_password: '', confirm_password: '' });
      } else {
        const data = await response.json().catch(() => ({
          error: 'Failed to reset password.'
        }));
        setError(data.error || 'Failed to reset password.');
      }
    } catch (err) {
      setError('Network error resetting password.');
    }
  };

  /* ==================== UTILITY FUNCTIONS ==================== */

  /**
   * Reset new user form to initial state
   */
  const resetNewUserForm = () => {
    setNewUserData({
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      role: 'field',
      password: '',
      is_active: true
    });
    setShowNewPasswordInCreate(false);
  };

  /**
   * Open edit modal with user data
   */
  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditUserData({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_active: user.is_active,
    });
    setError('');
    setShowEditModal(true);
  };

  /**
   * Open password reset modal
   */
  const openPasswordModal = (user) => {
    setSelectedUser(user);
    setPasswordData({ new_password: '', confirm_password: '' });
    setShowNewPasswordInReset(false);
    setShowConfirmPasswordInReset(false);
    setError('');
    setShowPasswordModal(true);
  };

  /**
   * Filter users based on search term and role filter
   */
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (user.username?.toLowerCase() || '').includes(searchLower) ||
                         (user.email?.toLowerCase() || '').includes(searchLower) ||
                         (user.full_name?.toLowerCase() || '').includes(searchLower);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  /* ==================== RENDER FUNCTIONS ==================== */

  /**
   * Render loading state
   */
  if (loading && !users.length) {
    return (
      <div className="user-management-page-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span className="loading-text">Loading Users...</span>
        </div>
      </div>
    );
  }

  /**
   * Render alert messages
   */
  const renderAlerts = () => (
    <>
      {error && (
        <div className="mb-6 alert-message error-message p-4 rounded-lg shadow-md">
          <div className="flex items-center">
            <AlertCircle className="h-6 w-6 text-red-500 mr-3 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 alert-message success-message p-4 rounded-lg shadow-md">
          <div className="flex items-center">
            <CheckCircle className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Success</p>
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );

  /**
   * Render user table row
   */
  const renderUserRow = (user) => (
    <tr key={user.id}>
      <td>
        <div className="flex items-center gap-4">
          <div className="user-avatar-initials">
            {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
          </div>
          <div className="user-info-text">
            <div className="user-name">{user.full_name}</div>
            <div className="user-details">{user.username} • {user.email}</div>
          </div>
        </div>
      </td>
      <td>
        <span className={`role-badge ${user.role}`}>
          {user.role === 'admin' ? (
            <>
              <Shield className="w-3 h-3 mr-1" />
              Office Admin
            </>
          ) : (
            <>
              <User className="w-3 h-3 mr-1" />
              Field Tech
            </>
          )}
        </span>
      </td>
      <td>
        <div className={`status-indicator ${user.is_active ? 'active' : 'inactive'}`}>
          {user.is_active ? (
            <UserCheck className="h-5 w-5" />
          ) : (
            <UserX className="h-5 w-5" />
          )}
          <span>{user.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      </td>
      <td className="text-gray-500">
        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
      </td>
      <td>
        <div className="action-buttons">
          <button
            onClick={() => openEditModal(user)}
            className="edit-button"
            title="Edit User"
            aria-label={`Edit user ${user.username}`}
          >
            <Edit2 className="h-5 w-5" />
          </button>
          <button
            onClick={() => openPasswordModal(user)}
            className="password-button"
            title="Reset Password"
            aria-label={`Reset password for ${user.username}`}
          >
            <Key className="h-5 w-5" />
          </button>
          {currentUser && user.id !== currentUser.id && (
            <button
              onClick={() => handleDeleteUser(user.id, user.username)}
              className="delete-button"
              title="Delete User"
              aria-label={`Delete user ${user.username}`}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  /**
   * Render create user modal
   */
  const renderCreateModal = () => (
    showCreateModal && (
      <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="modal-content w-full max-w-lg">
          <div className="modal-header flex items-center justify-between">
            <h3>Create New User</h3>
            <button
              onClick={() => { setShowCreateModal(false); resetNewUserForm(); }}
              className="modal-close-button"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                Username <span className="required-asterisk">*</span>
              </label>
              <input
                type="text"
                value={newUserData.username}
                onChange={(e) => setNewUserData({...newUserData, username: e.target.value})}
                className="modal-input"
                placeholder="Enter username"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Email <span className="required-asterisk">*</span>
              </label>
              <input
                type="email"
                value={newUserData.email}
                onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                className="modal-input"
                placeholder="Enter email"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">
                  First Name <span className="required-asterisk">*</span>
                </label>
                <input
                  type="text"
                  value={newUserData.first_name}
                  onChange={(e) => setNewUserData({...newUserData, first_name: e.target.value})}
                  className="modal-input"
                  placeholder="First name"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Last Name <span className="required-asterisk">*</span>
                </label>
                <input
                  type="text"
                  value={newUserData.last_name}
                  onChange={(e) => setNewUserData({...newUserData, last_name: e.target.value})}
                  className="modal-input"
                  placeholder="Last name"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Role <span className="required-asterisk">*</span>
              </label>
              <select
                value={newUserData.role}
                onChange={(e) => setNewUserData({...newUserData, role: e.target.value})}
                className="modal-select"
                required
              >
                <option value="field">Field Tech</option>
                <option value="admin">Office Admin</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Password <span className="required-asterisk">*</span>
              </label>
              <div className="password-input-container">
                <input
                  type={showNewPasswordInCreate ? 'text' : 'password'}
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({...newUserData, password: e.target.value})}
                  className="modal-input"
                  placeholder="Enter password (min. 6 characters)"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPasswordInCreate(!showNewPasswordInCreate)}
                  className="password-toggle-button"
                  aria-label={showNewPasswordInCreate ? "Hide password" : "Show password"}
                >
                  {showNewPasswordInCreate ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="checkbox-container">
              <input
                type="checkbox"
                id="create_is_active"
                checked={newUserData.is_active}
                onChange={(e) => setNewUserData({...newUserData, is_active: e.target.checked})}
                className="checkbox-input"
              />
              <label htmlFor="create_is_active" className="checkbox-label">
                Active User
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={() => { setShowCreateModal(false); resetNewUserForm(); }}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateUser}
              className="save-button"
            >
              <Save className="h-4 w-4" />
              Create User
            </button>
          </div>
        </div>
      </div>
    )
  );

  /**
   * Render edit user modal
   */
  const renderEditModal = () => (
    showEditModal && selectedUser && (
      <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="modal-content w-full max-w-lg">
          <div className="modal-header flex items-center justify-between">
            <h3>Edit User: <span className="font-normal">{selectedUser.username}</span></h3>
            <button
              onClick={() => setShowEditModal(false)}
              className="modal-close-button"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                Email <span className="required-asterisk">*</span>
              </label>
              <input
                type="email"
                value={editUserData.email}
                onChange={(e) => setEditUserData({...editUserData, email: e.target.value})}
                className="modal-input"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">
                  First Name <span className="required-asterisk">*</span>
                </label>
                <input
                  type="text"
                  value={editUserData.first_name}
                  onChange={(e) => setEditUserData({...editUserData, first_name: e.target.value})}
                  className="modal-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Last Name <span className="required-asterisk">*</span>
                </label>
                <input
                  type="text"
                  value={editUserData.last_name}
                  onChange={(e) => setEditUserData({...editUserData, last_name: e.target.value})}
                  className="modal-input"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Role <span className="required-asterisk">*</span>
              </label>
              <select
                value={editUserData.role}
                onChange={(e) => setEditUserData({...editUserData, role: e.target.value})}
                className="modal-select"
                required
              >
                <option value="field">Field Tech</option>
                <option value="admin">Office Admin</option>
              </select>
            </div>

            <div className="checkbox-container">
              <input
                type="checkbox"
                id="edit_is_active"
                checked={editUserData.is_active}
                onChange={(e) => setEditUserData({...editUserData, is_active: e.target.checked})}
                className="checkbox-input"
              />
              <label htmlFor="edit_is_active" className="checkbox-label">
                Active User
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEditUser}
              className="save-button"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    )
  );

  /**
   * Render password reset modal
   */
  const renderPasswordModal = () => (
    showPasswordModal && selectedUser && (
      <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="modal-content w-full max-w-lg">
          <div className="modal-header flex items-center justify-between">
            <h3>Reset Password: <span className="font-normal">{selectedUser.username}</span></h3>
            <button
              onClick={() => setShowPasswordModal(false)}
              className="modal-close-button"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                New Password <span className="required-asterisk">*</span>
              </label>
              <div className="password-input-container">
                <input
                  type={showNewPasswordInReset ? 'text' : 'password'}
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                  className="modal-input"
                  placeholder="Enter new password (min. 6 characters)"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPasswordInReset(!showNewPasswordInReset)}
                  className="password-toggle-button"
                  aria-label={showNewPasswordInReset ? "Hide password" : "Show password"}
                >
                  {showNewPasswordInReset ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Confirm Password <span className="required-asterisk">*</span>
              </label>
              <div className="password-input-container">
                <input
                  type={showConfirmPasswordInReset ? 'text' : 'password'}
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                  className="modal-input"
                  placeholder="Confirm new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPasswordInReset(!showConfirmPasswordInReset)}
                  className="password-toggle-button"
                  aria-label={showConfirmPasswordInReset ? "Hide password" : "Show password"}
                >
                  {showConfirmPasswordInReset ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={() => setShowPasswordModal(false)}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleResetPassword}
              className="reset-password-button"
            >
              <Key className="h-4 w-4" />
              Reset Password
            </button>
          </div>
        </div>
      </div>
    )
  );

  /* ==================== MAIN RENDER ==================== */

  return (
    <div className="user-management-page-container">
      {/* Enhanced Page Header */}
      <div className="page-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold flex items-center">
            <Users className="h-10 w-10 mr-4 text-blue-300" />
            User Management
          </h1>
          <p>Manage user accounts, roles, and permissions with advanced controls.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Alert Messages */}
        {renderAlerts()}

        {/* Enhanced Controls Section */}
        <div className="controls-section">
          <div className="controls-left">
            {/* Enhanced Search */}
            <div className="search-container">
              <Search className="search-icon h-5 w-5" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
                autoComplete="off"
              />
            </div>

            {/* Enhanced Role Filter */}
            <div className="filter-container">
              <Filter className="filter-icon h-5 w-5" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Roles</option>
                <option value="admin">Office Admin</option>
                <option value="field">Field Tech</option>
              </select>
            </div>
          </div>

          {/* Enhanced Add User Button */}
          <div className="controls-right">
            <button
              onClick={() => setShowCreateModal(true)}
              className="add-user-button"
            >
              <Plus className="h-5 w-5" />
              Add New User
            </button>
          </div>
        </div>

        {/* Enhanced Users Table */}
        <div className="table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(renderUserRow)}
            </tbody>
          </table>

          {/* Enhanced No Users Message */}
          {filteredUsers.length === 0 && !loading && (
            <div className="no-users-message">
              <Users className="mx-auto h-20 w-20 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Users Found</h3>
              <p className="text-lg mb-6">
                {searchTerm || roleFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.' 
                  : 'Get started by creating your first user.'}
              </p>
              {!(searchTerm || roleFilter !== 'all') && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Add New User
                </button>
              )}
            </div>
          )}

          {/* Subtle Loading Indicator for Updates */}
          {loading && users.length > 0 && (
            <div className="text-center py-4 text-sm text-gray-500">
              <div className="inline-flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                Refreshing user list...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Modals */}
      {renderCreateModal()}
      {renderEditModal()}
      {renderPasswordModal()}
    </div>
  );
};

export default UserManagementPage;