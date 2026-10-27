import ProjectHeader from "../../shared/ProjectHeader.jsx";

export default function AdminTopbar({
  brand,
  storefrontBrand,
  pageTitle,
  searchValue,
  onSearchChange,
  showSearch = false,
  children,
}) {
  return (
    <ProjectHeader
      variant="admin"
      brand={brand}
      storefrontBrand={storefrontBrand}
      pageTitle={pageTitle}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      showAdminSearch={showSearch}
    >
      {children}
    </ProjectHeader>
  );
}
