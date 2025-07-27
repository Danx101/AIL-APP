# Deployment Guide: Railway + Vercel + MySQL

## Overview
This guide walks you through deploying the Abnehmen App with:
- **Backend**: Railway (Node.js + MySQL)
- **Frontend**: Vercel (Static site)
- **Database**: Railway MySQL

## Prerequisites
- GitHub account with repository set up ✅
- Railway account (free tier available)
- Vercel account (free tier available)

## Step 1: Deploy Backend to Railway

### 1.1 Create Railway Project
1. Go to [Railway](https://railway.app)
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository: `Danx101/AIL-APP`

### 1.2 Add MySQL Database
1. In your Railway project, click "New" → "Database" → "MySQL"
2. Wait for the database to provision

### 1.3 Configure Environment Variables
In Railway dashboard → Your backend service → Variables tab, add:

```env
NODE_ENV=production
PORT=3001

# Database (Railway will auto-provide these)
DB_HOST=${MYSQL_HOST}
DB_PORT=${MYSQL_PORT}
DB_USER=${MYSQL_USER}
DB_PASSWORD=${MYSQL_PASSWORD}
DB_NAME=${MYSQL_DATABASE}

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-256-bit-key
JWT_EXPIRES_IN=7d

# CORS (will be updated after Vercel deployment)
FRONTEND_URL=https://your-vercel-app.vercel.app

# Optional services
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-number

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

### 1.4 Deploy Backend
1. Railway will automatically build and deploy
2. Note your Railway backend URL (e.g., `your-app-name.railway.app`)

## Step 2: Deploy Frontend to Vercel

### 2.1 Update API URLs
Before deploying, update the frontend API URLs with your Railway backend URL:

In these files, replace `your-railway-backend-url.railway.app` with your actual Railway URL:
- `frontend/public/src/services/api.js`
- `frontend/public/src/services/auth.js`
- `frontend/public/src/services/managerAPI.js`
- `frontend/public/src/services/leadsAPI.js`

### 2.2 Create Vercel Project
1. Go to [Vercel](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Import your GitHub repository
5. Set Root Directory to `frontend`
6. Framework Preset: Other
7. Build Command: `npm run build` (optional)
8. Output Directory: `public`

### 2.3 Deploy Frontend
1. Click "Deploy"
2. Note your Vercel frontend URL (e.g., `your-app.vercel.app`)

## Step 3: Update CORS Settings

### 3.1 Update Railway Environment Variables
1. Go to Railway → Your backend service → Variables
2. Update `FRONTEND_URL` with your Vercel URL
3. Redeploy the service

## Step 4: Database Setup

### 4.1 Verify Database Connection
Your backend will automatically:
- Connect to MySQL on startup
- Create all required tables
- Initialize the database schema

### 4.2 Create Initial Manager Account (Optional)
You can create a manager account by running the backend setup locally:
```bash
cd backend
node create_manager_simple.js
```

## Step 5: Testing

### 5.1 Health Checks
- Backend: `https://your-railway-app.railway.app/health`
- Frontend: `https://your-vercel-app.vercel.app`

### 5.2 API Test
- API Status: `https://your-railway-app.railway.app/api/v1/status`

### 5.3 Full Application Test
1. Visit your Vercel frontend URL
2. Try registering a new account
3. Test login functionality
4. Verify API calls work between frontend and backend

## Important Security Notes

### Environment Variables
- Never commit `.env` files to git
- Use strong, unique JWT secrets
- Keep database credentials secure

### CORS Configuration
- The backend is configured to accept requests from your Vercel domain
- CORS will block unauthorized cross-origin requests

### Database Credentials
- Railway automatically manages MySQL credentials
- Use Railway's environment variable references

## Troubleshooting

### Common Issues

1. **CORS Errors**: Update `FRONTEND_URL` in Railway environment variables
2. **Database Connection Errors**: Check MySQL service status in Railway
3. **Build Failures**: Check build logs in Railway/Vercel dashboards
4. **Authentication Issues**: Verify JWT_SECRET is set correctly

### Logs
- Railway: Project dashboard → Service → Logs
- Vercel: Project dashboard → Functions/Build logs

## Production Checklist

- [ ] Backend deployed to Railway
- [ ] MySQL database provisioned and connected
- [ ] Environment variables configured
- [ ] Frontend deployed to Vercel
- [ ] CORS settings updated
- [ ] Health endpoints responding
- [ ] Authentication flow working
- [ ] Database operations working

## Maintenance

### Database Backups
Railway provides automatic backups for paid plans. For free tier:
- Export data regularly via phpMyAdmin or MySQL client
- Consider upgrading to paid plan for production use

### Monitoring
- Set up Railway/Vercel monitoring alerts
- Monitor application performance and errors
- Track API usage and response times

## Cost Estimates

### Free Tier Limits
- **Railway**: $5 free credit monthly, MySQL included
- **Vercel**: 100GB bandwidth, 1000 serverless function invocations
- **Total**: Suitable for development and small-scale production

### Scaling
Both platforms offer pay-as-you-scale pricing for growing applications.