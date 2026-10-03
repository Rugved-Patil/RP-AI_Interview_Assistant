import React, { useState } from 'react';
import './FormattedFeedback.css';

interface FormattedFeedbackProps {
  content: string;
  className?: string;
}

/**
 * Parses inline markdown: **bold**, *italic*, `code`.
 */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={match.index} className="formatted-feedback__code">{token.slice(1, -1)}</code>);
    } else {
      parts.push(token);
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Renders a full markdown code block with language badge & copy button.
 */
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const displayLang = language ? language.toUpperCase() : 'CODE';

  return (
    <div className="feedback-codeblock">
      <div className="feedback-codeblock__header">
        <span className="feedback-codeblock__lang">{displayLang}</span>
        <button
          type="button"
          className="feedback-codeblock__copy-btn"
          onClick={handleCopy}
          title="Copy code to clipboard"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="feedback-codeblock__pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const FormattedFeedback: React.FC<FormattedFeedbackProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const rawLines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLanguage = '';

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'ul') {
        elements.push(
          <ul key={`list-${elements.length}`} className="formatted-feedback__list">
            {currentList.items.map((item, idx) => (
              <li key={idx} className="formatted-feedback__list-item">
                {renderInline(item)}
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`list-${elements.length}`} className="formatted-feedback__ordered-list">
            {currentList.items.map((item, idx) => (
              <li key={idx} className="formatted-feedback__list-item">
                {renderInline(item)}
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    // Check for start/end of fenced code block ```
    if (trimmed.startsWith('```')) {
      flushList();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
        codeBuffer = [];
      } else {
        // End of code block
        inCodeBlock = false;
        elements.push(
          <CodeBlock
            key={`code-${elements.length}`}
            code={codeBuffer.join('\n')}
            language={codeLanguage}
          />
        );
        codeBuffer = [];
        codeLanguage = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    if (!trimmed) {
      flushList();
      continue;
    }

    // Check for markdown headings (# Heading, ## Heading, ### Heading, #### Heading)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      const Tag = (level <= 2 ? 'h3' : 'h4') as 'h3' | 'h4';
      elements.push(
        <Tag key={`h-${elements.length}`} className={`formatted-feedback__heading formatted-feedback__heading--h${level}`}>
          {renderInline(title)}
        </Tag>
      );
      continue;
    }

    // Check for unordered list item (- item, * item)
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    }

    // Check for ordered list item (1. item, 2. item)
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(numberedMatch[1]);
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${elements.length}`} className="formatted-feedback__p">
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList();

  // If unclosed code block at end of message
  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <CodeBlock
        key={`code-${elements.length}`}
        code={codeBuffer.join('\n')}
        language={codeLanguage}
      />
    );
  }

  return <div className={`formatted-feedback ${className}`}>{elements}</div>;
};
