import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, isAuthenticated } from '../utils/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import VoteControl from '../components/VoteControl.jsx';
import { useToast } from '../components/Toast.jsx';
import styles from './QuestionDetailPage.module.css';

const CATEGORY_COLORS = {
  'Interview Prep':     '#00d4ff',
  'Application Tips':   '#a855f7',
  'Company Research':   '#00ff88',
  'Salary Negotiation': '#fbbf24',
  'Visa & Relocation':  '#f97316',
  'Mental Health':      '#ec4899',
  'General Advice':     '#6366f1',
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr + 'Z').getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderContent(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

export default function QuestionDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const addToast = useToast();

  const [question, setQuestion] = useState(null);
  const [answers, setAnswers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [answerContent, setAnswerContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getQuestion(id).then(data => {
      setQuestion(data.question);
      setAnswers(data.answers);
    }).catch(() => addToast('Question not found', 'error')).finally(() => setLoading(false));
  }, [id]);

  const handleQuestionVote = async (direction) => {
    if (!isAuthenticated()) { addToast('Sign in to vote', 'info'); return; }
    try {
      const res = await api.voteQuestion(id, direction);
      setQuestion(q => ({ ...q, score: res.score, upvotes: res.upvotes, downvotes: res.downvotes }));
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleAnswerVote = async (answerId, direction) => {
    if (!isAuthenticated()) { addToast('Sign in to vote', 'info'); return; }
    try {
      const res = await api.voteAnswer(answerId, direction);
      setAnswers(as => as.map(a => a.id === answerId ? { ...a, score: res.score } : a));
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleAccept = async (answerId) => {
    try {
      const { answer } = await api.acceptAnswer(answerId);
      setAnswers(as => as.map(a => ({ ...a, is_accepted: a.id === answerId ? 1 : 0 })));
      addToast('Best answer marked!', 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!isAuthenticated()) { addToast('Sign in to answer', 'info'); return; }
    if (answerContent.trim().length < 20) { addToast('Answer must be at least 20 characters', 'error'); return; }
    setSubmitting(true);
    try {
      const { answer } = await api.createAnswer(id, answerContent.trim());
      setAnswers(as => [...as, { ...answer, score: 0, userVote: null }]);
      setAnswerContent('');
      addToast('Answer posted!', 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  if (loading) return (
    <main className="page"><div className="container">
      <div className={`skeleton ${styles.skTitle}`} />
      <div className={`skeleton ${styles.skBody}`} />
    </div></main>
  );

  if (!question) return (
    <main className="page"><div className="container">
      <div className={styles.notFound}>
        <h2>Question not found</h2>
        <Link to="/" className="btn btn-primary">Back to Home</Link>
      </div>
    </div></main>
  );

  const categoryColor = CATEGORY_COLORS[question.category] || '#6366f1';

  return (
    <main className="page">
      <div className="container">
        {/* Back */}
        <Link to="/" className={styles.back}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to questions
        </Link>

        {/* Question */}
        <article className={`glass ${styles.questionCard} animate-in`}>
          <div className={styles.questionLeft}>
            <VoteControl
              score={question.score}
              userVote={question.userVote}
              onVote={handleQuestionVote}
            />
          </div>
          <div className={styles.questionRight}>
            <div className={styles.qMeta}>
              <span className={styles.category} style={{ color: categoryColor, borderColor: categoryColor + '40', background: categoryColor + '15' }}>
                {question.category}
              </span>
              <span className={styles.qTime}>Asked {timeAgo(question.created_at)}</span>
            </div>
            <h1 className={styles.qTitle}>{question.title}</h1>
            <div className={`content-body ${styles.qDesc}`}>
              <p dangerouslySetInnerHTML={{ __html: renderContent(question.description) }} />
            </div>
            {question.tags && question.tags.length > 0 && (
              <div className={styles.qTags}>
                {question.tags.map(t => <span key={t} className={styles.tag}>#{t}</span>)}
              </div>
            )}
            <div className={styles.qFooter}>
              <div className={styles.authorCard}>
                <div className={styles.authorAvatar}>{question.author_name.charAt(0)}</div>
                <div>
                  <div className={styles.authorName}>{question.author_name}</div>
                  <div className={styles.authorRep}>{question.author_reputation} reputation</div>
                </div>
              </div>
              <div className={styles.qStats}>
                <span>{question.views} views</span>
              </div>
            </div>
          </div>
        </article>

        {/* Answers */}
        <section className={styles.answersSection}>
          <h2 className={styles.answersTitle}>
            {answers.length} Answer{answers.length !== 1 ? 's' : ''}
          </h2>

          {answers.length === 0 && (
            <div className={styles.noAnswers}>
              <p>No answers yet. Be the first to help!</p>
            </div>
          )}

          {answers.map((answer, i) => (
            <article key={answer.id} className={`glass ${styles.answerCard} ${answer.is_accepted ? styles.accepted : ''} animate-in`}>
              {answer.is_accepted && (
                <div className={styles.acceptedBadge}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Best Answer
                </div>
              )}
              <div className={styles.answerLeft}>
                <VoteControl
                  score={answer.score}
                  userVote={answer.userVote}
                  onVote={(dir) => handleAnswerVote(answer.id, dir)}
                />
                {user && question.user_id === user.id && !answer.is_accepted && (
                  <button className={styles.acceptBtn} onClick={() => handleAccept(answer.id)} title="Mark as best answer">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                )}
              </div>
              <div className={styles.answerRight}>
                <div className={`content-body ${styles.answerBody}`}>
                  <p dangerouslySetInnerHTML={{ __html: renderContent(answer.content) }} />
                </div>
                <div className={styles.answerFooter}>
                  <div className={styles.authorCard}>
                    <div className={styles.authorAvatarSmall}>{answer.author_name.charAt(0)}</div>
                    <div>
                      <div className={styles.authorName}>{answer.author_name}</div>
                      <div className={styles.authorRep}>{answer.author_reputation} rep · {timeAgo(answer.created_at)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* Add answer */}
        {user ? (
          <section className={`glass ${styles.addAnswer} animate-in`}>
            <h3 className={styles.addAnswerTitle}>Your Answer</h3>
            <form onSubmit={handleSubmitAnswer}>
              <textarea
                className="form-textarea"
                placeholder="Share your experience or knowledge… (minimum 20 characters)"
                value={answerContent}
                onChange={e => setAnswerContent(e.target.value)}
                rows={6}
              />
              <div className={styles.addAnswerActions}>
                <span className={styles.charCount}>{answerContent.length} characters</span>
                <button type="submit" className="btn btn-primary" disabled={submitting || answerContent.trim().length < 20}>
                  {submitting ? 'Posting…' : 'Post Answer'}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <div className={`glass ${styles.signInPrompt}`}>
            <p>Want to share your knowledge?</p>
            <div className={styles.signInBtns}>
              <Link to="/login" className="btn btn-primary">Sign In</Link>
              <Link to="/register" className="btn btn-secondary">Create Account</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}