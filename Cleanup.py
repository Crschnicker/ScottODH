#!/usr/bin/env python3
"""
Scott Overhead Doors - Azure Migration Cleanup Script
Removes duplicate files, consolidates uploads, and prepares for Azure deployment
"""

import os
import shutil
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def cleanup_project():
    """Clean up the project structure for Azure migration"""
    
    logger.info("🧹 Starting Scott Overhead Doors project cleanup...")
    
    # Get project root directory
    project_root = Path(__file__).parent
    
    # 1. Consolidate upload directories
    logger.info("📁 Consolidating upload directories...")
    
    # Move all uploads to backend/uploads and remove root uploads
    backend_uploads = project_root / "backend" / "uploads"
    root_uploads = project_root / "uploads"
    
    if root_uploads.exists():
        logger.info(f"Moving files from {root_uploads} to {backend_uploads}")
        
        # Ensure backend uploads directory exists
        backend_uploads.mkdir(exist_ok=True)
        
        # Move audio files to backend/uploads/audio
        audio_dir = backend_uploads / "audio"
        audio_dir.mkdir(exist_ok=True)
        
        for file in root_uploads.glob("*.wav"):
            dest = audio_dir / file.name
            if not dest.exists():
                shutil.move(str(file), str(dest))
                logger.info(f"Moved audio file: {file.name}")
        
        for file in root_uploads.glob("*.m4a"):
            dest = audio_dir / file.name
            if not dest.exists():
                shutil.move(str(file), str(dest))
                logger.info(f"Moved audio file: {file.name}")
        
        # Remove empty root uploads directory
        try:
            root_uploads.rmdir()
            logger.info("Removed empty root uploads directory")
        except OSError:
            logger.warning("Root uploads directory not empty, keeping it")
    
    # 2. Clean up development files
    logger.info("🗑️ Removing development and temporary files...")
    
    files_to_remove = [
        "date_handling.log",
        "backend/date_handling.log",
        ".deployment",
        "azure-deployment.yml",  # We'll create a new one
        "docker-compose.dev.yml",  # Not needed for Azure
    ]
    
    for file_path in files_to_remove:
        full_path = project_root / file_path
        if full_path.exists():
            full_path.unlink()
            logger.info(f"Removed: {file_path}")
    
    # 3. Clean up old database files
    logger.info("🗄️ Cleaning up old database files...")
    
    db_files = [
        "instance/app.db",
        "instance/scott_overhead_doors.db", 
        "backend/instance/scott_overhead_doors old.db"
    ]
    
    for db_file in db_files:
        full_path = project_root / db_file
        if full_path.exists():
            # Create backup before removing
            backup_path = full_path.with_suffix('.backup')
            shutil.copy2(full_path, backup_path)
            logger.info(f"Backed up {db_file} to {backup_path}")
            # Note: Don't delete active DB files, just notify
            logger.info(f"Database file exists: {db_file} (keeping for data migration)")
    
    # 4. Clean up ngrok directory (not needed for Azure)
    ngrok_dir = project_root / "ngrok"
    if ngrok_dir.exists():
        logger.info("Removing ngrok directory (not needed for Azure)")
        shutil.rmtree(ngrok_dir)
    
    # 5. Create .gitignore for Azure deployment
    gitignore_content = """
# Azure deployment
.azure/
*.publish

# Environment variables
.env
.env.local
.env.production

# Database
*.db
*.db-journal

# Uploads (will be moved to Azure Blob Storage)
backend/uploads/
backend/mobile_uploads/
uploads/

# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
ENV/

# Node
node_modules/
npm-debug.log*
build/

# IDE
.vscode/
.idea/
*.swp
*.swo

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db
"""
    
    gitignore_path = project_root / ".gitignore"
    with open(gitignore_path, 'w') as f:
        f.write(gitignore_content.strip())
    logger.info("Created/updated .gitignore for Azure deployment")
    
    # 6. Create directory structure summary
    logger.info("📋 Creating project structure summary...")
    
    def create_tree(directory, prefix="", max_depth=3, current_depth=0):
        """Create a tree structure of the directory"""
        if current_depth >= max_depth:
            return ""
        
        items = []
        try:
            for item in sorted(directory.iterdir()):
                if item.name.startswith('.'):
                    continue
                if item.name in ['__pycache__', 'node_modules', '.git']:
                    continue
                    
                items.append(item)
        except PermissionError:
            return ""
        
        tree = ""
        for i, item in enumerate(items):
            is_last = i == len(items) - 1
            current_prefix = "└── " if is_last else "├── "
            tree += f"{prefix}{current_prefix}{item.name}\n"
            
            if item.is_dir() and current_depth < max_depth - 1:
                extension = "    " if is_last else "│   "
                tree += create_tree(item, prefix + extension, max_depth, current_depth + 1)
        
        return tree
    
    tree_structure = f"Scott Overhead Doors - Cleaned Project Structure\n"
    tree_structure += "=" * 50 + "\n"
    tree_structure += create_tree(project_root)
    
    with open(project_root / "PROJECT_STRUCTURE.txt", 'w', encoding='utf-8') as f:
        f.write(tree_structure)
    
    logger.info("✅ Project cleanup completed!")
    logger.info("📁 Created PROJECT_STRUCTURE.txt with clean directory tree")
    logger.info("🚀 Ready for Azure migration!")
    
    return True

if __name__ == "__main__":
    try:
        cleanup_project()
        print("\n🎉 Cleanup successful! Next steps:")
        print("1. Review the cleaned project structure")
        print("2. Set up Azure PostgreSQL database")
        print("3. Configure Azure Blob Storage")
        print("4. Update application configuration")
        print("5. Deploy to Azure App Service")
    except Exception as e:
        logger.error(f"❌ Cleanup failed: {e}")
        exit(1)