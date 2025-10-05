# Roehn Management System

This is a comprehensive management system for automation projects, built with a Flask backend and a React frontend. It allows users to manage projects, define areas and environments, configure circuits and automation modules, and much more.

## Features

- **Project Management**: Create, edit, delete, and switch between multiple automation projects.
- **Hierarchical Structure**: Organize projects into Areas and Ambientes (Rooms) for better management.
- **Circuit Configuration**: Define and manage different types of circuits (lighting, blinds, HVAC) with specific properties like power and dimming capabilities.
- **Automation Modules**: Configure various automation modules (e.g., RL12, DIM8, LX4) and see their specifications.
- **Smart Linking**: Link circuits to specific channels on automation modules with compatibility checks.
- **Automatic Linking**: Automatically associate circuits with available modules, taking into account electrical constraints and grouping by environment.
- **Keypad Configuration**: Design and configure physical keypads (RQR-K model), assigning actions to each button (controlling circuits or activating scenes).
- **Scene Creation**: Create complex scenes involving multiple circuits and actions within an environment.
- **User Management**: Admin interface to manage users and their roles.
- **Data Export/Import**:
    - **PDF Reports**: Generate detailed PDF reports of the project, including circuit layouts and module summaries.
    - **CSV Export**: Export a summary of all circuits and their connections to a CSV file.
    - **Project Backup/Restore**: Export the entire project to a JSON file and import it into another system or for backup purposes.
    - **RWP File Generation**: Generate `.rwp` files compatible with Roehn-specific software.
- **Electrical Panel Management**: Organize automation modules into electrical panels located in specific environments.

## Technologies Used

**Backend:**
- **Framework**: Flask
- **Database**: SQLite with SQLAlchemy ORM
- **Authentication**: Flask-Login for session-based authentication.
- **PDF Generation**: ReportLab
- **CORS**: Flask-CORS

**Frontend:**
- **Framework**: React (with Vite)
- **UI Library**: shadcn/ui
- **Routing**: React Router
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form with Zod for validation

## Prerequisites

- Python 3.8+
- Node.js 18+ and npm

## Getting Started

Follow these instructions to get the project up and running on your local machine.

### 1. Backend Setup

The backend includes startup scripts to simplify the process.

**On Linux/macOS:**
```bash
# Navigate to the backend directory
cd backend/

# Run the development startup script
bash start-dev.sh
```

**On Windows:**
```bash
# Navigate to the backend directory
cd backend

# Run the development startup script
start-dev.bat
```

**What the script does:**
1.  Creates a Python virtual environment named `venv`.
2.  Activates the virtual environment.
3.  Installs all required dependencies from `requirements.txt`.
4.  Initializes the SQLite database (`instance/projetos.db`) and seeds it with a default admin user if one doesn't exist.
5.  Starts the Flask server.

The backend server will run on `http://127.0.0.1:5000`.

### 2. Frontend Setup

**In a new terminal**, navigate to the project root and run the following commands:

```bash
# Install all frontend dependencies
npm install

# Start the frontend development server
npm run dev
```

The frontend application will be available at `http://localhost:8080`.

## Backend Configuration

- **Database**: The application uses a SQLite database located at `instance/projetos.db`. It is created automatically on the first run. To reset the database, you can delete this file and restart the server.
- **Secret Key**: The Flask secret key is set in `backend/app.py`. For production environments, it is strongly recommended to set this key as an environment variable.

## API Endpoints

The Flask backend serves a RESTful API under the `/api/` prefix. The Vite development server is configured to proxy requests from `/api` to the backend at `http://127.0.0.1:5000`.

Key endpoint categories include:
- `/api/login`, `/api/logout`, `/api/session`: Authentication and session management.
- `/api/projetos`: Project management.
- `/api/areas`, `/api/ambientes`, `/api/circuitos`: Management of the project's physical structure.
- `/api/modulos`, `/api/vinculacoes`: Module configuration and linking.
- `/api/keypads`, `/api/cenas`: Keypad and scene configuration.
- `/api/users`: User management (admin only).
- `/exportar-pdf/<id>`, `/exportar-csv`, `/exportar-projeto/<id>`: Data export functionalities.

## Default Credentials

A default administrator account is created when the database is first initialized.

- **Username**: `admin`
- **Password**: `admin123`

It is highly recommended to change the default password after the first login.

## File Generation

The system can generate several types of files:

- **PDF Reports**: A detailed, printable report of the entire project, ideal for documentation and technical visits.
- **CSV Files**: A simple spreadsheet format listing all circuits, their locations, and their module connections.
- **JSON Project Export**: A full backup of a project's data, which can be used for migration or restoration.
- **RWP Files**: A specific format for Roehn automation systems, generated from the project data.