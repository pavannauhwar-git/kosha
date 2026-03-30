export default function FilterRow({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 min-h-[2.3rem] ${className}`.trim()}>
      {children}
    </div>
  )
}
