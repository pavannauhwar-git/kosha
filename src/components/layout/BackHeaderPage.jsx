import PageBackHeader from './PageBackHeader'

export default function BackHeaderPage({
  title,
  onBack,
  rightSlot = null,
  children,
  rootClassName = 'min-h-dvh bg-kosha-bg',
  rootStyle,
  headerClassName = 'mb-3',
  contentClassName = 'px-4 pt-6 pb-24 max-w-[560px] mx-auto',
}) {
  return (
    <div className={rootClassName} style={rootStyle}>
      <PageBackHeader
        className={headerClassName}
        title={title}
        onBack={onBack}
        rightSlot={rightSlot}
      />

      {contentClassName == null ? children : (
        <div className={contentClassName}>
          {children}
        </div>
      )}
    </div>
  )
}