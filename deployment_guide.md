# Deployment Guide: SplitFlat Expense App with Neon PostgreSQL

This guide explains how to deploy the React frontend, Node.js backend, and connect them to a serverless Neon PostgreSQL database.

---

## 1. Database Setup on Neon

1. **Create a Neon Project**:
   - Go to [neon.tech](https://neon.tech/) and sign in or create an account.
   - Create a new project. Neon will automatically provision a PostgreSQL database for you (typically named `neondb`).

2. **Retrieve Connection String**:
   - In the Neon Console, copy your **Connection String** from the dashboard.
   - Ensure the dropdown shows **Node.js (pg)** or **Pooled Connection**.
   - The connection string will look something like this:
     ```
     postgresql://neondb_owner:abc123xyz@ep-cool-snowflake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```

---

## 2. Deploying the Backend (Node.js)

You can deploy the backend to platforms like **Render**, **Railway**, or **Fly.io**. Below are instructions for **Render**:

1. **Create a Web Service on Render**:
   - Log in to [Render](https://render.com/) and click **New > Web Service**.
   - Connect your GitHub repository: `https://github.com/SalunkheAdi/Expense_app`.

2. **Configure Service Settings**:
   - **Name**: `splitflat-backend` (or any unique name)
   - **Language**: `Node`
   - **Branch**: `main`
   - **Root Directory**: Leave blank (since `package.json` is at the root of the repository).
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
   - **Instance Type**: Free

3. **Add Environment Variables**:
   Under the **Environment** tab, add the following variables:
   - `DATABASE_URL`: *(Your Neon Connection String)*
   - `PORT`: `10000` *(or leave blank as Render configures this automatically)*
   - `DEFAULT_GROUP_NAME`: `Flat 204` *(optional: sets your default flatmates group)*

4. **Verify Backend Deployment**:
   - Once deployed, Render will provide a URL (e.g., `https://splitflat-backend.onrender.com`).
   - Open that URL in your browser or append `/api/users`. You should see a list of users or database connection logs confirming successful tables creation and seeding.

---

## 3. Deploying the Frontend (Vite/React)

The frontend can be deployed to **Vercel**, **Netlify**, or **Render**. Below are instructions for **Vercel**:

1. **Create a Project on Vercel**:
   - Log in to [Vercel](https://vercel.com/) and click **Add New > Project**.
   - Import your GitHub repository: `https://github.com/SalunkheAdi/Expense_app`.

2. **Configure Build Settings**:
   - **Framework Preset**: `Vite` (detected automatically)
   - **Root Directory**: Leave blank.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. **Add Environment Variables**:
   Expand the **Environment Variables** section and add:
   - `VITE_API_URL`: *(Your deployed backend URL, e.g., `https://splitflat-backend.onrender.com`)*
   - Ensure there is no trailing slash `/` at the end of the URL.

4. **Deploy**:
   - Click **Deploy**. Vercel will build the React app and provide a production URL (e.g., `https://expense-app-three.vercel.app`).

---

## 4. Verification & Initial Database Migration

On the first successful boot of your deployed backend service:
- The backend automatically connects to the Neon database.
- It runs database migrations to construct the tables (`users`, `groups`, `group_memberships`, `expenses`, `expense_splits`, `settlements`).
- It seeds the 6 default flatmates: `Aisha`, `Rohan`, `Priya`, `Meera`, `Sam`, and `Dev`.

**Optional - Import CSV Data**:
- Navigate to your deployed frontend.
- Log in and go to the Importer section to upload `expenses_export.csv` to populate the historical transaction ledgers into your Neon database.
