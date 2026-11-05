export default function AdminWorkspaceFooter({ brandName = "Petify" }) {
  return (
    <footer className="admin-workspace-footer">
      <span>{brandName} admin workspace</span>
      <span>© {new Date().getFullYear()}</span>
    </footer>
  );
}
