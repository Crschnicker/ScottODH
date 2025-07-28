# Azure Resources Setup Script for Scott Overhead Doors (Windows PowerShell)
# Creates all necessary Azure resources for the application

param(
    [string]$ResourceGroup = "scott-overhead-doors-rg",
    [string]$Location = "eastus",
    [string]$AppName = "scott-overhead-doors",
    [string]$DbServerName = "scott-overhead-doors-db",
    [string]$StorageAccountName = "scottoverheaddoorsstore",
    [string]$StaticWebAppName = "scott-overhead-doors-frontend"
)

# Database configuration
$DbAdminUser = "scottadmin"
$DbName = "scott_overhead_doors"

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to check if Azure CLI is installed and logged in
function Test-Prerequisites {
    Write-Status "Checking prerequisites..."
    
    # Check if Azure CLI is installed
    try {
        $azVersion = az version 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "Azure CLI not found"
        }
    }
    catch {
        Write-Error "Azure CLI is not installed. Please install it first:"
        Write-Host "https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    }
    
    # Check if logged in to Azure
    try {
        $account = az account show 2>$null | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0 -or !$account) {
            throw "Not logged in"
        }
    }
    catch {
        Write-Error "Not logged in to Azure. Please run 'az login' first."
        exit 1
    }
    
    Write-Success "Prerequisites check passed"
    Write-Host "Current subscription: $($account.name)" -ForegroundColor Cyan
}

# Function to create resource group
function New-ResourceGroup {
    Write-Status "Creating resource group: $ResourceGroup"
    
    $existingGroup = az group show --name $ResourceGroup 2>$null | ConvertFrom-Json
    if ($existingGroup) {
        Write-Warning "Resource group $ResourceGroup already exists"
    }
    else {
        az group create --name $ResourceGroup --location $Location | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Resource group created: $ResourceGroup"
        }
        else {
            Write-Error "Failed to create resource group"
            exit 1
        }
    }
}

# Function to create PostgreSQL database
function New-PostgreSQLDatabase {
    Write-Status "Creating PostgreSQL database server: $DbServerName"
    
    # Check if server already exists
    $existingServer = az postgres flexible-server show --resource-group $ResourceGroup --name $DbServerName 2>$null | ConvertFrom-Json
    if ($existingServer) {
        Write-Warning "PostgreSQL server $DbServerName already exists"
    }
    else {
        # Prompt for database password
        $DbAdminPassword = Read-Host "Enter password for database admin user ($DbAdminUser)" -AsSecureString
        $DbAdminPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DbAdminPassword))
        
        if ([string]::IsNullOrEmpty($DbAdminPasswordPlain)) {
            Write-Error "Database password cannot be empty"
            exit 1
        }
        
        Write-Status "Creating PostgreSQL server (this may take several minutes)..."
        az postgres flexible-server create `
            --resource-group $ResourceGroup `
            --name $DbServerName `
            --location $Location `
            --admin-user $DbAdminUser `
            --admin-password $DbAdminPasswordPlain `
            --sku-name Standard_B1ms `
            --tier Burstable `
            --storage-size 32 `
            --version 14 `
            --yes | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "PostgreSQL server created: $DbServerName"
        }
        else {
            Write-Error "Failed to create PostgreSQL server"
            exit 1
        }
    }
    
    # Configure firewall rules
    Write-Status "Configuring database firewall rules..."
    
    # Allow Azure services
    az postgres flexible-server firewall-rule create `
        --resource-group $ResourceGroup `
        --name $DbServerName `
        --rule-name AllowAzureServices `
        --start-ip-address 0.0.0.0 `
        --end-ip-address 0.0.0.0 2>$null | Out-Null
    
    # Allow your current IP
    try {
        $CurrentIP = (Invoke-WebRequest -Uri "http://ifconfig.me/ip" -UseBasicParsing).Content.Trim()
        az postgres flexible-server firewall-rule create `
            --resource-group $ResourceGroup `
            --name $DbServerName `
            --rule-name AllowCurrentIP `
            --start-ip-address $CurrentIP `
            --end-ip-address $CurrentIP 2>$null | Out-Null
        Write-Success "Added firewall rule for your IP: $CurrentIP"
    }
    catch {
        Write-Warning "Could not determine current IP address. You may need to add firewall rules manually."
    }
    
    Write-Success "Database firewall configured"
    
    # Create application database
    Write-Status "Creating application database: $DbName"
    
    $DbHost = "$DbServerName.postgres.database.azure.com"
    
    # Check if psql is available
    try {
        psql --version 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            # Create database using psql
            $env:PGPASSWORD = $DbAdminPasswordPlain
            psql -h $DbHost -U $DbAdminUser -d postgres -c "CREATE DATABASE $DbName;" 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Database '$DbName' created successfully"
            }
            else {
                Write-Warning "Database '$DbName' may already exist or there was an error creating it"
            }
            Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        }
        else {
            throw "psql not found"
        }
    }
    catch {
        Write-Warning "PostgreSQL client not found. Please install it or create the database manually:"
        Write-Host "   Database name: $DbName" -ForegroundColor Cyan
        Write-Host "   Server: $DbHost" -ForegroundColor Cyan
    }
    
    # Output connection string
    Write-Host ""
    Write-Success "Database setup complete!"
    Write-Host "Connection string:" -ForegroundColor Cyan
    Write-Host "postgresql://$DbAdminUser:YOUR_PASSWORD@$DbHost`:5432/$DbName" -ForegroundColor Yellow
    
    return $DbAdminPasswordPlain
}

# Function to create storage account
function New-StorageAccount {
    Write-Status "Creating storage account: $StorageAccountName"
    
    $existingStorage = az storage account show --name $StorageAccountName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    if ($existingStorage) {
        Write-Warning "Storage account $StorageAccountName already exists"
    }
    else {
        az storage account create `
            --name $StorageAccountName `
            --resource-group $ResourceGroup `
            --location $Location `
            --sku Standard_LRS `
            --kind StorageV2 `
            --access-tier Hot | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Storage account created: $StorageAccountName"
        }
        else {
            Write-Error "Failed to create storage account"
            exit 1
        }
    }
    
    # Create blob container
    Write-Status "Creating blob container: uploads"
    
    az storage container create `
        --name uploads `
        --account-name $StorageAccountName `
        --public-access off 2>$null | Out-Null
    
    # Get connection string
    $StorageConnectionString = az storage account show-connection-string `
        --name $StorageAccountName `
        --resource-group $ResourceGroup `
        --query connectionString `
        --output tsv
    
    Write-Success "Storage account setup complete!"
    Write-Host "Connection string (save this for your app settings):" -ForegroundColor Cyan
    Write-Host $StorageConnectionString -ForegroundColor Yellow
    
    return $StorageConnectionString
}

# Function to create App Service
function New-AppService {
    Write-Status "Creating App Service: $AppName"
    
    # Create App Service Plan
    $PlanName = "$AppName-plan"
    
    $existingPlan = az appservice plan show --name $PlanName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    if ($existingPlan) {
        Write-Warning "App Service Plan $PlanName already exists"
    }
    else {
        az appservice plan create `
            --name $PlanName `
            --resource-group $ResourceGroup `
            --location $Location `
            --sku B1 `
            --is-linux | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "App Service Plan created: $PlanName"
        }
        else {
            Write-Error "Failed to create App Service Plan"
            exit 1
        }
    }
    
    # Create Web App
    $existingApp = az webapp show --name $AppName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    if ($existingApp) {
        Write-Warning "Web App $AppName already exists"
    }
    else {
        az webapp create `
            --name $AppName `
            --resource-group $ResourceGroup `
            --plan $PlanName `
            --runtime "PYTHON|3.11" | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Web App created: $AppName"
        }
        else {
            Write-Error "Failed to create Web App"
            exit 1
        }
    }
    
    # Configure app settings
    Write-Status "Configuring App Service settings..."
    
    az webapp config appsettings set `
        --name $AppName `
        --resource-group $ResourceGroup `
        --settings `
            FLASK_ENV=production `
            FLASK_APP=app.py `
            SCM_DO_BUILD_DURING_DEPLOYMENT=true `
            ENABLE_ORYX_BUILD=true | Out-Null
    
    Write-Success "App Service configured"
    
    Write-Host ""
    Write-Success "App Service setup complete!"
    Write-Host "URL: https://$AppName.azurewebsites.net" -ForegroundColor Cyan
}

# Function to generate environment variables file
function New-EnvironmentFile {
    param(
        [string]$DbPassword,
        [string]$StorageConnectionString
    )
    
    Write-Status "Generating environment variables file..."
    
    # Get connection strings
    $DbConnectionString = "postgresql://$DbAdminUser`:$DbPassword@$DbServerName.postgres.database.azure.com`:5432/$DbName"
    
    # Generate a secret key
    $SecretKey = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString()))
    
    $EnvContent = @"
# Azure Environment Variables for Scott Overhead Doors
# Copy these to your Azure App Service Configuration

# Flask Configuration
SECRET_KEY=$SecretKey
FLASK_ENV=production
FLASK_APP=app.py

# Database Configuration
DATABASE_URL=$DbConnectionString

# Azure Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=$StorageConnectionString
AZURE_STORAGE_CONTAINER_NAME=uploads

# Azure Resource Information
AZURE_RESOURCE_GROUP=$ResourceGroup
AZURE_LOCATION=$Location

# App Service URLs
BACKEND_URL=https://$AppName.azurewebsites.net
FRONTEND_URL=https://YOUR_STATIC_WEB_APP_URL

# Database Information (for reference)
DB_SERVER_NAME=$DbServerName
DB_ADMIN_USER=$DbAdminUser
DB_NAME=$DbName
"@
    
    $EnvContent | Out-File -FilePath ".env.azure" -Encoding UTF8
    
    Write-Success "Environment file created: .env.azure"
    Write-Warning "Remember to:"
    Write-Host "1. Add these settings to your Azure App Service Configuration" -ForegroundColor Yellow
    Write-Host "2. Update FRONTEND_URL with your actual Static Web App URL" -ForegroundColor Yellow
    Write-Host "3. Set up GitHub Actions secrets for deployment" -ForegroundColor Yellow
}

# Function to display summary
function Show-Summary {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Success "Azure Resources Setup Complete!"
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Created Resources:" -ForegroundColor Cyan
    Write-Host "• Resource Group: $ResourceGroup"
    Write-Host "• PostgreSQL Server: $DbServerName.postgres.database.azure.com"
    Write-Host "• Storage Account: $StorageAccountName"
    Write-Host "• App Service: https://$AppName.azurewebsites.net"
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Review the .env.azure file and update your App Service settings"
    Write-Host "2. Set up GitHub Actions secrets for deployment"
    Write-Host "3. Push your code to trigger the deployment pipeline"
    Write-Host "4. Run database migrations after first deployment"
    Write-Host ""
    Write-Host "Required GitHub Secrets:" -ForegroundColor Cyan
    Write-Host "• AZURE_WEBAPP_PUBLISH_PROFILE"
    Write-Host "• AZURE_STATIC_WEB_APPS_API_TOKEN"
    Write-Host "• DATABASE_URL"
    Write-Host "• SECRET_KEY"
    Write-Host "• AZURE_STORAGE_CONNECTION_STRING"
    Write-Host ""
    Write-Warning "Don't forget to update your frontend configuration with the actual URLs!"
}

# Main execution
function Main {
    Write-Host "==========================================" -ForegroundColor Blue
    Write-Host "Scott Overhead Doors - Azure Setup" -ForegroundColor Blue
    Write-Host "==========================================" -ForegroundColor Blue
    Write-Host ""
    
    Test-Prerequisites
    
    Write-Host ""
    Write-Status "This script will create the following Azure resources:"
    Write-Host "• Resource Group: $ResourceGroup"
    Write-Host "• PostgreSQL Database: $DbServerName"
    Write-Host "• Storage Account: $StorageAccountName"
    Write-Host "• App Service: $AppName"
    Write-Host ""
    
    $response = Read-Host "Do you want to continue? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Warning "Setup cancelled"
        exit 0
    }
    
    New-ResourceGroup
    $dbPassword = New-PostgreSQLDatabase
    $storageConnectionString = New-StorageAccount
    New-AppService
    New-EnvironmentFile -DbPassword $dbPassword -StorageConnectionString $storageConnectionString
    Show-Summary
}

# Run the main function
try {
    Main
}
catch {
    Write-Error "An error occurred: $($_.Exception.Message)"
    exit 1
}