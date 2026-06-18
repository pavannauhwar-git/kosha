
/**
 * FormField — Wraps AmountInput / Input and surfaces inline error text.
 * Used to unify validation error display across forms.
 */
export default function FormField({ error, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {children}
      {error && (
        <span role="alert" className="text-[11px] font-medium text-expense-text ml-1 mt-0.5">
          {error}
        </span>
      )}
    </div>
  )
}
