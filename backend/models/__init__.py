# backend/models/__init__.py

from .base import db

# --- Correct Model Import Order ---
# This specific order is critical to prevent circular import and foreign key errors.

# 1. Foundational Models
from .user import User
from .customer import Customer, Site

# 2. Core Business Logic Models
from .estimate import Estimate
from .bid import Bid
from .door import Door
from .line_item import LineItem
from .job import Job
from .audio import AudioRecording  # Correctly imported from audio.py

# 3. Dependent and Association Models
from .door_media import DoorMedia
from .job import JobTimeTracking, JobSignature, DispatchAssignment, MobileJobLineItem, CompletedDoor

# The __all__ list is good practice for managing the namespace.
__all__ = [
    'db',
    'User',
    'Customer',
    'Site',
    'Estimate',
    'AudioRecording', # Added to the list
    'Bid',
    'Door',
    'LineItem',
    'Job',
    'JobTimeTracking',
    'JobSignature',
    'DispatchAssignment',
    'DoorMedia',
    'MobileJobLineItem',
    'CompletedDoor',
]