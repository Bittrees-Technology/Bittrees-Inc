import { useId } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './forum-markdown.css';
/** No raw HTML, scripts, remote embeds, or automatically loaded tracking images. */
export function ForumMarkdown({text}:{text:string}) {
  return <div className="forum-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml
    urlTransform={url => /^(https?:\/\/|mailto:)/i.test(url) || (/^\/(?!\/)/.test(url)) || url.startsWith('#') ? url : ''}
    components={{
      a:({href,children})=>href?<a href={href} target="_blank" rel="noreferrer noopener">{children}</a>:<span>{children}</span>,
      img:({src,alt})=>src?<a href={src} target="_blank" rel="noreferrer noopener">[Image: {alt||'view image'}]</a>:<span>{alt||'[Image]'}</span>,
    }}>{text}</ReactMarkdown></div>;
}
export function MarkdownField({value,onChange,label='Post text',rows=6}:{value:string;onChange:(text:string)=>void;label?:string;rows?:number}) {
  const id=useId();
  return <div className="markdown-field">
    <label htmlFor={id} style={{display:'block'}}>{label}</label><textarea id={id} value={value} onChange={e=>onChange(e.target.value)} maxLength={20000} rows={rows} style={{display:'block',width:'100%',padding:12,resize:'vertical',boxSizing:'border-box',border:'1px solid var(--color-border)',font:'inherit'}} />
    <p className="markdown-help">Markdown supported: headings, **bold**, lists, links, quotes, tables and code. Images appear as links.</p>
    <details><summary>Preview Markdown</summary>{value.trim()?<ForumMarkdown text={value}/>:<p>Write something to preview it.</p>}</details>
  </div>;
}
