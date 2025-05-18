"""
Database Migration Script - Add scheduling fields to Estimate model
Run this with Flask-Migrate or execute directly on your database

Usage:
1. If using Flask-Migrate:
   - Create migration: flask db migrate -m "Add scheduling fields to estimates"
   - Apply migration: flask db upgrade

2. If executing directly (SQLite):
   - Open your database: sqlite3 scott_overhead_doors.db
   - Execute these commands
"""

# SQLite script to add new columns
ALTER TABLE estimate ADD COLUMN scheduled_date DATETIME;
ALTER TABLE estimate ADD COLUMN estimator_id INTEGER DEFAULT 1;
ALTER TABLE estimate ADD COLUMN estimator_name VARCHAR(50) DEFAULT 'Brett';
ALTER TABLE estimate ADD COLUMN duration INTEGER DEFAULT 60;
ALTER TABLE estimate ADD COLUMN schedule_notes TEXT;