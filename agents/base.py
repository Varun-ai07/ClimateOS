"""Base agent class — all agents inherit from this."""

from abc import ABC, abstractmethod
from datetime import datetime
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from state.schema import MunicipalityClimateState, AgentExecution
from services.llm_service import call_llm


class BaseAgent(ABC):
    """Base class for all climate agents."""

    name: str = "base_agent"
    description: str = ""

    def __init__(self):
        self.execution = AgentExecution(agent_name=self.name)

    async def run(self, state: MunicipalityClimateState) -> MunicipalityClimateState:
        """Execute agent with logging and state updates."""
        self.execution.status = "running"
        self.execution.started_at = datetime.now().isoformat()
        self.execution.progress = 0.0

        # Add to agents list if not present
        if not any(a.agent_name == self.name for a in state.agents):
            state.agents.append(self.execution)
        else:
            for a in state.agents:
                if a.agent_name == self.name:
                    a.status = "running"
                    a.started_at = self.execution.started_at

        try:
            state = await self.execute(state)
            self.execution.status = "completed"
            self.execution.progress = 1.0
            self.execution.completed_at = datetime.now().isoformat()
        except Exception as e:
            self.execution.status = "error"
            self.execution.log = str(e)
            self.execution.completed_at = datetime.now().isoformat()

        # Update in state
        for a in state.agents:
            if a.agent_name == self.name:
                a.status = self.execution.status
                a.progress = self.execution.progress
                a.log = self.execution.log
                a.completed_at = self.execution.completed_at

        return state

    @abstractmethod
    async def execute(self, state: MunicipalityClimateState) -> MunicipalityClimateState:
        """Override in subclass."""
        pass

    async def llm_call(self, prompt: str, system: str = "") -> str:
        """Call LLM via service layer."""
        return await call_llm(prompt, system)

    def add_timeline_event(self, state: MunicipalityClimateState, event: str, details: str = ""):
        """Add event to timeline for frontend animation."""
        state.timeline_events.append({
            "timestamp": datetime.now().isoformat(),
            "agent": self.name,
            "event": event,
            "details": details,
        })

    def add_map_update(self, state: MunicipalityClimateState, update_type: str, data: dict):
        """Add map update for frontend animation."""
        state.map_updates.append({
            "timestamp": datetime.now().isoformat(),
            "type": update_type,
            "data": data,
        })
