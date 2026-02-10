#!/usr/bin/env node
// StacksTasker Demo Orchestrator
// Starts all services and runs an end-to-end demo

import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const FACILITATOR_PORT = 4000;
const API_PORT = 3003;

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                    StacksTasker Demo                        ║');
console.log('║          AI Agent Task Marketplace + x402 Payments          ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

const processes = [];

function startService(name, cmd, args, env = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    processes.push(proc);

    let started = false;
    const onData = (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[${name}] ${line}`);
      if (!started && (line.includes('Running on') || line.includes('ready'))) {
        started = true;
        resolve(proc);
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[${name}:err] ${line}`);
    });

    proc.on('error', (err) => {
      console.error(`[${name}] Failed to start: ${err.message}`);
    });

    // Resolve after timeout even if no "Running on" message
    setTimeout(() => {
      if (!started) {
        started = true;
        resolve(proc);
      }
    }, 5000);
  });
}

async function waitForService(url, maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Not ready
    }
    await sleep(500);
  }
  return false;
}

async function postDemoTasks() {
  const tasks = [
    {
      title: 'Summarize the Bitcoin Whitepaper',
      description: 'Provide a concise 3-paragraph summary of the Bitcoin whitepaper by Satoshi Nakamoto. Focus on the key innovation (proof of work), the problem it solves (double spending), and its implications for digital currency.',
      category: 'summarization',
      bounty: '0.005',
      posterAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    },
    {
      title: 'Analyze STX Token Performance',
      description: 'Provide an analysis of STX token performance metrics including market trends, adoption indicators, and ecosystem growth. Include a score rating.',
      category: 'analysis',
      bounty: '0.008',
      posterAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    },
    {
      title: 'Research x402 Payment Protocol',
      description: 'Research the x402 HTTP payment protocol and its application to AI agent economies. Cover the protocol specification, how it integrates with Stacks/Bitcoin, and potential use cases.',
      category: 'research',
      bounty: '0.010',
      posterAddress: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
    },
    {
      title: 'Write a TypeScript Helper Function',
      description: 'Write a TypeScript utility function that converts between STX and microSTX amounts, with proper BigInt handling and input validation.',
      category: 'coding',
      bounty: '0.003',
      posterAddress: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
    },
  ];

  console.log('');
  console.log('── Posting demo tasks ──────────────────────────────');

  for (const task of tasks) {
    try {
      const res = await fetch(`http://localhost:${API_PORT}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
      const created = await res.json();
      console.log(`  Posted: "${task.title}" (${task.bounty} STX) → ID: ${created.id}`);
    } catch (err) {
      console.error(`  Failed to post "${task.title}":`, err.message);
    }
  }

  console.log('');
}

async function main() {
  // 1. Start Facilitator
  console.log('── Starting x402 Facilitator ───────────────────────');
  await startService(
    'Facilitator',
    'node',
    ['packages/stacks-facilitator/dist/index.js'],
    { FACILITATOR_PORT: String(FACILITATOR_PORT) }
  );

  const facilitatorReady = await waitForService(`http://localhost:${FACILITATOR_PORT}/health`);
  if (facilitatorReady) {
    console.log(`[Demo] Facilitator ready on port ${FACILITATOR_PORT}`);
  } else {
    console.log(`[Demo] Facilitator may not be ready (continuing anyway)`);
  }

  // 2. Start StacksTasker API
  console.log('');
  console.log('── Starting StacksTasker API ───────────────────────');
  await startService(
    'API',
    'node',
    ['apps/api/dist/index.js'],
    {
      API_PORT: String(API_PORT),
      FACILITATOR_URL: `http://localhost:${FACILITATOR_PORT}`,
    }
  );

  const apiReady = await waitForService(`http://localhost:${API_PORT}/health`);
  if (apiReady) {
    console.log(`[Demo] API ready on port ${API_PORT}`);
  } else {
    console.log('[Demo] API may not be ready (continuing anyway)');
  }

  // 3. Post demo tasks
  await postDemoTasks();

  // 4. Start Agent Worker
  console.log('── Starting AI Agent Worker ────────────────────────');
  await startService(
    'Agent',
    'node',
    ['apps/agent-worker/dist/index.js'],
    {
      API_URL: `http://localhost:${API_PORT}`,
      AGENT_NAME: 'ClaudeWorker-1',
      AGENT_WALLET: 'ST3DEMO_CLAUDE_AGENT_WALLET',
      POLL_INTERVAL: '2000',
    }
  );

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Demo is running!                                           ║');
  console.log('║                                                              ║');
  console.log(`║  Web UI:      http://localhost:${API_PORT}                          ║`);
  console.log(`║  API:         http://localhost:${API_PORT}/tasks                    ║`);
  console.log(`║  Facilitator: http://localhost:${FACILITATOR_PORT}/health                   ║`);
  console.log('║                                                              ║');
  console.log('║  The agent is now discovering and completing tasks...        ║');
  console.log('║  Press Ctrl+C to stop                                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\n[Demo] Shutting down...');
    for (const proc of processes) {
      proc.kill();
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    for (const proc of processes) {
      proc.kill();
    }
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[Demo] Fatal error:', err);
  for (const proc of processes) {
    proc.kill();
  }
  process.exit(1);
});
