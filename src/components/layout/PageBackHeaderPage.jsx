import PageBackHeader from './PageBackHeader'

export default function PageBackHeaderPage({
  title,
  onBack,
  rightSlot = null,
  children,
  rootClassName = 'min-h-dvh bg-kosha-bg',
  rootStyle,
  headerClassName = 'mb-2',
  contentClassName = 'page min-h-0',
}) {
  return (
    <div className={rootClassName} style={rootStyle}>
      <PageBackHeader
        className={headerClassName}
        title={title}
        onBack={onBack}
        rightSlot={rightSlot}
      />

      {contentClassName == null ? (
        <div className="page-header-offset">
          {children}
        </div>
      ) : (
        <div className="page-header-offset">
          <div className={contentClassName}>
            {children}
          </div>
        </div>
      )}
    </div>
  )
}