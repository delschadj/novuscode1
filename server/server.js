process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const cors = require('cors');
const admin = require('firebase-admin');
const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 4000;

// Initialize Google Cloud Storage
const storage = new Storage({
  keyFilename: 'gcloudKey.json'
});
const bucket = storage.bucket('novacode');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert('firebaseKey.json')
});
const db = admin.firestore();

// Initialize Vertex AI
const vertex_ai = new VertexAI({ project: 'novacode-432817', location: 'us-central1' });
const model = 'gemini-1.5-flash-001';
const generativeModel = vertex_ai.preview.getGenerativeModel({
  model: model,
  generationConfig: {
    'maxOutputTokens': 8192,
    'temperature': 1,
    'topP': 0.95,
  },
  safetySettings: [
    {
      'category': 'HARM_CATEGORY_HATE_SPEECH',
      'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
    },
    {
      'category': 'HARM_CATEGORY_DANGEROUS_CONTENT',
      'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
    },
    {
      'category': 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
    },
    {
      'category': 'HARM_CATEGORY_HARASSMENT',
      'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
    }
  ],
});
const chat = generativeModel.startChat({});

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ENDPOINTS
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Extract metadata from the request body
    const { name, description, organization } = req.body;

    // Add metadata to Firestore
    const docRef = await db.collection('projects').add({
      name,
      description,
      organization,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const docId = docRef.id;
    console.log('Document written with ID: ', docId);

    // Create a file path within the folder named with the document ID
    const filePath = `${docId}/${req.file.originalname}`;
    const blob = bucket.file(filePath);
    const blobStream = blob.createWriteStream();

    blobStream.on('error', (err) => {
      console.error('Error during file upload:', err);
      return res.status(500).json({ message: 'Error uploading file.', error: err.message });
    });

    blobStream.on('finish', async () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      try {
        // Update Firestore with the file URL
        await docRef.update({ fileUrl: publicUrl });

        return res.status(200).json({ 
          message: 'File uploaded and project added successfully.',
          url: publicUrl,
          projectId: docId
        });
      } catch (firestoreError) {
        console.error('Error updating document: ', firestoreError);
        return res.status(500).json({ message: 'Error updating project in database.', error: firestoreError.message });
      }
    });

    blobStream.end(req.file.buffer);
  } catch (error) {
    console.error('Unexpected error during file upload:', error);
    return res.status(500).json({ message: 'Unexpected error occurred.', error: error.message });
  }
});

app.get('/file/:projectId/:filename', async (req, res) => {
  try {
    const { projectId, filename } = req.params;
    const filePath = `${projectId}/${filename}`;
    const file = bucket.file(filePath);

    const [fileExists] = await file.exists();
    if (!fileExists) {
      return res.status(404).json({ message: 'File not found' });
    }

    const [fileContents] = await file.download();
    res.set('Content-Type', 'text/plain');
    res.send(fileContents);
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({ message: 'Error fetching file', error: error.message });
  }
});

app.post('/test', async (req, res) => {
  try {
    const { message } = req.body;
    // For now, just return a static response
    res.status(200).json('Example response');
  } catch (error) {
    console.error('Error handling chat information:', error);
    res.status(500).json({ message: 'Error processing request', error: error.message });
  }
});

app.post('/vertex', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Send the message to the Vertex AI chat model
    const streamResult = await chat.sendMessageStream(message);
    const response = (await streamResult.response).candidates[0].content;

    res.status(200).json({ message: response });
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ message: 'Error processing request', error: error.message });
  }
});

// New route to serve the directory and file structure JSON
app.post('/testDirectory', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'directoryTest.json');
    const fileData = fs.readFileSync(filePath, 'utf8');
    const directoryStructure = JSON.parse(fileData);

    res.status(200).json(directoryStructure);
  } catch (error) {
    console.error('Error reading directory structure file:', error);
    res.status(500).json({ message: 'Error reading directory structure file', error: error.message });
  }
});


// Fetch file for code explorer (cloud)
app.post('/fetch-file-cloud', async (req, res) => {
  const { apiUrl } = req.body;

  if (!apiUrl) {
    return res.status(400).send('API URL is required');
  }

  try {
    // Create an Axios instance with the proxy disabled
    const axiosInstance = axios.create({
      proxy: false // This disables the proxy
    });

    // Make a GET request to the provided API URL using the Axios instance
    const response = await axiosInstance.get(apiUrl);

    // Send the file content back to the frontend
    res.send(response.data);
  } catch (error) {
    console.error('Error fetching file content from the API:', error);
    res.status(500).send('Error fetching file content');
  }
});

// Fetch file for code explorer (local with folder)
app.post('/fetch-file-local', async (req, res) => {
  const { apiUrl } = req.body;

  if (!apiUrl) {
    return res.status(400).send('API URL is required');
  }

  try {
    // Create an Axios instance with the proxy disabled
    const axiosInstance = axios.create({
      proxy: false // This disables the proxy
    });

    // Make a GET request to the provided API URL using the Axios instance
    const response = await axiosInstance.get(apiUrl);

    // Send the file content back to the frontend
    res.send(response.data);
  } catch (error) {
    console.error('Error fetching file content from the API:', error);
    res.status(500).send('Error fetching file content');
  }
});

app.post('/saveChat', async (req, res) => {
  try {
    const { uid, projectID, title, messages } = req.body;

    // Validate required fields
    if (!uid || !projectID || !title) {
      return res.status(400).json({ message: 'uid, projectId, and title are required' });
    }

    // Generate a new custom ID for the chat
    const chatId = `${uid}-${projectID}-${Date.now()}`;

    // Reference to the document with the custom ID
    const chatRef = db.collection('chats').doc(chatId);

    // Save the document
    await chatRef.set({
      uid,
      projectID,
      title,
      messages,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send back all received data along with the chatId
    res.status(200).json({
      chatId: chatId,
      uid: uid,
      projectID: projectID,
      title: title,
      messages: messages,
      timestamp: new Date().toISOString(),
      message: 'Chat message saved successfully.'
    });
  } catch (error) {
    console.error('Error saving chat message:', error);
    res.status(500).json({ message: 'Error saving chat message', error: error.message });
  }
});


app.post('/updateChat', async (req, res) => {
  try {
    const { chatId, newMessage } = req.body;

    if (!chatId || !newMessage) {
      return res.status(400).json({ message: 'chatId and newMessage are required' });
    }

    // Reference to the chat document by its ID
    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Append the new message to the messages array
    await chatRef.update({
      messages: admin.firestore.FieldValue.arrayUnion(newMessage),
    });

    res.status(200).json({ message: 'Chat updated successfully.' });
  } catch (error) {
    console.error('Error updating chat:', error);
    res.status(500).json({ message: 'Error updating chat', error: error.message });
  }
});


app.post('/retrieveChats', async (req, res) => {
  try {
    const { uid, projectID } = req.body;

    if (!uid || !projectID) {
      return res.status(400).json({ error: 'Both uid and projectID are required' });
    }

    const chatsRef = db.collection('chats'); // Reference to the main 'chats' collection
    
    // Filter the documents by uid and projectID
    const snapshot = await chatsRef
      .where('uid', '==', uid)
      .where('projectID', '==', projectID)
      .orderBy('timestamp', 'desc')
      .get();
    
    const chats = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate().toISOString() // Convert Firestore Timestamp to ISO string
    }));
    
    res.json(chats);
  } catch (error) {
    console.error('Error retrieving chats:', error);
    res.status(500).json({ error: 'Failed to retrieve chats' });
  }
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
