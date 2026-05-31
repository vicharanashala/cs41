import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Star, Crown, ChevronDown, ChevronUp, X, Zap, MessageSquare, HelpCircle, Award } from 'lucide-react';

const API = 'http://localhost:3001/api';

const BADGE_CONFIG = {
  Gold:   { icon: Crown,  color: '#fbbf24', bg: '#fbbf2415', border: '#fbbf2430', label: 'Gold' },
  Silver: { icon: Medal,  color: '#94a3b8', bg: '#94a3b815', border: '#94a3b830', label: 'Silver' },
  Bronze: { icon: Award,  color: '#d97706', bg: '#d9770615', border: '#d9770630', label: 'Bronze' },
  '':     { icon: Star,   color: '#6b7280', bg: '#6b728015', border: '#6b728030', label: 'Starter' },
};

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

function getBadge(sp) {
  if (sp >= 200) return 'Gold';
  if (sp >= 100) return 'Silver';
  if (sp >= 50) return 'Bronze';
  return '';
}

function ContributorRow({ user, rank, compact }) {
  const badge = getBadge(user.sp || user.reputation || 0);
  const config = BADGE_CONFIG[badge];
  const IconComp = config.icon;
  const sp = user.sp || user.reputation || 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.05 }}
      className={`flex items-center gap-3 ${compact ? 'py-2' : 'py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] transition-all'}`}
    >
      {/* Rank */}
      <div className={`flex-shrink-0 ${compact ? 'w-5 text-center' : 'w-8 text-center'}`}>
        {rank < 3 ? (
          <span className={compact ? 'text-sm' : 'text-lg'}>{RANK_EMOJI[rank]}</span>
        ) : (
          <span className={`font-bold ${compact ? 'text-xs text-gray-500' : 'text-sm text-gray-400'}`}>#{rank + 1}</span>
        )}
      </div>

      {/* Avatar */}
      <div
        className={`flex-shrink-0 rounded-full flex items-center justify-center font-bold ${
          compact ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs'
        }`}
        style={{ backgroundColor: config.bg, color: config.color, border: `1px solid ${config.border}` }}
      >
        {(user.name || 'A').charAt(0).toUpperCase()}
      </div>

      {/* Name + badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`font-semibold truncate ${compact ? 'text-xs text-gray-300' : 'text-sm text-gray-200'}`}>
            {user.name || 'Anonymous'}
          </span>
          {badge && (
            <span
              className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: config.bg, color: config.color, border: `1px solid ${config.border}` }}
            >
              <IconComp size={7} />
              {config.label}
            </span>
          )}
        </div>
        {!compact && (
          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-600">
            <span className="flex items-center gap-0.5"><HelpCircle size={8} /> {user.question_count || 0} Q</span>
            <span className="flex items-center gap-0.5"><MessageSquare size={8} /> {user.answer_count || 0} A</span>
          </div>
        )}
      </div>

      {/* SP */}
      <div className={`flex items-center gap-1 flex-shrink-0 ${compact ? 'text-xs' : 'text-sm'}`}>
        <Zap size={compact ? 10 : 12} className="text-primary" />
        <span className="font-bold text-primary">{sp}</span>
        <span className={`text-gray-600 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>SP</span>
      </div>
    </motion.div>
  );
}

// ─── Sidebar Widget ───────────────────────────────────────────────────────

export function LeaderboardWidget() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    fetch(`${API}/leaderboard`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.leaderboard) setUsers(data.leaderboard);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-white/[0.05] rounded w-24 mb-3" />
        {[1,2,3].map(i => <div key={i} className="h-8 bg-white/[0.03] rounded-lg mb-2" />)}
      </div>
    );
  }

  return (
    <>
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-outfit text-sm font-bold flex items-center gap-2">
            <Trophy size={14} className="text-primary" />
            Top Contributors
          </h3>
          {users.length > 5 && (
            <button
              onClick={() => setShowFull(true)}
              className="text-[10px] text-primary/70 hover:text-primary transition-colors cursor-pointer"
            >
              View all →
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {users.slice(0, 5).map((u, i) => (
            <ContributorRow key={u.id || i} user={u} rank={i} compact />
          ))}
        </div>

        {users.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-4">No contributors yet. Be the first!</p>
        )}

        {/* SP info */}
        <div className="mt-3 pt-3 border-t border-white/[0.05]">
          <p className="text-[9px] text-gray-600 leading-relaxed">
            Earn <span className="text-primary font-semibold">Samagama Points (SP)</span> by asking questions (+5), answering (+10), getting upvotes (+3), and having your question promoted to FAQ (+25).
          </p>
        </div>
      </div>

      {/* Full modal */}
      <AnimatePresence>
        {showFull && (
          <LeaderboardModal users={users} onClose={() => setShowFull(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Full Modal ───────────────────────────────────────────────────────────

function LeaderboardModal({ users, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="relative glass rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto no-scrollbar"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-outfit text-xl font-bold flex items-center gap-2.5">
            <Trophy size={22} className="text-primary" />
            Leaderboard
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* SP Breakdown */}
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { action: 'Ask Question', sp: '+5', icon: '❓' },
            { action: 'Post Answer', sp: '+10', icon: '💬' },
            { action: 'Upvote Received', sp: '+3', icon: '👍' },
            { action: 'Answer Accepted', sp: '+15', icon: '✅' },
            { action: 'FAQ Promotion', sp: '+25', icon: '🏆' },
          ].map(item => (
            <div key={item.action} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-[10px] text-gray-500">
              <span>{item.icon}</span>
              <span>{item.action}</span>
              <span className="text-primary font-bold">{item.sp}</span>
            </div>
          ))}
        </div>

        {/* Full list */}
        <div className="flex flex-col gap-2">
          {users.map((u, i) => (
            <ContributorRow key={u.id || i} user={u} rank={i} compact={false} />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default LeaderboardWidget;
