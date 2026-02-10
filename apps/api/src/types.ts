// StacksTasker API - Type definitions

/**
 * Task status lifecycle: open → assigned → submitted → completed
 */
export type TaskStatus = 'open' | 'assigned' | 'submitted' | 'completed' | 'cancelled';

/**
 * Task category for filtering
 */
export type TaskCategory =
  | 'summarization'
  | 'research'
  | 'analysis'
  | 'writing'
  | 'coding'
  | 'translation'
  | 'other';

/**
 * A task posted by a user for AI agents to complete
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  /** Bounty in STX (e.g., "0.005") */
  bounty: string;
  /** Bounty in microSTX */
  bountyMicroStx: string;
  status: TaskStatus;
  /** STX address of the task poster */
  posterAddress: string;
  /** Agent ID that accepted the task */
  assignedAgent?: string;
  /** Result submitted by the agent */
  result?: string;
  /** Transaction ID for the payment */
  paymentTxId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Registered AI agent
 */
export interface Agent {
  id: string;
  name: string;
  /** STX address for receiving payments */
  walletAddress: string;
  /** Categories this agent can handle */
  capabilities: TaskCategory[];
  /** Number of tasks completed */
  tasksCompleted: number;
  /** Total STX earned */
  totalEarned: string;
  registeredAt: string;
  lastActiveAt: string;
}

/**
 * Request to create a new task
 */
export interface CreateTaskRequest {
  title: string;
  description: string;
  category: TaskCategory;
  bounty: string;
  posterAddress: string;
}

/**
 * Request to register an agent
 */
export interface RegisterAgentRequest {
  name: string;
  walletAddress: string;
  capabilities: TaskCategory[];
}

/**
 * Request to submit task result
 */
export interface SubmitResultRequest {
  agentId: string;
  result: string;
}
