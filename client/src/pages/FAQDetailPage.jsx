import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ThumbsUp, Eye, Bookmark, Share2, CheckCircle } from 'lucide-react';
import { officialFAQs } from '../data/faqs.js';

export default function FAQDetailPage() {
  const { id } = useParams();
  const faq = officialFAQs.find(f => f.id === id);

  if (!faq) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-24">
        <p className="text-gray-500 mb-4">FAQ not found</p>
        <Link to="/" className="btn-primary">← Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-200 mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to FAQs
        </Link>
      </motion.div>

      <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8">
        {/* Meta */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary/10 border border-primary/15 px-3 py-1 rounded-full">
            {faq.section}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 bg-white/[0.04] px-3 py-1 rounded-full">
            {faq.category}
          </span>
          {faq.isOfficial && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent bg-accent/10 border border-accent/15 px-3 py-1 rounded-full flex items-center gap-1.5">
              <CheckCircle size={10} /> Official FAQ
            </span>
          )}
        </div>

        {/* Question */}
        <h1 className="font-outfit text-2xl sm:text-3xl font-bold text-gray-100 leading-snug mb-6">
          {faq.q}
        </h1>

        {/* Stats bar */}
        <div className="flex items-center gap-5 mb-8 pb-6 border-b border-white/[0.06]">
          <span className="flex items-center gap-1.5 text-sm text-gray-400">
            <ThumbsUp size={14} className="text-primary" /> {faq.votes.toLocaleString()} votes
          </span>
          <span className="flex items-center gap-1.5 text-sm text-gray-400">
            <Eye size={14} className="text-gray-500" /> {faq.views.toLocaleString()} views
          </span>
          <button className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-200 transition-colors cursor-pointer">
            <Bookmark size={14} /> Save
          </button>
          <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-200 transition-colors cursor-pointer">
            <Share2 size={14} /> Share
          </button>
        </div>

        {/* Answer */}
        <div className="prose prose-invert max-w-none">
          {faq.a.split('\n').map((para, i) => {
            if (para.startsWith('🥉') || para.startsWith('🥈') || para.startsWith('🥇') || para.startsWith('🏆')) {
              return (
                <div key={i} className="flex items-start gap-3 mb-4 p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                  <span className="text-2xl flex-shrink-0">{para.charAt(0)}</span>
                  <p className="text-sm text-gray-300 leading-relaxed">{para.slice(1).trim()}</p>
                </div>
              );
            }
            if (para.startsWith('- ')) {
              return <p key={i} className="text-sm text-gray-300 mb-2 pl-4 border-l-2 border-primary/20">{para.slice(2)}</p>;
            }
            if (para.match(/^\d+\./)) {
              return <p key={i} className="text-sm text-gray-300 mb-2">{para}</p>;
            }
            return para.trim() ? <p key={i} className="text-sm text-gray-300 leading-relaxed mb-3">{para}</p> : null;
          })}
        </div>

        {/* Related */}
        <div className="mt-8 pt-6 border-t border-white/[0.06]">
          <h3 className="font-outfit font-bold text-sm text-gray-400 mb-4">Related Official FAQs</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {officialFAQs
              .filter(f => f.id !== id && f.category === faq.category)
              .slice(0, 4)
              .map(f => (
                <Link key={f.id} to={`/faq/${f.id}`} className="block p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] hover:border-primary/15 hover:bg-primary/5 transition-all group">
                  <p className="text-xs text-gray-300 group-hover:text-primary transition-colors line-clamp-2 leading-relaxed">{f.q}</p>
                  <p className="text-[10px] text-gray-600 mt-1.5">{f.votes} votes</p>
                </Link>
              ))}
          </div>
        </div>
      </motion.article>
    </div>
  );
}