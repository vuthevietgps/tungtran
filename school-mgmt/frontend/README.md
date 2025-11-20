# School Management Frontend (Angular)

Standalone Angular 17 dashboard for managing users within the school system.

## Features
- JWT login form (uses backend `/auth/login`).
- Sidebar layout with protected routes.
- User management screen: search, filter, add new user with role options (Giám đốc, Quản lý, Sale, HCNS, Partime, Giáo viên).
- Role-based guard restricts module to DIRECTOR accounts.

## Development
```powershell
Push-Location .\frontend
npm install
npm start   # serves at http://localhost:4200
Pop-Location
```

## Build
```powershell
Push-Location .\frontend
npm run build
Pop-Location
```
Artifacts emitted in `dist/school-mgmt-frontend/`.

Ensure backend (`npm run start:dev` in `backend/`) is running so API calls succeed.
