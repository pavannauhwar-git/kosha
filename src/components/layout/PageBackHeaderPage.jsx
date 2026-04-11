import PageBackHeader from './PageBackHeader'

export default function PageBackHeaderPage({
  title,
  onBack,
  rightSlot = null,
  children,
  rootClassName = 'min-h-dvh bg-kosha-bg',
  rootStyle,
  headerClassName = 'mb-2',
  contentClassName = 'px-4 pt-5 pb-24 max-w-[560px] mx-auto',
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
        <div className={`page-header-offset ${contentClassName}`.trim()}>
          {children}
        </div>
      )}
    </div>
  )
}