/** Pure read-side authorization: an untrusted indexer row never grants editing rights. */
export const MAX_POST_BODY = 20000;
export const MAX_POST_TITLE = 120;
export interface Revision {
  id: string; attester: string; refUID: string; schemaId: string;
  time: number; revocationTime: number; expirationTime: number;
  version: number; community: string; title: string; body: string;
}
export interface RevisionTarget {
  id: string; attester: string; community: string; title: string; body: string; refUID: string; time: number;
}
export function validatePostText(title: string, body: string, isReply: boolean) {
  if (!body.trim() || body.length > MAX_POST_BODY) throw Error(`Post text must contain 1–${MAX_POST_BODY} characters.`);
  if (title.length > MAX_POST_TITLE || (!isReply && !title.trim()) || (isReply && title !== ''))
    throw Error(isReply ? 'Replies cannot change the discussion title.' : `Title must contain 1–${MAX_POST_TITLE} characters.`);
}
export function resolveRevisions<T extends RevisionTarget>(post: T, candidates: Revision[], schema: string, now = Math.floor(Date.now()/1000)) {
  const seen = new Set<string>();
  const history = candidates.filter(r => {
    if (seen.has(r.id.toLowerCase())) return false;
    if (r.schemaId.toLowerCase() !== schema.toLowerCase() || r.refUID.toLowerCase() !== post.id.toLowerCase() ||
        r.attester.toLowerCase() !== post.attester.toLowerCase() || r.community !== post.community || r.version !== 1 ||
        r.revocationTime !== 0 || (r.expirationTime !== 0 && r.expirationTime <= now) ||
        !Number.isSafeInteger(r.time) || r.time < post.time || r.time > now || !/^0x[\da-f]{64}$/i.test(r.id)) return false;
    try {validatePostText(r.title,r.body,!/^0x0{64}$/i.test(post.refUID));} catch {return false;}
    seen.add(r.id.toLowerCase());return true;
  }).sort((a,b)=>a.time-b.time || a.id.toLowerCase().localeCompare(b.id.toLowerCase()));
  const latest=history[history.length-1];
  return {...post, title:latest?.title??post.title, body:latest?.body??post.body,
    originalTitle:post.title, originalBody:post.body, revisionId:latest?.id??post.id,
    editedAt:latest?.time, revisions:history};
}
