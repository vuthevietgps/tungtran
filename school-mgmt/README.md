# School Management (NestJS + Angular + MongoDB Atlas)

This monorepo contains a NestJS backend and (next) an Angular frontend. This iteration implements User Management with Roles & JWT authentication.

## Prerequisites
- Node.js LTS (v18+ recommended)
- A MongoDB Atlas cluster and connection string

## Backend Setup

1. Copy env file:
```powershell
Copy-Item .\backend\.env.example .\backend\.env
```
2. Edit `.\backend\.env` and set `MONGODB_URI`, `JWT_SECRET`, and optional `ADMIN_*`.

3. Install dependencies:
```powershell
Push-Location .\backend
npm install
Pop-Location
```

4. Run in dev mode (hot reload):
```powershell
Push-Location .\backend
npx nest start --watch
Pop-Location
```

The server listens on `http://localhost:3000`.

### Auth Quick Test
- Seeded DIRECTOR account from env (defaults: `admin@local` / `ChangeMe123!`).
- Login:
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login -ContentType 'application/json' -Body '{"email":"admin@local","password":"ChangeMe123!"}'
```
- Use the returned `access_token` for protected endpoints (e.g., `GET /users/me`).

## Frontend (Angular)
Standalone Angular 17 app lives in `frontend/`.

```powershell
Push-Location .\frontend
npm install
npm start  # http://localhost:4200
Pop-Location
```

Features: JWT login, sidebar layout, DIRECTOR-only user management (list/search/filter/add). Update `src/environments/environment.ts` if backend URL changes.

## Demo Accounts
Seeder creates the following demo users (all passwords `123456` or override via `DEMO_PASSWORD` in `.env`):

| Role (vi) | Email | Role enum |
| --- | --- | --- |
| Giám đốc | `director.demo@school.local` | `DIRECTOR` |
| Quản lý | `manager.demo@school.local` | `MANAGER` |
| Sale | `sale.demo@school.local` | `SALE` |
| HCNS | `hcns.demo@school.local` | `HCNS` |
| Partime | `partime.demo@school.local` | `PARTIME` |
| Giáo viên | `teacher.demo@school.local` | `TEACHER` |

Login bằng tài khoản Giám đốc để truy cập khu vực quản lý user.

## Roles (phase 1)
- DIRECTOR: Create/edit/lock/unlock users; list users; full visibility.
- STAFF/TEACHER: Can authenticate and read their profile (`/users/me`).

## Endpoints
- POST `/auth/login` — email/password → `{ access_token, user }`
- GET `/users/me` — current user profile (JWT)
- POST `/users` — DIRECTOR only, create user
- GET `/users` — DIRECTOR only, list users
- PATCH `/users/:id` — DIRECTOR only, update user
- POST `/users/:id/lock` — DIRECTOR only
- POST `/users/:id/unlock` — DIRECTOR only
- POST `/products` — DIRECTOR create product (name + unique code)
- GET `/products` — DIRECTOR list products
- PATCH `/products/:id` — DIRECTOR update product
- DELETE `/products/:id` — DIRECTOR remove product
- POST `/students` — DIRECTOR create student profile (name, age, parent info, face image URL)
- GET `/students` — DIRECTOR list students
- PATCH `/students/:id` — DIRECTOR update student
- DELETE `/students/:id` — DIRECTOR remove student
- POST `/students/face-upload` — DIRECTOR upload student face image (multipart/form-data → URL)
- Sales can also create students (only their own list) and upload faces; they only see the students they created.
- POST `/classes` — DIRECTOR create class (name, code, teacher, sale, students)
- GET `/classes` — DIRECTOR list classes with populated teacher/sale/student info
- PATCH `/classes/:id` — DIRECTOR update class
- DELETE `/classes/:id` — DIRECTOR remove class
- POST `/classes/:id/assign-students` — SALE adds their self-created students to a class they are assigned to

## Notes
- Permissions guard placeholder is included for future fine-grained checks.
- Passwords are hashed with bcrypt.
- Student photos are stored under `backend/uploads/students` and exposed via `http://<host>/uploads/...`. The folder is created automatically and git-ignored.
- Class creation enforces teacher (role `TEACHER`), sale (role `SALE`), and student existence to keep referential integrity.
- Sales can only assign students they created to the classes where they are the assigned sale representative.
