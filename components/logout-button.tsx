export function LogoutButton() {
  return (
    <form action="/api/session/logout" method="post">
      <button className="button-danger" type="submit">
        Sign out
      </button>
    </form>
  );
}
