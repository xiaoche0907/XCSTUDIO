import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ROUTES, createNewWorkspacePath } from "../utils/routes";
import {
  Home as HomeIcon,
  Folder,
  Plus,
  Settings,
  Video,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { fetchWorkspaces } from "../services/workspaces/workspaces-api";

interface SidebarProps {
  onNewProject?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onNewProject }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const token = useAuthStore((s) => s.token);
  const workspace = useAuthStore((s) => s.workspace);
  const setWorkspace = useAuthStore((s) => s.setWorkspace);

  const [wsOpen, setWsOpen] = React.useState(false);
  const [wsLoading, setWsLoading] = React.useState(false);
  const [wsList, setWsList] = React.useState<Array<{ id: string; name: string; role: string }>>([]);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!token) {
        setWsList([]);
        return;
      }
      setWsLoading(true);
      try {
        const list = await fetchWorkspaces(token);
        if (cancelled) return;
        setWsList(list.map((w) => ({ id: w.id, name: w.name, role: w.role })));
      } catch {
        if (cancelled) return;
        setWsList([]);
      } finally {
        if (!cancelled) setWsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleNewProject = () => {
    if (onNewProject) {
      onNewProject();
    } else {
      navigate(createNewWorkspacePath());
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* 桌面端侧边栏 */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="fixed left-6 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-4 z-50"
      >
        <div className="flex flex-col gap-2">
          {/* Workspace switcher */}
          <div className="relative">
            <button
              onClick={() => setWsOpen((v) => !v)}
              className="w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 shadow-premium bg-card/80 backdrop-blur-xl border border-border/50 hover:bg-card"
              title={workspace ? `Workspace: ${workspace.name}` : "Workspace"}
            >
              <ChevronsUpDown size={18} className="text-gray-700" />
            </button>

            {wsOpen ? (
              <div className="absolute left-14 top-0 w-64 rounded-xl bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl p-2">
                <div className="px-2 py-2 text-[11px] font-semibold text-gray-500 tracking-widest uppercase">
                  Workspace
                </div>
                {wsLoading ? (
                  <div className="px-2 py-3 text-xs text-gray-500">Loading…</div>
                ) : wsList.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-gray-500">No workspaces</div>
                ) : (
                  <div className="max-h-72 overflow-auto custom-scrollbar">
                    {wsList.map((w) => {
                      const active = workspace?.id === w.id;
                      return (
                        <button
                          key={w.id}
                          onClick={() => {
                            setWorkspace({ id: w.id, name: w.name, role: w.role as any });
                            setWsOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition ${
                            active ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className={`text-sm font-semibold truncate ${active ? 'text-white' : 'text-gray-900'}`}>{w.name}</div>
                            <div className={`text-[11px] truncate ${active ? 'text-white/70' : 'text-gray-500'}`}>{w.role}</div>
                          </div>
                          {active ? <Check size={16} className="shrink-0" /> : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <button
            onClick={handleNewProject}
            className="w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 shadow-premium bg-foreground text-background hover:scale-105 active:scale-95"
            title="新建项目"
          >
            <Plus size={24} />
          </button>
        </div>

        <div className="w-12 py-6 bg-card/80 backdrop-blur-xl rounded-full shadow-premium flex flex-col items-center gap-6 border border-border/50">
          <button
            onClick={() => navigate(ROUTES.dashboard)}
            className={`p-2 rounded-full transition ${isActive(ROUTES.dashboard)
              ? "bg-gray-100 text-black shadow-sm"
              : "text-gray-400 hover:text-black hover:bg-gray-50"
              }`}
            title="首页"
          >
            <HomeIcon size={20} />
          </button>
          <button
            onClick={() => navigate(ROUTES.projects)}
            className={`p-2 rounded-full transition ${isActive(ROUTES.projects)
              ? "bg-gray-100 text-black shadow-sm"
              : "text-gray-400 hover:text-black hover:bg-gray-50"
              }`}
            title="项目"
          >
            <Folder size={20} />
          </button>
          <button
            onClick={() => navigate(ROUTES.videoWorkspace)}
            className={`p-2 rounded-full transition ${isActive(ROUTES.videoWorkspace)
              ? "bg-gray-100 text-black shadow-sm"
              : "text-gray-400 hover:text-black hover:bg-gray-50"
              }`}
            title="Video Studio"
          >
            <Video size={20} />
          </button>
          <button
            onClick={() => navigate(ROUTES.settings)}
            className={`p-2 rounded-full transition ${isActive(ROUTES.settings)
              ? "bg-gray-100 text-black shadow-sm"
              : "text-gray-400 hover:text-black hover:bg-gray-50"
              }`}
            title="设置 / API Key"
          >
            <Settings size={20} />
          </button>
        </div>
      </motion.div>

      {/* 移动端底部导航 */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-t border-gray-100 flex items-center justify-around px-4 z-50 pb-safe">
        <button
          onClick={() => navigate(ROUTES.dashboard)}
          className={`flex flex-col items-center gap-1 ${isActive(ROUTES.dashboard) ? "text-black" : "text-gray-400"}`}
        >
          <HomeIcon size={20} strokeWidth={isActive(ROUTES.dashboard) ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-tighter">首页</span>
        </button>
        <button
          onClick={() => navigate(ROUTES.projects)}
          className={`flex flex-col items-center gap-1 ${isActive(ROUTES.projects) ? "text-black" : "text-gray-400"}`}
        >
          <Folder size={20} strokeWidth={isActive(ROUTES.projects) ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-tighter">项目</span>
        </button>

        {/* 中间突出按钮 */}
        <div className="-translate-y-4">
          <button
            onClick={handleNewProject}
            className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center shadow-2xl shadow-black/20 active:scale-90 transition-all"
          >
            <Plus size={28} />
          </button>
        </div>

        <button
          onClick={() => navigate(ROUTES.videoWorkspace)}
          className={`flex flex-col items-center gap-1 ${isActive(ROUTES.videoWorkspace) ? "text-black" : "text-gray-400"}`}
        >
          <Video size={20} strokeWidth={isActive(ROUTES.videoWorkspace) ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-tighter">视频</span>
        </button>
        <button
          onClick={() => navigate(ROUTES.settings)}
          className={`flex flex-col items-center gap-1 ${isActive(ROUTES.settings) ? "text-black" : "text-gray-400"}`}
        >
          <Settings size={20} strokeWidth={isActive(ROUTES.settings) ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-tighter">设置</span>
        </button>
      </div>
    </>
  );
};

export default Sidebar;
