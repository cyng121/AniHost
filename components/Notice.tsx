import Link from "next/link";

/**
 * Every failure the viewer can see goes through here: say what happened, in
 * their words, and give them the one thing they can do about it.
 */
export function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="notice" role="status">
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {action ? (
        <Link className="btn btn--ghost" href={action.href} style={{ marginTop: 16 }}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
