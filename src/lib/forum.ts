import { resolveRevisions, validatePostText, type Revision } from "./forumRevisions.ts";
import { useQuery } from "@tanstack/react-query";
import {
  createPublicClient,
  http,
  encodeAbiParameters,
  decodeAbiParameters,
  parseAbi,
  parseEventLogs,
  encodePacked,
  keccak256,
  type WalletClient,
  type Address,
  type Hash,
} from "viem";
import { base } from "viem/chains";

/**
 * Decentralized, wallet-signed governance forum on EAS (Ethereum Attestation
 * Service), on Base.
 *
 * A post is an on-chain attestation against a fixed schema; replies reference
 * the root post via `refUID` (EAS's native threading). Posts are written with
 * plain viem `writeContract` to the EAS predeploy and read back through EASSCAN's
 * public GraphQL indexer — no backend of ours, no SDK, no ethers.
 *
 * Why on-chain (not off-chain): EAS off-chain attestations are private by
 * default — EASSCAN only indexes them if a user clicks "Publish to IPFS" in the
 * explorer; there is no documented/stable HTTP store. On-chain attestations are
 * auto-indexed from the `Attested` event, so posts reliably appear. Cost is a
 * fraction of a cent of gas per post on Base; the schema UID is deterministic.
 */

// ── Config (Base predeploys) ─────────────────────────────────────────────
export const EAS_ADDRESS: Address = "0x4200000000000000000000000000000000000021";
export const SCHEMA_REGISTRY: Address = "0x4200000000000000000000000000000000000020";
export const SCHEMA_STRING = "string community,string title,string body";
export const REVISION_SCHEMA_STRING = "uint8 version,string community,string title,string body";
export const RESOLVER: Address = "0x0000000000000000000000000000000000000000";
export const REVOCABLE = true;
export const FORUM_COMMUNITY = "bittrees-inc";
export const CONTRIB_COMMUNITY = "bittrees-contributors";
export const EASSCAN_GQL = "https://base.easscan.org/graphql";
export const EASSCAN_VIEW = "https://base.easscan.org/attestation/view/";

export const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDR: Address = "0x0000000000000000000000000000000000000000";

/** Deterministic schema UID — matches SchemaRegistry._getUID exactly. */
export const SCHEMA_UID = keccak256(
  encodePacked(["string", "address", "bool"], [SCHEMA_STRING, RESOLVER, REVOCABLE])
);

export const REVISION_SCHEMA_UID = keccak256(encodePacked(["string", "address", "bool"], [REVISION_SCHEMA_STRING, RESOLVER, REVOCABLE]));

/** Public Base client for reads (schema check) — public RPC, no wallet needed. */
const basePublic = createPublicClient({ chain: base, transport: http() });

// ── ABIs ─────────────────────────────────────────────────────────────────
export const EAS_ABI = [
  ...parseAbi(["function getAttestation(bytes32 uid) view returns ((bytes32 uid,bytes32 schema,uint64 time,uint64 expirationTime,uint64 revocationTime,bytes32 refUID,address recipient,address attester,bool revocable,bytes data))", "event Attested(address indexed recipient,address indexed attester,bytes32 uid,bytes32 indexed schemaUID)"]),
  {
    type: "function",
    name: "attest",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "schema", type: "bytes32" },
          {
            name: "data",
            type: "tuple",
            components: [
              { name: "recipient", type: "address" },
              { name: "expirationTime", type: "uint64" },
              { name: "revocable", type: "bool" },
              { name: "refUID", type: "bytes32" },
              { name: "data", type: "bytes" },
              { name: "value", type: "uint256" },
            ],
          },
        ],
      },
    ],
    outputs: [{ type: "bytes32" }],
  },
] as const;

export const REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "schema", type: "string" },
      { name: "resolver", type: "address" },
      { name: "revocable", type: "bool" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "getSchema",
    stateMutability: "view",
    inputs: [{ name: "uid", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "uid", type: "bytes32" },
          { name: "resolver", type: "address" },
          { name: "revocable", type: "bool" },
          { name: "schema", type: "string" },
        ],
      },
    ],
  },
] as const;

// ── Writes (pure viem) ─────────────────────────────────────────────────────

function encodePost(community: string, title: string, body: string): `0x${string}` {
  return encodeAbiParameters(
    [{ type: "string" }, { type: "string" }, { type: "string" }],
    [community, title, body]
  );
}

/** True once the forum schema is registered on Base (anyone, once — it's shared). */
export async function isSchemaRegistered(uid = SCHEMA_UID): Promise<boolean> {
  try {
    const rec = await basePublic.readContract({
      address: SCHEMA_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "getSchema",
      args: [uid],
    });
    return rec.uid !== ZERO32;
  } catch {
    throw new Error("Unable to verify the forum schema on Base. Try again before signing.");
  }
}

/** Register the forum schema if it isn't already (idempotent, one-time ever). */
async function ensureSchema(walletClient: WalletClient, account: Address, revision = false): Promise<void> {
  const uid = revision ? REVISION_SCHEMA_UID : SCHEMA_UID;
  if (await isSchemaRegistered(uid)) return;
  const hash = await walletClient.writeContract({
    address: SCHEMA_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "register",
    args: [revision ? REVISION_SCHEMA_STRING : SCHEMA_STRING, RESOLVER, REVOCABLE],
    account,
    chain: base,
  });
  const receipt = await basePublic.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw Error("Transaction reverted on Base.");
}

export interface PublishArgs {
  walletClient: WalletClient;
  account: Address;
  title: string;
  body: string;
  /** Root post UID to reply under; omit/ZERO32 for a new topic. */
  refUID?: `0x${string}`;
  /** Defaults to the forum community; contributor form uses CONTRIB_COMMUNITY. */
  community?: string;
}

/** Sign + submit a post (or reply) as an on-chain EAS attestation on Base. */
export async function publishPost(args: PublishArgs): Promise<Hash> {
  const { walletClient, account, title, body, refUID = ZERO32, community = FORUM_COMMUNITY } = args;
  validatePostText(title, body, refUID !== ZERO32);
  await ensureSchema(walletClient, account);

  const request = {
    schema: SCHEMA_UID,
    data: {
      recipient: ZERO_ADDR,
      expirationTime: 0n,
      revocable: true,
      refUID,
      data: encodePost(community, title, body),
      value: 0n,
    },
  } as const;

  const hash = await walletClient.writeContract({
    address: EAS_ADDRESS,
    abi: EAS_ABI,
    functionName: "attest",
    args: [request],
    account,
    chain: base,
  });
  const receipt = await basePublic.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw Error("Transaction reverted on Base.");
  return hash;
}

// ── Reads (EASSCAN GraphQL, public) ────────────────────────────────────────

export interface ForumPost {
  id: `0x${string}`;
  attester: Address;
  time: number;
  refUID: `0x${string}`;
  community: string;
  title: string;
  body: string;
  originalTitle?: string;
  originalBody?: string;
  revisionId?: string;
  editedAt?: number;
  revisions?: Revision[];
}

const FIELDS = `id attester refUID schemaId revocationTime expirationTime time decodedDataJson`;

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(EASSCAN_GQL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`EASSCAN HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? "EASSCAN GraphQL error");
  return json.data as T;
}

export interface RawAttestation {
  schemaId: string;
  expirationTime: number;
  id: string;
  attester: string;
  refUID: string;
  revocationTime: number;
  time: number;
  decodedDataJson: string;
}

function toPost(a: RawAttestation): ForumPost {
  let fields: Record<string, string> = {};
  try {
    const arr = JSON.parse(a.decodedDataJson) as Array<{ name: string; value: { value: unknown } }>;
    fields = Object.fromEntries(arr.map((f) => [f.name, String(f.value?.value ?? "")]));
  } catch {
    /* leave fields empty on malformed data */
  }
  return {
    id: a.id as `0x${string}`,
    attester: a.attester as Address,
    time: a.time,
    refUID: a.refUID as `0x${string}`,
    community: fields.community ?? "",
    title: fields.title ?? "",
    body: fields.body ?? "",
  };
}

/** Top-level posts (topics) for a community, newest first. */
export function useTopics(community = FORUM_COMMUNITY) {
  return useQuery({
    queryKey: ["forum-topics", community],
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
    queryFn: async (): Promise<ForumPost[]> => {
      const q = `
        query Topics($schemaId: String!, $community: String!) {
          attestations(
            where: {
              schemaId: { equals: $schemaId }
              refUID: { equals: "${ZERO32}" }
              revocationTime: { equals: 0 }
              decodedDataJson: { contains: $community }
            }
            orderBy: { time: desc }
            take: 100
          ) { ${FIELDS} }
        }`;
      const d = await gql<{ attestations: RawAttestation[] }>(q, {
        schemaId: SCHEMA_UID,
        community,
      });
      const posts = (d.attestations ?? []).filter(isActivePost).map(toPost).filter((p) => p.community === community);
      return withRevisions(posts);
    },
  });
}

/** A thread: the root post + its direct replies (oldest first). */
export function useThread(rootUID: string | undefined) {
  return useQuery({
    queryKey: ["forum-thread", rootUID],
    enabled: !!rootUID,
    staleTime: 20_000,
    refetchInterval: 45_000,
    retry: 1,
    queryFn: async (): Promise<{ root: ForumPost | null; replies: ForumPost[] }> => {
      const q = `
        query Thread($rootUID: String!, $schemaId: String!) {
          root: attestation(where: { id: $rootUID }) { ${FIELDS} }
          replies: attestations(
            where: {
              schemaId: { equals: $schemaId }
              refUID: { equals: $rootUID }
              revocationTime: { equals: 0 }
            }
            orderBy: { time: asc }
            take: 500
          ) { ${FIELDS} }
        }`;
      const d = await gql<{ root: RawAttestation | null; replies: RawAttestation[] }>(q, {
        rootUID,
        schemaId: SCHEMA_UID,
      });
      const original = d.root && isActivePost(d.root) ? toPost(d.root) : null;
      if (!original || original.community !== FORUM_COMMUNITY || original.refUID !== ZERO32) return {root:null,replies:[]};
      const originals = (d.replies ?? []).filter(isActivePost).map(toPost).filter(p => p.community === original.community && p.refUID.toLowerCase() === original.id.toLowerCase());
      const [root, ...replies] = await withRevisions([original,...originals]);
      return {root,replies};
    },
  });
}

/** Whether the forum schema is live on Base yet (gates the very first post). */
export function useSchemaRegistered() {
  return useQuery({
    queryKey: ["forum-schema-registered"],
    staleTime: 5 * 60_000,
    queryFn: () => isSchemaRegistered(),
  });
}


function isActivePost(a: RawAttestation) {
  return a.schemaId?.toLowerCase() === SCHEMA_UID.toLowerCase() && a.revocationTime === 0 &&
    (a.expirationTime === 0 || a.expirationTime > Date.now()/1000);
}
function revisionFromRaw(a: RawAttestation): Revision | null {
  try {
    const fields = Object.fromEntries(JSON.parse(a.decodedDataJson).map((f: {name:string;value:{value:unknown}})=>[f.name,f.value.value]));
    if(typeof fields.community !== 'string' || typeof fields.title !== 'string' || typeof fields.body !== 'string')return null;
    return {...a,version:Number(fields.version),community:fields.community,title:fields.title,body:fields.body};
  } catch {return null;}
}
/** Page all revisions for displayed originals, bounded to avoid presenting a truncated history as complete. */
export async function fetchRevisions(posts: ForumPost[]): Promise<Revision[]> {
  const result: Revision[]=[];
  for(let start=0;start<posts.length;start+=40){
    const group=posts.slice(start,start+40), ids=group.map(p=>p.id), authors=[...new Set(group.map(p=>p.attester))];
    let complete=false;
    for(let skip=0;skip<5000;skip+=200){
      const data=await gql<{attestations:RawAttestation[]}>(`query Revisions($schemaId: String!, $ids: [String!]!, $authors: [String!]!, $skip: Int!) {
        attestations(where: {schemaId: {equals: $schemaId}, refUID: {in: $ids}, attester: {in: $authors}, revocationTime: {equals: 0}}, orderBy: [{time: asc},{id: asc}], take: 200, skip: $skip) { ${FIELDS} }
      }`,{schemaId:REVISION_SCHEMA_UID,ids,authors,skip});
      if(!Array.isArray(data.attestations))throw Error('Revision history unavailable.');
      for(const raw of data.attestations){const revision=revisionFromRaw(raw);if(revision)result.push(revision);}
      if(data.attestations.length<200){complete=true;break;}
    }
    if(!complete)throw Error('Revision history exceeds the display limit. Open the on-chain record to inspect it.');
  }
  return result;
}
async function withRevisions(posts: ForumPost[]): Promise<ForumPost[]> {
  const revisions=await fetchRevisions(posts);
  return posts.map(post=>resolveRevisions(post,revisions,REVISION_SCHEMA_UID));
}

/** No administrator override: verify the original on Base before accepting an edit request. */
export async function publishRevision(args: {walletClient:WalletClient;account:Address;post:ForumPost;title:string;body:string;expectedRevisionId:string}) {
  const {walletClient,account,post,title,body,expectedRevisionId}=args;
  const original=await basePublic.readContract({address:EAS_ADDRESS,abi:EAS_ABI,functionName:'getAttestation',args:[post.id]});
  if(original.uid.toLowerCase() !== post.id.toLowerCase() || original.schema !== SCHEMA_UID || original.attester.toLowerCase() !== account.toLowerCase() || original.revocationTime !== 0n ||
    (original.expirationTime !== 0n && original.expirationTime <= BigInt(Math.floor(Date.now()/1000))))throw Error('Only the original author can edit an active forum post.');
  const [community,originalTitle,originalBody]=decodeAbiParameters([{type:'string'},{type:'string'},{type:'string'}],original.data);
  if(community !== FORUM_COMMUNITY)throw Error('This item is not a governance forum post.');
  validatePostText(title,body,original.refUID !== ZERO32);
  const target:ForumPost={id:original.uid,attester:original.attester,refUID:original.refUID,time:Number(original.time),community,title:originalTitle,body:originalBody};
  const [latest]=await withRevisions([target]);
  if(latest.revisionId?.toLowerCase() !== expectedRevisionId.toLowerCase())throw Error('This post changed while you were editing. Cancel and reopen the editor to load the latest version.');
  await ensureSchema(walletClient,account,true);
  const hash=await walletClient.writeContract({address:EAS_ADDRESS,abi:EAS_ABI,functionName:'attest',account,chain:base,args:[{
    schema:REVISION_SCHEMA_UID,data:{recipient:ZERO_ADDR,expirationTime:0n,revocable:true,refUID:target.id,
      data:encodeAbiParameters([{type:'uint8'},{type:'string'},{type:'string'},{type:'string'}],[1,community,title,body]),value:0n}
  }]});
  const receipt=await basePublic.waitForTransactionReceipt({hash});
  if(receipt.status !== 'success')throw Error('Edit transaction reverted on Base.');
  const event=parseEventLogs({abi:EAS_ABI,eventName:'Attested',logs:receipt.logs}).find(log=>log.address.toLowerCase() === EAS_ADDRESS.toLowerCase() && log.args.attester.toLowerCase() === account.toLowerCase() && log.args.schemaUID === REVISION_SCHEMA_UID);
  return {hash,uid:event?.args.uid};
}
