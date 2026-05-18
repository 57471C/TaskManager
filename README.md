# Task Manager

A modern, dark-themed collaborative task management web application built for the QHSE Team at Triple M Holdings.

## Overview

Task Manager is a custom productivity tool designed to replace and extend commercial solutions like TickTick. It provides a clean, efficient interface for managing daily tasks, projects, team collaboration, and priorities.

## Key Features

- **Smart Lists:** Inbox, Today, Next 7 Days, Assigned to Me
- **Team Collaboration:** Create teams, invite members, share projects, and assign tasks
- **User Profiles:** Customizable profiles with avatars and sound preferences
- **Project Management:** Organize tasks with custom color-coded projects
- **Rich Text Tasks:** Detailed task descriptions powered by TipTap
- **Sub-tasks:** Break down complex tasks into smaller sub-tasks
- **Priorities & Due Dates:** Priority levels (None, Low, Medium, High) and due dates with overdue indicators
- **Tags:** Tagging system for flexible organization
- **Soft Delete:** Safe deletion functionality
- **Real-time Sync:** Instant synchronization via Supabase

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
