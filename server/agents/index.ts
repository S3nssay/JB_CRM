/**
 * Multi-Agent AI System - Main Export
 * John Barclay Estate & Management
 */

// Types
export * from './types';

// Base classes
export { BaseAgent } from './BaseAgent';
export { SupervisorAgent, supervisorAgent } from './SupervisorAgent';

// Specialist Agents
export { SalesAgent, salesAgent } from './specialists/SalesAgent';
export { RentalAgent, rentalAgent } from './specialists/RentalAgent';
export { MaintenanceAgent, maintenanceAgent } from './specialists/MaintenanceAgent';
export { OfficeAdminAgent, officeAdminAgent } from './specialists/OfficeAdminAgent';
export { LeadGenSalesAgent, LeadGenRentalsAgent, leadGenSalesAgent, leadGenRentalsAgent } from './specialists/LeadGenAgent';
export { MarketingAgent, marketingAgent } from './specialists/MarketingAgent';

// Orchestrator
export { AgentOrchestrator, agentOrchestrator } from './AgentOrchestrator';

/**
 * Initialize the agent system
 */
export function initializeAgentSystem(): void {
  const { agentOrchestrator } = require('./AgentOrchestrator');

  // Start the orchestrator
  agentOrchestrator.start();

  // Set up event listeners for logging
  agentOrchestrator.on('agent_event', (event: any) => {
    console.log(`[Agent Event] ${event.type} - Agent: ${event.agentType}`, event.data);
  });

  agentOrchestrator.on('task_completed', (event: any) => {
    console.log(`[Task Completed] ${event.taskId}`);
  });

  agentOrchestrator.on('task_escalated', (event: any) => {
    console.log(`[Task Escalated] ${event.taskId} - Reason: ${event.data?.reason}`);
  });

  console.log('[Agent System] Initialized and running');
}

/**
 * Get a summary of all available agents
 */
export function getAgentSummary(): {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  taskTypes: string[];
  channels: string[];
}[] {
  const { agentOrchestrator } = require('./AgentOrchestrator');
  const agents = agentOrchestrator.getSupervisor().getRegisteredAgents();

  const summary: any[] = [];

  agents.forEach((agent: any, type: string) => {
    const config = agent.getConfig();
    summary.push({
      id: type,
      name: config.name,
      description: config.description,
      enabled: config.enabled,
      taskTypes: config.handlesTaskTypes,
      channels: config.communicationChannels,
    });
  });

  return summary;
}
