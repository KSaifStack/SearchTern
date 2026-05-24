# SearchTern Fedora Deployment Guide (Bare Metal / Systemd)

Follow these instructions to deploy SearchTern to your Fedora Server using the provided Systemd services.

## Prerequisites
On your Fedora Server, ensure you have Python 3, Node.js, and PostgreSQL installed:
```bash
sudo dnf install python3 python3-pip nodejs postgresql-server postgresql-contrib
```

## 1. Transfer Files
Transfer your `SearchTernBase` repository to the Fedora Server. We recommend placing it in `/opt/SearchTernBase`.
You can use `scp` or `git` to achieve this.

## 2. Set Up the Backend
1. **Navigate to backend:** `cd /opt/SearchTernBase/backend`
2. **Create a virtual environment:** `python3 -m venv venv`
3. **Activate and install dependencies:**
   ```bash
   source venv/bin/activate
   pip install -r requirements.txt
   ```
4. **Create the `.env` file:** Ensure you have your `API_KEY` and `DATABASE_URL` set in `/opt/SearchTernBase/backend/.env`.

## 3. Set Up the Frontend
1. **Navigate to frontend:** `cd /opt/SearchTernBase/frontend`
2. **Install dependencies:** `npm install`
3. **Configure the Environment:**
   Create `/opt/SearchTernBase/frontend/.env.local` and add your domain's API URL (e.g., if cloudflared routes `api.yourdomain.com` to port 8000):
   ```env
   VITE_API_KEY=your_secure_random_string_here
   VITE_API_URL=https://api.yourdomain.com
   ```
   *Note: if you are mapping the same domain for both frontend and backend using a path like `/api` via Nginx, this would be `https://yourdomain.com/api`.*
4. **Build the production bundle:**
   ```bash
   npm run build
   ```

## 4. Install and Start Systemd Services
We have generated two service files in the `deploy/` directory.

1. **Copy them to systemd:**
   ```bash
   sudo cp /opt/SearchTernBase/deploy/searchtern-backend.service /etc/systemd/system/
   sudo cp /opt/SearchTernBase/deploy/searchtern-frontend.service /etc/systemd/system/
   ```
2. **Reload systemd:**
   ```bash
   sudo systemctl daemon-reload
   ```
3. **Enable and start the services:**
   ```bash
   sudo systemctl enable --now searchtern-backend.service
   sudo systemctl enable --now searchtern-frontend.service
   ```
4. **Check status:**
   ```bash
   sudo systemctl status searchtern-backend.service
   sudo systemctl status searchtern-frontend.service
   ```

## 5. Cloudflare Tunnel (`cloudflared`) Setup
Now that the backend is running on port `8000` and frontend on port `5173`, configure your Cloudflare tunnel to route traffic to these ports.

1. Install `cloudflared` on Fedora if you haven't already.
2. Create a tunnel and configure your ingress rules in the Zero Trust Dashboard (or `config.yml`):
   - Route `yourdomain.com` -> `http://localhost:5173`
   - Route `api.yourdomain.com` -> `http://localhost:8000`
