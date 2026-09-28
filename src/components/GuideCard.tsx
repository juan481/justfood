interface GuideTip {
  icon: string;
  title: string;
  body: string;
}

// The "so the client stops asking how things work" explainer — every
// screen except the KDS (that one needs to stay fast/uncluttered for
// active kitchen use, per Juan) opens with one of these.
export function GuideCard({ question, tips }: { question: string; tips: GuideTip[] }) {
  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in">
      <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
        <span className="material-symbols-rounded text-amber-500">lightbulb</span>
      </span>
      <div className="text-xs text-slate-600 space-y-1.5">
        <p className="font-bold text-sm text-slate-800">{question}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1.5">
          {tips.map((tip) => (
            <p key={tip.title} className="flex items-start gap-1.5">
              <span className="material-symbols-rounded text-sm text-command-800 shrink-0 mt-0.5">{tip.icon}</span>
              <span>
                <strong>{tip.title}:</strong> {tip.body}
              </span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
