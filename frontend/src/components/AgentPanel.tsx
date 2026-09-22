interface Props {
  agent: string
  state: any
}

const AGENT_DETAILS: Record<string, { title: string; description: string }> = {
  forecast_agent: { title: '🛰️ Forecast Agent', description: 'Loading climate projection data from synthetic forecast cache' },
  downscaling_agent: { title: '🔬 Downscaling Agent', description: 'Applying Quantile Delta Mapping to bias-correct coarse CMIP6 projections' },
  impact_agent: { title: '🗺️ Impact Agent', description: 'Mapping climate risks onto infrastructure using processed OSM data' },
  policy_agent: { title: '📋 Policy Agent', description: 'Generating municipal adaptation briefs using LLM' },
  integrity_agent: { title: '🛡️ Integrity Agent', description: 'Verifying claims against IPCC, WHO, NASA sources' },
  engagement_agent: { title: '📢 Engagement Agent', description: 'Generating citizen advisories in English and Tamil' },
}

export default function AgentPanel({ agent, state }: Props) {
  const agentData = state.agents?.find((a: any) => a.agent_name === agent)
  const meta = AGENT_DETAILS[agent] || { title: agent, description: '' }

  return (
    <div className="p-3 space-y-3">
      <div>
        <div className="font-medium text-sm">{meta.title}</div>
        <div className="text-xs text-idle mt-1">{meta.description}</div>
      </div>

      {agentData && (
        <div className="bg-neutral-light rounded-lg p-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-idle">Status</span>
            <span className={agentData.status === 'completed' ? 'text-decided' : agentData.status === 'running' ? 'text-acting' : 'text-idle/70'}>
              {agentData.status}
            </span>
          </div>
          {agentData.started_at && (
            <div className="flex justify-between">
              <span className="text-idle">Started</span>
              <span>{new Date(agentData.started_at).toLocaleTimeString()}</span>
            </div>
          )}
          {agentData.completed_at && (
            <div className="flex justify-between">
              <span className="text-idle">Completed</span>
              <span>{new Date(agentData.completed_at).toLocaleTimeString()}</span>
            </div>
          )}
          {agentData.log && (
            <div>
              <div className="text-idle mb-1">Log</div>
              <div className="bg-neutral-light/80 rounded p-2 text-idle/80 font-mono text-[11px]">{agentData.log}</div>
            </div>
          )}
        </div>
      )}

      {/* Agent-specific output */}
      {agent === 'forecast_agent' && state.forecast && (
        <div className="bg-neutral-light rounded-lg p-3 text-xs space-y-1">
          <div className="font-medium text-idle/80 mb-2">Forecast Data</div>
          <div>Precipitation: <span className="text-primary">{state.forecast.precipitation?.monthly_peak_mm} mm/month</span></div>
          <div>Temperature: <span className="text-primary">{state.forecast.temperature?.max_c} °C</span></div>
          <div>River level: <span className="text-primary">{state.forecast.river_level?.current_m}m</span></div>
        </div>
      )}

      {agent === 'downscaling_agent' && state.downscaled && (
        <div className="bg-neutral-light rounded-lg p-3 text-xs space-y-1">
          <div className="font-medium text-idle/80 mb-2">Downscaled Values</div>
          <div>Corrected: <span className="text-primary">{state.downscaled.corrected_precip_mm?.toFixed(1)} mm/month</span></div>
          <div>CI: <span className="text-primary">[{state.downscaled.confidence_interval?.lower?.toFixed(1)}-{state.downscaled.confidence_interval?.upper?.toFixed(1)}]</span></div>
          <div>Risk score: <span className="text-primary">{state.downscaled.risk_score?.toFixed(0)}/100</span></div>
        </div>
      )}

      {agent === 'impact_agent' && state.impact && (
        <div className="bg-neutral-light rounded-lg p-3 text-xs space-y-1">
          <div className="font-medium text-idle/80 mb-2">Impact Assessment</div>
          <div>Hospitals affected: <span className="text-alert">{state.impact.hospitals_affected}</span></div>
          <div>Schools affected: <span className="text-acting">{state.impact.schools_affected}</span></div>
          <div>Buildings affected: <span className="text-alert">{state.impact.buildings_affected}</span></div>
          <div>Risk zones: <span className="text-primary">{state.impact.risk_zones?.length}</span></div>
        </div>
      )}

      {agent === 'policy_agent' && state.policy && (
        <div className="bg-neutral-light rounded-lg p-3 text-xs space-y-1">
          <div className="font-medium text-idle/80 mb-2">Policy: {state.policy.title}</div>
          {state.policy.actions?.map((a: any, i: number) => (
            <div key={i} className="flex gap-2">
              <span className="text-primary">[{a.priority}]</span>
              <span>{a.action}</span>
              <span className="text-idle/70 ml-auto">{a.timeline}</span>
            </div>
          ))}
        </div>
      )}

      {agent === 'integrity_agent' && state.integrity && (
        <div className="bg-neutral-light rounded-lg p-3 text-xs space-y-1">
          <div className="font-medium text-idle/80 mb-2">Integrity Verification</div>
          <div>SFS: <span className="text-primary">{state.integrity.scientific_fidelity_score}</span></div>
          <div>Verdict: <span className={state.integrity.verdict === 'approved' ? 'text-decided' : 'text-alert'}>{state.integrity.verdict?.toUpperCase()}</span></div>
          <div className="text-idle mt-2">Sources:</div>
          {state.integrity.sources_used?.map((s: string, i: number) => (
            <div key={i} className="pl-2">• {s}</div>
          ))}
          <div className="text-idle mt-2">Claims checked:</div>
          {state.integrity.claims_checked?.map((c: any, i: number) => (
            <div key={i} className="pl-2">{c.verified ? '✓' : '✗'} {c.claim_text?.substring(0, 50)}</div>
          ))}
        </div>
      )}

      {agent === 'engagement_agent' && state.engagement && (
        <div className="bg-neutral-light rounded-lg p-3 text-xs space-y-2">
          <div className="font-medium text-idle/80 mb-2">Citizen Advisory</div>
          <div>
            <div className="text-idle mb-1">English</div>
            <div className="bg-neutral-light/80 rounded p-2">{state.engagement.english?.substring(0, 200)}...</div>
          </div>
          <div>
            <div className="text-idle mb-1">Tamil (தமிழ்)</div>
            <div className="bg-neutral-light/80 rounded p-2">{state.engagement.tamil?.substring(0, 200)}...</div>
          </div>
          <div>
            <div className="text-idle mb-1">SMS Alert</div>
            <div className="bg-neutral-light/80 rounded p-2 text-primary">{state.engagement.sms}</div>
          </div>
        </div>
      )}
    </div>
  )
}
