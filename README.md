# Task Manager

A modern, dark-themed task management web application built for the QHSE Team at Triple M Holdings.

## Overview

Task Manager is a custom productivity tool designed to replace and extend commercial solutions like TickTick. It provides a clean, efficient interface for managing daily tasks, projects, and priorities.

## Key Features

- Smart Lists (Inbox, Today, Next 7 Days, Assigned to Me)
- Project management with color coding
- Rich text task descriptions powered by TipTap
- Priority levels (Low, Medium, High, None)
- Due dates with overdue indicators
- Tags and project assignment
- Soft delete functionality
- Real-time sync via Supabase

## Tech Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- TipTap rich text editor
- Supabase (PostgreSQL + Auth + Realtime)

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account and project

### Installation

```bash
# Clone the repository
git clone https://github.com/57471C/TaskManager.git
cd TaskManager

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run the development server
npm run dev
```
