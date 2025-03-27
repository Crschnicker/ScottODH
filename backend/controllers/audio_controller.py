
from flask import Blueprint, request, jsonify, current_app
import os
import uuid
import json
from datetime import datetime
import speech_recognition as sr
from pydub import AudioSegment
import tempfile
import re
from models.models import db, AudioRecording, Estimate, Door, LineItem

audio_bp = Blueprint('audio', __name__)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@audio_bp.route('/upload', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    
    audio_file = request.files['audio']
    estimate_id = request.form.get('estimate_id')
    
    if not estimate_id:
        return jsonify({'error': 'Estimate ID is required'}), 400
    
    # Check if estimate exists
    estimate = Estimate.query.get(estimate_id)
    if not estimate:
        return jsonify({'error': 'Estimate not found'}), 404
    
    # Generate a filename and save the audio file
    filename = f"{uuid.uuid4()}.wav"
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    audio_file.save(file_path)
    
    # Create a record in the database
    recording = AudioRecording(
        estimate_id=estimate_id,
        file_path=file_path,
        created_at=datetime.utcnow()
    )
    db.session.add(recording)
    db.session.commit()
    
    return jsonify({
        'id': recording.id,
        'estimate_id': recording.estimate_id,
        'file_path': recording.file_path,
        'created_at': recording.created_at
    }), 201

@audio_bp.route('/<int:recording_id>', methods=['GET'])
def get_audio(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    return jsonify({
        'id': recording.id,
        'estimate_id': recording.estimate_id,
        'file_path': recording.file_path,
        'created_at': recording.created_at,
        'transcript': recording.transcript
    })

@audio_bp.route('/<int:recording_id>/delete', methods=['DELETE'])
def delete_audio(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    # Delete the file
    if os.path.exists(recording.file_path):
        os.remove(recording.file_path)
    
    # Delete the database record
    db.session.delete(recording)
    db.session.commit()
    
    return jsonify({'status': 'success', 'message': 'Recording deleted'}), 200

@audio_bp.route('/<int:recording_id>/transcribe', methods=['POST'])
def transcribe_audio(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    if not os.path.exists(recording.file_path):
        return jsonify({'error': 'Audio file not found'}), 404
    
    try:
        # Convert audio to format supported by speech recognition if needed
        audio = AudioSegment.from_file(recording.file_path)
        
        # Save as WAV for speech recognition
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
            audio.export(temp_path, format="wav")
        
        # Use speech recognition
        recognizer = sr.Recognizer()
        with sr.AudioFile(temp_path) as source:
            audio_data = recognizer.record(source)
            transcript = recognizer.recognize_google(audio_data)
        
        # Clean up temp file
        os.unlink(temp_path)
        
        # Save transcript to database
        recording.transcript = transcript
        db.session.commit()
        
        return jsonify({
            'id': recording.id,
            'transcript': transcript
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@audio_bp.route('/<int:recording_id>/process', methods=['POST'])
def process_audio(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    if not recording.transcript:
        return jsonify({'error': 'No transcript available. Please transcribe the audio first.'}), 400
    
    try:
        # Process the transcript to identify doors and details
        doors = extract_doors_from_transcript(recording.transcript)
        
        # Save doors to the estimate
        saved_doors = []
        for door in doors:
            door_obj = Door(
                estimate_id=recording.estimate_id,
                door_number=door['door_number'],
                description=door.get('description', '')
            )
            db.session.add(door_obj)
            db.session.flush()  # Get door ID
            
            # Add door details as line items
            for detail in door.get('details', []):
                line_item = LineItem(
                    door_id=door_obj.id,
                    description=detail
                )
                db.session.add(line_item)
            
            saved_doors.append({
                'id': door_obj.id,
                'door_number': door_obj.door_number,
                'description': door_obj.description,
                'details': door.get('details', [])
            })
        
        db.session.commit()
        
        return jsonify({
            'recording_id': recording.id,
            'doors': saved_doors
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def extract_doors_from_transcript(transcript):
    # Simple regex-based extraction of door information
    # This is a basic implementation - a more sophisticated NLP approach might be better
    doors = []
    
    # Look for door mentions (e.g., "Door 1", "Door number 2", etc.)
    door_mentions = re.finditer(r'door(?:\s+number|\s+#)?\s+(\d+)', transcript, re.IGNORECASE)
    
    last_pos = 0
    for match in door_mentions:
        door_number = int(match.group(1))
        start_pos = match.start()
        
        # Find the next door mention or end of text
        next_match = re.search(r'door(?:\s+number|\s+#)?\s+\d+', transcript[start_pos+1:], re.IGNORECASE)
        end_pos = start_pos + 1 + next_match.start() if next_match else len(transcript)
        
        # Extract the text specific to this door
        door_text = transcript[start_pos:end_pos].strip()
        
        # Extract details about the door
        details = []
        # Look for dimensions
        dim_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:by|x)\s*(\d+(?:\.\d+)?)', door_text)
        if dim_match:
            width, height = dim_match.groups()
            details.append(f"Dimensions: {width} x {height}")
        
        # Look for common door specifications
        specs = [
            (r'steel', "Material: Steel"),
            (r'aluminum', "Material: Aluminum"),
            (r'wood', "Material: Wood"),
            (r'insulated', "Feature: Insulated"),
            (r'windows', "Feature: Windows"),
            (r'opener', "Accessory: Opener"),
            (r'remote', "Accessory: Remote"),
            (r'keypad', "Accessory: Keypad")
        ]
        
        for pattern, label in specs:
            if re.search(pattern, door_text, re.IGNORECASE):
                details.append(label)
        
        # Add any remaining text as general description
        description = door_text.replace(f"Door {door_number}", "").strip()
        
        doors.append({
            'door_number': door_number,
            'description': description,
            'details': details
        })
        
        last_pos = end_pos
    
    return doors

@audio_bp.route('/estimate/<int:estimate_id>/recordings', methods=['GET'])
def get_recordings(estimate_id):
    recordings = AudioRecording.query.filter_by(estimate_id=estimate_id).all()
    
    result = []
    for recording in recordings:
        result.append({
            'id': recording.id,
            'file_path': recording.file_path,
            'created_at': recording.created_at,
            'transcript': recording.transcript
        })
    
    return jsonify(result)
