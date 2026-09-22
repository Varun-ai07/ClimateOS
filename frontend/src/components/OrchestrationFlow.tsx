import { motion, AnimatePresence } from "framer-motion";

function CheckIcon(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function LoaderIcon(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function AlertIcon(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

interface Stage {
  id: string;
  name: string;
  thinking: string;
  status: "pending" | "running" | "completed" | "error";
  duration?: number;
}

interface OrchestrationFlowProps {
  stages: Stage[];
  currentStep: number;
  overallProgress: number;
  status: "idle" | "running" | "completed" | "error";
}

export default function OrchestrationFlow({ stages, currentStep, overallProgress, status }: OrchestrationFlowProps) {
  const visibleStages = stages.filter((s) => s.name !== "engagement_agent");
  const currentStage = visibleStages[currentStep];

  return (
    <div className="bg-white rounded-xl p-5 border border-neutral-light shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-decided">Plan Pipeline</h3>
        <div className="text-xs text-idle">
          {overallProgress}%
        </div>
      </div>

      <div className="space-y-3">
        {visibleStages.map((stage, index) => {
          const isActive = index === currentStep && status === "running";
          const isCompleted = stage.status === "completed";
          const isPending = stage.status === "pending";

          return (
            <div key={stage.id} className="relative">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  {isCompleted ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-decided">
                      <CheckIcon className="h-3 w-3 text-white" />
                    </div>
                  ) : isActive ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-decided">
                      <LoaderIcon className="h-3 w-3 animate-spin text-decided" />
                    </div>
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-idle bg-white" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isCompleted ? 'text-decided' : isActive ? 'text-decided' : 'text-idle'}`}>
                        {stage.name}
                      </span>
                      {stage.status === "error" && <AlertIcon className="h-4 w-4 text-alert" />}
                    </div>
                    <span className="text-xs text-idle">
                      {isCompleted && stage.duration ? `${stage.duration}ms` : ''}
                    </span>
                  </div>

                  <AnimatePresence>
                    {isActive && stage.thinking && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 overflow-hidden"
                      >
                        <div className="rounded-lg border border-neutral-light bg-decided/5 p-3">
                          <div className="mb-1 text-xs font-semibold text-acting">Thinking</div>
                          <div className="text-xs text-idle">{stage.thinking}</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
