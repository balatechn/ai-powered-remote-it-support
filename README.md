# 🚀 NexusIT — AI-Powered Remote IT Support Platform

<p align="center">
  <strong>Intelligent remote IT support with AI-powered diagnostics, automation, and real-time device management.</strong>
</p>

---

## 📋 Overview

NexusIT is a production-ready, full-stack remote IT support platform inspired by Zoho Assist, enhanced with AI-based troubleshooting (OpenAI), real-time device monitoring, and remote session management via Apache Guacamole.

### Key Features

- 🤖 **AI Copilot** — GPT-4 powered issue diagnosis, log analysis, and fix suggestions
- 🖥️ **Device Management** — Real-time monitoring with CPU/Memory/Disk telemetry
- 🔗 **Remote Sessions** — RDP/VNC/SSH access via browser (Guacamole integration)
- ⚡ **Script Automation** — Remote PowerShell/Bash execution with safety layer
- 📊 **Analytics Dashboard** — KPIs, session trends, OS distribution charts
- 🔐 **RBAC & JWT Auth** — Role-based access (Admin, Technician, Viewer)
- 📡 **Real-time Updates** — WebSocket-powered live status and notifications

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Electron App   │     │  React Dashboard │     │  Endpoint Agent │
│  (Desktop)      │     │  (Vite + Tailwind)│    │  (Node.js)      │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                         │
         └───────────┬───────────┘                         │
                     │                                     │
              ┌──────▼──────┐                              │
              │  Backend API │◄─────── WebSocket ──────────┘
              │  (Express)   │
              └──────┬──────┘
                     │
         ┌───────────┼───────────┐
    ┌────▼────┐ ┌────▼────┐ ┌───▼────┐
    │PostgreSQL│ │  Redis  │ │ OpenAI │
    │  (DB)   │ │ (Cache) │ │  (AI)  │
    └─────────┘ └─────────┘ └────────┘
```

---

## 📁 Project Structure

```
├── backend/          # Node.js + Express API
│   ├── src/
│   │   ├── config/   # Database configuration
│   │   ├── middleware/# Auth, RBAC
│   │   ├── models/   # Sequelize models
│   │   ├── routes/   # API endpoints
│   │   ├── utils/    # Logger, helpers
│   │   ├── websocket/# Socket.IO handlers
│   │   └── server.js # Entry point
│   └── Dockerfile
├── frontend/         # React + Vite + TailwindCSS
│   ├── src/
│   │   ├── components/# Layout, AIChat
│   │   ├── lib/      # API client
│   │   ├── pages/    # Dashboard, Devices, etc.
│   │   └── stores/   # Zustand state
│   └── Dockerfile
├── agent/            # Lightweight endpoint agent
│   └── src/agent.js
├── electron/         # Desktop application
│   ├── main.js
│   └── preload.js
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (for deployment)

### 1. Clone & Configure

```bash
git clone https://github.com/YOUR_USERNAME/ai-remote-it-support.git
cd ai-remote-it-support
cp .env.example .env
# Edit .env with your configuration
```

### 2. Backend Setup

```bash
cd backend
npm install
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Agent Setup

```bash
cd agent
npm install
npm start
```

### 5. Electron App (Development)

```bash
cd electron
npm install
npm run dev
```

---

## 🐳 Docker Deployment

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Services:**
| Service    | Port  | Description       |
|-----------|-------|-------------------|
| Frontend  | 80    | Web Dashboard     |
| Backend   | 4000  | REST API + WebSocket |
| PostgreSQL| 5432  | Database (internal)|
| Redis     | 6379  | Cache (internal)  |

---

## ☁️ Coolify Deployment

1. Push code to GitHub
2. Open Coolify: `http://187.127.134.246:8000`
3. Add GitHub repository as a new resource
4. Select **Docker Compose** deployment
5. Configure environment variables from `.env.example`
6. Deploy — Coolify handles builds and networking

---

## 🔐 API Endpoints

| Endpoint         | Description              |
|-----------------|--------------------------|
| `POST /api/auth/register` | Register new user |
| `POST /api/auth/login`    | User login        |
| `GET /api/devices`        | List devices      |
| `POST /api/sessions`      | Start session     |
| `POST /api/ai/diagnose`   | AI diagnosis      |
| `POST /api/ai/chat`       | AI chat           |
| `GET /api/logs`           | View logs         |
| `GET /api/dashboard/stats`| Dashboard KPIs    |

---

## 🔒 Security

- **JWT + Refresh Tokens** with automatic rotation
- **RBAC** (Admin, Technician, Viewer)
- **Rate Limiting** on auth and API endpoints
- **Helmet.js** security headers
- **bcrypt** password hashing (12 rounds)
- **Zod** input validation
- **Non-root Docker** containers
- **MFA-ready** architecture

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
