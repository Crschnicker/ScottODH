import React, { useState } from 'react';
import { Button, InputGroup, FormControl, Modal } from 'react-bootstrap';
import { FaPlus, FaCopy, FaCheck } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { addDoor, duplicateDoor } from '../../services/bidService';
import './DoorTabs.css';

const DoorTabs = ({ doors, activeDoorId, onTabChange, onDoorsChanged, bidId }) => {
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
