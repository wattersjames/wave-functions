"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/**
 * Convert LaTeX-style \( \) and \[ \] delimiters (which models love to emit)
 * into the $-delimited form that remark-math understands.
 */
function normalizeMathDelims(s: string): string {
  return s
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");
}

export function MarkdownTutor({ children }: { children: string }) {
  const text = normalizeMathDelims(children ?? "");

  return (
    <div className="space-y-2 text-[0.9rem] leading-relaxed text-zinc-800 dark:text-zinc-100">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          h1: ({ children }) => (
            <h2 className="mt-3 mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h3 className="mt-3 mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="mt-2 mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {children}
            </h4>
          ),
          ul: ({ children }) => (
            <ul className="ml-5 list-disc space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="ml-5 list-decimal space-y-0.5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-900 dark:text-zinc-50">
              {children}
            </strong>
          ),
          em: ({ children }) => <em>{children}</em>,
          hr: () => <hr className="my-3 border-zinc-200 dark:border-zinc-800" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 underline underline-offset-2 hover:text-violet-500 dark:text-violet-400"
            >
              {children}
            </a>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-md bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
              {children}
            </pre>
          ),
          code: ({ className, children }) => {
            const isBlock = !!className && /language-/.test(className);
            if (isBlock) {
              return <code className={className}>{children}</code>;
            }
            return (
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.8rem] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-violet-300 pl-3 text-zinc-600 dark:border-violet-700 dark:text-zinc-400">
              {children}
            </blockquote>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
