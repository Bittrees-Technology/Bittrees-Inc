import { CHAT_URL } from "../lib/links";
import "./chat-page.css";

const features = [
  { title: "Conversations", body: "Send direct messages and join community rooms. Each community sets its own membership rules." },
  { title: "Connected email", body: "Connect a Bittrees Mail account you authorize to read, send and reply from Chat." },
  { title: "Forum updates", body: "Follow new Governance discussions, see unread updates and open a thread to take part." },
];

/** Retain the historical route so existing bookmarks keep working. */
export default function Chirpy() {
  return <article className="chat-page">
    <header className="chat-page-hero">
      <h1>Chat</h1>
      <p className="chat-page-intro">Conversations across Bittrees.</p>
      <p className="chat-page-description">Messages, community rooms, connected email and forum updates in one place.</p>
      <a className="btn-primary" href={CHAT_URL}>Open Chat</a>
      <p className="chat-page-address">chat.bittrees.org · Available in your browser</p>
    </header>

    <section className="chat-page-features" aria-label="What you can do in Chat">
      {features.map(feature => <div key={feature.title}>
        <h2>{feature.title}</h2>
        <p>{feature.body}</p>
      </div>)}
    </section>

    <section className="chat-page-start">
      <h2>Start with your wallet</h2>
      <p>Open Chat and connect your wallet in Settings. Choose the conversations and communities you want to follow.</p>
      <a href={`${CHAT_URL}/?forum=governance`}>Follow the Governance forum</a>
      <p className="chat-page-note">Forum updates refresh while Chat is open. Following a forum does not grant access to private rooms.</p>
    </section>

    <footer className="chat-page-resources">
      <div><a href={`${CHAT_URL}/support`}>Chat support</a><a href="https://github.com/Bittrees-Technology/chirpy" target="_blank" rel="noreferrer">Source code</a></div>
    </footer>
  </article>;
}
