export default function SkeletonLayout({ sections = [], className = 'space-y-4' }) {
  return (
    <div className={className}>
      {sections.map((section, index) => {
        if (section.type === 'grid') {
          const cols = section.cols || 2
          const count = section.count || cols
          const height = section.height || 'h-[100px]'
          return (
            <div
              key={index}
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: count }).map((_, i) => (
                <div key={`${index}-${i}`} className={`skeleton shimmer oneui-squircle ${height}`} />
              ))}
            </div>
          )
        }

        return (
          <div key={index} className={`skeleton shimmer oneui-squircle ${section.height || 'h-[100px]'}`} />
        )
      })}
    </div>
  )
}
