/* ============================================================
   RPA Flow Designer — game.js
   Mateusz Laszczyk Portfolio
   ============================================================ */

// Easter egg for curious recruiters
console.log(
  '%c🤖 Wiedziałem, że sprawdzisz konsolę.',
  'color:#00d4ff;font-size:16px;font-weight:bold;background:#0d1117;padding:10px 14px;border-left:3px solid #10b981;'
);
console.log(
  '%cSkoro debugujesz moje portfolio — to chyba wiesz, że warto pogadać.\n→ https://www.linkedin.com/in/mateuszlaszczyk/\n\nP.S. Próbowałeś obejść testy? Object.freeze + checksum + timing guard. Nice try.',
  'color:#64748b;font-size:12px;background:#0d1117;padding:6px 14px;'
);

(function () {
  'use strict';

  // ════════════════════════════════════════════════════════════
  // BPMN BLOCK DEFINITIONS
  // shape: 'circle'=start/end event, 'rect'=task, 'diamond'=gateway,
  //        'rounded'=subprocess, 'hexagon'=annotation
  // ════════════════════════════════════════════════════════════
  const BLOCK_TYPES = {
    START:     { label: 'START',            color: '#10b981', shape: 'circle',  desc: 'Start Event' },
    END:       { label: 'END',              color: '#f43f5e', shape: 'circle',  desc: 'End Event' },
    FETCH:     { label: 'FETCH DATA',       color: '#00d4ff', shape: 'rect',    desc: 'Service Task — retrieve data' },
    VALIDATE:  { label: 'VALIDATE',         color: '#f59e0b', shape: 'diamond', desc: 'Gateway — data validation check' },
    PROCESS:   { label: 'PROCESS',          color: '#7c3aed', shape: 'rect',    desc: 'Task — core business operation' },
    LOG:       { label: 'LOG',              color: '#64748b', shape: 'rect',    desc: 'Task — persist audit entry' },
    RETRY:     { label: 'RETRY',            color: '#f97316', shape: 'rounded', desc: 'Sub-process — retry wrapper' },
    NOTIFY:    { label: 'NOTIFY',           color: '#ec4899', shape: 'rect',    desc: 'Send Task — notification' },
    DECISION:  { label: 'IF / DECISION',    color: '#a3e635', shape: 'diamond', desc: 'Exclusive Gateway' },
    CLEANUP:   { label: 'CLEANUP',          color: '#94a3b8', shape: 'rect',    desc: 'Task — release resources' },
    LOOP:      { label: 'FOR EACH',         color: '#06b6d4', shape: 'rounded', desc: 'Sub-process — loop marker' },
    PARALLEL:  { label: 'PARALLEL',         color: '#8b5cf6', shape: 'diamond', desc: 'Parallel Gateway' },
    TIMEOUT:   { label: 'TIMEOUT',          color: '#dc2626', shape: 'rect',    desc: 'Boundary Event — time limit' },
    SAP_LOGIN: { label: 'SAP LOGIN',        color: '#0891b2', shape: 'rect',    desc: 'Service Task — open SAP session' },
    SAP_TXN:   { label: 'SAP TRANSACTION',  color: '#0891b2', shape: 'rect',    desc: 'Service Task — execute SAP txn' },
    QUEUE_GET: { label: 'GET QUEUE ITEM',   color: '#22d3ee', shape: 'rect',    desc: 'Service Task — pull from Orchestrator queue' },
    QUEUE_SET: { label: 'SET STATUS',       color: '#22d3ee', shape: 'rect',    desc: 'Service Task — mark queue item' },
    AGENT:     { label: 'AI AGENT',         color: '#a78bfa', shape: 'rect',    desc: 'Service Task — LLM agent' },
    EXTRACT:   { label: 'AI EXTRACT',       color: '#a78bfa', shape: 'rect',    desc: 'Service Task — AI document parse' },
    LOCK:      { label: 'ACQUIRE LOCK',     color: '#fb7185', shape: 'rect',    desc: 'Service Task — concurrency lock' },
    RELEASE:   { label: 'RELEASE LOCK',     color: '#fb7185', shape: 'rect',    desc: 'Service Task — free lock' },
  };

  // ════════════════════════════════════════════════════════════
  // CAMPAIGN LEVELS
  // ════════════════════════════════════════════════════════════
  const LEVELS = [
    {
      domain: 'Basic',
      framework: 'Linear sequence — ETL pipeline, no error paths needed',
      title: 'Daily SAP invoice export',
      business: 'Finance team needs yesterday\'s invoices pulled from SAP and transformed into reporting format. Straight pipeline — no edge cases.',
      desc: 'Build: START → fetch → process → END.',
      palette: ['PROCESS', 'END', 'START', 'FETCH'],
      // FETCH is required — cannot skip it
      tests: [
        { label: 'Starts with START',         fn: f => f[0] === 'START' },
        { label: 'FETCH DATA present',        fn: f => f.includes('FETCH') },
        { label: 'FETCH before PROCESS',      fn: f => f.indexOf('FETCH') < f.indexOf('PROCESS') && f.indexOf('FETCH') !== -1 },
        { label: 'PROCESS present',           fn: f => f.includes('PROCESS') },
        { label: 'Ends with END',             fn: f => f[f.length - 1] === 'END' },
        { label: 'Exactly one START',         fn: f => f.filter(x => x === 'START').length === 1 },
      ],
    },
    {
      domain: 'Basic',
      framework: 'Linear with validation gate — guard data quality before commit',
      title: 'Customer master data sync',
      business: 'Hourly CRM→ERP sync. Garbage data corrupts downstream reports — every record must be validated before landing in the ERP. Audit team needs a log entry per run.',
      desc: 'FETCH → validate → process → LOG → END.',
      palette: ['LOG', 'VALIDATE', 'END', 'PROCESS', 'FETCH', 'START'],
      tests: [
        { label: 'Starts with START',         fn: f => f[0] === 'START' },
        { label: 'FETCH DATA present',        fn: f => f.includes('FETCH') },
        { label: 'FETCH before VALIDATE',     fn: f => f.indexOf('FETCH') < f.indexOf('VALIDATE') && f.indexOf('FETCH') !== -1 },
        { label: 'VALIDATE before PROCESS',   fn: f => f.indexOf('VALIDATE') < f.indexOf('PROCESS') && f.indexOf('VALIDATE') !== -1 },
        { label: 'LOG after PROCESS',         fn: f => f.indexOf('LOG') > f.indexOf('PROCESS') && f.indexOf('PROCESS') !== -1 },
        { label: 'Ends with END',             fn: f => f[f.length - 1] === 'END' },
      ],
    },
    {
      domain: 'Error handling',
      framework: 'REFramework-style — retry layer wraps transaction, notify on repeated failure',
      title: 'Payment confirmation with flaky API',
      business: 'Bot integrates with a payment API dropping ~15% of requests. Without retry, ops is paged nightly. Must retry failed calls and notify before exit if still failing.',
      desc: 'FETCH → validate → RETRY on fail → process → NOTIFY on error → END. Minimum 5 blocks.',
      palette: ['NOTIFY', 'RETRY', 'START', 'PROCESS', 'VALIDATE', 'END', 'FETCH'],
      tests: [
        { label: 'Starts with START',         fn: f => f[0] === 'START' },
        { label: 'FETCH DATA present',        fn: f => f.includes('FETCH') },
        { label: 'RETRY after VALIDATE',      fn: f => f.indexOf('RETRY') > f.indexOf('VALIDATE') && f.indexOf('RETRY') !== -1 },
        { label: 'NOTIFY before END',         fn: f => f.indexOf('NOTIFY') !== -1 && f.indexOf('NOTIFY') < f.indexOf('END') },
        { label: 'PROCESS present',           fn: f => f.includes('PROCESS') },
        { label: 'Ends with END',             fn: f => f[f.length - 1] === 'END' },
        { label: 'At least 5 blocks',         fn: f => f.length >= 5 },
      ],
    },
    {
      domain: 'Error handling',
      framework: 'State machine — explicit decision branches with failure paths',
      title: 'Loan application processor',
      business: 'Each application goes through validation. Clean data → process (approve). Bad data → retry, notify credit officer for manual review. Decision logic is the core. Audit log mandatory.',
      desc: 'FETCH → validate → DECISION → process or retry+notify → LOG → END.',
      palette: ['DECISION', 'LOG', 'RETRY', 'VALIDATE', 'START', 'FETCH', 'PROCESS', 'END', 'NOTIFY'],
      tests: [
        { label: 'Starts with START',         fn: f => f[0] === 'START' },
        { label: 'FETCH DATA present',        fn: f => f.includes('FETCH') },
        { label: 'VALIDATE before DECISION',  fn: f => f.indexOf('VALIDATE') < f.indexOf('DECISION') && f.indexOf('VALIDATE') !== -1 },
        { label: 'DECISION before PROCESS',   fn: f => f.indexOf('DECISION') < f.indexOf('PROCESS') && f.indexOf('DECISION') !== -1 },
        { label: 'RETRY in flow',             fn: f => f.includes('RETRY') },
        { label: 'NOTIFY in flow',            fn: f => f.includes('NOTIFY') },
        { label: 'LOG before END',            fn: f => f.indexOf('LOG') !== -1 && f.indexOf('LOG') < f.indexOf('END') },
        { label: 'Ends with END',             fn: f => f[f.length - 1] === 'END' },
      ],
    },
    {
      domain: 'Iteration',
      framework: 'FOR EACH loop — transactional queue processing, one item at a time',
      title: 'Batch invoice posting',
      business: 'Process 200 invoices from Orchestrator queue. Each item is independent — one failure must not crash the batch. Set queue item status after each attempt.',
      desc: 'FETCH → LOOP: get queue → validate → process → set status → LOG → END.',
      palette: ['QUEUE_SET', 'LOG', 'PROCESS', 'START', 'VALIDATE', 'QUEUE_GET', 'LOOP', 'END', 'FETCH'],
      tests: [
        { label: 'Starts with START',         fn: f => f[0] === 'START' },
        { label: 'FETCH before LOOP',         fn: f => f.indexOf('FETCH') !== -1 && f.indexOf('FETCH') < f.indexOf('LOOP') },
        { label: 'FOR EACH present',          fn: f => f.includes('LOOP') },
        { label: 'GET QUEUE ITEM after LOOP', fn: f => f.indexOf('QUEUE_GET') > f.indexOf('LOOP') && f.indexOf('QUEUE_GET') !== -1 },
        { label: 'VALIDATE before PROCESS',   fn: f => f.indexOf('VALIDATE') < f.indexOf('PROCESS') && f.indexOf('VALIDATE') !== -1 },
        { label: 'SET STATUS after PROCESS',  fn: f => f.indexOf('QUEUE_SET') > f.indexOf('PROCESS') && f.indexOf('QUEUE_SET') !== -1 },
        { label: 'LOG before END',            fn: f => f.indexOf('LOG') !== -1 && f.indexOf('LOG') < f.indexOf('END') },
        { label: 'Ends with END',             fn: f => f[f.length - 1] === 'END' },
      ],
    },
    {
      domain: 'Parallel',
      framework: 'Parallel gateway with timeout — concurrent enrichment from multiple sources',
      title: 'Multi-source data enrichment',
      business: 'Customer record needs enrichment from CRM, billing API, and credit bureau simultaneously. Sequential = 45s/record. Run in parallel with a 10s timeout per branch.',
      desc: 'FETCH → PARALLEL enrichment → TIMEOUT guard → process → LOG → END.',
      palette: ['END', 'TIMEOUT', 'PARALLEL', 'PROCESS', 'FETCH', 'START', 'LOG'],
      tests: [
        { label: 'Starts with START',         fn: f => f[0] === 'START' },
        { label: 'FETCH before PARALLEL',     fn: f => f.indexOf('FETCH') !== -1 && f.indexOf('FETCH') < f.indexOf('PARALLEL') },
        { label: 'PARALLEL present',          fn: f => f.includes('PARALLEL') },
        { label: 'TIMEOUT after PARALLEL',    fn: f => f.indexOf('TIMEOUT') > f.indexOf('PARALLEL') && f.indexOf('TIMEOUT') !== -1 },
        { label: 'PROCESS after TIMEOUT',     fn: f => f.indexOf('PROCESS') > f.indexOf('TIMEOUT') && f.indexOf('PROCESS') !== -1 },
        { label: 'LOG before END',            fn: f => f.indexOf('LOG') !== -1 && f.indexOf('LOG') < f.indexOf('END') },
        { label: 'Ends with END',             fn: f => f[f.length - 1] === 'END' },
      ],
    },
    {
      domain: 'Concurrency',
      framework: 'Lock-protected critical section — prevent race conditions across bot instances',
      title: 'Shared queue: prevent duplicate posting',
      business: 'Multiple bot instances run in parallel and could pick the same record. Without a lock, two bots post the same invoice twice. Acquire lock before fetching, release after status update.',
      desc: 'LOCK → FETCH → validate → process → RELEASE → LOG → END.',
      palette: ['RELEASE', 'LOCK', 'VALIDATE', 'START', 'END', 'PROCESS', 'FETCH', 'LOG'],
      tests: [
        { label: 'Starts with START',         fn: f => f[0] === 'START' },
        { label: 'LOCK before FETCH',         fn: f => f.indexOf('LOCK') !== -1 && f.indexOf('LOCK') < f.indexOf('FETCH') },
        { label: 'FETCH DATA present',        fn: f => f.includes('FETCH') },
        { label: 'VALIDATE before PROCESS',   fn: f => f.indexOf('VALIDATE') < f.indexOf('PROCESS') && f.indexOf('VALIDATE') !== -1 },
        { label: 'RELEASE after PROCESS',     fn: f => f.indexOf('RELEASE') > f.indexOf('PROCESS') && f.indexOf('RELEASE') !== -1 },
        { label: 'LOG before END',            fn: f => f.indexOf('LOG') !== -1 && f.indexOf('LOG') < f.indexOf('END') },
        { label: 'Ends with END',             fn: f => f[f.length - 1] === 'END' },
      ],
    },
    {
      domain: 'SAP',
      framework: 'SAP FI task sequence — login + transaction + mandatory session cleanup',
      title: 'SAP FI: vendor invoice posting',
      business: 'Bot logs into SAP, opens FBV0, enters vendor data, posts document, captures document number, logs out. Sessions left open lock production users.',
      desc: 'SAP_LOGIN → FETCH → SAP transaction → CLEANUP (logout) → LOG → END.',
      palette: ['CLEANUP', 'SAP_TXN', 'SAP_LOGIN', 'FETCH', 'START', 'END', 'LOG'],
      tests: [
        { label: 'Starts with START',         fn: f => f[0] === 'START' },
        { label: 'SAP LOGIN early (≤ pos 2)',  fn: f => f.indexOf('SAP_LOGIN') !== -1 && f.indexOf('SAP_LOGIN') <= 2 },
        { label: 'FETCH before SAP_TXN',      fn: f => f.indexOf('FETCH') !== -1 && f.indexOf('FETCH') < f.indexOf('SAP_TXN') },
        { label: 'CLEANUP after SAP_TXN',     fn: f => f.indexOf('CLEANUP') > f.indexOf('SAP_TXN') && f.indexOf('CLEANUP') !== -1 },
        { label: 'LOG before END',            fn: f => f.indexOf('LOG') !== -1 && f.indexOf('LOG') < f.indexOf('END') },
        { label: 'Ends with END',             fn: f => f[f.length - 1] === 'END' },
      ],
    },
    {
      domain: 'SAP',
      framework: 'SAP MM batch — login once, loop through POs, per-item error isolation',
      title: 'SAP MM: bulk PO confirmation',
      business: 'Confirm 50–80 purchase orders daily via ME21N. Bot logs in once, loops queue, one PO failure must not block the rest. Logout cleanly after loop.',
      desc: 'SAP_LOGIN → LOOP: get queue → validate → SAP txn → set status → CLEANUP → LOG → END.',
      palette: ['QUEUE_SET', 'SAP_TXN', 'VALIDATE', 'START', 'SAP_LOGIN', 'LOOP', 'QUEUE_GET', 'CLEANUP', 'END', 'LOG', 'FETCH'],
      tests: [
        { label: 'Starts with START',         fn: f => f[0] === 'START' },
        { label: 'FETCH DATA present',        fn: f => f.includes('FETCH') },
        { label: 'SAP_LOGIN before LOOP',     fn: f => f.indexOf('SAP_LOGIN') !== -1 && f.indexOf('SAP_LOGIN') < f.indexOf('LOOP') },
        { label: 'FOR EACH present',          fn: f => f.includes('LOOP') },
        { label: 'QUEUE_GET after LOOP',      fn: f => f.indexOf('QUEUE_GET') > f.indexOf('LOOP') && f.indexOf('QUEUE_GET') !== -1 },
        { label: 'VALIDATE before SAP_TXN',   fn: f => f.indexOf('VALIDATE') < f.indexOf('SAP_TXN') && f.indexOf('VALIDATE') !== -1 },
        { label: 'QUEUE_SET after SAP_TXN',   fn: f => f.indexOf('QUEUE_SET') > f.indexOf('SAP_TXN') && f.indexOf('QUEUE_SET') !== -1 },
        { label: 'CLEANUP before END',        fn: f => f.indexOf('CLEANUP') !== -1 && f.indexOf('CLEANUP') < f.indexOf('END') },
        { label: 'Ends with END',             fn: f => f[f.length - 1] === 'END' },
      ],
    },
    {
      domain: 'AI Automation',
      framework: 'AI-augmented extraction — LLM replaces fragile OCR for document parsing',
      title: 'Intelligent invoice extraction',
      business: 'Invoices arrive as PDFs from 200+ vendors with different layouts. Rule-based OCR fails on 30%. Use AI extraction, validate output against schema, then process. Log every extraction for model retraining.',
      desc: 'FETCH → AI EXTRACT → validate → process → LOG → END.',
      palette: ['LOG', 'PROCESS', 'VALIDATE', 'EXTRACT', 'FETCH', 'START', 'END'],
      tests: [
        { label: 'Starts with START',         fn: f => f[0] === 'START' },
        { label: 'FETCH before EXTRACT',      fn: f => f.indexOf('FETCH') !== -1 && f.indexOf('FETCH') < f.indexOf('EXTRACT') },
        { label: 'AI EXTRACT present',        fn: f => f.includes('EXTRACT') },
        { label: 'VALIDATE after EXTRACT',    fn: f => f.indexOf('VALIDATE') > f.indexOf('EXTRACT') && f.indexOf('VALIDATE') !== -1 },
        { label: 'PROCESS after VALIDATE',    fn: f => f.indexOf('PROCESS') > f.indexOf('VALIDATE') && f.indexOf('PROCESS') !== -1 },
        { label: 'LOG before END',            fn: f => f.indexOf('LOG') !== -1 && f.indexOf('LOG') < f.indexOf('END') },
        { label: 'Ends with END',             fn: f => f[f.length - 1] === 'END' },
      ],
    },
    {
      domain: 'AI Automation',
      framework: 'Agent-driven routing — LLM decides next action based on extracted content',
      title: 'AI agent: support ticket triage',
      business: 'Customer emails arrive in a shared mailbox. AI agent reads, classifies (billing/technical/refund), routes to the right queue. High-urgency cases trigger an immediate notification. Every decision logged.',
      desc: 'FETCH → AI EXTRACT → AI AGENT → DECISION → process route → NOTIFY if urgent → LOG → END.',
      palette: ['NOTIFY', 'LOG', 'AGENT', 'PROCESS', 'EXTRACT', 'DECISION', 'FETCH', 'START', 'END'],
      tests: [
        { label: 'Starts with START',         fn: f => f[0] === 'START' },
        { label: 'FETCH before EXTRACT',      fn: f => f.indexOf('FETCH') !== -1 && f.indexOf('FETCH') < f.indexOf('EXTRACT') },
        { label: 'EXTRACT before AGENT',      fn: f => f.indexOf('EXTRACT') < f.indexOf('AGENT') && f.indexOf('EXTRACT') !== -1 },
        { label: 'AGENT before DECISION',     fn: f => f.indexOf('AGENT') < f.indexOf('DECISION') && f.indexOf('AGENT') !== -1 },
        { label: 'DECISION before PROCESS',   fn: f => f.indexOf('DECISION') < f.indexOf('PROCESS') && f.indexOf('DECISION') !== -1 },
        { label: 'NOTIFY present',            fn: f => f.includes('NOTIFY') },
        { label: 'LOG before END',            fn: f => f.indexOf('LOG') !== -1 && f.indexOf('LOG') < f.indexOf('END') },
        { label: 'Ends with END',             fn: f => f[f.length - 1] === 'END' },
      ],
    },
    {
      domain: 'Production',
      framework: 'Full REFramework — Init, GetTransactionData, Process, EndProcess with all error layers',
      title: 'End-of-month reconciliation (full prod)',
      business: 'Runs at 2 AM last day of month. Acquires lock, logs into SAP, loops through thousands of records, validates, branches on outcome, processes successes, retries failures, releases lock, cleans up, notifies, full audit log. The bot leadership depends on.',
      desc: 'LOCK → SAP_LOGIN → LOOP (validate, decide, process, retry) → RELEASE → CLEANUP → NOTIFY → LOG → END. Min 10 blocks.',
      palette: ['CLEANUP', 'LOG', 'NOTIFY', 'START', 'DECISION', 'END', 'VALIDATE', 'LOOP', 'RETRY', 'PROCESS', 'SAP_LOGIN', 'LOCK', 'RELEASE', 'FETCH'],
      tests: [
        { label: 'Starts with START',         fn: f => f[0] === 'START' },
        { label: 'FETCH DATA present',        fn: f => f.includes('FETCH') },
        { label: 'LOCK early (≤ pos 3)',       fn: f => f.indexOf('LOCK') !== -1 && f.indexOf('LOCK') <= 3 },
        { label: 'SAP_LOGIN after LOCK',       fn: f => f.indexOf('SAP_LOGIN') > f.indexOf('LOCK') && f.indexOf('SAP_LOGIN') !== -1 },
        { label: 'FOR EACH present',           fn: f => f.includes('LOOP') },
        { label: 'VALIDATE before DECISION',   fn: f => f.indexOf('VALIDATE') < f.indexOf('DECISION') && f.indexOf('VALIDATE') !== -1 },
        { label: 'RETRY in flow',              fn: f => f.includes('RETRY') },
        { label: 'RELEASE before CLEANUP',     fn: f => f.indexOf('RELEASE') < f.indexOf('CLEANUP') && f.indexOf('RELEASE') !== -1 },
        { label: 'NOTIFY in flow',             fn: f => f.includes('NOTIFY') },
        { label: 'LOG before END',             fn: f => f.indexOf('LOG') !== -1 && f.indexOf('LOG') < f.indexOf('END') },
        { label: 'Ends with END',              fn: f => f[f.length - 1] === 'END' },
        { label: 'At least 10 blocks',         fn: f => f.length >= 10 },
      ],
    },
  ];

  // ════════════════════════════════════════════════════════════
  // DEBUG PUZZLES
  // ════════════════════════════════════════════════════════════
  const DEBUG_PUZZLES = [
    {
      title: 'Bot runs forever at 100% CPU',
      scenario: 'Production bot processes 500 records nightly. Last night it never finished — ran until the 6 AM kill timer. CPU pinned at 100%.',
      flow: ['START', 'FETCH', 'LOOP', 'VALIDATE', 'PROCESS', 'LOG', 'END'],
      bugIndex: 2,
      explanation: 'LOOP has no exit condition — GET QUEUE ITEM is missing inside the loop body. The bot iterates forever on the same data reference. Fix: add QUEUE_GET inside the loop so each iteration pulls the next item and the loop exits when the queue is empty.',
      hint: 'Think about what drives a loop forward.',
      options: [0, 2, 4, 5],
      optionLabels: ['START block', 'LOOP block', 'PROCESS block', 'LOG block'],
    },
    {
      title: 'Duplicate invoices posted to SAP',
      scenario: 'Finance reports 14 duplicate invoice postings this week. Bot runs every 15 minutes from 3 machines simultaneously.',
      flow: ['START', 'FETCH', 'VALIDATE', 'PROCESS', 'SAP_TXN', 'LOG', 'END'],
      bugIndex: 1,
      explanation: 'No LOCK before FETCH — all 3 bot instances pull the same queue items simultaneously, each running the SAP transaction independently. Fix: add ACQUIRE LOCK before FETCH, RELEASE LOCK after the transaction. This makes item selection atomic.',
      hint: 'What happens when 3 bots all read the same queue at the same millisecond?',
      options: [0, 1, 3, 4],
      optionLabels: ['START block', 'FETCH block', 'PROCESS block', 'SAP_TXN block'],
    },
    {
      title: 'One bad record kills the whole batch',
      scenario: 'Bot processes 200 invoices nightly. Record #47 had a malformed VAT number. Bot crashed — records 48–200 never ran. Ops paged at 4 AM.',
      flow: ['START', 'FETCH', 'LOOP', 'VALIDATE', 'PROCESS', 'QUEUE_SET', 'LOG', 'END'],
      bugIndex: 3,
      explanation: 'VALIDATE throws an unhandled exception that propagates up and kills the LOOP. In REFramework, per-item logic must be wrapped in a Try/Catch (RETRY block) so a single bad record is caught, status set to Failed, and the loop continues. Fix: wrap VALIDATE + PROCESS in RETRY.',
      hint: 'What should happen when one item is bad?',
      options: [2, 3, 4, 5],
      optionLabels: ['LOOP block', 'VALIDATE block', 'PROCESS block', 'QUEUE_SET block'],
    },
    {
      title: 'AI extraction returns garbage 40% of the time',
      scenario: 'New AI invoice extraction bot deployed last week. ~40% of extractions land in finance with wrong vendor names, wrong amounts, wrong dates.',
      flow: ['START', 'FETCH', 'EXTRACT', 'PROCESS', 'LOG', 'END'],
      bugIndex: 3,
      explanation: 'PROCESS happens directly after EXTRACT with no VALIDATE step. LLM outputs are probabilistic — they need schema validation against expected types, value ranges, and reference data before being trusted. Fix: insert VALIDATE between EXTRACT and PROCESS. Reject or escalate failed extractions.',
      hint: 'Can you trust an AI\'s output without checking it?',
      options: [1, 2, 3, 4],
      optionLabels: ['FETCH block', 'AI EXTRACT block', 'PROCESS block', 'LOG block'],
    },
    {
      title: 'Bot leaves SAP sessions hanging',
      scenario: 'IT reports 18 stale SAP GUI sessions on the bot machine by Friday afternoon. Each holds a license seat. Production users locked out every weekend.',
      flow: ['START', 'SAP_LOGIN', 'FETCH', 'SAP_TXN', 'LOG', 'END'],
      bugIndex: 5,
      explanation: 'END comes after LOG with no CLEANUP step. On bot exit — normal or crashed — the SAP session stays open until SAP\'s own timeout (often hours). Fix: add CLEANUP before END to explicitly call session.Close() / logout transaction. This must run even on exception paths.',
    {
      title: 'Bot runs forever at 100% CPU',
      scenario: 'Production bot processes 500 records nightly. Last night it never finished — ran until the 6 AM kill timer. CPU pinned at 100%.',
      flow: ['START', 'FETCH', 'LOOP', 'VALIDATE', 'PROCESS', 'LOG', 'END'],
      bugIndex: 2,
      explanation: 'LOOP has no exit condition — GET QUEUE ITEM is missing inside the loop body. The bot iterates forever on the same data reference. Fix: add QUEUE_GET inside the loop so each iteration pulls the next item and the loop exits when the queue is empty.',
      hint: 'Think about what drives a loop forward.',
      options: [0, 2, 4, 5],
      optionLabels: ['START block', 'LOOP block', 'PROCESS block', 'LOG block'],
    },
    {
      title: 'Duplicate invoices posted to SAP',
      scenario: 'Finance reports 14 duplicate invoice postings this week. Bot runs every 15 minutes from 3 machines simultaneously.',
      flow: ['START', 'FETCH', 'VALIDATE', 'PROCESS', 'SAP_TXN', 'LOG', 'END'],
      bugIndex: 1,
      explanation: 'No LOCK before FETCH — all 3 bot instances pull the same queue items simultaneously, each running the SAP transaction independently. Fix: add ACQUIRE LOCK before FETCH, RELEASE LOCK after the transaction. This makes item selection atomic.',
      hint: 'What happens when 3 bots all read the same queue at the same millisecond?',
      options: [0, 1, 3, 4],
      optionLabels: ['START block', 'FETCH block', 'PROCESS block', 'SAP_TXN block'],
    },
    {
      title: 'One bad record kills the whole batch',
      scenario: 'Bot processes 200 invoices nightly. Record #47 had a malformed VAT number. Bot crashed — records 48–200 never ran. Ops paged at 4 AM.',
      flow: ['START', 'FETCH', 'LOOP', 'VALIDATE', 'PROCESS', 'QUEUE_SET', 'LOG', 'END'],
      bugIndex: 3,
      explanation: 'VALIDATE throws an unhandled exception that propagates up and kills the LOOP. In REFramework, per-item logic must be wrapped in a Try/Catch (RETRY block) so a single bad record is caught, status set to Failed, and the loop continues. Fix: wrap VALIDATE + PROCESS in RETRY.',
      hint: 'What should happen when one item is bad?',
      options: [2, 3, 4, 5],
      optionLabels: ['LOOP block', 'VALIDATE block', 'PROCESS block', 'QUEUE_SET block'],
    },
    {
      title: 'AI extraction returns garbage 40% of the time',
      scenario: 'New AI invoice extraction bot deployed last week. ~40% of extractions land in finance with wrong vendor names, wrong amounts, wrong dates.',
      flow: ['START', 'FETCH', 'EXTRACT', 'PROCESS', 'LOG', 'END'],
      bugIndex: 3,
      explanation: 'PROCESS happens directly after EXTRACT with no VALIDATE step. LLM outputs are probabilistic — they need schema validation against expected types, value ranges, and reference data before being trusted. Fix: insert VALIDATE between EXTRACT and PROCESS. Reject or escalate failed extractions.',
      hint: 'Can you trust an AI\'s output without checking it?',
      options: [1, 2, 3, 4],
      optionLabels: ['FETCH block', 'AI EXTRACT block', 'PROCESS block', 'LOG block'],
    },
    {
      title: 'Bot leaves SAP sessions hanging',
      scenario: 'IT reports 18 stale SAP GUI sessions on the bot machine by Friday afternoon. Each holds a license seat. Production users locked out every weekend.',
      flow: ['START', 'SAP_LOGIN', 'FETCH', 'SAP_TXN', 'LOG', 'END'],
      bugIndex: 5,
      explanation: 'END comes after LOG with no CLEANUP step. On bot exit — normal or crashed — the SAP session stays open until SAP\'s own timeout (often hours). Fix: add CLEANUP before END to explicitly call session.Close() / logout transaction. This must run even on exception paths.',
      hint: 'What happens to the SAP session when the bot just exits?',
      options: [1, 3, 4, 5],
      optionLabels: ['SAP_LOGIN block', 'SAP_TXN block', 'LOG block', 'END block'],
    },
    {
      title: 'Bot sends 200 emails per invoice',
      scenario: 'Ops receives ~4,000 notification emails overnight. The bot should send one summary email at the end, but instead fires a NOTIFY per loop iteration.',
      flow: ['START', 'FETCH', 'LOOP', 'QUEUE_GET', 'VALIDATE', 'PROCESS', 'NOTIFY', 'QUEUE_SET', 'LOG', 'END'],
      bugIndex: 6,
      explanation: 'NOTIFY is inside the LOOP body — it fires on every single queue item. In a batch of 200 invoices, that\'s 200 emails. Fix: move NOTIFY after the loop ends (outside the loop body) so it sends one summary notification.',
      hint: 'Look at which blocks are inside the loop vs. outside.',
      options: [2, 4, 6, 8],
      optionLabels: ['LOOP block', 'VALIDATE block', 'NOTIFY block', 'LOG block'],
    },
    {
      title: 'Bot retries forever on business exception',
      scenario: 'Bot is stuck retrying the same invoice for 6 hours. The invoice has an invalid vendor code — a permanent data problem, not a transient error. Yet the bot keeps retrying.',
      flow: ['START', 'FETCH', 'LOOP', 'QUEUE_GET', 'VALIDATE', 'RETRY', 'PROCESS', 'QUEUE_SET', 'LOG', 'END'],
      bugIndex: 5,
      explanation: 'RETRY wraps PROCESS indiscriminately — it retries both system exceptions (network timeout, SAP crash) AND business exceptions (invalid vendor code). Business exceptions are permanent and should not be retried. Fix: add a DECISION after VALIDATE to separate business exceptions (→ set Failed, skip) from system exceptions (→ RETRY).',
      hint: 'Should you retry when the data itself is wrong?',
      options: [3, 4, 5, 7],
      optionLabels: ['QUEUE_GET block', 'VALIDATE block', 'RETRY block', 'QUEUE_SET block'],
    },
    {
      title: 'Parallel branches return stale data',
      scenario: 'Customer enrichment bot runs 3 API calls in parallel. Results merge correctly, but ~20% of records show yesterday\'s credit score instead of today\'s.',
      flow: ['START', 'FETCH', 'PARALLEL', 'PROCESS', 'LOG', 'END'],
      bugIndex: 3,
      explanation: 'PROCESS merges parallel results immediately after PARALLEL with no TIMEOUT guard. One branch (credit bureau) sometimes takes 15 seconds and returns cached data. Fix: add TIMEOUT after PARALLEL to enforce a deadline, then VALIDATE before PROCESS to check data freshness.',
      hint: 'What happens when one parallel branch is slower than the rest?',
      options: [1, 2, 3, 4],
      optionLabels: ['FETCH block', 'PARALLEL block', 'PROCESS block', 'LOG block'],
    },
    {
      title: 'Lock never released on error',
      scenario: 'Monday morning: all 4 bot instances are stuck waiting. The lock was acquired Friday night but never released after a crash mid-processing.',
      flow: ['START', 'LOCK', 'FETCH', 'VALIDATE', 'PROCESS', 'RELEASE', 'LOG', 'END'],
      bugIndex: 5,
      explanation: 'RELEASE only executes in the happy path — after PROCESS succeeds. If VALIDATE or PROCESS throws an exception, the flow jumps to END without releasing the lock. Fix: RELEASE must run in a Finally/CLEANUP block that executes regardless of success or failure.',
      hint: 'What path does the flow take when PROCESS crashes?',
      options: [1, 3, 4, 5],
      optionLabels: ['LOCK block', 'VALIDATE block', 'PROCESS block', 'RELEASE block'],
    },
    {
      title: 'Queue items processed out of order',
      scenario: 'Finance reports that month-end journals are posted in random order instead of chronological. The queue has Priority and Deadline fields, but the bot ignores them.',
      flow: ['START', 'LOOP', 'QUEUE_GET', 'VALIDATE', 'PROCESS', 'QUEUE_SET', 'LOG', 'END'],
      bugIndex: 0,
      explanation: 'START goes directly into LOOP without a FETCH step to configure queue sort order. The bot pulls items in default FIFO order, ignoring Priority and Deadline fields. Fix: add FETCH before LOOP to configure the queue filter/sort, or set Orchestrator queue\'s ItemInformationFilter.',
      hint: 'How does the bot know which item to process first?',
      options: [0, 1, 2, 4],
      optionLabels: ['START block', 'LOOP block', 'QUEUE_GET block', 'PROCESS block'],
    },
    {
      title: 'Bot works in Dev, fails silently in Prod',
      scenario: 'Bot runs perfectly in development. Deployed to production — processes 0 items, no errors in log, completes in 3 seconds. Queue has 150 pending items.',
      flow: ['START', 'FETCH', 'LOOP', 'PROCESS', 'QUEUE_SET', 'LOG', 'END'],
      bugIndex: 3,
      explanation: 'PROCESS runs directly without QUEUE_GET inside the loop. In Dev, FETCH loaded test data into a local variable. In Prod, the queue items aren\'t fetched per-iteration — the loop has no data source and exits cleanly with zero items processed. Fix: add QUEUE_GET inside the loop.',
      hint: 'The loop runs, but does it actually get any items to process?',
      options: [1, 2, 3, 5],
      optionLabels: ['FETCH block', 'LOOP block', 'PROCESS block', 'LOG block'],
    },
    {
      title: 'AI agent routes everything to billing',
      scenario: 'Support ticket triage bot deployed 2 weeks ago. 85% of tickets go to billing — including password resets, delivery tracking, product questions. Billing team overwhelmed.',
      flow: ['START', 'FETCH', 'AGENT', 'PROCESS', 'NOTIFY', 'LOG', 'END'],
      bugIndex: 2,
      explanation: 'AI AGENT classifies the ticket correctly, but there\'s no DECISION gateway after it to branch the flow. PROCESS always runs the same default billing path — the agent\'s classification output is computed but never used. Fix: add DECISION after AGENT to route based on classification.',
      hint: 'The AI classifies correctly — but does anything act on that classification?',
      options: [1, 2, 3, 5],
      optionLabels: ['FETCH block', 'AI AGENT block', 'PROCESS block', 'LOG block'],
    },
  ];

  // ════════════════════════════════════════════════════════════
  // STATE
  // ════════════════════════════════════════════════════════════
  let currentLevelIdx   = 0;   // index into filteredLevels
  let filteredLevels    = LEVELS.map((_, i) => i);
  let flow              = [];
  let totalScore        = 0;
  let levelStartTime    = 0;
  let timerInterval     = null;
  let activeDomain      = 'All';
  let sandboxFlow       = [];
  let testsVisible      = false;  // hidden by default, show on toggle
  let debugSolvedSet    = new Set(); // indices of solved debug puzzles

  function currentLevel() { return LEVELS[filteredLevels[currentLevelIdx]]; }

  // ════════════════════════════════════════════════════════════
  // LOCAL STORAGE STATS
  // ════════════════════════════════════════════════════════════
  const STATS_KEY = 'mlaszczyk-portfolio-stats-v2';

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      return raw ? JSON.parse(raw) : { completed: {}, totalScore: 0, attempts: 0, debugsSolved: 0 };
    } catch { return { completed: {}, totalScore: 0, attempts: 0, debugsSolved: 0 }; }
  }

  function saveStats(s) {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
  }

  // ════════════════════════════════════════════════════════════
  // DOM HELPERS
  // ════════════════════════════════════════════════════════════
  function el(id)    { return document.getElementById(id); }
  function qs(sel)   { return document.querySelector(sel); }
  function qsa(sel)  { return document.querySelectorAll(sel); }

  // ════════════════════════════════════════════════════════════
  // TIMER
  // ════════════════════════════════════════════════════════════
  function startTimer() {
    levelStartTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const s = Math.floor((Date.now() - levelStartTime) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      const t = el('fg-timer');
      if (t) t.textContent = `${mm}:${ss}`;
    }, 250);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    return Math.floor((Date.now() - levelStartTime) / 1000);
  }

  // ════════════════════════════════════════════════════════════
  // BPMN SVG NODE RENDERER
  // Returns an SVG element for a given block key
  // ════════════════════════════════════════════════════════════
  function makeBPMNNode(key, index, opts = {}) {
    const bt = BLOCK_TYPES[key];
    const { onClick, isError = false, isReadOnly = false } = opts;
    const color = isError ? '#ef4444' : bt.color;

    const W = 200, H = 52;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.style.overflow = 'visible';
    svg.style.display  = 'block';
    if (!isReadOnly) svg.style.cursor = 'pointer';

    const ns = 'http://www.w3.org/2000/svg';

    function mkEl(tag, attrs) {
      const e = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      return e;
    }

    // Background fill + stroke per BPMN shape
    const cx = W / 2, cy = H / 2;
    let shapeEl;

    switch (bt.shape) {
      case 'circle': {
        // BPMN Start/End event = circle
        const r = 22;
        shapeEl = mkEl('circle', { cx, cy, r, fill: color + '22', stroke: color, 'stroke-width': isError ? 3 : 2 });
        if (key === 'END') {
          // End event has thick inner ring
          svg.appendChild(mkEl('circle', { cx, cy, r: 16, fill: 'none', stroke: color, 'stroke-width': 4 }));
        }
        break;
      }
      case 'diamond': {
        // BPMN Gateway = diamond
        const hw = 46, hh = 22;
        shapeEl = mkEl('polygon', {
          points: `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`,
          fill: color + '22',
          stroke: color,
          'stroke-width': isError ? 3 : 2,
        });
        break;
      }
      case 'rounded': {
        // BPMN Sub-process = rounded rect with marker
        shapeEl = mkEl('rect', { x: 4, y: 6, width: W - 8, height: H - 12, rx: 12, ry: 12, fill: color + '22', stroke: color, 'stroke-width': isError ? 3 : 2 });
        // Loop marker square at bottom
        svg.appendChild(mkEl('rect', { x: cx - 6, y: H - 12, width: 12, height: 8, rx: 1, fill: 'none', stroke: color, 'stroke-width': 1.5 }));
        break;
      }
      default: {
        // BPMN Task = rectangle
        shapeEl = mkEl('rect', { x: 4, y: 6, width: W - 8, height: H - 12, rx: 4, ry: 4, fill: color + '22', stroke: color, 'stroke-width': isError ? 3 : 2 });
        break;
      }
    }

    svg.appendChild(shapeEl);

    // Label
    const label = mkEl('text', {
      x: cx, y: cy + 1,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: color,
      'font-family': "'Barlow Condensed', sans-serif",
      'font-size': '11',
      'font-weight': '700',
      'letter-spacing': '0.06em',
    });
    label.textContent = bt.label;
    svg.appendChild(label);

    // Step badge (top-left circle)
    const badgeCircle = mkEl('circle', { cx: 12, cy: 12, r: 9, fill: '#0d1117', stroke: color, 'stroke-width': 1 });
    const badgeText = mkEl('text', {
      x: 12, y: 12,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: color,
      'font-family': "'Barlow Condensed', sans-serif",
      'font-size': '9',
      'font-weight': '700',
    });
    badgeText.textContent = index + 1;
    svg.appendChild(badgeCircle);
    svg.appendChild(badgeText);

    // Hover + click
    if (!isReadOnly) {
      svg.addEventListener('mouseenter', () => {
        shapeEl.setAttribute('fill', color + '44');
      });
      svg.addEventListener('mouseleave', () => {
        shapeEl.setAttribute('fill', color + '22');
      });
      if (onClick) svg.addEventListener('click', onClick);
      svg.setAttribute('title', `Click to remove: ${bt.label}`);
    }

    return svg;
  }

  // ════════════════════════════════════════════════════════════
  // RENDER FLOW NODES (campaign + sandbox)
  // ════════════════════════════════════════════════════════════
  // Drag state
  let _dragIdx = null;

  function renderNodes(containerEl, flowArr, onClickIdx, opts = {}) {
    const { errorIdx = -1, readOnly = false } = opts;
    containerEl.innerHTML = '';

    if (flowArr.length === 0) {
      const emp = document.createElement('div');
      emp.className = 'flow-empty';
      emp.textContent = 'Click a block from the palette to add · Drag blocks to reorder';
      containerEl.appendChild(emp);
      return;
    }

    flowArr.forEach((key, i) => {
      const bt = BLOCK_TYPES[key];

      // Drop zone ABOVE node (shows gap when dragging)
      if (!readOnly) {
        const dropZone = document.createElement('div');
        dropZone.className = 'drop-zone';
        dropZone.dataset.dropIdx = i;
        dropZone.style.cssText = 'height:6px;width:100%;transition:height 0.15s,background 0.15s;border-radius:2px;';
        dropZone.addEventListener('dragover', e => {
          e.preventDefault();
          dropZone.style.height = '24px';
          dropZone.style.background = 'rgba(0,212,255,0.25)';
        });
        dropZone.addEventListener('dragleave', () => {
          dropZone.style.height = '6px';
          dropZone.style.background = 'transparent';
        });
        dropZone.addEventListener('drop', e => {
          e.preventDefault();
          dropZone.style.height = '6px';
          dropZone.style.background = 'transparent';
          const dropIdx = parseInt(dropZone.dataset.dropIdx);
          if (_dragIdx === null || _dragIdx === dropIdx || _dragIdx === dropIdx - 1) return;
          const moved = flowArr.splice(_dragIdx, 1)[0];
          const insertAt = _dragIdx < dropIdx ? dropIdx - 1 : dropIdx;
          flowArr.splice(insertAt, 0, moved);
          _dragIdx = null;
          el('flow-result').textContent = '';
          renderPalette();
          renderFlow();
          renderTests(null);
        });
        containerEl.appendChild(dropZone);
      }

      // Connector arrow
      if (i > 0) {
        const prevColor = BLOCK_TYPES[flowArr[i - 1]].color;
        const connWrap = document.createElement('div');
        connWrap.className = 'flow-connector';

        const line = document.createElement('div');
        line.className = 'flow-connector-line';
        line.style.background = `linear-gradient(${prevColor}, ${bt.color})`;

        const arrow = document.createElement('div');
        arrow.className = 'flow-connector-arrow';
        arrow.style.borderTopColor = bt.color;

        connWrap.appendChild(line);
        connWrap.appendChild(arrow);
        containerEl.appendChild(connWrap);
      }

      // BPMN SVG node wrapper
      const nodeWrap = document.createElement('div');
      nodeWrap.style.cssText = `display:flex;justify-content:center;width:100%;padding:${bt.shape === 'diamond' ? '4px' : '0'} 0;`;

      if (!readOnly) {
        nodeWrap.draggable = true;
        nodeWrap.style.cursor = 'grab';
        nodeWrap.title = 'Drag to reorder · Click to remove';

        nodeWrap.addEventListener('dragstart', e => {
          _dragIdx = i;
          nodeWrap.style.opacity = '0.4';
          e.dataTransfer.effectAllowed = 'move';
        });
        nodeWrap.addEventListener('dragend', () => {
          _dragIdx = null;
          nodeWrap.style.opacity = '1';
          // Reset all drop zones
          containerEl.querySelectorAll('.drop-zone').forEach(z => {
            z.style.height = '6px';
            z.style.background = 'transparent';
          });
        });
      }

      const svgNode = makeBPMNNode(key, i, {
        isError: i === errorIdx,
        isReadOnly: readOnly,
        onClick: readOnly ? null : () => onClickIdx(i),
      });

      nodeWrap.appendChild(svgNode);
      containerEl.appendChild(nodeWrap);
    });

    // Final drop zone at the bottom
    if (!readOnly && flowArr.length > 0) {
      const dropZoneEnd = document.createElement('div');
      dropZoneEnd.className = 'drop-zone';
      dropZoneEnd.dataset.dropIdx = flowArr.length;
      dropZoneEnd.style.cssText = 'height:6px;width:100%;transition:height 0.15s,background 0.15s;border-radius:2px;margin-top:2px;';
      dropZoneEnd.addEventListener('dragover', e => {
        e.preventDefault();
        dropZoneEnd.style.height = '24px';
        dropZoneEnd.style.background = 'rgba(0,212,255,0.25)';
      });
      dropZoneEnd.addEventListener('dragleave', () => {
        dropZoneEnd.style.height = '6px';
        dropZoneEnd.style.background = 'transparent';
      });
      dropZoneEnd.addEventListener('drop', e => {
        e.preventDefault();
        dropZoneEnd.style.height = '6px';
        dropZoneEnd.style.background = 'transparent';
        if (_dragIdx === null || _dragIdx === flowArr.length - 1) return;
        const moved = flowArr.splice(_dragIdx, 1)[0];
        flowArr.push(moved);
        _dragIdx = null;
        el('flow-result').textContent = '';
        renderPalette();
        renderFlow();
        renderTests(null);
      });
      containerEl.appendChild(dropZoneEnd);
    }
  }

  // ════════════════════════════════════════════════════════════
  // CAMPAIGN MODE — PALETTE
  // ════════════════════════════════════════════════════════════
  function renderPalette() {
    const lvl = currentLevel();
    const pal = el('palette');
    pal.innerHTML = '';

    // Track which blocks are already used (prevent duplicates for START/END)
    lvl.palette.forEach(key => {
      const bt = BLOCK_TYPES[key];

      // Disable START if already in flow (only one allowed)
      const isDisabled = (key === 'START' || key === 'END') && flow.includes(key);

      const btn = document.createElement('button');
      btn.className = 'palette-btn';
      btn.style.background   = isDisabled ? 'transparent' : bt.color + '18';
      btn.style.borderColor  = isDisabled ? 'var(--border)' : bt.color + '55';
      btn.style.color        = isDisabled ? 'var(--border)' : bt.color;
      btn.style.opacity      = isDisabled ? '0.4' : '1';
      btn.style.cursor       = isDisabled ? 'not-allowed' : 'pointer';
      btn.textContent        = bt.label;
      btn.title              = isDisabled ? `Only one ${key} allowed` : bt.desc;
      btn.disabled           = isDisabled;

      if (!isDisabled) {
        btn.addEventListener('mouseenter', () => { btn.style.background = bt.color + '33'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = bt.color + '18'; });
        btn.addEventListener('click',      () => addBlock(key));
      }

      pal.appendChild(btn);
    });
  }

  // ════════════════════════════════════════════════════════════
  // CAMPAIGN MODE — TESTS PANEL
  // ════════════════════════════════════════════════════════════
  function renderTests(results = null) {
    const panel = el('tests-panel');
    panel.innerHTML = '';

    const lvl = currentLevel();

    lvl.tests.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'test-row';
      row.dataset.idx = i;

      if (results === null) {
        // Before run: completely hidden
        row.classList.add('hidden', 'pending');
        row.innerHTML = `<span>○</span><span>${t.label}</span>`;
      } else if (results[i]) {
        // Passed: hidden unless [T] toggle is on
        row.classList.add(testsVisible ? 'pass' : 'hidden');
        row.innerHTML = `<span>✓</span><span>${t.label}</span>`;
      } else {
        // Failed: ALWAYS visible in red
        row.classList.add('fail');
        row.innerHTML = `<span>✗</span><span>${t.label}</span>`;
      }

      panel.appendChild(row);
    });

    // Update header to show count
    const failCount = results ? results.filter(r => !r).length : 0;
    const headerLabel = el('tests-header-label');
    if (headerLabel) {
      headerLabel.textContent = results
        ? (failCount > 0 ? `// Tests — ${failCount} failing` : '// Tests — all passed')
        : '// Tests';
    }
  }

  function updateTestsToggle() {
    const toggle = el('tests-toggle-btn');
    if (toggle) toggle.textContent = testsVisible ? '[T] Hide passed' : '[T] Show all';
  }

  // ════════════════════════════════════════════════════════════
  // ADD / REMOVE BLOCKS
  // ════════════════════════════════════════════════════════════
  function addBlock(key) {
    // Prevent duplicate START / END
    if ((key === 'START' || key === 'END') && flow.includes(key)) return;
    flow.push(key);
    el('flow-result').textContent = '';
    renderPalette();
    renderFlow();
    renderTests(null);
  }

  function removeBlock(i) {
    flow.splice(i, 1);
    el('flow-result').textContent = '';
    renderPalette();
    renderFlow();
    renderTests(null);
  }

  function renderFlow() {
    renderNodes(el('flow-nodes'), flow, removeBlock);
  }

  // ════════════════════════════════════════════════════════════
  // RUN TESTS — multi-layer anti-tamper
  // ════════════════════════════════════════════════════════════

  // Layer 1: test functions run on frozen snapshot
  function _runTestSecure(testFn, flowSnapshot) {
    try {
      const frozen = Object.freeze([...flowSnapshot]);
      const result = testFn(frozen);
      const recheck = testFn(Object.freeze([...flowSnapshot]));
      return !!result && !!recheck;
    } catch { return false; }
  }

  // Layer 2: XOR checksum detects result array tampering
  function _computeChecksum(results) {
    return results.reduce((acc, v, i) => acc ^ ((v ? 1 : 0) << (i % 30)), 0xDEAD);
  }

  // Layer 3: timing validation — can't pass instantly
  const _levelLoadTimestamps = {};

  // Layer 4: flow signature — hash of actual flow content
  function _flowSignature(flowArr) {
    return flowArr.reduce((h, k, i) => h + k.charCodeAt(0) * (i + 1) * 31, 0);
  }

  // Layer 5: detect if test functions were overwritten
  const _originalTestCounts = {};
  function _captureTestSignatures() {
    LEVELS.forEach((lvl, i) => {
      _originalTestCounts[i] = lvl.tests.length;
    });
  }

  function runTests() {
    if (flow.length === 0) {
      el('flow-result').textContent = 'Add some blocks first.';
      return;
    }

    const lvlIdx = filteredLevels[currentLevelIdx];
    const lvl = currentLevel();

    // Anti-tamper: verify test array hasn't been shortened/replaced
    if (lvl.tests.length !== _originalTestCounts[lvlIdx]) {
      el('flow-result').textContent = '⚠ Test integrity violation detected.';
      return;
    }

    // Anti-tamper: must have spent at least 2s on this level
    const elapsed = Date.now() - (_levelLoadTimestamps[lvlIdx] || 0);
    if (elapsed < 2000) {
      el('flow-result').textContent = '⚠ Too fast — are you a bot debugging a bot?';
      return;
    }

    const flowSnapshot = Object.freeze([...flow]);
    const flowSig = _flowSignature(flow);

    const results = lvl.tests.map(t => _runTestSecure(t.fn, flowSnapshot));
    const checksum = _computeChecksum(results);

    // Double-check: re-run everything from scratch
    const recheck  = lvl.tests.map(t => _runTestSecure(t.fn, flowSnapshot));
    const recheckSig = _flowSignature(flow); // verify flow wasn't mutated during test

    if (_computeChecksum(recheck) !== checksum || recheckSig !== flowSig) {
      el('flow-result').textContent = '⚠ Integrity check failed.';
      return;
    }

    renderTests(results);

    const passed = results.filter(Boolean).length;
    const total  = results.length;

    setTimeout(() => {
      if (passed === total) {
        const secs    = stopTimer();
        const timeBonus = Math.max(0, 300 - secs);
        const earned   = (lvlIdx + 1) * 100 + timeBonus;
        totalScore    += earned;

        el('fg-score').textContent = totalScore;

        const stats = loadStats();
        const prevScore = stats.completed[lvlIdx]?.score || 0;
        stats.completed[lvlIdx] = { time: secs, score: earned, ts: Date.now() };
        // Only add the difference to avoid double-counting replayed levels
        stats.totalScore = (stats.totalScore || 0) - prevScore + earned;
        stats.attempts   = (stats.attempts   || 0) + 1;
        saveStats(stats);

        el('flow-result').textContent = `✓ ALL TESTS PASSED · ⏱ ${secs}s · +${earned}pts`;

        if (currentLevelIdx < filteredLevels.length - 1) {
          setTimeout(() => {
            currentLevelIdx++;
            flow = [];
            loadLevel();
          }, 2000);
        } else {
          setTimeout(() => {
            el('flow-result').textContent = `🏆 Domain complete! Total: ${totalScore}pts`;
          }, 500);
        }
      } else {
        el('flow-result').textContent = `${passed}/${total} tests passed — fix your flow`;
      }
    }, 200);
  }

  // ════════════════════════════════════════════════════════════
  // LOAD LEVEL
  // ════════════════════════════════════════════════════════════
  function loadLevel() {
    const lvl = currentLevel();
    const lvlIdx = filteredLevels[currentLevelIdx];

    // Anti-tamper: record when this level was loaded
    _levelLoadTimestamps[lvlIdx] = Date.now();

    // Level counter — shows position within FILTERED set
    el('fg-level').textContent = `${currentLevelIdx + 1}/${filteredLevels.length}`;

    // Business case
    el('business-case').innerHTML =
      `<strong style="color:var(--accent);display:block;margin-bottom:0.4rem;font-size:0.9rem;">${lvl.title}</strong>${lvl.business}`;

    // Framework recommendation
    const fw  = el('framework-rec');
    if (lvl.framework) {
      fw.textContent = lvl.framework;
    } else {
      fw.textContent = '—';
    }

    // Task
    el('task-desc').innerHTML = `<span style="color:var(--accent3);">// TASK:</span> ${lvl.desc}`;

    // Reset flow
    flow        = [];
    testsVisible = false;
    el('flow-result').textContent = '';

    renderLevelPicker();
    renderPalette();
    renderFlow();
    renderTests(null);
    updateTestsToggle();
    startTimer();
  }

  // ════════════════════════════════════════════════════════════
  // DOMAIN FILTER — only re-renders when domain changes
  // ════════════════════════════════════════════════════════════
  function renderDomainFilter() {
    const domains = ['All', ...new Set(LEVELS.map(l => l.domain))];
    const container = el('domain-filter');
    container.innerHTML = '';

    domains.forEach(d => {
      const btn = document.createElement('button');
      btn.className = 'domain-chip' + (d === activeDomain ? ' active' : '');
      btn.textContent = d;
      btn.addEventListener('click', () => {
        activeDomain   = d;
        filteredLevels = d === 'All'
          ? LEVELS.map((_, i) => i)
          : LEVELS.map((l, i) => l.domain === d ? i : -1).filter(i => i >= 0);
        currentLevelIdx = 0;
        flow = [];
        renderDomainFilter();   // re-render chips with new active
        renderLevelPicker();    // re-render level dots
        loadLevel();
      });
      container.appendChild(btn);
    });
  }

  // ════════════════════════════════════════════════════════════
  // LEVEL PICKER — clickable dots for jumping to any level
  // ════════════════════════════════════════════════════════════
  function renderLevelPicker() {
    let picker = el('level-picker');
    if (!picker) return;
    picker.innerHTML = '';

    const stats = loadStats();

    filteredLevels.forEach((globalIdx, localIdx) => {
      const lvl    = LEVELS[globalIdx];
      const isCur  = localIdx === currentLevelIdx;
      const isDone = stats.completed && stats.completed[globalIdx];

      const dot = document.createElement('button');
      dot.title = `${localIdx + 1}. ${lvl.title}`;
      dot.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%;
        border: 2px solid ${isCur ? 'var(--accent)' : isDone ? 'var(--accent3)' : 'var(--border)'};
        background: ${isCur ? 'var(--accent)' : isDone ? 'rgba(16,185,129,0.15)' : 'transparent'};
        color: ${isCur ? 'var(--bg)' : isDone ? 'var(--accent3)' : 'var(--muted)'};
        font-family: var(--mono); font-size: 0.65rem; font-weight: 700;
        cursor: pointer; transition: all 0.15s; line-height: 1;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      `;
      dot.textContent = localIdx + 1;

      dot.addEventListener('mouseenter', () => {
        if (!isCur) dot.style.borderColor = 'var(--accent)';
      });
      dot.addEventListener('mouseleave', () => {
        if (!isCur) dot.style.borderColor = isDone ? 'var(--accent3)' : 'var(--border)';
      });

      dot.addEventListener('click', () => {
        currentLevelIdx = localIdx;
        flow = [];
        loadLevel();
      });

      picker.appendChild(dot);
    });
  }

  // ════════════════════════════════════════════════════════════
  // DEBUG MODE
  // ════════════════════════════════════════════════════════════
  function renderDebugMode() {
    const wrap = el('debug-puzzle-area');
    wrap.innerHTML = '';

    // Find first unsolved puzzle
    let currentPuzzleIdx = -1;
    for (let i = 0; i < DEBUG_PUZZLES.length; i++) {
      if (!debugSolvedSet.has(i)) { currentPuzzleIdx = i; break; }
    }

    // All solved
    if (currentPuzzleIdx === -1) {
      const done = document.createElement('div');
      done.className = 'debug-complete';
      done.innerHTML = `
        <div class="debug-complete-icon">🏆</div>
        <div class="debug-complete-title">All ${DEBUG_PUZZLES.length} debug cases solved!</div>
        <div class="debug-complete-score">+${DEBUG_PUZZLES.length * 200}pts earned</div>
        <div class="debug-complete-sub">${debugSolvedSet.size}/${DEBUG_PUZZLES.length} production bugs identified correctly</div>
      `;
      wrap.appendChild(done);
      return;
    }

    // Progress bar
    const progress = document.createElement('div');
    progress.className = 'debug-progress';
    progress.innerHTML = `<span>Case ${currentPuzzleIdx + 1} of ${DEBUG_PUZZLES.length}</span><span>${debugSolvedSet.size} solved</span>`;
    wrap.appendChild(progress);

    // Show current puzzle only
    const puzzle = DEBUG_PUZZLES[currentPuzzleIdx];
    const pIdx = currentPuzzleIdx;

    const card = document.createElement('div');
    card.className = 'debug-card';

    // Title + scenario
    const title = document.createElement('h3');
    title.className = 'debug-title';
    title.textContent = puzzle.title;

    const scenario = document.createElement('p');
    scenario.className = 'debug-scenario';
    scenario.textContent = puzzle.scenario;

    card.append(title, scenario);

    // Flow visualisation
    const flowWrap = document.createElement('div');
    flowWrap.className = 'debug-flow-wrap';
    const flowNodes = document.createElement('div');
    flowNodes.className = 'flow-nodes';
    flowWrap.appendChild(flowNodes);
    card.appendChild(flowWrap);

    renderNodes(flowNodes, puzzle.flow, () => {}, { readOnly: true });

    // Hint
    const hint = document.createElement('div');
    hint.className = 'debug-hint';
    hint.textContent = `💡 ${puzzle.hint}`;
    card.appendChild(hint);

    // Question
    const q = document.createElement('div');
    q.className = 'debug-question';
    q.textContent = '?> Which block is the bug?';
    card.appendChild(q);

    // Options
    const optsWrap = document.createElement('div');
    optsWrap.className = 'debug-options';

    puzzle.options.forEach((blockIdx, optIdx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'debug-opt-btn';
      btn.textContent = `→ ${puzzle.optionLabels[optIdx]}`;

      btn.addEventListener('click', () => {
        const correct = blockIdx === puzzle.bugIndex;

        if (correct) {
          // Disable all buttons
          optsWrap.querySelectorAll('.debug-opt-btn').forEach(b => {
            b.disabled = true;
            b.classList.add('disabled');
          });
          btn.className = 'debug-opt-btn correct';

          // Highlight error in flow
          renderNodes(flowNodes, puzzle.flow, () => {}, { errorIdx: puzzle.bugIndex, readOnly: true });

          // Show explanation
          const expl = document.createElement('div');
          expl.className = 'debug-explanation';
          const header = document.createElement('div');
          header.className = 'debug-expl-header';
          header.textContent = `✓ Correct — ${puzzle.optionLabels[optIdx]}`;
          const body = document.createElement('div');
          body.className = 'debug-expl-body';
          body.textContent = puzzle.explanation;
          expl.appendChild(header);
          expl.appendChild(body);
          card.appendChild(expl);

          // "Next →" button
          const nextBtn = document.createElement('button');
          nextBtn.type = 'button';
          nextBtn.className = 'btn-run debug-next-btn';
          nextBtn.textContent = pIdx < DEBUG_PUZZLES.length - 1 ? 'Next case →' : 'See results →';
          nextBtn.addEventListener('click', () => renderDebugMode());
          card.appendChild(nextBtn);

          // Mark solved + save
          debugSolvedSet.add(pIdx);
          const stats = loadStats();
          stats.debugsSolved = (stats.debugsSolved || 0) + 1;
          stats.totalScore   = (stats.totalScore   || 0) + 200;
          saveStats(stats);

        } else {
          btn.className = 'debug-opt-btn wrong';
          btn.disabled = true;
          btn.textContent = `✗ ${puzzle.optionLabels[optIdx]} — not the root cause`;
          setTimeout(() => {
            btn.className = 'debug-opt-btn';
            btn.disabled = false;
            btn.textContent = `→ ${puzzle.optionLabels[optIdx]}`;
          }, 2200);
        }
      });

      optsWrap.appendChild(btn);
    });

    card.appendChild(optsWrap);
    wrap.appendChild(card);
  }

  // ════════════════════════════════════════════════════════════
  // SANDBOX MODE
  // ════════════════════════════════════════════════════════════
  function renderSandboxPalette() {
    const pal = el('sandbox-palette');
    pal.innerHTML = '';

    Object.keys(BLOCK_TYPES).forEach(key => {
      const bt = BLOCK_TYPES[key];
      const btn = document.createElement('button');
      btn.className = 'palette-btn';
      btn.style.background  = bt.color + '18';
      btn.style.borderColor = bt.color + '55';
      btn.style.color       = bt.color;
      btn.textContent       = bt.label;
      btn.title             = bt.desc;
      btn.addEventListener('mouseenter', () => { btn.style.background = bt.color + '33'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = bt.color + '18'; });
      btn.addEventListener('click', () => {
        sandboxFlow.push(key);
        renderSandbox();
      });
      pal.appendChild(btn);
    });
  }

  function renderSandbox() {
    renderNodes(el('sandbox-nodes'), sandboxFlow, (i) => {
      sandboxFlow.splice(i, 1);
      renderSandbox();
    });
    const c = el('sandbox-count');
    if (c) c.textContent = sandboxFlow.length;
  }

  // SVG Export
  function exportSVG() {
    if (sandboxFlow.length === 0) { alert('Add some blocks first.'); return; }

    const BH = 56, GAP = 36, W = 440, PAD = 60;
    const totalH = PAD + sandboxFlow.length * (BH + GAP) + PAD;
    const cx = W / 2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${totalH}" width="${W}" height="${totalH}">`;
    svg += `<rect width="${W}" height="${totalH}" fill="#0d1117"/>`;
    svg += `<text x="20" y="32" font-family="'Barlow Condensed',sans-serif" font-size="13" font-weight="700" fill="#00d4ff" letter-spacing="2">// RPA FLOW DIAGRAM</text>`;

    sandboxFlow.forEach((key, i) => {
      const bt  = BLOCK_TYPES[key];
      const y   = PAD + i * (BH + GAP);
      const mid = y + BH / 2;

      // Connector
      if (i > 0) {
        const py = PAD + (i - 1) * (BH + GAP) + BH;
        svg += `<line x1="${cx}" y1="${py}" x2="${cx}" y2="${y}" stroke="${bt.color}" stroke-width="2" opacity="0.6"/>`;
        svg += `<polygon points="${cx},${y} ${cx - 5},${y - 7} ${cx + 5},${y - 7}" fill="${bt.color}" opacity="0.85"/>`;
      }

      // Shape
      switch (bt.shape) {
        case 'circle': {
          const r = 22;
          svg += `<circle cx="${cx}" cy="${mid}" r="${r}" fill="${bt.color}22" stroke="${bt.color}" stroke-width="2"/>`;
          if (key === 'END') svg += `<circle cx="${cx}" cy="${mid}" r="16" fill="none" stroke="${bt.color}" stroke-width="4"/>`;
          break;
        }
        case 'diamond': {
          svg += `<polygon points="${cx},${mid - 22} ${cx + 46},${mid} ${cx},${mid + 22} ${cx - 46},${mid}" fill="${bt.color}22" stroke="${bt.color}" stroke-width="2"/>`;
          break;
        }
        case 'rounded': {
          svg += `<rect x="${cx - 90}" y="${y + 4}" width="180" height="${BH - 8}" rx="12" fill="${bt.color}22" stroke="${bt.color}" stroke-width="2"/>`;
          break;
        }
        default: {
          svg += `<rect x="${cx - 90}" y="${y + 4}" width="180" height="${BH - 8}" rx="4" fill="${bt.color}22" stroke="${bt.color}" stroke-width="2"/>`;
        }
      }

      // Label
      svg += `<text x="${cx}" y="${mid + 1}" text-anchor="middle" dominant-baseline="middle" font-family="'Barlow Condensed',sans-serif" font-size="11" font-weight="700" fill="${bt.color}" letter-spacing="1">${bt.label}</text>`;

      // Step badge
      svg += `<circle cx="${cx - 82}" cy="${y + 12}" r="9" fill="#0d1117" stroke="${bt.color}" stroke-width="1"/>`;
      svg += `<text x="${cx - 82}" y="${y + 12}" text-anchor="middle" dominant-baseline="middle" font-family="'Barlow Condensed',sans-serif" font-size="9" font-weight="700" fill="${bt.color}">${i + 1}</text>`;
    });

    svg += '</svg>';

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `rpa-flow-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ════════════════════════════════════════════════════════════
  // STATS MODE
  // ════════════════════════════════════════════════════════════
  function renderStats() {
    const stats = loadStats();
    const completed = Object.keys(stats.completed || {}).length;

    const grid = el('stats-grid');
    grid.innerHTML = '';

    [
      { label: 'Levels Completed',  value: `${completed}/${LEVELS.length}`, color: 'var(--accent)' },
      { label: 'Total Score',       value: stats.totalScore || 0,           color: 'var(--accent3)' },
      { label: 'Debug Solved',      value: stats.debugsSolved || 0,         color: '#f59e0b' },
      { label: 'Total Attempts',    value: stats.attempts || 0,             color: 'var(--muted)' },
    ].forEach(c => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.style.borderLeftColor = c.color;
      card.innerHTML = `
        <div class="stat-label">${c.label}</div>
        <div class="stat-value" style="color:${c.color};">${c.value}</div>
      `;
      grid.appendChild(card);
    });

    const hist = el('stats-history');
    hist.innerHTML = '';

    LEVELS.forEach((l, i) => {
      const done = stats.completed && stats.completed[i];
      const row  = document.createElement('div');
      row.className = 'history-row' + (done ? ' done' : '');
      row.innerHTML = `
        <span>${done ? '✓' : '○'} <span style="color:var(--muted);">[${l.domain}]</span> ${l.title}</span>
        <span style="color:var(--muted);">${done ? `${done.time}s · ${done.score}pts` : '—'}</span>
      `;
      hist.appendChild(row);
    });
  }

  // ════════════════════════════════════════════════════════════
  // MODE TABS — fixed timer leak + a11y
  // ════════════════════════════════════════════════════════════
  function initModeTabs() {
    qsa('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // Stop timer on ANY tab switch
        stopTimer();

        // Update active state + aria
        qsa('.mode-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        // Show/hide panels via .hidden class (no inline style)
        qsa('.mode-panel').forEach(p => p.classList.add('hidden'));
        const mode = tab.dataset.mode;
        const panel = el(`mode-${mode}`);
        if (panel) panel.classList.remove('hidden');

        // Mode-specific init
        if (mode === 'debug')       renderDebugMode();
        if (mode === 'sandbox')     { renderSandboxPalette(); renderSandbox(); }
        if (mode === 'leaderboard') renderStats();
        if (mode === 'campaign')    startTimer();
      });
    });
  }

  // ════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ════════════════════════════════════════════════════════════
  function initEvents() {
    // Run
    const runBtn = el('run-btn');
    if (runBtn) runBtn.addEventListener('click', runTests);

    // Reset — also restarts timer and picker
    const resetBtn = el('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      flow = [];
      el('flow-result').textContent = '';
      testsVisible = false;
      renderLevelPicker();
      renderPalette();
      renderFlow();
      renderTests(null);
      updateTestsToggle();
      startTimer(); // restart timer on reset
    });

    // Tests toggle (T button) — only toggles passed tests visibility
    const testsToggle = el('tests-toggle-btn');
    if (testsToggle) {
      testsToggle.addEventListener('click', () => {
        testsVisible = !testsVisible;
        updateTestsToggle();
        qsa('.test-row').forEach(row => {
          // Failed tests always visible, never toggled
          if (row.classList.contains('fail')) return;
          // Pending tests (before run) stay hidden always
          if (row.classList.contains('pending')) return;
          // Passed tests: show/hide based on toggle
          if (testsVisible) {
            row.classList.remove('hidden');
            row.classList.add('pass');
          } else {
            row.classList.add('hidden');
            row.classList.remove('pass');
          }
        });
      });
    }

    // Sandbox buttons
    const sbExport = el('sandbox-export-btn');
    if (sbExport) sbExport.addEventListener('click', exportSVG);

    const sbClear = el('sandbox-clear-btn');
    if (sbClear) sbClear.addEventListener('click', () => { sandboxFlow = []; renderSandbox(); });

    // Stats reset
    const statsReset = el('stats-reset-btn');
    if (statsReset) statsReset.addEventListener('click', () => {
      if (confirm('Reset all stats? This cannot be undone.')) {
        localStorage.removeItem(STATS_KEY);
        renderStats();
      }
    });
  }

  // ════════════════════════════════════════════════════════════
  // FADE-IN OBSERVER
  // ════════════════════════════════════════════════════════════
  function initFadeIn() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 80);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.fade-in').forEach(el => obs.observe(el));
  }

  // ════════════════════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════════════════════
  function init() {
    _captureTestSignatures(); // anti-tamper: snapshot test counts before anything runs
    initModeTabs();
    initEvents();
    renderDomainFilter();
    renderLevelPicker();
    loadLevel();
    initFadeIn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
