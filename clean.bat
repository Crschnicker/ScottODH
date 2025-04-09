@echo off
echo Git Repository Cleanup Script
echo.
echo This script will:
echo 1. Remove node_modules from Git tracking
echo 2. Configure proper line ending settings
echo 3. Re-add everything with proper gitignore handling
echo.
echo MAKE SURE YOU'VE BACKED UP ANY IMPORTANT CHANGES FIRST
echo.
pause

echo.
echo Step 1: Configuring Git line ending settings...
git config --global core.autocrlf true
echo Line ending settings configured.

echo.
echo Step 2: Removing node_modules from Git tracking...
git rm -r --cached "frontend/node_modules"
echo node_modules removed from tracking.

echo.
echo Step 3: Ensuring .gitignore is properly set up...
echo Checking if .gitignore exists in the project root...

if not exist ".gitignore" (
    echo Creating .gitignore file in the project root...
    (
        echo # dependencies
        echo /node_modules
        echo /frontend/node_modules
        echo /.pnp
        echo .pnp.js
        echo 
        echo # testing
        echo /coverage
        echo 
        echo # production
        echo /build
        echo /dist
        echo 
        echo # misc
        echo .DS_Store
        echo .env.local
        echo .env.development.local
        echo .env.test.local
        echo .env.production.local
        echo .env
        echo 
        echo npm-debug.log*
        echo yarn-debug.log*
        echo yarn-error.log*
        echo 
        echo # Python
        echo __pycache__/
        echo *.py[cod]
        echo *$py.class
        echo *.so
        echo .Python
        echo env/
        echo build/
        echo develop-eggs/
        echo dist/
        echo downloads/
        echo eggs/
        echo .eggs/
        echo lib/
        echo lib64/
        echo parts/
        echo sdist/
        echo var/
        echo wheels/
        echo *.egg-info/
        echo .installed.cfg
        echo *.egg
        echo 
        echo # Flask
        echo instance/
        echo .webassets-cache
        echo 
        echo # SQLite
        echo *.db
        echo *.sqlite3
        echo 
        echo # Virtual environment
        echo venv/
        echo .venv/
        echo ENV/
        echo 
        echo # IDE
        echo .idea/
        echo .vscode/
        echo *.swp
        echo *.swo
    ) > .gitignore
    echo .gitignore file created.
) else (
    echo .gitignore already exists.
)

echo.
echo Step 4: Re-adding all files with proper gitignore handling...
git add .
echo Files re-added.

echo.
echo Step 5: Ready to commit changes...
echo.
echo Run the following command when ready:
echo git commit -m "Fix node_modules tracking and line ending issues"
echo.
pause