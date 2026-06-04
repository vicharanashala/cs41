import { Link, useLocation } from 'react-router-dom';
import { Home, Users, BarChart2, HelpCircle, ChevronRight } from 'lucide-react';

const sidebarLinks = [
  { to: '/',           label: 'Home',           icon: Home },
  { to: '/community',  label: 'Community Q&A',  icon: Users },
  { to: '/insights',   label: 'Crowd Insights',  icon: BarChart2 },
];

const QUICK_LINKS = [
  { label: 'About VINS',           filter: 'About'       },
  { label: 'NOC Guide',            filter: 'NOC'          },
  { label: 'Attendance Rules',     filter: 'Attendance'   },
  { label: 'Certificate Process',  filter: 'Certificate'  },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-deep border-r border-white/[0.06] flex flex-col py-6 overflow-y-auto no-scrollbar">
      <nav className="flex flex-col gap-1 px-3">
        {sidebarLinks.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                active
                  ? 'bg-primary/10 text-primary border border-primary/15'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Icon size={18} className={active ? 'text-primary' : 'text-gray-500 group-hover:text-gray-300'} />
              {label}
              {active && (
                <ChevronRight size={14} className="ml-auto text-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 px-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-3">Quick Links</p>
        <div className="flex flex-col gap-1">
          {QUICK_LINKS.map(({ label, filter }) => (
            <Link
              key={filter}
              to={`/?filter=${encodeURIComponent(filter)}`}
              className="text-left px-3 py-2 text-xs text-gray-500 hover:text-gray-200 hover:bg-white/[0.03] rounded-lg transition-all cursor-pointer"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-auto px-6">
        <div className="glass rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-300 mb-1">Vicharanashala 2026</p>
          <p className="text-[11px] text-gray-500 leading-relaxed">IIT Ropar · Applied AI · Open Source</p>
        </div>
      </div>
    </aside>
  );
}