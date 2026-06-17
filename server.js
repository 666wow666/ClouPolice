require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { config, printConfigValidation } = require('./src/backend/config');
const chatRouter = require('./src/backend/routes/chat');
const healthRouter = require('./src/backend/routes/health');
const { modelSelector } = require('./src/backend/services/modelSelector');

const app = express();
const port = config.port;
const DATA_DIR = path.join(__dirname, 'data');
const FILE_DIR = path.join(DATA_DIR, 'file');

if (!fs.existsSync(DATA_DIR)) {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log('[数据] 已创建 data 目录: ' + DATA_DIR);
    } catch (e) {
        console.error('[数据] 创建 data 目录失败:', e.message);
    }
}

if (!fs.existsSync(FILE_DIR)) {
    try {
        fs.mkdirSync(FILE_DIR, { recursive: true });
        console.log('[数据] 已创建 file 目录: ' + FILE_DIR);
    } catch (e) {
        console.error('[数据] 创建 file 目录失败:', e.message);
    }
}

function getDataFile() {
    return path.join(DATA_DIR, 'interrogations.json');
}

function readInterrogations() {
    const file = getDataFile();
    if (!fs.existsSync(file)) {
        return { interrogations: [], activeId: null };
    }
    try {
        const raw = fs.readFileSync(file, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        console.error('[数据] 读取失败:', e.message);
        return { interrogations: [], activeId: null };
    }
}

function writeInterrogations(data) {
    const file = getDataFile();
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('[数据] 写入失败:', e.message);
        return false;
    }
}

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.get('/', (req, res) => {
  res.redirect('/main.html');
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/') ||
      req.path.startsWith('/chat') ||
      req.path.startsWith('/health') ||
      req.path.includes('.')) {
    return next();
  }

  const clientIP = req.headers['x-forwarded-for'] ||
                  req.connection?.remoteAddress ||
                  req.socket?.remoteAddress ||
                  'unknown';
  const reqPath = req.path.replace(/^\//, '') || 'main.html';

  const authed = req.query.authed === '1';

  res.setHeader('Access-Control-Allow-Credentials', 'true');

  

  if (reqPath === 'data-collect.html') {
    if (!authed) {
      console.log(`[页面访问] ${clientIP} 尝试直接访问信息采集页，重定向到 auth.html`);
      return res.redirect('/auth.html');
    }
  }

  next();
});

app.use('/chat', chatRouter);
app.use('/health', healthRouter);

app.get('/api/interrogations', (req, res) => {
    const data = readInterrogations();
    res.json(data);
});

app.post('/api/interrogations', (req, res) => {
    const data = readInterrogations();
    const { name, content } = req.body || {};
    if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: '名称不能为空' });
    }
    const newItem = {
        id: 'int_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name: name.trim(),
        createdAt: new Date().toISOString(),
        data: Object.assign({
            recordContent: '',
            transcribedText: '',
            recommendedQuestions: [null, null, null, null, null],
            workflow1History: []
        }, content || {})
    };
    data.interrogations.push(newItem);
    data.activeId = newItem.id;
    writeInterrogations(data);
    res.json({ success: true, item: newItem });
});

app.put('/api/interrogations/:id', (req, res) => {
    const data = readInterrogations();
    const { id } = req.params;
    const { name, content } = req.body || {};
    const idx = data.interrogations.findIndex(i => i.id === id);
    if (idx < 0) {
        return res.status(404).json({ success: false, error: '未找到' });
    }
    if (name !== undefined) data.interrogations[idx].name = name.trim();
    if (content !== undefined) data.interrogations[idx].data = { ...(data.interrogations[idx].data || {}), ...content };
    if (req.body.activeId !== undefined) data.activeId = req.body.activeId;
    writeInterrogations(data);
    res.json({ success: true, item: data.interrogations[idx] });
});

app.post('/api/interrogations/:id', (req, res) => {
    if (req.query.method === 'PUT') {
        const data = readInterrogations();
        const { id } = req.params;
        const { name, content } = req.body || {};
        const idx = data.interrogations.findIndex(i => i.id === id);
        if (idx < 0) {
            return res.status(404).json({ success: false, error: '未找到' });
        }
        if (name !== undefined) data.interrogations[idx].name = name.trim();
        if (content !== undefined) data.interrogations[idx].data = { ...(data.interrogations[idx].data || {}), ...content };
        if (req.body.activeId !== undefined) data.activeId = req.body.activeId;
        writeInterrogations(data);
        console.log(`[数据] sendBeacon 保存成功，ID: ${id}`);
        return res.json({ success: true, item: data.interrogations[idx] });
    }
    res.status(405).json({ success: false, error: '方法不允许' });
});

function deleteInterrogationFiles(id) {
    try {
        let deletedCount = 0;

        // 遍历所有子目录（包括 cache 等）
        const items = fs.readdirSync(DATA_DIR);
        items.forEach(item => {
            const itemPath = path.join(DATA_DIR, item);
            const stat = fs.lstatSync(itemPath);

            if (stat.isFile() && item.includes(id)) {
                fs.unlinkSync(itemPath);
                deletedCount++;
                console.log(`[数据] 删除关联文件: ${item}`);
            } else if (stat.isDirectory() && item === 'cache') {
                // 额外检查 cache 子目录
                const cacheFiles = fs.readdirSync(itemPath);
                cacheFiles.forEach(cacheFile => {
                    if (cacheFile.includes(id)) {
                        const cachePath = path.join(itemPath, cacheFile);
                        fs.unlinkSync(cachePath);
                        deletedCount++;
                        console.log(`[数据] 删除缓存文件: cache/${cacheFile}`);
                    }
                });
            }
        });
        return { success: true, deletedFiles: deletedCount };
    } catch (e) {
        console.error('[数据] 删除关联文件失败:', e.message);
        return { success: false, error: e.message };
    }
}

app.delete('/api/interrogations/:id', (req, res) => {
    const data = readInterrogations();
    const { id } = req.params;
    const before = data.interrogations.length;
    
    const fileResult = deleteInterrogationFiles(id);
    if (!fileResult.success) {
        console.warn('[数据] 文件删除部分失败，但继续删除数据库记录');
    }
    
    data.interrogations = data.interrogations.filter(i => i.id !== id);
    if (data.activeId === id) {
        data.activeId = data.interrogations.length > 0 ? data.interrogations[0].id : null;
    }
    writeInterrogations(data);
    
    res.json({ 
        success: true, 
        removed: before - data.interrogations.length,
        deletedFiles: fileResult.deletedFiles || 0 
    });
});

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

app.post('/api/auth/verify', (req, res) => {
  const { password } = req.body;
  const storedHash = process.env.AUTH_PASSWORD_HASH;

  if (!storedHash) {
    return res.status(500).json({ success: false, error: '认证配置未设置' });
  }

  const inputHash = sha256(password);

  if (inputHash === storedHash) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: '密码错误' });
  }
});

app.get('/api/config', (req, res) => {
  console.log('[调试] XFYUN_APPID:', process.env.XFYUN_APPID);
  console.log('[调试] XFYUN_API_KEY:', process.env.XFYUN_API_KEY);
  console.log('[调试] 完整 process.env:', Object.keys(process.env).filter(k => k.includes('XF')));
  
  res.json({
    xfyunAppId: process.env.XFYUN_APPID || '',
    xfyunApiKey: process.env.XFYUN_API_KEY || ''
  });
});

app.get('/api/models', (req, res) => {
  const workflow1Model = modelSelector.getModelForWorkflow(1);
  const workflow2Model = modelSelector.getModelForWorkflow(2);
  const models = [];
  
  if (config.glm.apiKey) models.push({ name: 'glm', displayName: '智谱GLM', configured: true, current: workflow1Model === 'glm' });
  else models.push({ name: 'glm', displayName: '智谱GLM', configured: false, current: false });
  
  if (config.deepseek.apiKey) models.push({ name: 'deepseek', displayName: 'DeepSeek', configured: true, current: workflow1Model === 'deepseek' });
  else models.push({ name: 'deepseek', displayName: 'DeepSeek', configured: false, current: false });
  
  if (config.doubao.apiKey) models.push({ name: 'doubao', displayName: '豆包', configured: true, current: workflow1Model === 'doubao' });
  else models.push({ name: 'doubao', displayName: '豆包', configured: false, current: false });
  
  if (config.kimi.apiKey) models.push({ name: 'kimi', displayName: 'Kimi', configured: true, current: workflow1Model === 'kimi' });
  else models.push({ name: 'kimi', displayName: 'Kimi', configured: false, current: false });
  
  if (config.qianwen.apiKey) models.push({ name: 'qianwen', displayName: '千问', configured: true, current: workflow1Model === 'qianwen' });
  else models.push({ name: 'qianwen', displayName: '千问', configured: false, current: false });
  
  if (config.ernie.apiKey && config.ernie.secretKey) models.push({ name: 'ernie', displayName: '文心一言', configured: true, current: workflow1Model === 'ernie' });
  else models.push({ name: 'ernie', displayName: '文心一言', configured: false, current: false });
  
  if (config.nvidia.apiKey) models.push({ name: 'nvidia', displayName: 'NVIDIA', configured: true, current: workflow1Model === 'nvidia' });
  else models.push({ name: 'nvidia', displayName: 'NVIDIA', configured: false, current: false });
  
  res.json({
    workflow1Model: workflow1Model,
    workflow2Model: workflow2Model,
    currentModel: workflow1Model,
    models: models
  });
});

// ==================== 案件材料 API ====================

function parseCaseFolder(folderName) {
    const parts = folderName.split('_');
    if (parts.length < 4) {
        return { name: folderName, date: '', id: folderName };
    }
    const id = parts.slice(-3).join('_');
    const date = parts[parts.length - 4];
    const name = parts.slice(0, parts.length - 4).join('_');
    return { name, date, id };
}

app.get('/api/case/list', (req, res) => {
    try {
        const cases = [];
        if (!fs.existsSync(FILE_DIR)) {
            return res.json({ success: true, cases: [] });
        }

        const folders = fs.readdirSync(FILE_DIR, { withFileTypes: true })
            .filter(dir => dir.isDirectory())
            .sort((a, b) => {
                const statA = fs.statSync(path.join(FILE_DIR, a.name));
                const statB = fs.statSync(path.join(FILE_DIR, b.name));
                return statB.mtime.getTime() - statA.mtime.getTime();
            });

        folders.forEach(folder => {
            const casePath = path.join(FILE_DIR, folder.name);
            const files = fs.readdirSync(casePath);
            const stat = fs.statSync(casePath);

            const { name, date, id } = parseCaseFolder(folder.name);

            cases.push({
                id: id,
                name: name,
                date: date,
                folderName: folder.name,
                createdAt: stat.birthtime,
                updatedAt: stat.mtime,
                files: files,
                hasDoc: files.some(f => f.endsWith('.doc')),
                hasRecordTxt: files.some(f => f.includes('笔录') && f.endsWith('.txt')),
                hasTranscriptTxt: files.some(f => f.includes('转写'))
            });
        });

        res.json({ success: true, cases: cases });
    } catch (e) {
        console.error('[案件] 获取列表失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 完成审讯 - 创建案件文件夹并保存材料
app.post('/api/case/complete', (req, res) => {
    try {
        const { interrogationId, interrogationName, recordHtml, recordText, transcriptContent } = req.body;
        
        if (!interrogationId) {
            return res.status(400).json({ success: false, error: '缺少审讯ID' });
        }
        
        // 生成案件文件夹名称：名称_日期_id
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const folderName = `${interrogationName || '审讯'}_${date}_${interrogationId}`;
        const casePath = path.join(FILE_DIR, folderName);
        
        // 创建案件文件夹
        if (!fs.existsSync(casePath)) {
            fs.mkdirSync(casePath, { recursive: true });
            console.log('[案件] 已创建案件文件夹:', casePath);
        }
        
        const savedFiles = [];
        
        // 1. 保存笔录内容（.doc 格式，HTML 转 Word）
        if (recordHtml) {
            const docContent = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>询问笔录</title>
<style>
body { font-family: '仿宋_GB2312', '仿宋', FangSong, SimSun; font-size: 10pt !important; margin: 2cm 2.5cm 2cm 2cm; }
h1 { text-align: center; font-size: 20pt; font-weight: bold; margin: 30px 0; }
div, p { font-size: inherit !important; }
</style>
</head>
<body>
<h1>询问笔录</h1>
${recordHtml}
</body>
</html>`;
            const docFile = path.join(casePath, '询问笔录.doc');
            fs.writeFileSync(docFile, docContent, 'utf-8');
            savedFiles.push({ name: '询问笔录.doc', path: docFile });
            console.log('[案件] 已保存笔录(Word):', docFile);
        }
        
        // 2. 保存笔录内容（.txt 格式，纯文本）
        if (recordText) {
            const txtFile = path.join(casePath, '询问笔录.txt');
            fs.writeFileSync(txtFile, recordText, 'utf-8');
            savedFiles.push({ name: '询问笔录.txt', path: txtFile });
            console.log('[案件] 已保存笔录(文本):', txtFile);
        }
        
        // 3. 保存对话转写/录音记录
        if (transcriptContent) {
            const transcriptFile = path.join(casePath, '对话转写.txt');
            fs.writeFileSync(transcriptFile, transcriptContent, 'utf-8');
            savedFiles.push({ name: '对话转写.txt', path: transcriptFile });
            console.log('[案件] 已保存对话转写:', transcriptFile);
        }
        
        res.json({
            success: true,
            message: '案件材料已保存',
            caseId: interrogationId,
            folderName: folderName,
            savedFiles: savedFiles.map(f => f.name)
        });
        
    } catch (e) {
        console.error('[案件] 保存失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/case/:caseId', (req, res) => {
    try {
        const { caseId } = req.params;

        if (!fs.existsSync(FILE_DIR)) {
            return res.json({ success: true, case: null, files: [] });
        }

        const folders = fs.readdirSync(FILE_DIR, { withFileTypes: true })
            .filter(dir => dir.isDirectory() && dir.name.endsWith(`_${caseId}`));

        if (folders.length === 0) {
            return res.json({ success: true, case: null, files: [] });
        }

        const folder = folders[0];
        const casePath = path.join(FILE_DIR, folder.name);
        const files = fs.readdirSync(casePath);
        const stat = fs.statSync(casePath);

        const { name, date, id } = parseCaseFolder(folder.name);

        const caseData = {
            id: id,
            name: name,
            date: date,
            folderName: folder.name,
            createdAt: stat.birthtime,
            updatedAt: stat.mtime,
            files: files.map(file => {
                const fileStat = fs.statSync(path.join(casePath, file));
                return {
                    name: file,
                    size: fileStat.size,
                    createdAt: fileStat.birthtime
                };
            })
        };

        res.json({ success: true, case: caseData });

    } catch (e) {
        console.error('[案件] 获取详情失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 读取案件文件内容
app.get('/api/case/:caseId/file/:filename', (req, res) => {
    try {
        const { caseId, filename } = req.params;
        
        if (!fs.existsSync(FILE_DIR)) {
            return res.status(404).json({ success: false, error: '文件目录不存在' });
        }
        
        // 查找案件文件夹
        const folders = fs.readdirSync(FILE_DIR, { withFileTypes: true })
            .filter(dir => dir.isDirectory() && dir.name.endsWith(`_${caseId}`));
        
        if (folders.length === 0) {
            return res.status(404).json({ success: false, error: '案件不存在' });
        }
        
        const filePath = path.join(FILE_DIR, folders[0].name, decodeURIComponent(filename));
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ success: true, content: content, filename: filename });
        
    } catch (e) {
        console.error('[案件] 读取文件失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 下载案件文件
app.get('/api/case/:caseId/download/:filename', (req, res) => {
    try {
        const { caseId, filename } = req.params;
        
        if (!fs.existsSync(FILE_DIR)) {
            return res.status(404).json({ success: false, error: '文件目录不存在' });
        }
        
        const folders = fs.readdirSync(FILE_DIR, { withFileTypes: true })
            .filter(dir => dir.isDirectory() && dir.name.endsWith(`_${caseId}`));
        
        if (folders.length === 0) {
            return res.status(404).json({ success: false, error: '案件不存在' });
        }
        
        const filePath = path.join(FILE_DIR, folders[0].name, decodeURIComponent(filename));
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }
        
        res.download(filePath, decodeURIComponent(filename));
        
    } catch (e) {
        console.error('[案件] 下载文件失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

async function startServer() {
  console.log('\n正在初始化 CloudPolice...\n');
  printConfigValidation();
  
  const modelNames = {
    glm: '智谱GLM',
    deepseek: 'DeepSeek',
    doubao: '豆包',
    kimi: 'Kimi',
    ernie: '文心一言',
    nvidia: 'NVIDIA',
    qianwen: '千问'
  };
  
  if (config.enableTerminalSelection) {
    console.log(' 终端模型选择已启用\n');
    await modelSelector.promptForSelection();
  } else {
    console.log('终端模型选择已禁用，直接使用默认模型\n');
  }
  
  const workflow1Model = modelSelector.getModelForWorkflow(1);
  const workflow2Model = modelSelector.getModelForWorkflow(2);
  
  function getModelVersion(modelName, workflowNum) {
    const modelConfig = config[modelName];
    if (!modelConfig) return '';
    if (workflowNum === 1 && modelConfig.workflow1Model) {
      return ` (${modelConfig.workflow1Model})`;
    } else if (workflowNum === 2 && modelConfig.workflow2Model) {
      return ` (${modelConfig.workflow2Model})`;
    } else if (modelConfig.model) {
      return ` (${modelConfig.model})`;
    }
    return '';
  }
  
  console.log(`\n 服务器运行在 http://localhost:${port}`);
  console.log(` 工作流1（推荐问题）模型: ${modelNames[workflow1Model] || workflow1Model}${getModelVersion(workflow1Model, 1)}`);
  console.log(`工作流2（笔录生成）模型: ${modelNames[workflow2Model] || workflow2Model}${getModelVersion(workflow2Model, 2)}`);
  console.log('');
  
  app.listen(port, () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  CloudPolice 服务已启动');
    console.log('═══════════════════════════════════════════════════════════\n');
  });
}

startServer().catch(console.error);