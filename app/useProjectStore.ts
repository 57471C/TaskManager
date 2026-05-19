import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Project, ProjectFolder } from './types';

interface ProjectState {
  projects: Project[];
  folders: ProjectFolder[];
  isLoading: boolean;
  
  setProjects: (updater: Project[] | ((prev: Project[]) => Project[])) => void;
  setFolders: (updater: ProjectFolder[] | ((prev: ProjectFolder[]) => ProjectFolder[])) => void;
  fetchProjectsAndFolders: (userId: string, teamId?: string | null) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  folders: [],
  isLoading: false,

  setProjects: (updater) => 
    set((state) => ({ 
      projects: typeof updater === 'function' ? updater(state.projects) : updater 
    })),
    
  setFolders: (updater) => 
    set((state) => ({ 
      folders: typeof updater === 'function' ? updater(state.folders) : updater 
    })),

  fetchProjectsAndFolders: async (userId, teamId) => {
    set({ isLoading: true });
    
    const { data: projects } = await supabase
      .from("projects")
      .select("*")
      .or(`user_id.eq.${userId}${teamId ? `,team_id.eq.${teamId}` : ""}`)
      .order("sort_order", { ascending: true })
      .order("name");

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
}));