# FlipAI Docker Setup Guide

This guide explains how to set up and run FlipAI using Docker for team development.

## Prerequisites

- **Docker Desktop** installed on your machine ([Download here](https://www.docker.com/products/docker-desktop))
- **Git** (for cloning the repo)
- No need to install Python, PostgreSQL, or Node.js locally (except React frontend runs on host)

## Quick Start
```
# First time
docker-compose up

# In another terminal:
docker-compose exec backend python manage.py migrate
cd frontend
npm install
npm start

# After first time
docker-compose up

# In another terminal:
cd frontend 
npm start
```

## Detailed Setup

### 1. Clone the Repository
```bash
git clone <repo-url>
cd FlipAI
```

### 2. Ensure `.env` File Exists
The `.env` file should already be in the repo. If not, verify these variables are set:
```env
DB_NAME=flipai_db
DB_USER=postgres
DB_PASSWORD=*YOUR_PASSWORD*
DB_HOST=localhost  # Will be overridden to 'db' in Docker
DB_PORT=5432
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

### 3. Start Docker Services
```bash
docker-compose up
```

This will:
- Build the Django backend image (first run only, ~2-3 minutes)
- Start PostgreSQL database
- Start Django backend on `http://localhost:8000`
- Create a persistent volume for database

**Expected Output:**
```
flipai-db       | postgres is ready to accept connections
flipai-backend  | Starting development server at http://0.0.0.0:8000/
```

### 4. Run Database Migrations (First Time Only)

In a **new terminal**, run:
```bash
docker-compose exec backend python manage.py migrate
```

If you need to create a superuser:
```bash
docker-compose exec backend python manage.py createsuperuser
```

### 5. Start React Frontend (In Another Terminal)

The React frontend runs **locally on your machine**, not in Docker:
```bash
cd frontend
npm install  # First time only
npm start
```

React will start on `http://localhost:3000/`

## Verification Checklist

After everything starts, verify all services are running:

```bash
docker-compose ps
```

Expected output:
```
CONTAINER ID   IMAGE              STATUS          PORTS
xxx            postgres:15-alpine  Up (healthy)   5432/tcp
xxx            flipai-backend     Up               0.0.0.0:8000->8000/tcp
```

### Test the Backend
- **Django Admin**: http://localhost:8000/admin
- **API Docs**: http://localhost:8000/swagger/
- **ReDoc Docs**: http://localhost:8000/redoc/
- **API Root**: http://localhost:8000/api/v1/

### Test the Database Connection
```bash
docker-compose exec backend python manage.py dbshell
```

If the prompt shows `flipai_db=# `, PostgreSQL is connected!

## Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f db
```

### Stop Services
```bash
docker-compose down
```

### Stop and Remove All Data (Careful!)
```bash
docker-compose down -v
```

### Restart Services
```bash
docker-compose restart
```

### Run Django Commands
```bash
# Make migrations
docker-compose exec backend python manage.py makemigrations

# Migrate
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Run tests
docker-compose exec backend pytest

# Run shell
docker-compose exec backend python manage.py shell
```

### Access Database Directly
```bash
# Connect to PostgreSQL via psql
docker-compose exec db psql -U postgres -d flipai_db

# List tables
\dt

# Exit
\q
```

## Troubleshooting

### Port Already in Use
If port 5432 or 8000 is already in use:

**Option 1:** Stop other processes using the port
```bash
# On Windows:
netstat -ano | findstr :5432  # Find process ID
taskkill /PID <PID> /F       # Kill process
```

**Option 2:** Change the port in `docker-compose.yml`
```yaml
ports:
  - "5433:5432"  # Use 5433 instead of 5432
```

### Database Connection Errors
If Django can't connect to PostgreSQL:

1. Verify PostgreSQL is healthy:
```bash
docker-compose ps
```
Should show `db` with status `Up (healthy)`

2. Check logs:
```bash
docker-compose logs db
```

3. Restart services:
```bash
docker-compose restart
docker-compose exec backend python manage.py migrate
```

### "ModuleNotFoundError" After Code Changes
If you add new packages to `requirements.txt`:

```bash
# Rebuild the image
docker-compose build --no-cache backend

# Restart services
docker-compose up
```

### Fresh Start
To completely reset:
```bash
docker-compose down -v            # Remove containers and volumes
docker-compose build --no-cache   # Rebuild image
docker-compose up                 # Start fresh
docker-compose exec backend python manage.py migrate
```

## File Structure

```
FlipAI/
├── docker-compose.yml       # Defines services (PostgreSQL, Django)
├── Dockerfile              # Instructions to build Django image
├── .dockerignore           # Files to exclude from Docker build
├── .env                    # Environment variables (shared by team)
├── requirements.txt        # Python dependencies
├── manage.py              # Django management script
├── frontend/              # React app (runs locally, not in Docker)
└── [other files]
```

## For Team Development

### First Time Setup (Each Team Member)
```bash
git clone <repo-url>
cd FlipAI
docker-compose up
# In another terminal:
docker-compose exec backend python manage.py migrate
cd frontend && npm install && npm start
```

### Subsequent Times
```bash
docker-compose up
cd frontend && npm start  # In another terminal
```

### Sharing Database Schema Changes
If someone updates the database schema (models.py):
1. They commit and push the changes
2. Team members pull the changes
3. Team members run:
```bash
docker-compose exec backend python manage.py migrate
```

## Benefits of This Setup

✅ **Identical environments** for all team members
✅ **No installation headaches** (except Docker)
✅ **Persistent database** between restarts
✅ **Easy to reset** (just delete volume)
✅ **Production-like PostgreSQL** (not SQLite)
✅ **Frontend still local** for hot-reload during development
✅ **Team collaboration** without conflicts on DB setup

---

**Need help?** Check logs with `docker-compose logs -f` and share the output.
