import { type ReactNode } from 'react';

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  segments.forEach((seg, i) => {
    if (!seg) return;
    if (seg.startsWith('**') && seg.endsWith('**')) {
      nodes.push(<strong key={`${keyBase}-b-${i}`} className="font-semibold text-white">{seg.slice(2, -2)}</strong>);
    } else if (seg.startsWith('`') && seg.endsWith('`')) {
      nodes.push(
        <code key={`${keyBase}-c-${i}`} className="bg-zinc-700/60 text-emerald-300 rounded px-1.5 py-0.5 text-[0.85em] font-mono">
          {seg.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(<span key={`${keyBase}-t-${i}`}>{seg}</span>);
    }
  });
  return nodes;
}

export function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let orderedList: string[] = [];
  let codeBlock: string[] | null = null;
  let codeLang = '';

  const flushUnordered = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="space-y-1.5 my-3 ml-1">
        {listItems.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-zinc-300 leading-relaxed">
            <span className="text-emerald-400 mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{renderInline(item, `li-${blocks.length}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  const flushOrdered = () => {
    if (orderedList.length === 0) return;
    blocks.push(
      <ol key={`ol-${blocks.length}`} className="space-y-1.5 my-3 ml-1">
        {orderedList.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-zinc-300 leading-relaxed">
            <span className="text-emerald-400 font-semibold shrink-0 text-sm leading-6">{i + 1}.</span>
            <span>{renderInline(item, `ol-${blocks.length}-${i}`)}</span>
          </li>
        ))}
      </ol>
    );
    orderedList = [];
  };

  const flushCode = () => {
    if (!codeBlock) return;
    blocks.push(
      <pre key={`code-${blocks.length}`} className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 my-3 overflow-x-auto">
        <code className="text-emerald-200/90 font-mono text-[0.85rem] leading-relaxed">
          {codeBlock.join('\n')}
        </code>
      </pre>
    );
    codeBlock = null;
    codeLang = '';
  };

  lines.forEach((line, idx) => {
    if (codeBlock !== null) {
      if (line.trim().endsWith('```')) {
        flushCode();
      } else {
        codeBlock.push(line);
      }
      return;
    }

    if (line.trim().startsWith('```')) {
      flushUnordered();
      flushOrdered();
      codeBlock = [];
      codeLang = line.trim().slice(3);
      return;
    }

    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      flushUnordered();
      flushOrdered();
      blocks.push(
        <h3 key={`h3-${idx}`} className="text-base font-semibold text-white mt-4 mb-2">
          {renderInline(trimmed.slice(3), `h3-${idx}`)}
        </h3>
      );
    } else if (trimmed.startsWith('# ')) {
      flushUnordered();
      flushOrdered();
      blocks.push(
        <h2 key={`h2-${idx}`} className="text-lg font-bold text-white mt-4 mb-2">
          {renderInline(trimmed.slice(2), `h2-${idx}`)}
        </h2>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushOrdered();
      listItems.push(trimmed.slice(2));
    } else if (/^\d+\.\s/.test(trimmed)) {
      flushUnordered();
      orderedList.push(trimmed.replace(/^\d+\.\s/, ''));
    } else if (trimmed === '') {
      flushUnordered();
      flushOrdered();
    } else {
      flushUnordered();
      flushOrdered();
      blocks.push(
        <p key={`p-${idx}`} className="text-zinc-300 leading-relaxed my-1.5">
          {renderInline(trimmed, `p-${idx}`)}
        </p>
      );
    }
  });

  flushUnordered();
  flushOrdered();
  flushCode();

  return <div className="text-sm">{blocks}</div>;
}
