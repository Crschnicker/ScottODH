#!/bin/bash
# Azure Resources Setup Script for Scott Overhead Doors
# Creates all necessary Azure resources for the application

set -e  # Exit on any error

# Configuration - Update these values
RESOURCE_GROUP="scott-overhead-doors-rg"
LOCATION="eastus"
APP_NAME="scott-overhead-doors"
DB_SERVER_NAME="scott-overhead-doors-db"
STORAGE_ACCOUNT_NAME="scottoverheaddoorsstore"
STATIC_WEB_APP_NAME="scott-overhead-doors-frontend"

# Database configuration
DB_ADMIN_USER="scottadmin"
DB_NAME="scott_overhead_doors"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Azure CLI is installed and logged in
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed. Please install it first:"
        echo "https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    
    # Check if logged in to Azure
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure. Please run 'az login' first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to create resource group
create_resource_group() {
    print_status "Creating resource group: $RESOURCE_GROUP"
    
    if az group show --name $RESOURCE_GROUP &> /dev/null; then
        print_warning "Resource group $RESOURCE_GROUP already exists"
    else
        az group create --name $RESOURCE_GROUP --location $LOCATION
        print_success "Resource group created: $RESOURCE_GROUP"
    fi
}

# Function to create PostgreSQL database
create_postgresql_database() {
    print_status "Creating PostgreSQL database server: $DB_SERVER_NAME"
    
    # Check if server already exists
    if az postgres flexible-server show --resource-group $RESOURCE_GROUP --name $DB_SERVER_NAME &> /dev/null; then
        print_warning "PostgreSQL server $DB_SERVER_NAME already exists"
    else
        # Prompt for database password
        echo -n "Enter password for database admin user ($DB_ADMIN_USER): "
        read -s DB_ADMIN_PASSWORD
        echo
        
        if [ -z "$DB_ADMIN_PASSWORD" ]; then
            print_error "Database password cannot be empty"
            exit 1
        fi
        
        az postgres flexible-server create \
            --resource-group $RESOURCE_GROUP \
            --name $DB_SERVER_NAME \
            --location $LOCATION \
            --admin-user $DB_ADMIN_USER \
            --admin-password "$DB_ADMIN_PASSWORD" \
            --sku-name Standard_B1ms \
            --tier Burstable \
            --storage-size 32 \
            --version 14 \
            --yes
        
        print_success "PostgreSQL server created: $DB_SERVER_NAME"
    fi
    
    # Configure firewall rules
    print_status "Configuring database firewall rules..."
    
    # Allow Azure services
    az postgres flexible-server firewall-rule create \
        --resource-group $RESOURCE_GROUP \
        --name $DB_SERVER_NAME \
        --rule-name AllowAzureServices \
        --start-ip-address 0.0.0.0 \
        --end-ip-address 0.0.0.0 \
        || print_warning "Firewall rule may already exist"
    
    # Allow your current IP
    CURRENT_IP=$(curl -s ifconfig.me)
    az postgres flexible-server firewall-rule create \
        --resource-group $RESOURCE_GROUP \
        --name $DB_SERVER_NAME \
        --rule-name AllowCurrentIP \
        --start-ip-address $CURRENT_IP \
        --end-ip-address $CURRENT_IP \
        || print_warning "Current IP firewall rule may already exist"
    
    print_success "Database firewall configured"
    
    # Create application database
    print_status "Creating application database: $DB_NAME"
    
    # Get connection string
    DB_HOST="${DB_SERVER_NAME}.postgres.database.azure.com"
    
    # Install PostgreSQL client if not available
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL client not found. Please install it to create the database:"
        echo "Ubuntu/Debian: sudo apt-get install postgresql-client"
        echo "macOS: brew install postgresql"
        echo "Then manually create database: CREATE DATABASE $DB_NAME;"
    else
        # Create database
        echo "Creating database $DB_NAME..."
        PGPASSWORD="$DB_ADMIN_PASSWORD" psql \
            -h $DB_HOST \
            -U $DB_ADMIN_USER \
            -d postgres \
            -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || print_warning "Database may already exist"
    fi
    
    # Output connection string
    echo ""
    print_success "Database setup complete!"
    echo "Connection string:"
    echo "postgresql://$DB_ADMIN_USER:YOUR_PASSWORD@$DB_HOST:5432/$DB_NAME"
}

# Function to create storage account
create_storage_account() {
    print_status "Creating storage account: $STORAGE_ACCOUNT_NAME"
    
    if az storage account show --name $STORAGE_ACCOUNT_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "Storage account $STORAGE_ACCOUNT_NAME already exists"
    else
        az storage account create \
            --name $STORAGE_ACCOUNT_NAME \
            --resource-group $RESOURCE_GROUP \
            --location $LOCATION \
            --sku Standard_LRS \
            --kind StorageV2 \
            --access-tier Hot
        
        print_success "Storage account created: $STORAGE_ACCOUNT_NAME"
    fi
    
    # Create blob container
    print_status "Creating blob container: uploads"
    
    az storage container create \
        --name uploads \
        --account-name $STORAGE_ACCOUNT_NAME \
        --public-access off \
        || print_warning "Container may already exist"
    
    # Get connection string
    STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
        --name $STORAGE_ACCOUNT_NAME \
        --resource-group $RESOURCE_GROUP \
        --query connectionString -o tsv)
    
    print_success "Storage account setup complete!"
    echo "Connection string (save this for your app settings):"
    echo "$STORAGE_CONNECTION_STRING"
}

# Function to create App Service
create_app_service() {
    print_status "Creating App Service: $APP_NAME"
    
    # Create App Service Plan
    PLAN_NAME="${APP_NAME}-plan"
    
    if az appservice plan show --name $PLAN_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "App Service Plan $PLAN_NAME already exists"
    else
        az appservice plan create \
            --name $PLAN_NAME \
            --resource-group $RESOURCE_GROUP \
            --location $LOCATION \
            --sku B1 \
            --is-linux
        
        print_success "App Service Plan created: $PLAN_NAME"
    fi
    
    # Create Web App
    if az webapp show --name $APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "Web App $APP_NAME already exists"
    else
        az webapp create \
            --name $APP_NAME \
            --resource-group $RESOURCE_GROUP \
            --plan $PLAN_NAME \
            --runtime "PYTHON|3.11"
        
        print_success "Web App created: $APP_NAME"
    fi
    
    # Configure app settings
    print_status "Configuring App Service settings..."
    
    az webapp config appsettings set \
        --name $APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --settings \
            FLASK_ENV=production \
            FLASK_APP=app.py \
            SCM_DO_BUILD_DURING_DEPLOYMENT=true \
            ENABLE_ORYX_BUILD=true \
            POST_BUILD_SCRIPT_PATH=scripts/post-build.sh
    
    print_success "App Service configured"
    
    echo ""
    print_success "App Service setup complete!"
    echo "URL: https://$APP_NAME.azurewebsites.net"
}

# Function to create Static Web App
create_static_web_app() {
    print_status "Creating Static Web App: $STATIC_WEB_APP_NAME"
    
    if az staticwebapp show --name $STATIC_WEB_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "Static Web App $STATIC_WEB_APP_NAME already exists"
    else
        az staticwebapp create \
            --name $STATIC_WEB_APP_NAME \
            --resource-group $RESOURCE_GROUP \
            --location "eastus2" \
            --source "https://github.com/YOUR_USERNAME/YOUR_REPO" \
            --branch main \
            --app-location "frontend" \
            --output-location "build"
        
        print_success "Static Web App created: $STATIC_WEB_APP_NAME"
    fi
    
    # Get the default hostname
    DEFAULT_HOSTNAME=$(az staticwebapp show \
        --name $STATIC_WEB_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --query defaultHostname -o tsv)
    
    print_success "Static Web App setup complete!"
    echo "URL: https://$DEFAULT_HOSTNAME"
}

# Function to generate environment variables file
generate_env_file() {
    print_status "Generating environment variables file..."
    
    # Get connection strings
    DB_CONNECTION_STRING="postgresql://$DB_ADMIN_USER:YOUR_DB_PASSWORD@${DB_SERVER_NAME}.postgres.database.azure.com:5432/$DB_NAME"
    
    STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
        --name $STORAGE_ACCOUNT_NAME \
        --resource-group $RESOURCE_GROUP \
        --query connectionString -o tsv)
    
    # Generate a secret key
    SECRET_KEY=$(openssl rand -base64 32)
    
    cat > .env.azure << EOF
# Azure Environment Variables for Scott Overhead Doors
# Copy these to your Azure App Service Configuration

# Flask Configuration
SECRET_KEY=$SECRET_KEY
FLASK_ENV=production
FLASK_APP=app.py

# Database Configuration
DATABASE_URL=$DB_CONNECTION_STRING

# Azure Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CONNECTION_STRING
AZURE_STORAGE_CONTAINER_NAME=uploads

# Azure Resource Information
AZURE_RESOURCE_GROUP=$RESOURCE_GROUP
AZURE_LOCATION=$LOCATION

# App Service URLs
BACKEND_URL=https://$APP_NAME.azurewebsites.net
FRONTEND_URL=https://YOUR_STATIC_WEB_APP_URL

# Database Information (for reference)
DB_SERVER_NAME=$DB_SERVER_NAME
DB_ADMIN_USER=$DB_ADMIN_USER
DB_NAME=$DB_NAME
EOF
    
    print_success "Environment file created: .env.azure"
    print_warning "Remember to:"
    echo "1. Replace 'YOUR_DB_PASSWORD' with your actual database password"
    echo "2. Update FRONTEND_URL with your actual Static Web App URL"
    echo "3. Add these settings to your Azure App Service Configuration"
}

# Function to display summary
display_summary() {
    echo ""
    echo "=========================================="
    print_success "Azure Resources Setup Complete!"
    echo "=========================================="
    echo ""
    echo "Created Resources:"
    echo "• Resource Group: $RESOURCE_GROUP"
    echo "• PostgreSQL Server: $DB_SERVER_NAME.postgres.database.azure.com"
    echo "• Storage Account: $STORAGE_ACCOUNT_NAME"
    echo "• App Service: https://$APP_NAME.azurewebsites.net"
    echo "• Static Web App: $STATIC_WEB_APP_NAME"
    echo ""
    echo "Next Steps:"
    echo "1. Review the .env.azure file and update your App Service settings"
    echo "2. Set up GitHub Actions secrets for deployment"
    echo "3. Push your code to trigger the deployment pipeline"
    echo "4. Run database migrations after first deployment"
    echo ""
    echo "Required GitHub Secrets:"
    echo "• AZURE_WEBAPP_PUBLISH_PROFILE"
    echo "• AZURE_STATIC_WEB_APPS_API_TOKEN"
    echo "• DATABASE_URL"
    echo "• SECRET_KEY"
    echo "• AZURE_STORAGE_CONNECTION_STRING"
    echo ""
    print_warning "Don't forget to update your frontend configuration with the actual URLs!"
}

# Main execution
main() {
    echo "=========================================="
    echo "Scott Overhead Doors - Azure Setup"
    echo "=========================================="
    echo ""
    
    check_prerequisites
    
    echo ""
    print_status "This script will create the following Azure resources:"
    echo "• Resource Group: $RESOURCE_GROUP"
    echo "• PostgreSQL Database: $DB_SERVER_NAME"
    echo "• Storage Account: $STORAGE_ACCOUNT_NAME"
    echo "• App Service: $APP_NAME"
    echo "• Static Web App: $STATIC_WEB_APP_NAME"
    echo ""
    
    read -p "Do you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Setup cancelled"
        exit 0
    fi
    
    create_resource_group
    create_postgresql_database
    create_storage_account
    create_app_service
    # create_static_web_app  # Uncomment if you want to create via CLI
    generate_env_file
    display_summary
}

# Run the main function
main "$@"