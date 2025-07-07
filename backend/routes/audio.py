# backend/routes/audio.py
from flask import Blueprint, request, jsonify, send_from_directory
from flask_login import login_required
from datetime import datetime
from models import db, AudioRecording, Estimate
from services.audio_service import process_audio_with_ai, transcribe_audio_file
import logging
import os
import uuid

audio_bp = Blueprint('audio', __name__)
logger = logging.getLogger(__name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@audio_bp.route('/upload', methods=['POST'])
@login_required
def upload_audio():
    """Handle audio file uploads"""
    logger.info("Request received for audio upload")
    logger.info(f"Form data: {request.form}")
    logger.info(f"Files: {request.files}")
    
    if 'audio' not in request.files:
        logger.error("Error: No audio file found in request.files")
        return jsonify({'error': 'No audio file provided'}), 400
    
    audio_file = request.files['audio']
    estimate_id = request.form.get('estimate_id')
    
    logger.info(f"Audio file: {audio_file.filename}, Content Type: {audio_file.content_type}")
    
    # Check if the file is empty
    audio_file.seek(0, os.SEEK_END)
    file_length = audio_file.tell()
    audio_file.seek(0)
    
    logger.info(f"File size calculated: {file_length} bytes")
    
    if file_length == 0:
        return jsonify({'error': 'Audio file is empty. Please try recording again.'}), 400
    
    if not estimate_id:
        return jsonify({'error': 'Estimate ID is required'}), 400
    
    # Check if estimate exists
    estimate = Estimate.query.get(estimate_id)
    if not estimate:
        return jsonify({'error': 'Estimate not found'}), 404
    
    # Make sure the upload directory exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # Determine the correct file extension based on content type
    file_ext = 'wav'  # Default
    content_type = audio_file.content_type.lower()
    
    if 'mp4' in content_type or 'aac' in content_type or 'm4a' in content_type:
        file_ext = 'mp4'
    elif 'webm' in content_type:
        file_ext = 'webm'
    elif 'ogg' in content_type:
        file_ext = 'ogg'
    
    # Use the file extension from the original filename if it exists
    if audio_file.filename and '.' in audio_file.filename:
        original_ext = audio_file.filename.split('.')[-1].lower()
        if original_ext in ['mp4', 'm4a', 'aac', 'webm', 'ogg', 'wav']:
            file_ext = original_ext
    
    # Generate a filename with the correct extension
    filename = f"{uuid.uuid4()}.{file_ext}"
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    
    try:
        # Save the audio file
        audio_file.save(file_path)
        
        # Verify the file was saved and is not empty
        if os.path.getsize(file_path) < 100:
            os.remove(file_path)
            return jsonify({'error': 'Saved audio file is too small. Please try recording again.'}), 400
            
        logger.info(f"Audio file saved to {file_path} with size {os.path.getsize(file_path)} bytes")
        
        # Create a record in the database
        recording = AudioRecording(
            estimate_id=estimate_id,
            file_path=file_path,
            created_at=datetime.utcnow()
        )
        db.session.add(recording)
        db.session.commit()
        
        # Make the file_path relative to be used in URLs
        relative_path = file_path.replace('\\', '/')
        if not relative_path.startswith('/'):
            relative_path = '/' + relative_path
        
        return jsonify({
            'id': recording.id,
            'estimate_id': recording.estimate_id,
            'file_path': relative_path,
            'created_at': recording.created_at
        }), 201
        
    except Exception as e:
        logger.error(f"Error saving file: {str(e)}")
        return jsonify({'error': f'Error saving file: {str(e)}'}), 500

@audio_bp.route('/<int:recording_id>', methods=['GET'])
@login_required
def get_audio(recording_id):
    """Get audio recording information"""
    try:
        recording = AudioRecording.query.get_or_404(recording_id)
        
        return jsonify({
            'id': recording.id,
            'estimate_id': recording.estimate_id,
            'file_path': recording.file_path,
            'created_at': recording.created_at,
            'transcript': recording.transcript
        })
    except Exception as e:
        logger.error(f"Error retrieving audio recording {recording_id}: {str(e)}")
        return jsonify({'error': 'Failed to retrieve audio recording'}), 500

@audio_bp.route('/<int:recording_id>/delete', methods=['DELETE'])
@login_required
def delete_audio(recording_id):
    """Delete an audio recording"""
    try:
        recording = AudioRecording.query.get_or_404(recording_id)
        
        # Delete the file
        if os.path.exists(recording.file_path):
            os.remove(recording.file_path)
        
        # Delete the database record
        db.session.delete(recording)
        db.session.commit()
        
        return jsonify({'status': 'success', 'message': 'Recording deleted'}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting audio recording {recording_id}: {str(e)}")
        return jsonify({'error': 'Failed to delete recording'}), 500

@audio_bp.route('/<int:recording_id>/transcribe', methods=['POST'])
@login_required
def transcribe_audio(recording_id):
    """Transcribe an audio recording using OpenAI Whisper"""
    try:
        recording = AudioRecording.query.get_or_404(recording_id)
        
        if not os.path.exists(recording.file_path):
            return jsonify({'error': 'Audio file not found'}), 404
        
        # Use the audio service to transcribe
        transcript = transcribe_audio_file(recording.file_path)
        
        # Save transcript to database
        recording.transcript = transcript
        db.session.commit()
        
        return jsonify({
            'id': recording.id,
            'transcript': transcript
        }), 200
        
    except Exception as e:
        logger.error(f"Transcription error for recording {recording_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@audio_bp.route('/<int:recording_id>/process-with-ai', methods=['POST'])
@login_required
def process_audio_with_ai_endpoint(recording_id):
    """Process an audio transcript with AI to extract door information"""
    try:
        recording = AudioRecording.query.get_or_404(recording_id)
        
        if not recording.transcript:
            return jsonify({'error': 'No transcript available. Please transcribe the audio first.'}), 400
        
        # Use the audio service to process with AI
        doors = process_audio_with_ai(recording.transcript, recording_id)
        
        return jsonify({
            'recording_id': recording.id,
            'doors': doors
        }), 200
        
    except Exception as e:
        logger.error(f"AI processing error: {str(e)}")
        
        # Always return a valid response even on error
        doors = [{
            'door_number': 1,
            'description': f"Door work from recording {recording_id}",
            'details': [f"Work description: {recording.transcript}"],
            'id': str(uuid.uuid4())
        }]
        
        return jsonify({
            'recording_id': recording.id,
            'doors': doors,
            'error': str(e)
        }), 200

@audio_bp.route('/estimate/<int:estimate_id>/recordings', methods=['GET'])
@login_required
def get_recordings(estimate_id):
    """Get all recordings for an estimate"""
    try:
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
    except Exception as e:
        logger.error(f"Error retrieving recordings for estimate {estimate_id}: {str(e)}")
        return jsonify({'error': 'Failed to retrieve recordings'}), 500

# Serve uploaded files
@audio_bp.route('/uploads/<path:filename>', methods=['GET'])
@login_required
def serve_audio(filename):
    """Serve uploaded audio files"""
    try:
        return send_from_directory(UPLOAD_FOLDER, filename)
    except Exception as e:
        logger.error(f"Error serving audio file {filename}: {str(e)}")
        return jsonify({'error': 'File not found'}), 404