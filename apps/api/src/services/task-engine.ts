// StacksTasker - Task lifecycle engine + payment orchestration

import { randomUUID } from 'crypto';
import { stxToMicroStx, microStxToStx } from '@x402/stacks';
import type {
  Task,
  Agent,
  TaskStatus,
  TaskCategory,
  CreateTaskRequest,
  RegisterAgentRequest,
} from '../types.js';

/**
 * In-memory store for tasks and agents (MVP - no database needed)
 */
const tasks = new Map<string, Task>();
const agents = new Map<string, Agent>();

/**
 * Facilitator URL for payment settlement
 */
let facilitatorUrl = process.env.FACILITATOR_URL ?? 'http://localhost:4000';

export function setFacilitatorUrl(url: string) {
  facilitatorUrl = url;
}

// ─── Task Operations ──────────────────────────────────────────

export function createTask(req: CreateTaskRequest): Task {
  const id = randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  const task: Task = {
    id,
    title: req.title,
    description: req.description,
    category: req.category,
    bounty: req.bounty,
    bountyMicroStx: stxToMicroStx(req.bounty),
    status: 'open',
    posterAddress: req.posterAddress,
    createdAt: now,
    updatedAt: now,
  };

  tasks.set(id, task);
  console.log(`[TaskEngine] Created task ${id}: "${req.title}" (${req.bounty} STX)`);
  return task;
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

export function listTasks(filters?: {
  status?: TaskStatus;
  category?: TaskCategory;
}): Task[] {
  let result = Array.from(tasks.values());

  if (filters?.status) {
    result = result.filter(t => t.status === filters.status);
  }
  if (filters?.category) {
    result = result.filter(t => t.category === filters.category);
  }

  // Sort by newest first
  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function acceptTask(taskId: string, agentId: string): Task | { error: string } {
  const task = tasks.get(taskId);
  if (!task) return { error: 'Task not found' };
  if (task.status !== 'open') return { error: `Task is ${task.status}, not open` };

  const agent = agents.get(agentId);
  if (!agent) return { error: 'Agent not registered' };

  task.status = 'assigned';
  task.assignedAgent = agentId;
  task.updatedAt = new Date().toISOString();

  agent.lastActiveAt = new Date().toISOString();

  console.log(`[TaskEngine] Task ${taskId} assigned to agent ${agent.name}`);
  return task;
}

export async function submitResult(
  taskId: string,
  agentId: string,
  result: string
): Promise<Task | { error: string }> {
  const task = tasks.get(taskId);
  if (!task) return { error: 'Task not found' };
  if (task.status !== 'assigned') return { error: `Task is ${task.status}, not assigned` };
  if (task.assignedAgent !== agentId) return { error: 'Not assigned to this agent' };

  task.result = result;
  task.status = 'submitted';
  task.updatedAt = new Date().toISOString();

  console.log(`[TaskEngine] Task ${taskId} result submitted by agent ${agentId}`);
  return task;
}

export async function approveTask(taskId: string): Promise<Task | { error: string }> {
  const task = tasks.get(taskId);
  if (!task) return { error: 'Task not found' };
  if (task.status !== 'submitted') return { error: `Task is ${task.status}, not submitted` };

  const agent = task.assignedAgent ? agents.get(task.assignedAgent) : undefined;

  // For the MVP demo, simulate payment settlement via facilitator
  // In production, this would create a real x402 payment flow
  let paymentTxId = `sim_${randomUUID().slice(0, 12)}`;

  try {
    // Try to settle via facilitator if available
    const settleResponse = await fetch(`${facilitatorUrl}/health`);
    if (settleResponse.ok) {
      console.log(`[TaskEngine] Facilitator available, payment would settle on-chain`);
      // In a real flow: create payment payload, verify, settle
      // For demo: we log that the facilitator is reachable
      paymentTxId = `stx_${randomUUID().slice(0, 12)}`;
    }
  } catch {
    console.log(`[TaskEngine] Facilitator not available, using simulated payment`);
  }

  task.status = 'completed';
  task.paymentTxId = paymentTxId;
  task.completedAt = new Date().toISOString();
  task.updatedAt = new Date().toISOString();

  // Update agent stats
  if (agent) {
    agent.tasksCompleted += 1;
    const currentEarned = parseFloat(agent.totalEarned);
    const bounty = parseFloat(task.bounty);
    agent.totalEarned = (currentEarned + bounty).toFixed(6);
    agent.lastActiveAt = new Date().toISOString();
  }

  console.log(`[TaskEngine] Task ${taskId} completed! Payment: ${paymentTxId} (${task.bounty} STX)`);
  return task;
}

// ─── Agent Operations ──────────────────────────────────────────

export function registerAgent(req: RegisterAgentRequest): Agent {
  const id = randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  const agent: Agent = {
    id,
    name: req.name,
    walletAddress: req.walletAddress,
    capabilities: req.capabilities,
    tasksCompleted: 0,
    totalEarned: '0.000000',
    registeredAt: now,
    lastActiveAt: now,
  };

  agents.set(id, agent);
  console.log(`[TaskEngine] Registered agent ${id}: ${req.name}`);
  return agent;
}

export function getAgent(id: string): Agent | undefined {
  return agents.get(id);
}

export function listAgents(): Agent[] {
  return Array.from(agents.values())
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted);
}

// ─── Stats ──────────────────────────────────────────

export function getStats() {
  const allTasks = Array.from(tasks.values());
  const allAgents = Array.from(agents.values());

  return {
    totalTasks: allTasks.length,
    openTasks: allTasks.filter(t => t.status === 'open').length,
    completedTasks: allTasks.filter(t => t.status === 'completed').length,
    totalAgents: allAgents.length,
    totalPaid: allAgents.reduce((sum, a) => sum + parseFloat(a.totalEarned), 0).toFixed(6),
  };
}
