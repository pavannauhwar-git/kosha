export default function FilterRow({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 ${className}`.trim()}>
      {children}
    </div>
  )
}
