"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import { User } from "@supabase/supabase-js";
import Image from "next/image";

type Project = {
  id: string;
  name: string;
  colour: string;
  user_id?: string;
  team_id?: string | null;
};

interface ProfileSettings {
  sound_enabled?: boolean;
  [key: string]: unknown;
}

type Task = {
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
};

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email?: string | null;
  team_id: string | null;
  settings: ProfileSettings;
};

const extensions = [
  StarterKit,
  Link.configure({
    openOnClick: false,
  }),
  Highlight,
];

export default function TaskManager() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authFirstName, setAuthFirstName] = useState("");
  const [authLastName, setAuthLastName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editProfileFirstName, setEditProfileFirstName] = useState("");
  const [editProfileLastName, setEditProfileLastName] = useState("");
  const [editProfileAvatarUrl, setEditProfileAvatarUrl] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState("");
  const [currentTeam, setCurrentTeam] = useState<{
    id: string;
    name: string;
    admin_id: string;
  } | null>(null);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [memberToRemove, setMemberToRemove] = useState<Profile | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedList, setSelectedList] = useState("Inbox");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [shareWithTeam, setShareWithTeam] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [selectedPriority, setSelectedPriority] = useState(0);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [showMenuForTask, setShowMenuForTask] = useState<string | null>(null);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [editPanelWidth, setEditPanelWidth] = useState(448);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditPriorityMenu, setShowEditPriorityMenu] = useState(false);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showEditTagMenu, setShowEditTagMenu] = useState(false);
  const [editTagInput, setEditTagInput] = useState("");
  const [showQuickAddProjectMenu, setShowQuickAddProjectMenu] = useState(false);
  const [showEditTaskProjectMenu, setShowEditTaskProjectMenu] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [projectInput, setProjectInput] = useState("");

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    content: editingTask?.content || "",
    onBlur: ({ editor }) => {
      const html = editor.getHTML();
      setEditingTask((prev) => {
        if (prev && prev.content !== html) {
          return { ...prev, content: html };
        }
        return prev;
      });
    },
    // Ensure the editor is always focused when a task is selected for editing
    autofocus: true,
  });

  // Synchronize TipTap editor content with editingTask.content
  useEffect(() => {
    if (
      editor &&
      editingTask &&
      editor.getHTML() !== (editingTask.content || "")
    ) {
      editor.commands.setContent(editingTask.content || "", {
        emitUpdate: false,
      });
    }
  }, [editingTask, editor]);

  // Auth Listener and Initial Session
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setAuthLoading(false);
    };
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: {
            first_name: authFirstName,
            last_name: authLastName,
          },
        },
      });
      if (error) setAuthError(error.message);
      else setAuthError("Success! Check your email for a confirmation link.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) setAuthError(error.message);
    }
    setIsSubmitting(false);
  };

  const handleCreateTeam = async (teamName: string) => {
    if (!user) return;
    // 1. Create the team
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({ name: teamName, admin_id: user.id })
      .select()
      .single();

    if (teamError) {
      // Postgres error code 23505 is for unique constraint violations
      if (teamError.code === "23505") {
        return alert(
          "A team with this name already exists. Please choose a unique name.",
        );
      }
      return alert(teamError.message);
    }

    // 2. Link the current user to this team
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ team_id: team.id })
      .eq("id", user.id);

    if (!profileError && profile) {
      setProfile({ ...profile, team_id: team.id });
      setCurrentTeam(team);
      setTeamMembers([profile]);
      setTeamNameInput("");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!user || !currentTeam) return;

    // 1. Remove member from team
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ team_id: null })
      .eq("id", memberId);

    if (profileError) return alert(profileError.message);

    // 2. Reassign their team tasks to the Admin (current user)
    await supabase
      .from("tasks")
      .update({ user_id: user.id })
      .eq("user_id", memberId)
      .eq("team_id", currentTeam.id);

    // Update local state
    setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
    // Refresh tasks to show updated ownership if necessary
    const { data: updatedTasks } = await supabase.from("tasks").select("*");
    if (updatedTasks) setTasks(updatedTasks);
    setMemberToRemove(null);
  };

  const handleAddMemberByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentTeam || !inviteEmail.trim()) return;

    // 1. Find the user by email in the profiles table
    const { data: targetProfile, error: searchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", inviteEmail.trim().toLowerCase())
      .single();

    if (searchError) {
      console.error("Search Error:", searchError);
      if (searchError.code === "PGRST116") {
        return alert(
          "User not found. Ensure they have created an account first.",
        );
      }
      return alert(`Error searching for user: ${searchError.message}`);
    }

    if (!targetProfile) {
      return alert(
        "User not found. Ensure they have created an account first.",
      );
    }

    // 2. Check if they are already in a team
    if (targetProfile.team_id) {
      return alert("This user is already a member of another team.");
    }

    // 3. Add them to your team
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({ team_id: currentTeam.id })
      .eq("id", targetProfile.id)
      .select()
      .single();

    if (updateError) {
      return alert(updateError.message);
    }

    // 4. Update UI
    if (updatedProfile) {
      setTeamMembers((prev) => {
        // Avoid duplicates if they were somehow already there
        if (prev.find((m) => m.id === updatedProfile.id)) return prev;
        return [...prev, updatedProfile];
      });
      setInviteEmail("");
      setShowAddMemberModal(false);
      alert(
        `${updatedProfile.first_name || "User"} has been added to the team!`,
      );
    }
  };

  const handleDeleteTeam = async () => {
    if (
      !user ||
      !currentTeam ||
      !confirm(
        "Are you sure you want to delete this team? Shared projects and tasks will lose their team association.",
      )
    )
      return;
    const { error } = await supabase
      .from("teams")
      .delete()
      .eq("id", currentTeam.id);
    if (!error) {
      setCurrentTeam(null);
      setTeamMembers([]);
      if (profile) setProfile({ ...profile, team_id: null });
    } else alert(error.message);
  };

  const handleLeaveTeam = async () => {
    if (
      !user ||
      !currentTeam ||
      !confirm("Are you sure you want to leave this team?")
    )
      return;
    const { error } = await supabase
      .from("profiles")
      .update({ team_id: null })
      .eq("id", user.id);
    if (!error) {
      setCurrentTeam(null);
      setTeamMembers([]);
      if (profile) setProfile({ ...profile, team_id: null });
    } else alert(error.message);
  };

  const playSuccessSound = useCallback(() => {
    const soundEnabled = profile?.settings?.sound_enabled ?? true;
    if (!soundEnabled) return;
    const audio = new Audio("/complete.mp3");
    audio.play().catch((err) => console.error("Audio play failed:", err));
  }, [profile]);

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploadingAvatar(true);
      if (!event.target.files || event.target.files.length === 0 || !user) {
        throw new Error("You must select an image to upload.");
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload the file to the 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get the public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // Append a timestamp to bypass browser caching
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
      setEditProfileAvatarUrl(cacheBustedUrl);

      // Auto-save the profile with the new URL immediately
      const { data: updatedProfile, error: dbError } = await supabase
        .from("profiles")
        .update({
          avatar_url: cacheBustedUrl,
          // Persist current field values in case they were edited before upload
          first_name: editProfileFirstName,
          last_name: editProfileLastName,
        })
        .eq("id", user.id)
        .select()
        .single();

      if (dbError) throw dbError;
      if (updatedProfile) setProfile(updatedProfile);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "An unknown error occurred";
      alert(message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .update({
        first_name: editProfileFirstName,
        last_name: editProfileLastName,
        avatar_url: editProfileAvatarUrl,
      })
      .eq("id", user.id)
      .select()
      .single();

    if (!error && data) {
      setProfile(data);
      setShowProfileModal(false);
    } else if (error) {
      alert(error.message);
    }
  };

  const handleSignOut = async () => {
    setShowProfileModal(false);
    await supabase.auth.signOut();
  };

  // Fetch data only when user is present
  useEffect(() => {
    if (!user) return;

    const fetchProjects = async () => {
      const { data } = await supabase
        .from("projects")
        .select("*")
        // Removing .eq("user_id") because RLS now handles
        // showing both Personal and Team projects
        .order("name");
      setProjects(data || []);
    };

    const fetchTasks = async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      setTasks(data || []);
    };

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      let profileData = data;
      if (error && error.code === "PGRST116") {
        // Profile doesn't exist yet, insert one manually if trigger isn't set up
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            first_name: user.user_metadata?.first_name || null,
            last_name: user.user_metadata?.last_name || null,
          })
          .select()
          .single();

        if (!insertError) profileData = newProfile;
      }

      if (profileData) {
        setProfile(profileData);
        // Initialize edit states immediately upon fetch
        setEditProfileFirstName(profileData.first_name || "");
        setEditProfileLastName(profileData.last_name || "");
        setEditProfileAvatarUrl(profileData.avatar_url || "");
      }

      if (profileData?.team_id) {
        const { data: teamData } = await supabase
          .from("teams")
          .select("*")
          .eq("id", profileData.team_id)
          .single();
        setCurrentTeam(teamData);

        const { data: members } = await supabase
          .from("profiles")
          .select("*")
          .eq("team_id", profileData.team_id);
        setTeamMembers(members || []);
      }
    };

    fetchProfile();
    fetchProjects();
    fetchTasks();
  }, [user]);

  const projectTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((task) => {
      if (task.project_id) {
        counts[task.project_id] = (counts[task.project_id] || 0) + 1;
      }
    });
    return counts;
  }, [tasks]);

  const handleAddProject = async () => {
    if (!projectInput.trim() || !user) return;
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: projectInput.trim(),
        colour: "#3b82f6",
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding project:", error);
      alert(`Failed to add project: ${error.message}`);
      return;
    }

    if (data) {
      setProjects((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setProjectInput("");
      setShowProjectMenu(false); // Close menu on success
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);
    if (!error) {
      const deletedProject = projects.find((p) => p.id === projectId);
      if (deletedProject && selectedList === deletedProject.name) {
        setSelectedList("Inbox");
      }
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    }
  };

  // Smart filtering
  const displayedTasks = useMemo(() => {
    const lower = selectedList.toLowerCase().trim();
    const inboxProject = projects.find((p) => p.name.toLowerCase() === "inbox");
    const inboxId = inboxProject?.id || null;

    const isVisibleInList = (task: Task) => {
      if (lower === "inbox")
        return !task.project_id || task.project_id === inboxId;
      if (lower === "today") {
        const today = new Date().toISOString().split("T")[0];
        return task.due_date && task.due_date.startsWith(today);
      }
      if (lower === "next 7 days") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const in7Days = new Date(today);
        in7Days.setDate(today.getDate() + 7);
        if (!task.due_date) return false;
        const due = new Date(task.due_date);
        due.setHours(0, 0, 0, 0);
        return due >= today && due <= in7Days;
      }
      const project = projects.find((p) => p.name === selectedList);
      return project ? task.project_id === project.id : true;
    };

    const result: Task[] = [];
    const flatten = (parentId: string | null) => {
      const children = tasks
        .filter((t) => t.parent_id === parentId)
        .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));

      children.forEach((task) => {
        const hasVisibleChild = (id: string): boolean => {
          const subs = tasks.filter((t) => t.parent_id === id);
          return subs.some((s) => isVisibleInList(s) || hasVisibleChild(s.id));
        };

        if (isVisibleInList(task) || hasVisibleChild(task.id)) {
          result.push(task);
          flatten(task.id);
        }
      });
    };

    flatten(null);
    return result;
  }, [tasks, selectedList, projects]);

  const handleQuickAdd = async () => {
    if (!newTaskTitle.trim() || !user) return;

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: newTaskTitle.trim(),
        status: "todo",
        priority: selectedPriority,
        project_id: selectedProjectId,
        due_date: selectedDate
          ? selectedDate.toISOString().split("T")[0]
          : null,
        tags: newTags,
        user_id: user.id,
        team_id: shareWithTeam ? currentTeam?.id : null,
      })
      .select()
      .single();

    if (!error && data) {
      setTasks((prev) => [data, ...prev]);
      setNewTaskTitle("");
      setIsAddingTask(false);
      setSelectedPriority(0);
      setSelectedDate(null);
      setNewTags([]);
      setShareWithTeam(false);
      setSelectedProjectId(null);
      setTimeout(() => setEditingTask(data), 100);
    }
  };

  const handleAddSubtask = async (parentId: string) => {
    if (!user) return;
    const parentTask = tasks.find((t) => t.id === parentId);

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: "New Sub-task",
        status: "todo",
        parent_id: parentId,
        project_id: parentTask?.project_id,
        user_id: user.id,
      })
      .select()
      .single();

    if (!error && data) {
      setTasks((prev) => [data, ...prev]);
      setEditingTask(data);
    }
  };

  const toggleTaskStatus = async (
    taskId: string,
    currentStatus: string | null,
  ) => {
    const newStatus = currentStatus === "done" ? "todo" : "done";

    if (newStatus === "done") {
      // Check if any sub-tasks are incomplete
      const hasIncompleteSubtasks = tasks.some(
        (t) => t.parent_id === taskId && t.status !== "done",
      );
      if (hasIncompleteSubtasks) {
        alert("Please complete all sub-tasks first.");
        return;
      }
      playSuccessSound();
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task,
      ),
    );

    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId);

    if (error) {
      alert("Failed to update task");
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, status: currentStatus ?? "todo" }
            : task,
        ),
      );
    }
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const getTaskDepth = (task: Task) => {
    if (!task.parent_id) return 0;
    const parent = tasks.find((t) => t.id === task.parent_id);
    if (!parent?.parent_id) return 1;
    return 2;
  };

  const isTodayDate = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const formatDateShort = (date: Date) => {
    if (isTodayDate(date)) return "Today";
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const y = date.getFullYear().toString().slice(-2);
    return `${d}/${m}/${y}`;
  };

  const smartLists = ["Inbox", "Today", "Next 7 Days", "Assigned to Me"];

  if (authLoading)
    return (
      <div className="h-screen bg-[#0f1117] flex items-center justify-center text-white">
        Loading...
      </div>
    );

  if (!user) {
    return (
      <div className="h-screen bg-[#0f1117] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#1e2130] border border-[#374151] rounded-xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-6 text-center">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h1>
          {authError && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm ${authError.includes("Success") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
            >
              {authError}
            </div>
          )}
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="First Name"
                  value={authFirstName}
                  onChange={(e) => setAuthFirstName(e.target.value)}
                  className="bg-[#0f1117] border border-[#374151] rounded-lg px-4 py-3 text-white focus:border-[#3b82f6] outline-none text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={authLastName}
                  onChange={(e) => setAuthLastName(e.target.value)}
                  className="bg-[#0f1117] border border-[#374151] rounded-lg px-4 py-3 text-white focus:border-[#3b82f6] outline-none text-sm"
                  required
                />
              </div>
            )}
            <input
              type="email"
              placeholder="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#374151] rounded-lg px-4 py-3 text-white focus:border-[#3b82f6] outline-none"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#374151] rounded-lg px-4 py-3 text-white focus:border-[#3b82f6] outline-none"
              required
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting
                ? "Processing..."
                : isSignUp
                  ? "Sign Up"
                  : "Sign In"}
            </button>
          </form>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full mt-6 text-sm text-[#6b7280] hover:text-white transition-colors"
          >
            {isSignUp
              ? "Already have an account? Sign In"
              : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0f1117] text-[#d1d5db]">
      {/* Custom Styles for TipTap Content */}
      <style jsx global>{`
        /* Global Dark Scrollbars */
        * {
          scrollbar-width: thin;
          scrollbar-color: #374151 #0f1117;
        }

        /* Chrome, Edge, and Safari */
        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        *::-webkit-scrollbar-track {
          background: #0f1117;
        }

        *::-webkit-scrollbar-thumb {
          background-color: #374151;
          border-radius: 20px;
          border: 2px solid #0f1117;
        }

        *::-webkit-scrollbar-thumb:hover {
          background-color: #4b5563;
        }

        .tiptap-editor .ProseMirror {
          outline: none;
        }
        .tiptap-editor .ProseMirror ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .tiptap-editor .ProseMirror ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .tiptap-editor .ProseMirror a {
          color: #3b82f6;
          text-decoration: underline;
          cursor: pointer;
        }
        .tiptap-editor .ProseMirror h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1rem;
        }
      `}</style>

      {/* Sidebar */}
      <div className="w-64 border-r border-[#1e2130] p-4 flex flex-col">
        {/* User Profile Section (Moved to top) */}
        <div
          onClick={() => setShowProfileModal(true)}
          className="mb-4 px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-[#1e2130] rounded-lg transition-colors border-b border-[#1e2130] pb-4"
        >
          {profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt="Avatar"
              width={32}
              height={32}
              className="rounded-full object-cover border border-[#374151]"
              unoptimized
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#3b82f6] flex items-center justify-center text-white text-xs font-bold shadow-inner flex-shrink-0">
              {(
                profile?.first_name?.[0] ||
                user.email?.[0] ||
                "U"
              ).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {profile?.first_name
                ? `${profile.first_name} ${profile.last_name || ""}`
                : "User"}
            </p>
            <p className="text-[10px] text-[#6b7280] truncate">{user.email}</p>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">Task Manager</h1>
          <p className="text-sm text-[#6b7280]">QHSE Team</p>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-[#6b7280] mb-2 px-2">
            Smart Lists
          </p>
          <div className="space-y-1">
            {smartLists.map((list) => (
              <button
                key={list}
                onClick={() => setSelectedList(list)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedList === list
                    ? "bg-[#1e2130] text-white"
                    : "hover:bg-[#1e2130]"
                }`}
              >
                {list}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-2 px-2">
            <p className="text-xs uppercase tracking-widest text-[#6b7280]">
              Projects
            </p>
            <div className="relative">
              <button
                onClick={() => setShowProjectMenu(!showProjectMenu)}
                className="text-[#6b7280] hover:text-white transition-colors"
              >
                ⋯
              </button>

              {showProjectMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProjectMenu(false)}
                  />
                  <div className="absolute left-0 mt-2 w-64 bg-[#1e2130] border border-[#374151] rounded-lg shadow-xl p-3 z-50">
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="New project..."
                        value={projectInput}
                        onChange={(e) => setProjectInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddProject();
                          }
                        }}
                        className="flex-1 bg-[#0f1117] border border-[#374151] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#3b82f6]"
                      />
                    </div>
                    <div className="space-y-1 max-h-48 overflow-auto">
                      {projects
                        .filter((project) => !smartLists.includes(project.name))
                        .map((project) => {
                          const hasTasks =
                            (projectTaskCounts[project.id] || 0) > 0;
                          return (
                            <div
                              key={project.id}
                              className="flex items-center justify-between group px-2 py-1.5 hover:bg-[#374151] rounded transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: project.colour }}
                                />
                                <span className="text-xs">{project.name}</span>
                              </div>
                              {!hasTasks && (
                                <button
                                  onClick={() =>
                                    handleDeleteProject(project.id)
                                  }
                                  className="text-[#6b7280] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="space-y-1">
            {projects
              .filter((project) => !smartLists.includes(project.name))
              .map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedList(project.name)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    selectedList === project.name
                      ? "bg-[#1e2130] text-white"
                      : "hover:bg-[#1e2130]"
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: project.colour }}
                  />
                  {project.name}
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar - Inline Add Task */}
        <div className="border-b border-[#1e2130] px-6 py-3 bg-[#0f1117]">
          <div className="w-full max-w-[620px]">
            {!isAddingTask ? (
              <div
                onClick={() => setIsAddingTask(true)}
                className="flex items-center gap-3 bg-[#1e2130] hover:bg-[#252a38] text-[#6b7280] px-4 py-2.5 rounded-lg cursor-text border border-transparent hover:border-[#374151] w-full max-w-[620px] transition-all"
              >
                <span className="text-lg">+</span>
                <span>Add Task</span>
              </div>
            ) : (
              <div className="bg-[#1e2130] border border-[#3b82f6] rounded-lg px-4 py-3 w-full max-w-[620px]">
                <input
                  type="text"
                  placeholder="What would you like to do?"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleQuickAdd();
                  }}
                  className="w-full bg-transparent text-white placeholder-[#6b7280] focus:outline-none text-[15px]"
                  autoFocus
                />

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <button
                        onClick={() => setShowDatePicker(!showDatePicker)}
                        className={`transition-colors px-1 flex items-center justify-center ${
                          selectedDate
                            ? isPastDate(selectedDate)
                              ? "text-red-500"
                              : "text-[#3b82f6]"
                            : "text-[#6b7280] hover:text-white"
                        }`}
                        title="Set due date"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="4"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          ></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                      </button>

                      {showDatePicker && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowDatePicker(false)}
                          />
                          <div className="absolute left-0 mt-2 w-48 bg-[#1e2130] border border-[#374151] rounded-lg shadow-lg py-2 z-50">
                            <div className="px-2 pb-2 mb-2 border-b border-[#374151] grid grid-cols-1 gap-1">
                              <button
                                onClick={() => {
                                  setSelectedDate(new Date());
                                  setShowDatePicker(false);
                                }}
                                className="w-full px-2 py-1.5 text-left text-xs hover:bg-[#374151] rounded transition-colors flex justify-between"
                              >
                                <span>Today</span>
                                <span className="text-[#6b7280]">Tue</span>
                              </button>
                              <button
                                onClick={() => {
                                  const tomorrow = new Date();
                                  tomorrow.setDate(tomorrow.getDate() + 1);
                                  setSelectedDate(tomorrow);
                                  setShowDatePicker(false);
                                }}
                                className="w-full px-2 py-1.5 text-left text-xs hover:bg-[#374151] rounded transition-colors flex justify-between"
                              >
                                <span>Tomorrow</span>
                                <span className="text-[#6b7280]">Wed</span>
                              </button>
                              <button
                                onClick={() => {
                                  const nextWeek = new Date();
                                  nextWeek.setDate(nextWeek.getDate() + 7);
                                  setSelectedDate(nextWeek);
                                  setShowDatePicker(false);
                                }}
                                className="w-full px-2 py-1.5 text-left text-xs hover:bg-[#374151] rounded transition-colors flex justify-between"
                              >
                                <span>Next Week</span>
                                <span className="text-[#6b7280]">+7d</span>
                              </button>
                            </div>
                            <div className="px-2">
                              <input
                                type="date"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    setSelectedDate(new Date(e.target.value));
                                    setShowDatePicker(false);
                                  }
                                }}
                                className="w-full bg-[#0f1117] border border-[#374151] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#3b82f6]"
                              />
                            </div>
                            {selectedDate && (
                              <button
                                onClick={() => {
                                  setSelectedDate(null);
                                  setShowDatePicker(false);
                                }}
                                className="w-full mt-2 px-2 py-1 text-center text-[10px] text-red-400 hover:underline"
                              >
                                Clear Date
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {selectedDate && (
                      <span
                        className={`text-xs font-medium ${
                          isPastDate(selectedDate)
                            ? "text-red-500"
                            : "text-[#3b82f6]"
                        }`}
                      >
                        {formatDateShort(selectedDate)}
                      </span>
                    )}

                    <div className="relative">
                      <button
                        onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                        className={`transition-colors px-1 flex items-center justify-center ${
                          selectedPriority === 5
                            ? "text-red-500"
                            : selectedPriority === 3
                              ? "text-orange-500"
                              : selectedPriority === 1
                                ? "text-blue-500"
                                : "text-[#6b7280] hover:text-white"
                        }`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill={
                            selectedPriority === 0 ? "none" : "currentColor"
                          }
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="transition-all"
                        >
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <line x1="4" x2="4" y1="22" y2="15" />
                        </svg>
                      </button>

                      {showPriorityMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowPriorityMenu(false)}
                          />
                          <div className="absolute left-0 mt-2 w-44 bg-[#1e2130] border border-[#374151] rounded-lg shadow-lg py-1 z-50">
                            <button
                              onClick={() => {
                                setSelectedPriority(0);
                                setShowPriorityMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2"
                            >
                              <span className="text-[#6b7280]">●</span> None
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPriority(1);
                                setShowPriorityMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2"
                            >
                              <span className="text-blue-500">●</span> Low
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPriority(3);
                                setShowPriorityMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2"
                            >
                              <span className="text-orange-500">●</span> Medium
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPriority(5);
                                setShowPriorityMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2"
                            >
                              <span className="text-red-500">●</span> High
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setShowTagMenu(!showTagMenu)}
                        className={`transition-colors px-1 flex items-center justify-center ${newTags.length > 0 ? "text-[#3b82f6]" : "text-[#6b7280] hover:text-white"}`}
                        title="Add tags (max 4)"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                          <path d="M7 7h.01" />
                        </svg>
                      </button>

                      {showTagMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowTagMenu(false)}
                          />
                          <div className="absolute left-0 mt-2 w-48 bg-[#1e2130] border border-[#374151] rounded-lg shadow-lg p-3 z-50">
                            <div className="flex gap-2 mb-3">
                              <input
                                type="text"
                                placeholder="Tag name..."
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "Enter" &&
                                    tagInput.trim() &&
                                    newTags.length < 4
                                  ) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setNewTags([...newTags, tagInput.trim()]);
                                    setTagInput("");
                                  }
                                }}
                                className="flex-1 bg-[#0f1117] border border-[#374151] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#3b82f6]"
                              />
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {newTags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-[#374151] text-[#9ca3af] flex items-center gap-1"
                                >
                                  {tag}
                                  <button
                                    onClick={() =>
                                      setNewTags(
                                        newTags.filter(
                                          (_, index) => index !== i,
                                        ),
                                      )
                                    }
                                    className="hover:text-red-400"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              {newTags.length === 0 && (
                                <p className="text-[10px] text-[#6b7280]">
                                  No tags added
                                </p>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() =>
                          setShowQuickAddProjectMenu(!showQuickAddProjectMenu)
                        }
                        className={`transition-colors px-1 flex items-center justify-center ${selectedProjectId ? "text-[#3b82f6]" : "text-[#6b7280] hover:text-white"}`}
                        title="Assign project"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                        </svg>
                      </button>

                      {showQuickAddProjectMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowQuickAddProjectMenu(false)}
                          />
                          <div className="absolute left-0 mt-2 w-48 bg-[#1e2130] border border-[#374151] rounded-lg shadow-lg py-1 z-50 overflow-hidden">
                            <button
                              onClick={() => {
                                setSelectedProjectId(null);
                                setShowQuickAddProjectMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2"
                            >
                              <span className="text-[#6b7280]">●</span> Inbox
                            </button>
                            {projects
                              .filter((p) => !smartLists.includes(p.name))
                              .map((project) => (
                                <button
                                  key={project.id}
                                  onClick={() => {
                                    setSelectedProjectId(project.id);
                                    setShowQuickAddProjectMenu(false);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2"
                                >
                                  <span style={{ color: project.colour }}>
                                    ●
                                  </span>
                                  {project.name}
                                </button>
                              ))}
                          </div>
                        </>
                      )}
                    </div>
                    <span className="text-xs text-[#3b82f6] font-medium">
                      {selectedProjectId
                        ? projects.find((p) => p.id === selectedProjectId)?.name
                        : "Inbox"}
                    </span>

                    {profile?.team_id && (
                      <div className="flex items-center gap-2 ml-2 border-l border-[#374151] pl-3">
                        <button
                          onClick={() => setShareWithTeam(!shareWithTeam)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-[10px] font-bold uppercase tracking-wider ${
                            shareWithTeam
                              ? "bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30"
                              : "bg-[#374151] text-[#6b7280] border border-transparent hover:text-white"
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                          </svg>
                          {shareWithTeam ? "Team" : "Private"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsAddingTask(false);
                        setNewTaskTitle("");
                        setSelectedDate(null);
                      }}
                      className="px-3 py-1 text-sm text-[#6b7280] hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleQuickAdd}
                      disabled={!newTaskTitle.trim()}
                      className="px-4 py-1 bg-[#3b82f6] text-white rounded text-sm font-medium disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Task List */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl space-y-4">
            {/* OPEN TASKS */}
            {displayedTasks
              .filter((t) => t.status !== "done")
              .map((task) => {
                const dateObj = task.due_date ? new Date(task.due_date) : null;
                const isOverdue = dateObj ? isPastDate(dateObj) : false;
                const dateLabel = dateObj ? formatDateShort(dateObj) : null;
                const depth = getTaskDepth(task);

                return (
                  <div
                    key={task.id}
                    onClick={() => setEditingTask(task)}
                    style={{ marginLeft: `${depth * 28}px` }}
                    className={`bg-[#1e2130] p-4 rounded-lg flex items-center gap-3 border-l-4 cursor-pointer hover:bg-[#252a38] transition-colors relative group/task ${
                      task.priority === 5
                        ? "border-red-500"
                        : task.priority === 3
                          ? "border-orange-500"
                          : task.priority === 1
                            ? "border-blue-500"
                            : "border-transparent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={task.status === "done"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => {
                        toggleTaskStatus(task.id, task.status);
                      }}
                      className="w-4 h-4 accent-[#22c55e] cursor-pointer"
                    />

                    <span
                      className={`flex-1 ${task.status === "done" ? "line-through text-[#6b7280]" : ""}`}
                    >
                      {task.title}
                    </span>

                    {task.tags?.length > 0 && (
                      <div className="flex gap-1 ml-auto mr-2">
                        {task.tags.slice(0, 4).map((tag, i) => (
                          <span
                            key={i}
                            className="text-[9px] px-1.5 py-0 rounded-full border border-[#374151] bg-[#1e2130] text-[#9ca3af]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {dateLabel && (
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded border whitespace-nowrap ${
                          isOverdue
                            ? "text-red-500 border-red-500/30 bg-red-500/10"
                            : "text-[#3b82f6] border-[#3b82f6]/30 bg-[#3b82f6]/10"
                        }`}
                      >
                        {dateLabel}
                      </span>
                    )}

                    <div
                      className="relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setShowMenuForTask(
                            showMenuForTask === task.id ? null : task.id,
                          )
                        }
                        className="text-[#6b7280] hover:text-white px-2 py-1 text-lg leading-none"
                      >
                        ⋯
                      </button>

                      {showMenuForTask === task.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowMenuForTask(null)}
                          />
                          <div className="absolute right-0 mt-1 w-40 bg-[#1e2130] border border-[#374151] rounded-lg shadow-lg py-1 z-50">
                            <button
                              onClick={async () => {
                                const { error } = await supabase
                                  .from("tasks")
                                  .update({ is_deleted: true })
                                  .eq("id", task.id);

                                if (!error) {
                                  setTasks((prev) =>
                                    prev.filter((t) => t.id !== task.id),
                                  );
                                } else {
                                  alert("Failed to delete task");
                                }
                                setShowMenuForTask(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2 text-red-400"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* COMPLETED TASKS SEPARATOR */}
            {displayedTasks.some((t) => t.status === "done") && (
              <div className="pt-8 pb-4">
                <div className="flex items-center gap-4">
                  <div className="h-px bg-[#1e2130] flex-1"></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280] whitespace-nowrap">
                    Completed
                  </span>
                  <div className="h-px bg-[#1e2130] flex-1"></div>
                </div>
              </div>
            )}

            {/* COMPLETED TASKS */}
            {displayedTasks
              .filter((t) => t.status === "done")
              .map((task) => {
                return (
                  <div
                    key={task.id}
                    onClick={() => setEditingTask(task)}
                    style={{ marginLeft: `${getTaskDepth(task) * 28}px` }}
                    className="bg-[#1e2130]/40 p-4 rounded-lg flex items-center gap-3 border-l-4 border-transparent cursor-pointer hover:bg-[#1e2130] transition-colors relative opacity-60"
                  >
                    <input
                      type="checkbox"
                      checked={true}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => {
                        toggleTaskStatus(task.id, task.status);
                      }}
                      className="w-4 h-4 accent-[#22c55e] cursor-pointer"
                    />

                    <span className="flex-1 line-through text-[#6b7280]">
                      {task.title}
                    </span>

                    <div
                      className="relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setShowMenuForTask(
                            showMenuForTask === task.id ? null : task.id,
                          )
                        }
                        className="text-[#6b7280] hover:text-white px-2 py-1 text-lg leading-none"
                      >
                        ⋯
                      </button>

                      {showMenuForTask === task.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowMenuForTask(null)}
                          />
                          <div className="absolute right-0 mt-1 w-40 bg-[#1e2130] border border-[#374151] rounded-lg shadow-lg py-1 z-50">
                            <button
                              onClick={async () => {
                                const { error } = await supabase
                                  .from("tasks")
                                  .update({ is_deleted: true })
                                  .eq("id", task.id);

                                if (!error) {
                                  setTasks((prev) =>
                                    prev.filter((t) => t.id !== task.id),
                                  );
                                } else {
                                  alert("Failed to delete task");
                                }
                                setShowMenuForTask(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2 text-red-400"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

            {displayedTasks.length === 0 && (
              <p className="text-[#6b7280]">No tasks in this view.</p>
            )}
          </div>
        </div>
      </div>

      {/* User Profile Edit Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowProfileModal(false)}
          />
          <div className="relative bg-[#1e2130] border border-[#374151] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-[#374151] flex justify-between items-center bg-[#1e2130]">
              <h2 className="text-lg font-semibold text-white">Edit Profile</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-[#6b7280] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={editProfileFirstName}
                    onChange={(e) => setEditProfileFirstName(e.target.value)}
                    className="w-full bg-[#0f1117] border border-[#374151] rounded-lg px-4 py-2.5 text-white focus:border-[#3b82f6] outline-none text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editProfileLastName}
                    onChange={(e) => setEditProfileLastName(e.target.value)}
                    className="w-full bg-[#0f1117] border border-[#374151] rounded-lg px-4 py-2.5 text-white focus:border-[#3b82f6] outline-none text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider block">
                  Avatar
                </label>
                <div className="flex items-center gap-4">
                  {editProfileAvatarUrl ? (
                    <Image
                      src={editProfileAvatarUrl}
                      alt="Preview"
                      width={48}
                      height={48}
                      className="rounded-full object-cover border border-[#374151]"
                      unoptimized
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#3b82f6] flex items-center justify-center text-white font-bold">
                      {(
                        editProfileFirstName?.[0] ||
                        user.email?.[0] ||
                        "U"
                      ).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/png, image/jpeg"
                      onChange={uploadAvatar}
                      disabled={isUploadingAvatar}
                      className="hidden"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="inline-block px-4 py-2 bg-[#0f1117] border border-[#374151] rounded-lg text-xs font-medium text-white cursor-pointer hover:bg-[#374151] transition-colors"
                    >
                      {isUploadingAvatar ? "Uploading..." : "Upload PNG/JPG"}
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider block">
                  Team
                </label>
                {!profile?.team_id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Team Name"
                      value={teamNameInput}
                      onChange={(e) => setTeamNameInput(e.target.value)}
                      className="flex-1 bg-[#0f1117] border border-[#374151] rounded-lg px-4 py-2.5 text-white focus:border-[#3b82f6] outline-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleCreateTeam(teamNameInput)}
                      disabled={!teamNameInput.trim()}
                      className="px-4 py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Create
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-[#0f1117] border border-[#374151] rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white font-medium">
                          {currentTeam?.name || "Joined Team"}
                        </span>
                        {currentTeam?.admin_id === user.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-orange-500/20 text-orange-500 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                              Admin
                            </span>
                            <button
                              type="button"
                              onClick={handleDeleteTeam}
                              className="text-red-500 hover:text-red-400 transition-colors p-1 bg-red-500/10 rounded-md ml-1"
                              title="Delete Team"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-[#3b82f6]/20 text-[#3b82f6] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                              Member
                            </span>
                            <button
                              type="button"
                              onClick={handleLeaveTeam}
                              className="text-[10px] text-red-400 hover:underline"
                            >
                              Leave
                            </button>
                          </div>
                        )}
                      </div>
                      {currentTeam?.admin_id === user.id && (
                        <button
                          type="button"
                          onClick={() => setShowAddMemberModal(true)}
                          className="mt-2 text-[10px] text-[#3b82f6] hover:underline flex items-center gap-1"
                        >
                          + Add Member
                        </button>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {teamMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1e2130] border border-[#374151] text-[11px] text-white"
                          >
                            <span>{member.first_name || "User"}</span>
                            {currentTeam?.admin_id === user.id &&
                              member.id !== user.id && (
                                <button
                                  type="button"
                                  onClick={() => setMemberToRemove(member)}
                                  className="text-[#6b7280] hover:text-red-400 transition-colors ml-1 font-bold"
                                >
                                  ×
                                </button>
                              )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider block">
                  Preferences
                </label>
                <div className="flex items-center justify-between p-3 bg-[#0f1117] border border-[#374151] rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-[#6b7280]">
                      {(profile?.settings?.sound_enabled ?? true) ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                          <line x1="23" y1="9" x2="17" y2="15"></line>
                          <line x1="17" y1="9" x2="23" y2="15"></line>
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-white">Completion Sound</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user || !profile) return;
                      const currentSettings = profile.settings || {};
                      const newValue = !(currentSettings.sound_enabled ?? true);

                      const { data, error } = await supabase
                        .from("profiles")
                        .update({
                          settings: {
                            ...currentSettings,
                            sound_enabled: newValue,
                          },
                        })
                        .eq("id", user.id)
                        .select()
                        .single();

                      if (!error && data) {
                        setProfile(data);
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      (profile?.settings?.sound_enabled ?? true)
                        ? "bg-[#3b82f6]"
                        : "bg-[#374151]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (profile?.settings?.sound_enabled ?? true)
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-[#374151] hover:bg-[#374151] text-white text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Save Changes
                </button>
              </div>

              <div className="pt-4 border-t border-[#374151]">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors font-medium"
                >
                  Sign Out from Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Panel */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={async () => {
              const currentContent = editor?.getHTML() || editingTask.content;
              const { error } = await supabase
                .from("tasks")
                .update({
                  title: editingTask.title,
                  content: currentContent || null,
                  due_date: editingTask.due_date,
                  priority: editingTask.priority,
                  tags: editingTask.tags,
                  project_id: editingTask.project_id,
                })
                .eq("id", editingTask.id);

              if (!error) {
                setTasks((prev) =>
                  prev.map((t) =>
                    t.id === editingTask.id
                      ? { ...editingTask, content: currentContent }
                      : t,
                  ),
                );
              }
              setEditingTask(null);
            }}
          />

          <div
            className="relative bg-[#1e2130] h-full shadow-2xl flex flex-col animate-slide-in-right border-l border-[#374151]"
            style={{ width: `${editPanelWidth}px`, minWidth: "380px" }}
          >
            <div
              className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-[#3b82f6] transition-colors z-10"
              onMouseDown={(e) => {
                const startX = e.clientX;
                const startWidth = editPanelWidth;

                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const newWidth = startWidth - (moveEvent.clientX - startX);
                  if (newWidth >= 380) setEditPanelWidth(newWidth);
                };

                const handleMouseUp = () => {
                  document.removeEventListener("mousemove", handleMouseMove);
                  document.removeEventListener("mouseup", handleMouseUp);
                };

                document.addEventListener("mousemove", handleMouseMove);
                document.addEventListener("mouseup", handleMouseUp);
              }}
            />
            <div className="flex-1 p-6 overflow-auto space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-[#6b7280]">TITLE</label>
                  <button
                    onClick={() => setEditingTask(null)}
                    className="text-[#6b7280] hover:text-white text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, title: e.target.value })
                  }
                  className="w-full bg-[#0f1117] border border-[#374151] rounded-lg px-4 py-3 focus:outline-none focus:border-[#3b82f6]"
                />
              </div>

              <div className="flex items-center gap-4">
                {/* Date Picker */}
                <div className="relative">
                  <button
                    onClick={() => setShowEditDatePicker(!showEditDatePicker)}
                    className={`transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#374151] text-xs font-medium ${
                      editingTask.due_date
                        ? isPastDate(new Date(editingTask.due_date))
                          ? "text-red-500 border-red-500/30 bg-red-500/5"
                          : "text-[#3b82f6] border-[#3b82f6]/30 bg-[#3b82f6]/5"
                        : "text-[#6b7280] hover:text-white hover:bg-[#374151]"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {editingTask.due_date
                      ? formatDateShort(new Date(editingTask.due_date))
                      : "No Date"}
                  </button>

                  {showEditDatePicker && (
                    <>
                      <div
                        className="fixed inset-0 z-50"
                        onClick={() => setShowEditDatePicker(false)}
                      />
                      <div className="absolute left-0 mt-2 w-48 bg-[#1e2130] border border-[#374151] rounded-lg shadow-xl py-2 z-[60]">
                        <div className="px-2 pb-2 mb-2 border-b border-[#374151] grid grid-cols-1 gap-1">
                          <button
                            onClick={() => {
                              setEditingTask({
                                ...editingTask,
                                due_date: new Date()
                                  .toISOString()
                                  .split("T")[0],
                              });
                              setShowEditDatePicker(false);
                            }}
                            className="w-full px-2 py-1.5 text-left text-xs hover:bg-[#374151] rounded transition-colors flex justify-between"
                          >
                            <span>Today</span>
                          </button>
                          <button
                            onClick={() => {
                              const tomorrow = new Date();
                              tomorrow.setDate(tomorrow.getDate() + 1);
                              setEditingTask({
                                ...editingTask,
                                due_date: tomorrow.toISOString().split("T")[0],
                              });
                              setShowEditDatePicker(false);
                            }}
                            className="w-full px-2 py-1.5 text-left text-xs hover:bg-[#374151] rounded transition-colors"
                          >
                            Tomorrow
                          </button>
                        </div>
                        <div className="px-2">
                          <input
                            type="date"
                            value={editingTask.due_date || ""}
                            onChange={(e) => {
                              setEditingTask({
                                ...editingTask,
                                due_date: e.target.value,
                              });
                              setShowEditDatePicker(false);
                            }}
                            className="w-full bg-[#0f1117] border border-[#374151] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#3b82f6]"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Priority Selector */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setShowEditPriorityMenu(!showEditPriorityMenu)
                    }
                    className={`transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#374151] text-xs font-medium ${
                      editingTask.priority === 5
                        ? "text-red-500 border-red-500/30 bg-red-500/5"
                        : editingTask.priority === 3
                          ? "text-orange-500 border-orange-500/30 bg-orange-500/5"
                          : editingTask.priority === 1
                            ? "text-blue-500 border-blue-500/30 bg-blue-500/5"
                            : "text-[#6b7280] hover:text-white hover:bg-[#374151]"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill={
                        editingTask.priority === 0 ? "none" : "currentColor"
                      }
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" x2="4" y1="22" y2="15" />
                    </svg>
                    {editingTask.priority === 5
                      ? "High"
                      : editingTask.priority === 3
                        ? "Medium"
                        : editingTask.priority === 1
                          ? "Low"
                          : "No Priority"}
                  </button>

                  {showEditPriorityMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-50"
                        onClick={() => setShowEditPriorityMenu(false)}
                      />
                      <div className="absolute left-0 mt-2 w-44 bg-[#1e2130] border border-[#374151] rounded-lg shadow-xl py-1 z-[60]">
                        <button
                          onClick={() => {
                            setEditingTask({ ...editingTask, priority: 0 });
                            setShowEditPriorityMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2"
                        >
                          <span className="text-[#6b7280]">●</span> None
                        </button>
                        <button
                          onClick={() => {
                            setEditingTask({ ...editingTask, priority: 1 });
                            setShowEditPriorityMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2"
                        >
                          <span className="text-blue-500">●</span> Low
                        </button>
                        <button
                          onClick={() => {
                            setEditingTask({ ...editingTask, priority: 3 });
                            setShowEditPriorityMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2"
                        >
                          <span className="text-orange-500">●</span> Medium
                        </button>
                        <button
                          onClick={() => {
                            setEditingTask({ ...editingTask, priority: 5 });
                            setShowEditPriorityMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2"
                        >
                          <span className="text-red-500">●</span> High
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Edit Tags */}
                <div className="relative">
                  <button
                    onClick={() => setShowEditTagMenu(!showEditTagMenu)}
                    className={`transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#374151] text-xs font-medium ${
                      editingTask.tags?.length > 0
                        ? "text-[#3b82f6] border-[#3b82f6]/30 bg-[#3b82f6]/5"
                        : "text-[#6b7280] hover:text-white hover:bg-[#374151]"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                      <path d="M7 7h.01" />
                    </svg>
                    {editingTask.tags?.length > 0
                      ? `${editingTask.tags.length} Tags`
                      : "No Tags"}
                  </button>

                  {showEditTagMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-50"
                        onClick={() => setShowEditTagMenu(false)}
                      />
                      <div className="absolute left-0 mt-2 w-48 bg-[#1e2130] border border-[#374151] rounded-lg shadow-xl p-3 z-[60]">
                        <div className="flex gap-2 mb-3">
                          <input
                            type="text"
                            placeholder="Tag name..."
                            value={editTagInput}
                            onChange={(e) => setEditTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                editTagInput.trim() &&
                                (editingTask.tags?.length || 0) < 4
                              ) {
                                e.preventDefault();
                                e.stopPropagation();
                                const updatedTags = [
                                  ...(editingTask.tags || []),
                                  editTagInput.trim(),
                                ];
                                setEditingTask({
                                  ...editingTask,
                                  tags: updatedTags,
                                });
                                setEditTagInput("");
                              }
                            }}
                            className="flex-1 bg-[#0f1117] border border-[#374151] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#3b82f6]"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {editingTask.tags?.map((tag, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-[#374151] text-[#9ca3af] flex items-center gap-1"
                            >
                              {tag}
                              <button
                                onClick={() => {
                                  const updatedTags = editingTask.tags?.filter(
                                    (_, index) => index !== i,
                                  );
                                  setEditingTask({
                                    ...editingTask,
                                    tags: updatedTags || [],
                                  });
                                }}
                                className="hover:text-red-400"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Project Selector */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setShowEditTaskProjectMenu(!showEditTaskProjectMenu)
                    }
                    className={`transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#374151] text-xs font-medium ${
                      editingTask.project_id
                        ? "text-[#3b82f6] border-[#3b82f6]/30 bg-[#3b82f6]/5"
                        : "text-[#6b7280] hover:text-white hover:bg-[#374151]"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                    </svg>
                    {editingTask.project_id
                      ? projects.find((p) => p.id === editingTask.project_id)
                          ?.name
                      : "Inbox"}
                  </button>

                  {showEditTaskProjectMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-50"
                        onClick={() => setShowEditTaskProjectMenu(false)}
                      />
                      <div className="absolute left-0 mt-2 w-48 bg-[#1e2130] border border-[#374151] rounded-lg shadow-xl py-1 z-[60] overflow-hidden">
                        <button
                          onClick={() => {
                            setEditingTask({
                              ...editingTask,
                              project_id: null,
                            });
                            setShowEditTaskProjectMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2"
                        >
                          <span className="text-[#6b7280]">●</span> Inbox
                        </button>
                        {projects
                          .filter((p) => !smartLists.includes(p.name))
                          .map((project) => (
                            <button
                              key={project.id}
                              onClick={() => {
                                setEditingTask({
                                  ...editingTask,
                                  project_id: project.id,
                                });
                                setShowEditTaskProjectMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-[#374151] flex items-center gap-2"
                            >
                              <span style={{ color: project.colour }}>●</span>
                              {project.name}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Sub-task Section */}
              {getTaskDepth(editingTask) < 2 && (
                <div>
                  <label className="text-sm text-[#6b7280] block mb-2">
                    SUB-TASKS
                  </label>
                  <button
                    onClick={() => handleAddSubtask(editingTask.id)}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-[#0f1117] border border-[#374151] hover:border-[#3b82f6] rounded-lg text-xs text-[#6b7280] hover:text-[#3b82f6] transition-all"
                  >
                    <span className="text-lg leading-none">+</span>
                    <span>Create sub-task</span>
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm text-[#6b7280] mb-2">
                  DESCRIPTION
                </label>

                <div className="relative group">
                  {/* TipTap Editor */}
                  <div className="bg-[#0f1117] border border-[#374151] rounded-lg p-4 min-h-[180px] pb-14 tiptap-editor transition-all focus-within:border-[#3b82f6]">
                    <EditorContent editor={editor} />
                  </div>

                  {/* Centralized Hover Toolbar (exactly as you had it) */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 p-1 bg-[#1e2130] rounded-full border border-[#374151] shadow-2xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto transition-all duration-200 z-10 whitespace-nowrap">
                    {editor && (
                      <>
                        <button
                          onClick={() =>
                            editor.chain().focus().toggleBold().run()
                          }
                          className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-colors ${editor.isActive("bold") ? "bg-[#3b82f6] text-white" : "hover:bg-[#374151] text-[#6b7280]"}`}
                        >
                          B
                        </button>
                        <button
                          onClick={() =>
                            editor.chain().focus().toggleItalic().run()
                          }
                          className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-colors ${editor.isActive("italic") ? "bg-[#3b82f6] text-white" : "hover:bg-[#374151] text-[#6b7280]"}`}
                        >
                          I
                        </button>
                        <button
                          onClick={() =>
                            editor.chain().focus().toggleStrike().run()
                          }
                          className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-colors ${editor.isActive("strike") ? "bg-[#3b82f6] text-white" : "hover:bg-[#374151] text-[#6b7280]"}`}
                        >
                          S
                        </button>
                        <div className="w-[1px] h-4 bg-[#374151] mx-1" />
                        <button
                          onClick={() =>
                            editor.chain().focus().toggleHighlight().run()
                          }
                          className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-colors ${editor.isActive("highlight") ? "bg-yellow-500/30 text-yellow-500" : "hover:bg-[#374151] text-[#6b7280]"}`}
                        >
                          🖍️
                        </button>
                        <button
                          onClick={() =>
                            editor
                              .chain()
                              .focus()
                              .toggleHeading({ level: 3 })
                              .run()
                          }
                          className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-colors ${editor.isActive("heading", { level: 3 }) ? "bg-[#3b82f6] text-white" : "hover:bg-[#374151] text-[#6b7280]"}`}
                        >
                          H
                        </button>
                        <button
                          onClick={() =>
                            editor.chain().focus().toggleBulletList().run()
                          }
                          className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-colors ${editor.isActive("bulletList") ? "bg-[#3b82f6] text-white" : "hover:bg-[#374151] text-[#6b7280]"}`}
                        >
                          •
                        </button>
                        <button
                          onClick={() =>
                            editor.chain().focus().toggleOrderedList().run()
                          }
                          className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-colors ${editor.isActive("orderedList") ? "bg-[#3b82f6] text-white" : "hover:bg-[#374151] text-[#6b7280]"}`}
                        >
                          1.
                        </button>
                        <button
                          onClick={() => {
                            const url = prompt("Enter URL:");
                            if (url) {
                              editor
                                .chain()
                                .focus()
                                .setLink({ href: url })
                                .run();
                            }
                          }}
                          className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-colors ${editor.isActive("link") ? "bg-[#3b82f6] text-white" : "hover:bg-[#374151] text-[#6b7280]"}`}
                        >
                          🔗
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#374151] flex gap-3">
              <button
                onClick={() => setEditingTask(null)}
                className="flex-1 py-3 rounded-lg border border-[#374151] hover:bg-[#374151] text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const currentContent =
                    editor?.getHTML() || editingTask.content;
                  const { error } = await supabase
                    .from("tasks")
                    .update({
                      title: editingTask.title,
                      content: currentContent || null,
                      due_date: editingTask.due_date,
                      priority: editingTask.priority,
                      tags: editingTask.tags,
                      project_id: editingTask.project_id,
                    })
                    .eq("id", editingTask.id);

                  if (!error) {
                    setTasks((prev) =>
                      prev.map((t) =>
                        t.id === editingTask.id
                          ? { ...editingTask, content: currentContent }
                          : t,
                      ),
                    );
                  }
                  setEditingTask(null);
                }}
                className="flex-1 py-3 bg-[#3b82f6] text-white rounded-lg font-medium text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1e2130] border border-[#374151] rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-white mb-2">Add Member</h3>
            <p className="text-sm text-[#6b7280] mb-4">
              Enter the email address of the person you want to add to{" "}
              <span className="text-white font-medium">
                {currentTeam?.name}
              </span>
              .
            </p>
            <form onSubmit={handleAddMemberByEmail} className="space-y-4">
              <input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full bg-[#0f1117] border border-[#374151] rounded-lg px-4 py-2.5 text-white focus:border-[#3b82f6] outline-none text-sm"
                required
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setInviteEmail("");
                  }}
                  className="flex-1 py-2 rounded-lg border border-[#374151] text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!inviteEmail.trim()}
                  className="flex-1 py-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Removal Confirmation */}
      {memberToRemove && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1e2130] border border-[#374151] rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">
              Remove Member?
            </h3>
            <p className="text-sm text-[#6b7280] mb-6">
              Are you sure you want to remove{" "}
              <span className="text-white font-medium">
                {memberToRemove.first_name}
              </span>{" "}
              from the team? Any tasks currently assigned to them will be
              reassigned to you.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMemberToRemove(null)}
                className="flex-1 py-2 rounded-lg border border-[#374151] text-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveMember(memberToRemove.id)}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
