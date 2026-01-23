# Deployment script pentru Frontend (React + Vite)
# Folosește: ./deploy-frontend.sh

# Navighează la directorul frontend
cd "$(dirname "$0")/volta-frontend" || exit

echo "🚀 Starting frontend deployment..."

# Pull latest changes (dacă folosești git)
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes..."
    git pull origin main || git pull origin master
fi

# Instalează dependențe
echo "📦 Installing dependencies..."
npm install

# Build pentru producție
echo "🔨 Building for production..."
npm run build

echo "✅ Frontend deployment completed successfully!"
echo "📁 Build files are in the 'dist' directory"
