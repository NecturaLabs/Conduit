import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const components: Components = {
  // Inline code
  code({ children, className, ...props }) {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <pre className="bg-[var(--color-base)] border border-[var(--color-border)] rounded-lg p-3 overflow-x-auto my-1.5">
          <code className="text-xs font-mono text-[var(--color-text)] leading-relaxed" {...props}>
            {children}
          </code>
        </pre>
      );
    }
    return (
      <code className="bg-[var(--color-base)] border border-[var(--color-border)] rounded px-1 py-0.5 text-xs font-mono text-[var(--color-accent)]" {...props}>
        {children}
      </code>
    );
  },
  pre({ children }) {
    // Let code block handle its own pre
    return <>{children}</>;
  },
  p({ children }) {
    return <p className="mb-1 last:mb-0">{children}</p>;
  },
  strong({ children }) {
    return <strong className="font-semibold text-[var(--color-text)]">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic">{children}</em>;
  },
  ul({ children }) {
    return <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-[var(--color-text)] pl-0.5">{children}</li>;
  },
  a({ children, href }) {
    const isSafe = href && /^https?:\/\//i.test(href);
    if (!isSafe) {
      return <span className="text-[var(--color-accent)] underline underline-offset-2">{children}</span>;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline underline-offset-2 hover:opacity-80">
        {children}
      </a>
    );
  },
  h1({ children }) {
    return <h1 className="text-base font-bold text-[var(--color-text)] mt-2 mb-0.5">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-sm font-bold text-[var(--color-text)] mt-1.5 mb-0.5">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-sm font-semibold text-[var(--color-text)] mt-1 mb-0.5">{children}</h3>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-[var(--color-accent)]/40 pl-3 my-1.5 text-[var(--color-muted)] italic">
        {children}
      </blockquote>
    );
  },
  hr() {
    return <hr className="border-t border-[var(--color-border)] my-2" />;
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-1.5" role="region" aria-label="Scrollable table" tabIndex={0}>
        <table className="text-sm border-collapse w-full">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return <th className="border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-left font-semibold text-[var(--color-text)]">{children}</th>;
  },
  td({ children }) {
    return <td className="border border-[var(--color-border)] px-2 py-1 text-[var(--color-text)]">{children}</td>;
  },
};

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Strip common leading whitespace from all lines (dedent).
 * Prevents markdown from being treated as code blocks due to indentation.
 */
function dedent(text: string): string {
  const lines = text.split('\n');
  // Find minimum indentation of non-empty lines
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const match = line.match(/^(\s*)/);
    if (match?.[1] !== undefined && match[1].length < minIndent) {
      minIndent = match[1].length;
    }
  }
  if (minIndent === 0 || minIndent === Infinity) return text;
  return lines.map(line => line.slice(minIndent)).join('\n');
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const cleaned = dedent(content.trim());
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
