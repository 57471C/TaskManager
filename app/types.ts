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

export interface ProfileSettings {
  sound_enabled?: boolean;
  timezone?: string;
  [key: string]: unknown;
}

export type Task = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  priority: number;
  tags: string[];
  project_id: string | null;
  content: string | null;
  parent_id: string | null;
  team_id?: string | null;
  is_deleted?: boolean;
  user_id?: string;
  assigned_to?: string | null;
  sort_order?: number;
};

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email?: string | null;
  team_id: string | null;
  settings: ProfileSettings;
};