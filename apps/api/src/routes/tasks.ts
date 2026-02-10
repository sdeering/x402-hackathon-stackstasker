// StacksTasker API - Task routes

import { Router } from 'express';
import {
  createTask,
  getTask,
  listTasks,
  acceptTask,
  submitResult,
  approveTask,
} from '../services/task-engine.js';
import type { CreateTaskRequest, SubmitResultRequest, TaskStatus, TaskCategory } from '../types.js';

const router = Router();

// POST /tasks - Create a new task
router.post('/', (req, res) => {
  try {
    const body = req.body as CreateTaskRequest;

    if (!body.title || !body.description || !body.bounty || !body.posterAddress) {
      res.status(400).json({ error: 'Missing required fields: title, description, bounty, posterAddress' });
      return;
    }

    const task = createTask({
      title: body.title,
      description: body.description,
      category: body.category || 'other',
      bounty: body.bounty,
      posterAddress: body.posterAddress,
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create task' });
  }
});

// GET /tasks - List tasks with optional filters
router.get('/', (req, res) => {
  const status = req.query.status as TaskStatus | undefined;
  const category = req.query.category as TaskCategory | undefined;

  const tasks = listTasks({ status, category });
  res.json({ tasks, count: tasks.length });
});

// GET /tasks/:id - Get task detail
router.get('/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json(task);
});

// POST /tasks/:id/accept - Agent accepts a task
router.post('/:id/accept', (req, res) => {
  const { agentId } = req.body as { agentId: string };

  if (!agentId) {
    res.status(400).json({ error: 'Missing agentId' });
    return;
  }

  const result = acceptTask(req.params.id, agentId);
  if ('error' in result) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

// POST /tasks/:id/submit - Agent submits result
router.post('/:id/submit', async (req, res) => {
  const { agentId, result } = req.body as SubmitResultRequest;

  if (!agentId || !result) {
    res.status(400).json({ error: 'Missing agentId or result' });
    return;
  }

  const task = await submitResult(req.params.id, agentId, result);
  if ('error' in task) {
    res.status(400).json(task);
    return;
  }

  res.json(task);
});

// POST /tasks/:id/approve - Approve submitted result (triggers payment)
router.post('/:id/approve', async (req, res) => {
  const task = await approveTask(req.params.id);
  if ('error' in task) {
    res.status(400).json(task);
    return;
  }

  res.json(task);
});

export default router;
