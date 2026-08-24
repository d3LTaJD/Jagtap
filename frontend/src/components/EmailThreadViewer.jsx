import React, { useState } from 'react';
import { Mail, ChevronDown, ChevronRight, User, Calendar, Paperclip, ArrowRight } from 'lucide-react';

/**
 * Cleanly parses and splits email body into main body text and quoted reply sections.
 */
function parseEmailBody(rawBody) {
  if (!rawBody || typeof rawBody !== 'string') {
    return { mainBody: '', quotes: [] };
  }

  const text = rawBody.trim();

  // Common quote separator patterns
  const quoteRegex = /(?:^|\n)(?:On\s+.*?\s+wrote:|From:.*?|----------\s*Forwarded message\s*----------|________________________________)/i;

  const match = text.match(quoteRegex);
  if (!match || match.index === undefined) {
    return { mainBody: text, quotes: [] };
  }

  const mainBody = text.substring(0, match.index).trim();
  const quotedText = text.substring(match.index).trim();

  return {
    mainBody,
    quotes: [quotedText]
  };
}

function sanitizeHtmlBody(html) {
  if (!html) return '';
  return html
    .replace(/font-size\s*:\s*[3-9][0-9]+(?:pt|px|em|rem|%)/gi, 'font-size: 13px')
    .replace(/font-size\s*:\s*[1-9][0-9]{2,}(?:pt|px|em|rem|%)/gi, 'font-size: 13px')
    .replace(/size=["']?[4-9]["']?/gi, 'size="2"');
}

export default function EmailThreadViewer({ emails = [], primaryEmail = null }) {
  const [expandedQuotes, setExpandedQuotes] = useState({});

  const toggleQuote = (id) => {
    setExpandedQuotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const emailList = emails.length > 0 ? emails : (primaryEmail ? [primaryEmail] : []);

  if (emailList.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">No email content available for this enquiry.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {emailList.map((email, idx) => {
        const emailId = email._id || idx;
        const { mainBody, quotes } = parseEmailBody(email.bodyText || email.body || email.content || '');
        const isQuoteExpanded = !!expandedQuotes[emailId];

        return (
          <div 
            key={emailId} 
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300"
          >
            {/* Header section */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 font-bold flex items-center justify-center text-sm shadow-sm border border-brand-100">
                  {(email.fromName || email.from || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {email.fromName || email.from || 'Unknown Sender'}
                    <span className="text-xs font-normal text-slate-400">&lt;{email.from || ''}&gt;</span>
                  </h4>
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span>To: {email.to || 'Me'}</span>
                    {email.date && (
                      <>
                        <span>•</span>
                        <Calendar className="w-3 h-3 text-slate-400 inline" />
                        <span>{new Date(email.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {email.subject && (
                <div className="w-full text-xs font-semibold text-slate-600 bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200/80">
                  Subject: {email.subject}
                </div>
              )}
            </div>

            {/* Body text */}
            <div className="p-5 space-y-4 text-sm text-slate-700 leading-relaxed font-normal overflow-x-auto w-full max-w-full">
              {email.htmlBody ? (
                <div 
                  className="prose prose-sm max-w-none text-slate-700 font-sans overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_td]:border [&_td]:border-slate-300 [&_td]:p-2.5 [&_td]:text-xs [&_th]:border [&_th]:border-slate-300 [&_th]:p-2.5 [&_th]:text-xs [&_th]:bg-slate-100 [&_th]:font-bold [&_*]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtmlBody(email.htmlBody) }} 
                />
              ) : (
                <div className="whitespace-pre-wrap font-sans text-slate-800 overflow-x-auto max-w-full font-mono text-xs leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-200/60">
                  {mainBody || 'No text content.'}
                </div>
              )}

              {/* Collapsible Quoted Reply Section */}
              {quotes.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={() => toggleQuote(emailId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all"
                  >
                    {isQuoteExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <span>{isQuoteExpanded ? 'Hide Quoted Thread' : 'Show Quoted Thread (...)'}</span>
                  </button>

                  {isQuoteExpanded && (
                    <div className="mt-3 p-4 bg-slate-50 rounded-xl border-l-4 border-slate-300 text-xs text-slate-500 whitespace-pre-wrap font-mono leading-normal animate-in fade-in-50 overflow-x-auto max-w-full">
                      {quotes.join('\n\n')}
                    </div>
                  )}
                </div>
              )}

              {/* Attachments listing */}
              {email.attachments && email.attachments.length > 0 && (
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" />
                    Attachments ({email.attachments.length}):
                  </span>
                  {email.attachments.map((att, aIdx) => (
                    <span 
                      key={aIdx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200"
                    >
                      {att.originalFileName || att.name || `Attachment #${aIdx + 1}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
