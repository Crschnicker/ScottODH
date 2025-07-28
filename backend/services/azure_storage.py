# backend/services/azure_storage.py
# Azure Blob Storage service for Scott Overhead Doors file management

import os
import logging
from typing import Optional, List, Tuple
from uuid import uuid4
from datetime import datetime, timedelta
from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient
from azure.core.exceptions import ResourceNotFoundError, AzureError
from werkzeug.utils import secure_filename
from PIL import Image
import io

logger = logging.getLogger(__name__)

class AzureStorageService:
    """Azure Blob Storage service for file uploads and management"""
    
    def __init__(self):
        """Initialize Azure Blob Storage client"""
        self.connection_string = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
        self.container_name = os.environ.get('AZURE_STORAGE_CONTAINER_NAME', 'uploads')
        
        if not self.connection_string:
            logger.warning("Azure Storage connection string not configured - using local storage fallback")
            self.blob_service_client = None
            self.container_client = None
            self.use_azure = False
        else:
            try:
                self.blob_service_client = BlobServiceClient.from_connection_string(self.connection_string)
                self.container_client = self.blob_service_client.get_container_client(self.container_name)
                self.use_azure = True
                self._ensure_container_exists()
                logger.info(f"Azure Blob Storage initialized - Container: {self.container_name}")
            except Exception as e:
                logger.error(f"Failed to initialize Azure Storage: {e}")
                self.blob_service_client = None
                self.container_client = None
                self.use_azure = False
    
    def _ensure_container_exists(self):
        """Ensure the storage container exists"""
        try:
            self.container_client.get_container_properties()
        except ResourceNotFoundError:
            try:
                self.container_client.create_container()
                logger.info(f"Created container: {self.container_name}")
            except Exception as e:
                logger.error(f"Failed to create container {self.container_name}: {e}")
                raise
    
    def _get_blob_name(self, folder: str, filename: str) -> str:
        """Generate a unique blob name with folder structure"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid4())[:8]
        secure_name = secure_filename(filename)
        
        # Remove extension and add timestamp/id
        name_parts = secure_name.rsplit('.', 1)
        if len(name_parts) == 2:
            name, ext = name_parts
            blob_name = f"{folder}/{name}_{timestamp}_{unique_id}.{ext}"
        else:
            blob_name = f"{folder}/{secure_name}_{timestamp}_{unique_id}"
        
        return blob_name
    
    def upload_file(self, file_content: bytes, filename: str, folder: str = "general") -> Tuple[bool, str, Optional[str]]:
        """
        Upload a file to Azure Blob Storage or local fallback
        
        Args:
            file_content: The file content as bytes
            filename: Original filename
            folder: Folder/prefix for organization
            
        Returns:
            Tuple of (success, message, file_url)
        """
        try:
            if self.use_azure:
                return self._upload_to_azure(file_content, filename, folder)
            else:
                return self._upload_to_local(file_content, filename, folder)
        except Exception as e:
            logger.error(f"File upload failed: {e}")
            return False, f"Upload failed: {str(e)}", None
    
    def _upload_to_azure(self, file_content: bytes, filename: str, folder: str) -> Tuple[bool, str, Optional[str]]:
        """Upload file to Azure Blob Storage"""
        blob_name = self._get_blob_name(folder, filename)
        
        try:
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name, 
                blob=blob_name
            )
            
            # Set content type based on file extension
            content_type = self._get_content_type(filename)
            
            blob_client.upload_blob(
                file_content,
                content_type=content_type,
                overwrite=True,
                metadata={
                    'original_filename': filename,
                    'upload_timestamp': datetime.utcnow().isoformat(),
                    'folder': folder
                }
            )
            
            # Generate the blob URL
            blob_url = blob_client.url
            
            logger.info(f"Successfully uploaded to Azure: {blob_name}")
            return True, f"File uploaded successfully", blob_url
            
        except AzureError as e:
            logger.error(f"Azure upload failed: {e}")
            return False, f"Azure upload failed: {str(e)}", None
    
    def _upload_to_local(self, file_content: bytes, filename: str, folder: str) -> Tuple[bool, str, Optional[str]]:
        """Fallback to local file storage"""
        local_folder = os.path.join("uploads", folder)
        os.makedirs(local_folder, exist_ok=True)
        
        blob_name = self._get_blob_name(folder, filename)
        local_path = os.path.join("uploads", blob_name)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        with open(local_path, 'wb') as f:
            f.write(file_content)
        
        # Generate local URL (relative path)
        file_url = f"/uploads/{blob_name}"
        
        logger.info(f"Successfully uploaded locally: {local_path}")
        return True, "File uploaded successfully (local storage)", file_url
    
    def upload_image_with_thumbnail(self, image_content: bytes, filename: str, folder: str = "photos") -> Tuple[bool, str, Optional[str], Optional[str]]:
        """
        Upload an image and create a thumbnail
        
        Returns:
            Tuple of (success, message, image_url, thumbnail_url)
        """
        try:
            # Upload original image
            success, message, image_url = self.upload_file(image_content, filename, folder)
            
            if not success:
                return False, message, None, None
            
            # Create thumbnail
            thumbnail_content = self._create_thumbnail(image_content)
            if thumbnail_content:
                # Upload thumbnail with thumb_ prefix
                thumb_filename = f"thumb_{filename}"
                thumb_success, thumb_message, thumb_url = self.upload_file(
                    thumbnail_content, thumb_filename, f"{folder}/thumbnails"
                )
                
                if thumb_success:
                    return True, "Image and thumbnail uploaded successfully", image_url, thumb_url
                else:
                    logger.warning(f"Thumbnail upload failed: {thumb_message}")
                    return True, "Image uploaded, thumbnail failed", image_url, None
            else:
                return True, "Image uploaded, thumbnail creation failed", image_url, None
                
        except Exception as e:
            logger.error(f"Image upload failed: {e}")
            return False, f"Image upload failed: {str(e)}", None, None
    
    def _create_thumbnail(self, image_content: bytes, size: Tuple[int, int] = (150, 150)) -> Optional[bytes]:
        """Create a thumbnail from image content"""
        try:
            with Image.open(io.BytesIO(image_content)) as img:
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                
                # Create thumbnail
                img.thumbnail(size, Image.Resampling.LANCZOS)
                
                # Save to bytes
                output = io.BytesIO()
                img.save(output, format='JPEG', quality=85, optimize=True)
                output.seek(0)
                
                return output.read()
                
        except Exception as e:
            logger.error(f"Thumbnail creation failed: {e}")
            return None
    
    def delete_file(self, file_url: str) -> Tuple[bool, str]:
        """Delete a file from storage"""
        try:
            if self.use_azure and file_url.startswith('https://'):
                return self._delete_from_azure(file_url)
            else:
                return self._delete_from_local(file_url)
        except Exception as e:
            logger.error(f"File deletion failed: {e}")
            return False, f"Deletion failed: {str(e)}"
    
    def _delete_from_azure(self, blob_url: str) -> Tuple[bool, str]:
        """Delete file from Azure Blob Storage"""
        try:
            # Extract blob name from URL
            blob_name = blob_url.split(f'{self.container_name}/')[-1]
            
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name,
                blob=blob_name
            )
            
            blob_client.delete_blob()
            logger.info(f"Deleted from Azure: {blob_name}")
            return True, "File deleted successfully"
            
        except ResourceNotFoundError:
            return True, "File not found (already deleted)"
        except AzureError as e:
            logger.error(f"Azure deletion failed: {e}")
            return False, f"Azure deletion failed: {str(e)}"
    
    def _delete_from_local(self, file_path: str) -> Tuple[bool, str]:
        """Delete file from local storage"""
        try:
            # Convert URL path to local file path
            if file_path.startswith('/uploads/'):
                local_path = file_path[1:]  # Remove leading slash
            else:
                local_path = file_path
            
            if os.path.exists(local_path):
                os.remove(local_path)
                logger.info(f"Deleted local file: {local_path}")
                return True, "File deleted successfully"
            else:
                return True, "File not found (already deleted)"
                
        except Exception as e:
            logger.error(f"Local deletion failed: {e}")
            return False, f"Local deletion failed: {str(e)}"
    
    def list_files(self, folder: str = None, limit: int = 100) -> List[dict]:
        """List files in storage"""
        try:
            if self.use_azure:
                return self._list_azure_files(folder, limit)
            else:
                return self._list_local_files(folder, limit)
        except Exception as e:
            logger.error(f"File listing failed: {e}")
            return []
    
    def _list_azure_files(self, folder: str = None, limit: int = 100) -> List[dict]:
        """List files in Azure Blob Storage"""
        files = []
        try:
            name_starts_with = folder if folder else None
            
            blobs = self.container_client.list_blobs(
                name_starts_with=name_starts_with,
                include=['metadata']
            )
            
            for i, blob in enumerate(blobs):
                if i >= limit:
                    break
                    
                files.append({
                    'name': blob.name,
                    'url': f"https://{self.blob_service_client.account_name}.blob.core.windows.net/{self.container_name}/{blob.name}",
                    'size': blob.size,
                    'created': blob.creation_time.isoformat() if blob.creation_time else None,
                    'modified': blob.last_modified.isoformat() if blob.last_modified else None,
                    'metadata': blob.metadata or {}
                })
                
        except Exception as e:
            logger.error(f"Azure file listing failed: {e}")
            
        return files
    
    def _list_local_files(self, folder: str = None, limit: int = 100) -> List[dict]:
        """List files in local storage"""
        files = []
        try:
            base_path = os.path.join("uploads", folder) if folder else "uploads"
            
            if not os.path.exists(base_path):
                return files
            
            count = 0
            for root, dirs, filenames in os.walk(base_path):
                for filename in filenames:
                    if count >= limit:
                        break
                        
                    file_path = os.path.join(root, filename)
                    rel_path = os.path.relpath(file_path, "uploads")
                    
                    stat = os.stat(file_path)
                    
                    files.append({
                        'name': rel_path,
                        'url': f"/uploads/{rel_path.replace(os.sep, '/')}",
                        'size': stat.st_size,
                        'created': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        'metadata': {}
                    })
                    
                    count += 1
                    
        except Exception as e:
            logger.error(f"Local file listing failed: {e}")
            
        return files
    
    def _get_content_type(self, filename: str) -> str:
        """Get content type based on file extension"""
        ext = filename.lower().split('.')[-1]
        
        content_types = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'webm': 'video/webm',
            'mp4': 'video/mp4',
            'avi': 'video/avi',
            'mov': 'video/quicktime',
            'wav': 'audio/wav',
            'm4a': 'audio/mp4',
            'mp3': 'audio/mpeg',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain'
        }
        
        return content_types.get(ext, 'application/octet-stream')
    
    def get_signed_url(self, blob_name: str, expiry_hours: int = 24) -> Optional[str]:
        """Generate a signed URL for temporary access (Azure only)"""
        if not self.use_azure:
            return None
            
        try:
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name,
                blob=blob_name
            )
            
            # Generate SAS token for temporary access
            from azure.storage.blob import generate_blob_sas, BlobSasPermissions
            
            sas_token = generate_blob_sas(
                account_name=self.blob_service_client.account_name,
                container_name=self.container_name,
                blob_name=blob_name,
                account_key=self.blob_service_client.credential.account_key,
                permission=BlobSasPermissions(read=True),
                expiry=datetime.utcnow() + timedelta(hours=expiry_hours)
            )
            
            return f"{blob_client.url}?{sas_token}"
            
        except Exception as e:
            logger.error(f"Signed URL generation failed: {e}")
            return None

# Global instance
azure_storage = AzureStorageService()

# Convenience functions for easy import
def upload_file(file_content: bytes, filename: str, folder: str = "general") -> Tuple[bool, str, Optional[str]]:
    """Upload a file to storage"""
    return azure_storage.upload_file(file_content, filename, folder)

def upload_image(image_content: bytes, filename: str, folder: str = "photos") -> Tuple[bool, str, Optional[str], Optional[str]]:
    """Upload an image with thumbnail"""
    return azure_storage.upload_image_with_thumbnail(image_content, filename, folder)

def delete_file(file_url: str) -> Tuple[bool, str]:
    """Delete a file from storage"""
    return azure_storage.delete_file(file_url)

def list_files(folder: str = None, limit: int = 100) -> List[dict]:
    """List files in storage"""
    return azure_storage.list_files(folder, limit)