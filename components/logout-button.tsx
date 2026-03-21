export function LogoutButton() {
  return (
    <form action="/api/session/logout" method="post">
      <button className="btn btn-secondary btn-sm" type="submit">
        Sign out
      </button>
    </form>
  );
}
