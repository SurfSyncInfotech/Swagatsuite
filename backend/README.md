# Backend Setup (Node.js + MySQL)

## 1) Create database and non-root user

Run these SQL commands in MySQL (as root/admin once):

```sql
CREATE DATABASE IF NOT EXISTS restro_qr_app;

CREATE USER IF NOT EXISTS 'restro_admin'@'%' IDENTIFIED BY 'restro_admin_4510';

GRANT ALL PRIVILEGES ON restro_qr_app.* TO 'restro_admin'@'%';
FLUSH PRIVILEGES;
```

`'%'` allows access from anywhere (for server hosting).

## 2) Configure environment

Copy `.env.example` to `.env` and update values if needed.

## 3) Run backend

```bash
npm install
npm run dev
```

Only one file is executed for runtime: `server.js`.
