import React, { useState } from 'react';
import { Button, InputGroup, FormControl, Modal } from 'react-bootstrap';
import { FaPlus, FaCopy, FaCheck, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { addDoor, duplicateDoor, deleteDoor } from '../../services/bidService';
import './DoorTabs.css';

const DoorTabs = ({ doors, activeDoorId, onTabChange, onDoorsChanged, bidId }) => {
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sourceDoorId, setSourceDoorId] = useState(null);
  const [doorToDelete, setDoorToDelete] = useState(null);
  const [targetDoors, setTargetDoors] = useState('');
  const [isAddingDoor, setIsAddingDoor] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleAddDoor = async () => {
    if (!bidId) return;
    
    setIsAddingDoor(true);
    try {
      const newDoor = await addDoor(bidId);
      toast.success(`Door #${newDoor.door_number} added`);
      
      // Refresh the entire bid data before selecting the new door
      if (onDoorsChanged) {
        await onDoorsChanged();
      }
      
      // Select the new door after refresh
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
  
  const openDeleteModal = (doorId, doorNumber) => {
    setDoorToDelete({ id: doorId, doorNumber });
    setShowDeleteModal(true);
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
      
      // Refresh the entire bid data
      if (onDoorsChanged) {
        await onDoorsChanged();
      }
      
      // Keep the same active door tab after refresh
      if (onTabChange) {
        onTabChange(activeDoorId);
      }
    } catch (error) {
      console.error('Error duplicating door:', error);
      toast.error('Error duplicating door');
    } finally {
      setIsDuplicating(false);
    }
  };
  
  // Handle door deletion with robust error handling and user feedback
  const handleDeleteDoor = async () => {
    if (!doorToDelete || !bidId) {
      toast.error('Invalid door or bid data');
      return;
    }
    
    setIsDeleting(true);
    try {
      // Attempt to delete the door via API
      await deleteDoor(bidId, doorToDelete.id);
      
      // Show success notification
      toast.success(`Door #${doorToDelete.doorNumber} deleted successfully`);
      setShowDeleteModal(false);
      
      // Check if the active door was deleted
      const wasActiveDoorDeleted = activeDoorId === doorToDelete.id;
      
      // Refresh the entire bid data to get updated door listing
      if (onDoorsChanged) {
        await onDoorsChanged();
      }
      
      // If the active door was deleted, select another door if available
      if (wasActiveDoorDeleted && onTabChange) {
        // Look for any other door to select
        const remainingDoorIds = doors
          .filter(door => door.id !== doorToDelete.id)
          .map(door => door.id);
        
        if (remainingDoorIds.length > 0) {
          // Select the first available door
          onTabChange(remainingDoorIds[0]);
        } else {
          // No doors left, set to null
          onTabChange(null);
        }
      }
    } catch (error) {
      // Detailed error logging and user feedback
      console.error('Error deleting door:', error);
      
      // Check for specific error message from API
      let errorMessage = 'Failed to delete door';
      if (error.message) {
        // Extract meaningful error message if available
        if (error.message.includes('last door')) {
          errorMessage = 'Cannot delete the last door. A bid must have at least one door.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Function to get location from door object
  const getDoorLocation = (door) => {
    // First check if it's directly on the door object
    if (door.location) {
      return `(${door.location})`;
    }
    
    // Next, try to extract from the description if it exists
    if (door.description) {
      const match = door.description.match(/^(.*?)\s+\(Door #\d+\)$/);
      if (match && match[1]) {
        return `(${match[1]})`;
      }
    }
    
    // If we have line items, check them for location
    if (door.line_items) {
      for (const item of door.line_items) {
        if (item.description && item.description.toLowerCase().startsWith('location:')) {
          const location = item.description.split(':')[1].trim();
          return `(${location})`;
        }
      }
    }
    
    return '';
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
            <span>Door #{door.door_number} {getDoorLocation(door)}</span>
            <div className="door-tab-actions">
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
              <Button 
                variant="link" 
                size="sm" 
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteModal(door.id, door.door_number);
                }}
              >
                <FaTrash />
              </Button>
            </div>
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
      
      {/* Delete Door Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Delete Door</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete Door #{doorToDelete?.doorNumber}?</p>
          <p className="text-danger fw-bold">This action cannot be undone and will delete all line items for this door.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteDoor}
            disabled={isDeleting}
          >
            <FaTrash /> {isDeleting ? 'Deleting...' : 'Delete Door'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default DoorTabs;