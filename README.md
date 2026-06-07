# Memory Timeline

Memory Timeline is a full-stack application for privately organizing, searching,
sharing, and exporting personal memories.

## Live Application

[Open Memory Timeline](http://13.63.48.235)

The current deployment uses HTTP. HTTPS and a permanent domain should be added
before treating the application as production-ready.

## Features

- Email registration and JWT authentication
- User-isolated memory timelines
- Multiple images per memory
- Search, sorting, categories, favorites, and reminders
- Private image storage in Amazon S3 using an EC2 IAM role
- Public share links for individual memories
- Original-image export with ZIP downloads for multiple images
- Responsive light and dark themes

## Architecture

- Frontend: React and Vite
- Backend: Node.js and Express
- Database: MongoDB Atlas
- Image storage: Amazon S3
- Hosting: Amazon EC2
- Web server: Nginx
- Process manager: PM2

## Local Development

Create local configuration files from the examples:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Install and run the backend:

```powershell
cd backend
npm install
node server.js
```

Install and run the frontend in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Never commit `.env` files, private keys, deployment archives, or uploaded images.

## Production Deployment

The live deployment serves the Vite build through Nginx and proxies `/api` to
the Express backend on port `5001`. PM2 keeps the backend running after logout
and server restarts.

Production secrets belong only in `/home/ubuntu/backend/.env` on EC2 or in a
managed secret store. AWS access keys are not required because the instance
uses an IAM role.

## Verification

```powershell
cd frontend
npm run lint
npm run build
```
