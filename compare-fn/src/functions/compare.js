// POST /api/compare
// Body:     { inputName, inputContent, masterName, masterContent }  (contents = base64 PDF)
// Response: { reportName, reportContent (base64 PDF), summary }
import { app } from '@azure/functions';
import { comparePdfs, reportNameFor } from '../lib/compare.js';

app.http('compare', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: 'Body must be JSON' } };
    }

    const { inputName, inputContent, masterName, masterContent } = body ?? {};
    const missing = ['inputName', 'inputContent', 'masterName', 'masterContent'].filter((k) => !body?.[k]);
    if (missing.length) return { status: 400, jsonBody: { error: `Missing fields: ${missing.join(', ')}` } };

    try {
      const { report, summary } = await comparePdfs({
        inputPdf: Buffer.from(inputContent, 'base64'),
        masterPdf: Buffer.from(masterContent, 'base64'),
        inputName,
        masterName,
      });
      context.log(`Compared "${inputName}" vs "${masterName}": ${JSON.stringify(summary)}`);
      return {
        jsonBody: {
          reportName: reportNameFor(inputName),
          reportContent: Buffer.from(report).toString('base64'),
          summary,
        },
      };
    } catch (err) {
      context.error(err);
      return { status: err.status ?? 500, jsonBody: { error: err.message } };
    }
  },
});
