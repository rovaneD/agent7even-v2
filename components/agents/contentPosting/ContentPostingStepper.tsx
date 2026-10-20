import { Check } from 'lucide-react'

type Step = 'workflow' | 'format' | 'setup'

const STEPS: { id: Step; label: string; number: number }[] = [
  { id: 'workflow', label: 'Workflow', number: 1 },
  { id: 'format', label: 'Format', number: 2 },
  { id: 'setup', label: 'Setup', number: 3 },
]

export default function ContentPostingStepper({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex(s => s.id === current)

  return (
    <div className="mb-1 mt-8 flex items-center">
      {STEPS.map((step, index) => {
        const done = index < currentIndex
        const now = index === currentIndex
        return (
          <div key={step.id} className="contents">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] text-[12.5px] font-semibold ${
                  done || now
                    ? 'border-brand-primary bg-brand-primary text-white'
                    : 'border-white/15 bg-transparent text-[#6B6E76]'
                } ${now ? 'shadow-[0_0_0_4px_rgba(59,130,246,0.18)]' : ''}`}
              >
                {done ? <Check size={13} strokeWidth={2.6} /> : step.number}
              </span>
              <span
                className={`whitespace-nowrap text-[13.5px] ${
                  now ? 'font-semibold text-white' : done ? 'font-medium text-[#C9CBD1]' : 'font-medium text-[#6B6E76]'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`mx-3.5 h-[1.5px] min-w-6 flex-1 ${index < currentIndex ? 'bg-brand-primary' : 'bg-white/[0.12]'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
