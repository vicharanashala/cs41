import { useState, useEffect } from 'react';
import {
  getAnalyticsKPI,
  getAnalyticsFaqDaily,
  getAnalyticsFaqMonthly,
  getAnalyticsFaqStatus,
  getAnalyticsThroughput,
  getAnalyticsAvgTime,
  getAnalyticsModDaily,
  getAnalyticsModSummary,
  getAnalyticsSPDist,
  getAnalyticsSPLeaders,
  refreshAnalytics,
} from '../../api/faculty.js';

// ── Inline SVG bar chart (no external chart library) ─────────────────────────
function BarChart({ data, height = 160 }) {
  if (!data || data.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>No data</div>;
  }
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.max(4, Math.floor((600 - 40) / data.length) - 2);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" height={height + 36} viewBox={`0 0 ${Math.max(data.length * (barWidth + 4) + 40, 300)} ${height + 36}`}>
        {[0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct} x1="36" y1={height * (1 - pct) + 4} x2="100%" y2={height * (1 - pct) + 4} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        {data.map((d, i) => {
          const barH = Math.max(2, (d.value / maxVal) * height);
          const x = 38 + i * (barWidth + 4);
          const y = height - barH + 4;
          const color = d.color || '#3b82f6';
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={barH} rx="3" fill={color} opacity="0.85" />
              {d.label && <text x={x + barWidth / 2} y={height + 18} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.label}</text>}
              {d.value !== undefined && <text x={x + barWidth / 2} y={y - 3} textAnchor="middle" fontSize="9" fill="#64748b">{d.value}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Inline SVG donut / pie chart ──────────────────────────────────────────────
function DonutChart({ segments, size = 160 }) {
  if (!segments || segments.length === 0) {
    return <div style={{ height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>No data</div>;
  }
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const innerR = r * 0.55;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  let startAngle = -Math.PI / 2;
  const paths = segments.map((seg, i) => {
    const angle = (seg.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const x3 = cx + innerR * Math.cos(endAngle);
    const y3 = cy + innerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(startAngle);
    const y4 = cy + innerR * Math.sin(startAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    startAngle = endAngle;
    return { d, color: seg.color || '#3b82f6', label: seg.label, value: seg.value };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} opacity="0.85" />)}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e293b">{total}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize="9" fill="#94a3b8">total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color || '#3b82f6', flexShrink: 0 }} />
            <span style={{ color: '#64748b' }}>{seg.label}</span>
            <span style={{ color: '#1e293b', fontWeight: 600, marginLeft: 'auto' }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, icon, color = '#3b82f6', trend }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '1.25rem 1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', marginBottom: '0.4rem' }}>{label}</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{value ?? '—'}</div>
          {trend != null && (
            <div style={{ fontSize: '0.7rem', marginTop: '0.3rem', color: trend >= 0 ? '#16a34a' : '#dc2626' }}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last period
            </div>
          )}
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '1.25rem' }}>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '1rem' }}>{title}</div>
      {children}
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function Pill({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f8fafc', borderRadius: 8, padding: '0.75rem 1rem', border: '1px solid #e2e8f0', minWidth: 70 }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: color || '#3b82f6' }}>{value ?? '—'}</div>
      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.2rem', textAlign: 'center' }}>{label}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [kpis, setKpis]               = useState([]);
  const [dailyData, setDailyData]     = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [statusData, setStatusData]   = useState([]);
  const [throughputData, setThroughputData] = useState([]);
  const [avgTimeData, setAvgTimeData] = useState(null);
  const [modDailyData, setModDailyData]   = useState([]);
  const [modSummary, setModSummary]   = useState(null);
  const [spDist, setSpDist]           = useState(null);
  const [spLeaders, setSpLeaders]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [refreshing, setRefreshing]   = useState(false);

  useEffect(() => {
    Promise.all([
      getAnalyticsKPI().catch(() => null),
      getAnalyticsFaqDaily(14).catch(() => null),
      getAnalyticsFaqMonthly(6).catch(() => null),
      getAnalyticsFaqStatus().catch(() => null),
      getAnalyticsThroughput(8).catch(() => null),
      getAnalyticsAvgTime().catch(() => null),
      getAnalyticsModDaily(14).catch(() => null),
      getAnalyticsModSummary().catch(() => null),
      getAnalyticsSPDist().catch(() => null),
      getAnalyticsSPLeaders(10).catch(() => null),
    ]).then(([kpiRes, dailyRes, monthlyRes, statusRes, tpRes, avgRes, modDailyRes, modSumRes, spDistRes, spLeadRes]) => {
      const failures = [kpiRes, dailyRes, monthlyRes, statusRes, tpRes, avgRes, modDailyRes, modSumRes, spDistRes, spLeadRes].filter(r => !r);
      if (failures.length > 5) { setError('Some analytics could not be loaded.'); }

      if (kpiRes) setKpis(kpiRes.kpis || []);

      if (dailyRes) {
        setDailyData((dailyRes.rows || []).map(r => ({
          label: r.date?.slice(5),
          value: r.submitted || 0,
          color: '#3b82f6',
        })));
      }

      if (monthlyRes) {
        setMonthlyData((monthlyRes.rows || []).map(r => ({
          label: r.month?.slice(2),
          value: r.submitted || 0,
          color: '#6366f1',
        })));
      }

      if (statusRes) {
        const STATUS_COLORS = {
          pending_review: '#f59e0b',
          published: '#10b981',
          rejected: '#ef4444',
          changes_requested: '#8b5cf6',
          community: '#64748b',
        };
        setStatusData((statusRes.breakdown || []).map(s => ({
          label: s.status?.replace(/_/g, ' '),
          value: s.count,
          color: STATUS_COLORS[s.status] || '#94a3b8',
        })));
      }

      if (tpRes) {
        setThroughputData((tpRes.rows || []).map(r => ({
          label: r.week_start?.slice(2),
          value: r.reviewed || 0,
          color: '#10b981',
        })));
      }

      if (avgRes) setAvgTimeData(avgRes);

      if (modDailyRes) {
        setModDailyData((modDailyRes.rows || []).map(r => ({
          label: r.date?.slice(5),
          value: r.flags_raised || 0,
          color: '#ef4444',
        })));
      }

      if (modSumRes) setModSummary(modSumRes);

      if (spDistRes) setSpDist(spDistRes);

      if (spLeadRes) setSpLeaders(spLeadRes.leaders || []);

    }).finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      await refreshAnalytics();
      window.location.reload();
    } catch {
      setError('Refresh failed. Please try again.');
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
        Loading analytics…
      </div>
    );
  }

  const kpiMap = Object.fromEntries((kpis || []).map(k => [k.key, k]));

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>📊 Analytics</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>FAQ submission trends, review throughput, moderation, and platform health metrics.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ background: refreshing ? '#e2e8f0' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: '0.8rem', cursor: refreshing ? 'not-allowed' : 'pointer' }}
        >
          {refreshing ? '↻ Refreshing…' : '↻ Refresh Data'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>
          ❌ {error}
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <KPICard label="Total FAQs"            value={kpiMap['total_faqs']?.value ?? '—'}        icon="📋" color="#3b82f6" trend={kpiMap['total_faqs']?.trend} />
        <KPICard label="Pending Review"        value={kpiMap['pending_review']?.value ?? '—'}     icon="⏳" color="#f59e0b" />
        <KPICard label="Open Flags"            value={kpiMap['open_flags']?.value ?? '—'}         icon="🚩" color="#ef4444" />
        <KPICard label="Total Students"        value={kpiMap['students']?.value ?? '—'}           icon="👥" color="#10b981" />
        <KPICard label="Avg SP"                value={kpiMap['avg_sp']?.value ?? '—'}             icon="⭐" color="#8b5cf6" />
        <KPICard label="This Month Published"  value={kpiMap['published_this_month']?.value ?? '—'} icon="✅" color="#06b6d4" />
      </div>

      {/* Row: FAQ daily + monthly */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <Section title="FAQ SUBMISSIONS — LAST 14 DAYS">
          <BarChart data={dailyData} height={140} />
        </Section>
        <Section title="FAQ SUBMISSIONS — LAST 6 MONTHS">
          <BarChart data={monthlyData} height={140} />
        </Section>
      </div>

      {/* Row: FAQ status donut + review throughput */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <Section title="FAQ STATUS BREAKDOWN">
          <DonutChart segments={statusData} size={160} />
        </Section>

        <Section title="REVIEW THROUGHPUT (LAST 8 WEEKS)">
          {avgTimeData ? (
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <Pill label="Avg Hours" value={Math.round(avgTimeData.overall * 10) / 10} color="#3b82f6" />
              <Pill label="This Week" value={avgTimeData.thisWeek} color="#10b981" />
              <Pill label="Last Week" value={avgTimeData.lastWeek} color="#64748b" />
              {(avgTimeData.byDecision || []).slice(0, 3).map(d => (
                <Pill key={d.decision} label={d.decision?.replace(/_/g, ' ')} value={d.count} color="#8b5cf6" />
              ))}
            </div>
          ) : null}
          <BarChart data={throughputData} height={130} />
        </Section>
      </div>

      {/* Moderation metrics */}
      <Section title="MODERATION FLAGS — LAST 14 DAYS">
        {modSummary ? (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <Pill label="Open Flags" value={modSummary.open} color="#ef4444" />
            <Pill label="Resolved" value={modSummary.resolved} color="#10b981" />
            {(modSummary.byType || []).slice(0, 4).map(t => (
              <Pill key={t.flag_type} label={t.flag_type} value={t.count} color="#f59e0b" />
            ))}
          </div>
        ) : null}
        <BarChart data={modDailyData} height={120} />
      </Section>

      {/* SP distribution + leaderboard */}
      {spDist ? (
        <Section title="STUDENT POINTS DISTRIBUTION">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* SP histogram bars */}
            <div>
              <BarChart
                data={(spDist.histogram || []).map(h => ({
                  label: h.range,
                  value: h.count,
                  color: '#8b5cf6',
                }))}
                height={130}
              />
            </div>
            {/* SP stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Pill label="Avg SP" value={spDist.stats?.avg} color="#8b5cf6" />
              <Pill label="Median SP" value={spDist.stats?.median} color="#6366f1" />
              <Pill label="Min SP" value={spDist.stats?.min} color="#94a3b8" />
              <Pill label="Max SP" value={spDist.stats?.max} color="#3b82f6" />
              <Pill label="10th pct" value={spDist.stats?.p10} color="#f59e0b" />
              <Pill label="90th pct" value={spDist.stats?.p90} color="#10b981" />
              <Pill label="Frozen" value={spDist.stats?.frozen} color="#ef4444" />
              <Pill label="With Flags" value={spDist.stats?.withFlags} color="#f59e0b" />
            </div>
          </div>
        </Section>
      ) : null}

      {/* SP leaderboard */}
      {spLeaders.length > 0 && (
        <Section title="SP LEADERBOARD (TOP 10)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {spLeaders.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: 20, textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: i < 3 ? '#f59e0b' : '#94a3b8' }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, fontSize: '0.85rem', color: '#1e293b', fontWeight: 500 }}>{s.name || s.email}</div>
                {s.is_frozen ? <span style={{ fontSize: '0.65rem', background: '#fef2f2', color: '#ef4444', padding: '0.1rem 0.4rem', borderRadius: 4 }}>❄️</span> : null}
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#8b5cf6' }}>⭐ {s.sp ?? 0}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

    </div>
  );
}