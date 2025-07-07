# backend/services/audio_service.py
import os
import json
import uuid
import tempfile
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

def transcribe_audio_file(file_path):
    """Transcribe an audio file using OpenAI Whisper"""
    try:
        # Set up the OpenAI client
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        
        logger.info(f"Processing audio file: {file_path}")
        file_size = os.path.getsize(file_path)
        file_ext = os.path.splitext(file_path)[1].lower()
        logger.info(f"File size: {file_size} bytes, extension: {file_ext}")
        
        # Convert the file to a supported format using pydub if possible
        try:
            from pydub import AudioSegment
            
            # Create a temporary WAV file (most compatible format)
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
            
            logger.info(f"Converting audio to WAV format: {temp_path}")
            sound = AudioSegment.from_file(file_path)
            sound.export(temp_path, format="wav")
            
            logger.info(f"Conversion successful. File size: {os.path.getsize(temp_path)} bytes")
            
            # Open the temporary WAV file for transcription
            with open(temp_path, "rb") as audio_file:
                logger.info(f"Sending file to OpenAI API for transcription")
                response = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file
                )
                
                transcript = response.text
                
                # Clean up the temporary file
                try:
                    os.remove(temp_path)
                except:
                    pass
                
                return transcript
                
        except ImportError:
            logger.info("pydub not available, trying direct transcription")
            # Fallback to direct transcription if pydub is not available
            with open(file_path, "rb") as audio_file:
                logger.info(f"Sending file directly to OpenAI API for transcription")
                response = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file
                )
                
                transcript = response.text
                return transcript
                
    except Exception as e:
        logger.error(f"Transcription error for file {file_path}: {str(e)}")
        raise

def process_audio_with_ai(transcript, recording_id):
    """Process an audio transcript with AI to extract door information"""
    try:
        # Increase timeout for client
        client = OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY"),
            timeout=120.0  # Increase timeout to 120 seconds
        )
        
        # More robust prompt for multiple doors
        prompt = f"""
        Analyze this transcript about door installations, repairs, or related work. Extract information about EACH door or door component mentioned.
        
        Transcript: {transcript}
        
        IMPORTANT: Create a SEPARATE JSON object for EACH door mentioned in the transcript. If multiple doors are described (e.g. "front door", "garage door", "kitchen door"), each should have its own object.
        
        Return a JSON array where each object represents a distinct door with these properties:
        - door_number (number, default to sequence number if not explicitly mentioned)
        - location (string, EXACT location mentioned like "Front door", "Kitchen door", "Garage bay 2", etc.)
        - dimensions (object with width, height, unit if mentioned)
        - type (string, like entry, garage, interior, etc.)
        - material (string)
        - components (array of strings - parts mentioned like tracks, springs, hardware, etc.)
        - labor_description (string - description of work being done)
        - notes (string - any other relevant details)
        
        Only include properties that are explicitly mentioned in the transcript.
        CRITICAL: Identify each distinct door as a separate object, even if door numbers aren't explicitly mentioned.
        """
        
        logger.info(f"Sending prompt to OpenAI with increased timeout")
        
        # Call the OpenAI API with increased timeout
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts structured information about door installations and repairs from audio transcripts. Always return valid JSON with an array of door objects. Each distinct door (by location or number) should be a separate object in the array."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
            timeout=90  # Set a 90 second timeout for the API call
        )
        
        # Extract and log the content
        content = response.choices[0].message.content
        logger.info(f"OpenAI response: {content}")
        
        # Parse the JSON response
        try:
            response_data = json.loads(content)
            
            # Handle different response formats to ensure we always have an array of doors
            doors_data = []
            
            if isinstance(response_data, dict):
                # Check if the response is a dict with an array
                for key, value in response_data.items():
                    if isinstance(value, list):
                        doors_data = value
                        break
                else:
                    # If no array found in the dict, check if it's a single door object
                    if 'door_number' in response_data or 'location' in response_data:
                        doors_data = [response_data]  # Convert single object to array
                    else:
                        # Create a generic door
                        doors_data = [{
                            "door_number": 1,
                            "location": "Unspecified location",
                            "labor_description": "Work described in recording",
                            "notes": transcript
                        }]
            elif isinstance(response_data, list):
                doors_data = response_data
            else:
                # Fallback for unexpected data
                doors_data = [{
                    "door_number": 1,
                    "location": "Unspecified location",
                    "labor_description": "Work described in recording",
                    "notes": transcript
                }]
                
            logger.info(f"Parsed doors_data: {doors_data}")
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            logger.error(f"Content that failed to parse: {content}")
            
            # Create a fallback structure
            doors_data = [{
                "door_number": 1,
                "location": "Error parsing transcript",
                "labor_description": "Door work described in recording",
                "notes": transcript
            }]
        
        # Process the doors data to match the frontend format
        doors = []
        for i, door_data in enumerate(doors_data):
            # Defensive programming - make sure door_data is a dict
            if not isinstance(door_data, dict):
                logger.warning(f"Expected dict but got {type(door_data)}: {door_data}")
                continue
                
            # Get door number from the data, or use index+1 as fallback
            door_number = door_data.get('door_number', i+1)
            
            # Create a list of details
            details = []
            
            # Add location if available
            location = door_data.get('location', f"Door {door_number}")
            if location:
                details.append(f"Location: {location}")
            
            # Add dimensions if available
            dimensions = door_data.get('dimensions')
            if dimensions and isinstance(dimensions, dict):
                width = dimensions.get('width')
                height = dimensions.get('height')
                unit = dimensions.get('unit', 'inches')
                if width and height:
                    details.append(f"Dimensions: {width} x {height} {unit}")
            
            # Add type if available, but only if different from location
            door_type = door_data.get('type')
            if door_type and ((not location) or door_type.lower() != location.lower()):
                details.append(f"Type: {door_type}")
            
            # Add material if available
            material = door_data.get('material')
            if material:
                details.append(f"Material: {material}")
            
            # Add components if available
            components = door_data.get('components', [])
            if components and isinstance(components, list):
                details.append(f"Components: {', '.join(components)}")
            
            # Add labor description if available
            labor_desc = door_data.get('labor_description')
            if labor_desc:
                details.append(f"Work Description: {labor_desc}")
            
            # Add notes if available
            notes = door_data.get('notes')
            if notes:
                details.append(f"Notes: {notes}")
            
            # Create the door object with location-based description
            description = f"Door #{door_number}"
            if location:
                description = f"{location} (Door #{door_number})"
                
            door = {
                'door_number': door_number,
                'description': description,
                'details': details,
                'id': str(uuid.uuid4())
            }
            
            doors.append(door)
        
        # If no doors were identified or all entries were invalid, create a generic one
        if not doors:
            doors = [{
                'door_number': 1,
                'description': f"Door work from recording {recording_id}",
                'details': [f"Work description: {transcript}"],
                'id': str(uuid.uuid4())
            }]
        
        return doors
        
    except Exception as e:
        logger.error(f"AI processing error: {str(e)}")
        
        # Always return a valid response even on error
        doors = [{
            'door_number': 1,
            'description': f"Door work from recording {recording_id}",
            'details': [f"Work description: {transcript}"],
            'id': str(uuid.uuid4())
        }]
        
        return doors