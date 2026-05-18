# Deployment Guide

This project is fully configured for a "one-click" deployment to **Render**, or you can deploy the frontend to Vercel and the backend to any Docker-compatible host.

## 🚀 Easy Deployment (Render Blueprint)
We have included a `render.yaml` file in the root directory. This makes deploying both the Frontend and Backend incredibly simple.

1. Create a [Render](https://render.com) account and connect your GitHub/GitLab.
2. In the Render Dashboard, click **New** -> **Blueprint**.
3. Select this repository.
4. Render will automatically detect both the `petro-valve-frontend` (Static Site) and `petro-valve-backend` (Docker Web Service).
5. **Important**: Go to the **Environment** tab of the `petro-valve-backend` service in the Render dashboard and fill in the secure environment variables that couldn't be synced automatically:
   - `MONGODB_URI`: (Your MongoDB connection string)
   - `EMAIL_USER` & `EMAIL_PASS`: (For SMTP email functionality)
   - `AWS_*`: (For AWS S3 file storage)

Render handles installing Google Chrome inside the Docker container automatically for the PDF quotation generation (Puppeteer) to work correctly!

---

## 🛠️ Manual Deployment (Vercel + Railway/Render)

### 1. Frontend (Vercel)
The frontend is a standard Vite React application.
1. Go to [Vercel](https://vercel.com) and import the repo.
2. Set the **Root Directory** to `frontend`.
3. Add the Environment Variable:
   - `VITE_API_URL`: Your backend URL (e.g., `https://your-backend.onrender.com/api`)

### 2. Backend (Render / Railway / Fly.io)
Because the backend uses **Puppeteer** to generate PDFs, it requires Chromium to be installed on the server. Serverless environments like Vercel Functions *cannot* run it easily. 
Use the provided `backend/Dockerfile` to deploy the API to a container service.

**On Render:**
1. Create a "Web Service".
2. Set the **Root Directory** to `backend`.
3. Set the **Environment** to `Docker` (Render will use the `Dockerfile`).
4. Add all your environment variables from your `.env` file (`MONGODB_URI`, `JWT_SECRET`, `AWS_ACCESS_KEY_ID`, etc.).
5. Ensure you select at least the **Starter** plan, as Puppeteer requires around 512MB of RAM to generate PDFs comfortably.
