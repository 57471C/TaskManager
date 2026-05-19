import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

// You would typically move these types to a shared `types.ts` file
export type Project = {
  id: string;
  name: string;
  colour: string;
  icon?: string | null;
  user_id?: string;
  team_id?: string | null;
  folder_id?: string | null;
  sort_order?: number;
};

export type ProjectFolder = {
  id: string;
  name: string;
  user_id?: string;
  team_id?: string | null;
  sort_order?: number;
};

interface ProjectState {
  projects: Project[];
  folders: ProjectFolder[];
  isLoading: boolean;
  
  // Actions
  setProjects: (projects: Project[]) => void;
  setFolders: (folders: ProjectFolder[]) => void;
  fetchProjectsAndFolders: (userId: string, teamId?: string | null) => Promise<void>;
  addProject: (project: Omit<Project, 'id'>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  folders: [],
  isLoading: false,

  setProjects: (projects) => set({ projects }),
  setFolders: (folders) => set({ folders }),

  fetchProjectsAndFolders: async (userId, teamId) => {
    set({ isLoading: true });
    
    // Fetch Projects
    const { data: projects } = await supabase
      .from("projects")
      .select("*")
      .or(`user_id.eq.${userId}${teamId ? `,team_id.eq.${teamId}` : ""}`)
      .order("sort_order", { ascending: true })
      .order("name");

    // Fetch Folders
    const { data: folders } = await supabase
      .from("project_folders")
      .select("*")
      .or(`user_id.eq.${userId}${teamId ? `,team_id.eq.${teamId}` : ""}`)
      .order("sort_order", { ascending: true })
      .order("name");

    set({ 
      projects: projects || [], 
      folders: folders || [],
      isLoading: false 
    });
  },

  addProject: async (project) => {
    const { data, error } = await supabase
      .from("projects")
      .insert(project)
      .select()
      .single();

    if (!error && data) {
      set((state) => ({ projects: [...state.projects, data] }));
    }
  },

  deleteProject: async (projectId) => {
    // Implementation for deletion...
  }
}));