import ProfileMenu from '../navigation/ProfileMenu'

export default function PageHeader({ title, className = 'mb-3' }) {
  return (
    <div
      className={`app-header app-header--main app-header--guttered justify-between ${className}`}
    >
      <h1 className="app-header-title-main">{title}</h1>
      <div className="md:hidden">
        <ProfileMenu />
      </div>
    </div>
  )
}
