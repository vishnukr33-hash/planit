# Todo Portal — Enterprise Task Management

A full-stack task management web portal with Admin & Team User hierarchy.

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, React Query, Zustand, Chart.js
- **Backend**: Node.js, Express, MongoDB, JWT Auth, Socket.io
- **Features**: Role-based access, real-time updates, email reminders, dark mode

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm run dev
```

Seed sample data (optional):
```bash
cd backend
node utils/seed.js
```

Default admin credentials: `admin / Admin@2026`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features

### Admin
- Dashboard with KPI cards and charts (completion trend, status distribution, category breakdown, team productivity)
- My Tasks — self-assigned tasks with full CRUD
- Team Tasks — assign tasks to team members, expandable per-user view
- Reminders — consolidated view of overdue, due today, upcoming tasks + recent comments
- User Management — create/edit/delete users, toggle active/inactive, reset passwords

### Team Users
- View and update assigned tasks
- Add comments/replies on tasks
- Mark tasks complete
- Personal reminders

### Task Fields
- Title, Description, Status, Category, Priority, Due Date, Assigned To/By, Comments

## Project Structure

```
todo-portal/
├── backend/
│   ├── models/         # User, Task schemas
│   ├── routes/         # auth, users, tasks, reminders, dashboard
│   ├── middleware/      # JWT auth, role guard
│   └── utils/          # email, scheduler, seed
└── frontend/
    ├── app/            # Next.js pages
    ├── components/     # Reusable UI components
    └── lib/            # API client, Zustand store, constants
```

## Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/todo_portal
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@email.com
EMAIL_PASS=your_app_password
CLIENT_URL=http://localhost:3000

