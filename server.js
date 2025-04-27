import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Get the user's home directory and set up paths
const homeDir = process.env.HOME || process.env.USERPROFILE;
const appDataDir = path.join(homeDir, 'Library', 'Application Support', 'com.chat.app');
const conversationsDir = path.join(appDataDir, 'chat_conversations');
const modelsPath = path.join(appDataDir, 'models.json');
const appearanceSettingsPath = path.join(appDataDir, 'appearance.json');
const promptsPath = path.join(appDataDir, 'prompts.json');

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir(appDataDir, { recursive: true });
  await fs.mkdir(conversationsDir, { recursive: true });
  
  // Ensure models.json exists with default content
  try {
    await fs.access(modelsPath);
  } catch {
    const defaultModels = {
      "Grok 3": "x-ai/grok-3-beta",
      "DeepSeek R1": "deepseek/deepseek-r1",
      "Claude 3 Opus": "anthropic/claude-3-opus",
      "GPT-4 Turbo": "openai/gpt-4-turbo-preview",
      "Mixtral 8x7B": "mistral/mixtral-8x7b"
    };
    await fs.writeFile(modelsPath, JSON.stringify(defaultModels, null, 2));
  }

  // Ensure appearance.json exists with default content
  try {
    await fs.access(appearanceSettingsPath);
  } catch {
    const defaultAppearance = {
      scale: 1,
      fontSize: 14
    };
    await fs.writeFile(appearanceSettingsPath, JSON.stringify(defaultAppearance, null, 2));
  }

  // Ensure prompts.json exists with default content
  try {
    await fs.access(promptsPath);
    console.log('✓ prompts.json exists');
  } catch {
    console.log('Creating prompts.json with default content');
    const defaultPrompts = [];
    await fs.writeFile(promptsPath, JSON.stringify(defaultPrompts, null, 2));
    console.log('✓ Created prompts.json');
  }

  // Ensure index.json exists
  const indexPath = path.join(conversationsDir, 'index.json');
  try {
    await fs.access(indexPath);
  } catch {
    await fs.writeFile(indexPath, '[]');
  }
}

// Conversations endpoints
app.get('/conversations/index', async (req, res) => {
  try {
    const indexPath = path.join(conversationsDir, 'index.json');
    const content = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(content);
    res.json(index);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/conversations/:filename', async (req, res) => {
  try {
    const filePath = path.join(conversationsDir, req.params.filename);
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ content: JSON.parse(content) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/conversations/:filename', async (req, res) => {
  try {
    const filePath = path.join(conversationsDir, req.params.filename);
    const indexPath = path.join(conversationsDir, 'index.json');
    
    // Save conversation file
    await fs.writeFile(filePath, JSON.stringify(req.body.content, null, 2));
    
    // Update index
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    let index = JSON.parse(indexContent);
    if (!index.includes(req.params.filename)) {
      index.push(req.params.filename);
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/conversations/:filename', async (req, res) => {
  try {
    console.log('Received delete request for file:', req.params.filename);
    
    const filePath = path.join(conversationsDir, req.params.filename);
    console.log('Full file path:', filePath);
    
    // Check if file exists before deletion
    try {
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      console.log('File exists:', fileExists);
      if (!fileExists) {
        console.log('File not found, checking index for similar files...');
        // Get all files in index
        const indexPath = path.join(conversationsDir, 'index.json');
        const indexContent = await fs.readFile(indexPath, 'utf-8');
        const index = JSON.parse(indexContent);
        console.log('All files in index:', index);
      }
    } catch (error) {
      console.error('Error checking file existence:', error);
    }
    
    // Delete conversation file
    try {
      await fs.unlink(filePath);
      console.log('Successfully deleted file:', req.params.filename);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      console.log('File not found (already deleted):', req.params.filename);
    }
    
    // Update index
    const indexPath = path.join(conversationsDir, 'index.json');
    console.log('Updating index file:', indexPath);
    
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    let index = JSON.parse(indexContent);
    const originalLength = index.length;
    index = index.filter(f => f !== req.params.filename);
    console.log(`Removed file from index. Index size changed from ${originalLength} to ${index.length}`);
    
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    console.log('Successfully updated index file');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error during deletion:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/conversations', async (req, res) => {
  try {
    const indexPath = path.join(conversationsDir, 'index.json');
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(indexContent);
    
    // Delete all conversation files
    for (const filename of index) {
      const filePath = path.join(conversationsDir, filename);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    
    // Reset index
    await fs.writeFile(indexPath, '[]');
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Models endpoints
app.get('/models', async (req, res) => {
  try {
    const content = await fs.readFile(modelsPath, 'utf-8');
    res.json(JSON.parse(content));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/models', async (req, res) => {
  try {
    await fs.writeFile(modelsPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete specific model endpoint
app.delete('/models/:modelId', async (req, res) => {
  try {
    const content = await fs.readFile(modelsPath, 'utf-8');
    const models = JSON.parse(content);
    
    // Find and remove the model by ID
    const modelEntries = Object.entries(models);
    const filteredModels = modelEntries.reduce((acc, [name, id]) => {
      if (id !== req.params.modelId) {
        acc[name] = id;
      }
      return acc;
    }, {});

    await fs.writeFile(modelsPath, JSON.stringify(filteredModels, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Appearance settings endpoints
app.get('/appearance', async (req, res) => {
  try {
    const content = await fs.readFile(appearanceSettingsPath, 'utf-8');
    res.json(JSON.parse(content));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/appearance', async (req, res) => {
  try {
    await fs.writeFile(appearanceSettingsPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Prompts endpoints
app.get('/prompts', async (req, res) => {
  console.log('\n🔍 GET /prompts - Fetching prompts');
  try {
    const content = await fs.readFile(promptsPath, 'utf-8');
    const prompts = JSON.parse(content);
    console.log('📋 Current prompts in file:', prompts);
    console.log(`✅ GET /prompts - Found ${prompts.length} prompts`);
    res.json(prompts);
  } catch (error) {
    console.error('❌ GET /prompts - Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/prompts', async (req, res) => {
  console.log('\n💾 POST /prompts - Saving prompts');
  console.log('📝 Prompts to save:', req.body);
  try {
    await fs.writeFile(promptsPath, JSON.stringify(req.body, null, 2));
    console.log('✅ POST /prompts - Successfully saved prompts');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /prompts - Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/prompts/:id', async (req, res) => {
  console.log(`\n🗑️  DELETE /prompts/${req.params.id} - Deleting prompt`);
  try {
    // First check if file exists
    console.log('📂 Checking if prompts.json exists...');
    try {
      await fs.access(promptsPath);
      console.log('✅ prompts.json found');
    } catch (error) {
      console.error('❌ prompts.json not found:', error);
      throw new Error('Prompts file not found');
    }

    // Read current prompts
    console.log('📖 Reading current prompts...');
    const content = await fs.readFile(promptsPath, 'utf-8');
    const prompts = JSON.parse(content);
    console.log('📋 Current prompts:', prompts);
    
    // Find prompt to delete
    const promptToDelete = prompts.find(p => p.id === req.params.id);
    if (!promptToDelete) {
      console.log('⚠️ Prompt not found with id:', req.params.id);
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }
    console.log('🎯 Found prompt to delete:', promptToDelete);

    // Filter out the prompt
    const filteredPrompts = prompts.filter(prompt => prompt.id !== req.params.id);
    console.log('📋 Prompts after filtering:', filteredPrompts);
    
    // Write back to file
    console.log('💾 Writing updated prompts back to file...');
    await fs.writeFile(promptsPath, JSON.stringify(filteredPrompts, null, 2));
    console.log('✅ Successfully deleted prompt and updated file');
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error during deletion:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize and start server
async function start() {
  await ensureDirectories();
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

start().catch(console.error); 