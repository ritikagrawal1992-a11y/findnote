import React, {
  useState,
  useEffect,
  type ReactNode,
  type FormEvent,
} from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Task = { id: number; title: string; status: string; priority: string };
type Product = {
  id: number;
  sku: string;
  name: string;
  quantity: number;
  threshold: number;
  low_stock: number;
};
type Movement = { id: number; name: string; note: string; delta: number };
type BookingRecord = {
  id: number;
  resource: string;
  guest: string;
  starts_at: string;
  ends_at: string;
};
type Expense = {
  id: number;
  label: string;
  payer: string;
  cents: number;
  participants: string[];
};
type Balance = { person: string; cents: number };
type Settlement = { from: string; to: string; cents: number };
type Inbox = { id: string; name: string; secret: string };
type CapturedEvent = {
  id: number;
  event_key: string;
  body: string;
  received_at: string;
};
type DocumentRecord = { id: number; title: string; body: string };
async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch("/api" + path, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}
function useLoad<T>(path: string, revision: number) {
  const [data, setData] = useState<T>(),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api" + path, { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [path, revision]);
  return { data, error };
}
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="notice" role="alert">
      {children}
    </p>
  );
}
function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = true,
  min,
  step,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  step?: string;
  children?: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children ? (
        <select aria-label={label} name={name} required={required}>
          {children}
        </select>
      ) : type === "textarea" ? (
        <textarea
          aria-label={label}
          name={name}
          placeholder={placeholder}
          required={required}
          rows={5}
        />
      ) : (
        <input
          aria-label={label}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          min={min}
          step={step}
        />
      )}
    </label>
  );
}
function Form({
  title,
  children,
  submit,
  onSubmit,
}: {
  title: string;
  children: ReactNode;
  submit: string;
  onSubmit: (f: FormData) => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await onSubmit(new FormData(form));
      form.reset();
      setSuccess("Saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>{title}</h2>
      <form onSubmit={send}>
        {children}
        {error && <Notice>{error}</Notice>}
        <div className="form-footer">
          <button disabled={busy}>{busy ? "Saving…" : submit}</button>
          {success && <span role="status">{success}</span>}
        </div>
      </form>
    </section>
  );
}
type Props = { revision: number; refresh: () => void };
function Search({ revision, refresh }: Props) {
  const [query, setQuery] = useState(""),
    [actionError, setError] = useState("");
  const { data, error } = useLoad<DocumentRecord[]>(
    "/documents?q=" + encodeURIComponent(query),
    revision,
  );
  return (
    <>
      <section className="search-bar">
        <label htmlFor="search">Search the knowledge library</label>
        <input
          id="search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try deployment, API, or incident…"
        />
        <span className="hint">
          Prefix matching · all search terms required · ranked by relevance
        </span>
      </section>
      <div className="two search-layout">
        <section>
          <h2>
            {query ? "Search results" : "Knowledge library"}{" "}
            <span className="count">{data?.length ?? 0}</span>
          </h2>
          {(error || actionError) && <Notice>{error || actionError}</Notice>}
          {data && !data.length && (
            <p className="hint">
              No matching documents. Try fewer terms or add a note.
            </p>
          )}
          {data?.map((d) => (
            <article className="panel document" key={d.id}>
              <h3>{d.title}</h3>
              <p>{d.body}</p>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await api("/documents/" + d.id, "DELETE");
                    setError("");
                    refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Delete note
              </button>
            </article>
          ))}
        </section>
        <Form
          title="Add a searchable note"
          submit="Save note"
          onSubmit={async (f) => {
            await api("/documents", "POST", {
              title: f.get("title"),
              body: f.get("body"),
            });
            refresh();
          }}
        >
          <Field
            label="Title"
            name="title"
            placeholder="Database migration runbook"
          />
          <Field
            label="Content"
            name="body"
            type="textarea"
            placeholder="Write a note, checklist, or runbook…"
          />
          <p className="hint">
            The search index updates in the same transaction as the document.
          </p>
        </Form>
      </div>
    </>
  );
}
function App(){
      const [revision,setRevision]=useState(0);
      return <div className="shell"><aside><a className="brand" href="#"><span className="brand-mark">F</span><span>Findnote<small>OPEN SOURCE APPLICATION</small></span></a><p className="nav-label">KNOWLEDGE</p><div className="sidebar-note"><b>Built to explore.</b><p>React · TypeScript · Node.js<br/>SQLite · Playwright</p><span>v0.1 · Local demo</span></div></aside><main><div className="topline"><span>FINDNOTE / KNOWLEDGE</span><span className="local-tag">LOCAL DEMO</span></div><header><p className="eyebrow">OPEN SOURCE / KNOWLEDGE</p><h1>Findnote</h1><p className="lead">A searchable document library with ranked SQLite FTS5 prefix retrieval.</p></header><Search revision={revision} refresh={()=>setRevision(v=>v+1)}/><footer>Findnote · MIT licensed source · AI-assisted local demo</footer></main></div>;
    }
    createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
    