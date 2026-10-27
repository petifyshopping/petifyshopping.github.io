import { useState } from "react";

const iconPaths = {
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  products: ["M3 7 12 3l9 4-9 4-9-4Z", "M3 7v10l9 4 9-4V7", "M12 11v10"],
  customers: ["M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M16 11h5", "M18.5 8.5v5"],
  sales: ["M4 19V5", "M4 19h17", "m7 15 4-4 3 3 6-7", "M17 7h3v3"],
  settings: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 3.1-.2-.1a1.7 1.7 0 0 0-1.8.3l-.1.1h-3.6l-.1-.2a1.7 1.7 0 0 0-1.5-1.1 1.7 1.7 0 0 0-1.3.8l-.1.2-3.1-1.8.1-.2a1.7 1.7 0 0 0-.3-1.8l-.1-.1v-3.6l.2-.1a1.7 1.7 0 0 0 1.1-1.5 1.7 1.7 0 0 0-.8-1.3l-.2-.1 1.8-3.1.2.1a1.7 1.7 0 0 0 1.8-.3l.1-.1h3.6l.1.2a1.7 1.7 0 0 0 1.5 1.1 1.7 1.7 0 0 0 1.3-.8l.1-.2 3.1 1.8-.1.2a1.7 1.7 0 0 0 .3 1.8l.1.1v3.6l-.2.1a1.7 1.7 0 0 0-1.1 1.5Z"],
  storefront: ["M3 10h18", "m5 10 1 11h12l1-11", "M4 10l2-7h12l2 7", "M9 21v-6h6v6"],
  about: ["M4 5h16", "M4 10h16", "M4 15h10", "M4 20h10", "M18 15v5", "m16 18 2 2 2-2"],
  footer: ["M4 5h16", "M4 10h16", "M4 15h16", "M4 20h16"],
  brand: ["M12 3 4 7v10l8 4 8-4V7l-8-4Z", "m4 7 8 4 8-4", "M12 11v10"],
  team: ["M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M20 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  overview: ["M3 3h8v8H3z", "M13 3h8v5h-8z", "M13 10h8v11h-8z", "M3 13h8v8H3z"],
  create: ["M12 5v14", "M5 12h14"],
  history: ["M3 12a9 9 0 1 0 2.6-6.4L3 8", "M3 3v5h5", "M12 7v5l3 2"],
  signout: ["M10 17l5-5-5-5", "M15 12H3", "M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"],
};

function SidebarIcon({ name }) {
  const paths = iconPaths[name] ?? iconPaths.overview;
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((path) => <path key={path} d={path} />)}
    </svg>
  );
}

export default function WorkspaceSidebar({ heading = "WORKSPACE", items }) {
  const [collapsed, setCollapsed] = useState(true);
  const activeGroupIds = items.filter((item) => item.children?.length && item.active).map((item) => item.id);
  const activeGroupKey = activeGroupIds.join(",");
  const [groupState, setGroupState] = useState(() => ({
    activeKey: activeGroupKey,
    expanded: new Set(items
      .filter((item) => item.children?.length && (item.active || item.expanded))
      .map((item) => item.id)),
  }));
  if (groupState.activeKey !== activeGroupKey) {
    const expanded = new Set(groupState.expanded);
    activeGroupIds.forEach((id) => expanded.add(id));
    setGroupState({ activeKey: activeGroupKey, expanded });
  }
  const expandedGroups = groupState.expanded;

  return (
    <aside className={`workspace-nav${collapsed ? " is-collapsed" : ""}`}>
      <button
        className="workspace-nav-toggle"
        type="button"
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-expanded={!collapsed}
        aria-controls="workspace-navigation"
        onClick={() => setCollapsed((value) => !value)}
      >
        <SidebarIcon name="menu" />
        <span className="workspace-nav-label">{collapsed ? "Menu" : "Collapse menu"}</span>
      </button>
      <nav id="workspace-navigation" aria-label={heading}>
        {!collapsed && <p className="admin-eyebrow workspace-nav-heading">{heading}</p>}
        {items.map((item) => {
          const className = `workspace-nav-item${item.active ? " active" : ""}`;
          const content = <><SidebarIcon name={item.icon} /><span className="workspace-nav-label">{item.label}</span></>;
          const commonProps = {
            className,
            title: collapsed ? item.label : undefined,
            "aria-label": item.label,
            "aria-current": item.active ? "page" : undefined,
          };

          if (item.children?.length) {
            const expanded = expandedGroups.has(item.id);
            const parentContent = <><SidebarIcon name={item.icon} /><span className="workspace-nav-label">{item.label}</span></>;
            return (
              <div className="workspace-nav-group" key={item.id}>
                <div className="workspace-nav-group-header">
                  {item.href ? (
                    <a {...commonProps} href={item.href}>{parentContent}</a>
                  ) : (
                    <button {...commonProps} type="button" onClick={() => {
                      item.onClick?.();
                      setCollapsed(false);
                      setGroupState((current) => {
                        const expanded = new Set(current.expanded);
                        expanded.add(item.id);
                        return { ...current, expanded };
                      });
                    }}>{parentContent}</button>
                  )}
                  {!collapsed && (
                    <button
                      className="workspace-nav-group-toggle"
                      type="button"
                      aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label} submenu`}
                      aria-expanded={expanded}
                      onClick={() => setGroupState((current) => {
                        const expanded = new Set(current.expanded);
                        if (expanded.has(item.id)) expanded.delete(item.id);
                        else expanded.add(item.id);
                        return { ...current, expanded };
                      })}
                    >
                      <span className={`workspace-nav-chevron${expanded ? " expanded" : ""}`} aria-hidden="true">›</span>
                    </button>
                  )}
                </div>
                {!collapsed && expanded && (
                  <div className="workspace-nav-children">
                    {item.children.map((child) => {
                      const childContent = <><SidebarIcon name={child.icon} /><span className="workspace-nav-label">{child.label}</span></>;
                      const childClassName = `workspace-nav-child${child.active ? " active" : ""}`;
                      if (child.href) {
                        return <a key={child.id} className={childClassName} href={child.href} title={child.label} aria-current={child.active ? "page" : undefined}>{childContent}</a>;
                      }
                      return <button key={child.id} className={childClassName} type="button" onClick={child.onClick} aria-current={child.active ? "page" : undefined}>{childContent}</button>;
                    })}
                  </div>
                )}
              </div>
            );
          }

          if (item.href) {
            return <a key={item.id} {...commonProps} href={item.href}>{content}</a>;
          }
          return <button key={item.id} {...commonProps} type="button" onClick={item.onClick}>{content}</button>;
        })}
      </nav>
    </aside>
  );
}
