#!/bin/bash

echo "MySQL Setup Script for Abnehmen App"
echo "===================================="
echo ""

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "MySQL is not installed. Please install MySQL first:"
    echo ""
    echo "On macOS with Homebrew:"
    echo "  brew install mysql"
    echo ""
    echo "After installation, run:"
    echo "  brew services start mysql"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Check if MySQL is running
if ! mysqladmin ping -h localhost --silent; then
    echo "MySQL is not running. Please start MySQL:"
    echo "  brew services start mysql"
    exit 1
fi

echo "MySQL is installed and running."
echo ""

# Get MySQL root password
echo "Please enter your MySQL root password (leave blank if no password):"
read -s MYSQL_ROOT_PASSWORD

# Create database
echo ""
echo "Creating database 'abnehmen_app'..."
if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
    mysql -u root -e "CREATE DATABASE IF NOT EXISTS abnehmen_app;"
else
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS abnehmen_app;"
fi

if [ $? -eq 0 ]; then
    echo "Database created successfully!"
else
    echo "Failed to create database. Please check your MySQL credentials."
    exit 1
fi

echo ""
echo "MySQL setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env file with MySQL credentials:"
echo "   DB_HOST=localhost"
echo "   DB_PORT=3306"
echo "   DB_USER=root"
echo "   DB_PASSWORD=$MYSQL_ROOT_PASSWORD"
echo "   DB_NAME=abnehmen_app"
echo ""
echo "2. Run the migration script to import data from SQLite:"
echo "   npm run migrate:sqlite-to-mysql"