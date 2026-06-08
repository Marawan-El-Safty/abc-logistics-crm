#!/bin/bash
# SAFTYGROUP CRM — Quick Setup Script

echo "======================================"
echo "  SAFTYGROUP CRM — Setup"
echo "======================================"

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required. Install from nodejs.org"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required"; exit 1; }

# Backend
echo ""
echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

# Frontend
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Ensure PostgreSQL is running and create database:"
echo "     createdb saftygroup_crm"
echo "  2. Run database migration:"
echo "     cd backend && npm run db:migrate && npm run db:seed"
echo "  3. Start the backend:"
echo "     cd backend && npm run dev"
echo "  4. In a new terminal, start the frontend:"
echo "     cd frontend && npm start"
echo ""
echo "Default admin credentials:"
echo "  Email:    admin@saftygroup.com"
echo "  Password: Admin@SAFTY2024"
echo ""
echo "Or use Docker Compose:"
echo "  docker-compose up -d"
