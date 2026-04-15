import PageHeader from './PageHeader'

export default function PageHeaderPage({
  title,
  leftSlot = null,
  rightSlot = null,
  beforeHeader = null,
  children,
  pageClassName = 'page',
  pageStyle,
  pageProps = {},
  headerClassName = 'mb-2',
  showHeader = true,
  withHeaderOffset = true,
}) {
  return (
    <div className={pageClassName} style={pageStyle} {...pageProps}>
      {beforeHeader}
      {showHeader ? (
        <PageHeader
          title={title}
          className={headerClassName}
          leftSlot={leftSlot}
          rightSlot={rightSlot}
        />
      ) : null}
      {withHeaderOffset ? <div className="page-header-offset">{children}</div> : children}
    </div>
  )
}
