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
}) {
  return (
    <div className={pageClassName} style={pageStyle} {...pageProps}>
      {beforeHeader}
      <PageHeader
        title={title}
        className={headerClassName}
        leftSlot={leftSlot}
        rightSlot={rightSlot}
      />
      {children}
    </div>
  )
}
