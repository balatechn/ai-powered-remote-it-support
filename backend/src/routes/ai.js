/**
 * AI Engine Routes
 * Handles AI-powered troubleshooting, analysis, and fix suggestions.
 */

const express = require('express');
const { AIInteraction, Device, Log, Script } = require('../models');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authenticate);

// ΓöÇΓöÇΓöÇ AI Service Layer ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

/**
 * Prompt templates for different AI tasks
 */
const PROMPT_TEMPLATES = {
  diagnose: (issue, deviceInfo) => `
You are an expert IT support engineer. Analyze the following issue and provide a structured diagnosis.

Device Information:
- Hostname: ${deviceInfo?.hostname || 'N/A'}
- OS: ${deviceInfo?.os_type || 'N/A'} ${deviceInfo?.os_version || ''}
- CPU Usage: ${deviceInfo?.cpu_usage || 'N/A'}%
- Memory Usage: ${deviceInfo?.memory_usage || 'N/A'}%
- Disk Usage: ${deviceInfo?.disk_usage || 'N/A'}%

Issue Reported:
${issue}

Provide your response in the following JSON format:
{
  "diagnosis": "Brief summary of the issue",
  "severity": "low|medium|high|critical",
  "possible_causes": ["cause1", "cause2"],
  "recommended_fixes": [
    { "step": 1, "action": "description", "risk": "low|medium|high" }
  ],
  "suggested_script": { "type": "powershell|bash", "content": "script content", "description": "what it does" },
  "needs_escalation": false
}`,

  analyze_logs: (logs) => `
You are an IT systems analyst. Analyze these system logs and identify patterns, anomalies, and potential issues.

Logs:
${logs}

Provide analysis including:
1. Pattern summary
2. Anomalies detected
3. Risk assessment
4. Recommended actions`,

  suggest_fix: (issue, context) => `
You are an IT automation expert. Based on the issue below, suggest a safe, tested fix.

Issue: ${issue}
Context: ${context}

IMPORTANT: 
- Only suggest safe, non-destructive operations
- Include rollback steps
- Flag any command that could cause data loss

Provide a step-by-step fix with executable commands.`
};

/**
 * Call OpenAI API with safety layer
 */
async function callAI(prompt, model = null) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  // If no API key, return mock response for development
  if (!apiKey || apiKey === 'sk-your-openai-api-key') {
    return {
      response: JSON.stringify({
        diagnosis: "This appears to be a common connectivity issue that can be resolved by checking network settings.",
        severity: "medium",
        possible_causes: [
          "DNS resolution failure",
          "Network adapter misconfiguration",
          "Firewall blocking connections"
        ],
        recommended_fixes: [
          { step: 1, action: "Run network diagnostics: ipconfig /all", risk: "low" },
          { step: 2, action: "Flush DNS cache: ipconfig /flushdns", risk: "low" },
          { step: 3, action: "Reset network adapter", risk: "medium" }
        ],
        suggested_script: {
          type: "powershell",
          content: "ipconfig /flushdns\nnetsh winsock reset\nnetsh int ip reset",
          description: "Resets DNS cache and network stack"
        },
        needs_escalation: false
      }),
      tokens_used: 0,
      model: 'mock'
    };
  }

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: model || process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert IT support AI. Always prioritize safety. Never suggest destructive operations without explicit warnings.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    return {
      response: completion.choices[0].message.content,
      tokens_used: completion.usage?.total_tokens || 0,
      model: completion.model
    };
  } catch (error) {
    logger.error('OpenAI API error:', error);
    throw new Error('AI service unavailable');
  }
}

// ΓöÇΓöÇΓöÇ POST /api/ai/diagnose ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.post('/diagnose', async (req, res) => {
  try {
    const { issue, device_id } = req.body;
    if (!issue) return res.status(400).json({ error: 'Issue description required' });

    let deviceInfo = null;
    if (device_id) {
      deviceInfo = await Device.findByPk(device_id);
    }

    const prompt = PROMPT_TEMPLATES.diagnose(issue, deviceInfo);
    const result = await callAI(prompt);

    // Store interaction
    const interaction = await AIInteraction.create({
      user_id: req.userId,
      device_id,
      prompt: issue,
      response: result.response,
      model_used: result.model,
      tokens_used: result.tokens_used,
      category: 'diagnosis'
    });

    // Parse response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(result.response);
    } catch {
      parsedResponse = { raw_response: result.response };
    }

    res.json({
      interaction_id: interaction.id,
      diagnosis: parsedResponse,
      tokens_used: result.tokens_used
    });
  } catch (error) {
    logger.error('AI diagnose error:', error);
    res.status(500).json({ error: 'AI diagnosis failed' });
  }
});

// ΓöÇΓöÇΓöÇ POST /api/ai/chat ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.post('/chat', async (req, res) => {
  try {
    const { message, device_id, context } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    let deviceInfo = null;
    if (device_id) {
      deviceInfo = await Device.findByPk(device_id);
    }

    const prompt = `
Context: ${context || 'General IT support'}
${deviceInfo ? `Device: ${deviceInfo.hostname} (${deviceInfo.os_type} ${deviceInfo.os_version})` : ''}

User question: ${message}

Provide a helpful, concise response. If suggesting commands, mark them clearly.`;

    const result = await callAI(prompt);

    const interaction = await AIInteraction.create({
      user_id: req.userId,
      device_id,
      prompt: message,
      response: result.response,
      model_used: result.model,
      tokens_used: result.tokens_used,
      category: 'chat'
    });

    res.json({
      interaction_id: interaction.id,
      response: result.response,
      tokens_used: result.tokens_used
    });
  } catch (error) {
    logger.error('AI chat error:', error);
    res.status(500).json({ error: 'AI chat failed' });
  }
});

// ΓöÇΓöÇΓöÇ POST /api/ai/analyze-logs ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.post('/analyze-logs', async (req, res) => {
  try {
    const { device_id, log_count = 50 } = req.body;

    const logs = await Log.findAll({
      where: device_id ? { device_id } : {},
      order: [['created_at', 'DESC']],
      limit: parseInt(log_count)
    });

    const logText = logs.map(l => `[${l.level}] ${l.created_at}: ${l.message}`).join('\n');
    const prompt = PROMPT_TEMPLATES.analyze_logs(logText);
    const result = await callAI(prompt);

    const interaction = await AIInteraction.create({
      user_id: req.userId,
      device_id,
      prompt: `Analyze ${logs.length} logs`,
      response: result.response,
      model_used: result.model,
      tokens_used: result.tokens_used,
      category: 'log_analysis'
    });

    res.json({
      interaction_id: interaction.id,
      analysis: result.response,
      logs_analyzed: logs.length,
      tokens_used: result.tokens_used
    });
  } catch (error) {
    logger.error('AI log analysis error:', error);
    res.status(500).json({ error: 'Log analysis failed' });
  }
});

// ΓöÇΓöÇΓöÇ POST /api/ai/suggest-fix ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.post('/suggest-fix', async (req, res) => {
  try {
    const { issue, context, device_id } = req.body;
    if (!issue) return res.status(400).json({ error: 'Issue required' });

    const prompt = PROMPT_TEMPLATES.suggest_fix(issue, context || '');
    const result = await callAI(prompt);

    const interaction = await AIInteraction.create({
      user_id: req.userId,
      device_id,
      prompt: issue,
      response: result.response,
      model_used: result.model,
      tokens_used: result.tokens_used,
      category: 'fix_suggestion'
    });

    res.json({
      interaction_id: interaction.id,
      suggestion: result.response,
      tokens_used: result.tokens_used
    });
  } catch (error) {
    logger.error('AI suggest fix error:', error);
    res.status(500).json({ error: 'Fix suggestion failed' });
  }
});

// ΓöÇΓöÇΓöÇ POST /api/ai/feedback ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.post('/feedback', async (req, res) => {
  try {
    const { interaction_id, rating, resolution_status } = req.body;

    const interaction = await AIInteraction.findByPk(interaction_id);
    if (!interaction) return res.status(404).json({ error: 'Interaction not found' });

    await interaction.update({
      feedback_rating: rating,
      resolution_status: resolution_status || 'resolved'
    });

    res.json({ message: 'Feedback recorded' });
  } catch (error) {
    logger.error('AI feedback error:', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

// ΓöÇΓöÇΓöÇ GET /api/ai/history ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: interactions } = await AIInteraction.findAndCountAll({
      where: req.user.role !== 'admin' ? { user_id: req.userId } : {},
      include: [
        { association: 'user', attributes: ['first_name', 'last_name'] },
        { association: 'device', attributes: ['hostname'] }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      interactions,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('AI history error:', error);
    res.status(500).json({ error: 'Failed to fetch AI history' });
  }
});

module.exports = router;
