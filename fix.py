# database_migration.py
# Run this script to add the new door fields to your existing database

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import sqlite3
import os

def migrate_door_table():
    """
    Add new fields to the Door table for storing rich door information
    """
    
    # Path to your database
    db_path = 'scott_overhead_doors.db'
    
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found!")
        return False
    
    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if the new columns already exist
        cursor.execute("PRAGMA table_info(door)")
        columns = [column[1] for column in cursor.fetchall()]
        
        new_columns = [
            ('location', 'VARCHAR(200)'),
            ('door_type', 'VARCHAR(50)'),
            ('width', 'FLOAT'),
            ('height', 'FLOAT'),
            ('dimension_unit', 'VARCHAR(10)'),
            ('labor_description', 'TEXT'),
            ('notes', 'TEXT')
        ]
        
        # Add missing columns
        for column_name, column_type in new_columns:
            if column_name not in columns:
                alter_sql = f"ALTER TABLE door ADD COLUMN {column_name} {column_type}"
                print(f"Adding column: {column_name}")
                cursor.execute(alter_sql)
            else:
                print(f"Column {column_name} already exists")
        
        # Commit changes
        conn.commit()
        print("Database migration completed successfully!")
        
        # Verify the new columns
        cursor.execute("PRAGMA table_info(door)")
        columns_after = [column[1] for column in cursor.fetchall()]
        print(f"Door table columns after migration: {columns_after}")
        
        return True
        
    except Exception as e:
        print(f"Error during migration: {str(e)}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    migrate_door_table()