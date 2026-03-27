export default function FilterRow({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 ${className}`.trim()}>
      {children}
    </div>
  )
}
