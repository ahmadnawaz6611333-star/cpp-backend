const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const { execSync } = require('child_process');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const TEMP_DIR = path.join(os.tmpdir(), 'cpp-compiler');
fsExtra.ensureDirSync(TEMP_DIR);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CPPractice Backend is running' });
});

// Run C++ code
app.post('/api/run', async (req, res) => {
  try {
    const { code, input } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const execId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const execDir = path.join(TEMP_DIR, execId);
    fsExtra.ensureDirSync(execDir);

    const sourceFile = path.join(execDir, 'main.cpp');
    fs.writeFileSync(sourceFile, code);

    const compileCommand = `g++ -o "${path.join(execDir, 'main')}" "${sourceFile}" -O2 -std=c++17 -Wall`;
    
    try {
      execSync(compileCommand, {
        timeout: 10000,
        maxBuffer: 1024 * 1024
      });
    } catch (compileErr) {
      const errorOutput = compileErr.stderr ? compileErr.stderr.toString() : compileErr.message;
      return res.json({
        status: 'compile_error',
        output: errorOutput || 'Compilation failed',
        stderr: errorOutput
      });
    }

    const executablePath = path.join(execDir, 'main');
    const inputData = input || '';

    try {
      const runResult = execSync(`"${executablePath}"`, {
        input: inputData,
        timeout: 5000,
        maxBuffer: 1024 * 1024,
        encoding: 'utf8'
      });
      
      res.json({
        status: 'success',
        output: runResult,
        stderr: ''
      });
    } catch (runErr) {
      const errorOutput = runErr.stderr ? runErr.stderr.toString() : runErr.message;
      const stdoutOutput = runErr.stdout ? runErr.stdout.toString() : '';
      
      res.json({
        status: 'runtime_error',
        output: stdoutOutput,
        stderr: errorOutput || 'Runtime Error'
      });
    }

    setTimeout(() => {
      try {
        fsExtra.removeSync(execDir);
      } catch (e) {}
    }, 300000);

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`CPPractice Backend running on port ${PORT}`);
});