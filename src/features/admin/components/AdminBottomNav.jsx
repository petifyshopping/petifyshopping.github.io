import { SidebarIcon } from "../WorkspaceSidebar.jsx";

export default function AdminBottomNav({ items }) {
  return (
    <nav className="admin-bottom-nav" aria-label="Workspace sections">
      {items.map((item) => {
        const content = <><span className="admin-bottom-nav-icon">
          {item.id === "settings" ? "⚙" : <SidebarIcon name={item.icon} size={21} />}
        </span><span className="admin-bottom-nav-label">{item.label}</span></>;
        const props = {
          className: `admin-bottom-nav-item${item.active ? " active" : ""}`,
          "aria-current": item.active ? "page" : undefined,
        };

        return item.href
          ? <a key={item.id} {...props} href={item.href}>{content}</a>
          : <button key={item.id} {...props} type="button" onClick={item.onClick}>{content}</button>;
      })}
    </nav>
  );
}
