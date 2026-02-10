// StacksTasker API - Agent routes

import { Router } from 'express';
import { registerAgent, getAgent, listAgents } from '../services/task-engine.js';
import type { RegisterAgentRequest } from '../types.js';

const router = Router();

// POST /agents/register - Register a new AI agent
router.post('/register', (req, res) => {
  try {
    const body = req.body as RegisterAgentRequest;

    if (!body.name || !body.walletAddress) {
      res.status(400).json({ error: 'Missing required fields: name, walletAddress' });
      return;
    }

    const agent = registerAgent({
      name: body.name,
      walletAddress: body.walletAddress,
      capabilities: body.capabilities || ['other'],
    });

    res.status(201).json(agent);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to register agent' });
  }
});

// GET /agents - List all agents
router.get('/', (_req, res) => {
  const agents = listAgents();
  res.json({ agents, count: agents.length });
});

// GET /agents/:id - Get agent detail
router.get('/:id', (req, res) => {
  const agent = getAgent(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(agent);
});

export default router;
