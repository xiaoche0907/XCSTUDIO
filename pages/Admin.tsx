import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Layers, 
  Activity, 
  ShieldCheck, 
  Search,
  ArrowUpRight,
  MoreVertical
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

const Admin = () => {
  const token = useAuthStore((s) => s.token);

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeProjects: 0,
    apiUsage: '0%',
    systemHealth: 'Loading...',
    providerStatus: {} as any
  });

  const [recentProjects, setRecentProjects] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (!token) return;
        const response = await fetch('/api/admin/stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
            // Optional extra admin token if you keep using it
            ...(localStorage.getItem('admin_token') ? { 'x-admin-token': localStorage.getItem('admin_token') as string } : {}),
          }
        });
        const data = await response.json();
        if (data && !data.error) {
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // 30秒自动刷新
    return () => clearInterval(interval);
  }, [token]);

  const StatCard = ({ title, value, icon: Icon, trend }: any) => (
    <div className="bg-[#141416] border border-[#232326] p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-[#1C1C1F] rounded-lg">
          <Icon className="w-5 h-5 text-gray-400" />
        </div>
        <span className="text-xs text-green-500 flex items-center">
          {trend} <ArrowUpRight className="w-3 h-3 ml-1" />
        </span>
      </div>
      <h3 className="text-gray-500 text-xs uppercase tracking-widest mb-1">{title}</h3>
      <p className="text-2xl text-white font-light font-sans">{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white p-8 font-serif">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-3xl font-light tracking-widest mb-2">ADMIN CONSOLE</h1>
            <p className="text-gray-500 text-sm">XC-STUDIO 后端管理系统</p>
          </div>
          <div className="flex gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input 
                type="text" 
                placeholder="搜索用户或项目..." 
                className="bg-[#141416] border border-[#232326] pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-white transition-colors"
              />
            </div>
            <button className="bg-white text-black px-6 py-2 text-xs uppercase tracking-widest font-medium hover:bg-gray-200 transition-colors">
              系统设置
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard title="Total Users" value={stats.totalUsers} icon={Users} trend="+12%" />
          <StatCard title="Active Projects" value={stats.activeProjects} icon={Layers} trend="+5.4%" />
          <StatCard title="API Credits" value={stats.apiUsage} icon={Activity} trend="Normal" />
          <StatCard title="Security Status" value={stats.systemHealth} icon={ShieldCheck} trend="Safe" />
        </div>

        {/* Recent Activity Table */}
        <div className="bg-[#141416] border border-[#232326]">
          <div className="p-6 border-b border-[#232326] flex justify-between items-center">
            <h2 className="text-lg font-light tracking-widest">最近活跃项目</h2>
            <button className="text-xs text-gray-500 hover:text-white uppercase tracking-widest">查看全部</button>
          </div>
          <table className="w-full text-left font-sans">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-widest border-b border-[#232326]">
                <th className="px-6 py-4 font-medium">项目名称</th>
                <th className="px-6 py-4 font-medium">创建者</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">更新时间</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {stats.totalUsers > 0 ? (
                // 演示目的：这里简单显示状态，实际可根据 /api/admin/users 渲染
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b border-[#1C1C1F] hover:bg-[#1C1C1F] transition-colors group">
                    <td className="px-6 py-4 text-gray-300">XC_Project_{i}</td>
                    <td className="px-6 py-4 text-gray-400">active_user_{i}@studio.com</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-green-500/10 text-green-500 text-[10px] uppercase tracking-tighter rounded">
                        Live
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">Real-time</td>
                    <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="text-gray-500 hover:text-white"><MoreVertical className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="text-center py-8 text-gray-600">正在连接云端监控节点...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Admin;
